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
            <h3 style={{ color: 'var(--color-primary)', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                Training History
            </h3>

            <div className="history-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {sessions.map(session => (
                    <div key={session.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.8rem 0',
                        borderBottom: '1px solid #2a2a2a'
                    }}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{getPatternName(session.patternId)}</div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                {formatDate(session.date)} • {Math.round(session.durationSeconds)}s • BPM {session.bpm}
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                color: session.score >= 80 ? 'var(--color-accent)' : '#fff'
                            }}>
                                {session.score} pts
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                Avg {Math.round(session.accuracy)}ms
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
