import React, { useEffect, useState } from 'react';
import { formatRelativeTime, initials } from '../utils';

const MAX_COMMENT_LENGTH = 2000;

function VersionCommentModal({
  versions,
  version,
  currentVersion,
  currentUser,
  diffSummary,
  existingComment,
  onVersionChange,
  onClose,
  onSave,
}) {
  const [comment, setComment] = useState('');
  const [includeDiffSummary, setIncludeDiffSummary] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setComment(existingComment ? existingComment.body : '');
    setIncludeDiffSummary(
      existingComment ? existingComment.includeDiffSummary !== false : true
    );
    setError('');
  }, [existingComment, version && version.number]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  if (!version) return null;

  const summary = {
    added: Number(diffSummary && diffSummary.added) || 0,
    removed: Number(diffSummary && diffSummary.removed) || 0,
    modified: Number(diffSummary && diffSummary.modifiedBlocks) || 0,
  };
  const authorName = currentUser && currentUser.displayName
    ? currentUser.displayName
    : 'You';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const body = comment.trim();
    if (!body || saving) return;

    setSaving(true);
    setError('');
    try {
      await onSave({
        versionNumber: version.number,
        body,
        includeDiffSummary,
        diffSummary: {
          ...summary,
          currentVersionNumber: currentVersion ? currentVersion.number : 0,
        },
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError && saveError.message
          ? saveError.message
          : 'The version comment could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dh-comment-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="dh-comment-modal-title"
        aria-modal="true"
        className="dh-comment-modal"
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <header className="dh-comment-modal__header">
            <div>
              <h2 id="dh-comment-modal-title">
                {existingComment ? 'Edit Version Comment' : 'Add Version Comment'}
              </h2>
              <p>
                {existingComment
                  ? 'Update the annotation for this history version.'
                  : 'Add an annotation to a selected history version.'}
              </p>
            </div>
            <button
              aria-label="Close version comment"
              className="dh-comment-modal__close"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </header>

          <div className="dh-comment-modal__body">
            <label className="dh-comment-field">
              <span>Version</span>
              <select
                disabled={saving}
                onChange={(event) => onVersionChange(Number(event.target.value))}
                value={version.number}
              >
                {versions.map((candidate) => (
                  <option key={candidate.number} value={candidate.number}>
                    v{candidate.number} · {candidate.authorName || 'Unknown user'} ·{' '}
                    {formatRelativeTime(candidate.createdAt)}
                  </option>
                ))}
              </select>
            </label>

            <div className="dh-comment-field">
              <span>Diff context</span>
              <div className="dh-comment-summary">
                <span className="dh-change-chip dh-change-chip--added">
                  + {summary.added} additions
                </span>
                <span className="dh-change-chip dh-change-chip--removed">
                  - {summary.removed} removals
                </span>
                <span className="dh-change-chip dh-change-chip--modified">
                  {summary.modified} modified
                </span>
              </div>
              <label className="dh-comment-checkbox">
                <input
                  checked={includeDiffSummary}
                  disabled={saving}
                  onChange={(event) => setIncludeDiffSummary(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Attach diff summary
                  <small>Include a summary of additions, removals and modifications.</small>
                </span>
              </label>
            </div>

            <label className="dh-comment-field">
              <span>Comment</span>
              <textarea
                autoFocus
                disabled={saving}
                maxLength={MAX_COMMENT_LENGTH}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Describe the purpose or context of this version…"
                rows={5}
                value={comment}
              />
              <small className="dh-comment-counter">
                {comment.length} / {MAX_COMMENT_LENGTH}
              </small>
            </label>

            <div className="dh-comment-field">
              <span>Preview</span>
              <div className="dh-comment-preview">
                <div className="dh-comment-preview__meta">
                  <span className="dh-avatar">{initials(authorName)}</span>
                  <strong>{authorName}</strong>
                  <span className="dh-comment-preview__version">v{version.number}</span>
                  <span>Just now</span>
                </div>
                <p>{comment.trim() || 'Your comment preview will appear here.'}</p>
                {includeDiffSummary ? (
                  <div className="dh-comment-preview__summary">
                    Compared with current v{currentVersion ? currentVersion.number : '?'}:{' '}
                    +{summary.added} / -{summary.removed} / {summary.modified} modified
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="dh-comment-error" role="alert">{error}</div>
            ) : null}
          </div>

          <footer className="dh-comment-modal__footer">
            <button disabled={saving} onClick={onClose} type="button">Cancel</button>
            <button
              className="dh-primary-button"
              disabled={!comment.trim() || saving}
              type="submit"
            >
              {saving
                ? existingComment ? 'Updating…' : 'Adding…'
                : existingComment ? 'Update comment' : 'Add comment'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default VersionCommentModal;
