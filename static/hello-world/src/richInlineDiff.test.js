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
