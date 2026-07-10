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

function blockGroupSelectionKey(indices) {
  return indices.map((index) => blockSelectionKey(index)).join(':');
}

function canShareChoice(removedBlock, addedBlock) {
  if (!removedBlock || !addedBlock) return false;
  if (removedBlock.type !== 'removed' || addedBlock.type !== 'added') return false;

  // The diff engine intentionally emits changed content as two simple result
  // blocks: the old block is removed and the new block is added. When those two
  // adjacent blocks occupy the same semantic role, the UI should treat them as
  // one recovery decision while still preserving the underlying result model.
  return (
    removedBlock.nodeType === addedBlock.nodeType &&
    removedBlock.tag === addedBlock.tag
  );
}

function createChangeDisplayRow(items, blockChoiceKeys) {
  const indices = items.map(({ index }) => index);
  const key = blockGroupSelectionKey(indices);

  indices.forEach((blockIndex) => blockChoiceKeys.set(blockIndex, key));

  return {
    type: 'change',
    key,
    blocks: items,
  };
}

function buildChangeRunRows(items, blockChoiceKeys) {
  const removedItems = items.filter(({ block }) => block.type === 'removed');
  const addedItems = items.filter(({ block }) => block.type === 'added');

  // LCS-based diff output can represent one changed region as all removed
  // blocks followed by all added blocks. Pair compatible old and new blocks
  // within that region so each logical replacement has one recovery choice.
  const unusedAddedItems = new Set(addedItems);
  const groupedItems = removedItems.map((removedItem) => {
    const addedItem = addedItems.find(
      (candidate) =>
        unusedAddedItems.has(candidate) &&
        canShareChoice(removedItem.block, candidate.block)
    );

    if (!addedItem) return [removedItem];

    unusedAddedItems.delete(addedItem);
    return [removedItem, addedItem];
  });

  const usedItems = new Set(groupedItems.flat());
  const displayGroups = [
    ...groupedItems,
    ...items.filter((item) => !usedItems.has(item)).map((item) => [item]),
  ];

  // Sort groups by their first source position. Inside a paired group, the
  // removed block deliberately remains before the added block.
  return displayGroups
    .sort((left, right) => {
      const leftIndex = Math.min(...left.map(({ index }) => index));
      const rightIndex = Math.min(...right.map(({ index }) => index));
      return leftIndex - rightIndex;
    })
    .map((group) => createChangeDisplayRow(group, blockChoiceKeys));
}

function buildDiffDisplayRows(blocks) {
  const rows = [];
  const blockChoiceKeys = new Map();

  for (let index = 0; index < (blocks || []).length; index++) {
    const block = blocks[index];

    if (!CHANGE_BLOCK_TYPES.has(block.type)) {
      rows.push({
        type: 'same',
        key: blockSelectionKey(index),
        block,
        index,
      });
      continue;
    }

    const changeRun = [];
    let runIndex = index;

    while (
      runIndex < blocks.length &&
      CHANGE_BLOCK_TYPES.has(blocks[runIndex].type)
    ) {
      changeRun.push({ block: blocks[runIndex], index: runIndex });
      runIndex++;
    }

    rows.push(...buildChangeRunRows(changeRun, blockChoiceKeys));
    index = runIndex - 1;
  }

  return {
    rows,
    selectableRows: rows.filter((row) => row.type === 'change'),
    blockChoiceKeys,
  };
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
    // The preview starts from the historical version. Applying a removal
    // therefore omits the old block; leaving it unselected preserves it.
    return selected ? '' : block.oldHtml || block.renderedHtml || fallbackTextHtml(block.text);
  }

  if (block.type === 'modified') {
    if (selected) {
      return block.newHtml || block.renderedHtml || fallbackTextHtml(block.newText);
    }

    return block.oldHtml || fallbackTextHtml(block.oldText);
  }

  return block.renderedHtml || block.html || '';
}

function buildDraftPreviewHtml(blocks, blockChoices, blockChoiceKeys = new Map()) {
  return (blocks || [])
    .map((block, index) => {
      // Unresolved changes keep the current version by default. A user choice
      // only changes the draft when they explicitly restore the old content.
      const choiceKey = blockChoiceKeys.get(index) || blockSelectionKey(index);
      const choice = blockChoices.get(choiceKey);
      return getBlockPreviewHtml(block, choice !== 'old');
    })
    .join('');
}

function getDiffBlockHtml(block) {
  return (
    block.renderedHtml ||
    block.newRenderedHtml ||
    block.oldRenderedHtml ||
    block.newHtml ||
    block.oldHtml ||
    block.html ||
    fallbackTextHtml(block.newText || block.oldText || block.text)
  );
}

function getGitHubStyleDiffParts(blockOrBlocks) {
  if (Array.isArray(blockOrBlocks)) {
    return blockOrBlocks.flatMap(({ block }) => getGitHubStyleDiffParts(block));
  }

  const block = blockOrBlocks;

  if (block.type === 'added') {
    return [{
      type: 'added',
      html: block.renderedHtml || block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.text),
    }];
  }

  if (block.type === 'removed') {
    return [{
      type: 'removed',
      html: block.renderedHtml || block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.text),
    }];
  }

  // Internally the diff engine still identifies a related old/new pair as a
  // modified block. The UI deliberately presents it as GitHub-style removal
  // and addition rows so users only need to understand "-" and "+".
  return [
    {
      type: 'removed',
      html: block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.oldText),
    },
    {
      type: 'added',
      html: block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.newText),
    },
  ];
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
  const [blockChoices, setBlockChoices] = useState(new Map());
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [draftPreview, setDraftPreview] = useState(null);
  const [draftCreation, setDraftCreation] = useState({
    status: 'idle',
    error: '',
    draft: null,
  });

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

  const diffDisplay = useMemo(
    () => buildDiffDisplayRows(richDiff.blocks || []),
    [richDiff.blocks]
  );
  const selectableBlocks = diffDisplay.selectableRows;

  useEffect(() => {
    setBlockChoices(new Map());
    setActiveBlockKey(null);
    setDraftPreview(null);
    setDraftCreation({ status: 'idle', error: '', draft: null });
  }, [selectableBlocks, selectedVersion.number, currentVersion && currentVersion.number]);

  useEffect(() => {
    if (!draftPreview) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && draftCreation.status !== 'loading') {
        setDraftPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftCreation.status, draftPreview]);

  const handleChooseBlockVersion = (key, choice) => {
    setBlockChoices((previous) => {
      const next = new Map(previous);
      next.set(key, choice);
      return next;
    });
    setActiveBlockKey(null);
  };

  const handleUndoBlockChoice = (key) => {
    setBlockChoices((previous) => {
      const next = new Map(previous);
      next.delete(key);
      return next;
    });
    setActiveBlockKey(null);
  };

  const previewHtml = useMemo(
    () => buildDraftPreviewHtml(richDiff.blocks || [], blockChoices, diffDisplay.blockChoiceKeys),
    [blockChoices, diffDisplay.blockChoiceKeys, richDiff.blocks]
  );

  const diffSummary = richDiff.summary || {
    added: richDiff.added || 0,
    removed: richDiff.removed || 0,
    modifiedBlocks: 0,
    limited: richDiff.limited || false,
  };
  const totalChanges = diffSummary.added + diffSummary.removed;
  const showChangeSelection = hasComparisonBase && !isCurrent && selectableBlocks.length > 0;

  const handlePreviewDraft = () => {
    const draft = {
      selectedVersionNumber: selectedVersion.number,
      currentVersionNumber: currentVersion ? currentVersion.number : null,
      changeChoices: selectableBlocks.map((row) => ({
        blockIndices: row.blocks.map(({ index }) => index),
        choice: blockChoices.get(row.key) || 'current',
      })),
      previewHtml,
      createdAt: new Date().toISOString(),
    };

    setDraftCreation({ status: 'idle', error: '', draft: null });
    setDraftPreview(draft);
  };

  const handleConfirmCreateDraft = async () => {
    if (!draftPreview || draftCreation.status === 'loading') return;

    setDraftCreation({ status: 'loading', error: '', draft: null });

    try {
      const { invoke } = await import('@forge/bridge');
      const createdDraft = await invoke('createDraft', {
        pageId,
        bodyValue: draftPreview.previewHtml,
      });

      if (!createdDraft || !createdDraft.id) {
        throw new Error('Confluence did not return the created draft details.');
      }

      setDraftCreation({
        status: 'success',
        error: '',
        draft: createdDraft,
      });
    } catch (error) {
      setDraftCreation({
        status: 'error',
        error: error && error.message
          ? error.message
          : 'Confluence could not create the draft.',
        draft: null,
      });
    }
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
            <span className="dh-change-chip">{totalChanges} total changes</span>
          </>
        ) : (
          <span className="dh-change-chip">
            Current version shown as a full content preview
          </span>
        )}
      </div>

      <div className="dh-content-panel">
        {showChangeSelection ? (
          <div className="dh-inline-selection-toolbar">
            <div>
              <h2 className="dh-inline-selection-toolbar__title">Choose content versions</h2>
              <p className="dh-inline-selection-toolbar__meta">
                {blockChoices.size} of {selectableBlocks.length} changes decided
              </p>
            </div>

            <div className="dh-inline-selection-toolbar__actions">
              <button className="dh-primary-button" type="button" onClick={handlePreviewDraft}>
                Preview Draft
              </button>
            </div>
          </div>
        ) : null}

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
                {diffDisplay.rows.map((row) => {
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
                    const resolvedHtml = row.blocks
                      .map(({ block }) => getBlockPreviewHtml(block, choice === 'current'))
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
                            onClick={() => handleUndoBlockChoice(key)}
                            title="Undo this content choice"
                            type="button"
                          >
                            ↶
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
                      {diffParts.map((part, partIndex) => (
                        <div
                          className={`dh-github-diff-part dh-github-diff-part--${part.type}`}
                          key={`${key}-${part.type}-${partIndex}`}
                        >
                          <span className="dh-github-diff-part__marker">
                            {part.type === 'added' ? '+' : '-'}
                          </span>
                          <div
                            className="dh-github-diff-part__content"
                            dangerouslySetInnerHTML={{ __html: part.html }}
                          />
                        </div>
                      ))}

                      {isActive ? (
                        <div
                          className="dh-choice-diff-module__actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            className="dh-choice-action dh-choice-action--current"
                            onClick={() => handleChooseBlockVersion(key, 'current')}
                            type="button"
                          >
                            Keep current change
                          </button>
                          <button
                            className="dh-choice-action"
                            onClick={() => handleChooseBlockVersion(key, 'old')}
                            type="button"
                          >
                            Restore old content
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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

      {draftPreview ? (
        <div
          className="dh-draft-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              draftCreation.status !== 'loading'
            ) {
              setDraftPreview(null);
            }
          }}
        >
          <section
            aria-labelledby="dh-draft-preview-title"
            aria-modal="true"
            className="dh-draft-modal"
            role="dialog"
          >
            <header className="dh-draft-modal__header">
              <div>
                <h2 className="dh-draft-modal__title" id="dh-draft-preview-title">
                  Draft Preview
                </h2>
                <p className="dh-draft-modal__meta">
                  v{draftPreview.selectedVersionNumber} selection to
                  {' '}v{draftPreview.currentVersionNumber || '?'}
                </p>
              </div>
              <button
                aria-label="Close draft preview"
                className="dh-draft-modal__close"
                disabled={draftCreation.status === 'loading'}
                onClick={() => setDraftPreview(null)}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="dh-draft-modal__body">
              {draftPreview.previewHtml ? (
                <article className="dh-rich-page dh-rich-page--preview">
                  <section
                    className="dh-rendered-page-body"
                    dangerouslySetInnerHTML={{ __html: draftPreview.previewHtml }}
                  />
                </article>
              ) : (
                <div className="dh-empty-content">
                  No selected changes are available for the draft preview.
                </div>
              )}
            </div>

            <footer className="dh-draft-modal__footer">
              <div className="dh-draft-modal__result" aria-live="polite">
                {draftCreation.status === 'idle'
                  ? 'Review the result, then create an unpublished Confluence draft.'
                  : null}
                {draftCreation.status === 'loading'
                  ? 'Creating the Confluence draft…'
                  : null}
                {draftCreation.status === 'error' ? (
                  <span className="dh-draft-modal__result--error">
                    {draftCreation.error}
                  </span>
                ) : null}
                {draftCreation.status === 'success' ? (
                  <span className="dh-draft-modal__result--success">
                    Draft “{draftCreation.draft.title}” was created.
                  </span>
                ) : null}
              </div>

              <div className="dh-draft-modal__footer-actions">
                <button
                  disabled={draftCreation.status === 'loading'}
                  type="button"
                  onClick={() => setDraftPreview(null)}
                >
                  Back to changes
                </button>

                {draftCreation.status === 'success' ? (
                  draftCreation.draft.url ? (
                    <a
                      className="dh-primary-button"
                      href={draftCreation.draft.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Confluence draft
                    </a>
                  ) : null
                ) : (
                  <button
                    className="dh-primary-button"
                    disabled={draftCreation.status === 'loading'}
                    onClick={handleConfirmCreateDraft}
                    type="button"
                  >
                    {draftCreation.status === 'loading'
                      ? 'Creating…'
                      : 'Create Confluence Draft'}
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ComparisonPanel;
