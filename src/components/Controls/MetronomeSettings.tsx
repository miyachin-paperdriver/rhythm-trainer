import React, { useState } from 'react';

interface MetronomeSettingsProps {
    onThemeChange: (theme: 'light' | 'dark') => void;

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
    onRunMicCalibration: () => void;
    isMicCalibrating: boolean;
}

export const MetronomeSettings: React.FC<MetronomeSettingsProps> = ({
    onThemeChange,
    audioLatency,
    onAudioLatencyChange,
    onRunAutoCalibration,
    isCalibrating,
    micGain,
    onMicGainChange,
    micThreshold,
    onMicThresholdChange,
    onRunMicCalibration,
    isMicCalibrating
}) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        onThemeChange(next);
    };

    return (
        <div className="metronome-settings" style={{
            width: '100%',
            height: '100%',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            overflowY: 'auto',
            padding: '1rem',
            boxSizing: 'border-box'
        }}>
            <h2 style={{
                fontSize: '1.2rem',
                marginBottom: '1.5rem',
                color: 'var(--color-primary)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '0.5rem'
            }}>
                Settings
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Latency Calibration */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>Latency Calibration (ms)</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>Audio Latency</label>
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

                {/* Microphone Settings */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>Microphone Settings</label>
                        <button
                            onClick={onRunMicCalibration}
                            disabled={isMicCalibrating}
                            style={{
                                fontSize: '0.85rem',
                                padding: '6px 16px',
                                background: isMicCalibrating ? 'gray' : 'var(--color-primary)',
                                color: '#fff',
                                fontWeight: 'bold',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isMicCalibrating ? 'wait' : 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        >
                            Auto Set
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 4px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                                <span>Gain</span>
                                <span>{micGain.toFixed(1)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1.0" max="10.0" step="0.1"
                                value={micGain}
                                onChange={e => onMicGainChange(parseFloat(e.target.value))}
                                style={{ width: '100%', boxSizing: 'border-box', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                            />
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                                <span>Sensitivity (Threshold: {micThreshold.toFixed(2)})</span>
                            </div>
                            <input
                                type="range"
                                min="0.01" max="0.5" step="0.01"
                                value={micThreshold}
                                onChange={e => onMicThresholdChange(parseFloat(e.target.value))}
                                style={{ width: '100%', boxSizing: 'border-box', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                            />
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>
                                Lower is more sensitive. Increase if too noisy.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Theme */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>Theme</label>
                    <button onClick={toggleTheme} style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s'
                    }}>
                        {theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}
                    </button>
                </div>

            </div>
        </div>
    );
};
