import { useState, useEffect, useRef } from 'react';

interface UseRhythmScoringProps {
    onsets: number[];       // timestamps of detected hits
    lastBeatTime: number;   // timestamp of the last metronome click
    bpm: number;
    audioLatency?: number;  // New: Loopback latency (Output + Input)
}

export type Feedback = 'Perfect' | 'Good' | 'Early' | 'Late' | 'Miss' | null;

export const useRhythmScoring = ({ onsets, lastBeatTime, bpm, audioLatency = 0 }: UseRhythmScoringProps) => {
    const [feedback, setFeedback] = useState<Feedback>(null);
    const [offsetMs, setOffsetMs] = useState<number>(0);
    const [onsetIndex, setOnsetIndex] = useState<number>(-1);
    const processedOnsetsRef = useRef<number>(0);

    // Convert latency from ms to seconds
    const latencySec = audioLatency / 1000;

    useEffect(() => {
        // Reset processed count if onsets cleared (new session)
        if (onsets.length === 0) {
            processedOnsetsRef.current = 0;
            return;
        }

        // Only process if we have a NEW onset
        if (onsets.length <= processedOnsetsRef.current) {
            return;
        }

        const currentOnsetIndex = onsets.length - 1;
        const lastOnset = onsets[currentOnsetIndex]; // Raw onset time
        processedOnsetsRef.current = onsets.length; // Mark as processed
        // Adjusted onset time (When the user actually hit)
        // If there is system latency L, the mic detects it L seconds LATER than it happened.
        // So actualTime = detectedTime - latency.
        // Wait, "audioLatency" usually means roundtrip?
        // If we hear the metronome late, we hit late.
        // If the mic is slow, we detect late.
        // So both add up.
        // We want to correct the "measured error".
        // Measured Error = DetectedTime - MetronomeTime
        // Real Error = (DetectedTime - InputLatency) - (MetronomeTime + OutputLatency)
        //            = DetectedTime - MetronomeTime - (InputLatency + OutputLatency)
        //            = rawOffset - totalLatency.
        // So yes, subtract total latency.

        const adjustedOnset = lastOnset - latencySec;

        const beatInterval = 60 / bpm;

        // Check which beat this onset is closest to: the last one or the next one?
        // We only have lastBeatTime. Next beat is lastBeatTime + beatInterval.

        const diffToLast = adjustedOnset - lastBeatTime;
        const diffToNext = (lastBeatTime + beatInterval) - adjustedOnset;

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
        setOnsetIndex(currentOnsetIndex);

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

    }, [onsets, lastBeatTime, bpm, latencySec]);

    return { feedback, offsetMs, onsetIndex };
};
