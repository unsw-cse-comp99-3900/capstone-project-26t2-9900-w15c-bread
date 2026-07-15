import { buildRichTextDiffHtml } from '../utils';
import { buildRecoveryStorageHtml } from '../recoveryStorage';
import { buildDiffDisplayRows } from './ComparisonPanel';

describe('comparison change grouping', () => {
  test('pairs visible replacement text instead of leading empty paragraphs', () => {
    const oldStorage = '<p>before</p><p>old text</p><p>after</p>';
    const currentStorage = [
      '<p>before</p>',
      '<p><br /></p>',
      '<p><br /></p>',
      '<p>new text</p>',
      '<p>after</p>',
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const replacementRow = display.selectableRows.find((row) =>
      row.blocks.some(({ block }) => block.type === 'removed' && block.text === 'old text')
    );

    expect(replacementRow).toBeDefined();
    expect(
      replacementRow.blocks.map(({ block }) => ({ type: block.type, text: block.text }))
    ).toEqual([
      { type: 'removed', text: 'old text' },
      { type: 'added', text: '' },
      { type: 'added', text: '' },
      { type: 'added', text: 'new text' },
    ]);

    replacementRow.blocks.forEach(({ index }) => {
      expect(display.blockChoiceKeys.get(index)).toBe(replacementRow.key);
    });
  });

  test('removes attached spacer paragraphs when restoring the old text', () => {
    const oldStorage = '<p>before</p><p>old text</p><p>after</p>';
    const currentStorage = [
      '<p>before</p>',
      '<p><br /></p>',
      '<p><br /></p>',
      '<p>new text</p>',
      '<p>after</p>',
    ].join('');
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

  test('preserves attached spacer paragraphs when keeping the current text', () => {
    const oldStorage = '<p>before</p><p>old text</p><p>after</p>';
    const currentStorage = [
      '<p>before</p>',
      '<p><br /></p>',
      '<p><br /></p>',
      '<p>new text</p>',
      '<p>after</p>',
    ].join('');
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

  test('uses text similarity to keep a standalone insertion separate', () => {
    const oldStorage = '<p>before</p><p>old release text</p><p>after</p>';
    const currentStorage = [
      '<p>before</p>',
      '<p>standalone insertion</p>',
      '<p>new release text</p>',
      '<p>after</p>',
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const replacementRow = display.selectableRows.find((row) =>
      row.blocks.some(({ block }) => block.type === 'removed')
    );

    expect(replacementRow.blocks.map(({ block }) => block.text)).toEqual([
      'old release text',
      'new release text',
    ]);
    expect(
      display.selectableRows.some(
        (row) => row.blocks.length === 1 && row.blocks[0].block.text === 'standalone insertion'
      )
    ).toBe(true);
  });

  test('does not attach spacing across another visible insertion', () => {
    const oldStorage = '<p>before</p><p>old release text</p><p>after</p>';
    const currentStorage = [
      '<p>before</p>',
      '<p>new release text</p>',
      '<p>standalone insertion</p>',
      '<p><br /></p>',
      '<p>after</p>',
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const replacementRow = display.selectableRows.find((row) =>
      row.blocks.some(({ block }) => block.type === 'removed')
    );
    const emptyParagraphRow = display.selectableRows.find((row) =>
      row.blocks.length === 1 && row.blocks[0].block.text === ''
    );

    expect(replacementRow.blocks.map(({ block }) => block.text)).toEqual([
      'old release text',
      'new release text',
    ]);
    expect(emptyParagraphRow).toBeDefined();
    expect(emptyParagraphRow.key).not.toBe(replacementRow.key);
  });
});
