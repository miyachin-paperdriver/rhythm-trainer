import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { TrainingSession } from '../../db/db';
import { PATTERNS } from '../../utils/patterns';

export const HistoryView = () => {
    const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray());
    const customPatterns = useLiveQuery(() => db.custom_patterns.toArray()) || [];
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [summaryTab, setSummaryTab] = useState<'total' | 'left' | 'right'>('total');

    if (!sessions || sessions.length === 0) {
        return <div style={{ color: '#888', marginTop: '2rem' }}>No history yet. Start training!</div>;
    }

    const getPatternName = (id: string) => {
        // Check presets
        const preset = PATTERNS.find(p => p.id === id);
        if (preset) return preset.name;

        // Check custom patterns (id might be string in session, number in DB)
        const custom = customPatterns.find(p => String(p.id) === id);
        if (custom) return custom.name;

        return id;
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('ja-JP', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    const getRankColor = (rank?: string, score?: number) => {
        if (!rank && score !== undefined) {
            // Fallback for old data
            if (score >= 95) rank = 'S';
            else if (score >= 80) rank = 'A';
            else if (score >= 60) rank = 'B';
            else if (score >= 40) rank = 'C';
            else rank = 'D';
        }
        switch (rank) {
            case 'S': return '#faad14'; // Gold
            case 'A': return '#52c41a'; // Green
            case 'B': return '#1890ff'; // Blue
            case 'C': return '#fa8c16'; // Orange
            case 'D': return '#ff4d4f'; // Red
            default: return '#888';
        }
    };

    const handleToggle = (id: number | undefined) => {
        if (id === undefined) return;
        setExpandedId(expandedId === id ? null : id);
        setSummaryTab('total'); // Reset tab when toggling
    };

    const handleDelete = async (id: number | undefined, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent toggle
        if (id === undefined) return;
        if (confirm('この履歴を削除しますか？')) {
            await db.sessions.delete(id);
            // Also delete session details if exists
            await db.session_details.where('sessionId').equals(id).delete();
            setExpandedId(null);
        }
    };

    const renderExpandedContent = (session: TrainingSession) => {
        // Get data based on tab
        const getDataForTab = () => {
            if (summaryTab === 'total') {
                return {
                    score: session.score,
                    rank: session.rank || (session.score >= 95 ? 'S' : session.score >= 80 ? 'A' : session.score >= 60 ? 'B' : session.score >= 40 ? 'C' : 'D'),
                    accuracy: session.accuracy,
                    stdDev: session.stdDev,
                    tendency: session.tendency ?? 0,
                    hitCount: session.noteCount
                };
            } else if (summaryTab === 'left' && session.statsL) {
                return session.statsL;
            } else if (summaryTab === 'right' && session.statsR) {
                return session.statsR;
            }
            return null;
        };

        const data = getDataForTab();
        const hasLeftData = !!session.statsL;
        const hasRightData = !!session.statsR;

        if (!data) return <div style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>No Data</div>;

        return (
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)'
            }}>
                {/* Tabs for Total/Left/Right */}
                {(hasLeftData || hasRightData) && (
                    <div style={{ display: 'flex', marginBottom: '1rem', background: 'var(--color-surface-hover)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                        {(['total', 'left', 'right'] as const).map(t => {
                            const label = t === 'total' ? 'TOTAL' : t === 'left' ? 'LEFT (L)' : 'RIGHT (R)';
                            const isActive = summaryTab === t;
                            const hasData = t === 'total' || (t === 'left' && hasLeftData) || (t === 'right' && hasRightData);

                            if (!hasData) return null;

                            return (
                                <button
                                    key={t}
                                    onClick={(e) => { e.stopPropagation(); setSummaryTab(t); }}
                                    style={{
                                        flex: 1,
                                        padding: '0.4rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        background: isActive ? 'var(--color-primary)' : 'transparent',
                                        color: isActive ? '#000' : 'var(--color-text-dim)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Main Content */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Left: Rank & Score */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                        <div style={{
                            fontSize: '3rem',
                            fontWeight: '900',
                            lineHeight: 1,
                            color: getRankColor(data.rank, data.score),
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                            {data.rank}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ccc' }}>
                            {data.score} <span style={{ fontSize: '0.7rem' }}>pts</span>
                        </div>
                    </div>

                    {/* Right: Metrics Bars */}
                    <div style={{ flex: 1, marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* Accuracy Bar */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                <span>TIMING ACCURACY</span>
                                <span>{Math.round(data.accuracy)}ms avg</span>
                            </div>
                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.max(0, Math.min(100, 100 - (data.accuracy - 20) * (100 / 60)))}%`, // 20ms full, 80ms empty
                                    background: 'linear-gradient(90deg, #52c41a, #a0d911)'
                                }} />
                            </div>
                        </div>

                        {/* Stability Bar */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                <span>STABILITY (SD)</span>
                                <span>{Math.round(data.stdDev)}ms</span>
                            </div>
                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.max(0, Math.min(100, 100 - ((data.stdDev || 0) - 10) * (100 / 40)))}%`, // 10ms full, 50ms empty
                                    background: 'linear-gradient(90deg, #1890ff, #69c0ff)'
                                }} />
                            </div>
                        </div>

                        {/* Tendency Bar (Bipolar) */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: '#aaa' }}>
                                <span>TENDENCY</span>
                                <span style={{
                                    color: data.tendency < -5 ? '#fa8c16' : data.tendency > 5 ? '#ff4d4f' : '#52c41a'
                                }}>
                                    {Math.abs(data.tendency) < 5 ? 'Just Right' :
                                        data.tendency < 0 ? `Rush (${Math.round(data.tendency)}ms)` : `Drag (+${Math.round(data.tendency)}ms)`}
                                </span>
                            </div>
                            <div style={{ height: '6px', width: '100%', background: '#333', borderRadius: '3px', position: 'relative' }}>
                                {/* Center Marker */}
                                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#555', transform: 'translateX(-50%)' }} />
                                {/* Fill */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, bottom: 0,
                                    left: data.tendency < 0 ? 'auto' : '50%',
                                    right: data.tendency < 0 ? '50%' : 'auto',
                                    // Scale: 50ms = full width (50%)
                                    width: `${Math.min(50, Math.abs(data.tendency) * (50 / 50))}%`,
                                    background: data.tendency < 0 ? '#fa8c16' : '#ff4d4f', // Orange for Rush, Red for Drag (or adjust colors?)
                                    borderTopLeftRadius: data.tendency < 0 ? '3px' : '0',
                                    borderBottomLeftRadius: data.tendency < 0 ? '3px' : '0',
                                    borderTopRightRadius: data.tendency > 0 ? '3px' : '0',
                                    borderBottomRightRadius: data.tendency > 0 ? '3px' : '0',
                                }} />
                            </div>
                        </div>

                        {/* Hit Count Label */}
                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                            Hits: {data.hitCount}
                        </div>
                    </div>
                </div>

                {/* Delete Button */}
                <button
                    onClick={(e) => handleDelete(session.id, e)}
                    style={{
                        marginTop: '1rem',
                        width: '100%',
                        padding: '0.6rem',
                        background: 'rgba(255, 77, 79, 0.15)',
                        border: '1px solid rgba(255, 77, 79, 0.4)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#ff4d4f',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    🗑️ 削除
                </button>
            </div>
        );
    };

    return (
        <div className="history-view" style={{
            width: '100%',
            maxWidth: '100%',
            marginTop: '2rem',
            padding: '1rem',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            boxSizing: 'border-box'
        }}>
            <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                Training History
            </h3>

            <div className="history-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {sessions.map(session => {
                    const rankColor = getRankColor(session.rank, session.score);
                    const rank = session.rank || (session.score >= 95 ? 'S' : session.score >= 80 ? 'A' : session.score >= 60 ? 'B' : session.score >= 40 ? 'C' : 'D');
                    const isExpanded = expandedId === session.id;

                    return (
                        <div
                            key={session.id}
                            onClick={() => handleToggle(session.id)}
                            style={{
                                padding: '0.8rem',
                                borderBottom: '1px solid #2a2a2a',
                                cursor: 'pointer',
                                background: isExpanded ? 'var(--color-surface-hover)' : 'transparent',
                                borderRadius: isExpanded ? 'var(--radius-md)' : '0',
                                transition: 'all 0.2s'
                            }}
                        >
                            {/* Header Row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto auto',
                                gap: '0.5rem',
                                alignItems: 'center'
                            }}>
                                {/* Left: Info */}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '2px' }}>
                                        {getPatternName(session.patternId)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span>{formatDate(session.date)}</span>
                                        <span>• BPM {session.bpm}</span>
                                        <span>• {session.noteCount} Hits</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                        Avg Error: {Math.round(session.accuracy)}ms
                                        {session.stdDev !== undefined && ` • SD: ${Math.round(session.stdDev)}ms`}
                                    </div>
                                </div>

                                {/* Right: Score & Rank */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <div style={{
                                        fontSize: '1.4rem',
                                        fontWeight: '900',
                                        color: rankColor,
                                        lineHeight: 1,
                                        marginBottom: '4px'
                                    }}>
                                        {rank}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#ccc', fontWeight: 'bold' }}>
                                        {session.score} <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>pts</span>
                                    </div>
                                </div>

                                {/* Expand Indicator */}
                                <div style={{
                                    fontSize: '1.2rem',
                                    color: 'var(--color-text-dim)',
                                    transition: 'transform 0.2s',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}>
                                    ▼
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && renderExpandedContent(session)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
