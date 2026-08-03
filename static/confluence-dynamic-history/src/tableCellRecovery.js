import {
  getStorageNodeOuterHtml,
  normaliseStorageHtmlForParsing,
} from './utils';

const TABLE_CELL_CHOICE_MARKER = '::table-cell::';

function tableBlocksFromDisplayItems(items) {
  return (items || [])
    .map((item) => (item && item.block ? item.block : item))
    .filter(Boolean);
}

/**
 * Return the shared cell-level table metadata only for a table whose logical
 * grid is unchanged. Terminal row/column changes and unreliable mappings stay
 * on the existing whole-table recovery path.
 */
export function getCellScopedTableDiff(items) {
  const blocks = tableBlocksFromDisplayItems(items);
  if (!blocks.length || blocks.some((block) => block.nodeType !== 'table')) {
    return null;
  }

  const tableDiff = blocks[0].tableDiff;
  if (
    !tableDiff ||
    tableDiff.mode !== 'cell_level' ||
    tableDiff.structureChange !== 'same' ||
    !Array.isArray(tableDiff.changedCells) ||
    !tableDiff.changedCells.length ||
    blocks.some((block) => block.tableDiff !== tableDiff)
  ) {
    return null;
  }

  return tableDiff;
}

export function tableCellChoiceKey(tableChoiceKey, rowIndex, colIndex) {
  return `${tableChoiceKey}${TABLE_CELL_CHOICE_MARKER}${rowIndex}:${colIndex}`;
}

export function getTableCellChoices(blockChoices, tableChoiceKey) {
  const prefix = `${tableChoiceKey}${TABLE_CELL_CHOICE_MARKER}`;
  const choices = new Map();

  (blockChoices || new Map()).forEach((choice, key) => {
    const stringKey = String(key);
    if (!stringKey.startsWith(prefix)) return;

    const coordinate = stringKey.slice(prefix.length);
    if (!/^\d+:\d+$/.test(coordinate)) return;
    if (!['current', 'old'].includes(choice)) return;
    choices.set(coordinate, choice);
  });

  return choices;
}

/**
 * Expand one same-structure table row into one selectable recovery item per
 * changed logical cell. The underlying diff row and block indices are kept,
 * so summary classification and the established write-back workflow remain
 * unchanged.
 */
export function expandCellScopedSelectableRows(selectableRows) {
  return (selectableRows || []).flatMap((row) => {
    const tableDiff = getCellScopedTableDiff(row.blocks);
    if (!tableDiff) return [row];

    return tableDiff.changedCells.map((cell) => ({
      ...row,
      key: tableCellChoiceKey(row.key, cell.rowIndex, cell.colIndex),
      tableChoiceKey: row.key,
      tableCell: {
        rowIndex: cell.rowIndex,
        colIndex: cell.colIndex,
      },
    }));
  });
}

function directTableRows(table) {
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).filter(
    (row) => row.closest('table') === table
  );
}

function directRowCells(row) {
  return Array.from((row && row.children) || []).filter((cell) =>
    /^(td|th)$/i.test(cell.tagName || '')
  );
}

/**
 * Index physical table cells by their top-left logical grid coordinate. The
 * occupied-slot set is what keeps cells after rowspan/colspan aligned with
 * their corresponding cells in the other version.
 */
export function logicalTableCellMap(table) {
  const cells = new Map();
  const occupied = new Set();

  directTableRows(table).forEach((row, rowIndex) => {
    let colIndex = 0;

    directRowCells(row).forEach((cell) => {
      while (occupied.has(`${rowIndex}:${colIndex}`)) colIndex++;

      const rowspan = Math.max(
        1,
        Number.parseInt(cell.getAttribute('rowspan') || '1', 10) || 1
      );
      const colspan = Math.max(
        1,
        Number.parseInt(cell.getAttribute('colspan') || '1', 10) || 1
      );
      cells.set(`${rowIndex}:${colIndex}`, cell);

      for (let rowOffset = 0; rowOffset < rowspan; rowOffset++) {
        for (let colOffset = 0; colOffset < colspan; colOffset++) {
          occupied.add(`${rowIndex + rowOffset}:${colIndex + colOffset}`);
        }
      }
      colIndex += colspan;
    });
  });

  return cells;
}

function parseFirstTable(html, storageFormat) {
  const source = storageFormat
    ? normaliseStorageHtmlForParsing(html || '')
    : String(html || '');
  const doc = new DOMParser().parseFromString(source, 'text/html');
  return { doc, table: doc.body.querySelector('table') };
}

/**
 * Start with the complete current table and replace only cells explicitly
 * restored to the old version. This preserves the current table wrapper,
 * ordering and all untouched cells while copying the selected old cell's
 * complete content and attributes (including colour and formatting).
 */
export function mergeTableCellChoices({
  oldHtml,
  currentHtml,
  choices,
  storageFormat = false,
}) {
  if (!(choices instanceof Map) || !choices.size) return currentHtml || '';
  if (!Array.from(choices.values()).some((choice) => choice === 'old')) {
    return currentHtml || '';
  }

  const oldParsed = parseFirstTable(oldHtml, storageFormat);
  const currentParsed = parseFirstTable(currentHtml, storageFormat);
  if (!oldParsed.table || !currentParsed.table) return null;

  const oldCells = logicalTableCellMap(oldParsed.table);
  const currentCells = logicalTableCellMap(currentParsed.table);

  for (const [coordinate, choice] of choices) {
    if (choice !== 'old') continue;
    const oldCell = oldCells.get(coordinate);
    const currentCell = currentCells.get(coordinate);
    if (!oldCell || !currentCell) return null;

    const replacement =
      typeof currentParsed.doc.importNode === 'function'
        ? currentParsed.doc.importNode(oldCell, true)
        : oldCell.cloneNode(true);
    currentCell.replaceWith(replacement);
    currentCells.set(coordinate, replacement);
  }

  return storageFormat
    ? getStorageNodeOuterHtml(currentParsed.table)
    : currentParsed.table.outerHTML;
}

function blockTableHtml(block, side, storageFormat) {
  if (!block) return '';

  if (storageFormat) {
    return side === 'old'
      ? block.oldRawHtml || block.oldHtml || block.html || ''
      : block.newRawHtml || block.newHtml || block.html || '';
  }

  return side === 'old'
    ? block.oldRenderedHtml || block.renderedHtml || block.oldHtml || block.html || ''
    : block.newRenderedHtml || block.renderedHtml || block.newHtml || block.html || '';
}

/**
 * Detect either representation used by the existing diff pipeline:
 *   1. one modified table block, or
 *   2. an adjacent removed/added pair sharing one tableDiff object.
 *
 * The caller can then emit one mixed table and skip the consumed source blocks.
 */
export function buildCellScopedTableChoiceRun({
  blocks,
  index,
  blockChoices,
  blockChoiceKeys,
  storageFormat = false,
}) {
  const block = (blocks || [])[index];
  if (!block || block.nodeType !== 'table') return null;

  let oldBlock = null;
  let currentBlock = null;
  let consumed = 1;

  if (block.type === 'modified' && getCellScopedTableDiff([block])) {
    oldBlock = block;
    currentBlock = block;
  } else {
    const nextBlock = (blocks || [])[index + 1];
    if (
      block.type !== 'removed' ||
      !nextBlock ||
      nextBlock.type !== 'added' ||
      block.tableDiff !== nextBlock.tableDiff ||
      !getCellScopedTableDiff([block, nextBlock])
    ) {
      return null;
    }
    oldBlock = block;
    currentBlock = nextBlock;
    consumed = 2;
  }

  const tableChoiceKey =
    blockChoiceKeys.get(index) ||
    blockChoiceKeys.get(index + consumed - 1) ||
    String(index);
  const choices = getTableCellChoices(blockChoices, tableChoiceKey);
  if (!choices.size) return null;

  const html = mergeTableCellChoices({
    oldHtml: blockTableHtml(oldBlock, 'old', storageFormat),
    currentHtml: blockTableHtml(currentBlock, 'current', storageFormat),
    choices,
    storageFormat,
  });

  return html === null ? null : { html, consumed, tableChoiceKey };
}
