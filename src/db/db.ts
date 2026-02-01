import Dexie, { type Table } from 'dexie';

export interface TrainingSession {
    id?: number;
    date: Date;
    patternId: string;
    bpm: number;
    durationSeconds: number;
    score: number; // 0-100 or specific metric
    accuracy: number; // e.g. Average absolute offset in ms
    noteCount: number;
    stats: {
        earlyCount: number;
        lateCount: number;
        perfectCount: number;
    };
    // We could store raw onsets if needed, but maybe just summary for now to save space
    // or store as blob/array if detailed analysis needed later.
}

export class RhythmTrainerDB extends Dexie {
    sessions!: Table<TrainingSession>;

    constructor() {
        super('RhythmTrainerDB');
        this.version(1).stores({
            sessions: '++id, date, patternId, score'
        });
    }
}

export const db = new RhythmTrainerDB();
