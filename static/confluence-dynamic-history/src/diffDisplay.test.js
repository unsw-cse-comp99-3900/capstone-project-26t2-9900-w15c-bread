import { buildCanonicalDiffSummary, buildDiffDisplayRows } from './diffDisplay';

function paragraph(type, text, extra = {}) {
  return {
    type,
    nodeType: 'paragraph',
    tag: 'p',
    text,
    ...extra,
  };
}

describe('buildDiffDisplayRows', () => {
  test('keeps an exact relocation as independent removal and addition', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', '', {
        diffIdentity: 'image:same',
        renderedHtml: '<img src="same">',
      }),
      paragraph('same', 'Stable anchor'),
      paragraph('added', '', {
        diffIdentity: 'image:same',
        renderedHtml: '<img src="same">',
      }),
    ]);

    expect(result.selectableRows.map((row) => row.changeKind)).toEqual([
      'removed',
      'added',
    ]);
    expect(result.selectableRows.map((row) => row.key)).toEqual(['0', '2']);
    expect(result.blockChoiceKeys.get(0)).toBe('0');
    expect(result.blockChoiceKeys.get(2)).toBe('2');
  });

  test('does not pair a similar paragraph across an unchanged anchor', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', 'Alpha wording before', { diffIdentity: 'old-alpha' }),
      paragraph('same', 'Stable anchor'),
      paragraph('added', 'Alpha wording after', { diffIdentity: 'new-alpha' }),
    ]);

    expect(result.selectableRows.map((row) => row.changeKind)).toEqual([
      'removed',
      'added',
    ]);
    expect(result.selectableRows.map((row) => row.key)).toEqual(['0', '2']);
  });

  test('keeps reordered change runs local across a blank-line anchor', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', 'Alpha wording before', { diffIdentity: 'old-alpha' }),
      paragraph('added', 'Beta wording after', { diffIdentity: 'new-beta' }),
      paragraph('same', '', { nodeType: 'blank_line_run', blankLineCount: 1 }),
      paragraph('removed', 'Beta wording before', { diffIdentity: 'old-beta' }),
      paragraph('added', 'Alpha wording after', { diffIdentity: 'new-alpha' }),
    ]);

    expect(
      result.selectableRows.every((row) => row.changeKind !== 'moved')
    ).toBe(true);
    expect(result.selectableRows.map((row) => row.key)).toEqual(['0:1', '3:4']);
  });

  test('leaves low-confidence cross-anchor content as removal and addition', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', 'Alpha only', { diffIdentity: 'old-alpha' }),
      paragraph('same', 'Stable anchor'),
      paragraph('added', 'Completely unrelated sentence', { diffIdentity: 'new-other' }),
    ]);

    expect(result.selectableRows.map((row) => row.changeKind)).toEqual([
      'removed',
      'added',
    ]);
  });

  test('groups a related removed and added block as one modified decision', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', 'old text'),
      paragraph('added', 'new text'),
    ]);

    expect(result.selectableRows).toHaveLength(1);
    expect(result.selectableRows[0].changeKind).toBe('modified');
    expect(result.selectableRows[0].blocks.map(({ index }) => index)).toEqual([0, 1]);
    expect(result.blockChoiceKeys.get(0)).toBe(result.selectableRows[0].key);
    expect(result.blockChoiceKeys.get(1)).toBe(result.selectableRows[0].key);
  });

  test('retains the original block indices around unchanged context', () => {
    const result = buildDiffDisplayRows([
      paragraph('same', 'context'),
      paragraph('removed', 'old text'),
      paragraph('added', 'new text'),
    ]);

    expect(result.selectableRows).toHaveLength(1);
    expect(result.selectableRows[0].blocks.map(({ index }) => index)).toEqual([1, 2]);
    expect(result.blockChoiceKeys.get(1)).toBe('1:2');
    expect(result.blockChoiceKeys.get(2)).toBe('1:2');
  });

  test('keeps unrelated standalone changes as separate decisions', () => {
    const result = buildDiffDisplayRows([
      paragraph('removed', 'alpha'),
      paragraph('added', 'completely unrelated sentence'),
      paragraph('added', 'alpha revised'),
    ]);

    expect(result.selectableRows.map((row) => row.blocks.map(({ index }) => index))).toEqual([
      [0, 2],
      [1],
    ]);
  });

  test('classifies a direct modified block as one modified decision', () => {
    const result = buildDiffDisplayRows([{
      type: 'modified',
      nodeType: 'list_break_change',
      tag: 'ol',
      oldText: 'old list',
      newText: 'new list',
    }]);

    expect(result.selectableRows).toHaveLength(1);
    expect(result.selectableRows[0].changeKind).toBe('modified');
    expect(result.blockChoiceKeys.get(0)).toBe(result.selectableRows[0].key);
  });

  test('normalizes comment summaries from canonical rows and diff unit counts', () => {
    const display = buildDiffDisplayRows([
      paragraph('removed', 'old text'),
      paragraph('added', 'new text'),
    ]);
    const summary = buildCanonicalDiffSummary({
      summary: { added: 3, removed: 2 },
    }, display);

    expect(summary).toEqual({ added: 3, removed: 2, modifiedBlocks: 1 });
  });
});
