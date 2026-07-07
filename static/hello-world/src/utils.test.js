import { buildRichTextDiffHtml } from './utils';

function visiblePreviewText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  Array.from(doc.querySelectorAll('[data-dh-raw-inspector]')).forEach((node) => node.remove());
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

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
    expect(result.blocks[0].inline).toEqual([]);
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
  test('paragraph remains a block-level recovery unit without inline diff', () => {
    const result = buildRichTextDiffHtml(
      '<p>Old paragraph text.</p>',
      '<p>New paragraph text.</p>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'paragraph',
      oldHtml: '<p>Old paragraph text.</p>',
      newHtml: '<p>New paragraph text.</p>',
      inline: [],
    });
  });

  test('heading remains a block-level recovery unit without inline diff', () => {
    const result = buildRichTextDiffHtml(
      '<h2>Old heading</h2>',
      '<h2>New heading</h2>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'heading',
      inline: [],
    });
  });

  test('list additions are compared by item', () => {
    const result = buildRichTextDiffHtml(
      '<ul><li>Open a page</li><li>Select Dynamic History</li></ul>',
      '<ul><li>Open a page</li><li>Select Dynamic History</li><li>Preview a draft</li></ul>',
      '',
      {}
    );

    expect(result.blocks.map((block) => block.type)).toEqual(['same', 'same', 'added']);
    expect(result.blocks[2]).toMatchObject({
      nodeType: 'list_item',
      text: 'Preview a draft',
    });
  });

  test('task checkbox state and text changes are captured by task item', () => {
    const result = buildRichTextDiffHtml(
      '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Review copy.</ac:task-body></ac:task></ac:task-list>',
      '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>Review final copy.</ac:task-body></ac:task></ac:task-list>',
      '',
      {}
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'task_item',
      taskDiff: {
        oldStatus: 'incomplete',
        newStatus: 'complete',
        statusChanged: true,
        textChanged: true,
      },
    });
    expect(result.blocks[0].oldHtml).toContain('<ac:task-list>');
    expect(result.blocks[0].newHtml).toContain('<ac:task-list>');
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
      'paragraph',
    ]);
  });

  test('confluence layout containers do not become one giant diff block', () => {
    const oldHtml = [
      '<ac:layout><ac:layout-section><ac:layout-cell>',
      '<p>Intro</p>',
      '<table><tbody><tr><td>old</td></tr></tbody></table>',
      '<p>Outro</p>',
      '</ac:layout-cell></ac:layout-section></ac:layout>',
    ].join('');
    const newHtml = [
      '<ac:layout><ac:layout-section><ac:layout-cell>',
      '<p>Intro</p>',
      '<table><tbody><tr><td>new</td></tr></tbody></table>',
      '<p>Outro</p>',
      '</ac:layout-cell></ac:layout-section></ac:layout>',
    ].join('');
    const result = buildRichTextDiffHtml(oldHtml, newHtml, '', {});

    expect(result.blocks.map((block) => block.nodeType)).toEqual([
      'paragraph',
      'table',
      'paragraph',
    ]);
    expect(result.blocks[1]).toMatchObject({
      type: 'modified',
      nodeType: 'table',
    });
  });

  test('ADF task list state changes are one task diff without empty non-text rows', () => {
    const oldTask = [
      '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
      '<ac:adf-attribute key="localId">ea33bf50-33cd-405f-926a-8815d1d72ff7</ac:adf-attribute>',
      '<ac:adf-attribute key="state">DONE</ac:adf-attribute>',
      '<p>guess what</p>',
      '</ac:adf-node></ac:adf-node>',
    ].join('');
    const currentTask = [
      '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
      '<ac:adf-attribute key="localId">ea33bf50-33cd-405f-926a-8815d1d72ff7</ac:adf-attribute>',
      '<ac:adf-attribute key="state">TODO</ac:adf-attribute>',
      '<p>guess what</p>',
      '</ac:adf-node></ac:adf-node>',
    ].join('');
    const result = buildRichTextDiffHtml(oldTask, currentTask, '', {});

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'modified',
      nodeType: 'task_item',
      oldText: 'guess what',
      newText: 'guess what',
      taskDiff: {
        oldStatus: 'complete',
        newStatus: 'incomplete',
        statusChanged: true,
        textChanged: false,
      },
    });
    expect(result.blocks[0].oldHtml).toContain('<ac:adf-node');
    expect(result.blocks[0].newHtml).toContain('<ac:adf-node');
    expect(visiblePreviewText(result.html)).toContain('guess what');
    expect(result.blocks.some((block) => block.type !== 'modified' && !block.text && block.nodeType !== 'unsupported')).toBe(false);
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
    expect(normalText).toContain('[Status: state]');
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

  test('plain whiteboard anchors are preserved as one raw recovery block', () => {
    const raw = [
      '<p>',
      '<a href="https://bread-test.atlassian.net/wiki/spaces/~712020782f510e89df4a65a9d622ebe3b5af1c/whiteboard/7438339">',
      'Untitled whiteboard 2026-06-30',
      '</a>',
      '</p>',
    ].join('');
    const result = buildRichTextDiffHtml('', raw, '', {});

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'added',
      supportLevel: 'raw',
      newStorageGroupKind: 'raw-block',
    });
    expect(result.blocks[0].renderedHtml).toContain('data-dh-node-type="whiteboard_card"');
    expect(result.blocks[0].newHtml).toContain('/whiteboard/7438339');
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

  test('adf expand nodes are preserved as raw recovery blocks', () => {
    const raw = [
      '<ac:adf-node type="expand">',
      '<ac:adf-attribute key="title">Details</ac:adf-attribute>',
      '<p>inside expand</p>',
      '</ac:adf-node>',
    ].join('');
    const result = buildRichTextDiffHtml('', raw, '', {});

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({
      type: 'added',
      supportLevel: 'raw',
      newStorageGroupKind: 'raw-block',
    });
    expect(result.blocks[0].newHtml).toContain('<ac:adf-node type="expand">');
  });
});
