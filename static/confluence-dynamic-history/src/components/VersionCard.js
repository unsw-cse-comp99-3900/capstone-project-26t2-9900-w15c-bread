import React from 'react';
import { formatRelativeTime, formatDateTime, initials } from '../utils';

function VersionCard({ version, isLatest, isSelected, comments, onSelect, onAddComment }) {
  const { number, authorName, createdAt, message, minorEdit } = version;
  const latestComment = comments && comments.length ? comments[comments.length - 1] : null;

  return (
    <li className={`dh-card${isSelected ? ' dh-card--selected' : ''}`}>
      <div className="dh-card__rail">
        <span className={`dh-dot${isLatest ? ' dh-dot--current' : ''}`} />
      </div>

      <div className="dh-card__content">
        <button className="dh-card__select" onClick={onSelect} type="button">
          <span className="dh-card__top">
            <span className="dh-version">v{number}</span>
            {isLatest && <span className="dh-badge dh-badge--current">Current</span>}
            {minorEdit && <span className="dh-badge dh-badge--minor">Minor edit</span>}
            <span className="dh-time" title={formatDateTime(createdAt)}>
              {formatRelativeTime(createdAt)}
            </span>
          </span>

          <span className="dh-card__author">
            <span className="dh-avatar">{initials(authorName)}</span>
            <span className="dh-author-name">{authorName || 'Unknown user'}</span>
          </span>

          {message ? <span className="dh-card__message">{message}</span> : null}
        </button>

        {latestComment ? (
          <div className="dh-card__comment-preview" title={latestComment.body}>
            <strong>{latestComment.authorName || 'Unknown user'}:</strong> {latestComment.body}
          </div>
        ) : null}

        <button className="dh-card__comment-action" onClick={onAddComment} type="button">
          <span aria-hidden="true" className="dh-comment-icon">◇</span>
          {latestComment ? 'Edit comment' : 'Add comment'}
        </button>
      </div>
    </li>
  );
}

export default VersionCard;
