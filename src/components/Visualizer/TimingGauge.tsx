import React from 'react';

interface TimingGaugeProps {
    offsetMs: number;
    feedback: string | null;
}

export const TimingGauge: React.FC<TimingGaugeProps> = ({ offsetMs, feedback }) => {
    // Range: -100ms to +100ms
    const range = 100;
    const clampedOffset = Math.max(-range, Math.min(range, offsetMs));

    // Position: 0% (Early -100) to 100% (Late +100). Center is 50%.
    const percent = ((clampedOffset + range) / (range * 2)) * 100;

    const color = feedback === 'Perfect' ? 'var(--color-success)' :
        feedback === 'Good' ? 'var(--color-accent)' : 'var(--color-error)';

    return (
        <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {/* Labels */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>
                <span>Early</span>
                <span>Late</span>
            </div>

            {/* Gauge Bar */}
            <div style={{
                width: '100%',
                height: '8px',
                background: '#333',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden' // optional
            }}>
                {/* Center Marker */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: '#666',
                    transform: 'translateX(-50%)'
                }} />

                {/* Indicator Dot */}
                {feedback && (
                    <div style={{
                        position: 'absolute',
                        left: `${percent}%`,
                        top: '50%',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: color,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 8px ' + color,
                        transition: 'left 0.1s ease-out'
                    }} />
                )}
            </div>

            {/* Text Feedback (optional override provided by Metronome.tsx, but this component can be standalone) */}
            {/* But user asked for compact visual. Using this inside existing container. */}
        </div>
    );
};
