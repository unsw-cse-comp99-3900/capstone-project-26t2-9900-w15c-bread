import React from 'react';
import { formatRelativeTime, formatDateTime, initials } from '../utils';

function VersionCard({ version, isLatest, isSelected, onSelect }) {
  const { number, authorName, createdAt, message, minorEdit } = version;

  return (
    <li
      className={`dh-version-row${isSelected ? ' dh-version-row--selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect();
      }}
    >
      <div className="dh-version-row__number">
        <span>
          v{number}
          <span className="dh-version-date">{formatDateTime(createdAt)}</span>
        </span>
        {isLatest && <span className="dh-badge dh-badge--current">Current</span>}
      </div>

      <div className="dh-version-row__main">
        <div className="dh-version-row__meta">
          <span className="dh-author-name">{authorName || 'Unknown user'}</span>
          {minorEdit && <span className="dh-badge dh-badge--minor">Minor edit</span>}
        </div>

        {message ? (
          <div className="dh-version-row__message">{message}</div>
        ) : (
          <div className="dh-version-row__message dh-version-row__message--empty">
            No edit summary
          </div>
        )}
      </div>

      <div className="dh-version-row__time">
        <span title={formatDateTime(createdAt)}>{formatRelativeTime(createdAt)}</span>
        <span className="dh-avatar">{initials(authorName)}</span>
      </div>
    </li>
  );
}

export default VersionCard;
