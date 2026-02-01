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

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AudioAnalyzer | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

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

        return () => {
            analyzer.stop();
            ctx.close();
        };
    }, []);

    const playClick = (time: number) => {
        if (!audioContextRef.current || !destinationRef.current) return;

        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(destinationRef.current); // Connect to the stream destination
        gain.connect(ctx.destination); // Also connect to speakers so we can hear it

        osc.frequency.value = 1000;
        osc.type = 'square';

        // Short click
        osc.start(time);
        osc.stop(time + 0.05);

        // Envelope to avoid clicking artifacts
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    };

    const startTest = useCallback(async () => {
        if (!audioContextRef.current || !analyzerRef.current || !destinationRef.current) return;

        setIsRunning(true);
        setResults([]);
        setStats(null);
        scheduledTimesRef.current = [];
        detectedTimesRef.current = [];

        const ctx = audioContextRef.current;
        await ctx.resume();

        // Start Analyzer
        analyzerRef.current.onOnset = (time) => {
            console.log('Detected onset at', time);
            detectedTimesRef.current.push(time);
        };

        await analyzerRef.current.start(destinationRef.current.stream);

        // Schedule clicks
        const startTime = ctx.currentTime + 1.0; // Start 1 second from now

        for (let i = 0; i < ITERATIONS; i++) {
            const time = startTime + i * INTERVAL;
            scheduledTimesRef.current.push(time);
            playClick(time);
        }

        // Finish test after all clicks + buffer
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

        // Simple matching logic: find closest detection for each scheduled time
        scheduled.forEach((sTime) => {
            // Find detections within a window (e.g., +/- 100ms)
            const matches = detected.filter(d => Math.abs(d - sTime) < 0.1);

            if (matches.length === 0) {
                finalResults.push({ scheduledTime: sTime, detectedTime: null, error: null });
                missed++;
            } else {
                // Take the first one (or closest)
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

        // Calculate stats
        const avgError = validDetections > 0 ? (totalError / validDetections) * 1000 : 0; // ms

        // Jitter (Standard Deviation of error)
        let variance = 0;
        if (validDetections > 0) {
            const mean = totalError / validDetections;
            variance = finalResults
                .filter(r => r.error !== null)
                .reduce((acc, r) => acc + Math.pow((r.error as number) - mean, 2), 0) / validDetections;
        }
        const jitter = Math.sqrt(variance) * 1000; // ms

        setResults(finalResults);
        setStats({
            avgError,
            jitter,
            missed,
            double
        });
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'white' }}>
            <h2>Onset Detection Self-Test</h2>

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
                    {isRunning ? 'Running Test...' : 'Start Test'}
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
