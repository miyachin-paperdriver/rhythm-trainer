import React, { useEffect, useState } from 'react';

export interface ToastProps {
    message: string;
    type?: 'warning' | 'info' | 'error' | 'success';
    visible: boolean;
    onDismiss: () => void;
    autoDismiss?: boolean;
    autoDismissMs?: number;
}

export const Toast: React.FC<ToastProps> = ({
    message,
    type = 'warning',
    visible,
    onDismiss,
    autoDismiss = false,
    autoDismissMs = 5000
}) => {
    const [isVisible, setIsVisible] = useState(visible);

    useEffect(() => {
        setIsVisible(visible);
    }, [visible]);

    useEffect(() => {
        if (autoDismiss && visible) {
            const timer = setTimeout(() => {
                onDismiss();
            }, autoDismissMs);
            return () => clearTimeout(timer);
        }
    }, [autoDismiss, autoDismissMs, visible, onDismiss]);

    if (!isVisible) return null;

    const getColors = () => {
        switch (type) {
            case 'warning':
                return {
                    bg: 'linear-gradient(135deg, rgba(255, 152, 0, 0.95), rgba(255, 193, 7, 0.95))',
                    border: 'rgba(255, 152, 0, 0.8)',
                    icon: '⚠️'
                };
            case 'error':
                return {
                    bg: 'linear-gradient(135deg, rgba(244, 67, 54, 0.95), rgba(229, 57, 53, 0.95))',
                    border: 'rgba(244, 67, 54, 0.8)',
                    icon: '❌'
                };
            case 'success':
                return {
                    bg: 'linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(102, 187, 106, 0.95))',
                    border: 'rgba(76, 175, 80, 0.8)',
                    icon: '✅'
                };
            case 'info':
            default:
                return {
                    bg: 'linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(66, 165, 245, 0.95))',
                    border: 'rgba(33, 150, 243, 0.8)',
                    icon: 'ℹ️'
                };
        }
    };

    const colors = getColors();

    return (
        <div
            style={{
                position: 'fixed',
                top: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 2000,
                maxWidth: '90%',
                width: '360px',
                animation: 'slideDown 0.3s ease-out'
            }}
        >
            <style>
                {`
                    @keyframes slideDown {
                        from {
                            transform: translateX(-50%) translateY(-100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(-50%) translateY(0);
                            opacity: 1;
                        }
                    }
                `}
            </style>
            <div
                style={{
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                }}
            >
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {colors.icon}
                </span>
                <div style={{ flex: 1 }}>
                    <p style={{
                        margin: 0,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        lineHeight: 1.4,
                        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}>
                        {message}
                    </p>
                </div>
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                    }}
                    aria-label="Close"
                >
                    ×
                </button>
            </div>
        </div>
    );
};
