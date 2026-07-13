import { buildRecoveryStorageHtml } from './recoveryStorage';
import { buildRichTextDiffHtml, prepareConfluenceHtml } from './utils';
import { buildRecoveryPreviewHtml } from './components/ComparisonPanel';

function legacyTask(text) {
  return [
    '<ac:task>',
    '<ac:task-status>incomplete</ac:task-status>',
    `<ac:task-body>${text}</ac:task-body>`,
    '</ac:task>',
  ].join('');
}

function legacyTaskList(items, id = '') {
  const idAttribute = id ? ` ac:task-list-id="${id}"` : '';
  return `<ac:task-list${idAttribute}>${items.map(legacyTask).join('')}</ac:task-list>`;
}

function decisionList(items, listId = 'decision-list-id', fallbackInsideList = false) {
  const decisionItems = items
    .map(
      ({ id, state, text }) => [
        '<ac:adf-node type="decision-item">',
        `<ac:adf-attribute key="local-id">${id}</ac:adf-attribute>`,
        `<ac:adf-attribute key="state">${state}</ac:adf-attribute>`,
        `<ac:adf-content>${text}</ac:adf-content>`,
        '</ac:adf-node>',
      ].join('')
    )
    .join('');
  const fallbackItems = items.map(({ text }) => `<li>${text}</li>`).join('');
  const fallback =
    `<ac:adf-fallback><ul class="decision-list">${fallbackItems}</ul></ac:adf-fallback>`;

  return [
    '<ac:adf-extension>',
    '<ac:adf-node type="decision-list">',
    `<ac:adf-attribute key="local-id">${listId}</ac:adf-attribute>`,
    decisionItems,
    fallbackInsideList ? fallback : '',
    '</ac:adf-node>',
    fallbackInsideList ? '' : fallback,
    '</ac:adf-extension>',
  ].join('');
}

describe('buildRecoveryStorageHtml', () => {
  test('preserves the current-version default used by the existing UI', () => {
    const diff = buildRichTextDiffHtml('<p>old</p>', '<p>current</p>', '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toBe('<p>current</p>');
  });

  test('emits one task-list wrapper for current task items', () => {
    const oldStorage = legacyTaskList(['one', 'two'], 'old-list');
    const currentStorage = legacyTaskList(['one', 'two', 'three'], 'current-list');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list\b/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(3);
    expect(result.html).toContain('ac:task-list-id="current-list"');
  });

  test('omits a current-only task item when the user restores the old group', () => {
    const oldStorage = legacyTaskList(['one', 'two'], 'old-list');
    const currentStorage = legacyTaskList(['one', 'two', 'three'], 'current-list');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const addedIndex = diff.blocks.findIndex(
      (block) => block.type === 'added' && block.text.includes('three')
    );
    const choices = new Map([[String(addedIndex), 'old']]);
    const result = buildRecoveryStorageHtml(diff.blocks, choices);

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list\b/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(2);
    expect(result.html).not.toContain('three');
  });

  test('combines mixed old and current task choices into one valid list', () => {
    const oldStorage = legacyTaskList(['one', 'old two'], 'old-list');
    const currentStorage = legacyTaskList(['one', 'current two', 'three'], 'current-list');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.text.includes('old two') || block.text.includes('current two')) {
        choices.set(String(index), 'old');
      }
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list\b/g) || [])).toHaveLength(1);
    expect(result.html).toContain('old two');
    expect(result.html).toContain('three');
    expect(result.html).not.toContain('current two');
  });

  test('preserves one complete decision extension during write-back', () => {
    const storage = decisionList([
      { id: 'decision-one', state: 'DECIDED', text: 'Use the selected design.' },
      { id: 'decision-two', state: 'UNDECIDED', text: 'Review the rollout date.' },
    ]);
    const diff = buildRichTextDiffHtml(storage, storage, '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());
    const rendered = prepareConfluenceHtml(result.html, '');

    expect(result.error).toBe('');
    expect(result.html).toBe(storage);
    expect((result.html.match(/<ac:adf-extension\b/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:adf-fallback\b/g) || [])).toHaveLength(1);
    expect(rendered.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
  });

  test('previews two Decisions once when Storage fallback repeats their ADF nodes', () => {
    const decisionItems = [
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><ac:adf-content>First saved Decision</ac:adf-content></ac:adf-node>',
      '<ac:adf-node type="decision-item"><ac:adf-attribute key="state">DECIDED</ac:adf-attribute><ac:adf-content>Second saved Decision</ac:adf-content></ac:adf-node>',
    ].join('');
    const storage = [
      '<ac:adf-extension>',
      `<ac:adf-node type="decision-list">${decisionItems}</ac:adf-node>`,
      `<ac:adf-fallback><ac:adf-node type="decision-list">${decisionItems}</ac:adf-node></ac:adf-fallback>`,
      '</ac:adf-extension>',
    ].join('');
    const diff = buildRichTextDiffHtml(storage, storage, '', {});
    const preview = buildRecoveryPreviewHtml(diff.blocks, new Map());

    expect(diff.blocks).toHaveLength(2);
    expect(preview.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
    expect((preview.match(/First saved Decision/g) || [])).toHaveLength(1);
    expect((preview.match(/Second saved Decision/g) || [])).toHaveLength(1);
  });

  test('rebuilds mixed Decision choices as one complete extension', () => {
    const sharedDecision = {
      id: 'decision-one',
      state: 'DECIDED',
      text: 'Keep the shared Decision.',
    };
    const oldStorage = decisionList([
      sharedDecision,
      { id: 'decision-two', state: 'UNDECIDED', text: 'Use the old Decision.' },
    ]);
    const currentStorage = decisionList([
      sharedDecision,
      { id: 'decision-two', state: 'DECIDED', text: 'Use the current Decision.' },
    ]);
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.type === 'removed' || block.type === 'added') {
        choices.set(String(index), 'old');
      }
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);
    const rendered = prepareConfluenceHtml(result.html, '');

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:adf-extension\b/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:adf-fallback\b/g) || [])).toHaveLength(1);
    expect(result.html).toContain('Keep the shared Decision.');
    expect(result.html).toContain('Use the old Decision.');
    expect(result.html).not.toContain('Use the current Decision.');
    expect(rendered.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
  });

  test('keeps an embedded Decision fallback inside the list without duplicating it', () => {
    const sharedDecision = {
      id: 'decision-one',
      state: 'DECIDED',
      text: 'Keep the shared Decision.',
    };
    const oldStorage = decisionList([
      sharedDecision,
      { id: 'decision-two', state: 'UNDECIDED', text: 'Use the old Decision.' },
    ], 'embedded-list', true);
    const currentStorage = decisionList([
      sharedDecision,
      { id: 'decision-two', state: 'DECIDED', text: 'Use the current Decision.' },
    ], 'embedded-list', true);
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.type === 'removed' || block.type === 'added') {
        choices.set(String(index), 'old');
      }
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);
    const fallbackCount = (result.html.match(/<ac:adf-fallback\b/g) || []).length;
    const rendered = prepareConfluenceHtml(result.html, '');

    expect(result.error).toBe('');
    expect(fallbackCount).toBe(1);
    expect(result.html).toMatch(
      /<ac:adf-node\b[^>]*type="decision-list"[^>]*>[\s\S]*<ac:adf-fallback\b[\s\S]*<\/ac:adf-fallback><\/ac:adf-node>/
    );
    expect(result.html).toContain('Use the old Decision.');
    expect(result.html).not.toContain('Use the current Decision.');
    expect(rendered.match(/data-dh-node-type="decision"/g)).toHaveLength(2);
  });

  test('writes multiple independent Decision groups once when only one group changes', () => {
    const stableGroup = decisionList([
      { id: 'stable-decision', state: 'DECIDED', text: 'Stable Decision text.' },
    ], 'stable-list', true);
    const oldChangedGroup = decisionList([
      { id: 'changed-decision', state: 'UNDECIDED', text: 'Old changed Decision.' },
    ], 'changed-list', true);
    const currentChangedGroup = decisionList([
      { id: 'changed-decision', state: 'DECIDED', text: 'Current changed Decision.' },
    ], 'changed-list', true);
    const diff = buildRichTextDiffHtml(
      `${stableGroup}${oldChangedGroup}`,
      `${stableGroup}${currentChangedGroup}`,
      '',
      {}
    );
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.type === 'removed' || block.type === 'added') {
        choices.set(String(index), 'old');
      }
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:adf-extension\b/g) || [])).toHaveLength(2);
    expect((result.html.match(/<ac:adf-fallback\b/g) || [])).toHaveLength(2);
    expect((result.html.match(/Stable Decision text\./g) || [])).toHaveLength(2);
    expect((result.html.match(/Old changed Decision\./g) || [])).toHaveLength(2);
    expect(result.html).not.toContain('Current changed Decision.');
  });

  test('keeps compatible layout boundaries around a restored inner table', () => {
    const oldStorage = [
      '<ac:layout><ac:layout-section ac:type="two_equal"><ac:layout-cell>',
      '<table><tbody><tr><td>old</td></tr></tbody></table>',
      '</ac:layout-cell><ac:layout-cell><p>right</p></ac:layout-cell>',
      '</ac:layout-section></ac:layout>',
    ].join('');
    const currentStorage = oldStorage.replace('<td>old</td>', '<td>current</td>');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.type === 'removed' || block.type === 'added') {
        choices.set(String(index), 'old');
      }
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);

    expect(result.error).toBe('');
    expect(result.html).toContain('<ac:layout>');
    expect(result.html).toContain('<ac:layout-section ac:type="two_equal">');
    expect(result.html).toContain('<td>old</td>');
    expect(result.html).not.toContain('<td>current</td>');
  });

  test('preserves self-closing Confluence emoji storage', () => {
    const storage = '<p>Hello <ac:emoticon ac:name="laugh" /></p>';
    const diff = buildRichTextDiffHtml(storage, storage, '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toContain('<ac:emoticon ac:name="laugh" />');
    expect(result.html).not.toContain('</ac:emoticon>');
  });

  test('preserves a self-closing mention without grouping the following page content', () => {
    const explicitMentionStorage = [
      '<p>Before</p>',
      '<ri:user ri:account-id="account-1"></ri:user>',
      '<p>After</p>',
    ].join('');
    const selfClosingMentionStorage = explicitMentionStorage.replace(
      '<ri:user ri:account-id="account-1"></ri:user>',
      '<ri:user ri:account-id="account-1" />'
    );
    const diff = buildRichTextDiffHtml(
      explicitMentionStorage,
      selfClosingMentionStorage,
      '',
      {},
      { 'account-1': 'Example User' }
    );
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(result.error).toBe('');
    expect(result.html).toBe(selfClosingMentionStorage);
    expect(result.html).toContain('<p>After</p>');
    expect(result.html).not.toContain('</ri:user>');
  });

  test('restores HTML code CDATA without emptying the code block on the next diff', () => {
    const codeMacro = (heading) => [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body><![CDATA[<section class="diff-case">',
      `<h1>${heading}</h1>`,
      '<p>HTML code body</p>',
      '</section>]]></ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('\n');
    const version12 = codeMacro('HTML baseline');
    const version13 = codeMacro('HTML changed');
    const initialDiff = buildRichTextDiffHtml(version12, version13, '', {});
    const choices = new Map();

    initialDiff.blocks.forEach((block, index) => {
      if (block.type === 'removed' || block.type === 'added') {
        choices.set(String(index), 'old');
      }
    });

    const recovered = buildRecoveryStorageHtml(initialDiff.blocks, choices);
    const nextDiff = buildRichTextDiffHtml(version13, recovered.html, '', {});
    const restoredCode = nextDiff.blocks.find((block) => block.type === 'added');

    expect(recovered.error).toBe('');
    expect(recovered.html).toContain('<![CDATA[<section class="diff-case">');
    expect(recovered.html).toContain('<h1>HTML baseline</h1>');
    expect(restoredCode).toBeDefined();
    expect(restoredCode.nodeType).toBe('code_block');
    expect(restoredCode.text).toContain('<section class="diff-case">');
    expect(restoredCode.text).toContain('<h1>HTML baseline</h1>');
  });

  test('canonicalizes preview-readable encoded HTML code into valid write-back CDATA', () => {
    const encodedStorage = [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body>',
      '&lt;!--[CDATA[&lt;section class=&quot;diff-case&quot;&gt;\n',
      '  &lt;h1&gt;HTML baseline&lt;/h1&gt;\n',
      '  &lt;p&gt;HTML code body&lt;/p&gt;\n',
      '&lt;/section&gt;]]&gt;',
      '</ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('');
    const diff = buildRichTextDiffHtml('', encodedStorage, '', {});
    const recovered = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(recovered.error).toBe('');
    expect(recovered.html).toContain('<![CDATA[<section class="diff-case">');
    expect(recovered.html).toContain('<h1>HTML baseline</h1>');
    expect(recovered.html).toContain('</section>]]>');
    expect(recovered.html).not.toContain('&lt;!--[CDATA[');
  });

  test('keeps already valid code CDATA byte-for-byte during write-back', () => {
    const validStorage = [
      '<ac:structured-macro ac:name="code">',
      '<ac:parameter ac:name="language">html</ac:parameter>',
      '<ac:plain-text-body><![CDATA[<p>&lt;entity example&gt;</p>]]></ac:plain-text-body>',
      '</ac:structured-macro>',
    ].join('');
    const diff = buildRichTextDiffHtml('', validStorage, '', {});
    const recovered = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(recovered.error).toBe('');
    expect(recovered.html).toBe(validStorage);
  });

  test('rejects a rendered unsupported placeholder without raw storage', () => {
    const result = buildRecoveryStorageHtml(
      [{
        type: 'added',
        nodeType: 'unsupported',
        supportLevel: 'raw',
        newHtml: '<div data-dh-node-type="unsupported">Unsupported Confluence block</div>',
      }],
      new Map()
    );

    expect(result.html).toBe('');
    expect(result.error).toContain('write-back is disabled');
  });

  test('emits an interrupted task storage group once without dropping the panel', () => {
    const fullTaskList = legacyTaskList(['one', 'two', 'three'], 'shared-list');
    const taskBlock = (text) => ({
      type: 'same',
      nodeType: 'task_item',
      html: legacyTaskList([text]),
      newRawHtml: legacyTaskList([text]),
      newStorageGroupHtml: fullTaskList,
      newStorageGroupKey: 'task-list:shared',
      storageGroupHtml: fullTaskList,
      storageGroupKey: 'task-list:shared',
    });
    const panelStorage =
      '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>panel</p></ac:rich-text-body></ac:structured-macro>';
    const blocks = [
      taskBlock('one'),
      {
        type: 'same',
        nodeType: 'panel',
        html: panelStorage,
        newRawHtml: panelStorage,
      },
      taskBlock('two'),
      taskBlock('three'),
    ];
    const result = buildRecoveryStorageHtml(blocks, new Map());

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list\b/g) || [])).toHaveLength(1);
    expect((result.html.match(/<ac:task>/g) || [])).toHaveLength(3);
    expect(result.html).toContain(panelStorage);
  });

  test('uses shared UI choice keys to merge fully changed task groups', () => {
    const oldStorage = legacyTaskList(['old one', 'old two'], 'old-list');
    const currentStorage = legacyTaskList(['current one', 'current two'], 'current-list');
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const removed = diff.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'removed');
    const added = diff.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'added');
    const blockChoiceKeys = new Map([
      [removed[0].index, 'pair-one'],
      [added[0].index, 'pair-one'],
      [removed[1].index, 'pair-two'],
      [added[1].index, 'pair-two'],
    ]);
    const choices = new Map([
      ['pair-one', 'old'],
      ['pair-two', 'current'],
    ]);
    const result = buildRecoveryStorageHtml(diff.blocks, choices, blockChoiceKeys);

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:task-list\b/g) || [])).toHaveLength(1);
    expect(result.html).toContain('old one');
    expect(result.html).toContain('current two');
    expect(result.html).not.toContain('current one');
    expect(result.html).not.toContain('old two');
  });

  test('preserves ADF task items as one ADF task-list storage group', () => {
    const item = (text) => [
      '<ac:adf-node type="taskItem">',
      '<ac:adf-attribute key="state">TODO</ac:adf-attribute>',
      `<p>${text}</p>`,
      '</ac:adf-node>',
    ].join('');
    const oldStorage = `<ac:adf-node type="taskList" local-id="old">${item('one')}</ac:adf-node>`;
    const currentStorage =
      `<ac:adf-node type="taskList" local-id="current">${item('one')}${item('two')}</ac:adf-node>`;
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());
    const preview = prepareConfluenceHtml(result.html, '');

    expect(result.error).toBe('');
    expect((result.html.match(/type="taskList"/g) || [])).toHaveLength(1);
    expect((result.html.match(/type="taskItem"/g) || [])).toHaveLength(2);
    expect(result.html).toContain('local-id="current"');
    expect(result.html).not.toContain('<ul');
    expect((preview.match(/data-dh-node-type="task_list"/g) || [])).toHaveLength(1);
  });

  test('keeps identical raw macros as separate recovery groups', () => {
    const macro = (id) => [
      `<ac:structured-macro ac:name="info" ac:macro-id="${id}">`,
      '<ac:rich-text-body><p>same panel</p></ac:rich-text-body>',
      '</ac:structured-macro>',
    ].join('');
    const storage = `${macro('first')}${macro('second')}`;
    const diff = buildRichTextDiffHtml(storage, storage, '', {});
    const result = buildRecoveryStorageHtml(diff.blocks, new Map());

    expect(result.error).toBe('');
    expect((result.html.match(/<ac:structured-macro\b/g) || [])).toHaveLength(2);
    expect(result.html).toContain('ac:macro-id="first"');
    expect(result.html).toContain('ac:macro-id="second"');
  });

  test('omits restored current-only unsupported macros without duplicating the old macro', () => {
    const macro = (id) =>
      `<ac:structured-macro ac:name="tasks-report-macro" ac:macro-id="${id}"></ac:structured-macro>`;
    const oldStorage = macro('old-only');
    const currentStorage = `${oldStorage}${macro('current-one')}${macro('current-two')}`;
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const choices = new Map();

    diff.blocks.forEach((block, index) => {
      if (block.type === 'added') choices.set(String(index), 'old');
    });

    const result = buildRecoveryStorageHtml(diff.blocks, choices);

    expect(result.error).toBe('');
    expect((result.html.match(/tasks-report-macro/g) || [])).toHaveLength(1);
    expect(result.html).toContain('old-only');
    expect(result.html).not.toContain('current-one');
    expect(result.html).not.toContain('current-two');
  });
});
