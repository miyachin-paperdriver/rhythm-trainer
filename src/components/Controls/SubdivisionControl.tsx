import React, { useState, useRef, useEffect } from 'react';
import { type Subdivision } from '../Audio/MetronomeEngine';

interface SubdivisionControlProps {
    subdivision: Subdivision;
    onChange: (sub: Subdivision) => void;
    theme?: 'light' | 'dark';
    disabled?: boolean;
}

import noteQuarter from '../../assets/note_quarter.png';
import noteEighth from '../../assets/note_eighth.png';
import noteTriplet from '../../assets/note_triplet.png';
import noteSixteenth from '../../assets/note_sixteenth.png';

const NoteIcon: React.FC<{ type: Subdivision; size?: number; color?: string }> = ({ type, size = 40, color = 'currentColor' }) => {
    let src = '';
    switch (type) {
        case 1: src = noteQuarter; break;
        case 2: src = noteEighth; break;
        case 3: src = noteTriplet; break;
        case 4: src = noteSixteenth; break;
    }

    if (!src) return null;

    // Apply color filter if needed. 
    // Since images are black, to make them white (for active state or dark mode), we need 'invert(1)'.
    // If color is 'currentColor', we can't easily map it to CSS filter without more complex logic.
    // However, usually textual color is #000 or #fff.
    // Simple heuristic: if color is white/#fff, invert. If black/#000, no filter.
    // Or better: Use mask-image if possible, but img tag is simpler.
    // Let's rely on standard img for now. If user wants them colored, we might need a workaround.
    // But for "Active" vs "Inactive":
    // Active = Primary Color usually?
    // Let's stick to simple IMG first. If the user provided BLACK icons:

    // Check if color is likely light (active/dark mode text) or dark.
    // Actually, simple CSS filter: 
    // If we want "Primary Color" (blue), it's hard with black PNGs.
    // Let's Try: use mask-image for solid color control.

    return (
        <div
            style={{
                width: size,
                height: size,
                backgroundColor: color,
                maskImage: `url(${src})`,
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: `url(${src})`,
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center'
            }}
        />
    );
};

export const SubdivisionControl: React.FC<SubdivisionControlProps> = ({ subdivision, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options: Subdivision[] = [1, 2, 3, 4];

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', opacity: disabled ? 0.5 : 1 }}>
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                    minWidth: '40px'
                }}
                title={disabled ? 'カスタムパターンはサブディビジョンが固定されています' : 'Subdivision'}
            >
                <NoteIcon type={subdivision} size={30} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 200,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    minWidth: '120px'
                }}>
                    <div style={{ fontSize: '0.85rem', padding: '4px 8px', color: 'var(--color-text-dim)', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                        SUBDIVISION
                    </div>
                    <div style={{ display: 'flex', gap: '4px', padding: '4px' }}>
                        {options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '6px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    background: subdivision === opt ? 'var(--color-primary)' : 'transparent',
                                    color: subdivision === opt ? '#fff' : 'var(--color-text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <NoteIcon type={opt} size={30} color={subdivision === opt ? '#fff' : 'currentColor'} />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
