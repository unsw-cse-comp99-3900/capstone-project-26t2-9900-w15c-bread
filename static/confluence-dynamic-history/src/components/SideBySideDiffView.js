import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '../diffDisplay';
import useRecoveryWorkflow from '../useRecoveryWorkflow';
import RecoveryPreviewModal from './RecoveryPreviewModal';
import { buildDraftDifferenceNotes } from './recoveryDiffDisplay';
import {
  buildFullDocumentSplitRowsFromDisplay,
  buildFullDocumentSplitStats,
  getSplitRowSideHtml,
  isCellLevelTableRow,
} from './splitDiffModel';
import './SideBySideDiffView.css';

export function getSideBySideBodyState(diff, rows) {
  if (diff && diff.error) return 'error';
  if (diff && diff.limited) return 'limited';
  if (!rows || rows.length === 0) return 'empty';
  return 'rows';
}

export function clampSplitPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 50;
  return Math.min(70, Math.max(30, Math.round(numericValue)));
}

function RichContent({ html }) {
  const trimmed = typeof html === 'string' ? html.trim() : '';
  if (!trimmed) {
    return <div className="sbs-empty">(no content)</div>;
  }
  // The manual renderer needs a `.dh-rich-page` ancestor for panels, lists,
  // decisions, code blocks etc. to get their typography. We keep it INSIDE
  // the pane body so its 24/28 padding can be locally overridden without
  // touching the shared styles.css.
  return (
    <div
      className="dh-rich-page sbs-rich"
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}

function SelectionBadge() {
  return <span className="sbs-selection-badge">Selected for draft</span>;
}

function Pane({ tone, statusLabel, html, selected = false, tableAware = false }) {
  const className = [
    'sbs-pane',
    `sbs-pane--${tone}`,
    tableAware ? 'sbs-pane--table' : '',
    selected ? 'sbs-pane--selected' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={className}>
      {selected ? <SelectionBadge /> : null}
      {statusLabel ? (
        <span className={`sbs-pill sbs-pill--${tone}`}>{statusLabel}</span>
      ) : null}
      <div className="sbs-pane__body">
        <RichContent html={html} />
      </div>
    </div>
  );
}

function Placeholder({ text, selected = false }) {
  return (
    <div className={`sbs-pane sbs-pane--placeholder${selected ? ' sbs-pane--selected' : ''}`}>
      {selected ? <SelectionBadge /> : null}
      <span className="sbs-placeholder-text">{text}</span>
    </div>
  );
}

function DividerControls({ row, choice, onChoose }) {
  if (row.kind === 'unchanged') {
    return <div className="sbs-divider sbs-divider--inert" aria-hidden="true" />;
  }

  return (
    <div className="sbs-divider">
      <button
        type="button"
        className={`sbs-merge-arrow${
          choice === 'old' ? ' sbs-merge-arrow--active' : ''
        }`}
        aria-label="Restore historical content"
        aria-pressed={choice === 'old'}
        title="Use Historical in Draft"
        onClick={() => onChoose(choice === 'old' ? null : 'old')}
      >
        →
      </button>
      <button
        type="button"
        className={`sbs-merge-arrow${
          choice === 'current' ? ' sbs-merge-arrow--active' : ''
        }`}
        aria-label="Keep current content"
        aria-pressed={choice === 'current'}
        title="Use Current in Draft"
        onClick={() => onChoose(choice === 'current' ? null : 'current')}
      >
        ←
      </button>
      {choice ? (
        <button
          type="button"
          className="sbs-merge-undo"
          aria-label="Undo content choice"
          onClick={() => onChoose(null)}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}

function Row({ row, children }) {
  return (
    <div
      className="sbs-row"
      data-split-row-kind={row.kind}
    >
      {children}
    </div>
  );
}

function PaneCol({ side, children }) {
  return (
    <div className="sbs-pane-column" data-split-side={side}>
      {children}
    </div>
  );
}

function formatLayoutWidthVector(widths) {
  const safeWidths = widths || [];
  if (!safeWidths.length || safeWidths.every((width) => !width)) {
    return 'Template default';
  }
  return safeWidths
    .map((width) => {
      const numericWidth = Number.parseFloat(width);
      return Number.isFinite(numericWidth) ? `${numericWidth}%` : 'auto';
    })
    .join(' / ');
}

function SideBySideDiffView({
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
  const [mentionUsers, setMentionUsers] = useState({});
  const [splitPercent, setSplitPercent] = useState(50);
  const [splitDragging, setSplitDragging] = useState(false);
  const splitCanvasRef = useRef(null);

  useEffect(() => {
    if (!splitDragging) return undefined;

    const updateSplit = (event) => {
      if (!splitCanvasRef.current) return;
      const bounds = splitCanvasRef.current.getBoundingClientRect();
      if (!bounds.width) return;
      setSplitPercent(clampSplitPercent(
        ((event.clientX - bounds.left) / bounds.width) * 100
      ));
    };
    const stopDragging = () => setSplitDragging(false);

    window.addEventListener('pointermove', updateSplit);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', updateSplit);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [splitDragging]);

  const handleSplitKeyDown = (event) => {
    let nextSplit = null;
    if (event.key === 'ArrowLeft') nextSplit = splitPercent - 5;
    if (event.key === 'ArrowRight') nextSplit = splitPercent + 5;
    if (event.key === 'Home') nextSplit = 30;
    if (event.key === 'End') nextSplit = 70;
    if (nextSplit === null) return;
    event.preventDefault();
    setSplitPercent(clampSplitPercent(nextSplit));
  };

  const currentBody =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBody =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';

  const mentionIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...extractMentionAccountIds(selectedBody),
          ...extractMentionAccountIds(currentBody),
        ])
      ).slice(0, 100),
    [currentBody, selectedBody]
  );

  useEffect(() => {
    let cancelled = false;
    if (!mentionIds.length) {
      setMentionUsers({});
      return () => {
        cancelled = true;
      };
    }
    async function resolve() {
      try {
        const { requestConfluence } = await import('@forge/bridge');
        const entries = await Promise.all(
          mentionIds.map(async (id) => {
            try {
              const res = await requestConfluence(
                `/wiki/rest/api/user?accountId=${encodeURIComponent(id)}`,
                { headers: { Accept: 'application/json' } }
              );
              if (!res.ok) return null;
              const user = await res.json();
              return user.displayName ? [id, user.displayName] : null;
            } catch (e) {
              return null;
            }
          })
        );
        if (!cancelled) setMentionUsers(Object.fromEntries(entries.filter(Boolean)));
      } catch (e) {
        if (!cancelled) setMentionUsers({});
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [mentionIds]);

  const hasBase = Boolean(currentVersion && selectedVersion);
  const isCurrent =
    currentVersion && selectedVersion && selectedVersion.number === currentVersion.number;

  const diff = useMemo(() => {
    if (!hasBase) return { blocks: [], limited: false };
    try {
      return buildRichTextDiffHtml(
        selectedBody,
        currentBody,
        baseUrl,
        attachmentsByFilename || {},
        mentionUsers
      );
    } catch (e) {
      return { blocks: [], limited: false, error: e.message };
    }
  }, [hasBase, selectedBody, currentBody, baseUrl, attachmentsByFilename, mentionUsers]);

  const diffDisplay = useMemo(
    () => buildDiffDisplayRows(diff.blocks || []),
    [diff.blocks]
  );
  const rows = useMemo(
    () => buildFullDocumentSplitRowsFromDisplay(diffDisplay),
    [diffDisplay]
  );

  const createVersionDifferenceNotes = useCallback((draft) => {
    try {
      return {
        ...buildDraftDifferenceNotes(
          currentBody,
          draft.storageHtml,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsers
        ),
        error: '',
      };
    } catch (error) {
      return {
        diff: { summary: { added: 0, removed: 0, modifiedBlocks: 0, limited: true } },
        display: { selectableRows: [] },
        error: 'Version Difference Notes could not safely render this Draft.',
      };
    }
  }, [attachmentsByFilename, baseUrl, currentBody, mentionUsers]);

  const recovery = useRecoveryWorkflow({
    blocks: diff.blocks || [],
    display: diffDisplay,
    pageId,
    selectedVersion,
    currentVersion,
    onPageUpdated,
    createVersionDifferenceNotes,
    recoveryChoices,
  });

  const recoveryIsAvailable = Boolean(
    diffDisplay.selectableRows.length && !diff.limited && !diff.error
  );

  useEffect(() => {
    if (typeof onSelectableKeysChange !== 'function') return;
    onSelectableKeysChange(
      recoveryIsAvailable ? diffDisplay.selectableRows.map((row) => row.key) : []
    );
  }, [diffDisplay.selectableRows, onSelectableKeysChange, recoveryIsAvailable]);

  useEffect(() => {
    if (typeof onPreviewActionChange !== 'function') return undefined;
    onPreviewActionChange(recoveryIsAvailable ? recovery.openPreview : null);
    return () => onPreviewActionChange(null);
  }, [onPreviewActionChange, recovery.openPreview, recoveryIsAvailable]);

  const stats = useMemo(() => buildFullDocumentSplitStats(rows), [rows]);

  useEffect(() => {
    if (typeof onDiffSummaryChange !== 'function' || !selectedVersion) return;
    onDiffSummaryChange(
      selectedVersion.number,
      buildCanonicalDiffSummary(diff, diffDisplay)
    );
  }, [diff, diffDisplay, onDiffSummaryChange, selectedVersion]);

  const selectedPlain = useMemo(
    () => storageToPlainText(selectedBody),
    [selectedBody]
  );
  const selectedWordCount = useMemo(() => countWords(selectedPlain), [selectedPlain]);
  const selectedHtmlChars = selectedBody ? selectedBody.length : 0;
  const bodyState = getSideBySideBodyState(diff, rows);
  const limitedCurrentHtml = useMemo(
    () => diff.limited
      ? prepareConfluenceHtml(
          currentBody,
          baseUrl,
          attachmentsByFilename || {},
          mentionUsers
        )
      : '',
    [attachmentsByFilename, baseUrl, currentBody, diff.limited, mentionUsers]
  );

  if (!hasBase) {
    return (
      <div className="sbs">
        <div className="sbs-state">Select a version to compare.</div>
      </div>
    );
  }

  if (isCurrent) {
    const html = prepareConfluenceHtml(
      currentBody,
      baseUrl,
      attachmentsByFilename || {},
      mentionUsers
    );
    return (
      <div className="sbs">
        <div className="sbs-state">
          <div
            className="dh-rich-page"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    );
  }

  const oldLabel = `Historical / v${selectedVersion.number}`;
  const newLabel = `Current / v${currentVersion.number}`;

  return (
    <div className="sbs">
      <div className="sbs-header">
        <div className="sbs-vchips">
          <span className="sbs-vchip">v{selectedVersion.number}</span>
          <span className="sbs-vs">vs</span>
          <span className="sbs-vchip sbs-vchip--current">
            v{currentVersion.number} · Current
          </span>
        </div>

        <div className="sbs-meta">
          {pageTitle ? <span>{pageTitle}</span> : null}
          {selectedVersion.authorName ? (
            <span>Edited by {selectedVersion.authorName}</span>
          ) : null}
          {selectedVersion.createdAt ? (
            <span>{formatDateTime(selectedVersion.createdAt)}</span>
          ) : null}
          <span>{selectedWordCount} words</span>
          <span>{selectedHtmlChars} HTML chars</span>
          {pageId ? <span>Page {pageId}</span> : null}
        </div>

        <div className="sbs-stats">
          <span className="sbs-stat sbs-stat--added">+ {stats.additions} additions</span>
          <span className="sbs-stat sbs-stat--deleted">- {stats.removals} removals</span>
          <span className="sbs-stat sbs-stat--modified">{stats.modified} modified</span>
          <span className="sbs-stat sbs-stat--total">{stats.total} total changes</span>
        </div>
      </div>

      {diff.limited ? (
        <div className="sbs-banner">
          This comparison is too large for a full diff — showing the current version only.
        </div>
      ) : null}

      {bodyState === 'error' ? (
        <div className="sbs-state sbs-state--error">
          The comparison could not safely render this Confluence content: {diff.error}
        </div>
      ) : bodyState === 'limited' ? (
        <div className="sbs-state">
          <RichContent html={limitedCurrentHtml} />
        </div>
      ) : bodyState === 'empty' ? (
        <div className="sbs-state">No differences to display.</div>
      ) : (
        <div className="sbs-document-scroll">
          <div
            className="sbs-document-canvas"
            ref={splitCanvasRef}
            style={{
              '--sbs-left-fr': `${splitPercent}fr`,
              '--sbs-right-fr': `${100 - splitPercent}fr`,
            }}
          >
            <div className="sbs-row sbs-row--headings">
              <div className="sbs-heading">{oldLabel}</div>
              <div className="sbs-divider sbs-divider--heading">
                <div
                  aria-label="Resize comparison panes"
                  aria-orientation="vertical"
                  aria-valuemax="70"
                  aria-valuemin="30"
                  aria-valuenow={splitPercent}
                  className="sbs-split-handle"
                  onDoubleClick={() => setSplitPercent(50)}
                  onKeyDown={handleSplitKeyDown}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setSplitDragging(true);
                  }}
                  role="separator"
                  tabIndex={0}
                  title="Drag to resize panes; double-click to reset"
                />
              </div>
              <div className="sbs-heading">{newLabel}</div>
            </div>

            <div className="sbs-rows">
              {rows.map((row, index) => {
                const choiceKey = row.key || `${row.kind}-${row.indices.join('-')}-${index}`;
                const renderKey = choiceKey;
                const choice = recovery.blockChoices.get(choiceKey);
                const historicalSelected = choice === 'old';
                const currentSelected = choice === 'current';
                const onChoose = (next) => {
                  if (next == null) recovery.undoChoice(choiceKey);
                  else recovery.chooseBlock(choiceKey, next);
                };

                let historicalPane;
                let currentPane;
                if (row.kind === 'layout-width') {
                  historicalPane = (
                    <Pane
                      tone="modified"
                      statusLabel="Old widths"
                      html={`<p>${formatLayoutWidthVector(row.layoutWidthChange.oldWidths)}</p>`}
                      selected={historicalSelected}
                    />
                  );
                  currentPane = (
                    <Pane
                      tone="modified"
                      statusLabel="Current widths"
                      html={`<p>${formatLayoutWidthVector(row.layoutWidthChange.newWidths)}</p>`}
                      selected={currentSelected}
                    />
                  );
                } else if (row.kind === 'historical-only') {
                  historicalPane = (
                    <Pane
                      tone="deleted"
                      statusLabel="Removed"
                      html={getSplitRowSideHtml(row, 'historical')}
                      selected={historicalSelected}
                    />
                  );
                  currentPane = (
                    <Placeholder
                      text="Not present in Current"
                      selected={currentSelected}
                    />
                  );
                } else if (row.kind === 'current-only') {
                  historicalPane = (
                    <Placeholder
                      text="Not present in Historical"
                      selected={historicalSelected}
                    />
                  );
                  currentPane = (
                    <Pane
                      tone="added"
                      statusLabel="Added"
                      html={getSplitRowSideHtml(row, 'current')}
                      selected={currentSelected}
                    />
                  );
                } else {
                  const unchanged = row.kind === 'unchanged';
                  const tableAware = isCellLevelTableRow(row);
                  historicalPane = (
                    <Pane
                      tone={unchanged ? 'same' : 'modified'}
                      statusLabel={unchanged ? '' : 'Modified'}
                      html={getSplitRowSideHtml(row, 'historical')}
                      selected={historicalSelected}
                      tableAware={tableAware}
                    />
                  );
                  currentPane = (
                    <Pane
                      tone={unchanged ? 'same' : 'modified'}
                      statusLabel={unchanged ? '' : 'Modified'}
                      html={getSplitRowSideHtml(row, 'current')}
                      selected={currentSelected}
                      tableAware={tableAware}
                    />
                  );
                }

                return (
                  <Row key={renderKey} row={row}>
                    <PaneCol side="historical">{historicalPane}</PaneCol>
                    <DividerControls row={row} choice={choice} onChoose={onChoose} />
                    <PaneCol side="current">{currentPane}</PaneCol>
                  </Row>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <RecoveryPreviewModal workflow={recovery} />
    </div>
  );
}

export default SideBySideDiffView;
