import { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';

interface UseSessionManagerProps {
    isPlaying: boolean;
    bpm: number;
    patternId: string;
    latestOffsetMs: number; // From useRhythmScoring
    feedback: string | null; // From useRhythmScoring
    onsetIndex: number; // From useRhythmScoring (Unique ID for hit)
}


export interface SessionStats {
    score: number;
    rank: string;
    accuracy: number;
    stdDev: number;
    hitCount: number;
}

export const useSessionManager = ({ isPlaying, bpm, patternId, latestOffsetMs, feedback, onsetIndex }: UseSessionManagerProps) => {
    const [offsets, setOffsets] = useState<number[]>([]);
    const [lastSessionStats, setLastSessionStats] = useState<SessionStats | null>(null);

    const isPlayingRef = useRef(false);
    const startTimeRef = useRef<number>(0);
    const lastProcessedIndexRef = useRef<number>(-1);

    // Detect Start/Stop
    useEffect(() => {
        if (isPlaying && !isPlayingRef.current) {
            // Started
            setOffsets([]);
            setLastSessionStats(null); // Clear previous stats on new start
            startTimeRef.current = Date.now();
        } else if (!isPlaying && isPlayingRef.current) {
            // Stopped
            saveSession();
        }
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Record data
    useEffect(() => {
        if (!isPlaying || feedback === null || onsetIndex === -1) return;

        // Deduplication: Only record if this onset hasn't been processed
        if (onsetIndex <= lastProcessedIndexRef.current) return;

        lastProcessedIndexRef.current = onsetIndex;
        setOffsets(prev => [...prev, latestOffsetMs]);
    }, [latestOffsetMs, isPlaying, feedback, onsetIndex]);

    const calculateRank = (score: number): string => {
        if (score >= 95) return 'S';
        if (score >= 80) return 'A';
        if (score >= 60) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    };

    const saveSession = async () => {
        if (offsets.length === 0) return;

        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;

        // Calculate stats
        const absOffsets = offsets.map(o => Math.abs(o));
        const avgAccuracy = absOffsets.reduce((a, b) => a + b, 0) / absOffsets.length;

        // Standard Deviation
        // avg signed offset to find variance from mean, OR variance from zero?
        // Usually, consistency (stability) is StdDev of signed offsets.
        const meanSigned = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        const variance = offsets.reduce((a, b) => a + Math.pow(b - meanSigned, 2), 0) / offsets.length;
        const stdDev = Math.sqrt(variance);

        // Score calculation (0-100)
        // < 20ms avg = 100 (Stricter!)
        // > 100ms avg = 0
        const rawScore = 100 - ((avgAccuracy - 20) * (100 / 80));
        const score = Math.max(0, Math.min(100, Math.round(rawScore)));

        const rank = calculateRank(score);

        const earlyCount = offsets.filter(o => o < -30).length;
        const lateCount = offsets.filter(o => o > 30).length;
        const perfectCount = offsets.filter(o => Math.abs(o) <= 30).length;

        // Set Local State for UI
        setLastSessionStats({
            score,
            rank,
            accuracy: avgAccuracy,
            stdDev,
            hitCount: offsets.length
        });

        try {
            await db.sessions.add({
                date: new Date(),
                patternId,
                bpm,
                durationSeconds,
                score,
                rank,
                accuracy: avgAccuracy,
                stdDev,
                noteCount: offsets.length,
                stats: {
                    earlyCount,
                    lateCount,
                    perfectCount
                }
            });
            console.log('Session saved!', { score, rank, stdDev });
        } catch (e) {
            console.error('Failed to save session', e);
        }
    };

    return {
        rectordedCount: offsets.length,
        lastSessionStats
    };
};

