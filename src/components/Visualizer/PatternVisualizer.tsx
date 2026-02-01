import React, { useMemo, useRef } from 'react';
import type { Pattern } from '../../utils/patterns';

interface PatternVisualizerProps {
    pattern: Pattern;
    currentStep: number;
    isPlaying: boolean;
}

export const PatternVisualizer: React.FC<PatternVisualizerProps> = ({ pattern, currentStep, isPlaying }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Expand pattern to 4 bars? Or just show 1 bar repeated?
    // Assuming 16th notes usually fill a bar? Or pattern sequence length.
    // Let's just repeat the sequence to fill "enough" space or 16/32 steps.
    // For now, let's show 2 iterations of the pattern or fixed 16 slots.

    // User asked for "Always 4 bars".
    // 4 bars of 4/4 = 16 beats. 
    // If subdivision is 16th, that's 64 steps. That's too long for mobile width.
    // Maybe they meant "4 beats" or "1 full measure"? 
    // "Paradiddle pattern is always 4 bars" -> likely 4 repetitions of the rudimentary pattern?
    // Let's create a display sequence that repeats the pattern until length 16 (for 16th notes visually).

    const displaySequence = useMemo(() => {
        const seq = [];
        // Fill 16 slots (standard 1 bar of 16th notes or 4 bars of quarters)
        // Adjust based on pattern length.
        const targetDescLength = 16;
        let i = 0;
        while (seq.length < targetDescLength) {
            seq.push({ hand: pattern.sequence[i % pattern.sequence.length], index: seq.length });
            i++;
        }
        return seq;
    }, [pattern]);

    // Active index within the display sequence
    const activeIndex = currentStep % displaySequence.length;

    return (
        <div style={{
            background: 'var(--color-surface)',
            padding: '1rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center'
        }}>
            <h2 style={{
                margin: '0 0 1rem 0',
                color: 'var(--color-primary)',
                fontSize: '1.2rem'
            }}>
                {pattern.name}
            </h2>

            <div
                ref={scrollContainerRef}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)', // 2 rows of 8
                    gap: '4px',
                    justifyContent: 'center',
                    maxWidth: '100%'
                }}
            >
                {displaySequence.map((item, idx) => {
                    const isActive = isPlaying && idx === activeIndex;
                    const isRight = item.hand === 'R';

                    return (
                        <div
                            key={idx}
                            style={{
                                aspectRatio: '1/1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                background: isActive
                                    ? (isRight ? 'var(--color-primary)' : 'var(--color-accent)')
                                    : 'var(--color-surface-hover)',
                                color: isActive ? '#000' : (isRight ? 'var(--color-primary)' : 'var(--color-accent)'),
                                fontWeight: 'bold',
                                fontSize: '1.2rem',
                                opacity: isActive ? 1 : 0.5,
                                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                                transition: 'all 0.1s',
                                border: isActive ? '2px solid #fff' : '1px solid transparent'
                            }}
                        >
                            {item.hand}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
