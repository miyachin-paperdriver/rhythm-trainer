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

        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Add small ripple (always)
        const smallRipple: Ripple = {
            id: idCounterRef.current++,
            x: centerX,
            y: centerY,
            size: 'small',
            timestamp: Date.now()
        };

        // Add large ripple (for fullscreen mode or always in dark mode)
        const largeRipple: Ripple = {
            id: idCounterRef.current++,
            x: centerX,
            y: centerY,
            size: 'large',
            timestamp: Date.now()
        };

        if (fullscreen) {
            setRipples(prev => [...prev.slice(-5), largeRipple]);
        } else {
            setRipples(prev => [...prev.slice(-3), smallRipple, largeRipple]);
        }

        // Add particles (dark mode or fullscreen)
        if (theme === 'dark' || fullscreen) {
            const newParticles: Particle[] = [];
            const particleCount = fullscreen ? 16 : 8;
            for (let i = 0; i < particleCount; i++) {
                newParticles.push({
                    id: idCounterRef.current++,
                    x: centerX,
                    y: centerY,
                    angle: (Math.PI * 2 * i) / particleCount + Math.random() * 0.4,
                    speed: fullscreen ? (120 + Math.random() * 80) : (60 + Math.random() * 40),
                    size: fullscreen ? (4 + Math.random() * 6) : (3 + Math.random() * 4),
                    color: colors.particles[Math.floor(Math.random() * colors.particles.length)],
                    timestamp: Date.now()
                });
            }
            setParticles(prev => [...prev.slice(-24), ...newParticles]);
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
        const cleanup = setInterval(() => {
            const now = Date.now();
            setRipples(prev => prev.filter(r => now - r.timestamp < 1500));
            setParticles(prev => prev.filter(p => now - p.timestamp < 800));
        }, 200);
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
                    const duration = isLarge ? 1.2 : 0.8;
                    const rippleColor = isLarge ? colors.rippleLarge : colors.rippleSmall;

                    return (
                        <motion.div
                            key={ripple.id}
                            initial={{ scale: 0.1, opacity: isLarge ? 0.6 : 0.8 }}
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
                                    ? `radial-gradient(circle, ${rippleColor} 0%, transparent 70%)`
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
                                initial={{ x: particle.x, y: particle.y, opacity: 1, scale: 1 }}
                                animate={{
                                    x: particle.x + dx,
                                    y: particle.y + dy,
                                    opacity: 0,
                                    scale: 0.3
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: fullscreen ? 0.7 : 0.5, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute',
                                    width: particle.size,
                                    height: particle.size,
                                    borderRadius: '50%',
                                    background: particle.color,
                                    boxShadow: theme === 'dark' ? `0 0 ${particle.size * 3}px ${particle.color}` : 'none'
                                }}
                            />
                        );
                    })}
                </AnimatePresence>
            )}
        </div>
    );
};
