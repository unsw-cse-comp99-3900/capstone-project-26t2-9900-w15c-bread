import {
  buildFullDocumentSplitRows,
  buildFullDocumentSplitRowsFromDisplay,
  buildFullDocumentSplitStats,
  getSplitBlockHtml,
  getSplitRowSideHtml,
  isCellLevelTableRow,
} from './splitDiffModel';
import { buildRichTextDiffHtml } from '../utils';

function paragraph(type, text) {
  return {
    type,
    nodeType: 'paragraph',
    tag: 'p',
    text,
    renderedHtml: `<p>${text}</p>`,
    oldHtml: type === 'removed' ? `<p>${text}</p>` : '',
    newHtml: type === 'added' ? `<p>${text}</p>` : '',
  };
}

test('uses source-specific table HTML for a cell-level split row', () => {
  const diff = buildRichTextDiffHtml(
    '<table><tbody><tr><td>A</td><td>Old one</td></tr><tr><td>B</td><td>Old two</td></tr></tbody></table>',
    '<table><tbody><tr><td>A</td><td>New one</td></tr><tr><td>B</td><td>New two</td></tr></tbody></table>',
    '',
    {}
  );
  const rows = buildFullDocumentSplitRows(diff.blocks);
  const row = rows[0];

  expect(typeof isCellLevelTableRow).toBe('function');
  expect(isCellLevelTableRow(row)).toBe(true);
  expect(getSplitRowSideHtml(row, 'historical')).toBe(
    diff.blocks[0].tableDiff.historicalComparisonHtml
  );
  expect(getSplitRowSideHtml(row, 'current')).toBe(
    diff.blocks[0].tableDiff.currentComparisonHtml
  );
  expect(getSplitRowSideHtml(row, 'historical')).not.toContain('New one');
  expect(getSplitRowSideHtml(row, 'current')).not.toContain('Old one');
});

test.each([
  [
    'added',
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
    '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
    'current',
  ],
  [
    'removed',
    '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
    'historical',
  ],
])('keeps a terminal %s row on the matching split side', (tone, oldHtml, newHtml, side) => {
  const diff = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
  const row = buildFullDocumentSplitRows(diff.blocks)[0];
  const oppositeSide = side === 'historical' ? 'current' : 'historical';

  expect(getSplitRowSideHtml(row, side)).toContain(`dh-table-structure-diff--${tone}`);
  expect(getSplitRowSideHtml(row, oppositeSide)).not.toContain(
    `dh-table-structure-diff--${tone}`
  );
});

test('keeps unchanged context around aligned modifications', () => {
  const modified = {
    type: 'modified',
    nodeType: 'paragraph',
    tag: 'p',
    oldText: 'Historical wording',
    newText: 'Current wording',
    oldRenderedHtml: '<p>Historical wording</p>',
    newRenderedHtml: '<p>Current wording</p>',
  };
  const rows = buildFullDocumentSplitRows([
    paragraph('same', 'Heading context'),
    modified,
    paragraph('same', 'Ending context'),
  ]);

  expect(rows.map(({ kind }) => kind)).toEqual([
    'unchanged',
    'modified',
    'unchanged',
  ]);
  expect(rows[0]).toMatchObject({
    historical: expect.objectContaining({ text: 'Heading context' }),
    current: expect.objectContaining({ text: 'Heading context' }),
  });
  expect(rows[1]).toMatchObject({
    key: '1',
    indices: [1],
    historical: modified,
    current: modified,
  });
  expect(rows[2].historical.text).toBe('Ending context');
  expect(rows[2].current.text).toBe('Ending context');
});

test('uses actual version semantics for one-sided rows and stats', () => {
  const rows = buildFullDocumentSplitRows([
    paragraph('removed', 'Only historical'),
    paragraph('same', 'Anchor'),
    paragraph('added', 'Only current'),
  ]);

  expect(rows.map(({ kind }) => kind)).toEqual([
    'historical-only',
    'unchanged',
    'current-only',
  ]);
  expect(rows[0]).toMatchObject({ historical: expect.any(Object), current: null });
  expect(rows[2]).toMatchObject({ historical: null, current: expect.any(Object) });
  expect(buildFullDocumentSplitStats(rows)).toEqual({
    additions: 1,
    removals: 1,
    modified: 0,
    total: 2,
  });
});

test('keeps relocated endpoints independent and counts removal plus addition', () => {
  const display = {
    rows: [
      {
        type: 'change',
        changeKind: 'removed',
        key: '0',
        blocks: [{ block: paragraph('removed', 'Relocated content'), index: 0 }],
      },
      { type: 'same', key: '1', block: paragraph('same', 'Anchor'), index: 1 },
      {
        type: 'change',
        changeKind: 'added',
        key: '2',
        blocks: [{ block: paragraph('added', 'Relocated content'), index: 2 }],
      },
    ],
  };
  const rows = buildFullDocumentSplitRowsFromDisplay(display);

  expect(rows.map((row) => row.kind)).toEqual([
    'historical-only',
    'unchanged',
    'current-only',
  ]);
  expect(rows[0].key).toBe('0');
  expect(rows[2].key).toBe('2');
  expect(buildFullDocumentSplitStats(rows)).toEqual({
    additions: 1,
    removals: 1,
    modified: 0,
    total: 2,
  });
});

test('never mirrors decorated modified HTML into both source panes', () => {
  const block = {
    type: 'modified',
    oldRenderedHtml: '<p>Historical</p>',
    newRenderedHtml: '<p>Current</p>',
    renderedHtml: '<p>Combined decoration</p>',
  };

  expect(getSplitBlockHtml(block, 'historical')).toBe('<p>Historical</p>');
  expect(getSplitBlockHtml(block, 'current')).toBe('<p>Current</p>');
  expect(getSplitBlockHtml({ type: 'modified', renderedHtml: '<p>Combined</p>' }, 'historical')).toBe('');
});

test('keeps layout-width changes before their unchanged content', () => {
  const layoutWidthChange = {
    oldWidths: ['50', '50'],
    newWidths: ['35', '65'],
    changedColumnIndexes: [0, 1],
  };
  const rows = buildFullDocumentSplitRows([
    {
      type: 'same',
      isStructuralBoundary: true,
      layoutBoundaryEdge: 'start',
      layoutWrapperTag: 'ac:layout-section',
      layoutWidthChange,
      text: '',
    },
    paragraph('same', 'Layout content'),
  ]);

  expect(rows.map(({ kind }) => kind)).toEqual(['layout-width', 'unchanged']);
  expect(rows[0]).toMatchObject({
    key: 'layout-width:0',
    indices: [0],
    layoutWidthChange,
  });
  expect(buildFullDocumentSplitStats(rows).modified).toBe(1);
});

test('renders blank-line count changes as two-sided modifications', () => {
  const blankLineChange = {
    type: 'added',
    nodeType: 'blank_line_change',
    isBlankLineCountChange: true,
    oldRenderedHtml: '<div data-side="historical">2 blank lines</div>',
    newRenderedHtml: '<div data-side="current">5 blank lines</div>',
    oldBlankLineCount: 2,
    newBlankLineCount: 5,
  };

  const rows = buildFullDocumentSplitRows([blankLineChange]);

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: 'modified',
    historicalBlocks: [blankLineChange],
    currentBlocks: [blankLineChange],
  });
  expect(getSplitBlockHtml(rows[0].historical, 'historical')).toContain('2 blank lines');
  expect(getSplitBlockHtml(rows[0].current, 'current')).toContain('5 blank lines');
  expect(buildFullDocumentSplitStats(rows)).toEqual({
    additions: 0,
    removals: 0,
    modified: 1,
    total: 1,
  });
});

test('adds side-specific word highlights without combining source panes', () => {
  const rows = buildFullDocumentSplitRows([
    paragraph('removed', 'The historical wording stays'),
    paragraph('added', 'The current wording stays'),
  ]);

  expect(rows).toHaveLength(1);
  expect(rows[0].kind).toBe('modified');

  const historical = getSplitRowSideHtml(rows[0], 'historical');
  const current = getSplitRowSideHtml(rows[0], 'current');

  expect(historical).toContain('sbs-inline-change--historical');
  expect(historical).toContain('>historical</span>');
  expect(historical).not.toContain('>current</span>');
  expect(current).toContain('sbs-inline-change--current');
  expect(current).toContain('>current</span>');
  expect(current).not.toContain('>historical</span>');
});

test('preserves nested inline formatting while highlighting changed words', () => {
  const diff = buildRichTextDiffHtml(
    '<p>Keep the <strong>old</strong> wording</p>',
    '<p>Keep the <strong>new</strong> wording</p>',
    '',
    {}
  );
  const row = buildFullDocumentSplitRows(diff.blocks)[0];

  const historical = getSplitRowSideHtml(row, 'historical');
  const current = getSplitRowSideHtml(row, 'current');

  expect(historical).toContain(
    '<strong><span class="sbs-inline-change sbs-inline-change--historical">old</span></strong>'
  );
  expect(current).toContain(
    '<strong><span class="sbs-inline-change sbs-inline-change--current">new</span></strong>'
  );
});

test('keeps table inline highlights inside the cells whose values changed', () => {
  const historicalTable = [
    '<table><tbody>',
    '<tr><th>Parameter</th><th>Staging</th><th>Production</th><th>Owner</th></tr>',
    '<tr><td>ORDER_API_TIMEOUT_MS</td><td>2500</td><td>2500</td>',
    '<td><p>Order</p><p>Platform</p></td></tr>',
    '</tbody></table>',
  ].join('');
  const currentTable = historicalTable.replace(/2500/g, '25000');
  const diff = buildRichTextDiffHtml(historicalTable, currentTable, '', {});
  const row = buildFullDocumentSplitRows(diff.blocks)[0];

  const historical = getSplitRowSideHtml(row, 'historical');
  const current = getSplitRowSideHtml(row, 'current');
  const historicalDocument = new DOMParser().parseFromString(historical, 'text/html');
  const currentDocument = new DOMParser().parseFromString(current, 'text/html');

  expect(
    Array.from(
      historicalDocument.querySelectorAll('.sbs-inline-change--historical')
    ).map((node) => node.textContent)
  ).toEqual(['2500', '2500']);
  expect(
    Array.from(
      currentDocument.querySelectorAll('.sbs-inline-change--current')
    ).map((node) => node.textContent)
  ).toEqual(['25000', '25000']);
});

test('highlights formatting-only changes while retaining each source format', () => {
  const diff = buildRichTextDiffHtml(
    '<p>Keep the plain wording</p>',
    '<p>Keep the <strong>plain</strong> wording</p>',
    '',
    {}
  );
  const row = buildFullDocumentSplitRows(diff.blocks)[0];

  const historical = getSplitRowSideHtml(row, 'historical');
  const current = getSplitRowSideHtml(row, 'current');

  expect(historical).toContain(
    'the <span class="sbs-inline-change sbs-inline-change--historical">plain</span> wording'
  );
  expect(current).toContain(
    '<strong><span class="sbs-inline-change sbs-inline-change--current">plain</span></strong>'
  );
});

test.each([
  ['bold', '<strong>plain</strong>'],
  ['italic', '<em>plain</em>'],
  ['underline', '<u>plain</u>'],
  ['strike', '<s>plain</s>'],
  ['inline code', '<code>plain</code>'],
  ['text color', '<span data-dh-text-color="red">plain</span>'],
  ['background highlight', '<mark data-dh-bg-color="yellow">plain</mark>'],
])('highlights a %s-only change without flattening its markup', (_label, formatted) => {
  const block = {
    type: 'modified',
    nodeType: 'paragraph',
    tag: 'p',
    oldText: 'plain',
    newText: 'plain',
    oldRenderedHtml: '<p>plain</p>',
    newRenderedHtml: `<p>${formatted}</p>`,
  };
  const row = buildFullDocumentSplitRows([block])[0];

  expect(getSplitRowSideHtml(row, 'historical')).toContain(
    '<span class="sbs-inline-change sbs-inline-change--historical">plain</span>'
  );
  expect(getSplitRowSideHtml(row, 'current')).toContain(
    formatted.replace(
      'plain',
      '<span class="sbs-inline-change sbs-inline-change--current">plain</span>'
    )
  );
});

test('highlights a link destination change without replacing either link', () => {
  const diff = buildRichTextDiffHtml(
    '<p>Read the <a href="https://old.example">guide</a></p>',
    '<p>Read the <a href="https://new.example">guide</a></p>',
    '',
    {}
  );
  const row = buildFullDocumentSplitRows(diff.blocks)[0];

  const historical = getSplitRowSideHtml(row, 'historical');
  const current = getSplitRowSideHtml(row, 'current');

  expect(historical).toContain(
    '<a href="https://old.example" target="_blank" rel="noreferrer"><span class="sbs-inline-change sbs-inline-change--historical">guide</span></a>'
  );
  expect(current).toContain(
    '<a href="https://new.example" target="_blank" rel="noreferrer"><span class="sbs-inline-change sbs-inline-change--current">guide</span></a>'
  );
});

test('does not turn a block-level indentation change into a whole-sentence highlight', () => {
  const block = {
    type: 'modified',
    nodeType: 'paragraph',
    tag: 'p',
    oldText: 'Keep this sentence',
    newText: 'Keep this sentence',
    oldRenderedHtml: '<p data-dh-indent="1">Keep this sentence</p>',
    newRenderedHtml: '<p data-dh-indent="2">Keep this sentence</p>',
  };
  const row = buildFullDocumentSplitRows([block])[0];

  expect(getSplitRowSideHtml(row, 'historical')).not.toContain('sbs-inline-change');
  expect(getSplitRowSideHtml(row, 'current')).not.toContain('sbs-inline-change');
});

test('keeps neighbouring content when a change row also contains a blank-line transition', () => {
  const historicalParagraph = paragraph('removed', 'Historical paragraph');
  const blankLineChange = {
    type: 'added',
    nodeType: 'blank_line_change',
    isBlankLineCountChange: true,
    oldRenderedHtml: '<p>Two blank lines</p>',
    newRenderedHtml: '<p>Five blank lines</p>',
  };
  const currentParagraph = paragraph('added', 'Current paragraph');

  const rows = buildFullDocumentSplitRowsFromDisplay({
    rows: [{
      type: 'change',
      key: 'mixed-change',
      changeKind: 'modified',
      blocks: [
        { block: historicalParagraph, index: 0 },
        { block: blankLineChange, index: 1 },
        { block: currentParagraph, index: 2 },
      ],
    }],
  });

  expect(rows).toHaveLength(1);
  expect(rows[0].kind).toBe('modified');
  expect(rows[0].historicalBlocks).toEqual([
    historicalParagraph,
    blankLineChange,
  ]);
  expect(rows[0].currentBlocks).toEqual([
    blankLineChange,
    currentParagraph,
  ]);
  expect(getSplitRowSideHtml(rows[0], 'historical')).toContain('Historical paragraph');
  expect(getSplitRowSideHtml(rows[0], 'current')).toContain('Current paragraph');
});
