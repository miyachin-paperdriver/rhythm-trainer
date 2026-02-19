import React from 'react';
import { useTranslation } from 'react-i18next';
// DeviceSelector removed per user request
// import { DeviceSelector } from './DeviceSelector';

import { version } from '../../../package.json';

interface MetronomeSettingsProps {
    currentTheme: 'light' | 'dark'; // Controlled state
    onThemeChange: (theme: 'light' | 'dark') => void;

    // Visual Effects
    visualEffectsEnabled: boolean;
    onVisualEffectsChange: (enabled: boolean) => void;

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
    outputMode: 'speaker' | 'headphone';
    onOutputModeChange: (mode: 'speaker' | 'headphone') => void;
    mediaStream: MediaStream | null;
    micError: string | null;
    currentLevel: number;

    // Device Selection - Removed
    // selectedDeviceId: string | undefined;
    // onDeviceChange Removed
}

export const MetronomeSettings: React.FC<MetronomeSettingsProps> = ({
    currentTheme,
    onThemeChange,
    visualEffectsEnabled,
    onVisualEffectsChange,
    audioLatency,
    onAudioLatencyChange,
    onRunAutoCalibration,
    isCalibrating,
    micGain,
    onMicGainChange,
    micThreshold,
    onMicThresholdChange,
    onRunMicCalibration,
    isMicCalibrating,
    outputMode,
    onOutputModeChange,
    mediaStream,
    micError,
    currentLevel,
    // selectedDeviceId, // Removed
    // onDeviceChange
}) => {
    const { t, i18n } = useTranslation();
    const [debugMode, setDebugMode] = React.useState(false);
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [streamSettings, setStreamSettings] = React.useState<any>(null);

    React.useEffect(() => {
        if (debugMode) {
            navigator.mediaDevices.enumerateDevices().then(setDevices);
            if (mediaStream) {
                const track = mediaStream.getAudioTracks()[0];
                if (track) {
                    setStreamSettings(track.getSettings());
                } else {
                    setStreamSettings({ error: "No audio track" });
                }
            } else {
                setStreamSettings(null);
            }
        }
    }, [debugMode, mediaStream]); // Refresh when debug toggles

    const toggleTheme = () => {
        const next = currentTheme === 'dark' ? 'light' : 'dark';
        onThemeChange(next);
    };

    const toggleLanguage = () => {
        const nextLng = i18n.language === 'en' ? 'ja' : 'en';
        i18n.changeLanguage(nextLng);
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
                paddingBottom: '0.5rem',
                textAlign: 'left' // Explicitly left aligned
            }}>
                {t('settings.title')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Language (Top of settings) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.language')}</label>
                    <button onClick={toggleLanguage} style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }}>
                        {i18n.language === 'en' ? 'English' : '日本語'}
                    </button>
                </div>
            </div>

            {/* Output Mode Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', textAlign: 'left' }}>Output Mode</label>
                <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                    <button
                        onClick={() => onOutputModeChange('speaker')}
                        style={{
                            flex: 1,
                            padding: '8px',
                            border: 'none',
                            background: outputMode === 'speaker' ? 'var(--color-primary)' : 'transparent',
                            color: outputMode === 'speaker' ? '#fff' : 'var(--color-text-dim)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                        {t('speakerMode')}
                    </button>
                    <button
                        onClick={() => onOutputModeChange('headphone')}
                        style={{
                            flex: 1,
                            padding: '8px',
                            border: 'none',
                            background: outputMode === 'headphone' ? 'var(--color-primary)' : 'transparent',
                            color: outputMode === 'headphone' ? '#fff' : 'var(--color-text-dim)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                        </svg>
                        {t('headphoneMode')}
                    </button>
                </div>
            </div>

            {/* Latency Calibration */}
            <div style={{ marginTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-dim)', textAlign: 'left' }}>
                    {t('settings.latency_calibration')}
                    {outputMode === 'speaker' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '6px', opacity: 0.8 }}>
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '6px', opacity: 0.8 }}>
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                        </svg>
                    )}
                </label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.audio_latency')}</label>
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
                                color: 'var(--color-text)',
                                boxSizing: 'border-box'
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
                            {isCalibrating ? t('settings.running') : t('settings.auto_check')}
                        </button>
                    </div>
                </div>
                {isCalibrating && <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '4px' }}>{t('settings.calibrating_msg')}</div>}
            </div>

            {/* Mic Settings (Gain/Threshold) */}
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: 'var(--color-text)', textAlign: 'left' }}>
                        {t('settings.mic_settings')}
                    </h3>

                    {/* Device Selector REMOVED */}

                    {/* Gain Control */}
                    <div style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{t('settings.gain')}</label>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{micGain.toFixed(1)}</span>
                        </div>
                        <div style={{ padding: '0 4px' }}>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.1"
                                value={micGain}
                                onChange={(e) => onMicGainChange(parseFloat(e.target.value))}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Mic Input Meter */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                background: '#333',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div style={{
                                    width: `${Math.min(currentLevel * 500, 100)}%`, // Amplified for visibility
                                    height: '100%',
                                    background: currentLevel > micThreshold ? '#00cc00' : '#0088ff',
                                    transition: 'width 0.05s ease-out'
                                }} />
                                {/* Threshold Indicator */}
                                <div style={{
                                    position: 'absolute',
                                    left: `${Math.min(micThreshold * 500, 100)}%`,
                                    top: 0,
                                    bottom: 0,
                                    width: '2px',
                                    background: 'rgba(255, 0, 0, 0.7)',
                                    zIndex: 10
                                }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                                <span>Input Level</span>
                                <span>{currentLevel > 0.001 ? 'Active' : 'Silent'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Threshold Control */}
                    <div style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{t('settings.sensitivity')}</label>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{micThreshold.toFixed(2)}</span>
                        </div>
                        <div style={{ padding: '0 4px' }}>
                            <input
                                type="range"
                                min="0.01"
                                max="0.5"
                                step="0.01"
                                value={micThreshold}
                                onChange={(e) => onMicThresholdChange(parseFloat(e.target.value))}
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: '0.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                            {t('settings.lower_is_more_sensitive')}
                        </div>
                    </div>

                    {/* Calibration Button */}
                    <button
                        onClick={onRunMicCalibration}
                        disabled={isMicCalibrating}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: isMicCalibrating ? 'var(--color-surface-active)' : 'transparent',
                            border: '1px solid var(--color-primary)',
                            borderRadius: '8px',
                            color: 'var(--color-primary)',
                            fontSize: '0.9rem',
                            opacity: isMicCalibrating ? 0.7 : 1,
                            cursor: 'pointer'
                        }}
                    >
                        {isMicCalibrating ? t('settings.running') : t('settings.auto_set')}
                    </button>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textAlign: 'center', marginTop: '4px' }}>
                        {t('settings.input_device_desc')}
                    </div>
                </div>

                {/* Theme */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.theme')}</label>
                    <button onClick={toggleTheme} style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }}>
                        {currentTheme === 'dark' ? t('settings.dark') : t('settings.light')}
                    </button>
                </div>

                {/* Visual Effects */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.visual_effects')}</label>
                    <button onClick={() => onVisualEffectsChange(!visualEffectsEnabled)} style={{
                        background: visualEffectsEnabled ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: visualEffectsEnabled ? '#fff' : 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                    }}>
                        {visualEffectsEnabled ? t('settings.effects_on') : t('settings.effects_off')}
                    </button>
                </div>

                {/* DEBUG INFO */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '2rem' }}>
                    <button
                        onClick={() => setDebugMode(!debugMode)}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px dashed var(--color-text-dim)',
                            color: 'var(--color-text-dim)',
                            fontSize: '0.7rem',
                            padding: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {debugMode ? t('settings.debug_hide') : t('settings.debug_show')}
                    </button>
                    {debugMode && (
                        <div style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            marginTop: '0.5rem',
                            padding: '8px',
                            background: '#ffffff',
                            color: '#000000',
                            borderRadius: '4px',
                            border: '1px solid #999'
                        }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={{ color: '#0066cc' }}>{t('settings.debug_active_stream')}:</strong>
                                <pre style={{
                                    margin: '4px 0',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    color: '#000000',
                                    background: '#f5f5f5',
                                    padding: '4px',
                                    borderRadius: '2px'
                                }}>
                                    {streamSettings ? JSON.stringify(streamSettings, null, 2) : t('settings.debug_no_stream')}
                                </pre>
                            </div>
                            <div>
                                <strong style={{ color: '#0066cc' }}>{t('settings.debug_input_devices')}:</strong>
                                <ul style={{ paddingLeft: '1rem', margin: '4px 0', listStyle: 'disc' }}>
                                    {devices.filter(d => d.kind === 'audioinput').map(d => (
                                        <li key={d.deviceId} style={{ marginBottom: '2px' }}>
                                            <span style={{ color: '#000000' }}>{d.label || t('settings.debug_unknown')}</span> <br />
                                            <span style={{ color: '#666666', fontSize: '0.65rem' }}>{d.deviceId.slice(0, 8)}...</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div style={{ marginTop: '0.5rem' }}>
                                <strong style={{ color: '#0066cc' }}>Input Level:</strong> <br />
                                <div style={{
                                    width: '100%',
                                    height: '10px',
                                    background: '#ddd',
                                    marginTop: '4px',
                                    position: 'relative',
                                    borderRadius: '5px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${Math.min(currentLevel * 1000, 100)}%`, // Scale sensitivity for visual
                                        height: '100%',
                                        background: currentLevel > micThreshold ? '#00cc00' : '#0066cc',
                                        transition: 'width 0.1s'
                                    }} />
                                    {/* Threshold marker */}
                                    <div style={{
                                        position: 'absolute',
                                        left: `${Math.min(micThreshold * 1000, 100)}%`,
                                        top: 0,
                                        bottom: 0,
                                        width: '2px',
                                        background: 'red',
                                        zIndex: 10
                                    }} />
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '2px' }}>
                                    Level: {currentLevel.toFixed(4)} | Threshold: {micThreshold.toFixed(2)}
                                </div>
                            </div>

                            {micError && (
                                <div style={{ marginTop: '0.5rem', color: '#cc0000', fontWeight: 'bold' }}>
                                    Error: {micError}
                                </div>
                            )}


                    </div>
                    )}
            </div>

        </div>

            {/* Version */ }
    <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>
        v{version}
    </div>
        </div >
    );
};
