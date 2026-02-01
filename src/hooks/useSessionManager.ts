import { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';

interface UseSessionManagerProps {
    isPlaying: boolean;
    bpm: number;
    patternId: string;
    latestOffsetMs: number; // From useRhythmScoring
    feedback: string | null; // From useRhythmScoring
    onsetIndex: number; // From useRhythmScoring (Unique ID for hit)
    hand?: 'L' | 'R'; // New: Hand used for this hit
}

// Stats for a single group (Total, Left, or Right)
export interface GroupStats {
    score: number;
    rank: string;
    accuracy: number;
    stdDev: number;
    tendency: number;
    hitCount: number;
}

export interface SessionResult {
    total: GroupStats;
    left?: GroupStats;
    right?: GroupStats;
}

interface RecordedHit {
    offset: number;
    hand: 'L' | 'R';
    timestamp: number;
    index: number;
}

export const useSessionManager = ({ isPlaying, bpm, patternId, latestOffsetMs, feedback, onsetIndex, hand = 'R' }: UseSessionManagerProps) => {
    const [hits, setHits] = useState<RecordedHit[]>([]);
    const [lastSessionStats, setLastSessionStats] = useState<SessionResult | null>(null);

    const isPlayingRef = useRef(false);
    const startTimeRef = useRef<number>(0);
    const lastProcessedIndexRef = useRef<number>(-1);

    // Detect Start/Stop
    useEffect(() => {
        if (isPlaying && !isPlayingRef.current) {
            // Started
            setHits([]);
            setLastSessionStats(null); // Clear previous stats on new start
            startTimeRef.current = Date.now();
            lastProcessedIndexRef.current = -1; // Reset index tracker
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

        // Calculate relative timestamp (ms)
        const timestamp = Date.now() - startTimeRef.current;

        setHits(prev => [...prev, {
            offset: latestOffsetMs,
            hand,
            timestamp,
            index: onsetIndex
        }]);
    }, [latestOffsetMs, isPlaying, feedback, onsetIndex, hand]);

    const calculateRank = (score: number): string => {
        if (score >= 95) return 'S';
        if (score >= 80) return 'A';
        if (score >= 60) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    };

    const calculateGroupStats = (offsets: number[]): GroupStats => {
        if (offsets.length === 0) {
            return { score: 0, rank: '-', accuracy: 0, stdDev: 0, tendency: 0, hitCount: 0 };
        }

        const absOffsets = offsets.map(o => Math.abs(o));
        const avgAccuracy = absOffsets.reduce((a, b) => a + b, 0) / absOffsets.length;

        // Tendency (Mean Signed Error)
        const meanSigned = offsets.reduce((a, b) => a + b, 0) / offsets.length;

        // Standard Deviation
        const variance = offsets.reduce((a, b) => a + Math.pow(b - meanSigned, 2), 0) / offsets.length;
        const stdDev = Math.sqrt(variance);

        // Score calculation (0-100)
        // < 20ms avg = 100
        const rawScore = 100 - ((avgAccuracy - 20) * (100 / 80));
        const score = Math.max(0, Math.min(100, Math.round(rawScore)));

        return {
            score,
            rank: calculateRank(score),
            accuracy: avgAccuracy,
            stdDev,
            tendency: meanSigned,
            hitCount: offsets.length
        };
    };

    const saveSession = async () => {
        if (hits.length === 0) return;

        const durationSeconds = (Date.now() - startTimeRef.current) / 1000;

        // 1. Total Stats
        const allOffsets = hits.map(h => h.offset);
        const totalStats = calculateGroupStats(allOffsets);

        // 2. Left Stats
        const leftOffsets = hits.filter(h => h.hand === 'L').map(h => h.offset);
        const leftStats = calculateGroupStats(leftOffsets);

        // 3. Right Stats
        const rightOffsets = hits.filter(h => h.hand === 'R').map(h => h.offset);
        const rightStats = calculateGroupStats(rightOffsets);

        const result: SessionResult = {
            total: totalStats,
            left: leftOffsets.length > 0 ? leftStats : undefined,
            right: rightOffsets.length > 0 ? rightStats : undefined
        };

        // Set Local State for UI
        setLastSessionStats(result);

        // Additional Stats for DB (legacy + extra)
        const earlyCount = allOffsets.filter(o => o < -30).length;
        const lateCount = allOffsets.filter(o => o > 30).length;
        const perfectCount = allOffsets.filter(o => Math.abs(o) <= 30).length;

        try {
            const sessionId = await db.sessions.add({
                date: new Date(),
                patternId,
                bpm,
                durationSeconds,
                score: totalStats.score,
                rank: totalStats.rank,
                accuracy: totalStats.accuracy,
                stdDev: totalStats.stdDev,
                tendency: totalStats.tendency,
                noteCount: totalStats.hitCount,
                stats: {
                    earlyCount,
                    lateCount,
                    perfectCount
                },
                statsL: result.left,
                statsR: result.right
            });

            // Save detailed logs
            if (sessionId) {
                await db.session_details.add({
                    sessionId: sessionId as number,
                    hits: hits.map(h => ({
                        index: h.index,
                        timestamp: h.timestamp,
                        offset: h.offset,
                        hand: h.hand
                    }))
                });
            }

            console.log('Session saved!', result, 'ID:', sessionId);
        } catch (e) {
            console.error('Failed to save session', e);
        }
    };

    return {
        rectordedCount: hits.length,
        lastSessionStats
    };
};

