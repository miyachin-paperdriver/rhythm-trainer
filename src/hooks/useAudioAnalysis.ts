import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioAnalyzer } from '../components/Audio/AudioAnalyzer';

interface UseAudioAnalysisProps {
    audioContext: AudioContext | null;
    gain?: number;
    threshold?: number;
    isEnabled?: boolean; // New prop to control if we should even try to use mic
    deviceId?: string;
}

export const useAudioAnalysis = ({ audioContext, gain = 5.0, threshold = 0.1, isEnabled = true, deviceId }: UseAudioAnalysisProps) => {
    const analyzerRef = useRef<AudioAnalyzer | null>(null);
    const [analyzerInstance, setAnalyzerInstance] = useState<AudioAnalyzer | null>(null);
    const [isMicReady, setIsMicReady] = useState(false);
    const [onsets, setOnsets] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Define cleanup first
    const stopAnalysis = useCallback(() => {
        analyzerRef.current?.stop();
        setIsMicReady(false);
    }, []);

    const clearOnsets = useCallback(() => {
        setOnsets([]);
        setError(null);
    }, []);

    const startAnalysis = useCallback(async (overrideDeviceId?: string) => {
        if (!audioContext || audioContext.state === 'closed') return;

        // Always create new instance on start to ensure fresh stream
        if (analyzerRef.current) {
            analyzerRef.current.stop();
        }

        analyzerRef.current = new AudioAnalyzer(audioContext);
        setAnalyzerInstance(analyzerRef.current);

        // Apply settings
        analyzerRef.current.setGain(gain);
        analyzerRef.current.setThreshold(threshold);
        analyzerRef.current.onOnset = (time) => {
            setOnsets(prev => [...prev, time]);
        };

        try {
            await analyzerRef.current.start(undefined, overrideDeviceId || deviceId);

            // Android Fix: Force resume context after stream acquisition
            // The stream acquisition can sometimes suspend the context or switch audio focus
            if (audioContext.state === 'suspended') {
                console.log('[Hook] Forcing AudioContext resume after mic start');
                await audioContext.resume();
            }

            setIsMicReady(true);
            setError(null);
        } catch (e) {
            console.error(e);
            setError('Could not access microphone');
        }
    }, [audioContext, gain, threshold, deviceId]);

    // Cleanup Effect
    useEffect(() => {
        return () => {
            if (analyzerRef.current) {
                analyzerRef.current.stop();
                analyzerRef.current = null;
            }
            setAnalyzerInstance(null);
        };
    }, []);

    // Auto-Start/Stop based on isEnabled
    useEffect(() => {
        if (isEnabled) {
            if (!isMicReady && !analyzerInstance && audioContext && audioContext.state !== 'closed') {
                console.log('[Hook] Auto-starting analysis (isEnabled=true)');
                startAnalysis();
            }
        } else {
            if (isMicReady || analyzerInstance) {
                console.log('[Hook] Auto-stopping analysis (isEnabled=false)');
                stopAnalysis();
            }
        }
    }, [isEnabled, isMicReady, analyzerInstance, audioContext, startAnalysis, stopAnalysis]);

    useEffect(() => {
        // If context changes (or init), recreate analyzer
        // ONLY if enabled
        if (!isEnabled) {
            // Cleanup handled by auto-stop effect above or cleanup function
            return;
        }

        if (audioContext && audioContext.state !== 'closed') {
            // Clean up existing if any (though effect cleanup above handles unmount, logic here handles prop change)
            if (analyzerRef.current) {
                // We don't want to stop here if it's just a re-render, but if context CHANGED we must.
                // Actually startAnalysis handles creation. This effect might be redundant or conflicting with startAnalysis?
                // limit this effect to just setting properties if instance exists
            }

            // If we have an instance, update properties
            if (analyzerRef.current) {
                analyzerRef.current.setGain(gain);
                analyzerRef.current.setThreshold(threshold);

                // Re-bind callback because state (onsets) might be stale in closure?
                // No, setState is stable.
            }
        }
    }, [audioContext, isEnabled, deviceId]); // Re-run when context, enabled state, or device changes

    // Update settings dynamically
    useEffect(() => {
        if (analyzerRef.current) {
            analyzerRef.current.setGain(gain);
        }
    }, [gain]);

    useEffect(() => {
        if (analyzerRef.current) {
            analyzerRef.current.setThreshold(threshold);
        }
    }, [threshold]);

    // Auto start/stop based on playback or manual? 
    // Probably manual "Enable Mic" is safer first, then auto with playback.
    // For now we expose start/stop manually.

    // Poll for current level for UI
    const [currentLevel, setCurrentLevel] = useState(0);
    useEffect(() => {
        let animationFrameId: number;

        const updateLevel = () => {
            if (analyzerRef.current) {
                setCurrentLevel(analyzerRef.current.currentLevel);
            }
            animationFrameId = requestAnimationFrame(updateLevel);
        };

        updateLevel();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return {
        isMicReady,
        startAnalysis,
        stopAnalysis,
        clearOnsets,
        onsets,
        error,
        mediaStream: analyzerRef.current?.mediaStream || null,
        analyzer: analyzerInstance,
        currentLevel // Expose level
    };
};
