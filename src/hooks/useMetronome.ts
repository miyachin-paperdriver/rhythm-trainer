import { useEffect, useRef, useState, useCallback } from 'react';
import { MetronomeEngine, type Subdivision } from '../components/Audio/MetronomeEngine';

export const useMetronome = () => {
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

    useEffect(() => {
        engineRef.current = new MetronomeEngine((beat, time, step, muted, countIn) => {
            // Logic runs on main beats
            const ctx = engineRef.current?.audioContext;
            if (!ctx) return;

            const now = ctx.currentTime;
            const diff = time - now;

            if (diff > 0) {
                setTimeout(() => {
                    setCurrentBeat(beat);
                    setCurrentStep(step);
                    setLastBeatTime(time);
                    setIsMuted(muted);
                    setIsCountIn(countIn);
                }, diff * 1000);
            } else {
                setCurrentBeat(beat);
                setCurrentStep(step);
                setLastBeatTime(time);
                setIsMuted(muted);
                setIsCountIn(countIn);
            }
        });
        setAudioContext(engineRef.current?.audioContext || null);

        return () => {
            engineRef.current?.stop();
        };
    }, []);

    const start = useCallback(() => {
        engineRef.current?.start();
        setAudioContext(engineRef.current?.audioContext || null);
        setIsPlaying(true);
    }, []);

    const stop = useCallback(() => {
        engineRef.current?.stop();
        setIsPlaying(false);
        setCurrentBeat(-1);
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

    return {
        bpm,
        isPlaying,
        start,
        stop,
        changeBpm,
        setSubdivision,
        setGapClick,
        currentBeat,
        currentStep,
        lastBeatTime,
        isMuted,
        isCountIn,
        audioContext
    };
};
