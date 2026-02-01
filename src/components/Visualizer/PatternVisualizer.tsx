import React, { useMemo } from 'react';
import type { Pattern } from '../../utils/patterns';
import type { Subdivision } from '../Audio/MetronomeEngine';

interface PatternVisualizerProps {
    pattern: Pattern;
    currentStep: number;
    isPlaying: boolean;
    subdivision: Subdivision;
}

export const PatternVisualizer: React.FC<PatternVisualizerProps> = ({ pattern, currentStep, isPlaying, subdivision }) => {
    // const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Always show 4 bars
    // Note count per bar = 4 beats * subdivision
    const notesPerBar = 4 * subdivision;
    const totalBars = 4;
    const totalNotes = totalBars * notesPerBar;

    const displaySequence = useMemo(() => {
        const seq = [];
        for (let i = 0; i < totalNotes; i++) {
            seq.push({
                hand: pattern.sequence[i % pattern.sequence.length],
                index: i
            });
        }
        return seq;
    }, [pattern, totalNotes]);

    // Split sequence into bars
    const bars = useMemo(() => {
        const result = [];
        for (let i = 0; i < totalBars; i++) {
            result.push(displaySequence.slice(i * notesPerBar, (i + 1) * notesPerBar));
        }
        return result;
    }, [displaySequence, notesPerBar, totalBars]);

    // Active index handling (wrap around totalNotes)
    const normalizedActiveIndex = currentStep % totalNotes;

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

            <div className="visualizer-grid">
                {bars.map((bar, barIndex) => (
                    <div
                        key={barIndex}
                        className="visualizer-bar"
                    >
                        <div style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-dim)',
                            marginBottom: '0.2rem',
                            alignSelf: 'flex-start',
                            fontWeight: 'bold',
                            paddingLeft: '0.2rem'
                        }}>
                            Bar {barIndex + 1}
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${notesPerBar}, 1fr)`,
                            gap: '2px', // Tighter gap
                            width: '100%'
                        }}>
                            {bar.map((item) => {
                                // const globalIndex = barIndex * notesPerBar + (item.index % notesPerBar);
                                // Check if this item is the currently active one
                                // We use exact match on index because displaySequence is exactly totalNotes long
                                const isActive = isPlaying && normalizedActiveIndex === item.index;
                                const isRight = item.hand === 'R';

                                return (
                                    <div
                                        key={item.index}
                                        style={{
                                            // Removed aspectRatio to compress vertically
                                            height: '2rem', // Fixed compact height
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '4px',
                                            background: isActive
                                                ? (isRight ? 'var(--color-primary)' : 'var(--color-accent)')
                                                : 'var(--color-surface-hover)',
                                            color: isActive ? '#000' : (isRight ? 'var(--color-primary)' : 'var(--color-accent)'),
                                            fontWeight: 'bold',
                                            fontSize: subdivision >= 4 ? '0.8rem' : '1rem',
                                            opacity: isActive ? 1 : 0.6,
                                            transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                            boxShadow: isActive ? '0 0 4px rgba(255,255,255,0.4)' : 'none',
                                            transition: 'all 0.05s',
                                        }}
                                    >
                                        {item.hand}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
