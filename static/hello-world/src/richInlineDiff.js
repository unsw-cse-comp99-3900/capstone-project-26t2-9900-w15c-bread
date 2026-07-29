function tokenizeInlineText(text) {
  return String(text || '').match(/[\u3400-\u9fff]|\s+|[A-Za-z0-9_]+|[^\s]/g) || [];
}

function appendPart(parts, type, text) {
  const previous = parts[parts.length - 1];
  if (previous && previous.type === type) previous.text += text;
  else parts.push({ type, text });
}

function buildInlineParts(historicalText, currentText) {
  const historical = tokenizeInlineText(historicalText);
  const current = tokenizeInlineText(currentText);
  if (historical.length * current.length > 40000) return [];

  const lcs = Array.from(
    { length: historical.length + 1 },
    () => Array(current.length + 1).fill(0)
  );
  for (let oldIndex = historical.length - 1; oldIndex >= 0; oldIndex--) {
    for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex--) {
      lcs[oldIndex][currentIndex] = historical[oldIndex] === current[currentIndex]
        ? lcs[oldIndex + 1][currentIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][currentIndex], lcs[oldIndex][currentIndex + 1]);
    }
  }

  const parts = [];
  let oldIndex = 0;
  let currentIndex = 0;
  while (oldIndex < historical.length || currentIndex < current.length) {
    if (
      oldIndex < historical.length &&
      currentIndex < current.length &&
      historical[oldIndex] === current[currentIndex]
    ) {
      appendPart(parts, 'same', historical[oldIndex]);
      oldIndex++;
      currentIndex++;
    } else if (
      currentIndex >= current.length ||
      (oldIndex < historical.length &&
        lcs[oldIndex + 1][currentIndex] >= lcs[oldIndex][currentIndex + 1])
    ) {
      appendPart(parts, 'removed', historical[oldIndex]);
      oldIndex++;
    } else {
      appendPart(parts, 'added', current[currentIndex]);
      currentIndex++;
    }
  }
  return parts;
}

function parseInlineRoot(html) {
  const doc = new DOMParser().parseFromString(
    `<div data-sbs-inline-root="true">${html || ''}</div>`,
    'text/html'
  );
  return { doc, root: doc.body.querySelector('[data-sbs-inline-root="true"]') };
}

function getSingleRootTable(root) {
  if (!root || root.children.length !== 1) return null;
  const child = root.firstElementChild;
  return child && child.tagName.toLowerCase() === 'table' ? child : null;
}

function getDirectTableRows(table) {
  return Array.from(table.querySelectorAll('tr')).filter(
    (row) => row.closest('table') === table
  );
}

function getDirectRowCells(row) {
  return Array.from(row.children).filter((cell) =>
    /^(td|th)$/i.test(cell.tagName)
  );
}

function haveMatchingTableStructure(historicalRows, currentRows) {
  if (historicalRows.length !== currentRows.length) return false;

  return historicalRows.every((historicalRow, rowIndex) => {
    const historicalCells = getDirectRowCells(historicalRow);
    const currentCells = getDirectRowCells(currentRows[rowIndex]);
    if (historicalCells.length !== currentCells.length) return false;

    return historicalCells.every((historicalCell, cellIndex) => {
      const currentCell = currentCells[cellIndex];
      return (
        historicalCell.tagName === currentCell.tagName &&
        (historicalCell.getAttribute('rowspan') || '1') ===
          (currentCell.getAttribute('rowspan') || '1') &&
        (historicalCell.getAttribute('colspan') || '1') ===
          (currentCell.getAttribute('colspan') || '1')
      );
    });
  });
}

const INLINE_FORMAT_TAGS = new Set([
  'a',
  'b',
  'code',
  'del',
  'em',
  'i',
  'mark',
  's',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'u',
]);

function decorateMatchingTableCells(historicalRoot, currentRoot) {
  const historicalTable = getSingleRootTable(historicalRoot);
  const currentTable = getSingleRootTable(currentRoot);
  if (!historicalTable || !currentTable) return false;

  const historicalRows = getDirectTableRows(historicalTable);
  const currentRows = getDirectTableRows(currentTable);
  if (!haveMatchingTableStructure(historicalRows, currentRows)) return false;

  // A table's textContent has no cell separators. Comparing the whole table
  // would merge neighbouring values into one token, so compare corresponding
  // cells independently and preserve each source cell's own attributes.
  historicalRows.forEach((historicalRow, rowIndex) => {
    const historicalCells = getDirectRowCells(historicalRow);
    const currentCells = getDirectRowCells(currentRows[rowIndex]);

    historicalCells.forEach((historicalCell, cellIndex) => {
      const currentCell = currentCells[cellIndex];
      const comparison = buildRichSideBySideInlineHtml(
        historicalCell.innerHTML,
        currentCell.innerHTML
      );
      historicalCell.innerHTML = comparison.historicalHtml;
      currentCell.innerHTML = comparison.currentHtml;
    });
  });

  return true;
}

function elementFormatSignature(element, root) {
  const signatures = [];
  let current = element;
  while (current && current !== root) {
    const tagName = current.tagName.toLowerCase();
    if (INLINE_FORMAT_TAGS.has(tagName)) {
      const attributes = Array.from(current.attributes || [])
        .map(({ name, value }) => `${name.toLowerCase()}=${value}`)
        .sort()
        .join(';');
      signatures.push(`${tagName}[${attributes}]`);
    }
    current = current.parentElement;
  }
  return signatures.reverse().join('>');
}

function collectTextState(root) {
  const nodes = [];
  const formats = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || '';
    const signature = elementFormatSignature(node.parentElement, root);
    nodes.push({ node, start: offset, end: offset + value.length });
    for (let index = 0; index < value.length; index++) formats.push(signature);
    offset += value.length;
    node = walker.nextNode();
  }
  return { nodes, formats, text: root.textContent || '' };
}

function appendInterval(intervals, start, end) {
  if (end <= start) return;
  const previous = intervals[intervals.length - 1];
  if (previous && previous.end === start) previous.end = end;
  else intervals.push({ start, end });
}

function buildChangedIntervals(parts, historicalFormats, currentFormats) {
  const historical = [];
  const current = [];
  let historicalOffset = 0;
  let currentOffset = 0;

  parts.forEach((part) => {
    const length = part.text.length;
    if (part.type === 'removed') {
      appendInterval(historical, historicalOffset, historicalOffset + length);
      historicalOffset += length;
      return;
    }
    if (part.type === 'added') {
      appendInterval(current, currentOffset, currentOffset + length);
      currentOffset += length;
      return;
    }

    // Text that is equal can still have different inline markup. Compare the
    // formatting ancestry for each character so a bold/italic/link change is
    // visible without flattening either source's DOM tree.
    let runStart = null;
    for (let index = 0; index < length; index++) {
      const differs =
        historicalFormats[historicalOffset + index] !==
        currentFormats[currentOffset + index];
      if (differs && runStart === null) runStart = index;
      if (!differs && runStart !== null) {
        appendInterval(historical, historicalOffset + runStart, historicalOffset + index);
        appendInterval(current, currentOffset + runStart, currentOffset + index);
        runStart = null;
      }
    }
    if (runStart !== null) {
      appendInterval(historical, historicalOffset + runStart, historicalOffset + length);
      appendInterval(current, currentOffset + runStart, currentOffset + length);
    }
    historicalOffset += length;
    currentOffset += length;
  });

  return { historical, current };
}

function decorateIntervals(state, intervals, side) {
  if (!intervals.length) return;

  state.nodes.forEach(({ node, start, end }) => {
    const intersections = intervals
      .map((interval) => ({
        start: Math.max(start, interval.start),
        end: Math.min(end, interval.end),
      }))
      .filter((interval) => interval.end > interval.start);
    if (!intersections.length || !node.parentNode) return;

    const value = node.nodeValue || '';
    const fragment = node.ownerDocument.createDocumentFragment();
    let cursor = start;
    intersections.forEach((interval) => {
      if (interval.start > cursor) {
        fragment.appendChild(
          node.ownerDocument.createTextNode(value.slice(cursor - start, interval.start - start))
        );
      }
      const highlight = node.ownerDocument.createElement('span');
      highlight.className = `sbs-inline-change sbs-inline-change--${side}`;
      highlight.textContent = value.slice(interval.start - start, interval.end - start);
      fragment.appendChild(highlight);
      cursor = interval.end;
    });
    if (cursor < end) {
      fragment.appendChild(node.ownerDocument.createTextNode(value.slice(cursor - start)));
    }
    node.parentNode.replaceChild(fragment, node);
  });
}

/**
 * Builds source-specific word/format highlights without rebuilding the rich
 * content. Each side keeps its own safe rendered markup; only the affected
 * text-node ranges receive side-by-side highlight spans.
 */
export function buildRichSideBySideInlineHtml(historicalHtml, currentHtml) {
  const historicalParsed = parseInlineRoot(historicalHtml);
  const currentParsed = parseInlineRoot(currentHtml);
  if (!historicalParsed.root || !currentParsed.root) {
    return { historicalHtml, currentHtml };
  }

  if (
    decorateMatchingTableCells(
      historicalParsed.root,
      currentParsed.root
    )
  ) {
    return {
      historicalHtml: historicalParsed.root.innerHTML,
      currentHtml: currentParsed.root.innerHTML,
    };
  }

  const historicalState = collectTextState(historicalParsed.root);
  const currentState = collectTextState(currentParsed.root);
  const parts = buildInlineParts(historicalState.text, currentState.text);
  if (!parts.length) return { historicalHtml, currentHtml };

  const intervals = buildChangedIntervals(
    parts,
    historicalState.formats,
    currentState.formats
  );
  decorateIntervals(historicalState, intervals.historical, 'historical');
  decorateIntervals(currentState, intervals.current, 'current');

  return {
    historicalHtml: historicalParsed.root.innerHTML,
    currentHtml: currentParsed.root.innerHTML,
  };
}
