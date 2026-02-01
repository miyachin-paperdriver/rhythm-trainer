import React, { useEffect, useRef, useState } from 'react';

interface WaveformVisualizerProps {
    audioBlob: Blob | null;
    onsets: number[]; // Absolute timestamps
    startTime: number;
    duration: number; // passed from recorder, but buffer.duration is preferred
    audioContext?: AudioContext | null;
    beatHistory?: number[]; // Absolute timestamps of beat clicks
    audioLatency?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
    audioBlob,
    onsets,
    startTime,
    // duration removed
    audioContext,
    beatHistory = [],
    audioLatency = 0
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [audioBuffer, setAudioBuffer] = React.useState<AudioBuffer | null>(null);

    // Playback
    const [isPlaying, setIsPlaying] = React.useState(false);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    // playbackContextRef removed

    // Zoom & Interaction
    const [zoom, setZoom] = useState(1);
    const [hoveredMarker, setHoveredMarker] = useState<{ x: number, offsetMs: number | null } | null>(null);

    // Load Audio
    useEffect(() => {
        if (!audioBlob) return;

        const loadAudio = async () => {
            const arrayBuffer = await audioBlob.arrayBuffer();
            // Create a temp context just for decoding if main one is not handy or locked
            const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
            try {
                const buffer = await ctx.decodeAudioData(arrayBuffer);
                setAudioBuffer(buffer);
            } catch (e) {
                console.error("Error decoding audio", e);
            }
        };
        loadAudio();
    }, [audioBlob, audioContext]);

    // Draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Visual dimensions
        const viewWidth = containerRef.current?.clientWidth || 600;
        const width = viewWidth * zoom;
        const height = canvas.height;

        // Update canvas size
        if (canvas.width !== width) canvas.width = width;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);

        // --- Draw Waveform ---
        const data = audioBuffer.getChannelData(0);
        const renderDuration = audioBuffer.duration;

        // Samples per pixel
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#0cf';
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;

            const startSample = i * step;
            if (startSample >= data.length) break;

            for (let j = 0; j < step; j++) {
                if (startSample + j >= data.length) break;
                const datum = data[startSample + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            if (min === 1.0) min = 0;
            if (max === -1.0) max = 0;

            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // --- Draw Beats (Metronome) - Gray lines ---
        ctx.strokeStyle = '#666'; // Slightly brighter gray for visibility
        ctx.lineWidth = 1;
        ctx.beginPath();
        beatHistory.forEach(beatTime => {
            const relativeTime = beatTime - startTime;
            if (relativeTime < 0 || relativeTime > renderDuration) return;
            const x = (relativeTime / renderDuration) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        });
        ctx.stroke();

        // --- Draw Onsets (Corrected) - Red lines ---
        // "Make gray part red" -> user implies Corrected Input should be Red.
        // We shift the Onset by -AudioLatency (move left).
        ctx.strokeStyle = '#f05';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const latencySec = (audioLatency || 0) / 1000;

        onsets.forEach(onset => {
            // Corrected Time = Detected Time - Latency
            const correctedTime = onset - latencySec;
            const relativeTime = correctedTime - startTime;

            if (relativeTime < 0 || relativeTime > renderDuration) return;

            const x = (relativeTime / renderDuration) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        });
        ctx.stroke();

    }, [audioBuffer, onsets, beatHistory, startTime, zoom, audioLatency]);

    // Handle Mouse Interaction for Tooltip
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!audioBuffer) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const renderDuration = audioBuffer.duration;
        const clickTime = (x / canvas.width) * renderDuration + startTime;

        // Find closest CORRECTED onset
        const latencySec = (audioLatency || 0) / 1000;
        let closestOnset = -1;
        let minDist = Infinity;

        onsets.forEach(onset => {
            const correctedTime = onset - latencySec;
            const diff = Math.abs(correctedTime - clickTime);
            if (diff < minDist) {
                minDist = diff;
                closestOnset = correctedTime; // Store corrected time
            }
        });

        const timeThresh = (20 / canvas.width) * renderDuration;

        if (minDist < timeThresh) {
            // Found a marker (at Corrected Time). Find closest Beat.
            let closestBeat = -1;
            let minBeatDist = Infinity;

            beatHistory.forEach(beat => {
                const diff = Math.abs(beat - closestOnset);
                if (diff < minBeatDist) {
                    minBeatDist = diff;
                    closestBeat = beat;
                }
            });

            let offsetMs: number | null = null;
            if (closestBeat !== -1) {
                offsetMs = (closestOnset - closestBeat) * 1000;
            }

            const relativeX = ((closestOnset - startTime) / renderDuration) * canvas.width;
            setHoveredMarker({ x: relativeX, offsetMs });
        } else {
            setHoveredMarker(null);
        }
    };

    const togglePlayback = () => {
        if (isPlaying) {
            if (sourceRef.current) {
                try {
                    sourceRef.current.stop();
                } catch (e) { /* ignore */ }
                sourceRef.current = null;
            }
            setIsPlaying(false);
        } else {
            if (!audioBuffer) return;

            const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => setIsPlaying(false);
            source.start(0);
            sourceRef.current = source;
            setIsPlaying(true);
        }
    };

    if (!audioBlob) return null;

    return (
        <div className="waveform-container" style={{ width: '100%', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ color: '#aaa', margin: 0 }}>Review (Zoom: {zoom}x)</h4>

                {/* Zoom Slider */}
                <input
                    type="range"
                    min="1" max="10" step="0.5"
                    value={zoom}
                    onChange={e => setZoom(parseFloat(e.target.value))}
                    style={{ width: '150px', accentColor: 'var(--color-primary)' }}
                />
            </div>

            {/* Scroll Container */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    overflowX: 'auto',
                    background: '#222',
                    borderRadius: '8px',
                    position: 'relative'
                }}
            >
                <canvas
                    ref={canvasRef}
                    height={150}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredMarker(null)}
                    style={{ display: 'block' }} // remove inline gap
                />

                {/* Tooltip */}
                {hoveredMarker && (
                    <div style={{
                        position: 'absolute',
                        left: hoveredMarker.x,
                        top: 10,
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.8)',
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap'
                    }}>
                        {hoveredMarker.offsetMs !== null
                            ? `${Math.round(hoveredMarker.offsetMs)}ms`
                            : 'No Beat Match'}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                    onClick={togglePlayback}
                    style={{
                        padding: '0.5rem 1rem',
                        background: isPlaying ? 'var(--color-accent)' : 'var(--color-primary)',
                        color: isPlaying ? '#fff' : '#000',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        minWidth: '140px'
                    }}
                >
                    {isPlaying ? '⏹ Stop' : '▶ Play Recording'}
                </button>
            </div>
        </div>
    );
};
