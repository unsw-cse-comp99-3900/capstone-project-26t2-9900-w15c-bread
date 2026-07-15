import React, { useCallback, useEffect, useState } from 'react';
import Timeline from './components/Timeline';
import ComparisonPanel from './components/ComparisonPanel';
import VersionCommentModal from './components/VersionCommentModal';
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
  const [commentVersionNumber, setCommentVersionNumber] = useState(null);
  const [diffSummariesByVersion, setDiffSummariesByVersion] = useState({});

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

  const handlePageUpdated = () => {
    setRefreshToken((current) => current + 1);

    // The page update endpoint can succeed before Confluence's version-list
    // read model exposes the new version. The resolver cannot reliably know
    // whether that separate read model has caught up, so always retry once
    // after its normal consistency window. This keeps the timeline current
    // without asking the user to close and reopen the app.
    setTimeout(() => {
      setRefreshToken((current) => current + 1);
    }, 2000);
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
  const commentVersion = versions.find((v) => v.number === commentVersionNumber) || null;
  const commentsByVersion = data && data.commentsByVersion ? data.commentsByVersion : {};

  const handleOpenComment = (versionNumber) => {
    setSelectedNumber(versionNumber);
    setCommentVersionNumber(versionNumber);
  };

  const handleCommentVersionChange = (versionNumber) => {
    setSelectedNumber(versionNumber);
    setCommentVersionNumber(versionNumber);
  };

  const handleDiffSummaryChange = useCallback((versionNumber, summary) => {
    setDiffSummariesByVersion((previous) => ({
      ...previous,
      [String(versionNumber)]: summary,
    }));
  }, []);

  const handleSaveComment = async (commentInput) => {
    let result;

    if (usingMock) {
      const mockComment = {
        id: `mock-${Date.now()}`,
        ...commentInput,
        authorId: 'mock-current-user',
        authorName: data.currentUser.displayName,
        createdAt: new Date().toISOString(),
      };
      const versionKey = String(commentInput.versionNumber);
      result = {
        comment: mockComment,
        commentsByVersion: {
          ...commentsByVersion,
          [versionKey]: [mockComment],
        },
      };
    } else {
      const { invoke } = await loadForgeBridge();
      result = await invoke('addVersionComment', {
        pageId: data.pageId,
        ...commentInput,
      });
    }

    if (!result || !result.comment || !result.commentsByVersion) {
      throw new Error('The comment service returned an invalid response.');
    }

    setData((previous) => ({
      ...previous,
      commentsByVersion: result.commentsByVersion,
    }));
  };

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
              commentsByVersion={commentsByVersion}
              versions={versions}
              selected={selectedNumber}
              onSelect={setSelectedNumber}
              onAddComment={handleOpenComment}
            />
          )}
        </aside>

        <main className="dh-main">
          <ComparisonPanel
            pageId={data ? data.pageId : null}
            pageTitle={data ? data.pageTitle : ''}
            baseUrl={data ? data.baseUrl : ''}
            attachmentsByFilename={data ? data.attachmentsByFilename : {}}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            onPageUpdated={handlePageUpdated}
            onDiffSummaryChange={handleDiffSummaryChange}
          />
        </main>
      </div>

      {commentVersion ? (
        <VersionCommentModal
          currentUser={data && data.currentUser ? data.currentUser : { displayName: 'You' }}
          currentVersion={currentVersion}
          diffSummary={diffSummariesByVersion[String(commentVersion.number)]}
          existingComment={
            (commentsByVersion[String(commentVersion.number)] || [])[0] || null
          }
          onClose={() => setCommentVersionNumber(null)}
          onSave={handleSaveComment}
          onVersionChange={handleCommentVersionChange}
          version={commentVersion}
          versions={versions}
        />
      ) : null}
    </div>
  );
}

export default App;
