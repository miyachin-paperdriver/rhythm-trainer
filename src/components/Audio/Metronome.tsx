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

    // ---- Hooks ----
    const {
        bpm, isPlaying, start, stop, changeBpm,
        currentStep, lastBeatTime, isCountIn,
        setSubdivision, setGapClick,
        audioContext
    } = useMetronome();

    const { isMicReady, startAnalysis, stopAnalysis, onsets, mediaStream } = useAudioAnalysis({ audioContext });
    const { feedback, offsetMs } = useRhythmScoring({ onsets, lastBeatTime, bpm });
    const { startRecording, stopRecording, audioBlob, startTime, duration } = useAudioRecorder();

    // ---- Logic ----
    useSessionManager({
        isPlaying,
        bpm,
        patternId: selectedPatternId,
        latestOffsetMs: offsetMs,
        feedback
    });

    const toggle = () => {
        if (isPlaying) {
            stop();
            stopRecording();
            stopAnalysis(); // Always stop mic
        } else {
            start();
            // Mic logic moved to useEffect to respect count-in
        }
    };

    // Auto-record & Analysis when playing + mic ready + NOT count-in
    useEffect(() => {
        if (isPlaying && !disableRecording) {
            if (isCountIn) {
                // During count-in: Stop/Don't start mic
                // (Wait, if we stopAnalysis, isMicReady might go false. 
                // We just want to START it when count-in ends.
                // But we need to initialize it? 
                // Let's just say: Start Analysis ANYWAY to warm up? 
                // User said "Mic off" during count-in.
                // So we startAnalysis BUT don't record?
                // Or don't startAnalysis at all?

                // If we don't startAnalysis, `isMicReady` is false.
                // When count-in ends, we act.
            } else {
                // Count-in finished or not needed.
                if (!isMicReady) {
                    startAnalysis();
                }

                // Also start recording if stream ready
                if (isMicReady && mediaStream) {
                    // only start if not already recording? useAudioRecorder checks?
                    // No check in hook exposed?
                    // Assuming hook handles re-calls gracefully or we check externally?
                    // Actually `startRecording` usually initializes.
                    // Let's add a check logic or depend on hook?
                    // The hook creates a new Recorder.
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
                    />
                </div>
            )}

            {activeTab === 'history' && (
                <HistoryView />
            )}

        </section>
    );
};
