import React, { useEffect, useState } from 'react';
import Timeline from './components/Timeline';
import ComparisonPanel from './components/ComparisonPanel';
import { mockData } from './mockData';
import './styles.css';

// @forge/bridge throws at import time when the app runs outside an Atlassian
// product (e.g. a plain `npm start` preview). Load it defensively so local
// preview still works with mock data; inside Confluence the real bridge loads.
let bridge = {};
try {
  // eslint-disable-next-line global-require
  bridge = require('@forge/bridge');
} catch (e) {
  bridge = {};
}
const invoke = bridge.invoke || null;
const view = bridge.view || null;

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
  const [selectedNumber, setSelectedNumber] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // No bridge -> running outside Confluence (local preview). Show mock immediately.
    if (!invoke) {
      setData(mockData);
      setUsingMock(true);
      setLoading(false);
      return undefined;
    }

    withTimeout(Promise.resolve().then(() => invoke('getPageVersions')), 8000)
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

  const versions = data ? data.versions : [];
  // The newest version (index 0) is always the page's current version.
  const currentVersion = versions[0] || null;
  const selectedVersion = versions.find((v) => v.number === selectedNumber) || null;

  return (
    <div className="dh-app">
      <header className="dh-header">
        <div className="dh-header__titles">
          <h1 className="dh-title">Dynamic History</h1>
          {data && data.pageTitle ? <span className="dh-subtitle">{data.pageTitle}</span> : null}
        </div>
        <button className="dh-close" onClick={handleClose}>
          Close
        </button>
      </header>

      {usingMock && (
        <div className="dh-banner">Showing mock data — not connected to a Confluence page.</div>
      )}

      <div className="dh-layout">
        <aside className="dh-sidebar">
          {loading ? (
            <div className="dh-state">Loading version history…</div>
          ) : (
            <Timeline
              versions={versions}
              selected={selectedNumber}
              onSelect={setSelectedNumber}
            />
          )}
        </aside>

        <main className="dh-main">
          <ComparisonPanel
            pageId={data ? data.pageId : null}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
