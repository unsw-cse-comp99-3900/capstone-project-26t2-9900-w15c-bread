import React, { useEffect, useState } from 'react';
import Timeline from './components/Timeline';
import ComparisonPanel from './components/ComparisonPanel';
import SideBySideDiffView from './components/SideBySideDiffView';
import { mockData } from './mockData';
import './styles.css';

function isLocalDevelopment() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

async function loadForgeBridge() {
  if (isLocalDevelopment()) {
    throw new Error('Forge bridge is unavailable in local development.');
  }

  return import('@forge/bridge');
}

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
  const [refreshToken, setRefreshToken] = useState(0);
  const [viewMode, setViewMode] = useState('inline');

  useEffect(() => {
    let cancelled = false;

    if (isLocalDevelopment()) {
      setData(mockData);
      setUsingMock(true);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    loadForgeBridge()
      .then(({ invoke }) => withTimeout(invoke('getPageVersions'), 15000))
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setUsingMock(false);
        setLoading(false);
      })
      .catch(() => {
        // Not in Confluence / resolver error -> show mock data so the UI is still visible.
        if (cancelled) return;
        // During a post-write refresh, retain the real page data rather than
        // replacing it with mock content if the refresh request is transiently
        // unavailable. The modal already reports the completed write result.
        if (refreshToken === 0) {
          setData(mockData);
          setUsingMock(true);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const handlePageUpdated = (updatedPage) => {
    setRefreshToken((current) => current + 1);

    // If the PUT succeeded before Confluence's version read model caught up,
    // refresh once more after the normal consistency window so the timeline
    // replaces the old Current entry without requiring the user to reopen the app.
    if (updatedPage && updatedPage.versionConfirmed === false) {
      setTimeout(() => {
        setRefreshToken((current) => current + 1);
      }, 2000);
    }
  };

  const handleClose = () => {
    if (isLocalDevelopment()) return;

    loadForgeBridge()
      .then(({ view }) => {
        if (view && typeof view.close === 'function') view.close();
      })
      .catch(() => {});
  };

  const versions = data && data.versions ? data.versions : [];

  useEffect(() => {
    if (!selectedNumber && versions.length > 0) {
      setSelectedNumber(versions[0].number);
    }
  }, [selectedNumber, versions]);

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="dh-close"
            onClick={() =>
              setViewMode((mode) => (mode === 'inline' ? 'side-by-side' : 'inline'))
            }
          >
            {viewMode === 'inline' ? 'Side-by-side' : 'Inline'}
          </button>
          <button className="dh-close" onClick={handleClose}>
            Close
          </button>
        </div>
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
          {viewMode === 'inline' ? (
            <ComparisonPanel
              pageId={data ? data.pageId : null}
              pageTitle={data ? data.pageTitle : ''}
              baseUrl={data ? data.baseUrl : ''}
              attachmentsByFilename={data ? data.attachmentsByFilename : {}}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onPageUpdated={handlePageUpdated}
            />
          ) : (
            <SideBySideDiffView
              pageId={data ? data.pageId : null}
              pageTitle={data ? data.pageTitle : ''}
              baseUrl={data ? data.baseUrl : ''}
              attachmentsByFilename={data ? data.attachmentsByFilename : {}}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              activeView={viewMode}
              onViewChange={setViewMode}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
