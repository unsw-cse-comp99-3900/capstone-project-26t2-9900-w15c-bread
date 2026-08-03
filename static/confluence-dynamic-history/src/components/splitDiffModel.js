import { buildDiffDisplayRows } from '../diffDisplay';
import { buildRichSideBySideInlineHtml } from '../richInlineDiff';
import { buildStructureAwareTableDisplay } from '../tableStructureDisplay';

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

function getStructureTableDiff(row) {
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
    !['side_by_side', 'structure'].includes(tableDiff.mode) ||
    currentBlock.tableDiff !== tableDiff
  ) {
    return null;
  }

  return tableDiff;
}

function directTableRows(table) {
  return Array.from(table.querySelectorAll('tr')).filter(
    (row) => row.closest('table') === table
  );
}

function directRowCells(row) {
  return Array.from(row.children).filter((cell) =>
    /^(td|th)$/i.test(cell.tagName)
  );
}

/**
 * Build the small, unambiguous logical-grid subset used by the split view.
 *
 * Middle row/column changes are deliberately rejected by the core recovery
 * matcher because restoring a guessed coordinate could write back the wrong
 * content. The split view has a narrower, read-only need: it can align plain
 * rectangular tables for display while leaving recovery at whole-table
 * granularity. Merged cells remain on the conservative raw-table fallback.
 */
function parseRectangularTable(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = doc.body.querySelector('table');
  if (!table) return null;

  const rows = directTableRows(table);
  const cells = rows.map(directRowCells);
  if (!rows.length || !cells[0].length) return null;

  const columnCount = cells[0].length;
  const isRectangular = cells.every(
    (rowCells) =>
      rowCells.length === columnCount &&
      rowCells.every(
        (cell) =>
          (cell.getAttribute('rowspan') || '1') === '1' &&
          (cell.getAttribute('colspan') || '1') === '1'
      )
  );
  if (!isRectangular) return null;

  return {
    doc,
    table,
    rows,
    cells,
    rowCount: rows.length,
    columnCount,
  };
}

function normaliseTableCellHtml(cell) {
  return String((cell && cell.innerHTML) || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableCellContentSignature(cell) {
  return [
    cell.tagName.toLowerCase(),
    normaliseTableCellHtml(cell),
  ].join(':');
}

function tableCellVisualSignature(cell) {
  return [
    cell.tagName.toLowerCase(),
    cell.getAttribute('data-dh-bg-color') || '',
    cell.getAttribute('style') || '',
  ].join(':');
}

function tableColumnSignatures(model) {
  return Array.from({ length: model.columnCount }, (_, columnIndex) =>
    model.cells
      .map((rowCells) => tableCellContentSignature(rowCells[columnIndex]))
      .join('\u241f')
  );
}

function tableRowSignatures(model) {
  return model.cells.map((rowCells) =>
    rowCells.map(tableCellContentSignature).join('\u241f')
  );
}

function uniqueSignatureIndexes(signatures) {
  const indexes = new Map();
  signatures.forEach((signature, index) => {
    const existing = indexes.get(signature) || [];
    existing.push(index);
    indexes.set(signature, existing);
  });
  return indexes;
}

/**
 * Align two row/column sequences around unique unchanged anchors.
 *
 * Equal-sized gaps between anchors represent modified but corresponding
 * items. A gap that exists on only one side is an insertion or deletion. If
 * both sides contain different-sized non-empty gaps, the mapping is
 * ambiguous; returning null keeps the source tables clean instead of adding
 * speculative red/green markers.
 */
function alignTableAxis(historicalSignatures, currentSignatures) {
  const historicalIndexes = uniqueSignatureIndexes(historicalSignatures);
  const currentIndexes = uniqueSignatureIndexes(currentSignatures);
  const anchors = [];

  historicalIndexes.forEach((historicalMatches, signature) => {
    const currentMatches = currentIndexes.get(signature);
    if (
      historicalMatches.length === 1 &&
      currentMatches &&
      currentMatches.length === 1
    ) {
      anchors.push({
        historicalIndex: historicalMatches[0],
        currentIndex: currentMatches[0],
      });
    }
  });
  anchors.sort(
    (left, right) => left.historicalIndex - right.historicalIndex
  );

  // Reordered stable anchors are a real structural move, not an insertion.
  // Do not force them into an incorrect monotonic coordinate mapping.
  if (
    anchors.some(
      (anchor, index) =>
        index > 0 &&
        anchor.currentIndex <= anchors[index - 1].currentIndex
    )
  ) {
    return null;
  }

  const pairs = [];
  const historicalOnly = [];
  const currentOnly = [];
  const boundaries = [
    { historicalIndex: -1, currentIndex: -1 },
    ...anchors,
    {
      historicalIndex: historicalSignatures.length,
      currentIndex: currentSignatures.length,
    },
  ];

  for (let index = 0; index < boundaries.length - 1; index++) {
    const before = boundaries[index];
    const after = boundaries[index + 1];
    const historicalGap = Array.from(
      {
        length: Math.max(
          0,
          after.historicalIndex - before.historicalIndex - 1
        ),
      },
      (_, offset) => before.historicalIndex + offset + 1
    );
    const currentGap = Array.from(
      {
        length: Math.max(0, after.currentIndex - before.currentIndex - 1),
      },
      (_, offset) => before.currentIndex + offset + 1
    );

    if (historicalGap.length === currentGap.length) {
      historicalGap.forEach((historicalIndex, offset) => {
        pairs.push({
          historicalIndex,
          currentIndex: currentGap[offset],
        });
      });
    } else if (!historicalGap.length) {
      currentOnly.push(...currentGap);
    } else if (!currentGap.length) {
      historicalOnly.push(...historicalGap);
    } else {
      return null;
    }

    if (after.historicalIndex < historicalSignatures.length) {
      pairs.push(after);
    }
  }

  return { pairs, historicalOnly, currentOnly };
}

function decorateStructuralAxis(model, indexes, axis, tone) {
  const changed = new Set(indexes);
  if (!changed.size) return;

  model.cells.forEach((rowCells, rowIndex) => {
    rowCells.forEach((cell, columnIndex) => {
      const axisIndex = axis === 'column' ? columnIndex : rowIndex;
      if (!changed.has(axisIndex)) return;

      cell.classList.add(
        'dh-table-structure-diff-cell',
        `dh-table-structure-diff--${tone}`
      );
      if (rowIndex === 0 || (axis === 'row' && !changed.has(rowIndex - 1))) {
        cell.classList.add('dh-table-structure-diff-edge--top');
      }
      if (
        rowIndex === model.rowCount - 1 ||
        (axis === 'row' && !changed.has(rowIndex + 1))
      ) {
        cell.classList.add('dh-table-structure-diff-edge--bottom');
      }
      if (
        columnIndex === 0 ||
        (axis === 'column' && !changed.has(columnIndex - 1))
      ) {
        cell.classList.add('dh-table-structure-diff-edge--left');
      }
      if (
        columnIndex === model.columnCount - 1 ||
        (axis === 'column' && !changed.has(columnIndex + 1))
      ) {
        cell.classList.add('dh-table-structure-diff-edge--right');
      }
    });
  });
}

function decoratePairedTableCells(
  historicalModel,
  currentModel,
  rowPairs,
  columnPairs
) {
  rowPairs.forEach(
    ({ historicalIndex: historicalRow, currentIndex: currentRow }) => {
      columnPairs.forEach(
        ({ historicalIndex: historicalColumn, currentIndex: currentColumn }) => {
          const historicalCell =
            historicalModel.cells[historicalRow][historicalColumn];
          const currentCell = currentModel.cells[currentRow][currentColumn];
          const historicalHtml = normaliseTableCellHtml(historicalCell);
          const currentHtml = normaliseTableCellHtml(currentCell);
          const visualChanged =
            tableCellVisualSignature(historicalCell) !==
            tableCellVisualSignature(currentCell);
          if (historicalHtml === currentHtml && !visualChanged) return;

          if (historicalHtml !== currentHtml) {
            // Only corresponding cells reach the ordinary rich-text
            // comparison. This prevents content from one column or row from
            // leaking into the markers of its neighbours.
            const comparison = buildRichSideBySideInlineHtml(
              historicalCell.innerHTML,
              currentCell.innerHTML
            );
            historicalCell.innerHTML = comparison.historicalHtml;
            currentCell.innerHTML = comparison.currentHtml;
          }
          historicalCell.classList.add(
            'dh-table-cell-diff',
            'dh-table-cell-diff--historical'
          );
          currentCell.classList.add(
            'dh-table-cell-diff',
            'dh-table-cell-diff--current'
          );
        }
      );
    }
  );
}

/**
 * Produce source-specific Side-by-side HTML for a safely alignable structural
 * row or column change. A null result means the renderer must show the two
 * untouched source tables without inline markers.
 */
function buildStructureAwareTableSplitHtml(historicalHtml, currentHtml) {
  const historical = parseRectangularTable(historicalHtml);
  const current = parseRectangularTable(currentHtml);
  if (!historical || !current) return null;

  let rowAlignment;
  let columnAlignment;

  if (
    historical.rowCount === current.rowCount &&
    historical.columnCount !== current.columnCount
  ) {
    rowAlignment = {
      pairs: Array.from({ length: historical.rowCount }, (_, index) => ({
        historicalIndex: index,
        currentIndex: index,
      })),
      historicalOnly: [],
      currentOnly: [],
    };
    columnAlignment = alignTableAxis(
      tableColumnSignatures(historical),
      tableColumnSignatures(current)
    );
  } else if (
    historical.columnCount === current.columnCount &&
    historical.rowCount !== current.rowCount
  ) {
    columnAlignment = {
      pairs: Array.from({ length: historical.columnCount }, (_, index) => ({
        historicalIndex: index,
        currentIndex: index,
      })),
      historicalOnly: [],
      currentOnly: [],
    };
    rowAlignment = alignTableAxis(
      tableRowSignatures(historical),
      tableRowSignatures(current)
    );
  } else {
    return null;
  }

  if (!rowAlignment || !columnAlignment) return null;

  decoratePairedTableCells(
    historical,
    current,
    rowAlignment.pairs,
    columnAlignment.pairs
  );
  decorateStructuralAxis(
    historical,
    rowAlignment.historicalOnly,
    'row',
    'removed'
  );
  decorateStructuralAxis(
    current,
    rowAlignment.currentOnly,
    'row',
    'added'
  );
  decorateStructuralAxis(
    historical,
    columnAlignment.historicalOnly,
    'column',
    'removed'
  );
  decorateStructuralAxis(
    current,
    columnAlignment.currentOnly,
    'column',
    'added'
  );

  return {
    historicalHtml: historical.table.outerHTML,
    currentHtml: current.table.outerHTML,
  };
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
    if (
      tableDiff.structureChange !== 'same' &&
      tableDiff.displayComparison
    ) {
      return side === 'historical'
        ? tableDiff.displayComparison.historicalComparisonHtml
        : tableDiff.displayComparison.currentComparisonHtml;
    }
    return side === 'historical'
      ? tableDiff.historicalComparisonHtml
      : tableDiff.currentComparisonHtml;
  }

  const structureTableDiff = getStructureTableDiff(row);
  if (structureTableDiff) {
    const historicalHtml = getSplitBlockHtml(
      row.historicalBlocks[0],
      'historical'
    );
    const currentHtml = getSplitBlockHtml(row.currentBlocks[0], 'current');
    const comparison =
      structureTableDiff.displayComparison ||
      buildStructureAwareTableDisplay(historicalHtml, currentHtml) ||
      buildStructureAwareTableSplitHtml(historicalHtml, currentHtml);

    // Even when the logical grid is too ambiguous for detailed display
    // alignment, return the untouched source table. Never flatten a
    // structurally changed table into textContent, because adjacent cells and
    // rows have no separators there and would create false inline markers.
    if (!comparison) {
      return side === 'historical' ? historicalHtml : currentHtml;
    }
    return side === 'historical'
      ? comparison.historicalComparisonHtml || comparison.historicalHtml
      : comparison.currentComparisonHtml || comparison.currentHtml;
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
