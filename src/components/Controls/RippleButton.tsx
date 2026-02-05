import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TapRipple {
    id: number;
    x: number;
    y: number;
}

interface RippleButtonProps {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    style?: React.CSSProperties;
    className?: string;
    disabled?: boolean;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
    effectsEnabled?: boolean;
    theme?: 'light' | 'dark';
}

let rippleCounter = 0;

export const RippleButton: React.FC<RippleButtonProps> = ({
    children,
    onClick,
    style,
    className,
    disabled,
    title,
    type = 'button',
    effectsEnabled = true,
    theme = 'light'
}) => {
    const [ripples, setRipples] = useState<TapRipple[]>([]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (effectsEnabled && !disabled) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const newRipple: TapRipple = {
                id: rippleCounter++,
                x,
                y
            };

            setRipples(prev => [...prev.slice(-2), newRipple]);

            // Cleanup after animation
            setTimeout(() => {
                setRipples(prev => prev.filter(r => r.id !== newRipple.id));
            }, 500);
        }

        onClick?.(e);
    }, [onClick, effectsEnabled, disabled]);

    // Ripple color based on theme
    const rippleColor = theme === 'dark'
        ? 'rgba(0, 229, 255, 0.4)'
        : 'rgba(128, 90, 213, 0.3)';

    return (
        <button
            onClick={handleClick}
            style={{
                position: 'relative',
                overflow: 'hidden',
                ...style
            }}
            className={className}
            disabled={disabled}
            title={title}
            type={type}
        >
            {/* Ripple Effects */}
            <AnimatePresence>
                {ripples.map(ripple => (
                    <motion.span
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 0.6 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            left: ripple.x,
                            top: ripple.y,
                            width: 40,
                            height: 40,
                            marginLeft: -20,
                            marginTop: -20,
                            borderRadius: '50%',
                            background: rippleColor,
                            pointerEvents: 'none'
                        }}
                    />
                ))}
            </AnimatePresence>
            {children}
        </button>
    );
};
