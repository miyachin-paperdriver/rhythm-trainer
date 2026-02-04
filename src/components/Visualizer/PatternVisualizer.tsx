import React, { useMemo } from 'react';
import type { Note, MeasureData } from '../../utils/patterns';
import type { Subdivision } from '../Audio/MetronomeEngine';

interface PatternVisualizerProps {
    pattern: {
        name: string;
        sequence: Note[];
    };
    currentStep: number;
    isPlaying: boolean;
    subdivision: Subdivision;
    expandedMeasures?: MeasureData[] | null; // For custom patterns
}

export const PatternVisualizer: React.FC<PatternVisualizerProps> = ({ pattern, currentStep, isPlaying, subdivision, expandedMeasures }) => {
    // If expandedMeasures provided (custom pattern), use per-measure subdivision
    // Otherwise fall back to preset mode with global subdivision
    const isCustomPattern = !!expandedMeasures && expandedMeasures.length > 0;

    // For presets: 4 bars * 4 beats * subdivision
    const presetNotesPerBar = 4 * subdivision;
    const presetTotalBars = 4;
    const presetTotalNotes = presetTotalBars * presetNotesPerBar;

    // Build display data
    const displayData = useMemo(() => {
        if (isCustomPattern && expandedMeasures) {
            // Custom pattern: each measure has its own subdivision
            let globalIdx = 0;
            const bars = expandedMeasures.map((measure, measureIdx) => {
                const notes: { hand: Note; index: number; subDivision: number }[] = [];
                const sub = measure.subdivision as Subdivision;
                const notesPerBeat = sub;
                // 4 beats per measure
                for (let beatIdx = 0; beatIdx < 4; beatIdx++) {
                    for (let subIdx = 0; subIdx < notesPerBeat; subIdx++) {
                        const noteIndex = beatIdx * notesPerBeat + subIdx;
                        const note = measure.notes[noteIndex] || '-';
                        notes.push({ hand: note as Note, index: globalIdx++, subDivision: sub });
                    }
                }
                return { measureIdx, notes, subdivision: sub };
            });
            return { bars, totalNotes: globalIdx };
        } else {
            // Preset mode
            const bars = [];
            for (let i = 0; i < presetTotalBars; i++) {
                const notes: { hand: Note; index: number; subDivision: number }[] = [];
                for (let j = 0; j < presetNotesPerBar; j++) {
                    const globalIdx = i * presetNotesPerBar + j;
                    notes.push({
                        hand: pattern.sequence[globalIdx % pattern.sequence.length],
                        index: globalIdx,
                        subDivision: subdivision
                    });
                }
                bars.push({ measureIdx: i, notes, subdivision });
            }
            return { bars, totalNotes: presetTotalNotes };
        }
    }, [isCustomPattern, expandedMeasures, pattern, subdivision, presetNotesPerBar, presetTotalBars, presetTotalNotes]);

    // Active index handling (wrap around totalNotes)
    const normalizedActiveIndex = currentStep % displayData.totalNotes;

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
                {displayData.bars.map((bar) => (
                    <div
                        key={bar.measureIdx}
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
                            Bar {bar.measureIdx + 1}
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${bar.notes.length}, 1fr)`,
                            gap: '2px', // Tighter gap
                            width: '100%'
                        }}>
                            {bar.notes.map((item) => {
                                const isActive = isPlaying && normalizedActiveIndex === item.index;
                                const isRest = item.hand === '-';
                                const isRight = item.hand === 'R';

                                return (
                                    <div
                                        key={item.index}
                                        style={{
                                            height: '2rem', // Fixed compact height
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: 'var(--radius-sm)',
                                            background: isActive
                                                ? (isRest ? 'var(--color-surface-hover)' : isRight ? 'var(--color-primary)' : 'var(--color-accent)')
                                                : isRest ? 'transparent' : 'var(--color-surface-hover)',
                                            color: isActive ? (isRest ? 'var(--color-text-dim)' : '#fff') : (isRest ? 'var(--color-text-dim)' : isRight ? 'var(--color-primary)' : 'var(--color-accent)'),
                                            border: isRest ? '1px dashed var(--color-border)' : 'none',
                                            fontWeight: 'bold',
                                            fontSize: item.subDivision >= 4 ? '0.8rem' : '1rem',
                                            opacity: isActive ? 1 : (isRest ? 0.3 : 0.6),
                                            transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                            boxShadow: isActive && !isRest ? '0 0 4px rgba(255,255,255,0.4)' : 'none',
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
