export class AudioAnalyzer {
    public audioContext: AudioContext;
    public mediaStream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    public analyser: AnalyserNode | null = null;
    private inputBuffer: Float32Array | null = null;

    // Onset detection parameters
    private readonly bufferSize = 2048;
    private readonly threshold = 0.15; // Simple energy threshold
    private lastOnset: number = 0;
    private minInterOnsetInterval = 0.1; // 100ms debounce

    // Callback when a hit is detected
    public onOnset: ((time: number) => void) | null = null;

    private isRunning: boolean = false;
    private animationFrameId: number | null = null;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
    }

    public async start(stream?: MediaStream) {
        if (this.isRunning) return;

        try {
            if (stream) {
                this.mediaStream = stream;
            } else {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    },
                    video: false
                });
            }

            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;

            this.source.connect(this.analyser);

            this.inputBuffer = new Float32Array(this.analyser.fftSize);
            this.isRunning = true;
            this.analyzeLoop();

            console.log('Audio analysis started');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            throw err;
        }
    }

    public stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        console.log('Audio analysis stopped');
    }

    private analyzeLoop() {
        if (!this.isRunning || !this.analyser || !this.inputBuffer) return;

        this.analyser.getFloatTimeDomainData(this.inputBuffer);

        // Find peak amplitude and its index
        let peakAmplitude = 0;
        let peakIndex = 0;
        let sum = 0;

        for (let i = 0; i < this.inputBuffer.length; i++) {
            const abs = Math.abs(this.inputBuffer[i]);
            if (abs > peakAmplitude) {
                peakAmplitude = abs;
                peakIndex = i;
            }
            sum += abs * abs;
        }

        const rms = Math.sqrt(sum / this.inputBuffer.length);

        // Use peak amplitude for threshold check as it's more sensitive for sharp clicks
        // But keep RMS for general noise gate if needed. 
        // For now, let's Stick to RMS or Peak? 
        // The user complained about double detections.
        // Let's use a hybrid: Threshold check.

        if (peakAmplitude > this.threshold) {
            const now = this.audioContext.currentTime;

            // Calculate precise time:
            // The buffer represents the *past* window of audio.
            // The last sample (index 2047) is "now".
            // The sample at peakIndex is (2048 - peakIndex) samples ago.
            const samplesAgo = this.inputBuffer.length - peakIndex;
            const latencyInSeconds = samplesAgo / this.audioContext.sampleRate;
            const onsetTime = now - latencyInSeconds;

            if (onsetTime - this.lastOnset > this.minInterOnsetInterval) {
                this.lastOnset = onsetTime;
                if (this.onOnset) {
                    this.onOnset(onsetTime);
                }
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.analyzeLoop());
    }
}
