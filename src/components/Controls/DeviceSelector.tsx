import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeviceSelectorProps {
    selectedDeviceId: string | undefined;
    onDeviceChange: (deviceId: string) => void;
    disabled?: boolean;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
    selectedDeviceId,
    onDeviceChange,
    disabled = false
}) => {
    const { t } = useTranslation();
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        const getDevices = async () => {
            try {
                // Ensure permission is granted first to get labels
                // (Usually permission is already granted by the time this component is shown)
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
                setDevices(audioInputs);
            } catch (e) {
                console.error('Error enumerating devices:', e);
            }
        };

        getDevices();

        // Listen for changes (e.g. plugging in headphones)
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, []);

    if (devices.length === 0) return null;

    return (
        <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: '0.3rem' }}>
                {t('settings.input_device')}
            </label>
            <select
                value={selectedDeviceId || ''}
                onChange={(e) => onDeviceChange(e.target.value)}
                disabled={disabled}
                style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '0.9rem'
                }}
            >
                {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${devices.indexOf(device) + 1}`}
                    </option>
                ))}
            </select>
            {devices.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', marginTop: '0.2rem' }}>
                    {t('settings.input_device_desc')}
                </div>
            )}
        </div>
    );
};
