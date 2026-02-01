import React from 'react';

export const ManualHelper: React.FC = () => {
    return (
        <div style={{
            padding: '1rem',
            color: 'var(--color-text)',
            lineHeight: '1.6',
            maxWidth: '600px',
            margin: '0 auto',
            fontSize: '0.9rem'
        }}>
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
