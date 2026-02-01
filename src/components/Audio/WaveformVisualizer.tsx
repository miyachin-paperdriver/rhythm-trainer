import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
    audioBlob: Blob | null;
    onsets: number[]; // Absolute timestamps (audioContext.currentTime)
    startTime: number; // Start time of recording (audioContext.currentTime)
    duration: number; // Length of recording in seconds
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioBlob, onsets, startTime, duration }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = React.useState<AudioBuffer | null>(null);

    useEffect(() => {
        if (!audioBlob) return;

        const loadAudio = async () => {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await audioContext.decodeAudioData(arrayBuffer);
            setAudioBuffer(buffer);
            audioContext.close();
        };
        loadAudio();
    }, [audioBlob]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !audioBuffer) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, width, height);

        // Draw Waveform
        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#0cf';
        ctx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Draw Onsets
        ctx.strokeStyle = '#f05';
        ctx.lineWidth = 2;
        ctx.beginPath();

        onsets.forEach(onset => {
            const relativeTime = onset - startTime;
            if (relativeTime < 0 || relativeTime > duration) return;

            const x = (relativeTime / duration) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        });
        ctx.stroke();

    }, [audioBuffer, onsets, startTime, duration]);

    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlayback = () => {
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            if (!audioBlob) return;

            // If we have an existing audio element but it ended, reuse or recreate?
            // Recreating is safer in case of blob URL issues or state drift
            if (audioRef.current) {
                audioRef.current.pause();
            }

            const url = URL.createObjectURL(audioBlob);
            const audio = new Audio(url);

            audio.onended = () => {
                setIsPlaying(false);
            };

            audio.play().catch(e => {
                console.error("Playback failed", e);
                setIsPlaying(false);
            });

            audioRef.current = audio;
            setIsPlaying(true);
        }
    };

    if (!audioBlob) return null;

    return (
        <div className="waveform-container" style={{ width: '100%', marginTop: '1rem' }}>
            <h4 style={{ color: '#aaa', marginBottom: '0.5rem' }}>Session Recording & Onset Detection</h4>
            <canvas
                ref={canvasRef}
                width={600}
                height={150}
                style={{ width: '100%', height: 'auto', borderRadius: '8px', background: '#222' }}
            />
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
