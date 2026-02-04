import React, { useMemo } from 'react';
import type { RecordedHit } from '../../hooks/useSessionManager';

interface TimingDeviationGraphProps {
    hits: RecordedHit[];
    patternLength: number;
}

export const TimingDeviationGraph: React.FC<TimingDeviationGraphProps> = ({ hits, patternLength }) => {
    // Canvas dimensions
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };

    // Y-Axis Range (ms)
    // Dynamic range or fixed? Let's fix it to +/- 100ms for consistency suitable for visual feedback
    const maxDeviation = 100;

    // Process data
    const { points, trendLine } = useMemo(() => {
        // Points: Map each hit to (x, y) coordinates
        // X: (hitIndex % patternLength) -> Step in the pattern
        // but wait, session might have missed hits or extra hits.
        // `hit.index` is the raw index of the detected onset since start.
        // We assume `hit.index` aligns with the metronome clicks 1:1 if the user plays continuously.
        // If user misses, the index still increments? No, `onsetIndex` comes from `useRhythmScoring`.
        // In `useRhythmScoring`, `onsetIndex` is just `onsets.length - 1`.
        // This is purely sequential detected hits.

        // ISSUE: If user misses a beat, the next hit will have index N+1 (if using onsets count).
        // Actually `useRhythmScoring` logic: 
        // `processedOnsetsRef` tracks processed count.
        // `onsetIndex` is just the index in the `onsets` array.
        // It does NOT correspond to "Beat #105". It corresponds to "Hit #105".
        // IF the user misses, "Hit #105" might actually be intended for "Beat #106".

        // HOWEVER, for simple visual feedback, assume 1:1 mapping is "close enough" 
        // OR rely on `hit.index` modulo `patternLength`.
        // If the user plays consistently, `hit.index` % `patternLength` naturally falls into steps.
        // Let's use `hit.index % patternLength` for the X-Axis step.

        const graphPoints = hits.map(hit => {
            const step = hit.index % patternLength;
            // X coordinate: distribute steps evenly across width
            const x = padding.left + (step / (patternLength - 1 || 1)) * (width - padding.left - padding.right);

            // Y coordinate: map offset (-max to +max) to height
            // -max -> bottom, +max -> top? No, usually + is UP.
            // But usually graphs have + Y going UP.
            // Let's say Top of graph is +100ms (Late), Bottom is -100ms (Early).
            // Actually, maybe + is Late (Up) and - is Early (Down). 
            // Standard chart: Y grows up.
            // Deviation +30 (Late) -> Above center.
            // Deviation -30 (Early) -> Below center.
            const clampedOffset = Math.max(-maxDeviation, Math.min(maxDeviation, hit.offset));
            // Map -100..100 to height-padding..padding
            // y = 0 (center) -> height/2
            const availableHeight = height - padding.top - padding.bottom;
            const centerY = padding.top + availableHeight / 2;

            // Invert scale because SVG Y grows Downward
            // Late (+) -> Up (Smaller Y)
            const y = centerY - (clampedOffset / maxDeviation) * (availableHeight / 2);

            return { x, y, hit, step };
        });

        // Trend Line: Calculate Average Deviation per Step
        const stepStats = new Map<number, { sum: number, count: number }>();
        graphPoints.forEach(p => {
            const current = stepStats.get(p.step) || { sum: 0, count: 0 };
            current.sum += p.hit.offset;
            current.count += 1;
            stepStats.set(p.step, current);
        });

        const trendPoints: { x: number, y: number }[] = [];
        for (let i = 0; i < patternLength; i++) {
            const stats = stepStats.get(i);
            if (stats && stats.count > 0) {
                const avg = stats.sum / stats.count;
                const clampedAvg = Math.max(-maxDeviation, Math.min(maxDeviation, avg));
                const availableHeight = height - padding.top - padding.bottom;
                const centerY = padding.top + availableHeight / 2;
                const x = padding.left + (i / (patternLength - 1 || 1)) * (width - padding.left - padding.right);
                const y = centerY - (clampedAvg / maxDeviation) * (availableHeight / 2);
                trendPoints.push({ x, y });
            }
        }

        return { points: graphPoints, trendLine: trendPoints };
    }, [hits, patternLength]);


    return (
        <div style={{ width: '100%', overflowX: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', padding: '10px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: 'var(--color-text-dim)', textAlign: 'center' }}>
                TIMING DEVIATION TREND (FOLDED)
            </h3>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: '200px' }}>
                <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#fa8c16" /> {/* +100ms Late (Orange) - Top (Y=0) */}
                        <stop offset="40%" stopColor="#52c41a" /> {/* Near Perfect (Green) */}
                        <stop offset="60%" stopColor="#52c41a" /> {/* Near Perfect (Green) */}
                        <stop offset="100%" stopColor="#fa8c16" /> {/* -100ms Early (Orange) - Bottom (Y=200) */}
                    </linearGradient>
                </defs>

                {/* Background Grid */}
                {/* Center Line (0ms) */}
                <line
                    x1={padding.left} y1={height / 2}
                    x2={width - padding.right} y2={height / 2}
                    stroke="var(--color-border)" strokeWidth="2"
                />

                {/* Axes Labels */}
                <text x={10} y={height / 2 + 4} fontSize="10" fill="var(--color-text-dim)">0ms</text>
                <text x={10} y={padding.top} fontSize="10" fill="var(--color-text-dim)">+{maxDeviation}ms</text>
                <text x={10} y={height - padding.bottom + 8} fontSize="10" fill="var(--color-text-dim)">-{maxDeviation}ms</text>

                {/* Vertical Step Lines */}
                {Array.from({ length: patternLength }).map((_, i) => {
                    const x = padding.left + (i / (patternLength - 1 || 1)) * (width - padding.left - padding.right);
                    return (
                        <line
                            key={`grid-${i}`}
                            x1={x} y1={padding.top}
                            x2={x} y2={height - padding.bottom}
                            stroke="var(--color-surface-hover)" strokeDasharray="4 4"
                        />
                    );
                })}


                {/* Points */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x} cy={p.y} r="3"
                        fill={p.hit.hand === 'R' ? 'var(--color-primary)' : 'var(--color-accent)'}
                        opacity="0.4"
                    />
                ))}

                {/* Trend Line */}
                {trendLine.length > 1 && (
                    <polyline
                        points={trendLine.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="url(#trendGradient)"
                        strokeWidth="3"
                        strokeOpacity="0.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Step Labels */}
                {Array.from({ length: patternLength }).map((_, i) => {
                    const x = padding.left + (i / (patternLength - 1 || 1)) * (width - padding.left - padding.right);
                    return (
                        <text
                            key={`label-${i}`}
                            x={x} y={height - 5}
                            fontSize="10" fill="var(--color-text-dim)"
                            textAnchor="middle"
                        >
                            {i + 1}
                        </text>
                    );
                })}

            </svg>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '5px', fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }}></div>
                    Left
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }}></div>
                    Right
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 20, height: 3, background: 'linear-gradient(to right, #fa8c16, #52c41a, #fa8c16)' }}></div>
                    Trend
                </div>
            </div>
        </div>
    );
};
