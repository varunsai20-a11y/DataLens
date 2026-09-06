function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>DataLens</h1>
      <p>Infrastructure Phase 1: Foundation Loaded.</p>
      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>System Status</h3>
        <p>Frontend: ✅ Running</p>
        <p>Connecting to: <code style={{ backgroundColor: '#eee', padding: '2px 4px' }}>{import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}</code></p>
      </div>
    </div>
  );
}

export default App;
