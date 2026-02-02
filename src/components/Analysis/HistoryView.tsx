import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { PATTERNS } from '../../utils/patterns';

export const HistoryView = () => {
    const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray());

    if (!sessions || sessions.length === 0) {
        return <div style={{ color: '#888', marginTop: '2rem' }}>No history yet. Start training!</div>;
    }

    const getPatternName = (id: string) => PATTERNS.find(p => p.id === id)?.name || id;

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

            <div className="history-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {sessions.map(session => {
                    const rankColor = getRankColor(session.rank, session.score);
                    const rank = session.rank || (session.score >= 95 ? 'S' : session.score >= 80 ? 'A' : session.score >= 60 ? 'B' : session.score >= 40 ? 'C' : 'D');

                    return (
                        <div key={session.id} style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '0.5rem',
                            padding: '0.8rem 0',
                            borderBottom: '1px solid #2a2a2a'
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
