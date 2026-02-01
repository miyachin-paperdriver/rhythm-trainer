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

    // Mic Settings State
    const [micGain, setMicGain] = useState(() => Number(localStorage.getItem('micGain') || 7.0));
    const [micThreshold, setMicThreshold] = useState(() => Number(localStorage.getItem('micThreshold') || 0.1));

    // Auto Calibration State
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Debug State
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const log = (msg: string) => {
        console.log(msg);
        setDebugLog(prev => [...prev.slice(-4), msg]); // Keep last 5
    };

    // Beat History for Visualizer
    const [beatHistory, setBeatHistory] = useState<number[]>([]);

    useEffect(() => {
        localStorage.setItem('audioLatency', audioLatency.toString());
    }, [audioLatency]);

    useEffect(() => {
        localStorage.setItem('micGain', micGain.toString());
    }, [micGain]);

    useEffect(() => {
        localStorage.setItem('micThreshold', micThreshold.toString());
    }, [micThreshold]);

    // ---- Hooks ----
    const {
        bpm, isPlaying, start, stop, changeBpm,
        currentStep, lastBeatTime, isCountIn,
        setSubdivision, setGapClick,
        audioContext,
        initializeAudio
    } = useMetronome();

    const { isMicReady, startAnalysis, stopAnalysis, clearOnsets, onsets, mediaStream, analyzer } = useAudioAnalysis({
        audioContext,
        gain: micGain,
        threshold: micThreshold
    });

    // Mirror analyzer in ref for async access
    const micAnalyzerRef = React.useRef<any>(null);
    useEffect(() => {
        micAnalyzerRef.current = analyzer;
    }, [analyzer]);

    // ---- Mic Auto Calibration ----
    const [micCalibState, setMicCalibState] = useState<{
        active: boolean,
        step: 'idle' | 'noise' | 'signal' | 'calculating' | 'finished',
        noisePeak: number,
        signalPeaks: number[],
        hitCount: number,
        message: string
    }>({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });

    const micCalibRef = React.useRef<{
        timer: any,
        poll: any,
        startTime: number,
        maxPeak: number,
        lastHitTime: number
    }>({ timer: null, poll: null, startTime: 0, maxPeak: 0, lastHitTime: 0 });

    const runMicAutoCalibration = async () => {
        setIsCalibrating(true);

        // 1. Initial Start Trigger
        setMicCalibState({ active: true, step: 'noise', noisePeak: 0, signalPeaks: [], hitCount: 0, message: 'Starting... Please wait.' });

        // 2. Ensure Audio Context exists (resume/create)
        if (!audioContext) {
            console.log('[MicCalib] Init Audio Context...');
            initializeAudio();
            // Simple wait for state update propagation
            await new Promise(r => setTimeout(r, 500));
        }

        // 3. Wait for Analyzer to be populated (via Effect)
        let retries = 0;
        // Wait up to 5s for Analyzer to be ready (50 * 100ms)
        while (!micAnalyzerRef.current && retries < 50) {
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }

        if (!micAnalyzerRef.current) {
            // Fatal error
            alert("Microphone initialization failed. Please try again.");
            setMicCalibState({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });
            setIsCalibrating(false);
            return;
        }

        // 4. Start Analysis if not ready (User Gesture flow)
        if (!isMicReady) {
            console.log('[MicCalib] Starting analysis stream...');
            try {
                await startAnalysis();
                // Grace period for stream to stabilize
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                console.error(e);
                alert("Failed to access microphone. Please check permissions.");
                setMicCalibState({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });
                setIsCalibrating(false);
                return;
            }
        }

        setMicCalibState(prev => ({ ...prev, message: 'Quietly wait... Measuring noise.' }));

        // Reset Ref
        micCalibRef.current = { timer: null, poll: null, startTime: Date.now(), maxPeak: 0, lastHitTime: 0 };

        // Step 1: Measure Noise (3s)
        micCalibRef.current.poll = setInterval(() => {
            if (micAnalyzerRef.current) {
                const lvl = micAnalyzerRef.current.currentLevel;
                if (lvl > micCalibRef.current.maxPeak) micCalibRef.current.maxPeak = lvl;
            }
        }, 50);

        micCalibRef.current.timer = setTimeout(() => {
            if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
            micCalibRef.current.poll = null;
            micCalibRef.current.timer = null; // Clean timer

            const noise = micCalibRef.current.maxPeak;

            console.log('[MicCalib] Noise Floor:', noise);

            setMicCalibState({
                active: true,
                step: 'signal',
                noisePeak: noise,
                signalPeaks: [],
                hitCount: 0,
                message: 'Now HIT the pad 5 times!'
            });

            // Step 2: Measure Signal
            micCalibRef.current.maxPeak = 0; // Reset max for signal phase
            micCalibRef.current.startTime = Date.now();
            micCalibRef.current.lastHitTime = 0;
            const collectedPeaks: number[] = [];
            let hits = 0;

            // Re-start polling for signal detection
            micCalibRef.current.poll = setInterval(() => {
                if (micAnalyzerRef.current) {
                    const lvl = micAnalyzerRef.current.currentLevel;
                    const now = Date.now();

                    // Track global max for safety
                    if (lvl > micCalibRef.current.maxPeak) micCalibRef.current.maxPeak = lvl;

                    // Hit Detection Logic
                    // Threshold: 2x Noise or 0.02 (whichever is larger)
                    const hitThresh = Math.max(noise * 2.0, 0.02);

                    if (lvl > hitThresh) {
                        // Debounce: 200ms
                        if (now - micCalibRef.current.lastHitTime > 200) {
                            micCalibRef.current.lastHitTime = now;
                            hits++;
                            collectedPeaks.push(lvl);
                            console.log('Calib Hit!', hits, lvl);

                            setMicCalibState(prev => ({
                                ...prev,
                                hitCount: hits,
                                signalPeaks: [...prev.signalPeaks, lvl],
                                message: `Hit Detected! ${hits}/5`
                            }));

                            if (hits >= 5) {
                                // Done!
                                finishMicCalibration(collectedPeaks);
                            }
                        }
                    }
                }
            }, 20);

        }, 3000);
    };

    // Handle Signal Step in separate Effect to watch 'onsets'
    useEffect(() => {
        if (micCalibState.step !== 'signal') return;

        // Cleanup timer on unmount/change

        if (!micCalibRef.current.timer) {
            micCalibRef.current.timer = setTimeout(() => {
                // Timeout: Finish with whatever we have
                finishMicCalibration();
            }, 8000); // Give 8s to be safe
        }

    }, [micCalibState.step]);

    // Watch onsets during signal calibration
    useEffect(() => {
        if (micCalibState.step === 'signal' && onsets.length > 0) {
            // Unused as we use poll loop now
        }
    }, [onsets]);

    const finishMicCalibration = (peaksOverride?: number[]) => {
        if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
        if (micCalibRef.current.timer) clearTimeout(micCalibRef.current.timer);
        micCalibRef.current.poll = null;
        micCalibRef.current.timer = null;

        const noise = micCalibState.noisePeak;
        // Use collected peaks if available, otherwise just maxPeak
        let signalMax = micCalibRef.current.maxPeak;

        if (peaksOverride && peaksOverride.length > 0) {
            const sorted = peaksOverride.sort((a, b) => b - a);
            // Take top 3 average
            const top = sorted.slice(0, 3);
            signalMax = top.reduce((a, b) => a + b, 0) / top.length;
        }

        console.log('[MicCalib] Signal Measure:', signalMax);

        if (signalMax < 0.01) {
            // Failed to detect inputs
            setMicCalibState(prev => ({ ...prev, message: 'No signal detected. Try forcing Gain up.' }));
            setTimeout(() => {
                setMicCalibState({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });
                setIsCalibrating(false);
            }, 2000);
            return;
        }

        // Calculate
        // Goal: Signal ~ 0.5 (50% full scale)
        let targetGain = micGain * (0.5 / signalMax);
        targetGain = Math.max(1.0, Math.min(10.0, targetGain));

        // Threshold Calculation
        const gainRatio = targetGain / micGain;
        const projectedNoise = noise * gainRatio;
        const projectedSignal = signalMax * gainRatio; // Should be ~0.5

        // Set Threshold to 3x Noise (safer) or 15% of Signal
        let targetThreshold = Math.max(projectedNoise * 3.0, projectedSignal * 0.15);
        targetThreshold = Math.max(0.02, Math.min(0.5, targetThreshold));

        console.log(`[MicCalib] Result: Gain ${micGain.toFixed(1)}->${targetGain.toFixed(1)}, Thresh ${micThreshold.toFixed(3)}->${targetThreshold.toFixed(3)}`);

        setMicGain(parseFloat(targetGain.toFixed(1)));
        setMicThreshold(parseFloat(targetThreshold.toFixed(3)));

        setMicCalibState(prev => ({ ...prev, step: 'finished', message: `Complete! Gain: ${targetGain.toFixed(1)}, Thresh: ${targetThreshold.toFixed(2)}` }));

        setTimeout(() => {
            setMicCalibState({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });
            setIsCalibrating(false);
        }, 3000);
    };

    const cancelMicCalibration = () => {
        if (micCalibRef.current.poll) clearInterval(micCalibRef.current.poll);
        if (micCalibRef.current.timer) clearTimeout(micCalibRef.current.timer);
        setMicCalibState({ active: false, step: 'idle', noisePeak: 0, signalPeaks: [], hitCount: 0, message: '' });
        setIsCalibrating(false);
    };

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
        setDebugLog([]); // Clear logs
        log('[Init] Run Calibration');

        if (isPlaying) stop();

        if (!audioContext) {
            log('[Init] No AudioContext, Init...');
            initializeAudio();
        } else {
            log(`[Init] Ctx State: ${audioContext.state}`);
            if (audioContext.state === 'suspended') {
                try {
                    await audioContext.resume();
                    log('[Init] Resumed Context');
                } catch (e) { log(`[Err] Resume Fail: ${e}`); }
            }
        }

        setCalibrationState({ active: true, startTime: 0, samples: [], count: 0, status: 'waiting_mic' });
        setIsCalibrating(true);
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
            log(`[Sched] Now: ${now.toFixed(3)}`);

            // Robust Sequence: 4 beats
            // 3 Primers (ensure wake up) + 1 Target
            const GAP = 0.6; // 600ms = 100 BPM
            const times = [
                now + GAP * 1,
                now + GAP * 2,
                now + GAP * 3,
                now + GAP * 4  // Target
            ];

            try {
                times.forEach((t, i) => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);

                    const isTarget = i === 3;
                    osc.type = 'square'; // All Square for max energy/detection
                    osc.frequency.value = 600; // All 600Hz

                    // Gain Envelope: Linear Ramp for controlled click
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(1.0, t + 0.01); // Fast attack
                    gain.gain.setValueAtTime(1.0, t + 0.08); // Sustain
                    gain.gain.linearRampToValueAtTime(0, t + 0.1); // Release

                    osc.start(t);
                    osc.stop(t + 0.15);

                    log(`[Sched] #${i + 1} @ ${t.toFixed(3)} ${isTarget ? '(TARGET)' : ''}`);
                });

                const targetTime = times[3];
                setCalibrationState(prev => ({ ...prev, startTime: targetTime, status: 'listening' }));

                // Timeout
                if (calibrationTimeoutRef.current) clearTimeout(calibrationTimeoutRef.current);
                calibrationTimeoutRef.current = setTimeout(() => {
                    log('[Err] Timeout waiting for mic input');
                    abortCalibration();
                    alert("Calibration failed: Microphone didn't detect the final beep. Please maximize volume.");
                }, 6000);

            } catch (e: any) {
                log(`[Err] Sched Failed: ${e.message}`);
            }
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem', position: 'relative' }}>
                    {micCalibState.active && (
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: 'rgba(0,0,0,0.85)',
                            color: '#fff',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            zIndex: 110,
                            textAlign: 'center',
                            width: '80%',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid var(--color-primary)'
                        }}>
                            <div style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                                Mic Calibration
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                {micCalibState.message}
                            </div>
                            {micCalibState.step === 'finished' ? (
                                <div style={{ color: 'var(--color-success)' }}>Updated!</div>
                            ) : (
                                <button
                                    onClick={cancelMicCalibration}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: '#444',
                                        border: 'none',
                                        color: '#fff',
                                        borderRadius: '4px'
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    )}

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
                                <div style={{
                                    marginTop: '4px',
                                    fontSize: '0.65rem',
                                    color: '#faad14',
                                    textAlign: 'center',
                                    lineHeight: '1.2'
                                }}>
                                    💡 If detection fails, cup your hand around the speaker/mic to reflect sound.
                                </div>
                                <div style={{
                                    marginTop: '4px',
                                    fontSize: '0.6rem',
                                    color: '#aaa',
                                    textAlign: 'left',
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.5)',
                                    padding: '4px'
                                }}>
                                    {debugLog.map((l, i) => <div key={i}>{l}</div>)}
                                </div>
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
                        micGain={micGain}
                        onMicGainChange={setMicGain}
                        micThreshold={micThreshold}
                        onMicThresholdChange={setMicThreshold}
                        onRunMicCalibration={runMicAutoCalibration}
                        isMicCalibrating={micCalibState.active}
                    />
                </div>
            )}

            {activeTab === 'history' && (
                <HistoryView />
            )}

        </section>
    );
};
