import { Metronome } from './components/Audio/Metronome'
import { OnsetTestPage } from './components/Test/OnsetTestPage'

function App() {
  // Simple "router" for testing purposes
  const isTest = new URLSearchParams(window.location.search).get('test') === 'onset';

  if (isTest) {
    return <OnsetTestPage />;
  }

  return (
    <div className="app-container">
      <h1>Rhythm Trainer</h1>

      <main>
        <Metronome />
      </main>

      <footer style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        fontSize: '0.85rem',
        color: 'var(--color-text-dim)',
        opacity: 0.5
      }}>
        v{__APP_VERSION__}
      </footer>
    </div>
  )
}

export default App
