import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CustomPattern } from '../../db/db';
import { PATTERNS, type Pattern, patternToMeasures } from '../../utils/patterns';
import { PatternEditor } from './PatternEditor';

type EditorState =
    | { mode: 'list' }
    | { mode: 'new' }
    | { mode: 'edit'; pattern: CustomPattern }
    | { mode: 'copy'; sourcePattern: Pattern | CustomPattern };

interface PatternManagerProps {
    onDirtyChange?: (isDirty: boolean) => void;
}

export const PatternManager: React.FC<PatternManagerProps> = ({ onDirtyChange }) => {
    const [editorState, setEditorState] = useState<EditorState>({ mode: 'list' });

    // カスタムパターンをDBから取得
    const customPatterns = useLiveQuery(() => db.custom_patterns.toArray(), []) || [];

    // 新規作成
    const handleNew = () => {
        setEditorState({ mode: 'new' });
    };

    // 編集
    const handleEdit = (pattern: CustomPattern) => {
        setEditorState({ mode: 'edit', pattern });
    };

    // コピー（プリセットまたはカスタムから）
    const handleCopy = (pattern: Pattern | CustomPattern) => {
        setEditorState({ mode: 'copy', sourcePattern: pattern });
    };

    // 削除
    const handleDelete = async (pattern: CustomPattern) => {
        if (!pattern.id) return;
        if (confirm(`"${pattern.name}" を削除しますか？`)) {
            await db.custom_patterns.delete(pattern.id);
        }
    };

    // エディタから戻る
    const handleEditorClose = () => {
        setEditorState({ mode: 'list' });
        onDirtyChange?.(false);
    };

    // 保存完了
    const handleSave = () => {
        setEditorState({ mode: 'list' });
        onDirtyChange?.(false);
    };

    // エディタ表示中
    if (editorState.mode !== 'list') {
        let initialPattern: CustomPattern | undefined;

        if (editorState.mode === 'edit') {
            initialPattern = editorState.pattern;
        } else if (editorState.mode === 'copy') {
            const source = editorState.sourcePattern;
            // プリセットの場合はMeasureDataに変換
            if ('sequence' in source) {
                initialPattern = {
                    name: `${source.name} (コピー)`,
                    measures: patternToMeasures(source),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            } else {
                initialPattern = {
                    ...source,
                    id: undefined,
                    name: `${source.name} (コピー)`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            }
        }

        return (
            <PatternEditor
                initialPattern={initialPattern}
                onSave={handleSave}
                onCancel={handleEditorClose}
                onDirtyChange={onDirtyChange}
            />
        );
    }

    // リスト表示
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '1rem',
            gap: '1rem'
        }}>
            {/* ヘッダー */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    color: 'var(--color-primary)'
                }}>
                    パターン管理
                </h2>
                <button
                    onClick={handleNew}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--color-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    + 新規作成
                </button>
            </div>

            {/* パターンリスト */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
            }}>
                {/* プリセットセクション */}
                <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-dim)',
                    fontWeight: 'bold',
                    padding: '0.5rem 0'
                }}>
                    プリセット
                </div>

                {PATTERNS.map(pattern => (
                    <div
                        key={pattern.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'var(--color-surface)',
                            borderRadius: 'var(--radius-md)',
                            gap: '0.5rem'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
                                {pattern.name}
                            </div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-dim)',
                                fontFamily: 'monospace'
                            }}>
                                {pattern.sequence.join(' ')}
                            </div>
                        </div>

                        {/* コピーボタン（アイコン化） */}
                        <button
                            onClick={() => handleCopy(pattern)}
                            title="コピーして新規作成"
                            style={{
                                padding: '0.5rem',
                                background: 'var(--color-surface-hover)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                ))}

                {/* カスタムパターンセクション */}
                {customPatterns.length > 0 && (
                    <>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--color-text-dim)',
                            fontWeight: 'bold',
                            padding: '0.5rem 0',
                            marginTop: '0.5rem'
                        }}>
                            カスタム
                        </div>

                        {customPatterns.map(pattern => {
                            // パターンシーケンスを表示用に生成
                            const sequence = pattern.measures
                                .flatMap(m => m.notes)
                                .join(' ');

                            // 長すぎる場合は省略
                            const displaySequence = sequence.length > 50
                                ? sequence.slice(0, 50) + '...'
                                : sequence;

                            return (
                                <div
                                    key={pattern.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        background: 'var(--color-surface)',
                                        borderRadius: 'var(--radius-md)',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {pattern.name}
                                        </div>
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--color-text-dim)',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {pattern.measures.length}小節: {displaySequence}
                                        </div>
                                    </div>

                                    {/* 編集・コピー・削除ボタン（アイコン化） */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                        <button
                                            onClick={() => handleEdit(pattern)}
                                            title="編集"
                                            style={{
                                                padding: '0.5rem',
                                                background: 'var(--color-primary)',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleCopy(pattern)}
                                            title="コピー"
                                            style={{
                                                padding: '0.5rem',
                                                background: 'var(--color-surface-hover)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-text)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(pattern)}
                                            title="削除"
                                            style={{
                                                padding: '0.5rem',
                                                background: '#dc3545',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}

                {customPatterns.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--color-text-dim)'
                    }}>
                        カスタムパターンはまだありません。<br />
                        「新規作成」またはプリセットから「コピー」して作成できます。
                    </div>
                )}
            </div>
        </div>
    );
};
