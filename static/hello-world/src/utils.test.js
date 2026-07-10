import { buildRichTextDiffHtml, prepareConfluenceHtml } from './utils';

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
