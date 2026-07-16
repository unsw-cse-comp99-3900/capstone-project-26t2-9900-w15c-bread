import { buildRichTextDiffHtml } from '../utils';
import { buildRecoveryStorageHtml } from '../recoveryStorage';
import { buildDiffDisplayRows, buildDraftDifferenceNotes } from './ComparisonPanel';

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
    expect(result.diff.summary).toMatchObject({ added: 2, removed: 1 });
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
