import type { MeasureData, Note } from '../../utils/patterns';

export type Subdivision = 1 | 2 | 3 | 4; // 1=Quarter, 2=8th, 3=Triplet, 4=16th

// Tick represents one schedulable event with context
interface TickEvent {
    measureIndex: number;
    beatIndex: number;
    subBeatIndex: number;
    subdivision: Subdivision;
    note: Note; // 'R' | 'L' | '-'
    globalTickIndex: number;
}

export class MetronomeEngine {
    public audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;
    private bpm: number = 120;
    private subdivision: Subdivision = 1;

    // Custom Pattern Support
    private patternMeasures: MeasureData[] | null = null;
    private tickSequence: TickEvent[] = [];
    private currentTickIndex: number = 0;

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

    public init(forceRecreate: boolean = false) {
        if (this.audioContext && (forceRecreate || this.audioContext.state === 'closed')) {
            try {
                this.audioContext.close();
            } catch (e) {
                console.warn('[MetronomeEngine] Error closing context:', e);
            }
            this.audioContext = null;
        }

        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContextClass();
        }
    }

    public async start() {
        if (this.isPlaying) return;
        this.init();

        // 1. Force unlock immediately within user gesture (Sync)
        this.unlockAudioContext();

        // [Moved] Start Silent Audio immediately to catch the user gesture
        // This is critical for iOS Silent Mode bypass
        this.startSilentAudio();

        // 2. Resume context with Timeout & Recovery
        if (this.audioContext?.state === 'suspended') {
            try {
                // Race resume against a timeout
                const resumePromise = this.audioContext.resume();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Resume Timeout')), 2000)
                );

                await Promise.race([resumePromise, timeoutPromise]);
                console.log('[MetronomeEngine] AudioContext resumed successfully');
            } catch (e) {
                console.warn('[MetronomeEngine] Resume failed or timed out. Recreating context...', e);
                // Force recreate
                this.init(true);
                await this.audioContext?.resume();
            }
        }



        // 4. Workaround for "fade-in" effect: wait a bit for hardware to fully unmute
        // Increasing to 600ms to ensure first beat is audible. Buffer maintains activity.
        await new Promise(r => setTimeout(r, 600));

        this.isPlaying = true;
        this.beatNumber = 0;
        this.subBeatNumber = 0;
        this.MeasureNumber = -1; // Start with 1 bar count-in
        this.stepNumber = -4; // Assuming 4/4

        // For custom patterns, use first measure's subdivision for count-in
        // Otherwise use global subdivision
        const countInSubdivision = (this.tickSequence.length > 0 && this.patternMeasures && this.patternMeasures.length > 0)
            ? this.patternMeasures[0].subdivision as Subdivision
            : this.subdivision;

        this.tickIndex = -(4 * countInSubdivision);
        this.currentTickIndex = this.tickIndex; // Sync count-in index

        // [FIX] Schedule first note further in future to allow hardware to wake up/unmute
        // 0.1s is too fast for Bluetooth/Android switching. 0.6s ensures 1st beat is heard.
        this.nextNoteTime = this.audioContext!.currentTime + 0.6;
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
    }

    private silentAudio: HTMLAudioElement | null = null;

    private isIOS(): boolean {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    private startSilentAudio() {
        // Only run this hack on iOS
        if (!this.isIOS()) {
            console.log('[MetronomeEngine] Skipping Silent Audio (Not iOS)');
            return;
        }

        if (!this.silentAudio) {
            this.silentAudio = document.createElement('audio');
            // Tiny silent MP3
            this.silentAudio.src = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
            // Important: Loop it so it stays active
            this.silentAudio.loop = true;
            this.silentAudio.volume = 0.01;
            // playsInline might help
            this.silentAudio.setAttribute('playsinline', 'true');
            // display none
            this.silentAudio.style.display = 'none';
            document.body.appendChild(this.silentAudio);
        }

        // Always try to play
        this.silentAudio.play().catch(e => {
            console.warn('[MetronomeEngine] Silent Audio Play Failed:', e);
        });
    }

    private stopSilentAudio() {
        if (this.silentAudio) {
            this.silentAudio.pause();
            this.silentAudio.currentTime = 0;
            // Optionally remove it, or keep it for next time. 
            // Keeping it is safer for reuse, but if we want to clean up:
            // For now, let's keep it in DOM but paused. 
        }
    }

    public stop() {
        this.isPlaying = false;
        if (this.timerID) {
            window.clearTimeout(this.timerID);
            this.timerID = undefined;
        }
        this.stopSilentAudio();
    }

    public async close() {
        this.stop();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
        this.audioContext = null;
    }

    public setBpm(bpm: number) { this.bpm = bpm; }
    public getBpm(): number { return this.bpm; }

    public setSubdivision(sub: Subdivision) { this.subdivision = sub; }
    public setGapClick(enabled: boolean, play: number, mute: number) {
        this.gapClickEnabled = enabled;
        this.playBars = play;
        this.muteBars = mute;
    }

    public setPattern(measures: MeasureData[] | null) {
        this.patternMeasures = measures;
        if (measures && measures.length > 0) {
            this.tickSequence = this.buildTickSequence(measures);
        } else {
            this.tickSequence = [];
        }
        this.currentTickIndex = 0;
    }

    private buildTickSequence(measures: MeasureData[]): TickEvent[] {
        const ticks: TickEvent[] = [];
        let globalIdx = 0;
        for (let measureIdx = 0; measureIdx < measures.length; measureIdx++) {
            const measure = measures[measureIdx];
            const subdivision = measure.subdivision as Subdivision;
            const notesPerBeat = subdivision;
            // 4 beats per measure, notes array length = 4 * subdivision
            for (let beatIdx = 0; beatIdx < 4; beatIdx++) {
                for (let subIdx = 0; subIdx < notesPerBeat; subIdx++) {
                    const noteIndex = beatIdx * notesPerBeat + subIdx;
                    const note = measure.notes[noteIndex] || '-';
                    ticks.push({
                        measureIndex: measureIdx,
                        beatIndex: beatIdx,
                        subBeatIndex: subIdx,
                        subdivision,
                        note,
                        globalTickIndex: globalIdx++
                    });
                }
            }
        }
        return ticks;
    }

    public setOnTick(callback: (beat: number, time: number, step: number, isMuted: boolean, isCountIn: boolean, subBeat: number, tickIndex: number) => void) {
        this.onTick = callback;
    }

    private scheduler() {
        while (this.nextNoteTime < this.audioContext!.currentTime + this.scheduleAheadTime) {
            if (this.tickSequence.length > 0) {
                // Custom pattern mode
                this.schedulePatternNote(this.nextNoteTime);
            } else {
                // Default mode
                this.scheduleNote(this.beatNumber, this.subBeatNumber, this.nextNoteTime);
            }
            this.nextNote();
        }
        if (this.isPlaying) {
            this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    private nextNote() {
        if (this.tickSequence.length > 0) {
            // Custom pattern mode
            const seqLen = this.tickSequence.length;
            const isCountIn = this.MeasureNumber < 0;

            // Get subdivision for timing
            // During count-in, use first measure's subdivision
            // After count-in, use current tick's subdivision
            let currentSubdivision: Subdivision;
            if (isCountIn) {
                currentSubdivision = this.patternMeasures && this.patternMeasures.length > 0
                    ? this.patternMeasures[0].subdivision as Subdivision
                    : this.subdivision;
            } else {
                const safeTickIdx = this.currentTickIndex % seqLen;
                currentSubdivision = this.tickSequence[safeTickIdx].subdivision;
            }

            const secondsPerBeat = 60.0 / this.bpm;
            const secondsPerSub = secondsPerBeat / currentSubdivision;
            this.nextNoteTime += secondsPerSub;

            // Advance counters
            this.currentTickIndex++;
            this.tickIndex++;
            this.subBeatNumber++;

            if (isCountIn) {
                // During count-in, use first measure's subdivision for beat counting
                if (this.subBeatNumber >= currentSubdivision) {
                    this.subBeatNumber = 0;
                    this.beatNumber++;
                    this.stepNumber++;

                    if (this.beatNumber >= 4) {
                        this.beatNumber = 0;
                        this.MeasureNumber++; // Will transition from -1 to 0
                        // Reset currentTickIndex to 0 when count-in ends
                        if (this.MeasureNumber === 0) {
                            this.currentTickIndex = 0;
                        }
                    }
                }
            } else {
                // After count-in, use tick sequence for state
                const nextTickIdx = this.currentTickIndex % seqLen;
                const nextTick = this.tickSequence[nextTickIdx];
                this.beatNumber = nextTick.beatIndex;
                this.subBeatNumber = nextTick.subBeatIndex;
                this.MeasureNumber = nextTick.measureIndex;
            }
        } else {
            // Default mode (presets)
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
    }

    private schedulePatternNote(time: number) {
        if (!this.audioContext) return;

        const isCountIn = this.MeasureNumber < 0;
        const seqLen = this.tickSequence.length;
        const tickIdx = isCountIn ? this.currentTickIndex : (this.currentTickIndex % seqLen);

        // For count-in, we always play. After count-in, use the pattern.
        let note: Note = 'R'; // Default for count-in
        let beat = this.beatNumber;
        let subBeat = this.subBeatNumber;

        if (!isCountIn && this.tickSequence.length > 0) {
            const tick = this.tickSequence[tickIdx];
            note = tick.note;
            beat = tick.beatIndex;
            subBeat = tick.subBeatIndex;
        }

        // Gap Click Logic (Mute check) - ONLY if not count-in
        let isMuted = false;
        if (!isCountIn && this.gapClickEnabled) {
            const cycle = this.playBars + this.muteBars;
            const patternMeasure = Math.floor(this.currentTickIndex / (seqLen / (this.patternMeasures?.length || 1)));
            const pos = patternMeasure % cycle;
            if (pos >= this.playBars) {
                isMuted = true;
            }
        }

        // Trigger onTick for EVERY scheduled note (beat or subdivision)
        if (this.onTick) {
            this.onTick(beat, time, this.stepNumber, isMuted, isCountIn, subBeat, this.tickIndex);
        }

        // Check if rest
        if (note === '-') {
            return; // Don't play sound for rests
        }

        if (isMuted) return; // Don't play sound if muted

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
