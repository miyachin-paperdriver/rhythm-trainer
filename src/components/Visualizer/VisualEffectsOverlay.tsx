import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Ripple {
    id: number;
    x: number;
    y: number;
    size: 'small' | 'large';
    timestamp: number;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    angle: number;
    speed: number;
    size: number;
    color: string;
    timestamp: number;
}

interface VisualEffectsOverlayProps {
    isPlaying: boolean;
    lastBeatTime: number;
    theme: 'light' | 'dark';
    effectsEnabled: boolean;
    fullscreen?: boolean; // For background-level effects
    bpm?: number; // Optional context, logic mostly relies on interval
}

export const VisualEffectsOverlay: React.FC<VisualEffectsOverlayProps> = ({
    isPlaying,
    lastBeatTime,
    theme,
    effectsEnabled,
    fullscreen = false
}) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const [particles, setParticles] = useState<Particle[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const idCounterRef = useRef(0);
    const lastBeatRef = useRef(0);
    const lastEffectTimeRef = useRef(0);

    // Colors based on theme - Light mode uses darker, more visible colors
    const colors = theme === 'dark'
        ? {
            rippleSmall: 'rgba(0, 229, 255, 0.5)',
            rippleLarge: 'rgba(0, 229, 255, 0.2)',
            particles: ['#00e5ff', '#ff0055', '#ffffff', '#00ff88']
        }
        : {
            // Light mode: use purple/pink tones for contrast against light bg
            rippleSmall: 'rgba(128, 90, 213, 0.35)',
            rippleLarge: 'rgba(128, 90, 213, 0.2)',
            particles: ['#805ad5', '#d53f8c', '#3182ce', '#38a169']
        };

    // Trigger effects on beat
    const triggerBeatEffect = useCallback(() => {
        if (!containerRef.current || !effectsEnabled) return;

        const now = Date.now();
        const delta = now - lastEffectTimeRef.current;
        lastEffectTimeRef.current = now;

        // Effective Speed Logic
        // Delta < 312.5ms (192 BPM) -> High Speed
        // Delta < 156.25ms (384 BPM) -> Very High Speed
        // Let's use 300ms roughly as the cutoff for High Speed (200 BPM)
        const isHighSpeed = delta < 300;
        const isVeryHighSpeed = delta < 150;

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const newRipples: Ripple[] = [];

        // Add small ripple (Always, unless EXTREMELY fast maybe? No, keep it as base feedback)
        newRipples.push({
            id: idCounterRef.current++,
            x: centerX,
            y: centerY,
            size: 'small',
            timestamp: now
        });

        // Add large ripple (Skip if Very High Speed to save DOM, or if not fullscreen in High Speed)
        // Fullscreen always gets large ripple unless Very High Speed
        // Normal mode skips large ripple if High Speed
        const shouldAddLargeRipple = fullscreen
            ? !isVeryHighSpeed
            : !isHighSpeed;

        if (shouldAddLargeRipple) {
            newRipples.push({
                id: idCounterRef.current++,
                x: centerX,
                y: centerY,
                size: 'large',
                timestamp: now
            });
        }

        if (fullscreen) {
            setRipples(prev => [...prev.slice(-4), ...newRipples]); // Reduced buffer
        } else {
            setRipples(prev => [...prev.slice(-3), ...newRipples]);
        }

        // Add particles (dark mode or fullscreen)
        // Reduced Counts:
        // Fullscreen: Base 8 (was 16). HighSpeed -> 4. VeryHigh -> 2.
        // Normal: Base 4 (was 8). HighSpeed -> 2. VeryHigh -> 1.
        if (theme === 'dark' || fullscreen) {
            const newParticles: Particle[] = [];

            let particleCount = fullscreen ? 8 : 4;
            if (isVeryHighSpeed) {
                particleCount = fullscreen ? 2 : 1;
            } else if (isHighSpeed) {
                particleCount = fullscreen ? 4 : 2;
            }

            for (let i = 0; i < particleCount; i++) {
                newParticles.push({
                    id: idCounterRef.current++,
                    x: centerX,
                    y: centerY,
                    angle: (Math.PI * 2 * i) / particleCount + Math.random() * 0.4,
                    speed: fullscreen ? (100 + Math.random() * 60) : (50 + Math.random() * 30),
                    size: fullscreen ? (3 + Math.random() * 5) : (2 + Math.random() * 3),
                    color: colors.particles[Math.floor(Math.random() * colors.particles.length)],
                    timestamp: now
                });
            }
            setParticles(prev => [...prev.slice(-16), ...newParticles]); // Reduced buffer
        }
    }, [effectsEnabled, theme, colors.particles, fullscreen]);

    // Watch for beat changes
    useEffect(() => {
        if (lastBeatTime > 0 && lastBeatTime !== lastBeatRef.current && isPlaying) {
            lastBeatRef.current = lastBeatTime;
            triggerBeatEffect();
        }
    }, [lastBeatTime, isPlaying, triggerBeatEffect]);

    // Cleanup old effects
    useEffect(() => {
        // Run cleanup slightly less frequently to save CPU, but ensure list doesn't grow too large
        const cleanup = setInterval(() => {
            const now = Date.now();
            setRipples(prev => prev.filter(r => now - r.timestamp < 1200)); // Slightly shorter life
            setParticles(prev => prev.filter(p => now - p.timestamp < 600)); // Slightly shorter life
        }, 500); // Check every 500ms
        return () => clearInterval(cleanup);
    }, []);

    if (!effectsEnabled || !isPlaying) {
        return null;
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: fullscreen ? 'fixed' : 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: fullscreen ? -1 : 0
            }}
        >
            {/* Ripples */}
            <AnimatePresence>
                {ripples.map(ripple => {
                    const isLarge = ripple.size === 'large';
                    const baseSize = isLarge ? (fullscreen ? 400 : 200) : 100;
                    const scaleTarget = isLarge ? 5 : 3;
                    const duration = isLarge ? 1.0 : 0.6; // Slightly faster
                    const rippleColor = isLarge ? colors.rippleLarge : colors.rippleSmall;

                    return (
                        <motion.div
                            key={ripple.id}
                            initial={{ scale: 0.1, opacity: isLarge ? 0.5 : 0.7 }} // Lower opacity
                            animate={{ scale: scaleTarget, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration, ease: 'easeOut' }}
                            style={{
                                position: 'absolute',
                                left: ripple.x,
                                top: ripple.y,
                                width: baseSize,
                                height: baseSize,
                                marginLeft: -baseSize / 2,
                                marginTop: -baseSize / 2,
                                borderRadius: '50%',
                                border: `${isLarge ? 3 : 2}px solid ${rippleColor}`,
                                background: theme === 'dark'
                                    ? `radial-gradient(circle, ${rippleColor} 0%, transparent 60%)`
                                    : 'transparent'
                            }}
                        />
                    );
                })}
            </AnimatePresence>

            {/* Particles */}
            {(theme === 'dark' || fullscreen) && (
                <AnimatePresence>
                    {particles.map(particle => {
                        const dx = Math.cos(particle.angle) * particle.speed;
                        const dy = Math.sin(particle.angle) * particle.speed;
                        return (
                            <motion.div
                                key={particle.id}
                                initial={{ x: particle.x, y: particle.y, opacity: 0.9, scale: 1 }}
                                animate={{
                                    x: particle.x + dx,
                                    y: particle.y + dy,
                                    opacity: 0,
                                    scale: 0.2
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: fullscreen ? 0.3 : 0.2, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute',
                                    width: particle.size,
                                    height: particle.size,
                                    borderRadius: '50%',
                                    background: particle.color,
                                    boxShadow: theme === 'dark' ? `0 0 ${particle.size * 2}px ${particle.color}` : 'none'
                                }}
                            />
                        );
                    })}
                </AnimatePresence>
            )}
        </div>
    );
};
