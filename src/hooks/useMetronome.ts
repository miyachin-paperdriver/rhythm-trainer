import { useEffect, useRef, useState, useCallback } from 'react';
import { MetronomeEngine, type Subdivision } from '../components/Audio/MetronomeEngine';
import type { MeasureData } from '../utils/patterns';

interface UseMetronomeOptions {
    audioLatency?: number; // Total roundtrip latency in ms
}

export const useMetronome = (options: UseMetronomeOptions = {}) => {
    const { audioLatency = 0 } = options;

    const engineRef = useRef<MetronomeEngine | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [currentBeat, setCurrentBeat] = useState(-1);
    const [currentStep, setCurrentStep] = useState(0);
    const [lastBeatTime, setLastBeatTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCountIn, setIsCountIn] = useState(false);

    // Expose context via state
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    // Store audioLatency in ref for use in callback
    const audioLatencyRef = useRef(audioLatency);
    useEffect(() => {
        audioLatencyRef.current = audioLatency;
    }, [audioLatency]);

    useEffect(() => {
        engineRef.current = new MetronomeEngine((beat, time, _step, muted, countIn, _subBeat, tickIndex) => {
            const ctx = engineRef.current?.audioContext;
            if (!ctx) return;

            const now = ctx.currentTime;
            const diff = time - now;

            // Calculate visual delay: diff + estimated output latency
            // audioLatency = output + input, so we approximate output as half
            const outputLatencyMs = audioLatencyRef.current / 2;

            // Define update function to avoid duplication
            const updateState = () => {
                setCurrentBeat(beat);
                // Use tickIndex for visualizer step to advance on every subdivision
                setCurrentStep(tickIndex);
                // Only update lastBeatTime on main beats (subBeat === 0) to keep history clean?
                // Or maybe we want history to have all ticks?
                // The scoring hook uses lastBeatTime. If we update it on every subBeat, scoring might get confused 
                // if it expects quarter notes.
                // However, user might want to score against subdivisions too?
                // For now, let's keep lastBeatTime updating only on main beats (subBeat === 0)
                // BUT wait, if we only update it on subBeat 0, useRhythmScoring might miss sub-beats if it expects them.
                // useRhythmScoring uses lastBeatTime to calculate offset.
                // If the visualizer advances, the target time should probably advance too.
                // So let's update lastBeatTime to 'time' (which is the current note time).
                setLastBeatTime(time);

                setIsMuted(muted);
                setIsCountIn(countIn);
            };

            // Total delay = scheduled time diff + output latency
            const totalDelayMs = diff * 1000 + outputLatencyMs;

            if (totalDelayMs > 0) {
                setTimeout(updateState, totalDelayMs);
            } else {
                updateState();
            }
        });
        setAudioContext(engineRef.current?.audioContext || null);

        return () => {
            engineRef.current?.stop();
        };
    }, []);


    const start = useCallback(() => {
        // Reset state immediately to prevent "flash" of previous state
        setCurrentStep(-1);
        setIsCountIn(true); // Engine always starts with count-in
        setIsPlaying(true);

        engineRef.current?.start();
        setAudioContext(engineRef.current?.audioContext || null);
    }, []);

    const stop = useCallback(() => {
        engineRef.current?.stop();
        setIsPlaying(false);
        setCurrentBeat(-1);
        setCurrentStep(-1); // Reset step so next start doesn't show old position
        setIsCountIn(false);
        setIsMuted(false);
    }, []);

    const changeBpm = useCallback((newBpm: number) => {
        const clamped = Math.max(30, Math.min(300, newBpm));
        engineRef.current?.setBpm(clamped);
        setBpm(clamped);
    }, []);

    const setSubdivision = useCallback((sub: Subdivision) => {
        engineRef.current?.setSubdivision(sub);
    }, []);

    const setGapClick = useCallback((enabled: boolean, play: number, mute: number) => {
        engineRef.current?.setGapClick(enabled, play, mute);
    }, []);

    const setPattern = useCallback((measures: MeasureData[] | null) => {
        engineRef.current?.setPattern(measures);
    }, []);

    const initializeAudio = useCallback(() => {
        engineRef.current?.init();
        setAudioContext(engineRef.current?.audioContext || null);
    }, []);

    const resetAudio = useCallback(async () => {
        if (engineRef.current) {
            // Stop and close existing
            await engineRef.current.close();
            // Re-init (create new context)
            engineRef.current.init();

            // Update state
            const newCtx = engineRef.current.audioContext;
            setAudioContext(newCtx);

            return newCtx;
        }
        return null;
    }, []);

    const resumeAudio = useCallback(async () => {
        if (engineRef.current?.audioContext?.state === 'suspended') {
            await engineRef.current.audioContext.resume();
            setAudioContext(engineRef.current.audioContext); // Trigger re-render of state
        }
    }, []);

    return {
        bpm,
        isPlaying,
        start,
        stop,
        changeBpm,
        setSubdivision,
        setGapClick,
        setPattern,
        currentBeat,
        currentStep,
        lastBeatTime,
        isMuted,
        isCountIn,
        audioContext,
        audioContextState: audioContext?.state,
        initializeAudio,
        resetAudio,
        resumeAudio
    };
};
