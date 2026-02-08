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

    // Unified Lifecycle Effect
    useEffect(() => {
        const manageAnalysis = async () => {
            if (isEnabled && audioContext && audioContext.state !== 'closed') {
                if (!analyzerInstance) {
                    console.log('[Hook] Starting analysis...');
                    await startAnalysis();
                } else {
                    // If already running but context changed (reference check), startAnalysis handles that internally?
                    // startAnalysis creates NEW analyzer if one exists.
                    // But we need to know if we SHOULD restart.
                    // The dependencies of this effect include audioContext.
                    // So if audioContext changes, this runs.

                    // If we have an instance but it belongs to a CLOSED or DIFFERENT context, restart.
                    if (analyzerInstance.audioContext !== audioContext) {
                        console.log('[Hook] Context changed, restarting analysis...');
                        await startAnalysis();
                    }
                }
            } else {
                // Disabled or Invalid Context
                if (analyzerInstance || isMicReady) {
                    console.log('[Hook] Stopping analysis (disabled or context invalid)...');
                    stopAnalysis();
                }
            }
        };

        manageAnalysis();

        return () => {
            // Cleanup on unmount or dep change
            // we rely on next effect run or component unmount cleanup (which calls stopAnalysis via clojure?)
            // Actually, we should probably stop if unmounting?
            // But if we are just changing deps, manageAnalysis will run again.
            // If we unmount, we want to stop.
            // There is a separate cleanup effect below at line 67 that handles unmount. 
            // So we don't strictly need to do anything here for unmount specifically 
            // IF that other effect covers it. 
            // The other effect (lines 67-75) stops the analyzer on unmount.
            // So we are good.
        };
    }, [isEnabled, audioContext, deviceId, startAnalysis, stopAnalysis, analyzerInstance, isMicReady]);

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
