import Home from './pages/Home';
import StartupScreen from './components/StartupScreen';

export default function App() {
  return (
    <div className="app-shell">
      <main className="app-content">
        <StartupScreen />
        <Home />
      </main>
    </div>
  );
}
