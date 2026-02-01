import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = () => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [startTime, setStartTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const startRecording = useCallback((stream: MediaStream, currentTime: number) => {
        chunksRef.current = [];
        setAudioBlob(null);
        setStartTime(currentTime);

        try {
            // Detect supported MIME type
            let mimeType = '';
            // Safari/iOS prefers mp4/aac. Chrome prefers webm/ogg.
            const types = ['audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav'];
            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            // Fallback or specific options
            const options = mimeType ? { mimeType } : undefined;
            const recorder = new MediaRecorder(stream, options);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                // Use actual mimeType from recorder if available
                const finalType = recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: finalType });
                setAudioBlob(blob);
                setDuration((Date.now() - timestampRef.current) / 1000);
            };

            mediaRecorderRef.current = recorder;
            recorder.start();
            timestampRef.current = Date.now();
        } catch (e) {
            console.error('Failed to start recorder', e);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const timestampRef = useRef(0);

    return {
        startRecording,
        stopRecording,
        audioBlob,
        startTime,
        duration
    };
};
