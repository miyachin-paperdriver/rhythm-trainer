export type Subdivision = 1 | 2 | 3 | 4; // 1=Quarter, 2=8th, 3=Triplet, 4=16th

export class MetronomeEngine {
    public audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private bpm: number = 120;
    private subdivision: Subdivision = 1;

    // Gap Click Configuration
    private gapClickEnabled: boolean = false;
    private playBars: number = 4;
    private muteBars: number = 4;

    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // s
    private nextNoteTime: number = 0.0;
    private timerID: number | undefined;

    private beatNumber: number = 0; // 0..3 (for 4/4)
    private subBeatNumber: number = 0; // 0..subdivision-1
    private MeasureNumber: number = 0;
    private stepNumber: number = 0; // Total beats (Quarter notes)
    private tickIndex: number = 0; // Grand total of scheduled ticks (subdivisions)

    private onTick: ((beat: number, time: number, step: number, isMuted: boolean, isCountIn: boolean, subBeat: number, tickIndex: number) => void) | null = null;

    constructor(onTick?: (beat: number, time: number, step: number, isMuted: boolean, isCountIn: boolean, subBeat: number, tickIndex: number) => void) {
        if (onTick) this.onTick = onTick;
    }

    public init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    public async start() {
        if (this.isPlaying) return;
        this.init();

        // 1. Force unlock immediately within user gesture (Sync)
        this.unlockAudioContext();

        // 2. Resume context
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }

        // 3. Workaround for "fade-in" effect: wait a bit for hardware to fully unmute
        // Increasing to 600ms to ensure first beat is audible. Buffer maintains activity.
        await new Promise(r => setTimeout(r, 600));

        this.isPlaying = true;
        this.beatNumber = 0;
        this.subBeatNumber = 0;
        this.MeasureNumber = -1; // Start with 1 bar count-in
        this.stepNumber = -4; // Assuming 4/4
        this.tickIndex = -(4 * this.subdivision);
        this.nextNoteTime = this.audioContext!.currentTime + 0.1;
        this.scheduler();
    }

    private unlockAudioContext() {
        if (!this.audioContext) return;
        // Create a buffer of 0.5s silence (Reverted from noise)
        const length = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);

        // Also trigger HTML5 Audio to bypass Silent Switch (iOS)
        this.bypassSilentSwitch();
    }

    private bypassSilentSwitch() {
        // Play a tiny silent file to force the Audio Session category to 'Playback'
        // appending to DOM might help with iOS persistence
        const audio = document.createElement('audio');
        audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjkxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA//OEZAAAAAABIAAAACABHAAAAAAAAAAAAAA';
        audio.volume = 0.01;
        audio.style.display = 'none';
        document.body.appendChild(audio);

        audio.play().then(() => {
            // Cleanup after a bit? Or keep it? keeping it for a few seconds might be safer.
            setTimeout(() => {
                audio.pause();
                audio.remove();
            }, 3000); // 3 seconds of "playback mode" enforcement
        }).catch(e => {
            console.warn('Silent switch bypass failed', e);
            audio.remove();
        });
    }

    public stop() {
        this.isPlaying = false;
        if (this.timerID) {
            window.clearTimeout(this.timerID);
            this.timerID = undefined;
        }
    }

    public setBpm(bpm: number) { this.bpm = bpm; }
    public getBpm(): number { return this.bpm; }

    public setSubdivision(sub: Subdivision) { this.subdivision = sub; }
    public setGapClick(enabled: boolean, play: number, mute: number) {
        this.gapClickEnabled = enabled;
        this.playBars = play;
        this.muteBars = mute;
    }

    public setOnTick(callback: (beat: number, time: number, step: number, isMuted: boolean, isCountIn: boolean, subBeat: number, tickIndex: number) => void) {
        this.onTick = callback;
    }

    private scheduler() {
        while (this.nextNoteTime < this.audioContext!.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.beatNumber, this.subBeatNumber, this.nextNoteTime);
            this.nextNote();
        }
        if (this.isPlaying) {
            this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    private nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        const secondsPerSub = secondsPerBeat / this.subdivision;

        this.nextNoteTime += secondsPerSub;

        // Advance counters
        this.tickIndex++;
        this.subBeatNumber++;

        if (this.subBeatNumber >= this.subdivision) {
            this.subBeatNumber = 0;
            this.beatNumber++;
            this.stepNumber++;

            if (this.beatNumber >= 4) { // 4/4 fixed for now
                this.beatNumber = 0;
                this.MeasureNumber++;
            }
        }
    }

    private scheduleNote(beat: number, subBeat: number, time: number) {
        if (!this.audioContext) return;

        const isCountIn = this.MeasureNumber < 0;

        // Gap Click Logic (Mute check) - ONLY if not count-in
        let isMuted = false;
        if (!isCountIn && this.gapClickEnabled) {
            const cycle = this.playBars + this.muteBars;
            const pos = this.MeasureNumber % cycle;
            if (pos >= this.playBars) {
                isMuted = true;
            }
        }

        // Trigger onTick for EVERY scheduled note (beat or subdivision)
        if (this.onTick) {
            this.onTick(beat, time, this.stepNumber, isMuted, isCountIn, subBeat, this.tickIndex);
        }

        if (isMuted) return; // Don't play sound

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Frequency
        if (isCountIn) {
            // Distinct count-in sound (e.g. higher pitch tick for all beats)
            osc.frequency.value = 1000;
        } else {
            if (beat === 0 && subBeat === 0) {
                osc.frequency.value = 880; // Downbeat
            } else if (subBeat === 0) {
                osc.frequency.value = 440; // Quarter note
            } else {
                osc.frequency.value = 220; // Subdivision
            }
        }

        // Volume Adjustment for subdivisions
        // subBeat 0 is louder, others slightly quieter
        const volume = subBeat === 0 ? 1 : 0.5;

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(volume, time + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.06);
    }
}
