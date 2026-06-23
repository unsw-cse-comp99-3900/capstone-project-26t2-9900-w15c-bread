import React, { useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import Timeline from './components/Timeline';
import { mockData } from './mockData';
import './styles.css';

// Reject if the bridge call takes too long (e.g. running outside Confluence),
// so we can fall back to mock data during local development.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [usingMock, setUsingMock] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    withTimeout(invoke('getPageVersions'), 15000)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setUsingMock(false);
        setLoading(false);
      })
      .catch(() => {
        // Not in Confluence / resolver error -> show mock data so the UI is still visible.
        if (cancelled) return;
        setData(mockData);
        setUsingMock(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    if (view && typeof view.close === 'function') view.close();
  };

  return (
    <div className="dh-app">
      <header className="dh-header">
        <div className="dh-header__titles">
          <h1 className="dh-title">Dynamic History</h1>
          {data && data.pageTitle ? (
            <span className="dh-subtitle">{data.pageTitle}</span>
          ) : null}
        </div>
        <button className="dh-close" onClick={handleClose}>
          Close
        </button>
      </header>

      {usingMock && (
        <div className="dh-banner">
          Showing mock data — not connected to a Confluence page.
        </div>
      )}

      <main className="dh-body">
        {loading ? (
          <div className="dh-state">Loading version history…</div>
        ) : (
          <Timeline versions={data.versions} selected={selected} onSelect={setSelected} />
        )}
      </main>
    </div>
  );
}

export default App;
