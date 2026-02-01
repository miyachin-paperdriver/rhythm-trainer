import React from 'react';

interface BPMControlProps {
    bpm: number;
    setBpm: (bpm: number) => void;
    disabled?: boolean;
}

export const BPMControl: React.FC<BPMControlProps> = ({ bpm, setBpm, disabled }) => {
    const adjust = (amount: number) => {
        setBpm(bpm + amount);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            setBpm(val);
        }
    };

    return (
        <div className="bpm-control" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
            padding: '1.5rem',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #333'
        }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Tempo (BPM)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => adjust(-10)} disabled={disabled}>-10</button>
                <button onClick={() => adjust(-1)} disabled={disabled}>-</button>

                <input
                    type="number"
                    value={bpm}
                    onChange={handleChange}
                    disabled={disabled}
                    style={{
                        fontSize: '2.5rem',
                        width: '120px',
                        textAlign: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontWeight: 'bold'
                    }}
                />

                <button onClick={() => adjust(1)} disabled={disabled}>+</button>
                <button onClick={() => adjust(10)} disabled={disabled}>+10</button>
            </div>

            <input
                type="range"
                min="30"
                max="300"
                value={bpm}
                onChange={handleChange}
                disabled={disabled}
                style={{ width: '100%', maxWidth: '300px', accentColor: 'var(--color-primary)' }}
            />
        </div>
    );
};
