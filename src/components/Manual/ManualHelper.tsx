import React, { useEffect, useState } from 'react';

export const ManualHelper: React.FC = () => {
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
                    Install App
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <img src="/icon.png" alt="App Icon" style={{ width: '64px', height: '64px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            Add Rhythm Trainer to your home screen for the best experience (fullscreen, no URL bar).
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
                        Add to Home Screen
                    </button>
                )}

                {/* Show instructions if prompt is not available (e.g. iOS or already installed/unsupported) */}
                {!deferredPrompt && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                        {isIOS ? (
                            <p style={{ margin: 0 }}>
                                <strong>iOS:</strong> Tap the <span style={{ textDecoration: 'underline' }}>Share</span> button in Safari, then scroll down and select <strong>"Add to Home Screen"</strong>.
                            </p>
                        ) : (
                            <p style={{ margin: 0 }}>
                                <strong>Android/Chrome:</strong> Tap the menu icon (⋮) and select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>Initial Setup Guide</h2>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>1. Silent Switch (iOS)</h3>
                <p>
                    If you are on an iPhone interaction, please turn <strong>OFF</strong> the Silent Switch (the physical switch on the side of the device).
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', marginTop: '0.3rem' }}>
                    If the silent switch is ON, you might not hear the metronome click properly, or recording might be interrupted except when using headphones.
                </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>2. Latency Calibration</h3>
                <p>
                    Wireless earphones (Bluetooth) introduce audio delay. To get accurate scoring, perform <strong>Auto Check</strong> in the Settings tab.
                </p>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', listStyleType: 'circle' }}>
                    <li>Go to the <strong>Settings (Gear)</strong> tab.</li>
                    <li>Tap <strong>Auto Check</strong> under Audio Latency.</li>
                    <li>The app will play beeps and listen to them to measure the delay.</li>
                    <li>Turn up your volume so the mic can hear the speakers.</li>
                </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>3. Gain Adjustment</h3>
                <p>
                    Adjust the microphone sensitivity so your hits are detected, but background noise is not.
                </p>
                <div style={{ background: 'var(--color-surface)', padding: '0.8rem', borderRadius: '4px', marginTop: '0.5rem', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>Auto Set (Recommended)</div>
                    <p style={{ margin: 0 }}>
                        In the Settings tab, tap <strong>Auto Set</strong>. You will be asked to be quiet (noise measure), then hit the pad 5 times. The app will automatically set the best Gain and Threshold.
                    </p>
                </div>
                <div style={{ marginTop: '0.8rem' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>Manual Adjustment</div>
                    <p style={{ margin: 0 }}>
                        If Auto Set fails, try increasing <strong>Gain</strong> manually until the app detects your hits reliably. If it detects "ghost" hits, increase the <strong>Threshold</strong>.
                    </p>
                </div>
            </div>

            <hr style={{ borderColor: 'var(--color-border)', margin: '2rem 0', opacity: 0.5 }} />

            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>How to Use</h2>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Training</h3>
                <ol style={{ paddingLeft: '1.2rem' }}>
                    <li>Select a pattern (e.g., Single Stroke, Paradiddle).</li>
                    <li>Set your BPM and Subdivision.</li>
                    <li>Press Play.</li>
                    <li>Play along! Your accuracy is shown in real-time.</li>
                </ol>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Visualizer</h3>
                <p>
                    The circle represents the beat.
                    <br />
                    <span style={{ color: 'var(--color-success)' }}>Green</span> = Perfect Timing
                    <br />
                    <span style={{ color: '#fa8c16' }}>Orange</span> = Early/Late
                    <br />
                    <span style={{ color: '#ff4d4f' }}>Red</span> = Too Far Off
                </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>History</h3>
                <p>
                    Check your past session stats in the History tab. You can analyze your timing stability and tendencies (rushing/dragging).
                </p>
            </div>
        </div>
    );
};
