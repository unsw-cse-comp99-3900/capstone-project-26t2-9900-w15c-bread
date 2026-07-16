import React, { useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  extractMentionAccountIds,
  formatDateTime,
  isBlankParagraphBlock,
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

  const removedIsEmpty = !String(removedBlock.text || '').trim();
  const addedIsEmpty = !String(addedBlock.text || '').trim();

  // The diff engine intentionally emits changed content as two simple result
  // blocks: the old block is removed and the new block is added. When those two
  // adjacent blocks occupy the same semantic role, the UI should treat them as
  // one recovery decision while still preserving the underlying result model.
  return (
    removedBlock.nodeType === addedBlock.nodeType &&
    removedBlock.tag === addedBlock.tag &&
    removedIsEmpty === addedIsEmpty
  );
}

function normalisePairingText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getCharacterBigrams(value) {
  const text = normalisePairingText(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2));
}

function textPairingSimilarity(leftValue, rightValue) {
  const left = normalisePairingText(leftValue);
  const right = normalisePairingText(rightValue);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;

  const rightCounts = new Map();
  getCharacterBigrams(right).forEach((bigram) => {
    rightCounts.set(bigram, (rightCounts.get(bigram) || 0) + 1);
  });

  let overlap = 0;
  const leftBigrams = getCharacterBigrams(left);
  leftBigrams.forEach((bigram) => {
    const available = rightCounts.get(bigram) || 0;
    if (!available) return;
    overlap++;
    rightCounts.set(bigram, available - 1);
  });

  return (2 * overlap) / (leftBigrams.length + getCharacterBigrams(right).length);
}

function pairChangeItems(removedItems, addedItems) {
  const scores = Array.from(
    { length: removedItems.length + 1 },
    () => Array(addedItems.length + 1).fill(0)
  );
  const decisions = Array.from(
    { length: removedItems.length + 1 },
    () => Array(addedItems.length + 1).fill('')
  );

  // Align compatible blocks in source order. Similarity prevents a standalone
  // insertion from being paired with an unrelated historical paragraph.
  for (let removedIndex = removedItems.length - 1; removedIndex >= 0; removedIndex--) {
    for (let addedIndex = addedItems.length - 1; addedIndex >= 0; addedIndex--) {
      let bestScore = scores[removedIndex + 1][addedIndex];
      let decision = 'skip-removed';

      if (scores[removedIndex][addedIndex + 1] > bestScore) {
        bestScore = scores[removedIndex][addedIndex + 1];
        decision = 'skip-added';
      }

      const removedItem = removedItems[removedIndex];
      const addedItem = addedItems[addedIndex];
      if (canShareChoice(removedItem.block, addedItem.block)) {
        const pairScore =
          100 +
          textPairingSimilarity(removedItem.block.text, addedItem.block.text) +
          scores[removedIndex + 1][addedIndex + 1];
        if (pairScore >= bestScore) {
          bestScore = pairScore;
          decision = 'pair';
        }
      }

      scores[removedIndex][addedIndex] = bestScore;
      decisions[removedIndex][addedIndex] = decision;
    }
  }

  const pairs = [];
  let removedIndex = 0;
  let addedIndex = 0;
  while (removedIndex < removedItems.length && addedIndex < addedItems.length) {
    const decision = decisions[removedIndex][addedIndex];
    if (decision === 'pair') {
      pairs.push([removedItems[removedIndex], addedItems[addedIndex]]);
      removedIndex++;
      addedIndex++;
    } else if (decision === 'skip-added') {
      addedIndex++;
    } else {
      removedIndex++;
    }
  }

  return pairs;
}

function isEmptyParagraphItem(item) {
  return Boolean(item && item.block && isDisplayBlankLineBlock(item.block));
}

function attachUnpairedSpacerItems(groups, items, pairedItemPosition) {
  items.forEach((item, itemPosition) => {
    if (!isEmptyParagraphItem(item) || pairedItemPosition.has(item)) return;

    let closestGroup = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    groups.forEach((group) => {
      const anchor = group.find((candidate) => pairedItemPosition.has(candidate));
      if (!anchor) return;

      const anchorPosition = pairedItemPosition.get(anchor);
      const start = Math.min(itemPosition, anchorPosition) + 1;
      const end = Math.max(itemPosition, anchorPosition);
      const separatedByVisibleContent = items
        .slice(start, end)
        .some((candidate) => !isEmptyParagraphItem(candidate));
      if (separatedByVisibleContent) return;

      const distance = Math.abs(itemPosition - anchorPosition);
      if (distance < closestDistance) {
        closestGroup = group;
        closestDistance = distance;
      }
    });

    if (closestGroup) closestGroup.push(item);
  });
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
  const visibleRemovedItems = removedItems.filter(
    ({ block }) => !isDisplayBlankLineBlock(block)
  );
  const visibleAddedItems = addedItems.filter(
    ({ block }) => !isDisplayBlankLineBlock(block)
  );
  const pairs = pairChangeItems(visibleRemovedItems, visibleAddedItems);
  const groupedItems = pairs.map(([removedItem, addedItem]) => [removedItem, addedItem]);
  const pairedRemovedPositions = new Map(
    pairs.map(([removedItem]) => [removedItem, removedItems.indexOf(removedItem)])
  );
  const pairedAddedPositions = new Map(
    pairs.map(([, addedItem]) => [addedItem, addedItems.indexOf(addedItem)])
  );

  // Empty editor paragraphs adjacent to a visible replacement must share its
  // recovery key. Otherwise restoring the old text leaves current-only blank
  // lines in Draft Preview and subsequently writes them back to Confluence.
  attachUnpairedSpacerItems(groupedItems, removedItems, pairedRemovedPositions);
  attachUnpairedSpacerItems(groupedItems, addedItems, pairedAddedPositions);

  const usedItems = new Set(groupedItems.flat());
  const blankRunGroups = [];
  const itemsInBlankRuns = new Set();
  let itemIndex = 0;

  // Extraction normally converts a source-side run before the LCS diff runs.
  // Keep this display-level fallback because historical Confluence Storage can
  // still produce several distinct prepared wrappers for consecutive empty
  // editor lines. One recovery choice must cover that whole adjacent run.
  while (itemIndex < items.length) {
    if (usedItems.has(items[itemIndex]) || !isDisplayBlankLineBlock(items[itemIndex].block)) {
      itemIndex++;
      continue;
    }

    const blankRun = [];
    while (
      itemIndex < items.length &&
      !usedItems.has(items[itemIndex]) &&
      isDisplayBlankLineBlock(items[itemIndex].block)
    ) {
      blankRun.push(items[itemIndex]);
      itemIndex++;
    }

    if (blankRun.length > 1) {
      blankRunGroups.push(blankRun);
      blankRun.forEach((item) => itemsInBlankRuns.add(item));
    }
  }

  const displayGroups = [
    ...blankRunGroups,
    ...groupedItems,
    ...items
      .filter((item) => !usedItems.has(item) && !itemsInBlankRuns.has(item))
      .map((item) => [item]),
  ];

  // Sort groups by their first source position. Inside a paired group, the
  // removed block deliberately remains before the added block.
  return displayGroups
    .map((group) => group.sort((left, right) => left.index - right.index))
    .sort((left, right) => {
      const leftIndex = Math.min(...left.map(({ index }) => index));
      const rightIndex = Math.min(...right.map(({ index }) => index));
      return leftIndex - rightIndex;
    })
    .map((group) => createChangeDisplayRow(group, blockChoiceKeys));
}

function nestStructuralDisplayRows(rows, blockChoiceKeys) {
  const root = [];
  const stack = [{ children: root, wrapperTag: '' }];

  rows.forEach((row) => {
    const block = row.type === 'same' ? row.block : null;
    if (!block || !block.isStructuralBoundary) {
      stack[stack.length - 1].children.push(row);
      return;
    }

    if (block.layoutBoundaryEdge === 'start') {
      const parent = stack[stack.length - 1];
      const widthChoiceKey = block.layoutWidthChange
        ? `layout-width:${row.index}`
        : '';
      const wrapper = {
        type: 'layout_structure',
        key: row.key,
        block,
        index: row.index,
        wrapperTag: block.layoutWrapperTag,
        children: [],
        layoutCellCount: 0,
        widthChoiceKey,
        widthItems: widthChoiceKey ? [{ block, index: row.index }] : [],
        layoutWidthAffected: false,
      };

      if (widthChoiceKey) {
        // The section start controls preview rendering (grid/flex mode), while
        // the affected cell starts control the recoverable Storage widths.
        // Giving them one key makes the complete width vector atomic.
        blockChoiceKeys.set(row.index, widthChoiceKey);
      }

      if (
        block.layoutWrapperTag === 'ac:layout-cell' &&
        parent.wrapperTag === 'ac:layout-section'
      ) {
        const columnIndex = parent.layoutCellCount;
        parent.layoutCellCount++;
        wrapper.layoutWidthAffected = Boolean(
          parent.block.layoutWidthChange &&
          parent.block.layoutWidthChange.changedColumnIndexes.includes(columnIndex)
        );

        if (wrapper.layoutWidthAffected && parent.widthChoiceKey) {
          parent.widthItems.push({ block, index: row.index });
          blockChoiceKeys.set(row.index, parent.widthChoiceKey);
        }
      }

      parent.children.push(wrapper);
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
      const widthRow = row.widthChoiceKey
        ? [{
            type: 'layout_width_change',
            key: row.widthChoiceKey,
            blocks: row.widthItems,
            layoutWidthChange: row.block.layoutWidthChange,
          }]
        : [];
      return [
        ...widthRow,
        ...collectSelectableDisplayRows(row.children || []),
      ];
    }
    return row.type === 'change' ? [row] : [];
  });
}

export function buildDiffDisplayRows(blocks) {
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

  const nestedRows = nestStructuralDisplayRows(rows, blockChoiceKeys);

  return {
    rows: nestedRows,
    selectableRows: collectSelectableDisplayRows(nestedRows),
    blockChoiceKeys,
  };
}

export function buildDraftDifferenceNotes(
  currentStorage,
  draftStorage,
  baseUrl = '',
  attachmentsByFilename = {},
  usersByAccountId = {}
) {
  // Treat Current as the old side and Draft as the new side so every marker
  // describes the exact effect of pressing "Write to Current Page".
  const diff = buildRichTextDiffHtml(
    currentStorage,
    draftStorage,
    baseUrl,
    attachmentsByFilename,
    usersByAccountId
  );

  return {
    diff,
    display: buildDiffDisplayRows(diff.blocks || []),
  };
}

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

function isBlankLineRunBlock(block) {
  return Boolean(
    block &&
    (block.nodeType === 'blank_line_run' ||
      block.nodeType === 'blank_line_change') &&
    Number.isInteger(block.blankLineCount) &&
    block.blankLineCount > 0
  );
}

function isDisplayBlankLineBlock(block) {
  return isBlankLineRunBlock(block) || isBlankParagraphBlock(block);
}

function blankLineRunSummaryHtml(block, suffix) {
  const count = block.blankLineCount;
  const noun = count === 1 ? 'blank line' : 'blank lines';
  return `<div class="dh-blank-line-run-summary">${count} ${noun} ${suffix}</div>`;
}

function getBlockRenderedPreviewHtml(block, selected) {
  if (!block) return '';

  if (block.isBlankLineCountChange) {
    return selected
      ? block.newRenderedHtml || block.renderedHtml || ''
      : block.oldRenderedHtml || block.renderedHtml || '';
  }

  if (block.isStructuralBoundary) {
    return selected
      ? block.newFullRenderedHtml || block.fullRenderedHtml || ''
      : block.oldFullRenderedHtml || block.fullRenderedHtml || '';
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
    const tableBlocks = blockOrBlocks.map(({ block }) => block);
    const isBlankLineRun = Boolean(
      tableBlocks.length && tableBlocks.every(isDisplayBlankLineBlock)
    );

    if (isBlankLineRun) {
      // The underlying block retains every original empty paragraph for exact
      // recovery. The comparison surface intentionally summarizes the run so
      // ten Enter presses produce one compact decision instead of ten empty
      // red/green boxes.
      return ['removed', 'added'].flatMap((type) => {
        const matchingBlocks = tableBlocks.filter((block) => block.type === type);
        if (!matchingBlocks.length) return [];

        const blankLineCount = matchingBlocks.reduce(
          (count, block) => count + (block.blankLineCount || 1),
          0
        );

        return [{
          type,
          html: blankLineRunSummaryHtml(
            { blankLineCount },
            type === 'added' ? 'added' : 'removed'
          ),
        }];
      });
    }

    const sharedTableDiff = tableBlocks[0] && tableBlocks[0].tableDiff;
    const isCellLevelTablePair = Boolean(
      tableBlocks.length === 2 &&
        tableBlocks[0].type === 'removed' &&
        tableBlocks[1].type === 'added' &&
        tableBlocks.every((block) => block.nodeType === 'table') &&
        sharedTableDiff &&
        sharedTableDiff.mode === 'cell_level' &&
        sharedTableDiff.comparisonHtml &&
        tableBlocks[1].tableDiff === sharedTableDiff
    );

    if (isCellLevelTablePair) {
      // Keep the underlying removed/added blocks untouched for whole-table
      // recovery. Only the comparison surface consumes this merged table, so
      // unchanged cells appear once while the existing selection keys still
      // choose the complete previous or current table.
      return [{
        type: 'table-cell-level',
        html: sharedTableDiff.comparisonHtml,
      }];
    }

    return blockOrBlocks.flatMap(({ block }) => getGitHubStyleDiffParts(block));
  }

  const block = blockOrBlocks;

  if (block.isListBreakChange) {
    const isAddition = block.blankLineDelta > 0;
    return [{
      type: isAddition ? 'added' : 'removed',
      html: blankLineRunSummaryHtml(
        block,
        isAddition ? 'added' : 'removed'
      ),
    }];
  }

  if (
    block.nodeType === 'table' &&
    block.tableDiff &&
    block.tableDiff.mode === 'cell_level' &&
    block.tableDiff.comparisonHtml
  ) {
    return [{
      type: 'table-cell-level',
      html: block.tableDiff.comparisonHtml,
    }];
  }

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

function formatLayoutWidthVector(widths) {
  const safeWidths = widths || [];
  if (!safeWidths.length || safeWidths.every((width) => !width)) {
    return 'Template default';
  }

  return safeWidths
    .map((width) => (width ? `${width}%` : 'auto'))
    .join(' / ');
}

function VersionDifferenceNotesRows({ rows, limited }) {
  if (!(rows || []).length) {
    return (
      <div className="dh-version-notes__empty">
        {limited
          ? 'This page is too large for a detailed comparison. The versions may still differ.'
          : 'The Draft is identical to the Current version.'}
      </div>
    );
  }

  return rows.map((row) => {
    if (row.type === 'layout_width_change') {
      const change = row.layoutWidthChange || {};
      return (
        <div className="dh-version-notes__change" key={row.key}>
          <div className="dh-version-notes__change-title">Column widths changed</div>
          <div className="dh-layout-width-change__values">
            <span className="dh-layout-width-change__value dh-layout-width-change__value--old">
              <span aria-hidden="true">-</span>{' '}
              {formatLayoutWidthVector(change.oldWidths)}
            </span>
            <span className="dh-layout-width-change__value dh-layout-width-change__value--current">
              <span aria-hidden="true">+</span>{' '}
              {formatLayoutWidthVector(change.newWidths)}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="dh-version-notes__change" key={row.key}>
        {getGitHubStyleDiffParts(row.blocks || []).map((part, partIndex) => (
          <div
            className={`dh-github-diff-part dh-github-diff-part--${part.type}`}
            key={`${row.key}-${part.type}-${partIndex}`}
          >
            {part.type !== 'table-cell-level' ? (
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
      </div>
    );
  });
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
            {part.type !== 'table-cell-level' ? (
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
  onPageUpdated,
  onDiffSummaryChange,
}) {
  const [blockChoices, setBlockChoices] = useState(new Map());
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [draftPreview, setDraftPreview] = useState(null);
  const [showVersionDifferenceNotes, setShowVersionDifferenceNotes] = useState(false);
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
    setShowVersionDifferenceNotes(false);
    setWriteBack({ status: 'idle', error: '', page: null });
  }, [selectableBlocks, selectedVersion.number, currentVersion && currentVersion.number]);

  useEffect(() => {
    if (!draftPreview) return undefined;

    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        writeBack.status !== 'loading'
      ) {
        if (showVersionDifferenceNotes) {
          setShowVersionDifferenceNotes(false);
        } else {
          setDraftPreview(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPreview, showVersionDifferenceNotes, writeBack.status]);

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
  const versionDifferenceNotes = useMemo(() => {
    if (!draftPreview || draftPreview.storageError) return null;

    try {
      return {
        ...buildDraftDifferenceNotes(
          currentBodyValue,
          draftPreview.storageHtml,
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
    draftPreview,
    emptyDiff,
    mentionUsersByAccountId,
  ]);

  const diffSummary = richDiff.summary || {
    added: richDiff.added || 0,
    removed: richDiff.removed || 0,
    modifiedBlocks: 0,
    limited: richDiff.limited || false,
  };
  const totalChanges = diffSummary.added + diffSummary.removed;
  const showChangeSelection = hasComparisonBase && !isCurrent && selectableBlocks.length > 0;

  useEffect(() => {
    if (typeof onDiffSummaryChange !== 'function') return;

    onDiffSummaryChange(selectedVersion.number, {
      added: Number(diffSummary.added) || 0,
      removed: Number(diffSummary.removed) || 0,
      modifiedBlocks: Number(diffSummary.modifiedBlocks) || 0,
    });
  }, [
    diffSummary.added,
    diffSummary.modifiedBlocks,
    diffSummary.removed,
    onDiffSummaryChange,
    selectedVersion.number,
  ]);

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
    setShowVersionDifferenceNotes(false);
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

      {draftPreview ? (
        <div
          className="dh-draft-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !operationIsLoading
            ) {
              setShowVersionDifferenceNotes(false);
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
              <div className="dh-draft-modal__header-actions">
                <button
                  className="dh-draft-modal__version-notes-button"
                  disabled={
                    operationIsLoading ||
                    Boolean(draftPreview.storageError) ||
                    !versionDifferenceNotes
                  }
                  onClick={() => setShowVersionDifferenceNotes(true)}
                  type="button"
                >
                  Version Difference Notes
                </button>
                <button
                  aria-label="Close draft preview"
                  className="dh-draft-modal__close"
                  disabled={operationIsLoading}
                  onClick={() => {
                    setShowVersionDifferenceNotes(false);
                    setDraftPreview(null);
                  }}
                  type="button"
                >
                  ×
                </button>
              </div>
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
                  onClick={() => {
                    setShowVersionDifferenceNotes(false);
                    setDraftPreview(null);
                  }}
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

          {showVersionDifferenceNotes && versionDifferenceNotes ? (
            <div
              className="dh-version-notes-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowVersionDifferenceNotes(false);
                }
              }}
            >
              <section
                aria-labelledby="dh-version-notes-title"
                aria-modal="true"
                className="dh-version-notes-modal"
                role="dialog"
              >
                <header className="dh-version-notes__header">
                  <div>
                    <h2 className="dh-draft-modal__title" id="dh-version-notes-title">
                      Version Difference Notes
                    </h2>
                    <p className="dh-draft-modal__meta">
                      Current v{draftPreview.currentVersionNumber || '?'} → Draft
                    </p>
                  </div>
                  <button
                    aria-label="Close version difference notes"
                    className="dh-draft-modal__close"
                    onClick={() => setShowVersionDifferenceNotes(false)}
                    type="button"
                  >
                    ×
                  </button>
                </header>

                <div className="dh-version-notes__body">
                  {versionDifferenceNotes.error ? (
                    <div className="dh-draft-modal__result--error">
                      {versionDifferenceNotes.error}
                    </div>
                  ) : (
                    <>
                      <div className="dh-version-notes__chips">
                        <span className="dh-change-chip dh-change-chip--added">
                          + {versionDifferenceNotes.diff.summary.added} additions
                        </span>
                        <span className="dh-change-chip dh-change-chip--removed">
                          - {versionDifferenceNotes.diff.summary.removed} removals
                        </span>
                        <span className="dh-change-chip">
                          {versionDifferenceNotes.diff.summary.modifiedBlocks || 0} modified
                        </span>
                      </div>
                      {versionDifferenceNotes.diff.summary.limited ? (
                        <div className="dh-diff-warning">
                          This page is large, so only a limited safe comparison is available.
                        </div>
                      ) : null}
                      <div className="dh-version-notes__changes">
                        <VersionDifferenceNotesRows
                          limited={versionDifferenceNotes.diff.summary.limited}
                          rows={versionDifferenceNotes.display.selectableRows}
                        />
                      </div>
                    </>
                  )}
                </div>

                <footer className="dh-version-notes__footer">
                  <span>Red is removed from Current; green is added by Draft.</span>
                  <button onClick={() => setShowVersionDifferenceNotes(false)} type="button">
                    Close
                  </button>
                </footer>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ComparisonPanel;
