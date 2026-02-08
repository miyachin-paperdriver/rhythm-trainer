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

    useEffect(() => {
        // Cleanup function for previous instance
        return () => {
            if (analyzerRef.current) {
                analyzerRef.current.stop();
                analyzerRef.current = null;
            }
            setAnalyzerInstance(null);
        };
    }, []);

    useEffect(() => {
        // If context changes (or init), recreate analyzer
        // ONLY if enabled
        if (!isEnabled) {
            if (analyzerRef.current) {
                analyzerRef.current.stop();
                analyzerRef.current = null;
                setAnalyzerInstance(null);
            }
            return;
        }

        if (audioContext && audioContext.state !== 'closed') {
            // Clean up existing if any (though effect cleanup above handles unmount, logic here handles prop change)
            if (analyzerRef.current) {
                analyzerRef.current.stop();
            }

            analyzerRef.current = new AudioAnalyzer(audioContext);
            setAnalyzerInstance(analyzerRef.current);

            // Apply current settings
            analyzerRef.current.setGain(gain);
            analyzerRef.current.setThreshold(threshold);

            analyzerRef.current.onOnset = (time) => {
                console.log('Onset detected at', time);
                setOnsets(prev => [...prev, time]);
            };

            // If we have a device ID or are just starting, we might want to auto-start? 
            // Current logic waits for startAnalysis() call. 
            // But if we change deviceId while running, we should restart.
            // However, the hook structure rebuilds the *analyzer instance* on deviceId change.
            // We need to verify if the new analyzer is started.
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

    const startAnalysis = useCallback(async () => {
        if (!isEnabled || !analyzerRef.current) return;
        try {
            await analyzerRef.current.start(undefined, deviceId);
            setIsMicReady(true);
            setError(null);
        } catch (e) {
            console.error(e);
            setError('Could not access microphone');
        }
    }, []);

    const stopAnalysis = useCallback(() => {
        analyzerRef.current?.stop();
        setIsMicReady(false);
    }, []);

    const clearOnsets = useCallback(() => {
        setOnsets([]);
        setError(null);
    }, []);

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
