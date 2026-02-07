import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioAnalyzer } from '../components/Audio/AudioAnalyzer';

interface UseAudioAnalysisProps {
    audioContext: AudioContext | null;
    gain?: number;
    threshold?: number;
}

export const useAudioAnalysis = ({ audioContext, gain = 5.0, threshold = 0.1 }: UseAudioAnalysisProps) => {
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
        }
    }, [audioContext]); // Re-run when context changes

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
        if (!analyzerRef.current) return;
        try {
            await analyzerRef.current.start();
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

    return {
        isMicReady,
        startAnalysis,
        stopAnalysis,
        clearOnsets,
        onsets,
        error,
        mediaStream: analyzerRef.current?.mediaStream || null,
        analyzer: analyzerInstance // Expose instance for direct level access
    };
};
