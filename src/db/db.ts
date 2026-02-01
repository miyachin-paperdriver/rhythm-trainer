import Dexie, { type Table } from 'dexie';



export class RhythmTrainerDB extends Dexie {
    sessions!: Table<TrainingSession>;

    constructor() {
        super('RhythmTrainerDB');
        this.version(1).stores({
            sessions: '++id, date, patternId, score'
        });
    }
}

export interface TrainingSession {
    id?: number;
    date: Date;
    patternId: string;
    bpm: number;
    durationSeconds: number;
    score: number; // 0-100
    rank?: string; // S, A, B...
    accuracy: number; // Avg absolute offset (ms)
    stdDev: number; // Standard Deviation (ms)
    noteCount: number;
    stats: {
        earlyCount: number;
        lateCount: number;
        perfectCount: number;
    };
}

export const db = new RhythmTrainerDB();
