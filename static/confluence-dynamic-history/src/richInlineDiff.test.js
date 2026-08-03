import { buildRichSideBySideInlineHtml } from './richInlineDiff';

test('compares matching tables cell by cell without highlighting unchanged cells', () => {
  const historical = [
    '<table><tbody>',
    '<tr><th data-dh-bg-color="#deebff">Parameter</th><th>Staging</th>',
    '<th>Production</th><th>Owner</th></tr>',
    '<tr><td>ORDER_API_TIMEOUT_MS</td><td>2500</td><td>2500</td>',
    '<td><p>Order</p><p>Platform</p></td></tr>',
    '</tbody></table>',
  ].join('');
  const current = historical.replace(/2500/g, '25000');

  const result = buildRichSideBySideInlineHtml(historical, current);
  const historicalDoc = new DOMParser().parseFromString(
    result.historicalHtml,
    'text/html'
  );
  const currentDoc = new DOMParser().parseFromString(
    result.currentHtml,
    'text/html'
  );

  expect(
    Array.from(
      historicalDoc.querySelectorAll('.sbs-inline-change--historical')
    ).map((node) => node.textContent)
  ).toEqual(['2500', '2500']);
  expect(
    Array.from(currentDoc.querySelectorAll('.sbs-inline-change--current')).map(
      (node) => node.textContent
    )
  ).toEqual(['25000', '25000']);
  expect(
    historicalDoc.querySelector('th').getAttribute('data-dh-bg-color')
  ).toBe('#deebff');
  expect(currentDoc.querySelector('th').getAttribute('data-dh-bg-color')).toBe(
    '#deebff'
  );
});

test('separates word additions and removals from formatting-only changes', () => {
  const result = buildRichSideBySideInlineHtml(
    '<p>A have do something</p>',
    '<p>A and B do <strong>something</strong></p>'
  );

  expect(result.historicalHtml).toContain(
    '<span class="sbs-inline-change sbs-inline-change--historical">have</span>'
  );
  const currentDocument = new DOMParser().parseFromString(
    result.currentHtml,
    'text/html'
  );
  expect(
    Array.from(
      currentDocument.querySelectorAll('.sbs-inline-change--current')
    ).map((node) => node.textContent.trim())
  ).toEqual(
    expect.arrayContaining(['and', 'B'])
  );
  expect(result.historicalHtml).toContain(
    '<span class="sbs-inline-change sbs-inline-change--format">something</span>'
  );
  expect(result.currentHtml).toContain(
    '<strong><span class="sbs-inline-change sbs-inline-change--format">something</span></strong>'
  );
});

test('ignores whitespace-only text changes instead of drawing highlight bars', () => {
  const result = buildRichSideBySideInlineHtml(
    '<p>alpha  beta</p>',
    '<p>alpha      beta</p>'
  );

  expect(result.historicalHtml).not.toContain('sbs-inline-change');
  expect(result.currentHtml).not.toContain('sbs-inline-change');
});

test('ignores formatting introduced by the diff highlighter itself', () => {
  const result = buildRichSideBySideInlineHtml(
    '<p>Stable text</p>',
    [
      '<p><span class="sbs-inline-change sbs-inline-change--current"',
      ' style="background: #abf5d1">Stable text</span></p>',
    ].join('')
  );

  expect(result.historicalHtml).not.toContain('sbs-inline-change');
  expect(
    (result.currentHtml.match(/sbs-inline-change--format/g) || [])
  ).toHaveLength(0);
});

test('does not decorate a source text-highlight background-only change', () => {
  const result = buildRichSideBySideInlineHtml(
    '<p>Customer support workflows remain available.</p>',
    '<p>Customer support <mark data-dh-bg-color="green">workflows</mark> remain available.</p>'
  );

  expect(result.historicalHtml).not.toContain('sbs-inline-change');
  expect(result.currentHtml).not.toContain('sbs-inline-change');
  expect(result.currentHtml).toContain(
    '<mark data-dh-bg-color="green">workflows</mark>'
  );
});
