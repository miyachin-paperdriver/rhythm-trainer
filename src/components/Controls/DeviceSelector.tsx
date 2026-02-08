import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeviceSelectorProps {
    selectedDeviceId: string | undefined;
    onDeviceChange: (deviceId: string) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({ selectedDeviceId, onDeviceChange }) => {
    const { t } = useTranslation();
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [permissionGranted, setPermissionGranted] = useState(false);

    useEffect(() => {
        const getDevices = async () => {
            try {
                // We need permission to get labels
                // If not already granted, this might return empty labels or fail
                // We assume parent handles permission via startAnalysis usually, 
                // but checking devices might require a provisional permission request?
                // For now, just enumerate.
                const devs = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devs.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);

                // Check if we have labels. If not, we might not have permission yet.
                const hasLabels = audioInputs.some(d => d.label.length > 0);
                setPermissionGranted(hasLabels);

            } catch (e) {
                console.error("Error enumerating devices:", e);
            }
        };

        getDevices();

        // Listen for changes (plugging in headphones etc.)
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, []);

    if (devices.length === 0) return null;

    return (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--color-text)', display: 'flex', justifyContent: 'space-between' }}>
                {t('settings.input_device') || "Input Device"}
                {!permissionGranted && <span style={{ fontSize: '0.7em', color: 'orange' }}>(Need Mic Permission)</span>}
            </label>
            <select
                value={selectedDeviceId || ''}
                onChange={(e) => onDeviceChange(e.target.value)}
                style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '0.9rem',
                    width: '100%'
                }}
            >
                <option value="">Default</option>
                {devices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                    </option>
                ))}
            </select>
        </div>
    );
};
