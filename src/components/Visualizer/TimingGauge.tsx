import React from 'react';
import { TimingIndicator } from './TimingIndicator';

interface TimingGaugeProps {
    offsetMs: number;
    feedback: string | null;
    bpm: number;
    isPlaying: boolean;
    audioLatency: number;
    theme: 'light' | 'dark';
    isActive: boolean;
}

export const TimingGauge: React.FC<TimingGaugeProps> = ({
    offsetMs,
    feedback,
    bpm,
    isPlaying,
    audioLatency,
    theme,
    isActive
}) => {
    // Range: -100ms to +100ms
    const range = 100;
    const clampedOffset = Math.max(-range, Math.min(range, offsetMs));

    // Position: 0% (Early -100) to 100% (Late +100). Center is 50%.
    const percent = ((clampedOffset + range) / (range * 2)) * 100;

    // Improved Color Logic:
    // Simply map 0ms -> 100ms to Hue 120 -> 0 using non-linear curve for better "Good" feel
    const absOffset = Math.abs(offsetMs);
    let hue = 0;
    if (absOffset < 15) hue = 120; // Perfect Green zone
    else if (absOffset > 100) hue = 0; // Red zone
    else {
        // Linear drop from 15ms to 100ms
        // 15ms = 120, 100ms = 0
        hue = 120 - ((absOffset - 15) / (85)) * 120;
    }
    const color = `hsl(${hue}, 90%, 50%)`;

    const isJustTiming = feedback && absOffset <= 10;

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {/* Gauge Bar & Container */}
            <div style={{
                width: '100%',
                // Increased height again for combined view
                height: '48px',
                background: theme === 'dark' ? '#222' : '#e0e0e0',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                overflow: 'visible', // Allow effects to pop out
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                border: '1px solid var(--color-border)'
            }}>
                {/* Bar Mask for internal content */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                    {/* Background Animation (Timing Indicator) */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.8, pointerEvents: 'none' }}>
                        <TimingIndicator
                            bpm={bpm}
                            isPlaying={isPlaying}
                            audioLatency={audioLatency}
                            theme={theme}
                            isActive={isActive}
                        />
                    </div>

                    {/* Internal Labels - Adaptive Color */}
                    <span style={{
                        position: 'absolute',
                        left: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', // Darker text for Light Mode
                        pointerEvents: 'none',
                        zIndex: 1
                    }}>EARLY</span>

                    <span style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', // Darker text for Light Mode
                        pointerEvents: 'none',
                        zIndex: 1
                    }}>LATE</span>

                    {/* Center Marker */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        background: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', // Adaptive
                        transform: 'translateX(-50%)',
                        zIndex: 2
                    }} />

                    {/* Range Markers (Optional: +/- 50ms) */}
                    <div style={{ position: 'absolute', left: '25%', top: '20%', bottom: '20%', width: '1px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                    <div style={{ position: 'absolute', left: '75%', top: '20%', bottom: '20%', width: '1px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                </div>



                {/* Indicator Dot */}
                {feedback && (
                    <div style={{
                        position: 'absolute',
                        left: `${percent}%`,
                        top: '50%',
                        width: isJustTiming ? '36px' : '24px', // Valid expansion for just timing
                        height: isJustTiming ? '36px' : '24px',
                        borderRadius: '50%',
                        background: color,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: isJustTiming
                            ? `0 0 25px ${color}, 0 0 10px #fff`
                            : `0 0 15px ${color}, 0 0 5px ${theme === 'dark' ? '#fff' : '#000'}`,
                        zIndex: 10,
                        transition: 'left 0.1s cubic-bezier(0.1, 0.7, 1.0, 0.1), width 0.1s, height 0.1s',
                        border: '2px solid #fff'
                    }} />
                )}

                {/* Just Timing Ripple Effect */}
                {isJustTiming && (
                    <div
                        key={Date.now()} // Force re-render for animation reset
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: `3px solid ${color}`,
                            zIndex: 9,
                            animation: 'ripple 0.5s ease-out forwards',
                            pointerEvents: 'none'
                        }}
                    />
                )}

                {/* Large Offset Text Overlay */}
                {feedback && (
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: isJustTiming ? '1.4rem' : '1rem', // Pop effect
                        fontWeight: '900',
                        color: theme === 'dark' ? '#fff' : '#000', // Adaptive text
                        textShadow: isJustTiming
                            ? '0 0 10px rgba(255,255,255,0.8), 0 0 20px ' + color
                            : (theme === 'dark' ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)'),
                        zIndex: 20,
                        pointerEvents: 'none',
                        transition: 'all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        {isJustTiming ? 'JUST!' : Math.round(Math.abs(offsetMs)) + 'ms'}
                    </div>
                )}

                {/* Add Styles for Ripple */}
                <style>{`
                    @keyframes ripple {
                        0% { width: 20px; height: 20px; opacity: 1; border-width: 4px; }
                        100% { width: 100px; height: 100px; opacity: 0; border-width: 0px; }
                    }
                `}</style>

            </div>
        </div>
    );
};
