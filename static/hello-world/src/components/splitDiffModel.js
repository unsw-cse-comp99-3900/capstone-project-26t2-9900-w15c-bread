import { buildDiffDisplayRows } from '../diffDisplay';

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

function tokenizeInlineText(text) {
  return (String(text || '').match(/[\u3400-\u9fff]|\s+|[A-Za-z0-9_]+|[^\s]/g) || []);
}

function buildInlineParts(oldText, currentText) {
  const historical = tokenizeInlineText(oldText);
  const current = tokenizeInlineText(currentText);
  if (historical.length * current.length > 40000) return [];

  const table = Array.from(
    { length: historical.length + 1 },
    () => Array(current.length + 1).fill(0)
  );
  for (let oldIndex = historical.length - 1; oldIndex >= 0; oldIndex--) {
    for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex--) {
      table[oldIndex][currentIndex] = historical[oldIndex] === current[currentIndex]
        ? table[oldIndex + 1][currentIndex + 1] + 1
        : Math.max(table[oldIndex + 1][currentIndex], table[oldIndex][currentIndex + 1]);
    }
  }

  const parts = [];
  const append = (type, value) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += value;
    else parts.push({ type, text: value });
  };
  let oldIndex = 0;
  let currentIndex = 0;
  while (oldIndex < historical.length || currentIndex < current.length) {
    if (
      oldIndex < historical.length &&
      currentIndex < current.length &&
      historical[oldIndex] === current[currentIndex]
    ) {
      append('same', historical[oldIndex]);
      oldIndex++;
      currentIndex++;
    } else if (
      currentIndex >= current.length ||
      (oldIndex < historical.length &&
        table[oldIndex + 1][currentIndex] >= table[oldIndex][currentIndex + 1])
    ) {
      append('removed', historical[oldIndex]);
      oldIndex++;
    } else {
      append('added', current[currentIndex]);
      currentIndex++;
    }
  }
  return parts;
}

function decorateSimpleInlineHtml(html, expectedText, parts, side) {
  if (!html || !parts.length) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const roots = Array.from(doc.body.children);
  if (roots.length !== 1 || roots[0].querySelector('*')) return html;
  if ((roots[0].textContent || '').trim() !== String(expectedText || '').trim()) return html;

  const root = roots[0];
  root.textContent = '';
  const changedType = side === 'historical' ? 'removed' : 'added';
  parts.forEach((part) => {
    if (part.type !== 'same' && part.type !== changedType) return;
    if (part.type === 'same') {
      root.appendChild(doc.createTextNode(part.text));
      return;
    }
    const highlight = doc.createElement('span');
    highlight.className = `sbs-inline-change sbs-inline-change--${side}`;
    highlight.textContent = part.text;
    root.appendChild(highlight);
  });
  return doc.body.innerHTML;
}

export function getSplitRowSideHtml(row, side) {
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

  const historicalBlock = row.historicalBlocks[0];
  const currentBlock = row.currentBlocks[0];
  const historicalText = historicalBlock.oldText || historicalBlock.text;
  const currentText = currentBlock.newText || currentBlock.text;
  if (!historicalText || !currentText || historicalText === currentText) return baseHtml;

  return decorateSimpleInlineHtml(
    baseHtml,
    side === 'historical' ? historicalText : currentText,
    buildInlineParts(historicalText, currentText),
    side
  );
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

  if (row.changeKind === 'removed') {
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
  return { ...stats, total: stats.additions + stats.removals + stats.modified };
}
