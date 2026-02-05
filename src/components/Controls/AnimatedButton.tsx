import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    effectsEnabled?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
    children,
    variant = 'secondary',
    effectsEnabled = true,
    style,
    ...props
}) => {
    const baseStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.6em 1.2em',
        borderRadius: 'var(--radius-md)',
        fontWeight: 500,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        transition: 'background-color 0.15s, box-shadow 0.15s',
        ...style
    };

    const variants: Record<string, React.CSSProperties> = {
        primary: {
            background: 'var(--color-primary)',
            color: '#fff'
        },
        secondary: {
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)'
        },
        ghost: {
            background: 'transparent',
            color: 'var(--color-text-dim)'
        }
    };

    const combinedStyle = { ...baseStyle, ...variants[variant] };

    if (!effectsEnabled) {
        return (
            <button style={combinedStyle} {...props}>
                {children}
            </button>
        );
    }

    return (
        <motion.button
            style={combinedStyle}
            whileHover={{ scale: 1.03, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            disabled={props.disabled}
            onClick={props.onClick}
            type={props.type}
            className={props.className}
            title={props.title}
        >
            {children}
        </motion.button>
    );
};
