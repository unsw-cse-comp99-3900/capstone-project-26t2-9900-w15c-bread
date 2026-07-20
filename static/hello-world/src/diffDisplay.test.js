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
