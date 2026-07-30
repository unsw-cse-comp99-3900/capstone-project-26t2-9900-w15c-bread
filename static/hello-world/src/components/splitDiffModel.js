import { buildDiffDisplayRows } from '../diffDisplay';
import { buildRichSideBySideInlineHtml } from '../richInlineDiff';

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

export function getSplitBlockHtml(block, side) {
  if (!block) return '';
  const historical = side === 'historical';

  if (block.type === 'modified') {
    return historical
      ? block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.oldText)
      : block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.newText);
  }

  if (block.type === 'same') {
    return block.renderedHtml || block.html || fallbackTextHtml(block.text);
  }

  if (historical) {
    return (
      block.oldRenderedHtml ||
      (block.type === 'removed' ? block.renderedHtml : '') ||
      block.oldHtml ||
      fallbackTextHtml(block.oldText || block.text)
    );
  }

  return (
    block.newRenderedHtml ||
    (block.type === 'added' ? block.renderedHtml : '') ||
    block.newHtml ||
    fallbackTextHtml(block.newText || block.text)
  );
}

function getCellLevelTableDiff(row) {
  if (
    !row ||
    row.kind !== 'modified' ||
    !Array.isArray(row.historicalBlocks) ||
    !Array.isArray(row.currentBlocks) ||
    row.historicalBlocks.length !== 1 ||
    row.currentBlocks.length !== 1
  ) {
    return null;
  }

  const historicalBlock = row.historicalBlocks[0];
  const currentBlock = row.currentBlocks[0];
  const tableDiff = historicalBlock && historicalBlock.tableDiff;
  if (
    !historicalBlock ||
    !currentBlock ||
    historicalBlock.nodeType !== 'table' ||
    currentBlock.nodeType !== 'table' ||
    !tableDiff ||
    tableDiff.mode !== 'cell_level' ||
    currentBlock.tableDiff !== tableDiff ||
    !tableDiff.historicalComparisonHtml ||
    !tableDiff.currentComparisonHtml
  ) {
    return null;
  }

  return tableDiff;
}

function getLineAwareCodeDiff(row) {
  if (
    !row ||
    row.kind !== 'modified' ||
    !Array.isArray(row.historicalBlocks) ||
    !Array.isArray(row.currentBlocks) ||
    row.historicalBlocks.length !== 1 ||
    row.currentBlocks.length !== 1
  ) {
    return null;
  }

  const historicalBlock = row.historicalBlocks[0];
  const currentBlock = row.currentBlocks[0];
  const codeDiff = historicalBlock && historicalBlock.codeDiff;
  if (
    !historicalBlock ||
    !currentBlock ||
    historicalBlock.nodeType !== 'code_block' ||
    currentBlock.nodeType !== 'code_block' ||
    !codeDiff ||
    !codeDiff.historicalComparisonHtml ||
    !codeDiff.currentComparisonHtml
  ) {
    return null;
  }

  return codeDiff;
}

export function isCellLevelTableRow(row) {
  return Boolean(getCellLevelTableDiff(row));
}

export function getSplitRowSideHtml(row, side) {
  const tableDiff = getCellLevelTableDiff(row);
  if (tableDiff) {
    return side === 'historical'
      ? tableDiff.historicalComparisonHtml
      : tableDiff.currentComparisonHtml;
  }

  const codeDiff = getLineAwareCodeDiff(row);
  if (codeDiff) {
    // Code uses line identity rather than the rich-text word tokenizer. This
    // preserves blank-line additions without turning indentation spaces into
    // red/green inline bars.
    return side === 'historical'
      ? codeDiff.historicalComparisonHtml
      : codeDiff.currentComparisonHtml;
  }

  const blocks = side === 'historical' ? row.historicalBlocks : row.currentBlocks;
  const baseHtml = (blocks || [])
    .map((block) => getSplitBlockHtml(block, side))
    .join('');
  if (
    row.kind !== 'modified' ||
    row.historicalBlocks.length !== 1 ||
    row.currentBlocks.length !== 1
  ) {
    return baseHtml;
  }

  const historicalHtml = getSplitBlockHtml(row.historicalBlocks[0], 'historical');
  const currentHtml = getSplitBlockHtml(row.currentBlocks[0], 'current');
  const comparison = buildRichSideBySideInlineHtml(historicalHtml, currentHtml);
  return side === 'historical' ? comparison.historicalHtml : comparison.currentHtml;
}

function createChangeRow(row) {
  const hasBlankLineChange = row.blocks.some(
    ({ block }) => block.isBlankLineCountChange
  );
  const historicalBlocks = row.blocks
    .filter(
      ({ block }) =>
        block.isBlankLineCountChange || ['removed', 'modified'].includes(block.type)
    )
    .map(({ block }) => block);
  const currentBlocks = row.blocks
    .filter(
      ({ block }) =>
        block.isBlankLineCountChange || ['added', 'modified'].includes(block.type)
    )
    .map(({ block }) => block);
  const hasRemovedContent = historicalBlocks.length > 0;
  const hasAddedContent = currentBlocks.length > 0;
  const indices = row.blocks.map(({ index }) => index);

  if (hasBlankLineChange || row.changeKind === 'modified') {
    return {
      kind: 'modified',
      key: row.key,
      indices,
      historical: historicalBlocks[0] || null,
      current: currentBlocks[0] || null,
      historicalBlocks,
      currentBlocks,
    };
  }

  if (hasRemovedContent && !hasAddedContent) {
    return {
      kind: 'historical-only',
      key: row.key,
      indices,
      historical: historicalBlocks[0] || null,
      current: null,
      historicalBlocks,
      currentBlocks: [],
    };
  }

  return {
    kind: 'current-only',
    key: row.key,
    indices,
    historical: null,
    current: currentBlocks[0] || null,
    historicalBlocks: [],
    currentBlocks,
  };
}

function appendDisplayRows(displayRows, rows) {
  (displayRows || []).forEach((row) => {
    if (row.type === 'layout_structure') {
      if (row.widthChoiceKey) {
        rows.push({
          kind: 'layout-width',
          key: row.widthChoiceKey,
          indices: row.widthItems.map(({ index }) => index),
          historical: row.block,
          current: row.block,
          historicalBlocks: row.widthItems.map(({ block }) => block),
          currentBlocks: row.widthItems.map(({ block }) => block),
          layoutWidthChange: row.block.layoutWidthChange,
        });
      }
      appendDisplayRows(row.children, rows);
      return;
    }

    if (row.type === 'same') {
      if (row.block.isStructuralBoundary) return;
      rows.push({
        kind: 'unchanged',
        key: row.key,
        indices: [row.index],
        historical: row.block,
        current: row.block,
        historicalBlocks: [row.block],
        currentBlocks: [row.block],
      });
      return;
    }

    if (row.type === 'change') rows.push(createChangeRow(row));
  });
}

export function buildFullDocumentSplitRowsFromDisplay(display) {
  const rows = [];
  appendDisplayRows((display && display.rows) || [], rows);
  return rows;
}

export function buildFullDocumentSplitRows(blocks) {
  return buildFullDocumentSplitRowsFromDisplay(buildDiffDisplayRows(blocks || []));
}

export function buildFullDocumentSplitStats(rows) {
  const stats = (rows || []).reduce(
    (result, row) => {
      if (row.kind === 'current-only') result.additions++;
      if (row.kind === 'historical-only') result.removals++;
      if (row.kind === 'modified' || row.kind === 'layout-width') result.modified++;
      return result;
    },
    { additions: 0, removals: 0, modified: 0 }
  );
  return {
    ...stats,
    total: stats.additions + stats.removals + stats.modified,
  };
}
