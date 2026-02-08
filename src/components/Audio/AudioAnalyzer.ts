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

    private isStopping: boolean = false;

    public async start(stream?: MediaStream, deviceId?: string) {
        if (this.isRunning) return;
        this.isStopping = false;

        try {
            console.log('[AudioAnalyzer] Starting analysis...');

            // Ensure any previous stream is stopped
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            let activeStream = stream;

            if (!activeStream) {
                const constraints: MediaStreamConstraints = {
                    audio: {
                        echoCancellation: false, // We want raw input usually
                        noiseSuppression: false,
                        autoGainControl: false,
                        deviceId: deviceId ? { exact: deviceId } : undefined
                    },
                    video: false
                };

                activeStream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            // RACE CONDITION CHECK:
            // If stop() was called while we were awaiting getUserMedia, abort now.
            if (this.isStopping) {
                console.warn('[AudioAnalyzer] Start aborted because stop() was called.');
                if (activeStream && !stream) {
                    // Only stop if WE created it. If passed in, caller manages it? 
                    // Verify contract: if passed in, we take ownership? Usually yes.
                    activeStream.getTracks().forEach(t => t.stop());
                }
                return;
            }

            this.mediaStream = activeStream;

            // Check context state
            if (this.audioContext.state === 'closed') {
                console.warn('[AudioAnalyzer] Context is closed, cannot create MediaStreamSource.');
                return;
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
        console.log('[AudioAnalyzer] Stopping analysis...');
        this.isStopping = true; // Signal pending start to abort
        this.isRunning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log('Track stopped:', track.label);
            });
            this.mediaStream = null;
        }

        // Disconnect nodes to avoid memory leaks
        try {
            if (this.source) { this.source.disconnect(); this.source = null; }
            if (this.filterNode) { this.filterNode.disconnect(); this.filterNode = null; }
            if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
        } catch (e) {
            console.warn('Error disconnecting nodes:', e);
        }

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
