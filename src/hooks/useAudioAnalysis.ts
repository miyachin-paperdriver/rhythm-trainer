import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioAnalyzer } from '../components/Audio/AudioAnalyzer';

interface UseAudioAnalysisProps {
    audioContext: AudioContext | null;
}

export const useAudioAnalysis = ({ audioContext }: UseAudioAnalysisProps) => {
    const analyzerRef = useRef<AudioAnalyzer | null>(null);
    const [isMicReady, setIsMicReady] = useState(false);
    const [onsets, setOnsets] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (audioContext && !analyzerRef.current) {
            analyzerRef.current = new AudioAnalyzer(audioContext);

            analyzerRef.current.onOnset = (time) => {
                console.log('Onset detected at', time);
                setOnsets(prev => [...prev.slice(-10), time]); // Keep last 10
            };
        }
    }, [audioContext]);

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

    // Auto start/stop based on playback or manual? 
    // Probably manual "Enable Mic" is safer first, then auto with playback.
    // For now we expose start/stop manually.

    return {
        isMicReady,
        startAnalysis,
        stopAnalysis,
        onsets,
        error,
        mediaStream: analyzerRef.current?.mediaStream || null
    };
};
