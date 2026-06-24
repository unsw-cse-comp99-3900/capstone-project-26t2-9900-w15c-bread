import React, { useEffect, useState } from 'react';
import Timeline from './components/Timeline';
import { mockData } from './mockData';
import {
  buildRichTextDiffHtml,
  countWords,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from './utils';
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
  const [selected, setSelected] = useState(null);

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
        setData(mockData);
        setUsingMock(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    if (isLocalDevelopment()) return;

    loadForgeBridge()
      .then(({ view }) => {
        if (view && typeof view.close === 'function') view.close();
      })
      .catch(() => {});
  };

  const versions = data && data.versions ? data.versions : [];
  const selectedVersionIndex = versions.findIndex((v) => v.number === selected);
  const selectedVersion = versions.find((v) => v.number === selected);
  const comparisonBaseVersion =
    selectedVersionIndex >= 0 ? versions[selectedVersionIndex + 1] : null;
  const selectedBodyValue =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';
  const selectedPlainText = storageToPlainText(selectedBodyValue);
  const selectedWordCount = countWords(selectedPlainText);
  const comparisonBaseBodyValue =
    comparisonBaseVersion && comparisonBaseVersion.body ? comparisonBaseVersion.body.value : '';
  const hasComparisonBase = Boolean(selectedVersion && comparisonBaseVersion);
  const attachmentsByFilename = (data && data.attachmentsByFilename) || {};
  const richDiff = buildRichTextDiffHtml(
    comparisonBaseBodyValue,
    selectedBodyValue,
    data && data.baseUrl,
    attachmentsByFilename
  );
  const selectedHtml = hasComparisonBase
    ? richDiff.html
    : prepareConfluenceHtml(selectedBodyValue, data && data.baseUrl, attachmentsByFilename);
  const addedCount = hasComparisonBase ? richDiff.added : 0;
  const removedCount = hasComparisonBase ? richDiff.removed : 0;

  useEffect(() => {
    if (!selected && versions.length > 0) {
      setSelected(versions[0].number);
    }
  }, [selected, versions]);

  return (
    <div className="dh-app">
      {usingMock && (
        <div className="dh-banner">Showing mock data — not connected to a Confluence page.</div>
      )}

      <main className="dh-shell">
        {loading ? (
          <div className="dh-state">Loading version history…</div>
        ) : (
          <div className="dh-history-view">
            <section className="dh-page-view" aria-label="Selected page version preview">
              <header className="dh-page-toolbar">
                <button className="dh-back" type="button" onClick={handleClose} aria-label="Close">
                  ←
                </button>
                <div className="dh-page-breadcrumb">
                  <span>{data && data.pageTitle ? data.pageTitle : 'Page'}</span>
                  <span>/</span>
                  {selectedVersion && (
                    <>
                      <span className="dh-version-pill">V{selectedVersion.number}</span>
                      <strong>{formatDateTime(selectedVersion.createdAt)}</strong>
                    </>
                  )}
                </div>
                <button className="dh-restore" type="button" disabled>
                  还原此版本
                </button>
                <div className="dh-page-toolbar__spacer" />
                <div className="dh-edit-count">
                  总计：{addedCount + removedCount} 处变更
                </div>
              </header>

              {selectedVersion ? (
                <div className="dh-page-scroll">
                  {hasComparisonBase && (
                    <div className="dh-change-summary">
                      <span className="dh-change-chip">
                        Compared with V{comparisonBaseVersion.number}
                      </span>
                      <span className="dh-change-chip dh-change-chip--added">
                        + {addedCount} additions
                      </span>
                      <span className="dh-change-chip dh-change-chip--removed">
                        - {removedCount} removals
                      </span>
                    </div>
                  )}

                  {selectedHtml ? (
                    <article className="dh-rich-page">
                      {richDiff.limited && hasComparisonBase && (
                        <div className="dh-diff-warning">
                          This page is large, so the preview shows current content without
                          calculating a full inline diff.
                        </div>
                      )}
                      <section
                        className="dh-rendered-page-body"
                        dangerouslySetInnerHTML={{ __html: selectedHtml }}
                      />
                    </article>
                  ) : (
                    <div className="dh-empty-content">
                      Confluence did not return rendered rich content for this version.
                    </div>
                  )}
                </div>
              ) : (
                <div className="dh-empty-content">Choose a version to preview its content.</div>
              )}
            </section>

            <aside className="dh-history-sidebar" aria-label="Version history">
              <header className="dh-sidebar-header">
                <div className="dh-sidebar-title">
                  <span className="dh-sidebar-icon">↺</span>
                  <h1>版本历史记录</h1>
                </div>
                <button className="dh-sidebar-close" type="button" onClick={handleClose}>
                  ×
                </button>
              </header>

              <div className="dh-sidebar-list">
                <Timeline versions={versions} selected={selected} onSelect={setSelected} />
              </div>

              <footer className="dh-sidebar-footer">
                <div className="dh-selected-meta">
                  {selectedVersion ? (
                    <>
                      <span>{selectedWordCount} words</span>
                      <span>{selectedBodyValue.length} HTML chars</span>
                      <span>{selectedVersion.authorName || 'Unknown user'}</span>
                    </>
                  ) : null}
                </div>
                <div className="dh-change-status">页面预览中显示增减内容</div>
              </footer>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
