import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ManualHelper: React.FC = () => {
    const { t } = useTranslation();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Simple iOS detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    return (
        <div style={{
            padding: '1rem',
            color: 'var(--color-text)',
            lineHeight: '1.6',
            maxWidth: '600px',
            margin: '0 auto',
            fontSize: '0.9rem'
        }}>
            <div style={{ marginBottom: '2rem', background: 'rgba(0, 255, 255, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(0, 255, 255, 0.2)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--color-primary)', marginTop: 0 }}>
                    {t('manual.install_app')}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <img src="/icon.png" alt="App Icon" style={{ width: '64px', height: '64px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            {t('manual.install_desc')}
                        </p>
                    </div>
                </div>

                {deferredPrompt && (
                    <button
                        onClick={handleInstallClick}
                        style={{
                            background: 'var(--color-primary)',
                            color: '#000',
                            border: 'none',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '0.5rem'
                        }}
                    >
                        {t('manual.add_to_home')}
                    </button>
                )}

                {/* Show instructions if prompt is not available (e.g. iOS or already installed/unsupported) */}
                {!deferredPrompt && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                        {isIOS ? (
                            <p style={{ margin: 0 }}>
                                {t('manual.ios_instruction')}
                            </p>
                        ) : (
                            <p style={{ margin: 0 }}>
                                {t('manual.android_instruction')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>{t('manual.setup_guide')}</h2>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.silent_switch_title')}</h3>
                <p>
                    {t('manual.silent_switch_desc')}
                </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.latency_title')}</h3>
                <p>
                    {t('manual.latency_desc')}
                </p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', listStyleType: 'circle' }}>
                    <li>{t('manual.latency_step1')}</li>
                    <li>{t('manual.latency_step2')}</li>
                    <li>{t('manual.latency_step3')}</li>
                    <li>{t('manual.latency_step4')}</li>
                </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.gain_title')}</h3>
                <p>
                    {t('manual.gain_desc')}
                </p>
                <div style={{ background: 'var(--color-surface)', padding: '0.8rem', borderRadius: '4px', marginTop: '0.5rem', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>{t('manual.auto_set_title')}</div>
                    <p style={{ margin: 0 }}>
                        {t('manual.auto_set_desc')}
                    </p>
                </div>
                <div style={{ marginTop: '0.8rem' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>{t('manual.manual_adj_title')}</div>
                    <p style={{ margin: 0 }}>
                        {t('manual.manual_adj_desc')}
                    </p>
                </div>
            </div>

            <hr style={{ borderColor: 'var(--color-border)', margin: '2rem 0', opacity: 0.5 }} />

            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>{t('manual.how_to_use')}</h2>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.training_title')}</h3>
                <ol style={{ paddingLeft: '1.2rem' }}>
                    <li>{t('manual.training_step1')}</li>
                    <li>{t('manual.training_step2')}</li>
                    <li>{t('manual.training_step3')}</li>
                    <li>{t('manual.training_step4')}</li>
                </ol>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.visualizer_title')}</h3>
                <p>
                    {t('manual.visualizer_desc')}
                </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{t('manual.history_title')}</h3>
                <p>
                    {t('manual.history_desc')}
                </p>
            </div>
        </div>
    );
};
