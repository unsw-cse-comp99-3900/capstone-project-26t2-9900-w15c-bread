import React, { useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';

const CHANGE_BLOCK_TYPES = new Set(['added', 'removed', 'modified']);

function blockSelectionKey(index) {
  // Sprint 1 uses the diff block index as the selection id. Keep this isolated
  // so a later stable block id can replace it without touching the UI logic.
  return String(index);
}

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

function getBlockPreviewHtml(block, selected) {
  if (!block) return '';

  if (block.type === 'same') {
    return block.html || block.renderedHtml || '';
  }

  if (block.type === 'added') {
    return selected ? block.newHtml || block.renderedHtml || fallbackTextHtml(block.text) : '';
  }

  if (block.type === 'removed') {
    return selected ? block.oldHtml || block.renderedHtml || fallbackTextHtml(block.text) : '';
  }

  if (block.type === 'modified') {
    if (selected) {
      return block.newHtml || block.renderedHtml || fallbackTextHtml(block.newText);
    }

    return block.oldHtml || fallbackTextHtml(block.oldText);
  }

  return block.renderedHtml || block.html || '';
}

function buildSelectedPreviewHtml(blocks, selectedBlockKeys) {
  return (blocks || [])
    .map((block, index) =>
      getBlockPreviewHtml(block, selectedBlockKeys.has(blockSelectionKey(index)))
    )
    .join('');
}

function describeBlock(block) {
  const text = block.newText || block.oldText || block.text || '';
  if (text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 140);
  }

  if (block.nodeType === 'table') return 'Table change';
  if (block.nodeType === 'code_block') return 'Code block change';
  if (block.nodeType === 'image') return 'Image change';
  return `${block.nodeType || block.tag || 'Content'} change`;
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
}) {
  const [selectedBlockKeys, setSelectedBlockKeys] = useState(new Set());
  const [selectionHistory, setSelectionHistory] = useState([]);

  const currentBodyValue =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBodyValue =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';
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
  const { richDiff, selectedHtml } = useMemo(() => {
    let nextDiff = emptyDiff;
    let nextHtml = '';

    try {
      if (hasComparisonBase && !isCurrent) {
        nextDiff = buildRichTextDiffHtml(
          selectedBodyValue,
          currentBodyValue,
          baseUrl,
          attachmentsByFilename || {}
        );
        nextHtml = nextDiff.html;
      } else {
        nextHtml = prepareConfluenceHtml(
          currentBodyValue || selectedBodyValue,
          baseUrl,
          attachmentsByFilename || {}
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
    selectedBodyValue,
  ]);

  const selectableBlocks = useMemo(
    () =>
      (richDiff.blocks || [])
        .map((block, index) => ({ block, index, key: blockSelectionKey(index) }))
        .filter(({ block }) => CHANGE_BLOCK_TYPES.has(block.type)),
    [richDiff.blocks]
  );
  const allSelectableKeys = useMemo(
    () => selectableBlocks.map(({ key }) => key),
    [selectableBlocks]
  );

  useEffect(() => {
    setSelectedBlockKeys(new Set(allSelectableKeys));
    setSelectionHistory([]);
  }, [allSelectableKeys, selectedVersion.number, currentVersion && currentVersion.number]);

  const updateSelection = (createNextSelection) => {
    setSelectedBlockKeys((previous) => {
      const next = createNextSelection(previous);
      setSelectionHistory((history) => [...history, new Set(previous)]);
      return next;
    });
  };

  const handleToggleBlock = (key) => {
    updateSelection((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    updateSelection(() => new Set(allSelectableKeys));
  };

  const handleDeselectAll = () => {
    updateSelection(() => new Set());
  };

  const handleResetSelection = () => {
    updateSelection(() => new Set(allSelectableKeys));
  };

  const handleUndoSelection = () => {
    setSelectionHistory((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setSelectedBlockKeys(new Set(previous));
      return history.slice(0, -1);
    });
  };

  const previewHtml = useMemo(
    () => buildSelectedPreviewHtml(richDiff.blocks || [], selectedBlockKeys),
    [richDiff.blocks, selectedBlockKeys]
  );

  const diffSummary = richDiff.summary || {
    added: richDiff.added || 0,
    removed: richDiff.removed || 0,
    modifiedBlocks: 0,
    limited: richDiff.limited || false,
  };
  const totalChanges = diffSummary.added + diffSummary.removed;
  const showChangeSelection = hasComparisonBase && !isCurrent && selectableBlocks.length > 0;

  const handleCreateDraft = () => {
    const draft = {
      selectedVersionNumber: selectedVersion.number,
      currentVersionNumber: currentVersion ? currentVersion.number : null,
      selectedBlockIndexes: selectableBlocks
        .filter(({ key }) => selectedBlockKeys.has(key))
        .map(({ index }) => index),
      previewHtml,
      createdAt: new Date().toISOString(),
    };

    console.log('[Dynamic History] Draft created', draft);
  };

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
            <span className="dh-change-chip">{diffSummary.modifiedBlocks} modified blocks</span>
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

      {showChangeSelection ? (
        <div className="dh-selection-layout">
          <section className="dh-selection-panel">
            <div className="dh-selection-panel__header">
              <div>
                <h2 className="dh-selection-panel__title">Change Selection</h2>
                <p className="dh-selection-panel__meta">
                  {selectedBlockKeys.size} of {selectableBlocks.length} changes selected
                </p>
              </div>
              <button className="dh-primary-button" type="button" onClick={handleCreateDraft}>
                Create Draft
              </button>
            </div>

            <div className="dh-selection-actions">
              <button type="button" onClick={handleSelectAll}>Select all</button>
              <button type="button" onClick={handleDeselectAll}>Deselect all</button>
              <button type="button" onClick={handleResetSelection}>Reset</button>
              <button
                type="button"
                onClick={handleUndoSelection}
                disabled={!selectionHistory.length}
              >
                Undo
              </button>
            </div>

            <div className="dh-selection-list">
              {selectableBlocks.map(({ block, index, key }) => (
                <label
                  className={`dh-selection-item dh-selection-item--${block.type}`}
                  key={key}
                >
                  <input
                    type="checkbox"
                    checked={selectedBlockKeys.has(key)}
                    onChange={() => handleToggleBlock(key)}
                  />
                  <span className="dh-selection-item__body">
                    <span className="dh-selection-item__topline">
                      <span className="dh-selection-item__type">{block.type}</span>
                      <span>Block {index + 1}</span>
                      <span>{block.nodeType || block.tag || 'content'}</span>
                    </span>
                    <span className="dh-selection-item__text">{describeBlock(block)}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="dh-preview-panel">
            <div className="dh-preview-panel__header">
              <h2 className="dh-preview-panel__title">Live Preview</h2>
              <span className="dh-preview-panel__meta">
                v{selectedVersion.number} selection to v{currentVersion ? currentVersion.number : '?'}
              </span>
            </div>

            {previewHtml ? (
              <article className="dh-rich-page dh-rich-page--preview">
                <section
                  className="dh-rendered-page-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </article>
            ) : (
              <div className="dh-empty-content">
                No selected changes are available for the preview.
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ComparisonPanel;
