import { buildRichTextDiffHtml } from '../utils';
import { buildRecoveryStorageHtml } from '../recoveryStorage';
import {
  buildDiffDisplayRows,
  buildDraftDifferenceNotes,
  getChangeChoiceActionConfig,
  getGitHubStyleDiffParts,
} from './ComparisonPanel';

describe('Version Difference Notes', () => {
  test('compares Current as the old side and Draft as the new side', () => {
    const currentStorage = '<p>Stable</p><p>Current wording</p>';
    const draftStorage = '<p>Stable</p><p>Draft wording</p><p>Draft addition</p>';
    const result = buildDraftDifferenceNotes(currentStorage, draftStorage);
    const changes = result.diff.blocks.filter((block) => block.type !== 'same');

    expect(changes.map((block) => ({ type: block.type, text: block.text }))).toEqual([
      { type: 'removed', text: 'Current wording' },
      { type: 'added', text: 'Draft wording' },
      { type: 'added', text: 'Draft addition' },
    ]);
    expect(result.diff.summary).toMatchObject({
      added: 2,
      removed: 1,
      addedBlocks: 1,
      removedBlocks: 0,
      modifiedBlocks: 1,
    });
    expect(
      result.display.selectableRows.map((row) => row.changeKind)
    ).toEqual(['modified', 'added']);
    // Semantic classification is display-only. The recovery engine still
    // receives the safe removed/added Storage representation.
    expect(changes.map((block) => block.type)).toEqual([
      'removed',
      'added',
      'added',
    ]);
  });

  test('recognises a formatting-only replacement as modified content', () => {
    const result = buildDraftDifferenceNotes(
      '<p>Important text</p>',
      '<p><strong>Important text</strong></p>'
    );

    expect(result.diff.blocks.map((block) => block.type)).toEqual([
      'removed',
      'added',
    ]);
    expect(result.diff.summary).toMatchObject({
      addedBlocks: 0,
      removedBlocks: 0,
      modifiedBlocks: 1,
    });
    expect(result.display.selectableRows).toMatchObject([
      { changeKind: 'modified' },
    ]);
  });

  test('keeps independent additions and removals out of the modified count', () => {
    const addition = buildDraftDifferenceNotes(
      '<p>Stable</p>',
      '<p>Stable</p><p>Draft only</p>'
    );
    const removal = buildDraftDifferenceNotes(
      '<p>Stable</p><p>Current only</p>',
      '<p>Stable</p>'
    );

    expect(addition.diff.summary).toMatchObject({
      addedBlocks: 1,
      removedBlocks: 0,
      modifiedBlocks: 0,
    });
    expect(removal.diff.summary).toMatchObject({
      addedBlocks: 0,
      removedBlocks: 1,
      modifiedBlocks: 0,
    });
  });

  test('reports an oversized comparison as limited rather than equal', () => {
    const currentStorage = Array.from(
      { length: 350 },
      (_, index) => `<p>Current ${index}</p>`
    ).join('');
    const draftStorage = Array.from(
      { length: 350 },
      (_, index) => `<p>Draft ${index}</p>`
    ).join('');
    const result = buildDraftDifferenceNotes(currentStorage, draftStorage);

    expect(result.diff.summary.limited).toBe(true);
    expect(result.display.selectableRows).toHaveLength(0);
  });
});

describe('Draft Preview spacer recovery', () => {
  const oldStorage = '<p>before</p><p>old text</p><p>after</p>';
  const currentStorage = [
    '<p>before</p>',
    '<p><br /></p>',
    '<p><br /></p>',
    '<p>new text</p>',
    '<p>after</p>',
  ].join('');

  test('groups current-only spacer lines with the visible replacement', () => {
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const replacementRow = display.selectableRows.find((row) =>
      row.blocks.some(({ block }) => block.type === 'removed' && block.text === 'old text')
    );

    expect(replacementRow).toBeDefined();
    expect(
      replacementRow.blocks.map(({ block }) => ({
        type: block.type,
        nodeType: block.nodeType,
        text: block.text,
        blankLineCount: block.blankLineCount,
      }))
    ).toEqual([
      {
        type: 'removed',
        nodeType: 'paragraph',
        text: 'old text',
        blankLineCount: undefined,
      },
      { type: 'added', nodeType: 'blank_line_run', text: '', blankLineCount: 2 },
      {
        type: 'added',
        nodeType: 'paragraph',
        text: 'new text',
        blankLineCount: undefined,
      },
    ]);
  });

  test('does not leave spacer lines when the old text is restored', () => {
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const replacementRow = display.selectableRows.find((row) =>
      row.blocks.some(({ block }) => block.type === 'removed' && block.text === 'old text')
    );
    const restored = buildRecoveryStorageHtml(
      diff.blocks,
      new Map([[replacementRow.key, 'old']]),
      display.blockChoiceKeys
    );

    expect(restored.error).toBe('');
    expect(restored.html).toBe(oldStorage);
    expect(restored.html).not.toContain('<br');
  });

  test('preserves the exact current spacing when Current is kept', () => {
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const recovered = buildRecoveryStorageHtml(
      diff.blocks,
      new Map(),
      display.blockChoiceKeys
    );

    expect(recovered.error).toBe('');
    expect(recovered.html).toBe(currentStorage);
  });
});

describe('Draft Preview ordered-list break recovery', () => {
  const oldStorage = [
    '<ol><li>One</li></ol>',
    '<p><br /></p>',
    '<ol start="2"><li>Two</li></ol>',
    '<p><br /></p>',
    '<ol start="3"><li>Three</li></ol>',
  ].join('');
  const currentStorage = '<ol><li>One</li><li>Two</li><li>Three</li></ol>';

  test('keeps the list-break change atomic and reconstructs either side exactly', () => {
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const row = display.selectableRows[0];
    const keptCurrent = buildRecoveryStorageHtml(
      diff.blocks,
      new Map(),
      display.blockChoiceKeys
    );
    const restoredOld = buildRecoveryStorageHtml(
      diff.blocks,
      new Map([[row.key, 'old']]),
      display.blockChoiceKeys
    );

    expect(display.selectableRows).toHaveLength(1);
    expect(row.blocks).toHaveLength(1);
    expect(row.blocks[0].block.nodeType).toBe('list_break_change');
    const parts = getGitHubStyleDiffParts(row.blocks);
    expect(parts.map((part) => part.type)).toEqual(['context', 'removed']);
    expect(parts[0].html).toContain('<li>One</li>');
    expect(parts[0].html).toContain('<li>Three</li>');
    expect(parts[1].html).toContain('2 blank lines removed');
    expect(keptCurrent).toMatchObject({ error: '', html: currentStorage });
    expect(restoredOld).toMatchObject({ error: '', html: oldStorage });
  });
});

describe('large table write-back controls', () => {
  test('keeps whole-table recovery controls visible above a cell-level diff', () => {
    const config = getChangeChoiceActionConfig(
      [{ type: 'table-cell-level', html: '<table></table>' }],
      false
    );

    expect(config).toEqual({
      position: 'before',
      visible: true,
      currentLabel: 'Keep current table',
      oldLabel: 'Restore old table',
    });
  });

  test('keeps ordinary change controls collapsed until the row is active', () => {
    expect(getChangeChoiceActionConfig([{ type: 'removed', html: '<p>Old</p>' }], false))
      .toMatchObject({ position: 'after', visible: false });
  });
});
