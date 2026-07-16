import {
  buildRichTextDiffHtml,
  extractMentionAccountIds,
  prepareConfluenceHtml,
} from './utils';

function visiblePreviewText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  Array.from(doc.querySelectorAll('[data-dh-raw-inspector]')).forEach((node) => node.remove());
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

describe('buildRichTextDiffHtml replacement grouping', () => {
  test('represents a low-similarity paragraph replacement as removed then added blocks', () => {
    const result = buildRichTextDiffHtml(
      '<p>456456</p>',
      '<p>123456</p>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['paragraph', 'paragraph']);
    expect(result.blocks.some((block) => block.type === 'modified')).toBe(false);
    expect(result.blocks[0].oldHtml).toBe('<p>456456</p>');
    expect(result.blocks[1].newHtml).toBe('<p>123456</p>');
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

describe('type-specific diff safety', () => {
  test('paragraph changes are represented as block-level removal and addition', () => {
    const result = buildRichTextDiffHtml(
      '<p>Old paragraph text.</p>',
      '<p>New paragraph text.</p>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toMatchObject({
      type: 'removed',
      nodeType: 'paragraph',
      oldHtml: '<p>Old paragraph text.</p>',
    });
    expect(result.blocks[1]).toMatchObject({
      type: 'added',
      nodeType: 'paragraph',
      newHtml: '<p>New paragraph text.</p>',
    });
  });

  test('heading changes are represented as block-level removal and addition', () => {
    const result = buildRichTextDiffHtml(
      '<h2>Old heading</h2>',
      '<h2>New heading</h2>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['heading', 'heading']);
  });

  test('ordinary list additions are compared as whole-list blocks', () => {
    const result = buildRichTextDiffHtml(
      '<ul><li>Open a page</li><li>Select Dynamic History</li></ul>',
      '<ul><li>Open a page</li><li>Select Dynamic History</li><li>Preview a draft</li></ul>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['list', 'list']);
    expect(result.blocks[0].oldHtml).toContain('<li>Open a page</li>');
    expect(result.blocks[1].newHtml).toContain('<li>Preview a draft</li>');
  });

  test('recognises removing blank lines that merge continued ordered lists', () => {
    const oldHtml = [
      '<ol><li>44444</li></ol>',
      '<p><br /></p>',
      '<ol start="2"><li>Ordered list item starting from 2</li><li>qwe</li><li>Second ordered list item</li></ol>',
      '<p><br /></p>',
      '<ol start="5"><li></li></ol>',
    ].join('');
    const currentHtml = [
      '<ol>',
      '<li>44444</li>',
      '<li>Ordered list item starting from 2</li>',
      '<li>qwe</li>',
      '<li>Second ordered list item</li>',
      '<li></li>',
      '</ol>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, currentHtml, '', {});

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'list_break_change',
      isListBreakChange: true,
      blankLineCount: 2,
      blankLineDelta: -2,
      added: 0,
      removed: 2,
      oldRawHtml: oldHtml,
      newRawHtml: currentHtml,
    });
    expect(result.html).toContain('2 blank lines removed');
    expect(result.html).not.toContain('Ordered list item starting from 2');
  });

  test('nested unordered lists preserve an empty parent bullet on its own line', () => {
    const html =
      '<ul><li><ul><li>Nested item A-1<ul><li><ul><li>Deep item 1</li></ul></li></ul></li></ul></li><li>Top level item B</li></ul>';
    const result = buildRichTextDiffHtml(html, html, '', {});
    const rendered = prepareConfluenceHtml(html, '');

    expect(result.html).toContain('data-dh-empty-parent-list-item="true"');
    expect(result.html).toContain('data-dh-empty-list-marker="true"');
    expect(rendered).toContain('data-dh-empty-parent-list-item="true"');
    expect(rendered).toContain('data-dh-empty-list-marker="true"');
    expect(result.html).toContain('Deep item 1');
  });

  test('task checkbox state and text changes are captured by task item', () => {
    const result = buildRichTextDiffHtml(
      '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Review copy.</ac:task-body></ac:task></ac:task-list>',
      '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>Review final copy.</ac:task-body></ac:task></ac:task-list>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['task_item', 'task_item']);
    expect(result.blocks[0].taskStatus).toBe('incomplete');
    expect(result.blocks[1].taskStatus).toBe('complete');
    expect(result.blocks[0].oldHtml).toContain('<ac:task-list>');
    expect(result.blocks[1].newHtml).toContain('<ac:task-list>');
    expect(result.blocks[0].oldHtml).not.toContain('<ac:task-list><ac:task-list>');
  });

  test('unsupported block renders a readable non-blank fallback', () => {
    const result = buildRichTextDiffHtml(
      '',
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="123e4567-e89b-12d3-a456-426614174000"></ac:structured-macro>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'added',
      nodeType: 'unsupported',
      supportLevel: 'raw',
    });
    expect(visiblePreviewText(result.blocks[0].renderedHtml)).toContain('Unsupported Confluence block');
  });

  test('raw internal fields do not appear in normal preview text', () => {
    const result = buildRichTextDiffHtml(
      '',
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="123e4567-e89b-12d3-a456-426614174000"><ac:parameter ac:name="url">https://example.atlassian.net/plugins/servlet/gadgets/ifr</ac:parameter></ac:structured-macro>',
      '',
      {}
    );

    const normalText = visiblePreviewText(result.blocks[0].renderedHtml);
    expect(normalText).toContain('Unsupported Confluence block');
    expect(normalText).not.toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(normalText).not.toContain('https://example.atlassian.net');
    expect(normalText).not.toContain('macro-id');
  });

  test('unsupported raw content is preserved for reconstruction', () => {
    const raw =
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="123e4567-e89b-12d3-a456-426614174000"></ac:structured-macro>';
    const result = buildRichTextDiffHtml('', raw, '', {});

    expect(result.blocks[0].newHtml).toContain('ac:structured-macro');
    expect(result.blocks[0].newHtml).toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(result.blocks[0].renderedHtml).toContain('data-dh-raw-inspector');
    expect(result.blocks[0].renderedHtml).toContain('&lt;ac:structured-macro');
  });

  test('unsupported blocks ignore regenerated Confluence IDs and attribute order', () => {
    const oldHtml = [
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="old-macro-id">',
      '<ac:adf-attribute key="local-id">old-local-id</ac:adf-attribute>',
      '<ac:parameter ac:name="url">https://example.atlassian.net/gadget</ac:parameter>',
      '</ac:structured-macro>',
    ].join('');
    const newHtml = [
      '<ac:structured-macro ac:macro-id="new-macro-id" ac:name="jira-gadget">',
      '<ac:adf-attribute key="local-id">new-local-id</ac:adf-attribute>',
      '<ac:parameter ac:name="url">https://example.atlassian.net/gadget</ac:parameter>',
      '</ac:structured-macro>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual(['same']);
    expect(result.summary.addedBlocks).toBe(0);
    expect(result.summary.removedBlocks).toBe(0);
    expect(result.blocks[0].html).toContain('new-macro-id');
  });

  test('unsupported blocks still detect meaningful macro parameter changes', () => {
    const oldHtml =
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="old-id"><ac:parameter ac:name="url">https://example.atlassian.net/old</ac:parameter></ac:structured-macro>';
    const newHtml =
      '<ac:structured-macro ac:macro-id="new-id" ac:name="jira-gadget"><ac:parameter ac:name="url">https://example.atlassian.net/new</ac:parameter></ac:structured-macro>';
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
  });

  test('write-back normalization does not turn an isolated edit into a whole-page diff', () => {
    const version13 = [
      '<p>Stable introduction</p>',
      '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="version-13-id"><ac:parameter ac:name="url">https://example.atlassian.net/gadget</ac:parameter></ac:structured-macro>',
      '<p>Version 13 wording</p>',
      '<p local-id="version-13-paragraph-id">Stable conclusion</p>',
    ].join('');
    const restoredVersion14 = [
      '<p>Stable introduction</p>',
      '<ac:structured-macro ac:macro-id="restored-version-12-id" ac:name="jira-gadget"><ac:parameter ac:name="url">https://example.atlassian.net/gadget</ac:parameter></ac:structured-macro>',
      '<p>Version 12 wording</p>',
      '<p local-id="restored-version-12-paragraph-id">Stable conclusion</p>',
    ].join('');
    const result = buildRichTextDiffHtml(version13, restoredVersion14, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual([
      'same',
      'same',
      'removed',
      'added',
      'same',
    ]);
    expect(result.summary.unchangedBlocks).toBe(3);
    expect(result.summary.removedBlocks).toBe(1);
    expect(result.summary.addedBlocks).toBe(1);
  });

  test('self-closing Confluence references do not swallow the remaining page after write-back', () => {
    const versionBeforeWriteBack = [
      '<p>Before mention</p>',
      '<ri:user ri:account-id="account-1"></ri:user>',
      '<p>After mention</p>',
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Panel body</p></ac:rich-text-body></ac:structured-macro>',
      '<p>Page ending</p>',
    ].join('');
    const versionAfterWriteBack = versionBeforeWriteBack.replace(
      '<ri:user ri:account-id="account-1"></ri:user>',
      '<ri:user ri:account-id="account-1" />'
    );
    const result = buildRichTextDiffHtml(
      versionBeforeWriteBack,
      versionAfterWriteBack,
      '',
      {},
      { 'account-1': 'Example User' }
    );

    expect(result.blocks.map((block) => block.type)).toEqual([
      'same',
      'same',
      'same',
      'same',
      'same',
    ]);
    expect(result.summary.addedBlocks).toBe(0);
    expect(result.summary.removedBlocks).toBe(0);
  });

  test('self-closing ADF blank nodes do not swallow the remaining page', () => {
    const historicalStorage = [
      '<p>Before blank lines</p>',
      '<ac:adf-node type="paragraph" />',
      '<ac:adf-node type="hardBreak" />',
      '<p><ac:adf-node type="hardBreak" /></p>',
      '<p>Content after blank lines</p>',
      '<p>Page ending</p>',
    ].join('');
    const currentStorage = [
      '<p>Before blank lines</p>',
      '<p>Content after blank lines</p>',
      '<p>Page ending</p>',
    ].join('');
    const result = buildRichTextDiffHtml(
      historicalStorage,
      currentStorage,
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'same',
      'same',
    ]);
    expect(result.blocks[1]).toMatchObject({
      nodeType: 'blank_line_run',
      blankLineCount: 3,
    });
    expect(result.blocks[1].renderedHtml).not.toContain('Content after blank lines');
    expect(result.summary.removedBlocks).toBe(1);
  });

  test('transparent containers are split into semantic child blocks', () => {
    const result = buildRichTextDiffHtml(
      '<div><p>Before table</p><table><tbody><tr><td>old</td></tr></tbody></table><p>After table</p></div>',
      '<div><p>Before table</p><table><tbody><tr><td>new</td></tr></tbody></table><p>After table</p></div>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.nodeType)).toEqual([
      'paragraph',
      'table',
      'table',
      'paragraph',
    ]);
  });

  test('compatible confluence layouts diff semantic children and preserve recovery wrappers', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell>',
      '<p>Intro</p>',
      '<table><tbody><tr><td>old</td></tr></tbody></table>',
      '</ac:layout-cell><ac:layout-cell><p>Outro</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const newHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell>',
      '<p>Intro</p>',
      '<table><tbody><tr><td>new</td></tr></tbody></table>',
      '</ac:layout-cell><ac:layout-cell><p>Outro</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);
    const reconstructedCurrent = result.blocks
      .map((block) => {
        if (block.type === 'removed') return '';
        return block.newHtml || block.html || '';
      })
      .join('');

    expect(contentBlocks.map((block) => block.nodeType)).toEqual([
      'paragraph',
      'table',
      'table',
      'paragraph',
    ]);
    expect(contentBlocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'added',
      'same',
    ]);
    expect(reconstructedCurrent).toContain('<ac:layout>');
    expect(reconstructedCurrent).toContain('<ac:layout-section ac:type="two_equal">');
    expect(reconstructedCurrent).toContain('<td>new</td>');
    expect(reconstructedCurrent).not.toContain('<td>old</td>');
    expect(result.html).toContain('data-dh-node-type="layout"');
    expect(result.html).toContain('data-dh-layout-type="two_equal"');
  });

  test('unchanged confluence layouts preserve storage wrappers', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(layout, layout, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);
    const reconstructed = result.blocks.map((block) => block.html || '').join('');

    expect(contentBlocks).toMatchObject([
      { type: 'same', nodeType: 'paragraph', text: 'Left' },
      { type: 'same', nodeType: 'paragraph', text: 'Right' },
    ]);
    expect(reconstructed).toContain('<ac:layout>');
    expect(reconstructed).toContain('</ac:layout>');
    expect(result.html).toContain('data-dh-layout-type="two_equal"');
  });

  test('layouts ignore regenerated Confluence bookkeeping IDs', () => {
    const oldHtml = [
      '<ac:layout ac:local-id="old-layout">',
      '<ac:layout-section ac:type="two_equal" local-id="old-section">',
      '<ac:layout-cell data-local-id="old-left"><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell data-local-id="old-right"><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const newHtml = [
      '<ac:layout ac:local-id="new-layout">',
      '<ac:layout-section local-id="new-section" ac:type="two_equal">',
      '<ac:layout-cell data-local-id="new-left"><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell data-local-id="new-right"><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);

    expect(contentBlocks.map((block) => block.type)).toEqual(['same', 'same']);
    expect(result.summary.addedBlocks).toBe(0);
    expect(result.summary.removedBlocks).toBe(0);
  });

  test('layout cells render complex content independently without swallowing later cells', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell>',
      '<ac:image><ri:attachment ri:filename="first.png" /></ac:image>',
      '<p>Text after the first image</p>',
      '</ac:layout-cell>',
      '<ac:layout-cell>',
      '<p>Second cell heading</p>',
      '<ac:image><ri:url ri:value="https://example.com/second.png" /></ac:image>',
      '</ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(layout, layout, '', {
      'first.png': 'https://example.com/first.png',
    });

    expect(result.html).toContain('https://example.com/first.png');
    expect(result.html).toContain('Text after the first image');
    expect(result.html).toContain('Second cell heading');
    expect(result.html).toContain('https://example.com/second.png');
    expect(result.html).toContain('data-dh-layout-type="two_equal"');
  });

  test('three contextual tables select only the changed middle table', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="single"><ac:layout-cell>',
      '<table><tbody><tr><td>stable first</td></tr></tbody></table>',
      '<table><tbody><tr><td>old middle</td></tr></tbody></table>',
      '<table><tbody><tr><td>stable third</td></tr></tbody></table>',
      '</ac:layout-cell></ac:layout-section></ac:layout>',
    ].join('');
    const newHtml = oldHtml.replace('old middle', 'new middle');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);

    expect(contentBlocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'added',
      'same',
    ]);
    expect(contentBlocks.map((block) => block.nodeType)).toEqual([
      'table',
      'table',
      'table',
      'table',
    ]);
    expect(contentBlocks[0].text).toContain('stable first');
    expect(contentBlocks[1].oldHtml).toContain('old middle');
    expect(contentBlocks[2].newHtml).toContain('new middle');
    expect(contentBlocks[3].text).toContain('stable third');
  });

  test('column width changes stay local instead of replacing the complete layout', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="50"><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell data-width="50"><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const currentHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="35"><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell data-width="65"><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, currentHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);
    const widthSection = result.blocks.find((block) => block.layoutWidthChange);
    const changedCells = result.blocks.filter((block) => block.layoutColumnWidthChange);

    expect(contentBlocks).toMatchObject([
      { type: 'same', nodeType: 'paragraph', text: 'Left' },
      { type: 'same', nodeType: 'paragraph', text: 'Right' },
    ]);
    expect(widthSection.layoutWidthChange).toEqual({
      oldWidths: ['50', '50'],
      newWidths: ['35', '65'],
      changedColumnIndexes: [0, 1],
    });
    expect(changedCells.map((block) => block.layoutColumnWidthChange)).toEqual([
      { oldWidth: '50', newWidth: '35' },
      { oldWidth: '50', newWidth: '65' },
    ]);
    expect(result.blocks.some((block) => block.nodeType === 'layout')).toBe(false);
    expect(result.summary.added).toBe(1);
    expect(result.summary.removed).toBe(1);
  });

  test('column widths and inner content produce independent local changes', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="50"><p>Old left text</p></ac:layout-cell>',
      '<ac:layout-cell data-width="50"><p>Stable right text</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const currentHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="40"><p>Current left text</p></ac:layout-cell>',
      '<ac:layout-cell data-width="60"><p>Stable right text</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, currentHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);

    expect(contentBlocks.map((block) => block.type)).toEqual([
      'removed',
      'added',
      'same',
    ]);
    expect(contentBlocks.map((block) => block.nodeType)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
    ]);
    expect(result.blocks.some((block) => block.nodeType === 'layout')).toBe(false);
    expect(result.summary.added).toBe(2);
    expect(result.summary.removed).toBe(2);
  });

  test('one resized layout does not disable child diffing in another layout', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="50"><p>First left</p></ac:layout-cell>',
      '<ac:layout-cell data-width="50"><p>First right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
      '<ac:layout><ac:layout-section ac:type="single">',
      '<ac:layout-cell><p>Old second layout text</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const currentHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="30"><p>First left</p></ac:layout-cell>',
      '<ac:layout-cell data-width="70"><p>First right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
      '<ac:layout><ac:layout-section ac:type="single">',
      '<ac:layout-cell><p>Current second layout text</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, currentHtml, '', {});
    const contentBlocks = result.blocks.filter((block) => !block.isStructuralBoundary);

    expect(contentBlocks.map((block) => block.type)).toEqual([
      'same',
      'same',
      'removed',
      'added',
    ]);
    expect(result.blocks.some((block) => block.nodeType === 'layout')).toBe(false);
    expect(result.blocks.filter((block) => block.layoutWidthChange)).toHaveLength(1);
  });

  test('layout structure changes fall back to complete layout recovery blocks', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const newHtml = oldHtml.replace('two_equal', 'two_left_sidebar');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['layout', 'layout']);
    expect(result.blocks.some((block) => block.isStructuralBoundary)).toBe(false);
    expect(result.blocks[0].oldHtml).toContain('ac:type="two_equal"');
    expect(result.blocks[1].newHtml).toContain('ac:type="two_left_sidebar"');
  });

  test('layout case 3 preserves a Confluence single layout with a 33/67 ratio', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="single" ac:breakout-mode="full-width">',
      '<ac:layout-cell data-width="33.33"><p>Left sidebar</p></ac:layout-cell>',
      '<ac:layout-cell data-width="66.67"><p>Main content</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const rendered = prepareConfluenceHtml(layout, '');
    const css = require('fs').readFileSync(require('path').join(__dirname, 'styles.css'), 'utf8');

    expect(rendered).toContain('data-dh-layout-type="single"');
    expect(rendered).toContain('Left sidebar');
    expect(rendered).toContain('Main content');
    expect(rendered).toContain('data-dh-layout-custom-widths="true"');
    expect(rendered).toContain('data-dh-layout-weight="33"');
    expect(rendered).toContain('data-dh-layout-weight="67"');
    expect(css).toMatch(/data-dh-layout-weight='33'[^}]*flex-grow:\s*33/);
    expect(css).toMatch(/data-dh-layout-weight='67'[^}]*flex-grow:\s*67/);
  });

  test('layout case 4 preserves a Confluence single layout with a 67/33 ratio', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="single" ac:breakout-mode="full-width">',
      '<ac:layout-cell data-width="66.67"><p>Main content</p></ac:layout-cell>',
      '<ac:layout-cell data-width="33.33"><p>Right sidebar</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const rendered = prepareConfluenceHtml(layout, '');
    const css = require('fs').readFileSync(require('path').join(__dirname, 'styles.css'), 'utf8');

    expect(rendered).toContain('data-dh-layout-type="single"');
    expect(rendered).toContain('data-dh-layout-custom-widths="true"');
    expect(rendered).toContain('data-dh-layout-weight="67"');
    expect(rendered).toContain('data-dh-layout-weight="33"');
    expect(css).toMatch(/data-dh-layout-weight='67'[^}]*flex-grow:\s*67/);
    expect(css).toMatch(/data-dh-layout-weight='33'[^}]*flex-grow:\s*33/);
  });

  test('layout case 5 renders narrow sidebars around a wide middle column', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="three-with-sidebars">',
      '<ac:layout-cell><p>Left</p></ac:layout-cell>',
      '<ac:layout-cell><p>Middle</p></ac:layout-cell>',
      '<ac:layout-cell><p>Right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const rendered = prepareConfluenceHtml(layout, '');
    const css = require('fs').readFileSync(require('path').join(__dirname, 'styles.css'), 'utf8');

    expect(rendered).toContain('data-dh-layout-type="three_with_sidebars"');
    expect(rendered).not.toContain('data-dh-layout-custom-widths="true"');
    expect(rendered).not.toContain('data-dh-layout-weight=');
    expect(css).toMatch(
      /\[data-dh-layout-type='three_with_sidebars'\]\s*{[^}]*minmax\(0, 1fr\) minmax\(0, 2fr\) minmax\(0, 1fr\)/
    );
  });

  test('manually resized two-equal layouts use the stored 25/75 ratio', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="two_equal">',
      '<ac:layout-cell data-width="25"><p>Quarter</p></ac:layout-cell>',
      '<ac:layout-cell data-width="75"><p>Three quarters</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const rendered = prepareConfluenceHtml(layout, '');

    expect(rendered).toContain('data-dh-layout-type="two_equal"');
    expect(rendered).toContain('data-dh-layout-custom-widths="true"');
    expect(rendered).toContain('data-dh-layout-weight="25"');
    expect(rendered).toContain('data-dh-layout-weight="75"');
  });

  test('layout case 6 preserves custom 25 50 25 column widths', () => {
    const layout = [
      '<ac:layout><ac:layout-section ac:type="three-equal">',
      '<ac:layout-cell data-width="25"><p>25 percent</p></ac:layout-cell>',
      '<ac:layout-cell data-width="50%"><p>50 percent</p></ac:layout-cell>',
      '<ac:layout-cell data-width="25"><p>25 percent</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const rendered = prepareConfluenceHtml(layout, '');

    expect(rendered).toContain('data-dh-layout-custom-widths="true"');
    expect(rendered).toContain('data-dh-layout-width="25"');
    expect(rendered).toContain('data-dh-layout-width="50"');
    expect(rendered.match(/data-dh-layout-weight="25"/g)).toHaveLength(2);
    expect(rendered).toContain('data-dh-layout-weight="50"');
  });

  test('extracts and resolves storage and ADF mention account ids', () => {
    const storageMention =
      '<p>Owner <ac:link><ri:user ri:account-id="account-1" /></ac:link></p>';
    const adfMention = [
      '<p>Reviewer ',
      '<ac:adf-node type="mention">',
      '<ac:adf-attribute key="id">account-2</ac:adf-attribute>',
      '</ac:adf-node></p>',
    ].join('');
    const source = `${storageMention}${adfMention}${storageMention}`;

    expect(extractMentionAccountIds(source)).toEqual(['account-1', 'account-2']);

    const rendered = prepareConfluenceHtml(source, '', {}, {
      'account-1': 'Ada Lovelace',
      'account-2': 'Grace Hopper',
    });

    expect(rendered).toContain('@Ada Lovelace');
    expect(rendered).toContain('@Grace Hopper');
    expect(rendered).toContain('data-dh-mention-account-id="account-1"');
    expect(rendered).not.toContain('[Mention]');
  });

  test('mention diff preserves original storage while comparing resolved identities', () => {
    const oldHtml =
      '<p>Owner <ac:link><ri:user ri:account-id="account-1" /></ac:link></p>';
    const newHtml =
      '<p>Owner <ac:link><ri:user ri:account-id="account-2" /></ac:link></p>';
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {}, {
      'account-1': 'Ada Lovelace',
      'account-2': 'Grace Hopper',
    });

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks[0].oldHtml).toContain('ri:account-id="account-1"');
    expect(result.blocks[1].newHtml).toContain('ri:account-id="account-2"');
    expect(result.blocks[0].renderedHtml).toContain('@Ada Lovelace');
    expect(result.blocks[1].renderedHtml).toContain('@Grace Hopper');
  });

  test('table diffs render prepared rich table content instead of raw date storage', () => {
    const oldHtml = [
      '<table><tbody>',
      '<tr><th>Field</th><th>Value</th></tr>',
      '<tr><td>Status</td><td>Old status</td></tr>',
      '<tr><td>Date</td><td>日期：<time datetime="2026-07-12" />；负责人：@Tester</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentHtml = [
      '<table><tbody>',
      '<tr><th>Field</th><th>Value</th></tr>',
      '<tr><td>Status</td><td>New status</td></tr>',
      '<tr><td>Date</td><td>日期：<time datetime="2026-07-12" />；负责人：@Tester</td></tr>',
      '</tbody></table>',
    ].join('');

    const result = buildRichTextDiffHtml(oldHtml, currentHtml, '', {});
    const text = visiblePreviewText(result.html);

    expect(text).toContain('日期');
    expect(text).toContain('负责人');
    expect(text).toContain('@Tester');
    expect(result.html).toContain('data-dh-node-type="date"');
  });

  test('adf internals are not mixed into normal preview text', () => {
    const result = buildRichTextDiffHtml(
      '',
      [
        '<div>',
        '<p>Visible paragraph</p>',
        '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
        '<ac:adf-attribute key="localId">ea33bf50-33cd-405f-926a-8815d1d72ff7</ac:adf-attribute>',
        '<ac:adf-attribute key="state">incomplete</ac:adf-attribute>',
        '<p>guess what</p>',
        '</ac:adf-node></ac:adf-node>',
        '<ac:adf-node type="status">',
        '<ac:adf-attribute key="text">state</ac:adf-attribute>',
        '<ac:adf-attribute key="color">Green</ac:adf-attribute>',
        '<ac:adf-attribute key="localId">3080193</ac:adf-attribute>',
        '</ac:adf-node>',
        '<ac:adf-node type="extension">',
        '<ac:adf-attribute key="extensionKey">com.atlassian.jira.gadgets</ac:adf-attribute>',
        '<ac:adf-attribute key="url">https://bread-test.atlassian.net/rest/gadgets/1.0/g/com.atlassian.jira.gadgets:piegadget.xml</ac:adf-attribute>',
        '</ac:adf-node>',
        '</div>',
      ].join(''),
      '',
      {}
    );

    const normalText = visiblePreviewText(result.html);
    expect(normalText).toContain('Visible paragraph');
    expect(normalText).toContain('guess what');
    expect(normalText).toContain('state');
    expect(normalText).not.toContain('[Status: state]');
    expect(normalText).not.toContain('ea33bf50-33cd-405f-926a-8815d1d72ff7');
    expect(normalText).not.toContain('stateGreen');
    expect(normalText).not.toContain('extensionKey');
    expect(normalText).not.toContain('piegadget.xml');
  });

  test('whiteboard links render as readable cards while preserving raw link storage', () => {
    const raw = [
      '<ac:link>',
      '<ri:url ri:value="https://bread-test.atlassian.net/wiki/spaces/~712020782f510e89df4a65a9d622ebe3b5af1c/whiteboard/7438339" />',
      '<ac:plain-text-link-body><![CDATA[Untitled whiteboard 2026-06-30]]></ac:plain-text-link-body>',
      '</ac:link>',
    ].join('');
    const result = buildRichTextDiffHtml('', raw, '', {});

    expect(result.blocks[0].renderedHtml).toContain('data-dh-node-type="whiteboard_card"');
    expect(result.blocks[0].renderedHtml).toContain('Untitled whiteboard 2026-06-30');
    expect(result.blocks[0].renderedHtml).toContain('Confluence Whiteboards');
    expect(result.blocks[0].newHtml).toContain('<ac:link>');
  });

  test('adf whiteboard smart links render as readable cards', () => {
    const result = buildRichTextDiffHtml(
      '',
      [
        '<ac:adf-node type="blockCard">',
        '<ac:adf-attribute key="url">https://bread-test.atlassian.net/wiki/spaces/~712020782f510e89df4a65a9d622ebe3b5af1c/whiteboard/7438339</ac:adf-attribute>',
        '<ac:adf-attribute key="title">Untitled whiteboard 2026-06-30</ac:adf-attribute>',
        '</ac:adf-node>',
      ].join(''),
      '',
      {}
    );

    expect(result.blocks[0].renderedHtml).toContain('data-dh-node-type="whiteboard_card"');
    expect(visiblePreviewText(result.blocks[0].renderedHtml)).toContain(
      'Untitled whiteboard 2026-06-30'
    );
    expect(visiblePreviewText(result.blocks[0].renderedHtml)).not.toContain(
      'bread-test.atlassian.net/wiki/spaces'
    );
  });

  test('same-version comparison preserves content after complex rendered blocks', () => {
    const raw = [
      '<h1>Start of page</h1>',
      '<table><tbody>',
      '<tr><th>Type</th><th>Rendered content</th></tr>',
      '<tr><td>Panel</td><td><ac:structured-macro ac:name="note"><ac:parameter ac:name="title">Note</ac:parameter><ac:rich-text-body><p>Nested panel text</p></ac:rich-text-body></ac:structured-macro></td></tr>',
      '<tr><td>Image</td><td><ac:image ac:width="180"><ri:url ri:value="https://example.com/test.png" /><ac:caption><p>Caption text</p></ac:caption></ac:image></td></tr>',
      '<tr><td>Unsupported</td><td><ac:structured-macro ac:name="view-file"><ac:parameter ac:name="name">sample.pdf</ac:parameter></ac:structured-macro></td></tr>',
      '</tbody></table>',
      '<p>Content that appears after the complex table must still render.</p>',
      '<h2>Final section</h2>',
    ].join('');

    const result = buildRichTextDiffHtml(raw, raw, '', {});
    const text = visiblePreviewText(result.html);

    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(text).toContain('Start of page');
    expect(text).toContain('Nested panel text');
    expect(text).toContain('Content that appears after the complex table must still render.');
    expect(text).toContain('Final section');
  });
});

describe('Sprint 2 diff classification and display requirements', () => {
  test('old-only, new-only, and changed paragraphs use only same removed added result types', () => {
    expect(buildRichTextDiffHtml('<p>Old only</p>', '', '', {}).blocks).toMatchObject([
      { type: 'removed', nodeType: 'paragraph' },
    ]);
    expect(buildRichTextDiffHtml('', '<p>New only</p>', '', {}).blocks).toMatchObject([
      { type: 'added', nodeType: 'paragraph' },
    ]);

    const changed = buildRichTextDiffHtml('<p>Old paragraph</p>', '<p>New paragraph</p>', '', {});
    expect(changed.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(changed.blocks.some((block) => block.type === 'modified')).toBe(false);
    expect(changed.summary.modifiedBlocks).toBe(0);
  });

  test.each([
    ['bold', '<p>Text</p>', '<p><strong>Text</strong></p>'],
    ['italic', '<p>Text</p>', '<p><em>Text</em></p>'],
    ['text colour', '<p><span style="color: #172b4d">Text</span></p>', '<p><span style="color: #0052cc">Text</span></p>'],
    ['text highlight', '<p><mark data-dh-bg-color="yellow">Text</mark></p>', '<p><mark data-dh-bg-color="green">Text</mark></p>'],
    ['link href', '<p><a href="https://example.com/a">Text</a></p>', '<p><a href="https://example.com/b">Text</a></p>'],
  ])('paragraph %s changes produce a block diff', (_name, oldHtml, newHtml) => {
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['paragraph', 'paragraph']);
  });

  test('equivalent inline tags and attribute ordering do not create false diffs', () => {
    const strongResult = buildRichTextDiffHtml('<p><strong>Text</strong></p>', '<p><b>Text</b></p>', '', {});
    const imageResult = buildRichTextDiffHtml(
      '<img width="300" height="200" alt="Diagram" src="https://example.com/a.png">',
      '<img src="https://example.com/a.png" alt="Diagram" height="200" width="300">',
      '',
      {}
    );

    expect(strongResult.blocks.map((block) => block.type)).toEqual(['same']);
    expect(imageResult.blocks.map((block) => block.type)).toEqual(['same']);
  });

  test('visible line breaks collapse only when at least one break exists on both sides', () => {
    const repeatedBreaks = buildRichTextDiffHtml(
      '<p>Line one<br>Line two</p>',
      '<p>Line one<br><br><br>Line two</p>',
      '',
      {}
    );
    const noBreak = buildRichTextDiffHtml(
      '<p>Line one Line two</p>',
      '<p>Line one<br>Line two</p>',
      '',
      {}
    );
    const serializationWhitespace = buildRichTextDiffHtml(
      '<p><strong>Line one</strong>\n<em>Line two</em></p>',
      '<p><strong>Line one</strong><em>Line two</em></p>',
      '',
      {}
    );

    expect(repeatedBreaks.blocks.map((block) => block.type)).toEqual(['same']);
    expect(noBreak.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(serializationWhitespace.blocks.map((block) => block.type)).toEqual(['same']);
  });

  test('consecutive empty editor paragraphs form one count-aware blank-line run', () => {
    const withoutBlankLines = '<p>Before</p><p>After</p>';
    const withSixBlankLines = [
      '<p>Before</p>',
      '<p></p>',
      '<p><br /></p>',
      '<p>&nbsp;</p>',
      '<p>\u200b</p>',
      '<p><br><br></p>',
      '<p> </p>',
      '<p>After</p>',
    ].join('');
    const removal = buildRichTextDiffHtml(
      withSixBlankLines,
      withoutBlankLines,
      '',
      {}
    );
    const countChange = buildRichTextDiffHtml(
      '<p>Before</p><p></p><p></p><p>After</p>',
      '<p>Before</p><p></p><p></p><p></p><p></p><p></p><p>After</p>',
      '',
      {}
    );
    const reverseCountChange = buildRichTextDiffHtml(
      '<p>Before</p><p></p><p></p><p></p><p></p><p></p><p>After</p>',
      '<p>Before</p><p></p><p></p><p>After</p>',
      '',
      {}
    );
    const historicalAdfBlankLines = [
      '<p>Before</p>',
      '<ac:adf-node type="paragraph">',
      '<ac:adf-attribute key="local-id">old-blank-1</ac:adf-attribute>',
      '<p></p>',
      '</ac:adf-node>',
      '<ac:adf-node type="paragraph">',
      '<ac:adf-attribute key="local-id">old-blank-2</ac:adf-attribute>',
      '<ac:adf-content><p><br /></p></ac:adf-content>',
      '</ac:adf-node>',
      '<p>After</p>',
    ].join('');
    const historicalAdfRemoval = buildRichTextDiffHtml(
      historicalAdfBlankLines,
      withoutBlankLines,
      '',
      {}
    );
    const historicalRenderedVariants = [
      '<p>Before</p>',
      '<br />',
      '<p><span style="color: #172b4d"><br /></span></p>',
      '<p><ac:adf-node type="hardBreak"></ac:adf-node></p>',
      '<div><br /></div>',
      '<p><span>\u200c\u2060</span></p>',
      '<p>After</p>',
    ].join('');
    const historicalVariantRemoval = buildRichTextDiffHtml(
      historicalRenderedVariants,
      withoutBlankLines,
      '',
      {}
    );
    const emptyLookingRichNodes = buildRichTextDiffHtml(
      [
        '<p>Before</p>',
        '<p><img src="https://example.com/transparent.png" alt="" /></p>',
        '<p><a href="https://example.com"></a></p>',
        '<hr />',
        '<p>After</p>',
      ].join(''),
      withoutBlankLines,
      '',
      {}
    );

    expect(removal.blocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'same',
    ]);
    expect(removal.blocks[1]).toMatchObject({
      nodeType: 'blank_line_run',
      blankLineCount: 6,
    });
    expect(removal.summary.removed).toBe(1);

    expect(countChange.blocks.map((block) => block.type)).toEqual([
      'same',
      'added',
      'same',
    ]);
    expect(countChange.blocks[1]).toMatchObject({
      nodeType: 'blank_line_change',
      blankLineCount: 3,
      oldBlankLineCount: 2,
      newBlankLineCount: 5,
      blankLineDelta: 3,
    });
    expect(countChange.summary.removed).toBe(0);
    expect(countChange.summary.added).toBe(1);

    expect(reverseCountChange.blocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'same',
    ]);
    expect(reverseCountChange.blocks[1]).toMatchObject({
      nodeType: 'blank_line_change',
      blankLineCount: 3,
      oldBlankLineCount: 5,
      newBlankLineCount: 2,
      blankLineDelta: -3,
    });
    expect(reverseCountChange.summary.removed).toBe(1);
    expect(reverseCountChange.summary.added).toBe(0);

    // Version history can contain both the legacy direct paragraph body and
    // the newer ac:adf-content body. Neither wrapper should turn each Enter
    // press into a separate diff choice.
    expect(historicalAdfRemoval.blocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'same',
    ]);
    expect(historicalAdfRemoval.blocks[1]).toMatchObject({
      nodeType: 'blank_line_run',
      blankLineCount: 2,
    });
    expect(historicalAdfRemoval.summary.removed).toBe(1);

    expect(historicalVariantRemoval.blocks.map((block) => block.type)).toEqual([
      'same',
      'removed',
      'same',
    ]);
    expect(historicalVariantRemoval.blocks[1]).toMatchObject({
      nodeType: 'blank_line_run',
      blankLineCount: 5,
    });

    // Invisible rich nodes are not blank lines: grouping them would make a
    // restore choice silently discard an image, link, or horizontal rule.
    expect(
      emptyLookingRichNodes.blocks
        .filter((block) => block.type === 'removed')
        .some((block) => block.nodeType === 'blank_line_run')
    ).toBe(false);
  });

  test('paragraph split and heading type changes are not grouped', () => {
    const split = buildRichTextDiffHtml(
      '<p>First sentence. Second sentence.</p>',
      '<p>First sentence.</p><p>Second sentence.</p>',
      '',
      {}
    );
    const headingLevel = buildRichTextDiffHtml('<h2>Project Scope</h2>', '<h3>Project Scope</h3>', '', {});
    const headingToParagraph = buildRichTextDiffHtml('<h2>Project Scope</h2>', '<p>Project Scope</p>', '', {});

    expect(split.blocks.map((block) => block.type)).toEqual(['removed', 'added', 'added']);
    expect(headingLevel.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(headingToParagraph.blocks.map((block) => block.nodeType)).toEqual(['heading', 'paragraph']);
  });

  test('ordinary ordered and unordered lists are compared as whole-list blocks', () => {
    const itemOrder = buildRichTextDiffHtml(
      '<ul><li>A</li><li>B</li></ul>',
      '<ul><li>B</li><li>A</li></ul>',
      '',
      {}
    );
    const listType = buildRichTextDiffHtml('<ul><li>A</li></ul>', '<ol><li>A</li></ol>', '', {});
    const adjacent = buildRichTextDiffHtml(
      '<ul><li>A</li></ul><ul><li>B</li></ul>',
      '<ul><li>A</li></ul><ul><li>C</li></ul>',
      '',
      {}
    );

    expect(itemOrder.blocks.map((block) => block.nodeType)).toEqual(['list', 'list']);
    expect(itemOrder.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(listType.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(adjacent.blocks.map((block) => block.type)).toEqual(['same', 'removed', 'added']);
  });

  test('blockquotes are complete diff blocks even with multiple paragraphs', () => {
    const result = buildRichTextDiffHtml(
      '<blockquote><p>First</p><p>Second</p></blockquote>',
      '<blockquote><p>First</p><p>Changed</p></blockquote>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks.map((block) => block.nodeType)).toEqual(['blockquote', 'blockquote']);
    expect(result.blocks[0].oldHtml).toContain('<p>Second</p>');
  });

  test('compatible table changes build one comparison table with only the changed cell expanded', () => {
    const result = buildRichTextDiffHtml(
      '<table><tbody><tr><th>Field</th><th>Value</th></tr><tr><td data-highlight-colour="LIGHT_GREEN">Status</td><td data-highlight-colour="LIGHT_BLUE">Old</td></tr></tbody></table>',
      '<table><tbody><tr><th>Field</th><th>Value</th></tr><tr><td data-highlight-colour="LIGHT_GREEN">Status</td><td data-highlight-colour="LIGHT_RED">New</td></tr></tbody></table>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks[0].tableDiff.mode).toBe('cell_level');
    expect(result.blocks[0].tableDiff.structureChange).toBe('same');
    expect(result.blocks[0].tableDiff.changedCells).toHaveLength(1);
    expect(result.blocks[0].tableDiff.changedCells[0]).toMatchObject({
      rowIndex: 1,
      colIndex: 1,
      oldText: 'Old',
      newText: 'New',
    });
    expect(result.blocks[0].tableDiff.comparisonHtml).toContain(
      'dh-table-cell-diff--modified'
    );
    expect(result.blocks[0].tableDiff.comparisonHtml).not.toContain(
      'dh-table-cell-version__marker'
    );
    expect(result.blocks[0].tableDiff.comparisonHtml).toContain('Old');
    expect(result.blocks[0].tableDiff.comparisonHtml).toContain('New');
    expect(result.blocks[0].tableDiff.comparisonHtml).toContain(
      'dh-table-cell-version--previous" data-dh-bg-color="light-blue"'
    );
    expect(result.blocks[0].tableDiff.comparisonHtml).toContain(
      'dh-table-cell-version--current" data-dh-bg-color="light-red"'
    );
    expect(
      (result.blocks[0].tableDiff.comparisonHtml.match(/<table\b/g) || [])
    ).toHaveLength(1);
    expect(
      (result.blocks[0].tableDiff.comparisonHtml.match(/>Field</g) || [])
    ).toHaveLength(1);
    expect(result.blocks[1].renderedHtml).toContain('data-dh-bg-color="light-green"');
  });

  test.each([
    ['added row', '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'],
    ['removed column', '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>', '<table><tbody><tr><td>A</td></tr><tr><td>C</td></tr></tbody></table>'],
    ['added column', '<table><tbody><tr><td>A</td></tr><tr><td>C</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>'],
  ])('simple table structure change uses cell-level rendering for %s', (_name, oldHtml, newHtml) => {
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const tableDiff = result.blocks[0].tableDiff;

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(tableDiff.mode).toBe('cell_level');
    expect(tableDiff.comparisonHtml).toContain('dh-table-diff--cell-level');
    expect(tableDiff.addedCells.length + tableDiff.removedCells.length).toBe(2);
    expect(tableDiff.comparisonHtml).toMatch(
      /dh-table-structure-diff--(?:added|removed)/
    );
    expect(
      (tableDiff.comparisonHtml.match(/data-dh-table-structure-marker=/g) || [])
    ).toHaveLength(0);
    expect(tableDiff.comparisonHtml).not.toContain('dh-table-cell-version');
  });

  test.each([
    [
      'modified cell plus appended right column',
      '<table><tbody><tr><td>A</td><td data-highlight-colour="LIGHT_BLUE">Old</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td data-highlight-colour="LIGHT_RED">New</td><td>X</td></tr><tr><td>C</td><td>D</td><td>Y</td></tr></tbody></table>',
      'columns_added',
    ],
    [
      'modified cell plus appended bottom row',
      '<table><tbody><tr><td>A</td><td>Old</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>New</td></tr><tr><td>C</td><td>D</td></tr><tr><td>X</td><td>Y</td></tr></tbody></table>',
      'rows_added',
    ],
  ])('combines %s in one cell-level table', (_name, oldHtml, newHtml, structureChange) => {
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const tableDiff = result.blocks[0].tableDiff;

    expect(tableDiff.mode).toBe('cell_level');
    expect(tableDiff.structureChange).toBe(structureChange);
    expect(tableDiff.changedCells).toHaveLength(1);
    expect(tableDiff.addedCells).toHaveLength(2);
    expect(tableDiff.comparisonHtml).toContain('dh-table-cell-diff--modified');
    expect(tableDiff.comparisonHtml).toContain('dh-table-structure-diff--added');
    expect(tableDiff.comparisonHtml).not.toContain('dh-table-cell-version__marker');
  });

  test.each([
    [
      'a bottom row and right column are both added',
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>B</td><td>E</td></tr><tr><td>C</td><td>D</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table>',
      'rows_added_columns_added',
      5,
      0,
    ],
    [
      'a bottom row and right column are both removed',
      '<table><tbody><tr><td>A</td><td>B</td><td>E</td></tr><tr><td>C</td><td>D</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
      'rows_removed_columns_removed',
      0,
      5,
    ],
  ])(
    'uses one L-shaped structural region when %s',
    (_name, oldHtml, newHtml, structureChange, addedCount, removedCount) => {
      const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
      const tableDiff = result.blocks[0].tableDiff;

      expect(tableDiff.mode).toBe('cell_level');
      expect(tableDiff.structureChange).toBe(structureChange);
      expect(tableDiff.addedCells).toHaveLength(addedCount);
      expect(tableDiff.removedCells).toHaveLength(removedCount);
      expect(tableDiff.comparisonHtml).not.toContain(
        'data-dh-table-structural-gap'
      );
      expect(
        (tableDiff.comparisonHtml.match(/<table\b/g) || [])
      ).toHaveLength(1);
    }
  );

  test.each([
    [
      'a right column is added while a bottom row is removed',
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>B</td><td>G</td></tr><tr><td>C</td><td>D</td><td>H</td></tr></tbody></table>',
      'rows_removed_columns_added',
      2,
      2,
    ],
    [
      'a bottom row is added while a right column is removed',
      '<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>D</td><td>E</td></tr><tr><td>G</td><td>H</td></tr></tbody></table>',
      'rows_added_columns_removed',
      2,
      2,
    ],
  ])(
    'uses a neutral composite corner when %s',
    (_name, oldHtml, newHtml, structureChange, addedCount, removedCount) => {
      const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
      const tableDiff = result.blocks[0].tableDiff;

      expect(tableDiff.mode).toBe('cell_level');
      expect(tableDiff.structureChange).toBe(structureChange);
      expect(tableDiff.addedCells).toHaveLength(addedCount);
      expect(tableDiff.removedCells).toHaveLength(removedCount);
      expect(
        (tableDiff.comparisonHtml.match(/data-dh-table-structural-gap=/g) || [])
      ).toHaveLength(1);
      expect(tableDiff.comparisonHtml).toContain(
        'dh-table-structure-diff--added'
      );
      expect(tableDiff.comparisonHtml).toContain(
        'dh-table-structure-diff--removed'
      );
      expect(
        (tableDiff.comparisonHtml.match(/<table\b/g) || [])
      ).toHaveLength(1);
    }
  );

  test('matching rowspan and colspan use logical coordinates for changed cells', () => {
    const oldHtml = '<table><tbody><tr><th colspan="2">Head</th></tr><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>Old C</td></tr></tbody></table>';
    const newHtml = oldHtml.replace('Old C', 'New C');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});
    const tableDiff = result.blocks[0].tableDiff;

    expect(tableDiff.mode).toBe('cell_level');
    expect(tableDiff.changedCells).toHaveLength(1);
    expect(tableDiff.changedCells[0]).toMatchObject({
      rowIndex: 2,
      colIndex: 1,
      rowspan: 1,
      colspan: 1,
      oldText: 'Old C',
      newText: 'New C',
    });
    expect(tableDiff.comparisonHtml).toContain('rowspan="2"');
    expect(tableDiff.comparisonHtml).toContain('colspan="2"');
  });

  test.each([
    ['rowspan change', '<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>'],
    ['colspan change', '<table><tbody><tr><td colspan="2">A</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>'],
    ['middle row insertion', '<table><tbody><tr><td>A</td></tr><tr><td>C</td></tr></tbody></table>', '<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr></tbody></table>'],
    ['middle column insertion', '<table><tbody><tr><td>A</td><td>C</td></tr><tr><td>D</td><td>F</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>'],
    ['middle row plus right column insertion', '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>E</td><td>F</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>G</td><td>H</td></tr><tr><td>E</td><td>F</td><td>I</td></tr></tbody></table>'],
    ['middle column plus bottom row insertion', '<table><tbody><tr><td>A</td><td>C</td></tr><tr><td>D</td><td>F</td></tr></tbody></table>', '<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr><tr><td>G</td><td>H</td><td>I</td></tr></tbody></table>'],
  ])('incompatible table structure falls back to whole-table rows for %s', (_name, oldHtml, newHtml) => {
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(result.blocks[0].tableDiff.mode).toBe('structure');
    expect(result.blocks[0].tableDiff.comparisonHtml).toBeUndefined();
    expect(result.blocks[0].renderedHtml).not.toContain('dh-table-cell-diff');
    expect(result.blocks[1].renderedHtml).not.toContain('dh-table-cell-diff');
  });

  test('panels and decisions are independent blocks with original styling preserved', () => {
    const panels = buildRichTextDiffHtml(
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Stable</p></ac:rich-text-body></ac:structured-macro><ac:structured-macro ac:name="note"><ac:rich-text-body><p>Old panel</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Stable</p></ac:rich-text-body></ac:structured-macro><ac:structured-macro ac:name="warning"><ac:rich-text-body><p>New panel</p></ac:rich-text-body></ac:structured-macro>',
      '',
      {}
    );
    const decisions = buildRichTextDiffHtml(
      '<ac:adf-node type="decisionItem"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><p>Keep</p></ac:adf-node><ac:adf-node type="decisionItem"><ac:adf-attribute key="state">UNDECIDED</ac:adf-attribute><p>Old decision</p></ac:adf-node>',
      '<ac:adf-node type="decisionItem"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><p>Keep</p></ac:adf-node><ac:adf-node type="decisionItem"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><p>New decision</p></ac:adf-node>',
      '',
      {}
    );

    expect(panels.blocks.map((block) => block.type)).toEqual(['same', 'removed', 'added']);
    expect(panels.blocks[1].renderedHtml).toContain('data-dh-node-type="panel"');
    expect(panels.blocks[1].renderedHtml).toContain('Old panel');
    expect(panels.blocks[2].renderedHtml).toContain('data-dh-node-type="panel"');
    expect(panels.blocks[2].renderedHtml).toContain('New panel');
    expect(decisions.blocks.map((block) => block.type)).toEqual(['same', 'removed', 'added']);
    expect(decisions.blocks.map((block) => block.nodeType)).toEqual(['decision', 'decision', 'decision']);
    expect(decisions.blocks[2].renderedHtml).toContain('data-dh-decision-state="decided"');
  });

  test('dates compare by semantic date and changed dates diff the whole paragraph', () => {
    const same = buildRichTextDiffHtml('<p>Due <ri:date ri:value="2026-07-05" /></p>', '<p>Due <time datetime="2026-07-05">5 Jul 2026</time></p>', '', {});
    const changed = buildRichTextDiffHtml('<p>Due <ri:date ri:value="2026-07-05" /></p>', '<p>Due <ri:date ri:value="2026-07-06" /></p>', '', {});

    expect(same.blocks.map((block) => block.type)).toEqual(['same']);
    expect(changed.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(changed.blocks[1].renderedHtml).toContain('data-dh-node-type="date"');
  });

  test('images are independent blocks and compare persistent image metadata', () => {
    const attachments = { 'diagram.png': 'https://example.com/diagram.png' };
    const differentAttachmentId = buildRichTextDiffHtml(
      '<ac:image ac:width="300"><ri:attachment ri:filename="diagram.png" ri:attachment-id="old-id" /></ac:image>',
      '<ac:image ac:width="300"><ri:attachment ri:filename="diagram.png" ri:attachment-id="new-id" /></ac:image>',
      '',
      attachments
    );
    const paragraphBelow = buildRichTextDiffHtml(
      '<ac:image ac:width="300"><ri:attachment ri:filename="diagram.png" ri:attachment-id="same-id" /></ac:image><p>Old caption typed manually</p>',
      '<ac:image ac:width="320"><ri:attachment ri:filename="diagram.png" ri:attachment-id="same-id" /></ac:image><p>New caption typed manually</p>',
      '',
      attachments
    );

    expect(differentAttachmentId.blocks.map((block) => block.type)).toEqual(['removed', 'added']);
    expect(differentAttachmentId.blocks.map((block) => block.nodeType)).toEqual(['image', 'image']);
    expect(paragraphBelow.blocks.map((block) => block.nodeType)).toEqual([
      'image',
      'paragraph',
      'image',
      'paragraph',
    ]);
    expect(paragraphBelow.blocks.map((block) => block.type)).toEqual([
      'removed',
      'removed',
      'added',
      'added',
    ]);
  });

  test('diff row CSS uses outer borders without red or green row backgrounds', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

    expect(css).toMatch(/\.dh-github-diff-part--removed\s*{[^}]*border:\s*2px solid var\(--dh-red\)/);
    expect(css).toMatch(/\.dh-github-diff-part--added\s*{[^}]*border:\s*2px solid #36b37e/);
    expect(css).toMatch(/\.dh-github-diff-part\s*{[^}]*background:\s*transparent/);
    expect(css).not.toMatch(/\.dh-github-diff-part--removed\s*{[^}]*background:\s*var\(--dh-red-soft\)/);
    expect(css).not.toMatch(/\.dh-github-diff-part--added\s*{[^}]*background:\s*var\(--dh-green-soft\)/);
    expect(css).toMatch(
      /\.dh-draft-modal__footer \.dh-write-back-button\s*{[^}]*background:\s*var\(--dh-blue\)/
    );
    expect(css).not.toMatch(
      /\.dh-draft-modal__footer \.dh-write-back-button\s*{[^}]*background:\s*#c9372c/
    );
  });
});

describe('prepareConfluenceHtml manual renderer', () => {
  test('renders core Confluence insert elements without leaking storage syntax', () => {
    const html = [
      '<h1>Title</h1>',
      '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <s>Strike</s> <code>inline</code></p>',
      '<ol start="3"><li>Ordered</li></ol>',
      '<ul><li>Bullet</li></ul>',
      '<blockquote><p>Quote</p></blockquote>',
      '<ac:structured-macro ac:name="info"><ac:parameter ac:name="title">Note title</ac:parameter><ac:rich-text-body><p>Panel body</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">PASS</ac:parameter><ac:parameter ac:name="colour">Green</ac:parameter></ac:structured-macro>',
      '<ri:date ri:value="2026-07-08" />',
      '<ac:adf-node type="decisionItem"><p>Ship renderer</p></ac:adf-node>',
      '<table><tbody><tr><th colspan="2" style="background-color: #deebff">Head</th></tr><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('<h1>Title</h1>');
    expect(rendered).toContain('<strong>Bold</strong>');
    expect(rendered).toContain('<ol start="3">');
    expect(rendered).toContain('data-dh-node-type="panel"');
    expect(rendered).toContain('data-dh-node-type="status"');
    expect(rendered).toContain('data-dh-status-color="green"');
    expect(rendered).toContain('data-dh-node-type="date"');
    expect(rendered).toContain('data-dh-node-type="decision"');
    expect(rendered).toContain('colspan="2"');
    expect(rendered).toContain('rowspan="2"');
    expect(rendered).toContain('data-dh-bg-color="light-blue"');
    expect(text).toContain('Panel body');
    expect(text).toContain('PASS');
    expect(text).toContain('Ship renderer');
    expect(text).not.toContain('ac:structured-macro');
    expect(text).not.toContain('ac:adf-node');
  });

  test('renders expand macros and images with captions', () => {
    const html = [
      '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">More details</ac:parameter><ac:rich-text-body><p>Hidden text</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:image ac:align="center" ac:width="320" ac:border="true"><ri:url ri:value="https://example.com/image.png" /><ac:caption><p>Image caption</p></ac:caption></ac:image>',
      '<ac:image ac:align="center" ac:original-height="315" ac:original-width="389" ac:custom-width="true" ac:width="260"><ri:attachment ri:filename="bordered.png"><ac:caption><p>Bordered attachment</p></ac:caption><ac:adf-mark key="border" size="3" color="#172b4d"></ac:adf-mark></ri:attachment></ac:image>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '', {
      'bordered.png': 'https://example.com/bordered.png',
    });

    expect(rendered).toContain('<details data-dh-node-type="expand">');
    expect(rendered).toContain('<summary>More details</summary>');
    expect(rendered).toContain('Hidden text');
    expect(rendered).toContain('<figure data-dh-node-type="image" data-dh-align="center">');
    expect(rendered).toContain('src="https://example.com/image.png"');
    expect(rendered).toContain('data-dh-image-border="true"');
    expect(rendered).toContain('src="https://example.com/bordered.png"');
    expect(rendered).toContain('data-dh-image-border-size="3"');
    expect(rendered).toContain('data-dh-border-color="black"');
    expect(rendered).toContain('data-dh-image-width="260px"');
    expect(rendered).toContain('width="260"');
    expect(rendered).not.toContain('height: 315px');
    expect(rendered).toContain('data-dh-image-width="320px"');
    expect(rendered).toContain('width="320"');
    expect(rendered).not.toContain('!important');
    expect(rendered).toContain('<figcaption>Image caption</figcaption>');
  });

  test('resolves UNKNOWN_ATTACHMENT images by attachment id', () => {
    const html = [
      '<ac:image ac:align="center" ac:width="320">',
      '<ri:attachment ri:filename="UNKNOWN_ATTACHMENT" ri:attachment-id="att-123" />',
      '</ac:image>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '', {
      'id:att-123': 'https://example.com/resolved-by-id.png',
    });

    expect(rendered).toContain('src="https://example.com/resolved-by-id.png"');
    expect(rendered).not.toContain('UNKNOWN_ATTACHMENT');
    expect(rendered).not.toContain('data-image-placeholder="true"');
  });

  test('resolves UNKNOWN_ATTACHMENT images by their ADF media id', () => {
    const html = [
      '<ac:image>',
      '<ac:adf-attribute key="id">media-456</ac:adf-attribute>',
      '<ri:attachment ri:filename="UNKNOWN_ATTACHMENT" />',
      '</ac:image>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '', {
      'id:media-456': 'https://example.com/resolved-by-media-id.png',
    });

    expect(rendered).toContain('src="https://example.com/resolved-by-media-id.png"');
    expect(rendered).not.toContain('UNKNOWN_ATTACHMENT');
  });

  test('renders code macros with line structure and strips CDATA wrappers', () => {
    const html = [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">javascript</ac:parameter>',
      '<ac:plain-text-body><!--[CDATA[const mode = "diff";\nconsole.log(`JavaScript mode: ${mode}`);]]--></ac:plain-text-body>',
      '</ac:structured-macro>',
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">sql</ac:parameter>',
      '<ac:plain-text-body><![CDATA[SELECT issue_key, status\nFROM diff_cases\nWHERE enabled = true]]></ac:plain-text-body>',
      '</ac:structured-macro>',
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body>&lt;!--[CDATA[&lt;section class=&quot;diff-case&quot;&gt;\n  &lt;h1&gt;HTML baseline&lt;/h1&gt;\n  &lt;p&gt;用于测试 HTML 代码块 language 参数。&lt;/p&gt;\n&lt;/section&gt;]]&gt;</ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('data-dh-code-enhanced="true"');
    expect(rendered.match(/data-dh-code-line="true"/g)).toHaveLength(9);
    expect(rendered).not.toContain('data-dh-code-token');
    expect(text).toContain('const mode = "diff";');
    expect(text).toContain('SELECT issue_key, status');
    expect(text).toContain('<section class="diff-case">');
    expect(text).toContain('</section>');
    expect(text).not.toContain('[CDATA[');
    expect(text).not.toContain('<!--');
    expect(text).not.toContain(']]');
    expect(rendered).not.toContain('</span>\n<span data-dh-code-line');
    expect(text).not.toContain('1const');
    expect(text).not.toContain('2console');
  });

  test('removes a stray CDATA comment terminator from the first HTML code tag', () => {
    const html = [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body>&lt;!--[CDATA[&lt;section class=&quot;diff-case&quot;--&gt;\n  &lt;h1&gt;HTML baseline&lt;/h1&gt;\n&lt;/section&gt;]]&gt;</ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(text).toContain('<section class="diff-case">');
    expect(text).toContain('<h1>HTML baseline</h1>');
    expect(text).toContain('</section>');
    expect(text).not.toContain('<section class="diff-case"-->');
  });

  test('restores a closing HTML tag lost with a malformed CDATA opening marker', () => {
    const storageHtml = [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body>&lt;section class=&quot;diff-case&quot;--&gt;\n  &lt;h1&gt;HTML baseline&lt;/h1&gt;\n  &lt;p&gt;HTML code body&lt;/p&gt;\n</ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('');

    const result = buildRichTextDiffHtml(storageHtml, storageHtml, '', {});
    const text = visiblePreviewText(result.html);

    expect(text).toContain('<section class="diff-case">');
    expect(text).toContain('<h1>HTML baseline</h1>');
    expect(text).toContain('<p>HTML code body</p>');
    expect(text).toContain('</section>');
    expect(text).not.toContain('<section class="diff-case"-->');
  });

  test('preserves safe Confluence colors across text, highlights, tables, panels, and statuses', () => {
    const html = [
      '<p><span style="color: var(--ds-text-accent-red)">Red text</span> <span data-highlight-colour="LIGHT_BLUE">Highlighted text</span></p>',
      '<table><tbody><tr><td data-highlight-colour="LIGHT_GREEN">Green cell</td><td bgcolor="#ffedeb">Red cell</td><td data-highlight-colour="#b3bac5" ac:local-id="a80b657e-dc65-47b8-99f7-0594156df0a4" valign="top"><p><strong>Medium gray cell</strong></p></td></tr></tbody></table>',
      '<ac:structured-macro ac:name="panel"><ac:parameter ac:name="title">Custom colour panel</ac:parameter><ac:parameter ac:name="bgColor">LIGHT_YELLOW</ac:parameter><ac:parameter ac:name="borderColor">DARK_ORANGE</ac:parameter><ac:parameter ac:name="titleColor">DARK_MAGENTA</ac:parameter><ac:rich-text-body><p>Panel body</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">Blocked</ac:parameter><ac:parameter ac:name="colour">Purple</ac:parameter></ac:structured-macro>',
      '<ac:adf-mark type="textColor"><ac:adf-attribute key="color">DARK_MAGENTA</ac:adf-attribute>ADF coloured text</ac:adf-mark>',
      '<ac:adf-mark type="backgroundColor"><ac:adf-attribute key="backgroundColor">LIGHT_LIME</ac:adf-attribute>ADF highlighted text</ac:adf-mark>',
      '<p><span style="color: rgb(255, 86, 48)">Legacy rgb red</span><mark data-color="#FFBDAD">Legacy mark highlight</mark><span class="fabric-text-color-mark color-purple">Class purple</span><span class="fabric-background-color-mark background-yellow">Class yellow highlight</span></p>',
      '<span class="status-macro aui-lozenge aui-lozenge-success">Legacy success status</span>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-text-color="dark-red"');
    expect(rendered).toContain('data-dh-bg-color="light-blue"');
    expect(rendered).toContain('data-dh-bg-color="light-green"');
    expect(rendered).toContain('data-dh-bg-color="light-red"');
    expect(rendered).toContain('data-dh-bg-color="medium-gray"');
    expect(rendered).toContain('data-dh-bg-color="light-yellow"');
    expect(rendered).toContain('data-dh-border-color="dark-orange"');
    expect(rendered).toContain('data-dh-text-color="dark-magenta"');
    expect(rendered).toContain('data-dh-status-color="purple"');
    expect(rendered).toContain('data-dh-bg-color="light-lime"');
    expect(rendered).toContain('data-dh-text-color="red"');
    expect(rendered).toContain('data-dh-bg-color="light-red"');
    expect(rendered).toContain('data-dh-text-color="purple"');
    expect(rendered).toContain('data-dh-bg-color="yellow"');
    expect(rendered).toContain('data-dh-status-color="green"');
  });

  test('preserves merged table cell backgrounds from shorthand style and data-color attributes', () => {
    const html = [
      '<table><tbody>',
      '<tr><td rowspan="2" style="background: var(--ds-background-accent-yellow-subtler)">rowspan=2 yellow cell</td><td>First covered row</td></tr>',
      '<tr><td>Second covered row</td></tr>',
      '<tr><td colspan="2" data-color="LIGHT_BLUE">colspan=2 blue cell</td></tr>',
      '</tbody></table>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('rowspan="2"');
    expect(rendered).toContain('colspan="2"');
    expect(rendered).toContain('data-dh-bg-color="light-yellow"');
    expect(rendered).toContain('data-dh-bg-color="light-blue"');
    expect(rendered).not.toContain('style="background:');
  });

  test('preserves text alignment and indentation from storage attributes and ADF metadata', () => {
    const html = [
      '<p style="text-align: center; margin-left: 48px">Centered and indented from style</p>',
      '<p data-text-align="right" data-indentation="3">Right aligned from data attributes</p>',
      '<p class="fabric-editor-align-justify fabric-editor-indent-2">Justified from class names</p>',
      '<ac:adf-mark type="alignment"><ac:adf-attribute key="align">center</ac:adf-attribute><p>ADF mark aligned</p></ac:adf-mark>',
      '<ac:adf-node type="paragraph"><ac:adf-attribute key="textAlign">right</ac:adf-attribute><ac:adf-attribute key="indentation">2</ac:adf-attribute><p>ADF node aligned and indented</p></ac:adf-node>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-align="center"');
    expect(rendered).toContain('data-dh-indent="2"');
    expect(rendered).toContain('data-dh-align="right"');
    expect(rendered).toContain('data-dh-indent="3"');
    expect(rendered).toContain('data-dh-align="justify"');
    expect(rendered).not.toContain('text-align: center');
    expect(rendered).not.toContain('margin-left: 48px');
    expect(rendered).toContain('ADF node aligned and indented');
  });

  test('does not add nested ADF indentation levels together', () => {
    const html = [
      '<p data-indentation="1">Level one</p>',
      '<ac:adf-node type="paragraph">',
      '<ac:adf-attribute key="indentation">2</ac:adf-attribute>',
      '<p data-indentation="1">Level two</p>',
      '</ac:adf-node>',
      '<ac:adf-node type="paragraph">',
      '<ac:adf-attribute key="indentation">3</ac:adf-attribute>',
      '<p data-indentation="1">Level three</p>',
      '</ac:adf-node>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const doc = new DOMParser().parseFromString(rendered, 'text/html');
    const paragraphs = Array.from(doc.body.querySelectorAll('p'));

    expect(paragraphs[0].getAttribute('data-dh-indent')).toBe('1');
    expect(paragraphs[1].hasAttribute('data-dh-indent')).toBe(false);
    expect(paragraphs[1].parentElement.getAttribute('data-dh-indent')).toBe('2');
    expect(paragraphs[2].hasAttribute('data-dh-indent')).toBe(false);
    expect(paragraphs[2].parentElement.getAttribute('data-dh-indent')).toBe('3');
  });

  test('renders Confluence date nodes from storage, links, ADF, and existing time elements', () => {
    const html = [
      '<ri:date ri:value="2026-07-08" />',
      '<ac:link><ri:date ri:value="2026-07-09" /></ac:link>',
      '<ac:adf-node type="date"><ac:adf-attribute key="attrs">{"timestamp":"1783555200000"}</ac:adf-attribute></ac:adf-node>',
      '<time datetime="2026-07-10">2026-07-10</time>',
      '<span class="date-node" data-date="2026-07-11"></span>',
      '日期：<time datetime="2026-07-12" />；负责人：@Tester',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered.match(/data-dh-node-type="date"/g)).toHaveLength(6);
    expect(rendered).toContain('2026');
    expect(text).toContain('负责人');
    expect(text).toContain('@Tester');
    expect(rendered).not.toContain('<ri:date');
    expect(rendered).not.toContain('<ac:adf-node');
  });

  test('does not replace surrounding content when a container mentions date metadata', () => {
    const html = [
      '<table><tbody><tr><td class="date-cell">',
      '状态：<span data-dh-node-type="status">PASS</span>；',
      '日期：<span class="date-node" data-date="2026-07-05"></span>；',
      '负责人：<span data-dh-node-type="mention">@Tester</span>',
      '</td></tr></tbody></table>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(text).toContain('状态');
    expect(text).toContain('PASS');
    expect(text).toContain('日期');
    expect(text).toContain('负责人');
    expect(text).toContain('@Tester');
  });

  test('renders ADF extension panels and keeps status lozenge labels', () => {
    const html = [
      '<ac:adf-extension><ac:adf-attribute key="extensionKey">com.atlassian.confluence.macro.core:panel</ac:adf-attribute><ac:adf-attribute key="parameters">{"panelType":"note","title":"Note"}</ac:adf-attribute><p>Note 面板：用于测试备注面板类型与正文变化。</p></ac:adf-extension>',
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">NEUTRAL</ac:parameter><ac:parameter ac:name="colour">Neutral</ac:parameter></ac:structured-macro>',
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">PURPLE</ac:parameter><ac:parameter ac:name="colour">Purple</ac:parameter></ac:structured-macro>',
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="title">BLUE</ac:parameter></ac:structured-macro>',
      '<ac:adf-node type="extension"><ac:adf-attribute key="extensionKey">com.atlassian.confluence.macro.core:status</ac:adf-attribute><ac:adf-attribute key="parameters">{"text":"GREEN","color":"Green"}</ac:adf-attribute></ac:adf-node>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('data-dh-node-type="panel"');
    expect(rendered).toContain('data-dh-panel-type="note"');
    expect(rendered).not.toContain('Unsupported Confluence block');
    expect(rendered).toContain('data-dh-status-color="gray"');
    expect(rendered).toContain('data-dh-status-color="purple"');
    expect(rendered).toContain('data-dh-status-color="blue"');
    expect(rendered).toContain('data-dh-status-color="green"');
    expect(text).toContain('NEUTRAL');
    expect(text).toContain('PURPLE');
    expect(text).toContain('BLUE');
    expect(text).toContain('GREEN');
    expect(text).not.toContain('STATUS');
  });

  test('renders Confluence decision-list extensions with item states', () => {
    const html = [
      '<ac:adf-extension>',
      '<ac:adf-node type="decision-list">',
      '<ac:adf-attribute key="local-id">b1280a2a-0223-411f-8b03-5fc7d7c717a3</ac:adf-attribute>',
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="local-id">5f0c1690-564c-416b-99d6-f76910cb4473</ac:adf-attribute><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><ac:adf-content>已决定：采用文本和结构双重对比。</ac:adf-content></ac:adf-node>',
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="local-id">0177baed-fa6d-4c1e-8a3a-11717240f03d</ac:adf-attribute><ac:adf-attribute key="state">UNDECIDED</ac:adf-attribute><ac:adf-content>未决定：是否展示属性级差异。</ac:adf-content></ac:adf-node>',
      '</ac:adf-node>',
      '<ac:adf-fallback><ul class="decision-list"><li>已决定：采用文本和结构双重对比。</li><li>未决定：是否展示属性级差异。</li></ul></ac:adf-fallback>',
      '</ac:adf-extension>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('data-dh-node-type="decision_list"');
    expect(rendered.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
    expect(rendered).toContain('data-dh-decision-state="decided"');
    expect(rendered).toContain('data-dh-decision-state="undecided"');
    expect(text).toContain('已决定：采用文本和结构双重对比。');
    expect(text).toContain('未决定：是否展示属性级差异。');
    expect(rendered).not.toContain('Unsupported Confluence block');
    expect(rendered).not.toContain('local-id');
  });

  test('renders only primary Decision items when the fallback repeats their ADF nodes', () => {
    const primaryItems = [
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><ac:adf-content>First Decision</ac:adf-content></ac:adf-node>',
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><ac:adf-content>Second Decision</ac:adf-content></ac:adf-node>',
    ].join('');
    const html = [
      '<ac:adf-extension>',
      `<ac:adf-node type="decision-list">${primaryItems}</ac:adf-node>`,
      '<ac:adf-fallback>',
      `<ac:adf-node type="decision-list">${primaryItems}</ac:adf-node>`,
      '</ac:adf-fallback>',
      '</ac:adf-extension>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
    expect((rendered.match(/First Decision/g) || [])).toHaveLength(1);
    expect((rendered.match(/Second Decision/g) || [])).toHaveLength(1);
  });

  test('renders panel ADF fallback nodes and generic legacy status labels', () => {
    const html = [
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">note</ac:adf-attribute><ac:adf-attribute key="local-id">04797b66-f9c9-41df-a521-60c460cea8bc</ac:adf-attribute><ac:adf-fallback><div><div><p local-id="60c460cea8bc">Note 面板：用于测试备注面板类型与正文变化。</p></div></div></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
      '<span class="status-macro aui-lozenge aui-lozenge-purple">STATUS</span>',
      '<span class="status-macro aui-lozenge aui-lozenge-current">STATUS</span>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('data-dh-node-type="panel"');
    expect(rendered).toContain('data-dh-panel-type="note"');
    expect(rendered).not.toContain('Unsupported Confluence block');
    expect(rendered).toContain('data-dh-status-color="purple"');
    expect(rendered).toContain('data-dh-status-color="blue"');
    expect(text).toContain('Note 面板：用于测试备注面板类型与正文变化。');
    expect(text).toContain('PURPLE');
    expect(text).toContain('BLUE');
    expect(text).not.toContain('STATUS');
  });

  test('maps the site panel storage formats to current visual panel types', () => {
    const html = [
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Info</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">note</ac:adf-attribute><ac:adf-fallback><div class="panel conf-macro output-block" style="background-color: rgb(234, 230, 255); border-color: rgb(153, 141, 217); border-width: 1px"><div class="panelContent" style="background-color: rgb(234, 230, 255)"><p>Note</p></div></div></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
      '<ac:structured-macro ac:name="tip"><ac:rich-text-body><p>Success</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="note"><ac:rich-text-body><p>Warning</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="warning"><ac:rich-text-body><p>Error</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="panel"><ac:parameter ac:name="bgColor">#B3BAC5</ac:parameter><ac:rich-text-body><p>Custom</p></ac:rich-text-body></ac:structured-macro>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');
    const text = visiblePreviewText(rendered);

    expect(rendered).toContain('data-dh-panel-type="info"');
    expect(rendered).toContain('data-dh-panel-type="note"');
    expect(rendered).toContain('data-dh-panel-type="success"');
    expect(rendered).toContain('data-dh-panel-type="warning"');
    expect(rendered).toContain('data-dh-panel-type="error"');
    expect(rendered).toContain('data-dh-panel-type="panel"');
    expect(rendered).toContain('data-dh-bg-color="medium-gray"');
    expect(rendered).not.toContain('data-dh-bg-color="light-purple"');
    expect(rendered).not.toContain('panelContent');
    expect(rendered.match(/data-dh-panel-title="true"/g)).toHaveLength(6);
    expect(text.match(/Info/g)).toHaveLength(2);
    expect(text.match(/Note/g)).toHaveLength(2);
    expect(text.match(/Success/g)).toHaveLength(2);
    expect(text.match(/Warning/g)).toHaveLength(2);
    expect(text.match(/Error/g)).toHaveLength(2);
    expect(text.match(/Custom/g)).toHaveLength(2);
    expect(rendered).not.toContain('Unsupported Confluence block');
  });

  test('uses ADF panel metadata instead of visible panel text when they disagree', () => {
    const html = [
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">note</ac:adf-attribute><ac:adf-fallback><p>Warning 面板：用于测试警告面板类型与正文变化。</p></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">warning</ac:adf-attribute><ac:adf-fallback><p>Error 面板：用于测试错误面板类型与正文变化。</p></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">tip</ac:adf-attribute><ac:adf-fallback><p>Success 面板：用于测试成功面板类型与正文变化。</p></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-panel-type="note"');
    expect(rendered).toContain('data-dh-panel-type="warning"');
    expect(rendered).toContain('data-dh-panel-type="info"');
    expect(rendered).not.toContain('data-dh-panel-type="error"');
    expect(rendered).not.toContain('data-dh-panel-type="success"');
  });

  test('uses structured macro names instead of visible panel text when they disagree', () => {
    const html = [
      '<ac:structured-macro ac:name="note"><ac:rich-text-body><p>Warning Panel: visible text should control the rendered colour.</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="warning"><ac:rich-text-body><p>Error Panel: visible text should control the rendered colour.</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="tip"><ac:rich-text-body><p>Success Panel: legacy tip data should render as a success panel.</p></ac:rich-text-body></ac:structured-macro>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-panel-type="warning"');
    expect(rendered).toContain('data-dh-panel-type="error"');
    expect(rendered).toContain('data-dh-panel-type="success"');
    expect(rendered).not.toContain('data-dh-panel-type="note"');
    expect(rendered).not.toContain('data-dh-panel-type="tip"');
  });

  test('uses ADF panel attributes instead of visible text for panel type', () => {
    const html = [
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">note</ac:adf-attribute><ac:adf-fallback><p>Warning Panel: visible text must not decide colour.</p></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
      '<ac:adf-extension><ac:adf-node type="panel"><ac:adf-attribute key="panel-type">success</ac:adf-attribute><ac:adf-fallback><p>Error Panel: visible text must not decide colour.</p></ac:adf-fallback></ac:adf-node></ac:adf-extension>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-panel-type="note"');
    expect(rendered).toContain('data-dh-panel-type="success"');
    expect(rendered).not.toContain('data-dh-panel-type="error"');
  });

  test('uses structured macro names instead of visible text for panel type', () => {
    const html = [
      '<ac:structured-macro ac:name="note"><ac:rich-text-body><p>Warning Panel: visible text must not decide colour.</p></ac:rich-text-body></ac:structured-macro>',
      '<ac:structured-macro ac:name="success"><ac:rich-text-body><p>Error Panel: visible text must not decide colour.</p></ac:rich-text-body></ac:structured-macro>',
    ].join('');

    const rendered = prepareConfluenceHtml(html, '');

    expect(rendered).toContain('data-dh-panel-type="warning"');
    expect(rendered).toContain('data-dh-panel-type="success"');
    expect(rendered).not.toContain('data-dh-panel-type="note"');
    expect(rendered).not.toContain('data-dh-panel-type="error"');
  });
});
