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
    private stepNumber: number = 0; // Total steps (main beats)

    private onTick: ((beat: number, time: number, step: number, isMuted: boolean) => void) | null = null;

    constructor(onTick?: (beat: number, time: number, step: number, isMuted: boolean) => void) {
        if (onTick) this.onTick = onTick;
    }

    public init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    public start() {
        if (this.isPlaying) return;
        this.init();
        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.beatNumber = 0;
        this.subBeatNumber = 0;
        this.MeasureNumber = 0;
        this.stepNumber = 0;
        this.nextNoteTime = this.audioContext!.currentTime + 0.1;
        this.scheduler();
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

    public setOnTick(callback: (beat: number, time: number, step: number, isMuted: boolean) => void) {
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

        // Gap Click Logic (Mute check)
        let isMuted = false;
        if (this.gapClickEnabled) {
            const cycle = this.playBars + this.muteBars;
            const pos = this.MeasureNumber % cycle;
            if (pos >= this.playBars) {
                isMuted = true;
            }
        }

        // Call UI Tick only on main beats? Or all sub-beats?
        // Let's call on all, pass subBeat info? 
        // Existing UI expects (beat, time, step). Step is main beat count.
        // If we call on every sub-beat, currentBeat update might be too fast/weird.
        // BUT we want to hear sub-beats.

        // Trigger onTick ONLY on Main Beats (subBeat == 0) for visualizer sync?
        // Or visualizer might strictly follow steps.
        // PatternVisualizer relies on `stepNumber`.
        // If I callback on subBeat, stepNumber doesn't increment.

        if (subBeat === 0) {
            if (this.onTick) this.onTick(beat, time, this.stepNumber, isMuted);
        }

        if (isMuted) return; // Don't play sound

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Frequency
        if (beat === 0 && subBeat === 0) {
            osc.frequency.value = 880; // Downbeat
        } else if (subBeat === 0) {
            osc.frequency.value = 440; // Quarter note
        } else {
            osc.frequency.value = 220; // Subdivision (High Hat like or lower click)
        }

        // Volume Adjustment for subdivisions
        const volume = subBeat === 0 ? 1 : 0.5;

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(volume, time + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.06);
    }
}
