export class AudioAnalyzer {
    public audioContext: AudioContext;
    public mediaStream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    public analyser: AnalyserNode | null = null;
    private gainNode: GainNode | null = null;
    private filterNode: BiquadFilterNode | null = null;
    private inputBuffer: Float32Array | null = null;

    // Onset detection parameters
    private readonly bufferSize = 2048;
    private threshold = 0.05; // Default lower threshold since we have clean signal
    public currentGain = 5.0; // Default 5x gain
    private lastOnset: number = 0;
    private minInterOnsetInterval = 0.1; // 100ms debounce

    // For UI visualization
    public currentLevel: number = 0;

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
                        autoGainControl: false,
                        // Try to hint for low latency/raw audio
                        latency: 0,
                        channelCount: 1
                    } as any,
                    video: false
                });
            }

            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;

            // Create filter and gain nodes
            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'highpass';
            this.filterNode.frequency.value = 150; // Cut low rumble

            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.currentGain;

            // Connect: Source -> Filter -> Gain -> Analyser
            this.source.connect(this.filterNode);
            this.filterNode.connect(this.gainNode);
            this.gainNode.connect(this.analyser);

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

        // Disconnect nodes to avoid memory leaks
        if (this.source) this.source.disconnect();
        if (this.filterNode) this.filterNode.disconnect();
        if (this.gainNode) this.gainNode.disconnect();

        this.source = null;
        this.filterNode = null;
        this.gainNode = null;

        console.log('Audio analysis stopped');
    }

    public setGain(value: number) {
        this.currentGain = value;
        if (this.gainNode) {
            this.gainNode.gain.value = value;
        }
    }

    public setThreshold(value: number) {
        this.threshold = value;
    }

    private analyzeLoop() {
        if (!this.isRunning || !this.analyser || !this.inputBuffer) return;

        this.analyser.getFloatTimeDomainData(this.inputBuffer as any);

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

        this.currentLevel = peakAmplitude;

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
