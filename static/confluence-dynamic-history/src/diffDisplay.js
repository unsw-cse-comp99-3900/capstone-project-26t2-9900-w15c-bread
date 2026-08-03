import { isBlankParagraphBlock } from './utils';

const CHANGE_BLOCK_TYPES = new Set(['added', 'removed', 'modified']);

export function blockSelectionKey(index) {
  return String(index);
}

export function blockGroupSelectionKey(indices) {
  return indices.map((index) => blockSelectionKey(index)).join(':');
}

function canShareChoice(removedBlock, addedBlock) {
  if (!removedBlock || !addedBlock) return false;
  if (removedBlock.type !== 'removed' || addedBlock.type !== 'added') return false;
  const removedIsEmpty = !String(removedBlock.text || '').trim();
  const addedIsEmpty = !String(addedBlock.text || '').trim();
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
        const similarity = textPairingSimilarity(
          removedItem.block.text,
          addedItem.block.text
        );
        const bothEmpty =
          !normalisePairingText(removedItem.block.text) &&
          !normalisePairingText(addedItem.block.text);
        const exactEmptyIdentity = Boolean(
          bothEmpty &&
          removedItem.block.diffIdentity &&
          removedItem.block.diffIdentity === addedItem.block.diffIdentity
        );
        if (similarity >= 0.25 || exactEmptyIdentity) {
          const pairScore =
            1 + similarity + scores[removedIndex + 1][addedIndex + 1];
          if (pairScore >= bestScore) {
            bestScore = pairScore;
            decision = 'pair';
          }
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

function isBlankLineRunBlock(block) {
  return Boolean(
    block &&
    (block.nodeType === 'blank_line_run' || block.nodeType === 'blank_line_change') &&
    Number.isInteger(block.blankLineCount) &&
    block.blankLineCount > 0
  );
}

export function isDisplayBlankLineBlock(block) {
  return isBlankLineRunBlock(block) || isBlankParagraphBlock(block);
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
      if (items.slice(start, end).some((candidate) => !isEmptyParagraphItem(candidate))) return;
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
  const visibleItems = items.filter(({ block }) => !isDisplayBlankLineBlock(block));
  const hasRemovedContent = visibleItems.some(({ block }) => block.type === 'removed');
  const hasAddedContent = visibleItems.some(({ block }) => block.type === 'added');
  const hasModifiedContent = visibleItems.some(({ block }) => block.type === 'modified');
  const changeKind = hasModifiedContent || (hasRemovedContent && hasAddedContent)
    ? 'modified'
    : hasAddedContent
      ? 'added'
      : hasRemovedContent
        ? 'removed'
        : items.some(({ block }) => block.type === 'added')
          ? 'added'
          : 'removed';
  indices.forEach((blockIndex) => blockChoiceKeys.set(blockIndex, key));
  return { type: 'change', changeKind, key, blocks: items };
}

function buildChangeRunRows(items, blockChoiceKeys) {
  const removedItems = items.filter(({ block }) => block.type === 'removed');
  const addedItems = items.filter(({ block }) => block.type === 'added');
  const visibleRemovedItems = removedItems.filter(({ block }) => !isDisplayBlankLineBlock(block));
  const visibleAddedItems = addedItems.filter(({ block }) => !isDisplayBlankLineBlock(block));
  const pairs = pairChangeItems(visibleRemovedItems, visibleAddedItems);
  const groupedItems = pairs.map(([removedItem, addedItem]) => [removedItem, addedItem]);
  const pairedRemovedPositions = new Map(
    pairs.map(([removedItem]) => [removedItem, removedItems.indexOf(removedItem)])
  );
  const pairedAddedPositions = new Map(
    pairs.map(([, addedItem]) => [addedItem, addedItems.indexOf(addedItem)])
  );
  attachUnpairedSpacerItems(groupedItems, removedItems, pairedRemovedPositions);
  attachUnpairedSpacerItems(groupedItems, addedItems, pairedAddedPositions);
  const usedItems = new Set(groupedItems.flat());
  const blankRunGroups = [];
  const itemsInBlankRuns = new Set();
  let itemIndex = 0;
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
  return [
    ...blankRunGroups,
    ...groupedItems,
    ...items
      .filter((item) => !usedItems.has(item) && !itemsInBlankRuns.has(item))
      .map((item) => [item]),
  ]
    .map((group) => group.sort((left, right) => left.index - right.index))
    .sort((left, right) =>
      Math.min(...left.map(({ index }) => index)) -
      Math.min(...right.map(({ index }) => index))
    )
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
      const widthChoiceKey = block.layoutWidthChange ? `layout-width:${row.index}` : '';
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
      if (widthChoiceKey) blockChoiceKeys.set(row.index, widthChoiceKey);
      if (block.layoutWrapperTag === 'ac:layout-cell' && parent.wrapperTag === 'ac:layout-section') {
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
            changeKind: 'modified',
            key: row.widthChoiceKey,
            blocks: row.widthItems,
            layoutWidthChange: row.block.layoutWidthChange,
          }]
        : [];
      return [...widthRow, ...collectSelectableDisplayRows(row.children || [])];
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
      rows.push({ type: 'same', key: blockSelectionKey(index), block, index });
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

export function buildCanonicalDiffSummary(diff, display) {
  const source = (diff && diff.summary) || diff || {};
  const modifiedBlocks = ((display && display.selectableRows) || [])
    .filter((row) => row.changeKind === 'modified').length;
  return {
    added: Number(source.added) || 0,
    removed: Number(source.removed) || 0,
    modifiedBlocks,
  };
}
