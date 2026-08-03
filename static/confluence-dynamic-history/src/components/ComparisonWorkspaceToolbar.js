import React, { useMemo } from 'react';

const VIEW_OPTIONS = [
  { value: 'inline', label: 'Inline' },
  { value: 'side-by-side', label: 'Side-by-side' },
];

function ComparisonWorkspaceToolbar({
  activeView,
  blockChoices,
  onChooseAll,
  onPreviewDraft,
  onResetChoices,
  onViewChange,
  selectableKeys,
}) {
  const keys = useMemo(
    () => Array.from(new Set(selectableKeys || [])),
    [selectableKeys]
  );
  const choices = blockChoices || new Map();
  const decidedCount = keys.filter((key) => choices.has(key)).length;
  const allHistorical = keys.length > 0 && keys.every(
    (key) => choices.get(key) === 'old'
  );

  return (
    <div className="dh-workspace-toolbar">
      <div className="dh-workspace-toolbar__views" role="tablist" aria-label="Comparison view">
        {VIEW_OPTIONS.map((option) => (
          <button
            aria-selected={activeView === option.value}
            className={`dh-workspace-toolbar__view${
              activeView === option.value ? ' dh-workspace-toolbar__view--active' : ''
            }`}
            key={option.value}
            onClick={() => onViewChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="dh-workspace-toolbar__recovery">
        <span className="dh-workspace-toolbar__progress">
          {decidedCount} of {keys.length} decided
        </span>
        <button
          disabled={!keys.length || allHistorical}
          onClick={() => onChooseAll('old')}
          type="button"
        >
          Restore Historical for All
        </button>
        <button
          disabled={!decidedCount}
          onClick={onResetChoices}
          title="Clear all decisions and return every change to undecided."
          type="button"
        >
          Reset choices
        </button>
        <button
          className="dh-primary-button"
          disabled={!keys.length || typeof onPreviewDraft !== 'function'}
          onClick={onPreviewDraft}
          type="button"
        >
          Review &amp; Publish
        </button>
      </div>
    </div>
  );
}

export default ComparisonWorkspaceToolbar;
