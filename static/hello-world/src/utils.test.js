import { buildRichTextDiffHtml } from './utils';

describe('buildRichTextDiffHtml replacement grouping', () => {
  test('groups a low-similarity paragraph replacement into one atomic block', () => {
    const result = buildRichTextDiffHtml(
      '<p>456456</p>',
      '<p>123456</p>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'paragraph',
      oldText: '456456',
      newText: '123456',
    });
  });

  test('keeps a standalone insertion separate from unchanged following content', () => {
    const result = buildRichTextDiffHtml(
      '<p>Existing content</p>',
      '<p>New content</p><p>Existing content</p>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual(['added', 'same']);
  });
});
