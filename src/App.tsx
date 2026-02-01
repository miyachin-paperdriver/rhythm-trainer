import { Metronome } from './components/Audio/Metronome'

function App() {


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
        fontSize: '0.8rem',
        color: 'var(--color-text-dim)',
        opacity: 0.5
      }}>
        v{__APP_VERSION__}
      </footer>
    </div>
  )
}

export default App
