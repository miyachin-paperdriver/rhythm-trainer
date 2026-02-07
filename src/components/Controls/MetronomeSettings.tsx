import React from 'react';
import { useTranslation } from 'react-i18next';
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
    outputMode: 'speaker' | 'bluetooth';
    onOutputModeChange: (mode: 'speaker' | 'bluetooth') => void;
    onResetAudio: () => void;
    onResumeAudio: () => void;
    audioContextState: AudioContextState | undefined;
    audioContextState: AudioContextState | undefined;
    isMicEnabled: boolean;
    onToggleMic: () => void;
    selectedDeviceId: string | undefined;
    onDeviceChange: (id: string) => void;
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
    onResetAudio,
    onResumeAudio,
    audioContextState,
    isMicEnabled,
    onToggleMic,
    selectedDeviceId,
    onDeviceChange
}) => {
    const { t, i18n } = useTranslation();
    // Removed local theme state

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
                paddingBottom: '0.5rem'
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

                {/* Output Mode Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>Output Mode</label>
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
                            onClick={() => onOutputModeChange('bluetooth')}
                            style={{
                                flex: 1,
                                padding: '8px',
                                border: 'none',
                                background: outputMode === 'bluetooth' ? 'var(--color-primary)' : 'transparent',
                                color: outputMode === 'bluetooth' ? '#fff' : 'var(--color-text-dim)',
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

                {/* Reset Audio (Troubleshooting) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                        onClick={onResetAudio}
                        style={{
                            padding: '8px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-dim)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        {t('settings.reset_audio')}
                    </button>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                        {t('settings.reset_audio_desc')}
                    </div>
                    {audioContextState && (
                        <div style={{ fontSize: '0.7rem', color: audioContextState === 'running' ? 'var(--color-primary)' : 'var(--color-accent)', textAlign: 'center', marginTop: '4px' }}>
                            State: {audioContextState}
                        </div>
                    )}

                    {audioContextState === 'suspended' && (
                        <button
                            onClick={onResumeAudio}
                            style={{
                                marginTop: '4px',
                                padding: '6px',
                                fontSize: '0.75rem',
                                background: 'var(--color-accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {t('settings.force_resume', 'Tap to Force Resume')}
                        </button>
                    )}
                </div>

                {/* Latency Calibration */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
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
                                {isCalibrating ? t('settings.running') : t('settings.auto_check')}
                            </button>
                        </div>
                    </div>
                    {isCalibrating && <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '4px' }}>{t('settings.calibrating_msg')}</div>}
                </div>

                {/* Microphone Settings */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                            {t('settings.mic_settings')}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', flex: 1 }}>{t('settings.mic_enabled')}</label>
                            <button
                                onClick={onToggleMic}
                                style={{
                                    background: isMicEnabled ? 'var(--color-primary)' : 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    color: isMicEnabled ? '#fff' : 'var(--color-text-dim)',
                                    borderRadius: '12px',
                                    padding: '2px 8px',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {isMicEnabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {outputMode === 'bluetooth' && isMicEnabled && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginBottom: '0.5rem' }}>
                                {t('settings.bluetooth_mic_warning')}
                            </div>
                        )}
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
                            {t('settings.auto_set')}
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 4px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
                                <span>{t('settings.gain')}</span>
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
                                <span>{t('settings.sensitivity')} (Threshold: {micThreshold.toFixed(2)})</span>
                            </div>
                            <input
                                type="range"
                                min="0.01" max="0.5" step="0.01"
                                value={micThreshold}
                                onChange={e => onMicThresholdChange(parseFloat(e.target.value))}
                                style={{ width: '100%', boxSizing: 'border-box', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                            />
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>
                                {t('settings.lower_is_more_sensitive')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Theme */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.theme')}</label>
                    <button onClick={toggleTheme} style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s'
                    }}>
                        {currentTheme === 'dark' ? t('settings.dark') : t('settings.light')}
                    </button>
                </div>

                {/* Visual Effects */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>{t('settings.visual_effects')}</label>
                    <button onClick={() => onVisualEffectsChange(!visualEffectsEnabled)} style={{
                        background: visualEffectsEnabled ? 'var(--color-primary)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        color: visualEffectsEnabled ? '#fff' : 'var(--color-text)',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        transition: 'all 0.2s'
                    }}>
                        {visualEffectsEnabled ? t('settings.effects_on') : t('settings.effects_off')}
                    </button>
                </div>

            </div>

            {/* Version */}
            <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>
                v{version}
            </div>
        </div>
    );
};
