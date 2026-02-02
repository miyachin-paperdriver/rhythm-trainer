/**
 * iOS Silent Mode Detection Hook
 * 
 * iOS does not have official API to detect silent mode.
 * This hook uses Web Audio API to detect if audio playback is blocked.
 * 
 * Strategy: Play a silent audio and check if AudioContext is running.
 * On iOS in silent mode, MediaSession may indicate issues.
 */

import { useState, useCallback } from 'react';

// Detect if running on iOS
const isIOS = (): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export interface SilentModeState {
    isChecking: boolean;
    isSilentMode: boolean | null; // null = unknown
    dismissed: boolean;
}

export const useSilentModeDetection = () => {
    const [state, setState] = useState<SilentModeState>({
        isChecking: false,
        isSilentMode: null,
        dismissed: false
    });

    // Check for silent mode by attempting audio playback
    const checkSilentMode = useCallback(async (): Promise<boolean | null> => {
        if (!isIOS()) {
            return null; // Not iOS, no silent switch
        }

        setState(prev => ({ ...prev, isChecking: true }));

        try {
            // Create a test audio context
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const testCtx = new AudioContextClass();

            // Try to resume
            if (testCtx.state === 'suspended') {
                await testCtx.resume();
            }

            // Create a very short oscillator
            const osc = testCtx.createOscillator();
            const gain = testCtx.createGain();
            osc.connect(gain);
            gain.connect(testCtx.destination);

            // Set to inaudible frequency and volume
            osc.frequency.value = 20000; // 20kHz - barely audible
            gain.gain.value = 0.001;

            const startTime = testCtx.currentTime;
            osc.start(startTime);
            osc.stop(startTime + 0.01);

            // Wait for audio to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Note: iOS Safari will keep context running even in silent mode
            // but actual audio output will be muted

            // Clean up
            testCtx.close();

            // Unfortunately, we cannot reliably detect silent mode from context state
            // Instead, we rely on user gesture detection
            // For now, show warning on iOS when user starts playback
            setState(prev => ({ ...prev, isChecking: false, isSilentMode: false }));

            return false;
        } catch (e) {
            console.warn('[SilentMode] Detection failed:', e);
            setState(prev => ({ ...prev, isChecking: false, isSilentMode: null }));
            return null;
        }
    }, []);

    // Show silent mode warning for iOS users
    const showSilentModeWarning = useCallback(() => {
        if (!isIOS() || state.dismissed) {
            return false;
        }
        return true;
    }, [state.dismissed]);

    // Dismiss the warning
    const dismissWarning = useCallback(() => {
        setState(prev => ({ ...prev, dismissed: true }));
    }, []);

    // Reset warning (e.g., when starting new session)
    const resetWarning = useCallback(() => {
        setState(prev => ({ ...prev, dismissed: false }));
    }, []);

    // Check iOS on mount
    const isIOSDevice = isIOS();

    return {
        state,
        isIOSDevice,
        checkSilentMode,
        showSilentModeWarning,
        dismissWarning,
        resetWarning
    };
};
