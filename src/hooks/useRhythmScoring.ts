import { useState, useEffect } from 'react';

interface UseRhythmScoringProps {
    onsets: number[];       // timestamps of detected hits
    lastBeatTime: number;   // timestamp of the last metronome click
    bpm: number;
}

export type Feedback = 'Perfect' | 'Good' | 'Early' | 'Late' | 'Miss' | null;

export const useRhythmScoring = ({ onsets, lastBeatTime, bpm }: UseRhythmScoringProps) => {
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [offsetMs, setOffsetMs] = useState<number>(0);

    useEffect(() => {
        if (onsets.length === 0) return;

        const lastOnset = onsets[onsets.length - 1];
        const beatInterval = 60 / bpm;

        // Check which beat this onset is closest to: the last one or the next one?
        // We only have lastBeatTime. Next beat is lastBeatTime + beatInterval.

        const diffToLast = lastOnset - lastBeatTime;
        const diffToNext = (lastBeatTime + beatInterval) - lastOnset;

        // We consider the closest beat
        let closestDiff = 0;

        if (Math.abs(diffToLast) < Math.abs(diffToNext)) {
            // Closer to last beat
            closestDiff = diffToLast; // Positive implies Late (Onset > Beat)
        } else {
            // Closer to next beat
            closestDiff = -diffToNext; // Negative implies Early (Onset < NextBeat)
        }

        const ms = closestDiff * 1000;
        setOffsetMs(ms);

        // Scoring window (in ms)
        const PERFECT_WINDOW = 30;
        const GOOD_WINDOW = 80;

        if (Math.abs(ms) < PERFECT_WINDOW) {
            setFeedback('Perfect');
        } else if (Math.abs(ms) < GOOD_WINDOW) {
            setFeedback('Good');
        } else {
            setFeedback(ms < 0 ? 'Early' : 'Late');
        }

        // Clear feedback after a short while
        const timer = setTimeout(() => setFeedback(null), 500);
        return () => clearTimeout(timer);

    }, [onsets, lastBeatTime, bpm]);

    return { feedback, offsetMs };
};
