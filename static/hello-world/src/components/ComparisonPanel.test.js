import { buildRecoveryPreviewHtml, buildRecoveryStorageHtml } from './ComparisonPanel';
import { buildRichTextDiffHtml } from '../utils';

describe('buildRecoveryStorageHtml', () => {
  test('defaults to whole historical recovery instead of current plus recovered content', () => {
    const blocks = [
      {
        type: 'same',
        nodeType: 'paragraph',
        html: '<p>shared intro</p>',
      },
      {
        type: 'added',
        nodeType: 'paragraph',
        newHtml: '<p>current-only paragraph</p>',
      },
      {
        type: 'removed',
        nodeType: 'paragraph',
        oldHtml: '<p>historical-only paragraph</p>',
      },
      {
        type: 'modified',
        nodeType: 'paragraph',
        oldHtml: '<p>old paragraph</p>',
        newHtml: '<p>current paragraph</p>',
      },
    ];

    const result = buildRecoveryStorageHtml(blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toBe(
      '<p>shared intro</p><p>historical-only paragraph</p><p>old paragraph</p>'
    );
    expect(result.html).not.toContain('current-only paragraph');
    expect(result.html).not.toContain('current paragraph');
  });

  test('groups recovered task items into one task list without appending current task list', () => {
    const blocks = [
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml: [
          '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
          '<ac:adf-attribute key="state">TODO</ac:adf-attribute>',
          '<p>current task</p>',
          '</ac:adf-node></ac:adf-node>',
        ].join(''),
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml: [
          '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
          '<ac:adf-attribute key="state">DONE</ac:adf-attribute>',
          '<p>old task one</p>',
          '</ac:adf-node></ac:adf-node>',
        ].join(''),
        oldStorageGroupHtml: [
          '<ac:adf-node type="taskList">',
          '<ac:adf-node type="taskItem"><ac:adf-attribute key="state">DONE</ac:adf-attribute><p>old task one</p></ac:adf-node>',
          '<ac:adf-node type="taskItem"><ac:adf-attribute key="state">TODO</ac:adf-attribute><p>old task two</p></ac:adf-node>',
          '</ac:adf-node>',
        ].join(''),
        oldStorageGroupKey: 'adf-task-list:old-two',
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml: [
          '<ac:adf-node type="taskList"><ac:adf-node type="taskItem">',
          '<ac:adf-attribute key="state">TODO</ac:adf-attribute>',
          '<p>old task two</p>',
          '</ac:adf-node></ac:adf-node>',
        ].join(''),
        oldStorageGroupHtml: [
          '<ac:adf-node type="taskList">',
          '<ac:adf-node type="taskItem"><ac:adf-attribute key="state">DONE</ac:adf-attribute><p>old task one</p></ac:adf-node>',
          '<ac:adf-node type="taskItem"><ac:adf-attribute key="state">TODO</ac:adf-attribute><p>old task two</p></ac:adf-node>',
          '</ac:adf-node>',
        ].join(''),
        oldStorageGroupKey: 'adf-task-list:old-two',
      },
    ];

    const result = buildRecoveryStorageHtml(blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toContain('old task one');
    expect(result.html).toContain('old task two');
    expect(result.html).not.toContain('current task');
    expect((result.html.match(/type="taskList"/g) || [])).toHaveLength(1);
  });
  test('uses full raw task list group so flat task items stay flat', () => {
    const oldTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const blocks = [
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-flat',
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-flat',
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-flat',
      },
    ];

    const result = buildRecoveryStorageHtml(blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toBe(oldTaskList);
    expect((result.html.match(/<ac:task-list>/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(3);
  });

  test('preview renders a raw task list group once instead of each task item', () => {
    const oldTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>complete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const blocks = [
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>1</ac:task-body></ac:task></ac:task-list>',
        renderedHtml: '<ul><li data-dh-node-type="task_item">[x] 1</li></ul>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-preview',
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task></ac:task-list>',
        renderedHtml: '<ul><li data-dh-node-type="task_item">[ ] 2</li></ul>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-preview',
      },
      {
        type: 'removed',
        nodeType: 'task_item',
        oldHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task></ac:task-list>',
        renderedHtml: '<ul><li data-dh-node-type="task_item">[ ] 3</li></ul>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-preview',
      },
    ];
    const renderedGroups = [];
    const result = buildRecoveryPreviewHtml(blocks, new Map(), (html) => {
      renderedGroups.push(html);
      return '<ul data-preview-group="task-list"><li>1</li><li>2</li><li>3</li></ul>';
    });

    expect(renderedGroups).toEqual([oldTaskList]);
    expect((result.match(/data-preview-group="task-list"/g) || [])).toHaveLength(1);
    expect(result).not.toContain('[ ] 2');
    expect(result).not.toContain('[ ] 3');
  });

  test('split task list groups are emitted once when non-text blocks interrupt task items', () => {
    const oldTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>complete</ac:task-status><ac:task-body>guess what</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>?</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const rawPanel = '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>state</p></ac:rich-text-body></ac:structured-macro>';
    const taskBlock = (text) => ({
      type: 'removed',
      nodeType: 'task_item',
      oldHtml: `<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task></ac:task-list>`,
      oldStorageGroupHtml: oldTaskList,
      oldStorageGroupKey: 'task-list:interrupted',
    });
    const blocks = [
      taskBlock('guess what'),
      {
        type: 'same',
        nodeType: 'unsupported',
        supportLevel: 'raw',
        oldRawHtml: rawPanel,
        oldHtml: rawPanel,
        renderedHtml: '<div data-dh-node-type="unsupported">state</div>',
      },
      taskBlock('?'),
      taskBlock('1'),
      taskBlock('2'),
    ];
    const renderedGroups = [];

    const storage = buildRecoveryStorageHtml(blocks, new Map());
    const preview = buildRecoveryPreviewHtml(blocks, new Map(), (html) => {
      renderedGroups.push(html);
      return html;
    });

    expect(storage.error).toBe('');
    expect((storage.html.match(/<ac:task-list>/g) || [])).toHaveLength(1);
    expect(storage.html).toContain(rawPanel);
    expect(renderedGroups).toEqual([oldTaskList]);
    expect((preview.match(/<ac:task-list>/g) || [])).toHaveLength(1);
  });

  test('raw information panels are emitted once when their rendered children are split', () => {
    const oldInfoPanel = [
      '<ac:structured-macro ac:name="info">',
      '<ac:parameter ac:name="title">information</ac:parameter>',
      '<ac:rich-text-body>',
      '<p>state</p>',
      '<p>decide</p>',
      '</ac:rich-text-body>',
      '</ac:structured-macro>',
    ].join('');
    const blocks = [
      {
        type: 'same',
        nodeType: 'panel',
        text: 'information',
        oldRawHtml: oldInfoPanel,
        oldHtml: oldInfoPanel,
        oldStorageGroupHtml: oldInfoPanel,
        oldStorageGroupKey: 'raw-block:info-panel',
        renderedHtml: '<div data-dh-node-type="panel"><p>information</p></div>',
      },
      {
        type: 'same',
        nodeType: 'paragraph',
        text: 'state',
        oldRawHtml: oldInfoPanel,
        oldHtml: oldInfoPanel,
        oldStorageGroupHtml: oldInfoPanel,
        oldStorageGroupKey: 'raw-block:info-panel',
        renderedHtml: '<p>state</p>',
      },
      {
        type: 'same',
        nodeType: 'paragraph',
        text: 'decide',
        oldRawHtml: oldInfoPanel,
        oldHtml: oldInfoPanel,
        oldStorageGroupHtml: oldInfoPanel,
        oldStorageGroupKey: 'raw-block:info-panel',
        renderedHtml: '<p>decide</p>',
      },
    ];
    const renderedGroups = [];

    const storage = buildRecoveryStorageHtml(blocks, new Map());
    const preview = buildRecoveryPreviewHtml(blocks, new Map(), (html) => {
      renderedGroups.push(html);
      return '<div data-preview-group="info">information</div>';
    });

    expect(storage.error).toBe('');
    expect((storage.html.match(/<ac:structured-macro ac:name="info">/g) || [])).toHaveLength(1);
    expect(renderedGroups).toEqual([oldInfoPanel]);
    expect((preview.match(/data-preview-group="info"/g) || [])).toHaveLength(1);
  });

  test('identical raw information panels remain separate groups', () => {
    const infoPanel = [
      '<ac:structured-macro ac:name="info">',
      '<ac:rich-text-body><p>same text</p></ac:rich-text-body>',
      '</ac:structured-macro>',
    ].join('');
    const blocks = ['0', '1'].map((suffix) => ({
      type: 'same',
      nodeType: 'panel',
      text: 'same text',
      oldRawHtml: infoPanel,
      oldHtml: infoPanel,
      oldStorageGroupHtml: infoPanel,
      oldStorageGroupKey: `raw-block:${suffix}:same-info-panel`,
      renderedHtml: '<div data-dh-node-type="panel"><p>same text</p></div>',
    }));

    const storage = buildRecoveryStorageHtml(blocks, new Map());

    expect(storage.error).toBe('');
    expect((storage.html.match(/<ac:structured-macro ac:name="info">/g) || [])).toHaveLength(2);
  });

  test('current-only repeated unsupported macros are omitted from default recovery', () => {
    const macro = (id) => [
      `<ac:structured-macro ac:name="tasks-report-macro" ac:macro-id="${id}">`,
      '<ac:parameter ac:name="space">TEST</ac:parameter>',
      '</ac:structured-macro>',
    ].join('');
    const oldStorage = [
      '<h1>标题1</h1>',
      macro('old-only'),
      '<h3>标题3</h3>',
    ].join('');
    const currentStorage = [
      '<h1>标题1</h1>',
      macro('old-only'),
      '<h3>标题3</h3>',
      macro('current-one'),
      macro('current-two'),
      macro('current-three'),
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const storage = buildRecoveryStorageHtml(diff.blocks, new Map());
    const preview = buildRecoveryPreviewHtml(diff.blocks, new Map(), (html) => html);

    expect(storage.error).toBe('');
    expect((storage.html.match(/tasks-report-macro/g) || [])).toHaveLength(1);
    expect(storage.html).toContain('old-only');
    expect(storage.html).not.toContain('current-one');
    expect(storage.html).not.toContain('current-two');
    expect(storage.html).not.toContain('current-three');
    expect((preview.match(/tasks-report-macro/g) || [])).toHaveLength(1);
  });

  test('current-only repeated whiteboards and info panels are omitted from default recovery', () => {
    const whiteboard = (localId) => [
      `<p local-id="${localId}">`,
      '<a href="https://bread-test.atlassian.net/wiki/spaces/~712020782f510e89df4a65a9d622ebe3b5af1c/whiteboard/7438339">',
      'Untitled whiteboard 2026-06-30',
      '</a>',
      '</p>',
    ].join('');
    const infoPanel = (localId) => [
      `<p local-id="${localId}">`,
      '<ac:structured-macro ac:name="info">',
      '<ac:rich-text-body><p>information</p></ac:rich-text-body>',
      '</ac:structured-macro>',
      '</p>',
    ].join('');
    const oldStorage = [whiteboard('old-whiteboard'), infoPanel('old-info')].join('');
    const currentStorage = [
      whiteboard('old-whiteboard'),
      whiteboard('current-whiteboard-1'),
      whiteboard('current-whiteboard-2'),
      infoPanel('old-info'),
      infoPanel('current-info-1'),
      infoPanel('current-info-2'),
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const storage = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(storage.error).toBe('');
    expect((storage.html.match(/\/whiteboard\/7438339/g) || [])).toHaveLength(1);
    expect((storage.html.match(/<ac:structured-macro ac:name="info">/g) || [])).toHaveLength(1);
    expect(storage.html).toContain('old-whiteboard');
    expect(storage.html).toContain('old-info');
    expect(storage.html).not.toContain('current-whiteboard-1');
    expect(storage.html).not.toContain('current-whiteboard-2');
    expect(storage.html).not.toContain('current-info-1');
    expect(storage.html).not.toContain('current-info-2');
  });

  test('confluence emoticons are written back as storage tags, not escaped text', () => {
    const oldStorage = [
      '<p>',
      '<ac:emoticon ac:name="laugh" ac:emoji-shortname=":grinning:" ac:emoji-id="1f600" ac:local-id="first" />',
      ' ',
      '<ac:emoticon ac:name="blue-star" ac:emoji-shortname=":smiling_face_with_tear:" ac:emoji-id="1f972" ac:local-id="second" />',
      '</p>',
    ].join('');
    const diff = buildRichTextDiffHtml(oldStorage, '', '', {});
    const storage = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(storage.error).toBe('');
    expect((storage.html.match(/<ac:emoticon\b/g) || [])).toHaveLength(2);
    expect(storage.html).toContain('ac:name="laugh"');
    expect(storage.html).toContain('ac:name="blue-star"');
    expect(storage.html).not.toContain('</ac:emoticon>');
    expect(storage.html).not.toContain('&lt;ac:emoticon');
  });

  test('same task items restore the historical task list group, not the current expanded group', () => {
    const oldTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const currentTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>4</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>5</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const blocks = [
      {
        type: 'same',
        nodeType: 'task_item',
        html: '<ac:task-list><ac:task><ac:task-body>1</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-1-3',
        newStorageGroupHtml: currentTaskList,
        newStorageGroupKey: 'task-list:current-1-5',
      },
      {
        type: 'same',
        nodeType: 'task_item',
        html: '<ac:task-list><ac:task><ac:task-body>2</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-1-3',
        newStorageGroupHtml: currentTaskList,
        newStorageGroupKey: 'task-list:current-1-5',
      },
      {
        type: 'same',
        nodeType: 'task_item',
        html: '<ac:task-list><ac:task><ac:task-body>3</ac:task-body></ac:task></ac:task-list>',
        oldStorageGroupHtml: oldTaskList,
        oldStorageGroupKey: 'task-list:old-1-3',
        newStorageGroupHtml: currentTaskList,
        newStorageGroupKey: 'task-list:current-1-5',
      },
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml: '<ac:task-list><ac:task><ac:task-body>4</ac:task-body></ac:task></ac:task-list>',
        newStorageGroupHtml: currentTaskList,
        newStorageGroupKey: 'task-list:current-1-5',
      },
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml: '<ac:task-list><ac:task><ac:task-body>5</ac:task-body></ac:task></ac:task-list>',
        newStorageGroupHtml: currentTaskList,
        newStorageGroupKey: 'task-list:current-1-5',
      },
    ];

    const storage = buildRecoveryStorageHtml(blocks, new Map());
    const renderedGroups = [];
    const preview = buildRecoveryPreviewHtml(blocks, new Map(), (html) => {
      renderedGroups.push(html);
      return html;
    });

    expect(storage.error).toBe('');
    expect(storage.html).toBe(oldTaskList);
    expect(storage.html).not.toContain('<ac:task-body>4</ac:task-body>');
    expect(storage.html).not.toContain('<ac:task-body>5</ac:task-body>');
    expect(renderedGroups).toEqual([oldTaskList]);
    expect(preview).toBe(oldTaskList);
  });

  test('mixed choices inside one task list produce one merged task list', () => {
    const oldTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>4</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>5</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const currentTaskList = [
      '<ac:task-list>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>1</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>2</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>3</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>4</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>5</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>6</ac:task-body></ac:task>',
      '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>7</ac:task-body></ac:task>',
      '</ac:task-list>',
    ].join('');
    const blocks = ['1', '2', '3', '4', '5'].map((text) => ({
      type: 'same',
      nodeType: 'task_item',
      html: `<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task></ac:task-list>`,
      oldStorageGroupKey: 'task-list:shared',
      oldStorageGroupHtml: oldTaskList,
      newStorageGroupKey: 'task-list:shared',
      newStorageGroupHtml: currentTaskList,
    })).concat([
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>6</ac:task-body></ac:task></ac:task-list>',
        newStorageGroupKey: 'task-list:shared',
        newStorageGroupHtml: currentTaskList,
      },
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml:
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>7</ac:task-body></ac:task></ac:task-list>',
        newStorageGroupKey: 'task-list:shared',
        newStorageGroupHtml: currentTaskList,
      },
    ]);
    const choices = new Map([['5', 'current']]);
    const result = buildRecoveryStorageHtml(blocks, choices);
    const renderedGroups = [];
    const preview = buildRecoveryPreviewHtml(blocks, choices, (html) => {
      renderedGroups.push(html);
      return html;
    });

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list>/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(6);
    expect(result.html).toContain('<ac:task-body>6</ac:task-body>');
    expect(result.html).not.toContain('<ac:task-body>7</ac:task-body>');
    expect(renderedGroups).toEqual([result.html]);
    expect(preview).toBe(result.html);
  });

  test('mixed task list recovery preserves the task-list id attribute', () => {
    const task = (text) =>
      `<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task>`;
    const oldTaskList = `<ac:task-list ac:task-list-id="old-list">${['1', '2'].map(task).join('')}</ac:task-list>`;
    const currentTaskList = `<ac:task-list ac:task-list-id="current-list">${['1', '2', '3'].map(task).join('')}</ac:task-list>`;
    const blocks = ['1', '2'].map((text) => ({
      type: 'same',
      nodeType: 'task_item',
      oldRawHtml: `<ac:task-list ac:task-list-id="old-list">${task(text)}</ac:task-list>`,
      newRawHtml: `<ac:task-list ac:task-list-id="current-list">${task(text)}</ac:task-list>`,
      oldStorageGroupKey: 'task-list:shared',
      oldStorageGroupHtml: oldTaskList,
      newStorageGroupKey: 'task-list:shared',
      newStorageGroupHtml: currentTaskList,
    })).concat([
      {
        type: 'added',
        nodeType: 'task_item',
        newRawHtml: `<ac:task-list ac:task-list-id="current-list">${task('3')}</ac:task-list>`,
        newStorageGroupKey: 'task-list:shared',
        newStorageGroupHtml: currentTaskList,
      },
    ]);
    const result = buildRecoveryStorageHtml(blocks, new Map([['2', 'current']]));

    expect(result.error).toBe('');
    expect(result.html).toContain('<ac:task-list ac:task-list-id="old-list">');
    expect(result.html).not.toContain('<ac:task-list>');
    expect(result.html).not.toContain('current-list');
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(3);
    expect(result.html).toContain('<ac:task-body>3</ac:task-body>');
  });

  test('mixed task list recovery uses item raw storage so the first item is not dropped', () => {
    const blocks = ['1', '2', '3', '4', '5'].map((text, index) => ({
      type: 'same',
      nodeType: 'task_item',
      html: index === 0
        ? '<ac:task-list><ac:task><ac:task-body>wrong-preview-item</ac:task-body></ac:task></ac:task-list>'
        : `<ac:task-list><ac:task><ac:task-body>${text}</ac:task-body></ac:task></ac:task-list>`,
      oldRawHtml: `<ac:task-list><ac:task><ac:task-body>${text}</ac:task-body></ac:task></ac:task-list>`,
      newRawHtml: `<ac:task-list><ac:task><ac:task-body>${text}</ac:task-body></ac:task></ac:task-list>`,
      oldStorageGroupKey: 'task-list:shared-old',
      oldStorageGroupHtml: '<ac:task-list>old-group</ac:task-list>',
      newStorageGroupKey: 'task-list:shared-current',
      newStorageGroupHtml: '<ac:task-list>current-group</ac:task-list>',
    })).concat([
      {
        type: 'added',
        nodeType: 'task_item',
        newHtml: '<ac:task-list><ac:task><ac:task-body>6-preview</ac:task-body></ac:task></ac:task-list>',
        newRawHtml: '<ac:task-list><ac:task><ac:task-body>6</ac:task-body></ac:task></ac:task-list>',
        newStorageGroupKey: 'task-list:shared-current',
        newStorageGroupHtml: '<ac:task-list>current-group</ac:task-list>',
      },
    ]);

    const result = buildRecoveryStorageHtml(blocks, new Map([['5', 'current']]));

    expect(result.error).toBe('');
    expect(result.html).toContain('<ac:task-body>1</ac:task-body>');
    expect(result.html).toContain('<ac:task-body>6</ac:task-body>');
    expect(result.html).not.toContain('wrong-preview-item');
    expect(result.html).not.toContain('6-preview');
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(6);
  });

  test('real task list diff keeps the first item when one added item is kept current', () => {
    const task = (text) =>
      `<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>${text}</ac:task-body></ac:task>`;
    const oldStorage = `<ac:task-list>${['1', '2', '3', '4', '5'].map(task).join('')}</ac:task-list>`;
    const currentStorage = `<ac:task-list>${['1', '2', '3', '4', '5', '6', '7'].map(task).join('')}</ac:task-list>`;
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage);
    const keepSixIndex = diff.blocks.findIndex(
      (block) => block.type === 'added' && block.nodeType === 'task_item' && String(block.text || '').includes('6')
    );

    expect(keepSixIndex).toBeGreaterThan(-1);

    const result = buildRecoveryStorageHtml(diff.blocks, new Map([[String(keepSixIndex), 'current']]));

    expect(result.error).toBe('');
    expect(result.html).toContain('<ac:task-body>1</ac:task-body>');
    expect(result.html).toContain('<ac:task-body>6</ac:task-body>');
    expect(result.html).not.toContain('<ac:task-body>7</ac:task-body>');
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(6);
  });

});
