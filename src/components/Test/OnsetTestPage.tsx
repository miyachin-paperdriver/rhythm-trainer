import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioAnalyzer } from '../Audio/AudioAnalyzer';

interface TestResult {
    scheduledTime: number;
    detectedTime: number | null;
    error: number | null;
}


export const OnsetTestPage = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);

    const [stats, setStats] = useState<{ avgError: number; jitter: number; missed: number; double: number } | null>(null);

    // New controls
    const [gain, setGain] = useState(5.0);
    const [threshold, setThreshold] = useState(0.05); // Lower default
    const [currentLevel, setCurrentLevel] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AudioAnalyzer | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const meterFrameRef = useRef<number | null>(null);

    // Test parameters
    const ITERATIONS = 20;
    const INTERVAL = 0.5; // 500ms between clicks

    const scheduledTimesRef = useRef<number[]>([]);
    const detectedTimesRef = useRef<number[]>([]);

    useEffect(() => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;

        // Create a destination node that acts as a stream
        const dest = ctx.createMediaStreamDestination();
        destinationRef.current = dest;

        // Initialize Analyzer with the stream from the destination
        const analyzer = new AudioAnalyzer(ctx);
        analyzerRef.current = analyzer;

        // Synch initial values
        analyzer.setGain(gain);
        analyzer.setThreshold(threshold);

        // Start level metering loop
        const updateMeter = () => {
            if (analyzerRef.current) {
                // Smooth decay for visualization
                setCurrentLevel(prev => Math.max(analyzerRef.current!.currentLevel, prev * 0.9));
            }
            meterFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();

        return () => {
            analyzer.stop();
            ctx.close();
            if (meterFrameRef.current) cancelAnimationFrame(meterFrameRef.current);
        };
    }, []);

    // Update analyzer when controls change
    useEffect(() => {
        if (analyzerRef.current) {
            analyzerRef.current.setGain(gain);
        }
    }, [gain]);

    useEffect(() => {
        if (analyzerRef.current) {
            analyzerRef.current.setThreshold(threshold);
        }
    }, [threshold]);

    const playClick = (time: number) => {
        if (!audioContextRef.current || !destinationRef.current) return;

        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(destinationRef.current); // Connect to the stream destination
        // gain.connect(ctx.destination); // Optional: Monitor locally? Maybe annoying if gain is high. 
        // Let's keep it audible but maybe lower volume for monitoring?
        // Actually, the user wants to test mic detection, so this test page is a "Simulation" using Loopback.
        // For real microphone testing, we probably need a "Live Mic Mode" switch?
        // The current implementation is "Simulation Mode" (Oscillator -> Stream -> Analyzer).
        // Since the user needs to test MIC GAIN, they likely want to see the meter react to their voice.

        // Wait, the previous useEffect creates 'analyzer' but doesn't start it until 'startTest' is clicked?
        // Ah, startTest calls `start(destinationRef.current.stream)`.

        // We probably want a "Monitor Mic" button to test real world levels.

        gainNode.connect(ctx.destination);

        osc.frequency.value = 1000;
        osc.type = 'square';

        // Short click
        osc.start(time);
        osc.stop(time + 0.05);

        // Envelope
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.5, time + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    };

    // ... startTest, finishTest, processResults (mostly unchanged) ...
    // I need to include them to keep the file valid since I'm blocking replacing.

    // ... wait, I should just use replace_file_content properly.
    // I can't selectively keep parts with this tool unless I use multi_replace or match exact blocks.
    // Since I'm essentially rewriting the top half and the render logic, let's paste the logic back in.

    const startTest = useCallback(async () => {
        if (!audioContextRef.current || !analyzerRef.current || !destinationRef.current) return;

        setIsRunning(true);
        setResults([]);
        setStats(null);
        scheduledTimesRef.current = [];
        detectedTimesRef.current = [];

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        // Start Analyzer
        analyzerRef.current.onOnset = (time) => {
            console.log('Detected onset at', time);
            detectedTimesRef.current.push(time);
        };

        // Note: For this automated test, we use the internal stream.
        await analyzerRef.current.start(destinationRef.current.stream);

        // Schedule clicks
        const startTime = ctx.currentTime + 1.0;

        for (let i = 0; i < ITERATIONS; i++) {
            const time = startTime + i * INTERVAL;
            scheduledTimesRef.current.push(time);
            playClick(time);
        }

        setTimeout(() => {
            finishTest();
        }, (ITERATIONS * INTERVAL + 2) * 1000);

    }, []);

    const finishTest = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.stop();
        setIsRunning(false);
        processResults();
    };

    const processResults = () => {
        const scheduled = scheduledTimesRef.current;
        const detected = detectedTimesRef.current;

        const finalResults: TestResult[] = [];
        let totalError = 0;
        let validDetections = 0;
        let missed = 0;
        let double = 0;

        scheduled.forEach((sTime) => {
            const matches = detected.filter(d => Math.abs(d - sTime) < 0.1);

            if (matches.length === 0) {
                finalResults.push({ scheduledTime: sTime, detectedTime: null, error: null });
                missed++;
            } else {
                const closest = matches.reduce((prev, curr) =>
                    Math.abs(curr - sTime) < Math.abs(prev - sTime) ? curr : prev
                );

                const error = closest - sTime;
                finalResults.push({ scheduledTime: sTime, detectedTime: closest, error });

                totalError += error;
                validDetections++;

                if (matches.length > 1) double++;
            }
        });

        const avgError = validDetections > 0 ? (totalError / validDetections) * 1000 : 0; // ms

        let variance = 0;
        if (validDetections > 0) {
            const mean = totalError / validDetections;
            variance = finalResults
                .filter(r => r.error !== null)
                .reduce((acc, r) => acc + Math.pow((r.error as number) - mean, 2), 0) / validDetections;
        }
        const jitter = Math.sqrt(variance) * 1000; // ms

        setResults(finalResults);
        setStats({ avgError, jitter, missed, double });
    };

    // New: Manual Mic Test Mode helper
    const startMicTest = async () => {
        if (!audioContextRef.current || !analyzerRef.current) return;
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();

        // Pass undefined to use default microphone
        await analyzerRef.current.start();
    };

    const stopMicTest = () => {
        analyzerRef.current?.stop();
    };


    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
            <h2>Onset Detection Calibration</h2>

            <div style={{
                backgroundColor: '#333',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '2rem',
                border: '1px solid #555'
            }}>
                <h3>Configuration</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Gain (Boost): {gain.toFixed(1)}x</label>
                    <input
                        type="range"
                        min="1.0"
                        max="10.0"
                        step="0.1"
                        value={gain}
                        onChange={(e) => setGain(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Threshold (Sensitivity): {threshold.toFixed(3)}</label>
                    <input
                        type="range"
                        min="0.01"
                        max="0.5"
                        step="0.01"
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Input Level</label>
                    <div style={{ width: '100%', height: '20px', backgroundColor: '#222', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        {/* Threshold Marker */}
                        <div style={{
                            position: 'absolute',
                            left: `${Math.min(threshold * 100, 100)}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            backgroundColor: 'red',
                            zIndex: 10
                        }} />

                        {/* Level Bar */}
                        <div style={{
                            width: `${Math.min(currentLevel * 100, 100)}%`,
                            height: '100%',
                            backgroundColor: currentLevel > threshold ? '#4CAF50' : '#2196F3',
                            transition: 'width 0.1s ease-out'
                        }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                        <span>0.0</span>
                        <span>0.5</span>
                        <span>1.0</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={startMicTest}
                        style={{
                            padding: '0.8rem 1.5rem',
                            backgroundColor: '#FF9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Test Mic Input (Live)
                    </button>
                    <button
                        onClick={stopMicTest}
                        style={{
                            padding: '0.8rem 1.5rem',
                            backgroundColor: '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Stop Mic
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={startTest}
                    disabled={isRunning}
                    style={{
                        padding: '1rem 2rem',
                        fontSize: '1.2rem',
                        backgroundColor: isRunning ? '#666' : '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isRunning ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isRunning ? 'Running Loopback Test...' : 'Start Loopback Test'}
                </button>
            </div>

            {stats && (
                <div style={{
                    backgroundColor: '#333',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '2rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '1rem'
                }}>
                    <div>
                        <h3>Avg Error</h3>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: Math.abs(stats.avgError) < 20 ? '#4CAF50' : '#F44336' }}>
                            {stats.avgError.toFixed(2)} ms
                        </p>
                    </div>
                    <div>
                        <h3>Jitter</h3>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {stats.jitter.toFixed(2)} ms
                        </p>
                    </div>
                    <div>
                        <h3>Missed</h3>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: stats.missed === 0 ? '#4CAF50' : '#F44336' }}>
                            {stats.missed}
                        </p>
                    </div>
                    <div>
                        <h3>Double</h3>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: stats.double === 0 ? '#4CAF50' : '#F44336' }}>
                            {stats.double}
                        </p>
                    </div>
                </div>
            )}

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #444' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                            <th style={{ padding: '0.5rem' }}>#</th>
                            <th style={{ padding: '0.5rem' }}>Scheduled</th>
                            <th style={{ padding: '0.5rem' }}>Detected</th>
                            <th style={{ padding: '0.5rem' }}>Error (ms)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : '#222' }}>
                                <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                                <td style={{ padding: '0.5rem' }}>{r.scheduledTime.toFixed(4)}</td>
                                <td style={{ padding: '0.5rem' }}>{r.detectedTime?.toFixed(4) ?? '-'}</td>
                                <td style={{
                                    padding: '0.5rem',
                                    color: r.error && Math.abs(r.error * 1000) > 20 ? '#FF9800' : 'inherit'
                                }}>
                                    {r.error ? (r.error * 1000).toFixed(2) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#888' }}>
                <p>Note: "Double" means multiple detections occurred within the same 100ms window of a scheduled click.</p>
            </div>
        </div>
    );
};
