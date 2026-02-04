export type Hand = 'R' | 'L';
export type Note = 'R' | 'L' | '-';  // '-' = 休符
export type Subdivision = 1 | 2 | 3 | 4; // 1=Quarter, 2=8th, 3=Triplet, 4=16th

// 小節のデータ構造
export interface MeasureData {
    subdivision: Subdivision;
    notes: Note[];  // 配列長 = 4 * subdivision
}

// 拡張パターン型（プリセット・カスタム両対応）
export interface ExtendedPattern {
    id: string;
    name: string;
    isPreset: boolean;
    // 従来形式（プリセット互換）
    sequence?: Hand[];
    // 拡張形式（カスタムパターン用）
    measures?: MeasureData[];
    createdAt?: Date;
    updatedAt?: Date;
}

export type Pattern = {
    id: string;
    name: string;
    sequence: Hand[];
};

export const PATTERNS: Pattern[] = [
    {
        id: 'single-stroke',
        name: 'Single Stroke Roll',
        sequence: ['R', 'L', 'R', 'L']
    },
    {
        id: 'double-stroke',
        name: 'Double Stroke Roll',
        sequence: ['R', 'R', 'L', 'L']
    },
    {
        id: 'paradiddle',
        name: 'Single Paradiddle',
        sequence: ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L']
    },
    {
        id: 'double-paradiddle',
        name: 'Double Paradiddle',
        sequence: ['R', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'L']
    },
    {
        id: 'paradiddle-diddle',
        name: 'Paradiddle-diddle',
        sequence: ['R', 'L', 'R', 'R', 'L', 'L']
    }
];

// プリセットをExtendedPattern形式に変換
export const PRESET_PATTERNS: ExtendedPattern[] = PATTERNS.map(p => ({
    ...p,
    isPreset: true
}));

// ヘルパー関数: PatternからMeasureData配列に変換
export function patternToMeasures(pattern: Pattern, subdivision: Subdivision = 1): MeasureData[] {
    const notesPerMeasure = 4 * subdivision;
    const totalNotes = pattern.sequence.length;
    const measureCount = Math.ceil(totalNotes / notesPerMeasure);

    const measures: MeasureData[] = [];
    for (let i = 0; i < measureCount; i++) {
        const notes: Note[] = [];
        for (let j = 0; j < notesPerMeasure; j++) {
            const idx = i * notesPerMeasure + j;
            notes.push(pattern.sequence[idx % totalNotes] as Note);
        }
        measures.push({ subdivision, notes });
    }
    return measures;
}

// ヘルパー関数: MeasureData配列からシーケンス（R/L/-）を取得
export function measuresToSequence(measures: MeasureData[]): Note[] {
    return measures.flatMap(m => m.notes);
}

// ヘルパー関数: パターンが2小節未満、または奇数小節数の場合に展開する
export function expandPattern(measures: MeasureData[]): MeasureData[] {
    if (measures.length === 0) return [];

    let expanded = [...measures];

    // 1. 少なくとも2小節にする
    while (expanded.length < 2) {
        expanded = [...expanded, ...measures];
    }

    // 2. 偶数小節にする
    if (expanded.length % 2 !== 0) {
        // 元のパターンをもう一度追加すれば必ず偶数になるか？
        // 元が奇数(3) -> 3繰り返すのはダメ。単純に倍にすれば偶数になる。
        // 元が1 -> step1で2になっている(偶数)。
        // 元が3 -> step1スキップ -> step2で倍にして6(偶数)。
        // 元のパターン単位で追加するほうが自然だが、
        // 元のパターン単位で追加するほうが自然だが、
        // step1で既に展開されている可能性があるので、現在のexpanded全体をもう一度繰り返すのが手っ取り早い
        expanded = [...expanded, ...expanded];
    }

    return expanded;
}
