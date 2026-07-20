import React from 'react';
import { VersionDifferenceNotesRows } from './recoveryDiffDisplay';

export default function RecoveryPreviewModal({ workflow }) {
  const {
    draftPreview,
    writeBack,
    operationIsLoading,
    versionDifferenceNotes,
    showVersionDifferenceNotes,
    closePreview,
    setShowVersionDifferenceNotes,
    confirmWriteBack,
  } = workflow;
  if (!draftPreview) return null;

  return (
    <div
      className="dh-draft-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !operationIsLoading) closePreview();
      }}
    >
      <section aria-labelledby="dh-draft-preview-title" aria-modal="true" className="dh-draft-modal" role="dialog">
        <header className="dh-draft-modal__header">
          <div>
            <h2 className="dh-draft-modal__title" id="dh-draft-preview-title">Review Draft</h2>
            <p className="dh-draft-modal__meta">
              v{draftPreview.selectedVersionNumber} selection to{' '}
              v{draftPreview.currentVersionNumber || '?'}
            </p>
          </div>
          <div className="dh-draft-modal__header-actions">
            <button
              className="dh-draft-modal__version-notes-button"
              disabled={operationIsLoading || Boolean(draftPreview.storageError) || !versionDifferenceNotes}
              onClick={() => setShowVersionDifferenceNotes(true)}
              type="button"
            >
              Version Difference Notes
            </button>
            <button aria-label="Close draft preview" className="dh-draft-modal__close" disabled={operationIsLoading} onClick={closePreview} type="button">×</button>
          </div>
        </header>

        <div className="dh-draft-modal__body">
          {draftPreview.previewHtml ? (
            <article className="dh-rich-page dh-rich-page--preview">
              <section className="dh-rendered-page-body" dangerouslySetInnerHTML={{ __html: draftPreview.previewHtml }} />
            </article>
          ) : (
            <div className="dh-empty-content">No selected changes are available for the draft preview.</div>
          )}
        </div>

        <footer className="dh-draft-modal__footer">
          <div className="dh-draft-modal__result" aria-live="polite">
            {draftPreview.storageError ? <span className="dh-draft-modal__result--error">{draftPreview.storageError}</span> : null}
            {!draftPreview.storageError && writeBack.status === 'idle' ? 'Review the result, then publish it to the current page.' : null}
            {writeBack.status === 'loading' ? 'Writing recovered content to the current page…' : null}
            {writeBack.status === 'error' ? <span className="dh-draft-modal__result--error">{writeBack.error}</span> : null}
            {writeBack.status === 'success' ? <span className="dh-draft-modal__result--success">Current page updated to v{writeBack.page.versionNumber}.</span> : null}
          </div>
          <div className="dh-draft-modal__footer-actions">
            <button disabled={operationIsLoading} type="button" onClick={closePreview}>Back to changes</button>
            <button
              className="dh-write-back-button"
              disabled={operationIsLoading || writeBack.status === 'success' || Boolean(draftPreview.storageError)}
              onClick={confirmWriteBack}
              type="button"
            >
              {writeBack.status === 'loading' ? 'Publishing…' : 'Publish to Current Page'}
            </button>
          </div>
        </footer>
      </section>

      {showVersionDifferenceNotes && versionDifferenceNotes ? (
        <div className="dh-version-notes-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowVersionDifferenceNotes(false);
        }}>
          <section aria-labelledby="dh-version-notes-title" aria-modal="true" className="dh-version-notes-modal" role="dialog">
            <header className="dh-version-notes__header">
              <div>
                <h2 className="dh-draft-modal__title" id="dh-version-notes-title">Version Difference Notes</h2>
                <p className="dh-draft-modal__meta">Current v{draftPreview.currentVersionNumber || '?'} → Draft</p>
              </div>
              <button aria-label="Close version difference notes" className="dh-draft-modal__close" onClick={() => setShowVersionDifferenceNotes(false)} type="button">×</button>
            </header>
            <div className="dh-version-notes__body">
              {versionDifferenceNotes.error ? (
                <div className="dh-draft-modal__result--error">{versionDifferenceNotes.error}</div>
              ) : (
                <>
                  <div className="dh-version-notes__chips">
                    <span className="dh-change-chip dh-change-chip--added">+ {versionDifferenceNotes.diff.summary.added} additions</span>
                    <span className="dh-change-chip dh-change-chip--removed">- {versionDifferenceNotes.diff.summary.removed} removals</span>
                    <span className="dh-change-chip">{versionDifferenceNotes.diff.summary.modifiedBlocks || 0} modified</span>
                  </div>
                  {versionDifferenceNotes.diff.summary.limited ? <div className="dh-diff-warning">This page is large, so only a limited safe comparison is available.</div> : null}
                  <div className="dh-version-notes__changes">
                    <VersionDifferenceNotesRows limited={versionDifferenceNotes.diff.summary.limited} rows={versionDifferenceNotes.display.selectableRows} />
                  </div>
                </>
              )}
            </div>
            <footer className="dh-version-notes__footer">
              <span>Red is removed from Current; green is added by Draft.</span>
              <button onClick={() => setShowVersionDifferenceNotes(false)} type="button">Close</button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
