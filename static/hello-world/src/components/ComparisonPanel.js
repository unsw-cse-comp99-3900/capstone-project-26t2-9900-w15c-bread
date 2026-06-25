import React from 'react';

/**
 * Right-hand panel — the mount point for the diff / line-staging features.
 *
 * Props contract (provided by App):
 *   - pageId:          string | null  — the Confluence page id
 *   - currentVersion:  object | null  — the page's current (newest) version
 *   - selectedVersion: object | null  — the version the user picked in the timeline
 *
 * Each version object looks like:
 *   { number, authorId, authorName, createdAt, message, minorEdit }
 *
 * NOTE FOR TEAMMATES (diff / staging):
 *   Replace the placeholder body below with the side-by-side diff UI.
 *   Use `currentVersion.number` and `selectedVersion.number` to fetch each
 *   version's body (e.g. a new resolver `getVersionContent(pageId, number)`),
 *   then render the comparison + line-by-line staging controls here.
 */
function ComparisonPanel({ pageId, currentVersion, selectedVersion }) {
  if (!selectedVersion) {
    return (
      <div className="dh-main__empty">
        <h2 className="dh-main__empty-title">Select a version to compare</h2>
        <p className="dh-main__empty-text">
          Pick any version from the timeline on the left to compare it against the
          current version of this page.
        </p>
      </div>
    );
  }

  const isCurrent =
    currentVersion && selectedVersion.number === currentVersion.number;

  return (
    <div className="dh-compare">
      <div className="dh-compare__header">
        <span className="dh-compare__pill">
          v{currentVersion ? currentVersion.number : '?'} · Current
        </span>
        <span className="dh-compare__arrow">↔</span>
        <span className="dh-compare__pill dh-compare__pill--selected">
          v{selectedVersion.number}
        </span>
      </div>

      {isCurrent ? (
        <div className="dh-state">
          This is the current version — pick an older version to see what changed.
        </div>
      ) : (
        <div className="dh-compare__placeholder">
          <p className="dh-compare__placeholder-title">Diff view goes here</p>
          <p className="dh-compare__hint">
            Comparing the current version with{' '}
            <strong>v{selectedVersion.number}</strong> by {selectedVersion.authorName}.
          </p>
          <p className="dh-compare__hint">
            Side-by-side diff and line-by-line staging will be built on top of this
            panel (pageId: {pageId || 'n/a'}).
          </p>
        </div>
      )}
    </div>
  );
}

export default ComparisonPanel;
