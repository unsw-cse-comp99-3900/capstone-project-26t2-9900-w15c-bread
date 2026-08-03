import { buildRichSideBySideInlineHtml } from './richInlineDiff';

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

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normaliseCellHtml(cell) {
  return String((cell && cell.innerHTML) || '').replace(/\s+/g, ' ').trim();
}

function cellIdentity(cell) {
  return `${cell.tagName.toLowerCase()}:${normaliseText(cell.textContent)}`;
}

function cellVisualSignature(cell) {
  return [
    cell.tagName.toLowerCase(),
    cell.getAttribute('data-dh-bg-color') || '',
    cell.getAttribute('style') || '',
  ].join(':');
}

/**
 * Parse only the rectangular subset that can be reconstructed without
 * guessing. Merged cells stay on the existing whole-table display fallback;
 * the recovery matcher remains responsible for their authoritative mapping.
 */
function parseRectangularTable(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const table = doc.body.querySelector('table');
  if (!table) return null;

  const rows = directTableRows(table);
  const cells = rows.map(directRowCells);
  if (!rows.length || !cells[0].length) return null;

  const columnCount = cells[0].length;
  if (
    cells.some(
      (rowCells) =>
        rowCells.length !== columnCount ||
        rowCells.some(
          (cell) =>
            (cell.getAttribute('rowspan') || '1') !== '1' ||
            (cell.getAttribute('colspan') || '1') !== '1'
        )
    )
  ) {
    return null;
  }

  return {
    doc,
    table,
    rows,
    cells,
    rowCount: rows.length,
    columnCount,
  };
}

function lcsLength(historical, current) {
  const matrix = Array.from(
    { length: historical.length + 1 },
    () => Array(current.length + 1).fill(0)
  );
  for (let oldIndex = historical.length - 1; oldIndex >= 0; oldIndex--) {
    for (
      let currentIndex = current.length - 1;
      currentIndex >= 0;
      currentIndex--
    ) {
      matrix[oldIndex][currentIndex] =
        historical[oldIndex] === current[currentIndex]
          ? matrix[oldIndex + 1][currentIndex + 1] + 1
          : Math.max(
              matrix[oldIndex + 1][currentIndex],
              matrix[oldIndex][currentIndex + 1]
            );
    }
  }
  return matrix[0][0];
}

function vectorSimilarity(historical, current) {
  const smallerLength = Math.min(historical.length, current.length);
  if (!smallerLength) return 0;
  return lcsLength(historical, current) / smallerLength;
}

function vectorSignature(vector) {
  return vector.join('\u241f');
}

/**
 * An all-empty row or column is useful as a visible gap, but it is not a safe
 * identity anchor. Two empty columns can occupy completely different logical
 * positions while still producing the same signature. Stable non-empty
 * neighbours must therefore decide how those gaps are aligned.
 */
function vectorHasMeaningfulContent(vector) {
  return vector.some((identity) => {
    const separatorIndex = identity.indexOf(':');
    return separatorIndex >= 0 && identity.slice(separatorIndex + 1).length > 0;
  });
}

function signatureCounts(vectors) {
  const counts = new Map();
  vectors.forEach((vector) => {
    const signature = vectorSignature(vector);
    counts.set(signature, (counts.get(signature) || 0) + 1);
  });
  return counts;
}

function hasAmbiguousDuplicateChange(historicalVectors, currentVectors) {
  const historicalCounts = signatureCounts(historicalVectors);
  const currentCounts = signatureCounts(currentVectors);
  return Array.from(historicalCounts.entries()).some(([signature, oldCount]) => {
    const currentCount = currentCounts.get(signature) || 0;
    return (
      oldCount > 0 &&
      currentCount > 0 &&
      oldCount !== currentCount &&
      (oldCount > 1 || currentCount > 1)
    );
  });
}

function hasReorderedUniqueAnchors(historicalVectors, currentVectors) {
  const historicalIndexes = new Map();
  const currentIndexes = new Map();
  historicalVectors.forEach((vector, index) => {
    const signature = vectorSignature(vector);
    const indexes = historicalIndexes.get(signature) || [];
    indexes.push(index);
    historicalIndexes.set(signature, indexes);
  });
  currentVectors.forEach((vector, index) => {
    const signature = vectorSignature(vector);
    const indexes = currentIndexes.get(signature) || [];
    indexes.push(index);
    currentIndexes.set(signature, indexes);
  });

  const anchors = [];
  historicalIndexes.forEach((oldIndexes, signature) => {
    const newIndexes = currentIndexes.get(signature);
    if (
      oldIndexes.length === 1 &&
      newIndexes &&
      newIndexes.length === 1 &&
      vectorHasMeaningfulContent(historicalVectors[oldIndexes[0]])
    ) {
      anchors.push({ oldIndex: oldIndexes[0], newIndex: newIndexes[0] });
    }
  });
  anchors.sort((left, right) => left.oldIndex - right.oldIndex);
  return anchors.some(
    (anchor, index) => index > 0 && anchor.newIndex <= anchors[index - 1].newIndex
  );
}

function directAxisAlignment(length) {
  return {
    slots: Array.from({ length }, (_, index) => ({
      historicalIndex: index,
      currentIndex: index,
    })),
    pairs: Array.from({ length }, (_, index) => ({
      historicalIndex: index,
      currentIndex: index,
    })),
    historicalOnly: [],
    currentOnly: [],
  };
}

/**
 * Equal row/column counts do not always mean equal structure. For example, a
 * user can delete one middle column and add another column at the far right.
 * Accept that as a net-zero structure change only when the monotonic matcher
 * leaves one or more items unmatched on both sides and also moves an exact,
 * meaningful anchor across logical coordinates. A normal same-position cell
 * edit has no such shifted anchor and keeps the established direct mapping.
 */
function alignEqualLengthAxis(historicalVectors, currentVectors) {
  const direct = directAxisAlignment(historicalVectors.length);
  const candidate = alignAxis(historicalVectors, currentVectors);
  if (
    !candidate ||
    !candidate.historicalOnly.length ||
    !candidate.currentOnly.length
  ) {
    return direct;
  }

  const hasShiftedExactAnchor = candidate.pairs.some(
    ({ historicalIndex, currentIndex }) =>
      historicalIndex !== currentIndex &&
      vectorHasMeaningfulContent(historicalVectors[historicalIndex]) &&
      vectorSignature(historicalVectors[historicalIndex]) ===
        vectorSignature(currentVectors[currentIndex])
  );

  return hasShiftedExactAnchor ? candidate : direct;
}

/**
 * Monotonically align logical rows or columns using their sequences of cell
 * identities. This is intentionally display-only and confidence-gated: a
 * weak or non-unique mapping returns null instead of manufacturing markers.
 */
function alignAxis(historicalVectors, currentVectors) {
  if (!historicalVectors.length || !currentVectors.length) return null;
  if (
    hasAmbiguousDuplicateChange(historicalVectors, currentVectors) ||
    hasReorderedUniqueAnchors(historicalVectors, currentVectors)
  ) {
    return null;
  }

  const oldLength = historicalVectors.length;
  const currentLength = currentVectors.length;
  const gapPenalty = -0.35;
  const minimumSimilarity = 0.6;
  const scores = Array.from(
    { length: oldLength },
    (_, oldIndex) =>
      Array.from({ length: currentLength }, (_, currentIndex) =>
        vectorSimilarity(
          historicalVectors[oldIndex],
          currentVectors[currentIndex]
        )
      )
  );
  const matrix = Array.from(
    { length: oldLength + 1 },
    () => Array(currentLength + 1).fill(Number.NEGATIVE_INFINITY)
  );
  const choices = Array.from(
    { length: oldLength + 1 },
    () => Array(currentLength + 1).fill('')
  );
  matrix[0][0] = 0;
  for (let oldIndex = 1; oldIndex <= oldLength; oldIndex++) {
    matrix[oldIndex][0] = matrix[oldIndex - 1][0] + gapPenalty;
    choices[oldIndex][0] = 'historical-only';
  }
  for (let currentIndex = 1; currentIndex <= currentLength; currentIndex++) {
    matrix[0][currentIndex] = matrix[0][currentIndex - 1] + gapPenalty;
    choices[0][currentIndex] = 'current-only';
  }

  for (let oldIndex = 1; oldIndex <= oldLength; oldIndex++) {
    for (
      let currentIndex = 1;
      currentIndex <= currentLength;
      currentIndex++
    ) {
      const similarity = scores[oldIndex - 1][currentIndex - 1];
      const candidates = [
        {
          type: 'historical-only',
          score: matrix[oldIndex - 1][currentIndex] + gapPenalty,
        },
        {
          type: 'current-only',
          score: matrix[oldIndex][currentIndex - 1] + gapPenalty,
        },
      ];
      if (similarity >= minimumSimilarity) {
        candidates.push({
          type: 'pair',
          score: matrix[oldIndex - 1][currentIndex - 1] + similarity,
        });
      }
      candidates.sort((left, right) => {
        if (Math.abs(right.score - left.score) > 0.0001) {
          return right.score - left.score;
        }
        // Prefer a real match on an exact tie, then keep gap ordering stable.
        const priority = { pair: 2, 'historical-only': 1, 'current-only': 0 };
        return priority[right.type] - priority[left.type];
      });
      matrix[oldIndex][currentIndex] = candidates[0].score;
      choices[oldIndex][currentIndex] = candidates[0].type;
    }
  }

  const reversedSlots = [];
  let oldIndex = oldLength;
  let currentIndex = currentLength;
  while (oldIndex > 0 || currentIndex > 0) {
    const choice = choices[oldIndex][currentIndex];
    if (choice === 'pair') {
      reversedSlots.push({
        historicalIndex: oldIndex - 1,
        currentIndex: currentIndex - 1,
      });
      oldIndex--;
      currentIndex--;
    } else if (choice === 'historical-only') {
      reversedSlots.push({ historicalIndex: oldIndex - 1, currentIndex: null });
      oldIndex--;
    } else if (choice === 'current-only') {
      reversedSlots.push({ historicalIndex: null, currentIndex: currentIndex - 1 });
      currentIndex--;
    } else {
      return null;
    }
  }

  const slots = reversedSlots.reverse();
  const pairs = slots.filter(
    (slot) => slot.historicalIndex !== null && slot.currentIndex !== null
  );
  if (pairs.length < Math.ceil(Math.min(oldLength, currentLength) / 2)) {
    return null;
  }

  // A weak match with an equally good alternative is not a safe display
  // anchor. Exact matches are allowed because their order has already been
  // checked above.
  const ambiguous = pairs.some(({ historicalIndex, currentIndex }) => {
    const selected = scores[historicalIndex][currentIndex];
    if (selected >= 0.9999) return false;
    const oldAlternatives = scores[historicalIndex].filter(
      (score, index) => index !== currentIndex && score >= selected - 0.05
    );
    const currentAlternatives = scores
      .map((row) => row[currentIndex])
      .filter(
        (score, index) => index !== historicalIndex && score >= selected - 0.05
      );
    return oldAlternatives.length > 0 || currentAlternatives.length > 0;
  });
  if (ambiguous) return null;

  return {
    slots,
    pairs,
    historicalOnly: slots
      .filter((slot) => slot.currentIndex === null)
      .map((slot) => slot.historicalIndex),
    currentOnly: slots
      .filter((slot) => slot.historicalIndex === null)
      .map((slot) => slot.currentIndex),
  };
}

function rowVectors(model) {
  return model.cells.map((rowCells) => rowCells.map(cellIdentity));
}

function columnVectors(model) {
  return Array.from({ length: model.columnCount }, (_, columnIndex) =>
    model.cells.map((rowCells) => cellIdentity(rowCells[columnIndex]))
  );
}

function buildAlignment(historical, current) {
  let rows;
  let columns;

  if (historical.rowCount === current.rowCount) {
    rows = alignEqualLengthAxis(
      rowVectors(historical),
      rowVectors(current)
    );
  } else {
    rows = alignAxis(rowVectors(historical), rowVectors(current));
  }
  if (historical.columnCount === current.columnCount) {
    columns = alignEqualLengthAxis(
      columnVectors(historical),
      columnVectors(current)
    );
  } else {
    columns = alignAxis(columnVectors(historical), columnVectors(current));
  }
  if (!rows || !columns) return null;

  return { rows, columns };
}

function decorateToneGrid(cells, toneGrid) {
  cells.forEach((rowCells, rowIndex) => {
    rowCells.forEach((cell, columnIndex) => {
      const tone = toneGrid[rowIndex] && toneGrid[rowIndex][columnIndex];
      if (!tone) return;
      cell.classList.add(
        'dh-table-structure-diff-cell',
        `dh-table-structure-diff--${tone}`
      );
      const neighbourTone = (row, column) =>
        toneGrid[row] && toneGrid[row][column];
      if (neighbourTone(rowIndex - 1, columnIndex) !== tone) {
        cell.classList.add('dh-table-structure-diff-edge--top');
      }
      if (neighbourTone(rowIndex + 1, columnIndex) !== tone) {
        cell.classList.add('dh-table-structure-diff-edge--bottom');
      }
      if (neighbourTone(rowIndex, columnIndex - 1) !== tone) {
        cell.classList.add('dh-table-structure-diff-edge--left');
      }
      if (neighbourTone(rowIndex, columnIndex + 1) !== tone) {
        cell.classList.add('dh-table-structure-diff-edge--right');
      }
    });
  });
}

function decorateSourceSpecificTables(historical, current, alignment) {
  alignment.rows.pairs.forEach((rowPair) => {
    alignment.columns.pairs.forEach((columnPair) => {
      const oldCell =
        historical.cells[rowPair.historicalIndex][columnPair.historicalIndex];
      const newCell =
        current.cells[rowPair.currentIndex][columnPair.currentIndex];
      const oldHtml = normaliseCellHtml(oldCell);
      const newHtml = normaliseCellHtml(newCell);
      const visualChanged =
        cellVisualSignature(oldCell) !== cellVisualSignature(newCell);
      if (oldHtml === newHtml && !visualChanged) return;

      if (oldHtml !== newHtml) {
        const comparison = buildRichSideBySideInlineHtml(
          oldCell.innerHTML,
          newCell.innerHTML
        );
        oldCell.innerHTML = comparison.historicalHtml;
        newCell.innerHTML = comparison.currentHtml;
      }
      oldCell.classList.add(
        'dh-table-cell-diff',
        'dh-table-cell-diff--historical'
      );
      newCell.classList.add(
        'dh-table-cell-diff',
        'dh-table-cell-diff--current'
      );
    });
  });

  const historicalToneGrid = historical.cells.map((rowCells, rowIndex) =>
    rowCells.map((_, columnIndex) =>
      alignment.rows.historicalOnly.includes(rowIndex) ||
      alignment.columns.historicalOnly.includes(columnIndex)
        ? 'removed'
        : ''
    )
  );
  const currentToneGrid = current.cells.map((rowCells, rowIndex) =>
    rowCells.map((_, columnIndex) =>
      alignment.rows.currentOnly.includes(rowIndex) ||
      alignment.columns.currentOnly.includes(columnIndex)
        ? 'added'
        : ''
    )
  );
  decorateToneGrid(historical.cells, historicalToneGrid);
  decorateToneGrid(current.cells, currentToneGrid);
}

function backgroundAttribute(cell) {
  const value = cell.getAttribute('data-dh-bg-color') || '';
  return value ? ` data-dh-bg-color="${value.replace(/"/g, '&quot;')}"` : '';
}

function cloneInlineCommonCell(doc, oldCell, newCell) {
  const clone = doc.importNode
    ? doc.importNode(newCell, true)
    : newCell.cloneNode(true);
  const oldHtml = normaliseCellHtml(oldCell);
  const newHtml = normaliseCellHtml(newCell);
  const visualChanged =
    cellVisualSignature(oldCell) !== cellVisualSignature(newCell);
  if (oldHtml === newHtml && !visualChanged) return clone;

  const comparison = buildRichSideBySideInlineHtml(
    oldCell.innerHTML,
    newCell.innerHTML
  );
  clone.classList.add('dh-table-cell-diff', 'dh-table-cell-diff--modified');
  clone.removeAttribute('data-dh-bg-color');
  clone.style.removeProperty('background');
  clone.style.removeProperty('background-color');
  if (!clone.getAttribute('style')) clone.removeAttribute('style');
  clone.innerHTML = [
    '<div class="dh-table-cell-versions">',
    `<div class="dh-table-cell-version dh-table-cell-version--previous"${backgroundAttribute(oldCell)}>`,
    `<div class="dh-table-cell-version__value">${comparison.historicalHtml || '&nbsp;'}</div>`,
    '</div>',
    `<div class="dh-table-cell-version dh-table-cell-version--current"${backgroundAttribute(newCell)}>`,
    `<div class="dh-table-cell-version__value">${comparison.currentHtml || '&nbsp;'}</div>`,
    '</div>',
    '</div>',
  ].join('');
  return clone;
}

function cloneIntoDocument(doc, node) {
  return doc.importNode ? doc.importNode(node, true) : node.cloneNode(true);
}

function appendCompositeRow(table, sectionState, sourceRow, row) {
  const sourceParent = sourceRow.parentElement;
  const sectionTag = sourceParent
    ? sourceParent.tagName.toLowerCase()
    : 'tbody';
  if (sectionTag === 'table') {
    table.appendChild(row);
    sectionState.element = null;
    sectionState.tag = '';
    return;
  }
  if (!sectionState.element || sectionState.tag !== sectionTag) {
    sectionState.element = table.ownerDocument.createElement(sectionTag);
    sectionState.tag = sectionTag;
    table.appendChild(sectionState.element);
  }
  sectionState.element.appendChild(row);
}

function buildInlineCompositeTable(historical, current, alignment) {
  const doc = current.doc;
  const table = current.table.cloneNode(false);
  table.classList.add('dh-table-diff', 'dh-table-diff--cell-level');
  const caption = Array.from(current.table.children).find(
    (child) => child.tagName.toLowerCase() === 'caption'
  );
  if (caption) table.appendChild(cloneIntoDocument(doc, caption));

  const renderedCells = [];
  const toneGrid = [];
  const sectionState = { element: null, tag: '' };
  alignment.rows.slots.forEach((rowSlot) => {
    const sourceRow =
      rowSlot.currentIndex !== null
        ? current.rows[rowSlot.currentIndex]
        : historical.rows[rowSlot.historicalIndex];
    const renderedRow = sourceRow.cloneNode(false);
    const rowCells = [];
    const rowTones = [];

    alignment.columns.slots.forEach((columnSlot) => {
      const oldExists =
        rowSlot.historicalIndex !== null && columnSlot.historicalIndex !== null;
      const currentExists =
        rowSlot.currentIndex !== null && columnSlot.currentIndex !== null;
      const oldCell = oldExists
        ? historical.cells[rowSlot.historicalIndex][columnSlot.historicalIndex]
        : null;
      const currentCell = currentExists
        ? current.cells[rowSlot.currentIndex][columnSlot.currentIndex]
        : null;
      let cell;
      let tone = '';

      if (oldCell && currentCell) {
        cell = cloneInlineCommonCell(doc, oldCell, currentCell);
      } else if (currentCell) {
        cell = cloneIntoDocument(doc, currentCell);
        tone = 'added';
      } else if (oldCell) {
        cell = cloneIntoDocument(doc, oldCell);
        tone = 'removed';
      } else {
        // Mixed add/remove axes create a logical corner that existed in
        // neither version. Keep it neutral, matching the established terminal
        // row/column behaviour.
        cell = doc.createElement('td');
        cell.setAttribute('data-dh-table-structural-gap', 'true');
        cell.setAttribute('aria-hidden', 'true');
        cell.innerHTML = '&nbsp;';
      }
      renderedRow.appendChild(cell);
      rowCells.push(cell);
      rowTones.push(tone);
    });

    appendCompositeRow(table, sectionState, sourceRow, renderedRow);
    renderedCells.push(rowCells);
    toneGrid.push(rowTones);
  });
  decorateToneGrid(renderedCells, toneGrid);
  return table.outerHTML;
}

/**
 * Build one shared read-only structure display for Inline and Side-by-side.
 * It never changes recovery metadata or Storage content. A null result is a
 * deliberate request to retain the existing whole-table fallback.
 */
export function buildStructureAwareTableDisplay(historicalHtml, currentHtml) {
  const historical = parseRectangularTable(historicalHtml);
  const current = parseRectangularTable(currentHtml);
  if (!historical || !current) return null;

  const alignment = buildAlignment(historical, current);
  if (!alignment) return null;
  if (
    !alignment.rows.historicalOnly.length &&
    !alignment.rows.currentOnly.length &&
    !alignment.columns.historicalOnly.length &&
    !alignment.columns.currentOnly.length
  ) {
    return null;
  }

  const inlineComparisonHtml = buildInlineCompositeTable(
    historical,
    current,
    alignment
  );
  decorateSourceSpecificTables(historical, current, alignment);
  return {
    inlineComparisonHtml,
    historicalComparisonHtml: historical.table.outerHTML,
    currentComparisonHtml: current.table.outerHTML,
    alignment,
  };
}
