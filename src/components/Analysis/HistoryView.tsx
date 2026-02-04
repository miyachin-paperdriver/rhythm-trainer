import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type NoteHitDetail } from '../../db/db';
import { PATTERNS } from '../../utils/patterns';

export const HistoryView = () => {
    const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray());
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [details, setDetails] = useState<NoteHitDetail[] | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch details when expandedId changes
    useEffect(() => {
        if (expandedId) {
            setLoadingDetails(true);
            db.session_details.where('sessionId').equals(expandedId).first()
                .then(d => {
                    setDetails(d ? d.hits : []);
                })
                .catch(e => {
                    console.error("Failed to load details", e);
                    setDetails([]);
                })
                .finally(() => setLoadingDetails(false));
        } else {
            setDetails(null);
        }
    }, [expandedId]);

    const handleExpand = (id?: number) => {
        if (!id) return;
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
        }
    };

    if (!sessions || sessions.length === 0) {
        return <div style={{ color: '#888', marginTop: '2rem', textAlign: 'center' }}>No history yet. Start training!</div>;
    }

    const getPatternName = (id: string) => PATTERNS.find(p => p.id === id)?.name || id;

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('ja-JP', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    const getRankColor = (rank?: string, score?: number) => {
        if (!rank && score !== undefined) {
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

    return (
        <div className="history-view" style={{
            width: '100%',
            marginTop: '2rem',
            padding: '1rem',
            background: 'var(--color-surface, #1f1f1f)',
            borderRadius: '12px',
            boxSizing: 'border-box'
        }}>
            <h3 style={{ color: 'var(--color-primary, #1890ff)', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                Training History
            </h3>

            <div className="history-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {sessions.map(session => {
                    const rankColor = getRankColor(session.rank, session.score);
                    const rank = session.rank || (session.score >= 95 ? 'S' : session.score >= 80 ? 'A' : session.score >= 60 ? 'B' : session.score >= 40 ? 'C' : 'D');
                    const isExpanded = expandedId === session.id;

                    return (
                        <div key={session.id} style={{
                            borderBottom: '1px solid #2a2a2a',
                            cursor: 'pointer',
                            background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                            transition: 'background 0.2s'
                        }} onClick={() => handleExpand(session.id)}>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: '0.5rem',
                                padding: '1rem 0.5rem',
                            }}>
                                {/* Left: Info */}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>
                                        {getPatternName(session.patternId)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span>{formatDate(session.date)}</span>
                                        <span>• BPM {session.bpm}</span>
                                        <span>• {session.noteCount} Hits</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
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
                            </div>

                            {/* Expanded Details: Graph */}
                            {isExpanded && (
                                <div style={{ padding: '0 0.5rem 1rem 0.5rem' }} onClick={e => e.stopPropagation()}>
                                    {loadingDetails && <div style={{ fontSize: '0.8rem', color: '#666' }}>Loading details...</div>}
                                    {!loadingDetails && details && details.length > 0 && (
                                        <TimingGraph hits={details} />
                                    )}
                                    {!loadingDetails && (!details || details.length === 0) && (
                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>No detailed data available for this session.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Helper Component for Graph
const TimingGraph = ({ hits }: { hits: NoteHitDetail[] }) => {
    if (hits.length === 0) return null;

    // Dimensions
    const height = 120;
    const range = 80; // +/- 80ms range

    // Normalize logic
    const getY = (offset: number) => {
        // Clamp
        const clamped = Math.max(-range, Math.min(range, offset));
        // Map -80..80 to height..0 (SVG y is down)
        // 0 -> height/2
        // 80 -> 0
        // -80 -> height
        return (height / 2) - (clamped / range) * (height / 2);
    };

    return (
        <div style={{
            background: '#2a2a2a', // Brighter background as requested
            borderRadius: '8px',
            padding: '10px',
            height: `${height}px`,
            position: 'relative',
            marginTop: '10px'
        }}>
            <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* Center Line (0ms) */}
                <line x1="0" y1={height / 2} x2="100%" y2={height / 2} stroke="#444" strokeWidth="1" />

                {/* Grid lines? Optional */}
                <line x1="0" y1={0} x2="100%" y2={0} stroke="#333" strokeDasharray="4 4" />
                <line x1="0" y1={height} x2="100%" y2={height} stroke="#333" strokeDasharray="4 4" />

                {/* Data Points */}
                {hits.map((hit, i) => {
                    const x = (i / (hits.length - 1 || 1)) * 100; // Percent
                    const y = getY(hit.offset);
                    const color = hit.hand === 'L' ? '#00eaff' : '#ff4d4f'; // Cyan (L) vs Red (R)

                    return (
                        <circle
                            key={i}
                            cx={`${x}%`}
                            cy={y}
                            r="2"
                            fill={color}
                        />
                    );
                })}
            </svg>

            {/* Labels */}
            <div style={{ position: 'absolute', right: 4, top: 0, fontSize: '9px', color: '#666' }}>+{range}ms</div>
            <div style={{ position: 'absolute', right: 4, bottom: 0, fontSize: '9px', color: '#666' }}>-{range}ms</div>
            <div style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#666' }}>0ms</div>
        </div>
    );
};
