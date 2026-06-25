import React from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';

/**
 * Right-hand panel for rich version preview and version-to-version comparison.
 *
 * Props contract (provided by App):
 *   - pageId:          string | null  — the Confluence page id
 *   - selectedVersion: object | null  — the version the user picked in the timeline
 *
 * The selected historical version is compared against the current version so
 * users can see what changed between that point in history and the live page.
 */
function ComparisonPanel({
  pageId,
  pageTitle,
  baseUrl,
  attachmentsByFilename,
  currentVersion,
  selectedVersion,
}) {
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

  const currentBodyValue =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBodyValue =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';
  const selectedPlainText = storageToPlainText(selectedBodyValue);
  const selectedWordCount = countWords(selectedPlainText);
  const hasComparisonBase = Boolean(currentVersion && selectedVersion);
  const isCurrent =
    currentVersion && selectedVersion.number === currentVersion.number;
  const richDiff = hasComparisonBase && !isCurrent
    ? buildRichTextDiffHtml(
        selectedBodyValue,
        currentBodyValue,
        baseUrl,
        attachmentsByFilename || {}
      )
    : { html: '', added: 0, removed: 0, limited: false };
  const selectedHtml = hasComparisonBase && !isCurrent
    ? richDiff.html
    : prepareConfluenceHtml(
        currentBodyValue || selectedBodyValue,
        baseUrl,
        attachmentsByFilename || {}
      );
  const totalChanges = richDiff.added + richDiff.removed;

  return (
    <div className="dh-compare">
      <div className="dh-compare__header">
        <span className="dh-compare__pill">
          v{selectedVersion.number}
          {isCurrent ? ' · Current' : ''}
        </span>
        <span className="dh-compare__arrow">vs</span>
        <span className="dh-compare__pill dh-compare__pill--selected">
          v{currentVersion ? currentVersion.number : '?'} · Current
        </span>
      </div>

      <div className="dh-compare__meta">
        <span>{pageTitle || 'Current page'}</span>
        <span>Edited by {selectedVersion.authorName || 'Unknown user'}</span>
        <span>{formatDateTime(selectedVersion.createdAt)}</span>
        <span>{selectedWordCount} words</span>
        <span>{selectedBodyValue.length} HTML chars</span>
        {pageId ? <span>Page {pageId}</span> : null}
      </div>

      <div className="dh-change-summary">
        {hasComparisonBase ? (
          <>
            <span className="dh-change-chip">
              Compared with current v{currentVersion.number}
            </span>
            <span className="dh-change-chip dh-change-chip--added">
              + {richDiff.added} additions
            </span>
            <span className="dh-change-chip dh-change-chip--removed">
              - {richDiff.removed} removals
            </span>
            <span className="dh-change-chip">{totalChanges} total changes</span>
          </>
        ) : (
          <span className="dh-change-chip">
            Current version shown as a full content preview
          </span>
        )}
      </div>

      <div className="dh-content-panel">
        {richDiff.limited && hasComparisonBase ? (
          <div className="dh-diff-warning">
            This page is large, so the preview shows current content without calculating a full
            inline diff.
          </div>
        ) : null}

        {selectedHtml ? (
          <article className="dh-rich-page">
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
    </div>
  );
}

export default ComparisonPanel;
