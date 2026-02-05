import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Note, MeasureData } from '../../utils/patterns';
import { db, type CustomPattern } from '../../db/db';

// import images
import noteQuarter from '../../assets/note_quarter.png';
import noteEighth from '../../assets/note_eighth.png';
import noteTriplet from '../../assets/note_triplet.png';
import noteSixteenth from '../../assets/note_sixteenth.png';

const subdivisionImages: Record<number, string> = {
    1: noteQuarter,
    2: noteEighth,
    3: noteTriplet,
    4: noteSixteenth
};

type SubdivisionType = 1 | 2 | 3 | 4;

interface PatternEditorProps {
    initialPattern?: CustomPattern;
    onSave: (pattern: CustomPattern) => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

// デフォルトの空の小節を生成
const createEmptyMeasure = (subdivision: SubdivisionType = 1): MeasureData => ({
    subdivision,
    notes: Array(4 * subdivision).fill('R') as Note[]
});

// デフォルトのパターンを生成（4小節）
const createDefaultPattern = (): MeasureData[] => {
    return [
        createEmptyMeasure(1),
        createEmptyMeasure(1),
        createEmptyMeasure(1),
        createEmptyMeasure(1)
    ];
};

// シンプルなプレビュー用AudioContext
const createPreviewEngine = () => {
    let audioContext: AudioContext | null = null;
    let isPlaying = false;
    let timeoutIds: number[] = [];

    const stop = async () => {
        isPlaying = false;
        timeoutIds.forEach(id => clearTimeout(id));
        timeoutIds = [];
        if (audioContext) {
            try {
                await audioContext.close();
            } catch (e) {
                console.warn('AudioContext close error:', e);
            }
            audioContext = null;
        }
    };

    const play = async (measures: MeasureData[], bpm: number = 100) => {
        await stop(); // 既存の再生を停止

        audioContext = new AudioContext(); // 新しいコンテキスト
        isPlaying = true;

        const secondsPerBeat = 60.0 / bpm;
        let currentTime = audioContext.currentTime + 0.1;

        measures.forEach(measure => {
            const secondsPerNote = secondsPerBeat / measure.subdivision;

            measure.notes.forEach((note, noteIdx) => {
                if (note !== '-') {
                    const time = currentTime + (noteIdx * secondsPerNote);
                    // R: 880Hz, L: 440Hz (区別しやすく)
                    const freq = note === 'R' ? 880 : 440;

                    const osc = audioContext!.createOscillator();
                    const gain = audioContext!.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext!.destination);

                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, time);
                    gain.gain.linearRampToValueAtTime(0.5, time + 0.005);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

                    osc.start(time);
                    osc.stop(time + 0.15);
                }
            });

            currentTime += 4 * secondsPerNote;
        });

        // 再生終了後にstop
        const totalDuration = measures.reduce((sum, m) => sum + (4 * secondsPerBeat / m.subdivision * m.notes.length), 0);
        const timeoutId = window.setTimeout(() => {
            stop();
        }, totalDuration * 1000 + 200);
        timeoutIds.push(timeoutId);
    };

    return { play, stop, isPlaying: () => isPlaying };
};

export const PatternEditor: React.FC<PatternEditorProps> = ({
    initialPattern,
    onSave,
    onCancel,
    onDirtyChange
}) => {
    const [name, setName] = useState(initialPattern?.name || '');
    const [measures, setMeasures] = useState<MeasureData[]>(
        initialPattern?.measures || createDefaultPattern()
    );
    const [cursorPosition, setCursorPosition] = useState<{ measure: number; note: number }>({
        measure: 0,
        note: 0
    });
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const previewEngineRef = useRef(createPreviewEngine());

    // マークダーティ
    const markDirty = useCallback(() => {
        if (!isDirty) {
            setIsDirty(true);
            onDirtyChange?.(true);
        }
    }, [isDirty, onDirtyChange]);

    // 小節数を変更（2小節ずつ）
    const changeMeasureCount = useCallback((delta: number) => {
        setMeasures(prev => {
            const newCount = Math.max(2, prev.length + delta);
            if (newCount > prev.length) {
                return [...prev, createEmptyMeasure(1), createEmptyMeasure(1)];
            } else if (newCount < prev.length && prev.length > 2) {
                return prev.slice(0, -2);
            }
            return prev;
        });
        markDirty();
    }, [markDirty]);

    // 小節のSubdivisionを変更
    const changeMeasureSubdivision = useCallback((measureIndex: number, subdivision: SubdivisionType) => {
        setMeasures(prev => {
            const newMeasures = [...prev];
            const oldNotes = newMeasures[measureIndex].notes;
            const newNotesCount = 4 * subdivision;

            const newNotes: Note[] = [];
            for (let i = 0; i < newNotesCount; i++) {
                if (i < oldNotes.length) {
                    newNotes.push(oldNotes[i]);
                } else {
                    newNotes.push('R');
                }
            }

            newMeasures[measureIndex] = { subdivision, notes: newNotes };
            return newMeasures;
        });
        markDirty();
    }, [markDirty]);

    // ノートを変更
    const setNote = useCallback((measureIndex: number, noteIndex: number, note: Note) => {
        setMeasures(prev => {
            const newMeasures = [...prev];
            const newNotes = [...newMeasures[measureIndex].notes];
            newNotes[noteIndex] = note;
            newMeasures[measureIndex] = { ...newMeasures[measureIndex], notes: newNotes };
            return newMeasures;
        });
        markDirty();
    }, [markDirty]);

    // ノートをサイクル（R -> L -> - -> R）
    const cycleNote = useCallback((measureIndex: number, noteIndex: number) => {
        setMeasures(prev => {
            const currentNote = prev[measureIndex].notes[noteIndex];
            const nextNote: Note = currentNote === 'R' ? 'L' : currentNote === 'L' ? '-' : 'R';

            const newMeasures = [...prev];
            const newNotes = [...newMeasures[measureIndex].notes];
            newNotes[noteIndex] = nextNote;
            newMeasures[measureIndex] = { ...newMeasures[measureIndex], notes: newNotes };
            return newMeasures;
        });
        markDirty();
    }, [markDirty]);

    // R/L/- ボタンで入力（カーソル進行）
    const inputNote = useCallback((note: Note) => {
        setNote(cursorPosition.measure, cursorPosition.note, note);

        setCursorPosition(prev => {
            const currentMeasure = measures[prev.measure];
            const nextNoteIndex = prev.note + 1;

            if (nextNoteIndex >= currentMeasure.notes.length) {
                const nextMeasure = prev.measure + 1;
                if (nextMeasure >= measures.length) {
                    return { measure: 0, note: 0 };
                }
                return { measure: nextMeasure, note: 0 };
            }
            return { measure: prev.measure, note: nextNoteIndex };
        });
    }, [cursorPosition, measures, setNote]);

    // プレビュー
    const togglePreview = useCallback(async () => {
        if (isPreviewPlaying) {
            await previewEngineRef.current.stop();
            setIsPreviewPlaying(false);
        } else {
            previewEngineRef.current.play(measures, 100);
            setIsPreviewPlaying(true);
            // 終了後に状態を更新
            const totalBeats = measures.reduce((sum, _m) => sum + 4, 0);
            const duration = (totalBeats / 100) * 60 * 1000 + 500;
            setTimeout(() => {
                // 自動停止時はステートのみ更新（engine側はstop済み）
                setIsPreviewPlaying(false);
            }, duration);
        }
    }, [isPreviewPlaying, measures]);

    // クリーンアップ
    useEffect(() => {
        const engine = previewEngineRef.current;
        return () => {
            engine.stop();
        };
    }, []);

    // 保存処理
    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            alert('パターン名を入力してください');
            return;
        }

        const pattern: CustomPattern = {
            ...(initialPattern?.id ? { id: initialPattern.id } : {}),
            name: name.trim(),
            measures,
            createdAt: initialPattern?.createdAt || new Date(),
            updatedAt: new Date()
        };

        try {
            if (initialPattern?.id) {
                await db.custom_patterns.update(initialPattern.id, {
                    name: pattern.name,
                    measures: pattern.measures,
                    updatedAt: pattern.updatedAt
                });
            } else {
                await db.custom_patterns.add(pattern);
            }
            setIsDirty(false);
            onDirtyChange?.(false);
            onSave(pattern);
        } catch (e) {
            console.error('Failed to save pattern', e);
            alert('保存に失敗しました');
        }
    }, [name, measures, initialPattern, onSave, onDirtyChange]);

    // キャンセル（未保存確認）
    const handleCancel = useCallback(() => {
        if (isDirty) {
            if (!confirm('保存されていない変更があります。破棄しますか？')) {
                return;
            }
        }
        previewEngineRef.current.stop();
        onCancel();
    }, [isDirty, onCancel]);

    // Subdivisionオプション
    const subdivisionOptions: { value: SubdivisionType }[] = [
        { value: 1 },
        { value: 2 },
        { value: 3 },
        { value: 4 }
    ];

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '1rem',
            gap: '0.75rem'
        }}>
            {/* ヘッダー: パターン名入力 */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); markDirty(); }}
                    placeholder="パターン名"
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)'
                    }}
                />
                {isDirty && <span style={{ color: 'var(--color-accent)', fontSize: '0.9rem' }}>●</span>}
            </div>

            {/* 小節数コントロール + 入力ボタン */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.6rem',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)'
                }}>
                    <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {measures.length}小節
                    </span>
                    <button
                        onClick={() => changeMeasureCount(-2)}
                        disabled={measures.length <= 2}
                        style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            background: measures.length <= 2 ? 'var(--color-border)' : 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text)',
                            cursor: measures.length <= 2 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        -2
                    </button>
                    <button
                        onClick={() => changeMeasureCount(2)}
                        style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            background: 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text)',
                            cursor: 'pointer'
                        }}
                    >
                        +2
                    </button>
                </div>

                {/* 入力ボタン（R/L/-） */}
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {(['R', 'L', '-'] as Note[]).map(note => (
                        <button
                            key={note}
                            onClick={() => inputNote(note)}
                            style={{
                                width: '48px',
                                height: '40px',
                                fontSize: note === '-' ? '1.3rem' : '1rem',
                                fontWeight: 'bold',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                cursor: 'pointer',
                                background: note === 'R' ? 'var(--color-primary)'
                                    : note === 'L' ? '#ef4444' // 赤色に変更
                                        : 'var(--color-surface-hover)',
                                color: note === '-' ? 'var(--color-text-dim)' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {note}
                        </button>
                    ))}
                </div>
            </div>

            {/* 小節グリッド */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
            }}>
                {measures.map((measure, measureIndex) => (
                    <div
                        key={measureIndex}
                        style={{
                            background: 'var(--color-surface)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.5rem'
                        }}
                    >
                        {/* 小節ヘッダー */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.4rem'
                        }}>
                            <span style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-dim)',
                                fontWeight: 'bold'
                            }}>
                                Bar {measureIndex + 1}
                            </span>

                            {/* Subdivisionセレクタ（画像アイコン） */}
                            <div style={{ display: 'flex', gap: '2px' }}>
                                {subdivisionOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => changeMeasureSubdivision(measureIndex, opt.value)}
                                        style={{
                                            padding: '2px 4px',
                                            background: measure.subdivision === opt.value
                                                ? 'var(--color-primary)'
                                                : 'var(--color-surface-hover)',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '28px',
                                            height: '24px'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                backgroundColor: measure.subdivision === opt.value ? '#fff' : 'var(--color-text)',
                                                maskImage: `url(${subdivisionImages[opt.value]})`,
                                                WebkitMaskImage: `url(${subdivisionImages[opt.value]})`, // for Safari
                                                maskSize: 'contain',
                                                WebkitMaskSize: 'contain',
                                                maskRepeat: 'no-repeat',
                                                WebkitMaskRepeat: 'no-repeat',
                                                maskPosition: 'center',
                                                WebkitMaskPosition: 'center'
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ノートグリッド */}
                        {(() => {
                            // 三連符(subdivision=3)と16分音符(subdivision=4)は2行表示
                            const useTwoRows = measure.subdivision >= 3;
                            const notesPerRow = useTwoRows ? measure.notes.length / 2 : measure.notes.length;

                            const renderNoteButton = (note: Note, noteIndex: number) => {
                                const isCursor = cursorPosition.measure === measureIndex && cursorPosition.note === noteIndex;
                                const isBeatStart = noteIndex % measure.subdivision === 0;

                                return (
                                    <button
                                        key={noteIndex}
                                        onClick={() => {
                                            setCursorPosition({ measure: measureIndex, note: noteIndex });
                                            cycleNote(measureIndex, noteIndex);
                                        }}
                                        style={{
                                            height: '2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: note === '-' ? '0.9rem' : '0.8rem',
                                            fontWeight: 'bold',
                                            borderRadius: '3px',
                                            border: isCursor ? '2px solid var(--color-primary)' : 'none',
                                            cursor: 'pointer',
                                            background: note === 'R'
                                                ? 'rgba(47, 128, 237, 0.6)'
                                                : note === 'L'
                                                    ? '#ef4444' // 赤色に変更
                                                    : 'var(--color-surface-hover)',
                                            color: note === '-' ? 'var(--color-text-dim)' : '#fff',
                                            opacity: isBeatStart ? 1 : 0.7,
                                            boxShadow: isCursor ? '0 0 6px var(--color-primary)' : 'none'
                                        }}
                                    >
                                        {note}
                                    </button>
                                );
                            };

                            if (useTwoRows) {
                                const firstRowNotes = measure.notes.slice(0, notesPerRow);
                                const secondRowNotes = measure.notes.slice(notesPerRow);
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${notesPerRow}, 1fr)`,
                                            gap: '3px'
                                        }}>
                                            {firstRowNotes.map((note, idx) => renderNoteButton(note, idx))}
                                        </div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${notesPerRow}, 1fr)`,
                                            gap: '3px'
                                        }}>
                                            {secondRowNotes.map((note, idx) => renderNoteButton(note, notesPerRow + idx))}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${measure.notes.length}, 1fr)`,
                                    gap: '3px'
                                }}>
                                    {measure.notes.map((note, noteIndex) => renderNoteButton(note, noteIndex))}
                                </div>
                            );
                        })()}
                    </div>
                ))}
            </div>

            {/* プレビュー・保存・キャンセル */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--color-border)'
            }}>
                <button
                    onClick={togglePreview}
                    style={{
                        padding: '0.6rem 0.8rem',
                        background: isPreviewPlaying ? 'var(--color-accent)' : 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {isPreviewPlaying ? '⏹' : '▶'}
                </button>
                <button
                    onClick={handleCancel}
                    style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    キャンセル
                </button>
                <button
                    onClick={handleSave}
                    style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: 'var(--color-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    保存
                </button>
            </div>
        </div>
    );
};
