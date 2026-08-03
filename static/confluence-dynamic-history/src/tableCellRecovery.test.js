import { buildDiffDisplayRows } from './diffDisplay';
import { buildRecoveryStorageHtml } from './recoveryStorage';
import {
  expandCellScopedSelectableRows,
  getCellScopedTableDiff,
  tableCellChoiceKey,
} from './tableCellRecovery';
import { buildRecoveryPreviewHtml } from './useRecoveryWorkflow';
import { buildRichTextDiffHtml } from './utils';

function buildTableModel(oldStorage, currentStorage) {
  const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
  const display = buildDiffDisplayRows(diff.blocks);
  const tableRow = display.selectableRows.find((row) =>
    Boolean(getCellScopedTableDiff(row.blocks))
  );
  return { diff, display, tableRow };
}

describe('same-structure table cell recovery', () => {
  test('expands one table choice into one selectable key per changed cell', () => {
    const model = buildTableModel(
      '<table><tbody><tr><td>Value A old</td><td>Value B old</td></tr></tbody></table>',
      '<table><tbody><tr><td>Value A new</td><td>Value B new</td></tr></tbody></table>'
    );
    const expanded = expandCellScopedSelectableRows(
      model.display.selectableRows
    );

    expect(expanded.map((row) => row.key)).toEqual([
      tableCellChoiceKey(model.tableRow.key, 0, 0),
      tableCellChoiceKey(model.tableRow.key, 0, 1),
    ]);
  });

  test('restores only the selected logical cell in Storage and preview HTML', () => {
    const oldStorage = [
      '<table><tbody><tr>',
      '<td data-highlight-colour="#deebff"><strong>Old A</strong></td>',
      '<td>Old B</td>',
      '</tr></tbody></table>',
    ].join('');
    const currentStorage = [
      '<table><tbody><tr>',
      '<td data-highlight-colour="#ffebe6"><em>New A</em></td>',
      '<td>New B</td>',
      '</tr></tbody></table>',
    ].join('');
    const model = buildTableModel(oldStorage, currentStorage);
    const choices = new Map([
      [tableCellChoiceKey(model.tableRow.key, 0, 0), 'old'],
      [tableCellChoiceKey(model.tableRow.key, 0, 1), 'current'],
    ]);

    const recovered = buildRecoveryStorageHtml(
      model.diff.blocks,
      choices,
      model.display.blockChoiceKeys
    );
    const preview = buildRecoveryPreviewHtml(
      model.diff.blocks,
      choices,
      model.display.blockChoiceKeys
    );
    const recoveredDoc = new DOMParser().parseFromString(
      recovered.html,
      'text/html'
    );
    const previewDoc = new DOMParser().parseFromString(preview, 'text/html');
    const recoveredCells = recoveredDoc.querySelectorAll('td');
    const previewCells = previewDoc.querySelectorAll('td');

    expect(recovered.error).toBe('');
    expect(recoveredCells[0].getAttribute('data-highlight-colour')).toBe(
      '#deebff'
    );
    expect(recoveredCells[0].textContent).toBe('Old A');
    expect(recoveredCells[0].querySelector('strong')).not.toBeNull();
    expect(recoveredCells[1].textContent).toBe('New B');
    expect(previewCells[0].textContent).toBe('Old A');
    expect(previewCells[1].textContent).toBe('New B');
  });

  test('keeps structural table changes as one whole-table selectable row', () => {
    const diff = buildRichTextDiffHtml(
      '<table><tbody><tr><td>A</td></tr></tbody></table>',
      [
        '<table><tbody>',
        '<tr><td>A</td></tr>',
        '<tr><td>Added row</td></tr>',
        '</tbody></table>',
      ].join(''),
      '',
      {}
    );
    const display = buildDiffDisplayRows(diff.blocks);
    const expanded = expandCellScopedSelectableRows(display.selectableRows);

    expect(expanded).toHaveLength(display.selectableRows.length);
    expect(expanded.map((row) => row.key)).toEqual(
      display.selectableRows.map((row) => row.key)
    );
    expect(
      expanded.some((row) => row.key.includes('::table-cell::'))
    ).toBe(false);
  });

  test('matches merged cells by logical coordinates during recovery', () => {
    const oldStorage = [
      '<table><tbody>',
      '<tr><td rowspan="2">Old merged</td><td>Stable A</td></tr>',
      '<tr><td>Old B</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentStorage = [
      '<table><tbody>',
      '<tr><td rowspan="2">New merged</td><td>Stable A</td></tr>',
      '<tr><td>New B</td></tr>',
      '</tbody></table>',
    ].join('');
    const model = buildTableModel(oldStorage, currentStorage);
    const choices = new Map([
      [tableCellChoiceKey(model.tableRow.key, 1, 1), 'old'],
    ]);
    const recovered = buildRecoveryStorageHtml(
      model.diff.blocks,
      choices,
      model.display.blockChoiceKeys
    );
    const doc = new DOMParser().parseFromString(recovered.html, 'text/html');

    expect(recovered.error).toBe('');
    expect(doc.querySelector('td[rowspan="2"]').textContent).toBe('New merged');
    expect(doc.querySelectorAll('tr')[1].querySelector('td').textContent).toBe(
      'Old B'
    );
  });
});
