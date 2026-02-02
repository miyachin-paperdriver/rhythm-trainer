import Dexie, { type Table } from 'dexie';
import type { MeasureData } from '../utils/patterns';

export class RhythmTrainerDB extends Dexie {
    sessions!: Table<TrainingSession>;
    session_details!: Table<SessionDetail>;
    custom_patterns!: Table<CustomPattern>;

    constructor() {
        super('RhythmTrainerDB');

        // Version 1
        this.version(1).stores({
            sessions: '++id, date, patternId, score'
        });

        // Version 2: Add detailed session storage
        this.version(2).stores({
            session_details: '++id, sessionId'
        });

        // Version 3: Add custom patterns storage
        this.version(3).stores({
            custom_patterns: '++id, name, createdAt'
        });
    }
}

// カスタムパターン
export interface CustomPattern {
    id?: number;
    name: string;
    measures: MeasureData[];
    createdAt: Date;
    updatedAt: Date;
}

// Breakdown stats for a subset (L/R) or total
export interface SessionAnalysisStats {
    score: number;
    rank: string;
    accuracy: number;
    stdDev: number;
    tendency: number;
    hitCount: number;
}

export interface NoteHitDetail {
    index: number;       // Sequencial index of the hit
    timestamp: number;   // Relative time (ms) from session start
    offset: number;      // Timing error in ms
    hand: 'L' | 'R';     // Hand used
    // Potential future fields: expectedTime, subdivision, etc.
}

export interface SessionDetail {
    id?: number;
    sessionId: number;   // Foreign Key to sessions.id
    hits: NoteHitDetail[];
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

