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

// Breakdown stats for a subset (L/R) or total
interface SessionAnalysisStats {
    score: number;
    rank: string;
    accuracy: number;
    stdDev: number;
    tendency: number;
    hitCount: number;
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
    tendency?: number; // Avg signed offset (new)
    noteCount: number;
    stats: {
        earlyCount: number;
        lateCount: number;
        perfectCount: number;
    };
    statsL?: SessionAnalysisStats; // New: Left hand stats
    statsR?: SessionAnalysisStats; // New: Right hand stats
}

export const db = new RhythmTrainerDB();
