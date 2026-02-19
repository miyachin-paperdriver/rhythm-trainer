import React, { useEffect, useRef } from 'react';

interface TimingIndicatorProps {
    bpm: number;
    isPlaying: boolean;
    audioLatency: number;
    theme: 'light' | 'dark';
    isActive: boolean;
}

export const TimingIndicator: React.FC<TimingIndicatorProps> = ({
    bpm,
    isPlaying,
    audioLatency,
    theme,
    isActive
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);

    // Constants


    useEffect(() => {
        if (!isActive || !isPlaying) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize start time for sync
        if (startTimeRef.current === 0) {
            startTimeRef.current = performance.now();
        }

        const render = (time: number) => {
            // Resize handler (basic)
            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }

            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);

            // Draw Center Line (Target) - REMOVED (Handled by parent TimingGauge)
            // const centerX = width / 2;
            // ctx.strokeStyle = theme === 'dark' ? '#fff' : '#000';
            // ctx.lineWidth = 2;
            // ctx.beginPath();
            // ctx.moveTo(centerX, 0);
            // ctx.lineTo(centerX, height);
            // ctx.stroke();
            const centerX = width / 2;

            // Calculate current beat position based on time
            // We need a stable time reference. performance.now() is good.
            // But we need to sync with AudioContext time or track beats.
            // Since we don't have direct access to AudioContext time continuously here without props drilling widely,
            // we can estimate based on BPM.

            // Actually, for accurate visual sync, we ideally need the `nextNoteTime` or similar from the engine.
            // However, a simple BPM based loop starting from `isPlaying` might drift.
            // Let's try a pure BPM based estimation first relative to `startTimeRef`.
            // User requirement: "Sync with metronome beats and latency".

            // To make "notes flow from left", we calculate x position:
            // Target time: T_beat
            // Current time: T_now
            // Time to impact: dt = T_beat - T_now
            // X = CenterX - (dt * Speed)

            // Interval between beats in ms
            const interval = (60 / bpm) * 1000;

            // Current accumulated time
            const elapsed = time - startTimeRef.current;

            // We want to show beats that are coming up.
            // Let's render beats from T_now - 500ms to T_now + 2000ms

            // Fix phase alignment? 
            // We assume the FIRST beat happened at `startTimeRef`.
            // In reality, `isPlaying` might toggle at random times. 
            // For tight sync, we should pass `lastBeatTime` or `nextBeatTime` from parent.
            // But `lastBeatTime` updates only on beat.

            // Let's just create a visual flow that matches BPM for now.
            // If strict sync is needed, we will refactor to accept `nextNoteTime`.

            // Visual loop
            const beatCount = Math.floor(elapsed / interval);
            const nextBeatIndex = beatCount + 1;

            // Look ahead 4 beats
            for (let i = -1; i < 5; i++) {
                const beatIndex = nextBeatIndex + i;
                const beatTime = startTimeRef.current + (beatIndex * interval);

                // Audio Latency Correction: 
                // We want the visual to hit center when the SOUND is heard.
                // Sound Time = AudioSystemTime + Latency
                // Visual Target Time = Sound Time
                // So if we are predicting audio schedule time, we add latency?
                // Actually, if `interval` is perfect, we just align.

                // Let's refine: 
                // Time to target = beatTime - time
                // If latency is positive (sound is late), we want the visual to also be "late" (delayed)?
                // or do we want visual to anticipate?
                // "Latencyも含めてタイミングが正しくなるように" -> Visual should match Sound.
                // Component receives `audioLatency`.
                // Adjusted Target Time = beatTime + audioLatency;

                const timeToTarget = (beatTime + audioLatency) - time;

                // Pixels per ms
                const speed = width * 0.0005 * (bpm / 60); // Dynamic speed based on BPM

                const x = centerX - (timeToTarget * speed);

                // Draw Note
                if (x > -50 && x < width + 50) {
                    ctx.fillStyle = theme === 'dark' ? '#00ffd0' : '#007aff';
                    ctx.beginPath();
                    ctx.arc(x, height / 2, 8, 0, Math.PI * 2);
                    ctx.fill();

                    // Glow
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = ctx.fillStyle;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [bpm, isPlaying, audioLatency, theme, isActive]);

    if (!isActive) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '60px',
                display: 'block',
                background: 'transparent' // Overlay style
            }}
        />
    );
};
