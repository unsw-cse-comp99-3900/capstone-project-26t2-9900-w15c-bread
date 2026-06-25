import React from 'react';
import { formatRelativeTime, formatDateTime, initials } from '../utils';

function VersionCard({ version, isLatest, isSelected, onSelect }) {
  const { number, authorName, createdAt, message, minorEdit } = version;

  return (
    <li
      className={`dh-card${isSelected ? ' dh-card--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
    >
      <div className="dh-card__rail">
        <span className={`dh-dot${isLatest ? ' dh-dot--current' : ''}`} />
      </div>

      <div className="dh-card__content">
        <div className="dh-card__top">
          <span className="dh-version">v{number}</span>
          {isLatest && <span className="dh-badge dh-badge--current">Current</span>}
          {minorEdit && <span className="dh-badge dh-badge--minor">Minor edit</span>}
          <span className="dh-time" title={formatDateTime(createdAt)}>
            {formatRelativeTime(createdAt)}
          </span>
        </div>

        <div className="dh-card__author">
          <span className="dh-avatar">{initials(authorName)}</span>
          <span className="dh-author-name">{authorName || 'Unknown user'}</span>
        </div>

        {message ? (
          <div className="dh-card__message">{message}</div>
        ) : (
          <div className="dh-card__message dh-card__message--empty">No edit summary</div>
        )}
      </div>
    </li>
  );
}

export default VersionCard;
