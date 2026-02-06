import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface GapClickControlProps {
    enabled: boolean;
    playBars: number;
    muteBars: number;
    onChange: (enabled: boolean, play: number, mute: number) => void;
}

export const GapClickControl: React.FC<GapClickControlProps> = ({ enabled, playBars, muteBars, onChange }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    // Local state for editing
    const [localEnabled, setLocalEnabled] = useState(enabled);
    const [localPlay, setLocalPlay] = useState(playBars);
    const [localMute, setLocalMute] = useState(muteBars);

    // Sync from props when opening
    useEffect(() => {
        if (isOpen) {
            setLocalEnabled(enabled);
            setLocalPlay(playBars);
            setLocalMute(muteBars);
        }
    }, [isOpen, enabled, playBars, muteBars]);

    const handleSave = () => {
        onChange(localEnabled, localPlay, localMute);
        setIsOpen(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    background: 'transparent',
                    border: '1px solid ' + (enabled ? 'var(--color-accent)' : 'var(--color-border)'),
                    borderRadius: 'var(--radius-md)',
                    padding: '6px',
                    cursor: 'pointer',
                    color: enabled ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    minWidth: '40px'
                }}
                title={t('gap_click.title')}
            >
                <div style={{ position: 'relative', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Speaker Icon */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '-2px' }}>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    </svg>
                    {/* Intermittent Indication (Bars and Dots) */}
                    <div style={{ display: 'flex', gap: '2px', marginLeft: '14px', alignItems: 'center' }}>
                        <div style={{ width: '3px', height: '12px', background: 'currentColor', borderRadius: '1px' }}></div>
                        <div style={{ width: '3px', height: '3px', background: 'currentColor', borderRadius: '50%', opacity: 0.4 }}></div>
                        <div style={{ width: '3px', height: '3px', background: 'currentColor', borderRadius: '50%', opacity: 0.4 }}></div>
                        <div style={{ width: '3px', height: '12px', background: 'currentColor', borderRadius: '1px' }}></div>
                    </div>
                    {!enabled && (
                        <line x1="2" y1="2" x2="28" y2="28" stroke="var(--color-text-dim)" strokeWidth="2" style={{ position: 'absolute', transform: 'rotate(-45deg)', opacity: 0.6 }} />
                    )}
                </div>
            </button>

            {isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(2px)'
                }}>
                    <div style={{
                        background: 'var(--color-surface)',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        width: '300px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                    }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>{t('gap_click.title')}</h3>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--color-surface-hover)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontWeight: 'bold' }}>{t('gap_click.enable')}</span>
                            <input
                                type="checkbox"
                                checked={localEnabled}
                                onChange={e => setLocalEnabled(e.target.checked)}
                                style={{ transform: 'scale(1.3)', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>{t('gap_click.play_bars')}</label>
                                <input
                                    type="number"
                                    min="1" max="16"
                                    value={localPlay}
                                    onChange={e => setLocalPlay(Math.max(1, parseInt(e.target.value) || 1))}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>{t('gap_click.mute_bars')}</label>
                                <input
                                    type="number"
                                    min="1" max="16"
                                    value={localMute}
                                    onChange={e => setLocalMute(Math.max(1, parseInt(e.target.value) || 1))}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('gap_click.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--color-primary)',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('gap_click.apply')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
