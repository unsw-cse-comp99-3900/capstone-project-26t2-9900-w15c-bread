import { buildStructureAwareTableDisplay } from './tableStructureDisplay';

function table(rows) {
  return [
    '<table><tbody>',
    ...rows.map(
      (row) => `<tr>${row.map((value) => `<td>${value}</td>`).join('')}</tr>`
    ),
    '</tbody></table>',
  ].join('');
}

function documentFor(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function count(doc, selector) {
  return doc.querySelectorAll(selector).length;
}

test.each([
  {
    name: 'insert row and insert column',
    historical: table([
      ['H1', 'H2', 'H3'],
      ['A1', 'A2', 'A3'],
      ['C1', 'C2', 'C3'],
    ]),
    current: table([
      ['H1', 'XH', 'H2', 'H3'],
      ['A1', 'AX', 'A2', 'A3'],
      ['B1', 'BX', 'B2', 'B3'],
      ['C1', 'CX', 'C2', 'C3'],
    ]),
    added: 7,
    removed: 0,
    gaps: 0,
  },
  {
    name: 'delete row and delete column',
    historical: table([
      ['H1', 'XH', 'H2', 'H3'],
      ['A1', 'AX', 'A2', 'A3'],
      ['B1', 'BX', 'B2', 'B3'],
      ['C1', 'CX', 'C2', 'C3'],
    ]),
    current: table([
      ['H1', 'H2', 'H3'],
      ['A1', 'A2', 'A3'],
      ['C1', 'C2', 'C3'],
    ]),
    added: 0,
    removed: 7,
    gaps: 0,
  },
  {
    name: 'insert row and delete column',
    historical: table([
      ['H1', 'H2', 'H3'],
      ['A1', 'A2', 'A3'],
      ['C1', 'C2', 'C3'],
    ]),
    current: table([
      ['H1', 'H3'],
      ['A1', 'A3'],
      ['B1', 'B3'],
      ['C1', 'C3'],
    ]),
    added: 2,
    removed: 3,
    gaps: 1,
  },
  {
    name: 'delete row and insert column',
    historical: table([
      ['H1', 'H3'],
      ['A1', 'A3'],
      ['B1', 'B3'],
      ['C1', 'C3'],
    ]),
    current: table([
      ['H1', 'H2', 'H3'],
      ['A1', 'A2', 'A3'],
      ['C1', 'C2', 'C3'],
    ]),
    added: 3,
    removed: 2,
    gaps: 1,
  },
])(
  'builds one conservative Inline union for $name',
  ({ historical, current, added, removed, gaps }) => {
    const result = buildStructureAwareTableDisplay(historical, current);
    const inline = documentFor(result.inlineComparisonHtml);

    expect(inline.querySelectorAll('table')).toHaveLength(1);
    expect(count(inline, '.dh-table-structure-diff--added')).toBe(added);
    expect(count(inline, '.dh-table-structure-diff--removed')).toBe(removed);
    expect(count(inline, '[data-dh-table-structural-gap="true"]')).toBe(gaps);
    expect(result.inlineComparisonHtml).not.toContain('sbs-inline-change');
  }
);

test('keeps source-specific tables separate while using the same two-axis mapping', () => {
  const historical = table([
    ['H1', 'H2', 'H3'],
    ['A1', 'A2', 'A3'],
    ['C1', 'C2', 'C3'],
  ]);
  const current = table([
    ['H1', 'XH', 'H2', 'H3'],
    ['A1', 'AX', 'A2', 'A3'],
    ['B1', 'BX', 'B2', 'B3'],
    ['C1', 'CX', 'C2', 'C3'],
  ]);
  const result = buildStructureAwareTableDisplay(historical, current);
  const historicalDoc = documentFor(result.historicalComparisonHtml);
  const currentDoc = documentFor(result.currentComparisonHtml);

  expect(count(historicalDoc, '.dh-table-structure-diff--removed')).toBe(0);
  expect(count(currentDoc, '.dh-table-structure-diff--added')).toBe(7);
  expect(result.historicalComparisonHtml).not.toContain('sbs-inline-change');
  expect(result.currentComparisonHtml).not.toContain('sbs-inline-change');
});

test('treats a middle column removal plus a trailing column insertion as structure', () => {
  const historical = table([
    ['Dimension', 'Assessment', 'test', '', 'Evidence', 'Status'],
    ['Functional', 'Ready', '', '', 'Regression evidence', 'PASS'],
    ['Reliability', 'Stable', '', '', 'Soak evidence', 'PASS'],
  ]);
  const current = table([
    ['Dimension', 'Assessment', 'test', 'Evidence', 'Status', ''],
    ['Functional', 'Ready', '', 'Regression evidence', 'PASS', ''],
    ['Reliability', 'Stable', '', 'Soak evidence', 'PASS', ''],
  ]);

  const result = buildStructureAwareTableDisplay(historical, current);
  const inline = documentFor(result.inlineComparisonHtml);
  const historicalDoc = documentFor(result.historicalComparisonHtml);
  const currentDoc = documentFor(result.currentComparisonHtml);

  expect(result.alignment.columns.historicalOnly).toEqual([3]);
  expect(result.alignment.columns.currentOnly).toEqual([5]);
  expect(result.alignment.columns.pairs).toEqual(
    expect.arrayContaining([
      { historicalIndex: 4, currentIndex: 3 },
      { historicalIndex: 5, currentIndex: 4 },
    ])
  );
  expect(count(inline, '.dh-table-structure-diff--removed')).toBe(3);
  expect(count(inline, '.dh-table-structure-diff--added')).toBe(3);
  expect(count(historicalDoc, '.dh-table-structure-diff--removed')).toBe(3);
  expect(count(currentDoc, '.dh-table-structure-diff--added')).toBe(3);
  expect(inline.body.textContent.match(/Evidence/g)).toHaveLength(1);
  expect(inline.body.textContent.match(/Status/g)).toHaveLength(1);
  expect(result.inlineComparisonHtml).not.toContain('sbs-inline-change');
});

test('treats a middle row removal plus a trailing row insertion as structure', () => {
  const historical = table([
    ['Dimension', 'Assessment', 'Status'],
    ['Functional', 'Ready', 'PASS'],
    ['', '', ''],
    ['Reliability', 'Stable', 'PASS'],
    ['Support', 'Prepared', 'OPEN'],
  ]);
  const current = table([
    ['Dimension', 'Assessment', 'Status'],
    ['Functional', 'Ready', 'PASS'],
    ['Reliability', 'Stable', 'PASS'],
    ['Support', 'Prepared', 'OPEN'],
    ['', '', ''],
  ]);

  const result = buildStructureAwareTableDisplay(historical, current);
  const inline = documentFor(result.inlineComparisonHtml);

  expect(result.alignment.rows.historicalOnly).toEqual([2]);
  expect(result.alignment.rows.currentOnly).toEqual([4]);
  expect(result.alignment.rows.pairs).toEqual(
    expect.arrayContaining([
      { historicalIndex: 3, currentIndex: 2 },
      { historicalIndex: 4, currentIndex: 3 },
    ])
  );
  expect(count(inline, '.dh-table-structure-diff--removed')).toBe(3);
  expect(count(inline, '.dh-table-structure-diff--added')).toBe(3);
  expect(inline.body.textContent.match(/Reliability/g)).toHaveLength(1);
  expect(inline.body.textContent.match(/Support/g)).toHaveLength(1);
});

test('does not reinterpret a same-position column content edit as structure', () => {
  const historical = table([
    ['Dimension', 'Assessment', 'Evidence'],
    ['Functional', 'Ready', 'Old evidence'],
    ['Reliability', 'Stable', 'Old soak result'],
  ]);
  const current = table([
    ['Dimension', 'Assessment', 'Evidence'],
    ['Functional', 'Ready', 'New evidence'],
    ['Reliability', 'Stable', 'New soak result'],
  ]);

  expect(buildStructureAwareTableDisplay(historical, current)).toBeNull();
});

test('keeps a genuine cell edit inside its paired cell during a two-axis change', () => {
  const historical = table([
    ['H1', 'H2', 'H3'],
    ['A1', 'A2', 'Original value'],
    ['C1', 'C2', 'C3'],
  ]);
  const current = table([
    ['H1', 'XH', 'H2', 'H3'],
    ['A1', 'AX', 'A2', 'Updated value'],
    ['B1', 'BX', 'B2', 'B3'],
    ['C1', 'CX', 'C2', 'C3'],
  ]);
  const result = buildStructureAwareTableDisplay(historical, current);
  const historicalDoc = documentFor(result.historicalComparisonHtml);
  const currentDoc = documentFor(result.currentComparisonHtml);

  expect(
    historicalDoc.querySelector('.sbs-inline-change--historical').textContent
  ).toBe('Original');
  expect(
    currentDoc.querySelector('.sbs-inline-change--current').textContent
  ).toBe('Updated');
  expect(
    historicalDoc
      .querySelector('.sbs-inline-change--historical')
      .closest('td').textContent
  ).toBe('Original value');
  expect(
    currentDoc
      .querySelector('.sbs-inline-change--current')
      .closest('td').textContent
  ).toBe('Updated value');
});

test('returns null for merged cells instead of guessing a display mapping', () => {
  const historical =
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
  const current =
    '<table><tbody><tr><td colspan="2">A and B</td><td>New</td></tr></tbody></table>';

  expect(buildStructureAwareTableDisplay(historical, current)).toBeNull();
});
