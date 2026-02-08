import { useState, useEffect } from 'react';

/**
 * Hook to automatically select the internal microphone (Speakerphone) on Android
 * when in Bluetooth Headphone mode, to prevent HFP/Call Mode activation.
 */
export const useInternalMicSelection = (
    outputMode: 'speaker' | 'headphone',
    currentDeviceId: string | undefined,
    onSelectDevice: (deviceId: string) => void,
    isMicReady: boolean // Permission indicator
) => {
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        // Only run if we are in headphone mode and haven't scanned/selected yet
        // OR if permissions just became ready
        // Run for both speaker and headphone modes as user requested
        // if (outputMode !== 'headphone') { ... }

        if (scanned && currentDeviceId) return; // Already handled

        const autoSelectInternal = async () => {
            try {
                // Determine if we have permission by checking labels
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');

                const hasPermission = audioInputs.some(d => d.label.length > 0);
                if (!hasPermission) return; // Wait for permission

                // Find candidate
                // Priorities: "Speakerphone" (Android specific often) > "Phone" > "Internal" > "Built-in"
                const candidate = audioInputs.find(d => {
                    const l = d.label.toLowerCase();
                    return l.includes('speakerphone') ||
                        l.includes('phone') ||
                        l.includes('internal') ||
                        l.includes('built-in');
                });

                if (candidate) {
                    console.log('[AutoMic] Found Internal Candidate:', candidate.label);
                    if (currentDeviceId !== candidate.deviceId) {
                        onSelectDevice(candidate.deviceId);
                    }
                }
                setScanned(true);

            } catch (e) {
                console.error('[AutoMic] Error scanning devices', e);
            }
        };

        // If mic is ready (permission granted), try immediately
        if (isMicReady) {
            autoSelectInternal();
        } else {
            // Or try periodically or listen to devicechange?
            // For now, reliance on isMicReady is good.
        }

        // Listen for device changes (plugging in headphones might reveal new routing options)
        const handleChange = () => {
            if (outputMode === 'headphone') autoSelectInternal();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleChange);

    }, [outputMode, isMicReady, currentDeviceId, onSelectDevice, scanned]);
};
