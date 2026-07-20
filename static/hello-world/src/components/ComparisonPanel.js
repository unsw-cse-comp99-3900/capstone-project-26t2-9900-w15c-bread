import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  extractMentionAccountIds,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';
import {
  buildCanonicalDiffSummary,
  buildDiffDisplayRows,
  isDisplayBlankLineBlock,
} from '../diffDisplay';
import useRecoveryWorkflow, {
  getBlockRenderedPreviewHtml,
} from '../useRecoveryWorkflow';
import RecoveryPreviewModal from './RecoveryPreviewModal';
import {
  blankLineRunSummaryHtml,
  buildDraftDifferenceNotes,
  formatLayoutWidthVector,
  getDiffBlockHtml,
  getGitHubStyleDiffParts,
} from './recoveryDiffDisplay';

export { buildDiffDisplayRows } from '../diffDisplay';
export { buildRecoveryPreviewHtml } from '../useRecoveryWorkflow';
export {
  buildDraftDifferenceNotes,
  getGitHubStyleDiffParts,
  RecoveryPreviewModal,
};

export function getChangeChoiceActionConfig(diffParts, isActive) {
  const isTableLevelDiff = (diffParts || []).some(
    (part) => part.type === 'table-cell-level'
  );

  return {
    // Large tables can extend well beyond the viewport. Their write-back
    // controls must remain discoverable above the table instead of appearing
    // only after its final row.
    position: isTableLevelDiff ? 'before' : 'after',
    visible: isTableLevelDiff || isActive,
    currentLabel: isTableLevelDiff ? 'Keep current table' : 'Keep current change',
    oldLabel: isTableLevelDiff ? 'Restore old table' : 'Restore old content',
  };
}

function getLayoutWrapperProps(block, useCurrent = true) {
  const renderedBoundary = useCurrent
    ? block.newFullRenderedHtml || block.fullRenderedHtml
    : block.oldFullRenderedHtml || block.fullRenderedHtml;
  const doc = new DOMParser().parseFromString(
    `${renderedBoundary || '<div>'}</div>`,
    'text/html'
  );
  const element = doc.body.firstElementChild;
  if (!element) return {};

  const props = {};
  [
    'data-dh-node-type',
    'data-dh-layout-section',
    'data-dh-layout-type',
    'data-dh-layout-custom-widths',
    'data-dh-layout-cell',
    'data-dh-layout-width',
    'data-dh-layout-weight',
  ].forEach((name) => {
    const value = element.getAttribute(name);
    if (value !== null) props[name] = value;
  });

  return props;
}

function LayoutWidthChangeControl({
  row,
  blockChoices,
  activeBlockKey,
  setActiveBlockKey,
  onChoose,
  onUndo,
}) {
  const key = row.widthChoiceKey;
  const choice = blockChoices.get(key);
  const isActive = activeBlockKey === key;
  const change = row.block.layoutWidthChange;
  const oldWidths = formatLayoutWidthVector(change.oldWidths);
  const newWidths = formatLayoutWidthVector(change.newWidths);

  if (choice) {
    return (
      <div
        className={`dh-layout-width-change dh-layout-width-change--resolved dh-layout-width-change--${choice}`}
      >
        <div>
          <span className="dh-layout-width-change__title">
            Column widths {choice === 'current' ? 'kept' : 'restored'}
          </span>
          <span className="dh-layout-width-change__selected-value">
            {choice === 'current' ? newWidths : oldWidths}
          </span>
        </div>
        <button
          aria-label="Undo this column width choice"
          className="dh-resolved-change-block__undo"
          onClick={() => onUndo(key)}
          title="Undo this column width choice"
          type="button"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      aria-expanded={isActive}
      className={`dh-layout-width-change${
        isActive ? ' dh-layout-width-change--active' : ''
      }`}
      onClick={() =>
        setActiveBlockKey((previous) => (previous === key ? null : key))
      }
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActiveBlockKey((previous) => (previous === key ? null : key));
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="dh-layout-width-change__heading">
        <span className="dh-layout-width-change__title">Column widths changed</span>
        <span className="dh-layout-width-change__hint">
          {change.changedColumnIndexes.length} affected column
          {change.changedColumnIndexes.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="dh-layout-width-change__values">
        <span className="dh-layout-width-change__value dh-layout-width-change__value--old">
          <span aria-hidden="true">-</span> {oldWidths}
        </span>
        <span className="dh-layout-width-change__value dh-layout-width-change__value--current">
          <span aria-hidden="true">+</span> {newWidths}
        </span>
      </div>

      {isActive ? (
        <div
          className="dh-layout-width-change__actions"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="dh-choice-action dh-choice-action--current"
            onClick={() => onChoose(key, 'current')}
            type="button"
          >
            Keep current widths
          </button>
          <button
            className="dh-choice-action"
            onClick={() => onChoose(key, 'old')}
            type="button"
          >
            Restore old widths
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DiffDisplayRows({
  rows,
  blockChoices,
  blockChoiceKeys,
  activeBlockKey,
  setActiveBlockKey,
  onChoose,
  onUndo,
}) {
  return (rows || []).map((row) => {
    if (row.type === 'layout_structure') {
      const wrapperChoiceKey = blockChoiceKeys.get(row.index);
      const wrapperChoice = wrapperChoiceKey
        ? blockChoices.get(wrapperChoiceKey)
        : null;
      const useCurrent = wrapperChoice !== 'old';
      const affectedClassName = row.layoutWidthAffected
        ? `dh-layout-width-affected dh-layout-width-affected--${
            wrapperChoice || 'unresolved'
          }`
        : '';
      const children = (
        <DiffDisplayRows
          rows={row.children}
          blockChoices={blockChoices}
          blockChoiceKeys={blockChoiceKeys}
          activeBlockKey={activeBlockKey}
          setActiveBlockKey={setActiveBlockKey}
          onChoose={onChoose}
          onUndo={onUndo}
        />
      );

      if (row.widthChoiceKey) {
        return (
          <div className="dh-layout-width-change-region" key={row.key}>
            <LayoutWidthChangeControl
              row={row}
              blockChoices={blockChoices}
              activeBlockKey={activeBlockKey}
              setActiveBlockKey={setActiveBlockKey}
              onChoose={onChoose}
              onUndo={onUndo}
            />
            <div {...getLayoutWrapperProps(row.block, useCurrent)}>
              {children}
            </div>
          </div>
        );
      }

      return (
        <div
          className={affectedClassName || undefined}
          key={row.key}
          {...getLayoutWrapperProps(row.block, useCurrent)}
        >
          {children}
        </div>
      );
    }

    const key = row.key;
    if (row.type === 'same') {
      return (
        <div
          className="dh-rich-diff-unchanged"
          key={key}
          dangerouslySetInnerHTML={{ __html: getDiffBlockHtml(row.block) }}
        />
      );
    }

    const choice = blockChoices.get(key);
    if (choice) {
      const blankLineBlocks = row.blocks.map(({ block }) => block);
      const isBlankLineRun = Boolean(
        blankLineBlocks.length && blankLineBlocks.every(isDisplayBlankLineBlock)
      );
      const selectedBlankLineBlocks = isBlankLineRun
        ? blankLineBlocks.filter(
            (block) =>
              block.isBlankLineCountChange ||
              (choice === 'current'
                ? block.type === 'added'
                : block.type === 'removed')
          )
        : [];
      const resolvedHtml = isBlankLineRun
        ? selectedBlankLineBlocks.length
          ? blankLineRunSummaryHtml(
              {
                blankLineCount: selectedBlankLineBlocks.reduce(
                  (count, block) => {
                    if (block.isBlankLineCountChange) {
                      return (
                        count +
                        (choice === 'current'
                          ? block.newBlankLineCount
                          : block.oldBlankLineCount)
                      );
                    }
                    return count + (block.blankLineCount || 1);
                  },
                  0
                ),
              },
              'selected'
            )
          : ''
        : row.blocks
            .map(({ block }) =>
              getBlockRenderedPreviewHtml(block, choice === 'current')
            )
            .join('');

      return (
        <div
          className={`dh-resolved-change-block dh-resolved-change-block--${choice}`}
          key={key}
        >
          <div className="dh-resolved-change-block__status">
            <span>
              {choice === 'current'
                ? 'Current version selected'
                : 'Old version restored'}
            </span>
            <button
              aria-label="Undo this content choice"
              className="dh-resolved-change-block__undo"
              onClick={() => onUndo(key)}
              title="Undo this content choice"
              type="button"
            >
              Undo
            </button>
          </div>
          {resolvedHtml ? (
            <div
              className="dh-resolved-change-block__content"
              dangerouslySetInnerHTML={{ __html: resolvedHtml }}
            />
          ) : (
            <div className="dh-resolved-change-block__empty">
              This content is not present in the selected version.
            </div>
          )}
        </div>
      );
    }

    const isActive = activeBlockKey === key;
    const diffParts = getGitHubStyleDiffParts(row.blocks);
    const actionConfig = getChangeChoiceActionConfig(diffParts, isActive);
    const actionControls = actionConfig.visible ? (
      <div
        className={`dh-choice-diff-module__actions dh-choice-diff-module__actions--${actionConfig.position}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="dh-choice-action dh-choice-action--current"
          onClick={() => onChoose(key, 'current')}
          type="button"
        >
          {actionConfig.currentLabel}
        </button>
        <button
          className="dh-choice-action"
          onClick={() => onChoose(key, 'old')}
          type="button"
        >
          {actionConfig.oldLabel}
        </button>
      </div>
    ) : null;

    return (
      <div
        aria-expanded={isActive}
        className={`dh-choice-diff-module${
          isActive ? ' dh-choice-diff-module--active' : ''
        }`}
        key={key}
        onClick={() =>
          setActiveBlockKey((previous) => (previous === key ? null : key))
        }
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setActiveBlockKey((previous) => (previous === key ? null : key));
          }
        }}
        role="button"
        tabIndex={0}
      >
        {actionConfig.position === 'before' ? actionControls : null}

        {diffParts.map((part, partIndex) => (
          <div
            className={`dh-github-diff-part dh-github-diff-part--${part.type}`}
            key={`${key}-${part.type}-${partIndex}`}
          >
            {!['table-cell-level', 'context'].includes(part.type) ? (
              <span className="dh-github-diff-part__marker">
                {part.type === 'added' ? '+' : '-'}
              </span>
            ) : null}
            <div
              className="dh-github-diff-part__content"
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          </div>
        ))}

        {actionConfig.position === 'after' ? actionControls : null}
      </div>
    );
  });
}

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
  recoveryChoices,
  onPreviewActionChange,
  onSelectableKeysChange,
  onPageUpdated,
  onDiffSummaryChange,
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

  return (
    <ComparisonPanelContent
      pageId={pageId}
      pageTitle={pageTitle}
      baseUrl={baseUrl}
      attachmentsByFilename={attachmentsByFilename}
      currentVersion={currentVersion}
      selectedVersion={selectedVersion}
      recoveryChoices={recoveryChoices}
      onPreviewActionChange={onPreviewActionChange}
      onSelectableKeysChange={onSelectableKeysChange}
      onPageUpdated={onPageUpdated}
      onDiffSummaryChange={onDiffSummaryChange}
    />
  );
}

function ComparisonPanelContent({
  pageId,
  pageTitle,
  baseUrl,
  attachmentsByFilename,
  currentVersion,
  selectedVersion,
  recoveryChoices,
  onPreviewActionChange,
  onSelectableKeysChange,
  onPageUpdated,
  onDiffSummaryChange,
}) {
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [mentionUsersByAccountId, setMentionUsersByAccountId] = useState({});

  const currentBodyValue =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBodyValue =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';
  const mentionAccountIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...extractMentionAccountIds(selectedBodyValue),
          ...extractMentionAccountIds(currentBodyValue),
        ])
      ).slice(0, 100),
    [currentBodyValue, selectedBodyValue]
  );
  const selectedPlainText = storageToPlainText(selectedBodyValue);
  const selectedWordCount = countWords(selectedPlainText);
  const hasComparisonBase = Boolean(currentVersion && selectedVersion);
  const isCurrent =
    currentVersion && selectedVersion.number === currentVersion.number;
  const emptyDiff = useMemo(() => ({
    html: '',
    blocks: [],
    summary: {
      added: 0,
      removed: 0,
      addedBlocks: 0,
      removedBlocks: 0,
      modifiedBlocks: 0,
      unchangedBlocks: 0,
      limited: false,
    },
    added: 0,
    removed: 0,
    limited: false,
  }), []);

  useEffect(() => {
    let cancelled = false;

    if (!mentionAccountIds.length) {
      setMentionUsersByAccountId({});
      return () => {
        cancelled = true;
      };
    }

    async function resolveMentionUsers() {
      try {
        const { requestConfluence } = await import('@forge/bridge');
        const entries = await Promise.all(
          mentionAccountIds.map(async (accountId) => {
            try {
              const response = await requestConfluence(
                `/wiki/rest/api/user?accountId=${encodeURIComponent(accountId)}`,
                { headers: { Accept: 'application/json' } }
              );
              if (!response.ok) return null;

              const user = await response.json();
              return user.displayName ? [accountId, user.displayName] : null;
            } catch (error) {
              return null;
            }
          })
        );

        if (!cancelled) {
          setMentionUsersByAccountId(Object.fromEntries(entries.filter(Boolean)));
        }
      } catch (error) {
        // Local preview has no Forge bridge. The diff remains usable and shows
        // a safe mention placeholder while preserving the original storage.
        if (!cancelled) setMentionUsersByAccountId({});
      }
    }

    resolveMentionUsers();
    return () => {
      cancelled = true;
    };
  }, [mentionAccountIds]);

  const { richDiff, selectedHtml } = useMemo(() => {
    let nextDiff = emptyDiff;
    let nextHtml = '';

    try {
      if (hasComparisonBase && !isCurrent) {
        nextDiff = buildRichTextDiffHtml(
          selectedBodyValue,
          currentBodyValue,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsersByAccountId
        );
        nextHtml = nextDiff.html;
      } else if (hasComparisonBase && isCurrent) {
        const currentPreviewBody = currentBodyValue || selectedBodyValue;

        // Render current-vs-current through the same block pipeline as a real
        // comparison. Complex Confluence storage can contain macros and nested
        // media that are safer to prepare block-by-block than as one large HTML
        // fragment, and the resulting diff still has zero additions/removals.
        nextDiff = buildRichTextDiffHtml(
          currentPreviewBody,
          currentPreviewBody,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsersByAccountId
        );
        nextHtml = nextDiff.html;
      } else {
        nextHtml = prepareConfluenceHtml(
          currentBodyValue || selectedBodyValue,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsersByAccountId
        );
      }
    } catch (e) {
      console.error('[ComparisonPanel] Failed to render diff preview', e);
      nextDiff = {
        ...emptyDiff,
        summary: {
          ...emptyDiff.summary,
          limited: true,
        },
        limited: true,
      };
      nextHtml =
        '<p>The diff preview could not render this Confluence storage format safely.</p>';
    }

    return { richDiff: nextDiff, selectedHtml: nextHtml };
  }, [
    attachmentsByFilename,
    baseUrl,
    currentBodyValue,
    emptyDiff,
    hasComparisonBase,
    isCurrent,
    mentionUsersByAccountId,
    selectedBodyValue,
  ]);

  const diffDisplay = useMemo(
    () => buildDiffDisplayRows(richDiff.blocks || []),
    [richDiff.blocks]
  );
  const selectableBlocks = diffDisplay.selectableRows;

  const createVersionDifferenceNotes = useCallback((draft) => {
    try {
      return {
        ...buildDraftDifferenceNotes(
          currentBodyValue,
          draft.storageHtml,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsersByAccountId
        ),
        error: '',
      };
    } catch (error) {
      console.error('[ComparisonPanel] Failed to build version difference notes', error);
      return {
        diff: emptyDiff,
        display: { rows: [], selectableRows: [], blockChoiceKeys: new Map() },
        error: 'Version Difference Notes could not safely render this Draft.',
      };
    }
  }, [
    attachmentsByFilename,
    baseUrl,
    currentBodyValue,
    emptyDiff,
    mentionUsersByAccountId,
  ]);

  const recovery = useRecoveryWorkflow({
    blocks: richDiff.blocks || [],
    display: diffDisplay,
    pageId,
    selectedVersion,
    currentVersion,
    onPageUpdated,
    createVersionDifferenceNotes,
    recoveryChoices,
  });
  const {
    blockChoices,
    chooseBlock,
    undoChoice,
  } = recovery;

  useEffect(() => {
    setActiveBlockKey(null);
  }, [selectedVersion.number, currentVersion && currentVersion.number]);

  const handleChooseBlockVersion = (key, choice) => {
    chooseBlock(key, choice);
    setActiveBlockKey(null);
  };
  const handleUndoBlockChoice = (key) => {
    undoChoice(key);
    setActiveBlockKey(null);
  };

  const diffSummary = richDiff.summary || {
    added: richDiff.added || 0,
    removed: richDiff.removed || 0,
    modifiedBlocks: 0,
    limited: richDiff.limited || false,
  };
  const totalChanges = diffSummary.added + diffSummary.removed;
  const showChangeSelection = hasComparisonBase && !isCurrent && selectableBlocks.length > 0;

  useEffect(() => {
    if (typeof onSelectableKeysChange !== 'function') return;
    onSelectableKeysChange(
      showChangeSelection ? selectableBlocks.map((row) => row.key) : []
    );
  }, [onSelectableKeysChange, selectableBlocks, showChangeSelection]);

  useEffect(() => {
    if (typeof onPreviewActionChange !== 'function') return undefined;
    onPreviewActionChange(showChangeSelection ? recovery.openPreview : null);
    return () => onPreviewActionChange(null);
  }, [onPreviewActionChange, recovery.openPreview, showChangeSelection]);

  useEffect(() => {
    if (typeof onDiffSummaryChange !== 'function') return;
    onDiffSummaryChange(
      selectedVersion.number,
      buildCanonicalDiffSummary(richDiff, diffDisplay)
    );
  }, [
    diffDisplay,
    diffSummary.added,
    diffSummary.modifiedBlocks,
    diffSummary.removed,
    onDiffSummaryChange,
    richDiff,
    selectedVersion.number,
  ]);



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
              + {diffSummary.added} additions
            </span>
            <span className="dh-change-chip dh-change-chip--removed">
              - {diffSummary.removed} removals
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
        {diffSummary.limited && hasComparisonBase ? (
          <div className="dh-diff-warning">
            Some content is large, so the preview uses a safer line-level comparison where full
            inline highlighting would be too expensive.
          </div>
        ) : null}

        {selectedHtml ? (
          <article className="dh-rich-page">
            {showChangeSelection ? (
              <section className="dh-rendered-page-body">
                <DiffDisplayRows
                  rows={diffDisplay.rows}
                  blockChoices={blockChoices}
                  blockChoiceKeys={diffDisplay.blockChoiceKeys}
                  activeBlockKey={activeBlockKey}
                  setActiveBlockKey={setActiveBlockKey}
                  onChoose={handleChooseBlockVersion}
                  onUndo={handleUndoBlockChoice}
                />
              </section>
            ) : (
              <section
                className="dh-rendered-page-body"
                dangerouslySetInnerHTML={{ __html: selectedHtml }}
              />
            )}
          </article>
        ) : (
          <div className="dh-empty-content">
            Confluence did not return rendered rich content for this version.
          </div>
        )}
      </div>

      <RecoveryPreviewModal workflow={recovery} />
    </div>
  );
}

export default ComparisonPanel;
