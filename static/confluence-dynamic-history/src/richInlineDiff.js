function tokenizeInlineText(text) {
  return String(text || '').match(/[\u3400-\u9fff]|\s+|[A-Za-z0-9_]+|[^\s]/g) || [];
}

// DOM textContent deliberately omits the visual separator between block-level
// elements. For example, `<p>Version 1.0</p><p>Last reviewed</p>` becomes
// `Version 1.0Last reviewed`. The tokenizer then treats `0Last` as one word,
// so changing the version can incorrectly highlight `Last` on the next line.
// These elements start or end a distinct text flow and therefore need a
// virtual newline in the comparison model. The newline exists only in the
// model: source HTML and recovery content remain untouched.
const INLINE_TEXT_BOUNDARY_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

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

// These tags change how existing text is presented. Equivalent HTML aliases
// share one canonical name so a serializer changing <b> to <strong>, or <i>
// to <em>, does not create a false formatting change.
const CANONICAL_VISUAL_TAGS = new Map([
  ['b', 'strong'],
  ['strong', 'strong'],
  ['i', 'em'],
  ['em', 'em'],
  ['u', 'u'],
  ['s', 's'],
  ['strike', 's'],
  ['del', 's'],
  ['code', 'code'],
  ['sub', 'sub'],
  ['sup', 'sup'],
]);

// Inline entities can keep the same visible label while changing meaning. A
// link destination or mention account must therefore remain a red/green
// replacement rather than being presented as a yellow visual-format change.
const INLINE_SEMANTIC_TAGS = new Set(['a', 'span', 'time']);
const VISUAL_ATTRIBUTE_NAMES = new Set([
  'bgcolor',
  'color',
  'data-dh-bg-color',
  'data-dh-border-color',
  'data-dh-text-color',
]);
const IGNORED_TEXT_HIGHLIGHT_ATTRIBUTES = new Set([
  'bgcolor',
  'data-dh-bg-color',
]);
const VISUAL_STYLE_PROPERTIES = new Set([
  'color',
  'font-style',
  'font-weight',
  'text-decoration',
  'text-decoration-line',
  'vertical-align',
]);

function isGeneratedDiffHighlight(element) {
  if (!element || !element.classList) return false;
  // These wrappers are presentation added by this comparison tool. They must
  // never become input to a later comparison and manufacture a yellow
  // formatting change merely because one side has already been decorated.
  return element.classList.contains('sbs-inline-change');
}

function normaliseInlineAttributeValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function visualStyleSignature(styleText) {
  return String(styleText || '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return null;
      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      if (!VISUAL_STYLE_PROPERTIES.has(property)) return null;
      const value = normaliseInlineAttributeValue(
        declaration.slice(separatorIndex + 1)
      );
      return value ? `${property}:${value}` : null;
    })
    .filter(Boolean)
    .sort()
    .join(';');
}

function getVisualAttributeSignatures(element) {
  const signatures = [];
  Array.from(element.attributes || []).forEach(({ name, value }) => {
    const attributeName = name.toLowerCase();
    if (attributeName === 'style') {
      const styleSignature = visualStyleSignature(value);
      if (styleSignature) signatures.push(`style=${styleSignature}`);
      return;
    }
    if (IGNORED_TEXT_HIGHLIGHT_ATTRIBUTES.has(attributeName)) return;
    if (!VISUAL_ATTRIBUTE_NAMES.has(attributeName)) return;
    const normalisedValue = normaliseInlineAttributeValue(value);
    if (normalisedValue) {
      signatures.push(`${attributeName}=${normalisedValue}`);
    }
  });
  return signatures.sort();
}

function getSemanticAttributeSignatures(element) {
  return Array.from(element.attributes || [])
    .map(({ name, value }) => ({
      name: name.toLowerCase(),
      value: normaliseInlineAttributeValue(value),
    }))
    .filter(({ name, value }) => {
      if (!value || name === 'class' || name === 'style') return false;
      if (name === 'aria-hidden' || VISUAL_ATTRIBUTE_NAMES.has(name)) return false;
      return true;
    })
    .map(({ name, value }) => `${name}=${value}`)
    .sort();
}

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

function elementInlineSignatures(element, root) {
  const visualSignatures = [];
  const semanticSignatures = [];
  let current = element;
  while (current && current !== root) {
    if (isGeneratedDiffHighlight(current)) {
      current = current.parentElement;
      continue;
    }
    const tagName = current.tagName.toLowerCase();
    const visualTag = CANONICAL_VISUAL_TAGS.get(tagName);
    const visualAttributes = getVisualAttributeSignatures(current);
    if (visualTag || visualAttributes.length) {
      visualSignatures.push(
        `${visualTag || tagName}[${visualAttributes.join(';')}]`
      );
    }

    const semanticAttributes = getSemanticAttributeSignatures(current);
    if (
      INLINE_SEMANTIC_TAGS.has(tagName) &&
      (tagName !== 'span' || semanticAttributes.length)
    ) {
      semanticSignatures.push(`${tagName}[${semanticAttributes.join(';')}]`);
    } else if (visualTag && semanticAttributes.length) {
      // Visual wrappers can also carry a semantic identifier. Preserve that
      // identifier separately so changing it is never mistaken for restyling.
      semanticSignatures.push(`${visualTag}[${semanticAttributes.join(';')}]`);
    }
    current = current.parentElement;
  }
  return {
    semantic: semanticSignatures.reverse().join('>'),
    visual: visualSignatures.reverse().join('>'),
  };
}

function collectTextState(root) {
  const nodes = [];
  const semanticFormats = [];
  const visualFormats = [];
  const textParts = [];
  let offset = 0;

  const appendBoundary = () => {
    // Repeated nested block boundaries should behave as one separator. This
    // also avoids adding a leading boundary before the first visible text.
    if (!offset || textParts[textParts.length - 1] === '\n') return;
    textParts.push('\n');
    semanticFormats.push('');
    visualFormats.push('');
    offset++;
  };

  const appendTextNode = (node) => {
    const value = node.nodeValue || '';
    const signatures = elementInlineSignatures(node.parentElement, root);
    nodes.push({ node, start: offset, end: offset + value.length });
    textParts.push(value);
    for (let index = 0; index < value.length; index++) {
      semanticFormats.push(signatures.semantic);
      visualFormats.push(signatures.visual);
    }
    offset += value.length;
  };

  const visit = (node) => {
    if (node.nodeType === 3) {
      appendTextNode(node);
      return;
    }
    if (node.nodeType !== 1) return;

    const tagName = node.tagName.toLowerCase();
    if (tagName === 'br') {
      appendBoundary();
      return;
    }

    const createsBoundary =
      node !== root && INLINE_TEXT_BOUNDARY_TAGS.has(tagName);
    if (createsBoundary) appendBoundary();
    Array.from(node.childNodes || []).forEach(visit);
    if (createsBoundary) appendBoundary();
  };

  Array.from(root.childNodes || []).forEach(visit);

  return {
    nodes,
    semanticFormats,
    text: textParts.join(''),
    visualFormats,
  };
}

function appendInterval(intervals, start, end, kind) {
  if (end <= start) return;
  const previous = intervals[intervals.length - 1];
  // Adjacent changes may have different meanings, for example a removed word
  // immediately followed by text whose bold state changed. Only merge ranges
  // when their presentation kind is also identical.
  if (previous && previous.end === start && previous.kind === kind) {
    previous.end = end;
  } else {
    intervals.push({ start, end, kind });
  }
}

function buildChangedIntervals(parts, historicalState, currentState) {
  const historical = [];
  const current = [];
  let historicalOffset = 0;
  let currentOffset = 0;

  parts.forEach((part) => {
    const length = part.text.length;
    if (part.type === 'removed') {
      appendInterval(
        historical,
        historicalOffset,
        historicalOffset + length,
        'removed'
      );
      historicalOffset += length;
      return;
    }
    if (part.type === 'added') {
      appendInterval(current, currentOffset, currentOffset + length, 'added');
      currentOffset += length;
      return;
    }

    // Equal text can still differ visually or semantically. Semantic changes
    // take priority and remain red/green replacements; only presentation-only
    // differences receive the shared yellow formatting marker.
    let runStart = null;
    let runKind = null;
    for (let index = 0; index < length; index++) {
      const semanticDiffers =
        historicalState.semanticFormats[historicalOffset + index] !==
        currentState.semanticFormats[currentOffset + index];
      const visualDiffers =
        historicalState.visualFormats[historicalOffset + index] !==
        currentState.visualFormats[currentOffset + index];
      const nextKind = semanticDiffers
        ? 'semantic'
        : visualDiffers
          ? 'format'
          : null;

      if (nextKind !== runKind) {
        if (runKind !== null) {
          appendAlignedInterval(
            historical,
            current,
            historicalOffset,
            currentOffset,
            runStart,
            index,
            runKind
          );
        }
        runStart = nextKind === null ? null : index;
        runKind = nextKind;
      }
    }
    if (runKind !== null) {
      appendAlignedInterval(
        historical,
        current,
        historicalOffset,
        currentOffset,
        runStart,
        length,
        runKind
      );
    }
    historicalOffset += length;
    currentOffset += length;
  });

  return { historical, current };
}

function appendAlignedInterval(
  historical,
  current,
  historicalOffset,
  currentOffset,
  runStart,
  runEnd,
  kind
) {
  if (kind === 'semantic') {
    appendInterval(
      historical,
      historicalOffset + runStart,
      historicalOffset + runEnd,
      'removed'
    );
    appendInterval(
      current,
      currentOffset + runStart,
      currentOffset + runEnd,
      'added'
    );
    return;
  }

  appendInterval(
    historical,
    historicalOffset + runStart,
    historicalOffset + runEnd,
    'format'
  );
  appendInterval(
    current,
    currentOffset + runStart,
    currentOffset + runEnd,
    'format'
  );
}

function decorateIntervals(state, intervals, side) {
  if (!intervals.length) return;

  state.nodes.forEach(({ node, start, end }) => {
    const value = node.nodeValue || '';
    const intersections = intervals
      .map((interval) => ({
        start: Math.max(start, interval.start),
        end: Math.min(end, interval.end),
        kind: interval.kind,
      }))
      .filter(
        (interval) =>
          interval.end > interval.start &&
          // Whitespace remains in the source DOM but receives no marker.
          // Highlighting spaces with line-through is visually indistinguishable
          // from drawing an unexplained horizontal dash in code and rich text.
          value.slice(interval.start - start, interval.end - start).trim()
      );
    if (!intersections.length || !node.parentNode) return;

    const fragment = node.ownerDocument.createDocumentFragment();
    let cursor = start;
    intersections.forEach((interval) => {
      if (interval.start > cursor) {
        fragment.appendChild(
          node.ownerDocument.createTextNode(value.slice(cursor - start, interval.start - start))
        );
      }
      const highlight = node.ownerDocument.createElement('span');
      const tone = interval.kind === 'format' ? 'format' : side;
      highlight.className = `sbs-inline-change sbs-inline-change--${tone}`;
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
    historicalState,
    currentState
  );
  decorateIntervals(historicalState, intervals.historical, 'historical');
  decorateIntervals(currentState, intervals.current, 'current');

  return {
    historicalHtml: historicalParsed.root.innerHTML,
    currentHtml: currentParsed.root.innerHTML,
  };
}
