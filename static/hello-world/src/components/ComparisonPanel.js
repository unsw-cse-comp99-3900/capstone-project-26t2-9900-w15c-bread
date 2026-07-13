import React, { useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  extractMentionAccountIds,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';
import { buildRecoveryStorageHtml } from '../recoveryStorage';

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

function nestStructuralDisplayRows(rows) {
  const root = [];
  const stack = [{ children: root, wrapperTag: '' }];

  rows.forEach((row) => {
    const block = row.type === 'same' ? row.block : null;
    if (!block || !block.isStructuralBoundary) {
      stack[stack.length - 1].children.push(row);
      return;
    }

    if (block.layoutBoundaryEdge === 'start') {
      const wrapper = {
        type: 'layout_structure',
        key: row.key,
        block,
        wrapperTag: block.layoutWrapperTag,
        children: [],
      };
      stack[stack.length - 1].children.push(wrapper);
      stack.push(wrapper);
      return;
    }

    if (
      block.layoutBoundaryEdge === 'end' &&
      stack.length > 1 &&
      stack[stack.length - 1].wrapperTag === block.layoutWrapperTag
    ) {
      stack.pop();
    }
  });

  return root;
}

function collectSelectableDisplayRows(rows) {
  return rows.flatMap((row) => {
    if (row.type === 'layout_structure') {
      return collectSelectableDisplayRows(row.children || []);
    }
    return row.type === 'change' ? [row] : [];
  });
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

  const nestedRows = nestStructuralDisplayRows(rows);

  return {
    rows: nestedRows,
    selectableRows: collectSelectableDisplayRows(nestedRows),
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

function getBlockRenderedPreviewHtml(block, selected) {
  if (!block) return '';

  if (block.isStructuralBoundary) {
    return block.fullRenderedHtml || '';
  }

  if (block.type === 'same') {
    return block.renderedHtml || block.html || '';
  }

  if (block.type === 'added') {
    return selected ? block.renderedHtml || fallbackTextHtml(block.text) : '';
  }

  if (block.type === 'removed') {
    return selected ? '' : block.renderedHtml || fallbackTextHtml(block.text);
  }

  if (block.type === 'modified') {
    return selected
      ? block.newRenderedHtml || block.renderedHtml || fallbackTextHtml(block.newText)
      : block.oldRenderedHtml || fallbackTextHtml(block.oldText);
  }

  return block.renderedHtml || fallbackTextHtml(block.text);
}

export function buildRecoveryPreviewHtml(
  blocks,
  blockChoices = new Map(),
  blockChoiceKeys = new Map()
) {
  return (blocks || [])
    .map((block, index) => {
      const choiceKey = blockChoiceKeys.get(index) || blockSelectionKey(index);
      const useCurrent = (blockChoices.get(choiceKey) || 'current') !== 'old';

      // Preview the already-rendered Diff unit exactly once. The write-back
      // Storage intentionally contains both an ADF Decision and its fallback;
      // rendering that reconstructed Storage here was the post-merge change
      // that made two Decisions appear as four in Draft Preview.
      return getBlockRenderedPreviewHtml(block, useCurrent);
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

function getLayoutWrapperProps(block) {
  const doc = new DOMParser().parseFromString(
    `${block.fullRenderedHtml || '<div>'}</div>`,
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
  ].forEach((name) => {
    const value = element.getAttribute(name);
    if (value !== null) props[name] = value;
  });

  const gridTemplateColumns = element.style && element.style.gridTemplateColumns;
  if (gridTemplateColumns) {
    props.style = { gridTemplateColumns };
  }

  return props;
}

function DiffDisplayRows({
  rows,
  blockChoices,
  activeBlockKey,
  setActiveBlockKey,
  onChoose,
  onUndo,
}) {
  return (rows || []).map((row) => {
    if (row.type === 'layout_structure') {
      return (
        <div key={row.key} {...getLayoutWrapperProps(row.block)}>
          <DiffDisplayRows
            rows={row.children}
            blockChoices={blockChoices}
            activeBlockKey={activeBlockKey}
            setActiveBlockKey={setActiveBlockKey}
            onChoose={onChoose}
            onUndo={onUndo}
          />
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
      const resolvedHtml = row.blocks
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
              onClick={() => onChoose(key, 'current')}
              type="button"
            >
              Keep current change
            </button>
            <button
              className="dh-choice-action"
              onClick={() => onChoose(key, 'old')}
              type="button"
            >
              Restore old content
            </button>
          </div>
        ) : null}
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
  onPageUpdated,
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
      onPageUpdated={onPageUpdated}
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
  onPageUpdated,
}) {
  const [blockChoices, setBlockChoices] = useState(new Map());
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [draftPreview, setDraftPreview] = useState(null);
  const [writeBack, setWriteBack] = useState({
    status: 'idle',
    error: '',
    page: null,
  });
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

  useEffect(() => {
    setBlockChoices(new Map());
    setActiveBlockKey(null);
    setDraftPreview(null);
    setWriteBack({ status: 'idle', error: '', page: null });
  }, [selectableBlocks, selectedVersion.number, currentVersion && currentVersion.number]);

  useEffect(() => {
    if (!draftPreview) return undefined;

    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        writeBack.status !== 'loading'
      ) {
        setDraftPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPreview, writeBack.status]);

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

  const recoveryStorage = useMemo(
    () =>
      buildRecoveryStorageHtml(
        richDiff.blocks || [],
        blockChoices,
        diffDisplay.blockChoiceKeys
      ),
    [blockChoices, diffDisplay.blockChoiceKeys, richDiff.blocks]
  );
  const renderedPreviewHtml = useMemo(
    () =>
      recoveryStorage.error
        ? ''
        : buildRecoveryPreviewHtml(
            richDiff.blocks || [],
            blockChoices,
            diffDisplay.blockChoiceKeys
          ),
    [
      blockChoices,
      diffDisplay.blockChoiceKeys,
      recoveryStorage.error,
      richDiff.blocks,
    ]
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
      previewHtml: renderedPreviewHtml,
      storageHtml: recoveryStorage.html,
      storageError: recoveryStorage.error,
      createdAt: new Date().toISOString(),
    };

    setWriteBack({ status: 'idle', error: '', page: null });
    setDraftPreview(draft);
  };

  const handleConfirmWriteBack = async () => {
    if (
      !draftPreview ||
      draftPreview.storageError ||
      writeBack.status === 'loading'
    ) return;

    setWriteBack({ status: 'loading', error: '', page: null });

    try {
      const { invoke } = await import('@forge/bridge');
      const updatedPage = await invoke('writeRecoveredPage', {
        pageId,
        bodyValue: draftPreview.storageHtml,
        expectedVersionNumber: draftPreview.currentVersionNumber,
      });

      if (updatedPage && updatedPage.ok === false) {
        throw new Error(
          updatedPage.error || 'Confluence rejected the recovered page update.'
        );
      }

      if (!updatedPage || !updatedPage.id || !updatedPage.versionNumber) {
        throw new Error('Confluence did not return the updated page details.');
      }

      setWriteBack({ status: 'success', error: '', page: updatedPage });
      if (typeof onPageUpdated === 'function') {
        onPageUpdated(updatedPage);
      }
    } catch (error) {
      setWriteBack({
        status: 'error',
        error: error && error.message
          ? error.message
          : 'Confluence could not write the recovered content.',
        page: null,
      });
    }
  };

  const operationIsLoading = writeBack.status === 'loading';

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
                  if (row.type === 'layout_structure') {
                    return (
                      <div key={row.key} {...getLayoutWrapperProps(row.block)}>
                        <DiffDisplayRows
                          rows={row.children}
                          blockChoices={blockChoices}
                          activeBlockKey={activeBlockKey}
                          setActiveBlockKey={setActiveBlockKey}
                          onChoose={handleChooseBlockVersion}
                          onUndo={handleUndoBlockChoice}
                        />
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
                    const resolvedHtml = row.blocks
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
              !operationIsLoading
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
                disabled={operationIsLoading}
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
                {draftPreview.storageError ? (
                  <span className="dh-draft-modal__result--error">
                    {draftPreview.storageError}
                  </span>
                ) : null}
                {!draftPreview.storageError &&
                writeBack.status === 'idle'
                  ? 'Review the result, then write it to the current page.'
                  : null}
                {writeBack.status === 'loading'
                  ? 'Writing recovered content to the current page…'
                  : null}
                {writeBack.status === 'error' ? (
                  <span className="dh-draft-modal__result--error">
                    {writeBack.error}
                  </span>
                ) : null}
                {writeBack.status === 'success' ? (
                  <span className="dh-draft-modal__result--success">
                    Current page updated to v{writeBack.page.versionNumber}.
                  </span>
                ) : null}
              </div>

              <div className="dh-draft-modal__footer-actions">
                <button
                  disabled={operationIsLoading}
                  type="button"
                  onClick={() => setDraftPreview(null)}
                >
                  Back to changes
                </button>

                <button
                  className="dh-write-back-button"
                  disabled={
                    operationIsLoading ||
                    writeBack.status === 'success' ||
                    Boolean(draftPreview.storageError)
                  }
                  onClick={handleConfirmWriteBack}
                  type="button"
                >
                  {writeBack.status === 'loading'
                    ? 'Writing…'
                    : 'Write to Current Page'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ComparisonPanel;
