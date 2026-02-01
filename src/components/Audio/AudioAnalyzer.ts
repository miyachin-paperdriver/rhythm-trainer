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

    public async start() {
        if (this.isRunning) return;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

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

        this.analyser.getFloatTimeDomainData(this.inputBuffer as any);

        // Simple energy-based onset detection
        // Calculate RMS (Root Mean Square)
        let sum = 0;
        for (let i = 0; i < this.inputBuffer.length; i++) {
            sum += this.inputBuffer[i] * this.inputBuffer[i];
        }
        const rms = Math.sqrt(sum / this.inputBuffer.length);

        if (rms > this.threshold) {
            const now = this.audioContext.currentTime;
            if (now - this.lastOnset > this.minInterOnsetInterval) {
                this.lastOnset = now;
                if (this.onOnset) {
                    this.onOnset(now);
                }
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.analyzeLoop());
    }
}
