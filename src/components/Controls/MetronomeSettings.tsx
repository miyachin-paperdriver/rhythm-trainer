import React, { useState, useEffect } from 'react';
import { type Subdivision } from '../Audio/MetronomeEngine';

interface MetronomeSettingsProps {
    onSubdivisionChange: (sub: Subdivision) => void;
    onGapClickChange: (enabled: boolean, play: number, mute: number) => void;
    onThemeChange: (theme: 'light' | 'dark') => void;
    isExpanded: boolean;
    onToggleExpand: () => void;

    // Latency Calibration
    audioLatency: number;
    onAudioLatencyChange: (ms: number) => void;

    // Auto Calibration
    onRunAutoCalibration: () => void;
    isCalibrating: boolean;

    // Mic Settings
    micGain: number;
    onMicGainChange: (val: number) => void;
    micThreshold: number;
    onMicThresholdChange: (val: number) => void;
}

export const MetronomeSettings: React.FC<MetronomeSettingsProps> = ({
    onSubdivisionChange,
    onGapClickChange,
    onThemeChange,
    isExpanded,
    onToggleExpand,
    audioLatency,
    onAudioLatencyChange,
    onRunAutoCalibration,
    isCalibrating,
    micGain,
    onMicGainChange,
    micThreshold,
    onMicThresholdChange
}) => {
    const [subdivision, setSub] = useState<Subdivision>(1);
    const [gapEnabled, setGapEnabled] = useState(false);
    const [playBars, setPlayBars] = useState(4);
    const [muteBars, setMuteBars] = useState(4);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        onSubdivisionChange(subdivision);
    }, [subdivision]);

    useEffect(() => {
        onGapClickChange(gapEnabled, playBars, muteBars);
    }, [gapEnabled, playBars, muteBars]);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        onThemeChange(next);
    };

    return (
        <div className="metronome-settings" style={{
            width: '100%',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        }}>
            <div
                onClick={onToggleExpand}
                style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--color-surface-hover)'
                }}
            >
                <span style={{ fontWeight: 'bold' }}>Settings</span>
                <span>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {isExpanded && (
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Subdivision */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Subdivision</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3, 4].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSub(s as Subdivision)}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        fontSize: '1rem',
                                        background: subdivision === s ? 'var(--color-primary)' : 'rgba(128,128,128,0.1)',
                                        color: subdivision === s ? (theme === 'dark' ? '#000' : '#fff') : 'var(--color-text)',
                                        border: 'none',
                                        borderRadius: '4px'
                                    }}
                                >
                                    {s === 1 ? '♩' : s === 2 ? '♫' : s === 3 ? '3' : '16'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gap Click */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Gap Click</label>
                            <input
                                type="checkbox"
                                checked={gapEnabled}
                                onChange={e => setGapEnabled(e.target.checked)}
                                style={{ transform: 'scale(1.2)', accentColor: 'var(--color-accent)' }}
                            />
                        </div>

                        {gapEnabled && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number" value={playBars} min={1} max={16}
                                    onChange={e => setPlayBars(parseInt(e.target.value))}
                                    placeholder="Play"
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-surface)',
                                        color: 'var(--color-text)'
                                    }}
                                />
                                <input
                                    type="number" value={muteBars} min={1} max={16}
                                    onChange={e => setMuteBars(parseInt(e.target.value))}
                                    placeholder="Mute"
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-surface)',
                                        color: 'var(--color-text)'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Latency Calibration */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Latency Calibration (ms)</label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>Audio Latency</label>
                                <input
                                    type="number"
                                    value={audioLatency}
                                    onChange={e => onAudioLatencyChange(Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-surface)',
                                        color: 'var(--color-text)'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <button
                                    onClick={onRunAutoCalibration}
                                    disabled={isCalibrating}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        borderRadius: 'var(--radius-md)',
                                        border: 'none',
                                        background: isCalibrating ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                                        color: isCalibrating ? 'var(--color-text-dim)' : '#fff',
                                        fontWeight: 'bold',
                                        cursor: isCalibrating ? 'wait' : 'pointer'
                                    }}
                                >
                                    {isCalibrating ? 'Running...' : 'Auto Check'}
                                </button>
                            </div>
                        </div>
                        {isCalibrating && <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '4px' }}>Outputting click... Please wait.</div>}
                    </div>

                    {/* Theme */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>Theme</label>
                        <button onClick={toggleTheme} style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}>
                            {theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
};
