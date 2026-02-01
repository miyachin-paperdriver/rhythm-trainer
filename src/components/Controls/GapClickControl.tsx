import React, { useState, useEffect } from 'react';

interface GapClickControlProps {
    enabled: boolean;
    playBars: number;
    muteBars: number;
    onChange: (enabled: boolean, play: number, mute: number) => void;
}

export const GapClickControl: React.FC<GapClickControlProps> = ({ enabled, playBars, muteBars, onChange }) => {
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
                    background: enabled ? 'var(--color-accent)' : 'transparent',
                    border: '1px solid ' + (enabled ? 'var(--color-accent)' : 'var(--color-border)'),
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    color: enabled ? '#fff' : 'var(--color-text)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                }}
            >
                Gap Click
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
                        <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>Gap Click Settings</h3>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--color-surface-hover)', padding: '0.8rem', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontWeight: 'bold' }}>Enable Gap Click</span>
                            <input
                                type="checkbox"
                                checked={localEnabled}
                                onChange={e => setLocalEnabled(e.target.checked)}
                                style={{ transform: 'scale(1.3)', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>Play Bars</label>
                                <input
                                    type="number"
                                    min="1" max="16"
                                    value={localPlay}
                                    onChange={e => setLocalPlay(Math.max(1, parseInt(e.target.value) || 1))}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '4px' }}>Mute Bars</label>
                                <input
                                    type="number"
                                    min="1" max="16"
                                    value={localMute}
                                    onChange={e => setLocalMute(Math.max(1, parseInt(e.target.value) || 1))}
                                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
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
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--color-primary)',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: 'var(--radius-md)',
                                    fontWeight: 'bold'
                                }}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
