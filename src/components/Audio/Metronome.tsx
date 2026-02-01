import React, { useState, useEffect } from 'react';
import { useMetronome } from '../../hooks/useMetronome';
import { useAudioAnalysis } from '../../hooks/useAudioAnalysis';
import { useRhythmScoring } from '../../hooks/useRhythmScoring';
import { useSessionManager } from '../../hooks/useSessionManager';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { MetronomeSettings } from '../Controls/MetronomeSettings';
import { PatternVisualizer } from '../Visualizer/PatternVisualizer';
import { WaveformVisualizer } from '../Audio/WaveformVisualizer';
import { HistoryView } from '../Analysis/HistoryView';
import { TimingGauge } from '../Visualizer/TimingGauge';
import { PATTERNS } from '../../utils/patterns';

export const Metronome: React.FC = () => {
    // ---- State ----
    const [activeTab, setActiveTab] = useState<'training' | 'history'>('training');
    const [selectedPatternId, setSelectedPatternId] = useState(PATTERNS[2].id);
    const selectedPattern = PATTERNS.find(p => p.id === selectedPatternId) || PATTERNS[0];
    const [disableRecording, setDisableRecording] = useState(false);
    const [settingsExpanded, setSettingsExpanded] = useState(false);

    // Latency State
    const [audioLatency, setAudioLatency] = useState(() => Number(localStorage.getItem('audioLatency') || 0));
    // Auto Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Beat History for Visualizer
    const [beatHistory, setBeatHistory] = useState<number[]>([]);

    useEffect(() => {
        localStorage.setItem('audioLatency', audioLatency.toString());
    }, [audioLatency]);

    // ---- Hooks ----
    const {
        bpm, isPlaying, start, stop, changeBpm,
        currentStep, lastBeatTime, isCountIn,
        setSubdivision, setGapClick,
        audioContext,
        initializeAudio
    } = useMetronome();

    const { isMicReady, startAnalysis, stopAnalysis, clearOnsets, onsets, mediaStream } = useAudioAnalysis({ audioContext });

    // NEW STRATEGY for Calibration:
    const [calibrationState, setCalibrationState] = useState<{
        active: boolean,
        startTime: number,
        samples: number[],
        count: number,
        status: string // 'starting' | 'waiting_mic' | 'warmup' | 'listening' | 'finished'
    }>({ active: false, startTime: 0, samples: [], count: 0, status: 'starting' });

    const calibrationTimeoutRef = React.useRef<any>(null);

    const runCalibration = async () => {
        if (isPlaying) stop();

        // Ensure Audio Context is ready
        if (!audioContext) {
            initializeAudio();
            // Do not call startAnalysis yet, wait for effect
        } else if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('[AutoCheck] AudioContext resumed');
            } catch (e) { console.error('[AutoCheck] Resume failed', e); }
        }

        setCalibrationState({ active: true, startTime: 0, samples: [], count: 0, status: 'waiting_mic' });
        setIsCalibrating(true);
        console.log('[AutoCheck] Started process...');
    };

    const abortCalibration = () => {
        console.log('[AutoCheck] Aborted/Timeout');
        setCalibrationState({ active: false, startTime: 0, samples: [], count: 0, status: 'starting' });
        setIsCalibrating(false);
        stopAnalysis();
        if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
    };

    // Calibration Loop Effect (Scheduling Click)
    useEffect(() => {
        if (!calibrationState.active) {
            if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
            return;
        }

        // Step 0: Ensure Context & Mic
        if (calibrationState.status === 'waiting_mic') {
            if (!audioContext) {
                // Context still loading?
                console.log('[AutoCheck] Waiting for AudioContext...');
                return;
            }

            // Attempt to start analysis if not ready
            if (!isMicReady) {
                console.log('[AutoCheck] Requesting Mic...');
                // We call this every render if not ready, which is fine since startAnalysis is guarded
                startAnalysis();
                return;
            }

            // If ready, proceed to warmup
            console.log('[AutoCheck] Mic ready. Warming up...');
            setCalibrationState(prev => ({ ...prev, status: 'warmup' }));

            if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
            calibrationTimeoutRef.current = setTimeout(() => {
                console.log('[AutoCheck] Warmup complete. Starting clicks.');
                setCalibrationState(prev => ({ ...prev, status: 'starting' }));
            }, 1000); // 1.0s warmup
            return;
        }

        // Step 2: Warmup (waiting for timeout)
        if (calibrationState.status === 'warmup') return;

        // Step 3: Starting clicks
        if (!audioContext) return;

        // If we need to play a click (startTime is 0)
        if (calibrationState.startTime === 0) {
            const now = audioContext.currentTime;

            // Wait a bit before clicking (stability)
            const scheduleTime = now + 0.5;

            // Generate Click
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.setValueAtTime(800, scheduleTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, scheduleTime + 0.1);
            gain.gain.setValueAtTime(0.8, scheduleTime); // Loud click
            gain.gain.exponentialRampToValueAtTime(0.01, scheduleTime + 0.1);

            osc.start(scheduleTime);
            osc.stop(scheduleTime + 0.1);

            console.log('[AutoCheck] Click scheduled at', scheduleTime, 'Current:', now);
            setCalibrationState(prev => ({ ...prev, startTime: scheduleTime, status: 'listening' }));

            // Set timeout for this specific click
            if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
            calibrationTimeoutRef.current = setTimeout(() => {
                console.warn('[AutoCheck] Timeout waiting for onset');
                abortCalibration();
                alert("Calibration failed: Microphone didn't detect the click. Please increase volume or use external speakers.");
            }, 3000); // 3s timeout
        }

    }, [calibrationState, audioContext, isMicReady, startAnalysis]);

    // Capture Onset during Calibration
    useEffect(() => {
        if (!calibrationState.active || calibrationState.startTime === 0) return;

        // Check if we have a new onset that matches our start time
        if (onsets.length > 0) {
            const lastOnset = onsets[onsets.length - 1];

            // If the onset is AFTER our click
            if (lastOnset > calibrationState.startTime) {
                const latency = (lastOnset - calibrationState.startTime) * 1000; // ms
                console.log('[AutoCheck] Detection:', latency, 'ms');

                // Clear timeout since we found it
                if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);

                // Sanity check
                if (latency < 1000) {
                    const newSamples = [...calibrationState.samples, latency];

                    if (newSamples.length >= 5) {
                        // Done
                        const avg = newSamples.reduce((a, b) => a + b, 0) / newSamples.length;
                        console.log('[AutoCheck] Complete. Avg:', avg);
                        setAudioLatency(Math.round(avg));
                        setCalibrationState({ active: false, startTime: 0, samples: [], count: 0, status: 'finished' });
                        setIsCalibrating(false);
                        stopAnalysis();
                    } else {
                        // Next iteration
                        console.log('[AutoCheck] Next iteration');
                        setCalibrationState(prev => ({
                            ...prev,
                            samples: newSamples,
                            startTime: 0, // Reset scan trigger
                            count: prev.count + 1,
                            status: 'starting'
                        }));
                    }
                } else {
                    console.warn('[AutoCheck] high latency ignored:', latency);
                }
            }
        }
    }, [onsets, calibrationState]);


    const { feedback, offsetMs } = useRhythmScoring({ onsets, lastBeatTime, bpm, audioLatency });
    const { startRecording, stopRecording, clearRecording, audioBlob, startTime, duration } = useAudioRecorder();

    // ---- Logic ----
    useSessionManager({
        isPlaying,
        bpm,
        patternId: selectedPatternId,
        latestOffsetMs: offsetMs,
        feedback
    });

    const toggle = () => {
        // If Calibrating, toggle acts as Cancel
        if (isCalibrating) {
            abortCalibration();
            return;
        }

        if (isPlaying) {
            stop();
            stopRecording();
            stopAnalysis(); // Always stop mic
        } else {
            // Clear previous session data immediately on start
            clearRecording();
            clearOnsets();
            setBeatHistory([]); // Clear history
            start();
        }
    };

    // Capture beats for history
    useEffect(() => {
        if (isPlaying && !disableRecording && !isCountIn && lastBeatTime > 0) {
            setBeatHistory(prev => [...prev, lastBeatTime]);
        }
    }, [lastBeatTime, isPlaying, disableRecording, isCountIn]);


    // Auto-record & Analysis when playing + mic ready + NOT count-in
    useEffect(() => {
        if (isPlaying && !disableRecording) {
            if (isCountIn) {
                // During count-in: Stop/Don't start mic
            } else {
                // Count-in finished or not needed.
                if (!isMicReady) {
                    startAnalysis();
                }

                // Also start recording if stream ready
                if (isMicReady && mediaStream) {
                    startRecording(mediaStream, audioContext?.currentTime || 0);
                }
            }
        }
    }, [isPlaying, isCountIn, isMicReady, mediaStream, disableRecording, audioContext, startAnalysis, startRecording]);

    // Theme Handler
    const handleThemeChange = (theme: 'light' | 'dark') => {
        document.documentElement.setAttribute('data-theme', theme);
    };

    // ---- Render ----
    return (
        <section className="metronome-container" style={{ padding: '1rem 0', width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid var(--color-surface-hover)', padding: '0 1rem' }}>
                {['training', 'history'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-dim)',
                            borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : 'none',
                            fontWeight: 'bold',
                            textTransform: 'capitalize'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'training' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem' }}>

                    {/* 1. Pattern Select */}
                    <div>
                        <select
                            value={selectedPatternId}
                            onChange={(e) => setSelectedPatternId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                fontSize: '1rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                                outline: 'none'
                            }}
                        >
                            {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Visualizer & Feedback */}
                    <div style={{ position: 'relative' }}>
                        <PatternVisualizer pattern={selectedPattern} currentStep={currentStep} isPlaying={isPlaying} />

                        {isPlaying && isCountIn && (
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                background: 'rgba(0,0,0,0.8)',
                                color: '#fff',
                                padding: '1rem',
                                borderRadius: '1rem',
                                fontWeight: 'bold',
                                fontSize: '2rem',
                                zIndex: 100,
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap'
                            }}>
                                COUNT IN
                            </div>
                        )}
                        {isCalibrating && (
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                background: 'rgba(0,0,0,0.8)',
                                color: 'var(--color-accent)',
                                padding: '1rem',
                                borderRadius: '1rem',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                zIndex: 100,
                                pointerEvents: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <div>Calibrating... {calibrationState.count + 1}/5</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                    {calibrationState.status === 'starting' || calibrationState.status === 'listening' ? 'Listening...' : (calibrationState.status === 'warmup' ? 'Warming up...' : 'Waiting for Mic...')}
                                </div>
                                <button
                                    onClick={abortCalibration}
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '0.3rem 0.6rem',
                                        background: '#333',
                                        border: '1px solid #666',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                    </div>

                    {/* Feedback Display (Gauge) */}
                    <div style={{ height: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                        {feedback ? (
                            <>
                                <TimingGauge offsetMs={offsetMs} feedback={feedback} />
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: feedback === 'Perfect' ? 'var(--color-success)' : feedback === 'Good' ? 'var(--color-accent)' : 'var(--color-error)', marginTop: '2px' }}>
                                    {Math.round(Math.abs(offsetMs))}ms
                                </div>
                            </>
                        ) : <div style={{ height: '24px' }}></div>}
                    </div>

                    {/* 2. Unified Control Panel (Start/Stop + Tempo) */}
                    <div className="control-panel" style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1.5px solid var(--color-border)'
                    }}>
                        {/* Left: Start/Stop Button */}
                        <div style={{
                            flex: '0 0 80px',
                            borderRight: '1.5px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <button
                                onClick={toggle}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: isPlaying ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                                    color: isPlaying ? 'var(--color-accent)' : '#fff',
                                    border: 'none',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                            >
                                {isPlaying ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                            {/* No Rec Toggle (compact) */}
                            <label style={{
                                fontSize: '0.7rem',
                                color: 'var(--color-text-dim)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '4px',
                                background: 'var(--color-surface)',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={disableRecording}
                                    onChange={e => setDisableRecording(e.target.checked)}
                                    style={{ margin: 0, transform: 'scale(0.8)' }}
                                />
                                NoRec
                            </label>
                        </div>

                        {/* Right: Tempo Controls */}
                        <div style={{ flex: 1, padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                                <button onClick={() => changeBpm(bpm - 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.8rem' }}>-10</button>
                                <button onClick={() => changeBpm(bpm - 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.8rem' }}>-1</button>

                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-primary)', minWidth: '60px', textAlign: 'center', margin: '0 4px' }}>
                                    {bpm}
                                </div>

                                <button onClick={() => changeBpm(bpm + 1)} style={{ flex: 1, minWidth: '24px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.8rem' }}>+1</button>
                                <button onClick={() => changeBpm(bpm + 10)} style={{ flex: 1, minWidth: '30px', padding: '6px 2px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.8rem' }}>+10</button>
                            </div>

                            {/* Slider */}
                            <input
                                type="range"
                                min="40" max="240"
                                value={bpm}
                                onChange={e => changeBpm(parseInt(e.target.value))}
                                style={{ width: '95%', margin: '4px auto 0', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                            />
                            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>TEMPO</div>
                        </div>
                    </div>

                    {/* Review Waveform */}
                    {!isPlaying && audioBlob && (
                        <div style={{ width: '100%', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                            <WaveformVisualizer
                                audioBlob={audioBlob}
                                onsets={onsets}
                                startTime={startTime}
                                duration={duration}
                                audioContext={audioContext}
                                beatHistory={beatHistory}
                                audioLatency={audioLatency}
                            />
                        </div>
                    )}

                    {/* 4. Settings (Collapsible) */}
                    <MetronomeSettings
                        onSubdivisionChange={setSubdivision}
                        onGapClickChange={setGapClick}
                        onThemeChange={handleThemeChange}
                        isExpanded={settingsExpanded}
                        onToggleExpand={() => setSettingsExpanded(!settingsExpanded)}
                        audioLatency={audioLatency}
                        onAudioLatencyChange={setAudioLatency}
                        onRunAutoCalibration={runCalibration}
                        isCalibrating={calibrationState.active}
                    />
                </div>
            )}

            {activeTab === 'history' && (
                <HistoryView />
            )}

        </section>
    );
};
