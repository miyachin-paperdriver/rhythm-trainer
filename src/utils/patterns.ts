export type Hand = 'R' | 'L';
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
