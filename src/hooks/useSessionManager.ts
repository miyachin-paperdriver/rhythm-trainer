import { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';

interface UseSessionManagerProps {
    isPlaying: boolean;
    bpm: number;
    patternId: string;
    latestOffsetMs: number; // From useRhythmScoring
    feedback: string | null; // From useRhythmScoring
}

export const useSessionManager = ({ isPlaying, bpm, patternId, latestOffsetMs, feedback }: UseSessionManagerProps) => {
    const [offsets, setOffsets] = useState<number[]>([]);
    const isPlayingRef = useRef(false);
    const startTimeRef = useRef<number>(0);

    // Detect Start/Stop
    useEffect(() => {
        if (isPlaying && !isPlayingRef.current) {
            // Started
            setOffsets([]);
            startTimeRef.current = Date.now();
        } else if (!isPlaying && isPlayingRef.current) {
            // Stopped
            saveSession();
        }
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Record data
    // We need a way to know if `latestOffsetMs` is NEW.
    // `useRhythmScoring` updates it. But if the offset is identical (rare with floats), we might miss it?
    // Or if feedback matches.
    // Ideally useRhythmScoring should return a "judgmentId" or timestamp of judgment.
    // For now, let's use a ref to store Last Processed Timestamp or something?
    // Using `feedback` change as trigger is risky if feedback is same "Good" twice.
    // I will rely on `latestOffsetMs` changing. It's a float, unlikely to be exact same twice unless 0.

    useEffect(() => {
        if (!isPlaying || feedback === null) return;

        // Record it
        setOffsets(prev => [...prev, latestOffsetMs]);

    }, [latestOffsetMs, isPlaying, feedback]);

    const saveSession = async () => {
        if (offsets.length === 0) return;

        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;

        // Calculate stats
        const absOffsets = offsets.map(o => Math.abs(o));
        const avgAccuracy = absOffsets.reduce((a, b) => a + b, 0) / absOffsets.length;

        // Score calculation (0-100)
        // < 30ms avg = 100
        // > 100ms avg = 0
        const rawScore = 100 - ((avgAccuracy - 30) * (100 / 70));
        const score = Math.max(0, Math.min(100, Math.round(rawScore)));

        const earlyCount = offsets.filter(o => o < -30).length;
        const lateCount = offsets.filter(o => o > 30).length;
        const perfectCount = offsets.filter(o => Math.abs(o) <= 30).length;

        try {
            await db.sessions.add({
                date: new Date(),
                patternId,
                bpm,
                durationSeconds,
                score,
                accuracy: avgAccuracy,
                noteCount: offsets.length,
                stats: {
                    earlyCount,
                    lateCount,
                    perfectCount
                }
            });
            console.log('Session saved!');
        } catch (e) {
            console.error('Failed to save session', e);
        }
    };

    return {
        rectordedCount: offsets.length
    };
};
