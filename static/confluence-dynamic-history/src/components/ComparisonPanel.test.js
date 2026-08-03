import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import { buildRichTextDiffHtml } from '../utils';
import { buildRecoveryStorageHtml } from '../recoveryStorage';
import {
  getCellScopedTableDiff,
  tableCellChoiceKey,
} from '../tableCellRecovery';
import ComparisonPanel, {
  buildInteractiveTableCellDiffHtml,
  buildDiffDisplayRows,
  buildDraftDifferenceNotes,
  getChangeChoiceActionConfig,
  getGitHubStyleDiffParts,
  getTableCellPopoverPlacement,
  RecoveryPreviewModal,
} from './ComparisonPanel';

test('uses shared recovery choices and reports workspace actions', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chooseBlock = jest.fn();
  const onSelectableKeysChange = jest.fn();
  const onPreviewActionChange = jest.fn();
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });
  const recoveryChoices = {
    comparisonKey: '2:3',
    blockChoices: new Map(),
    chooseBlock,
    undoChoice: jest.fn(),
  };

  act(() => {
    ReactDOM.render(
      <ComparisonPanel
        pageId="123"
        pageTitle="Page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, '<p>Historical wording</p>')}
        currentVersion={version(3, '<p>Current wording</p>')}
        recoveryChoices={recoveryChoices}
        onSelectableKeysChange={onSelectableKeysChange}
        onPreviewActionChange={onPreviewActionChange}
      />,
      container
    );
  });

  expect(onSelectableKeysChange).toHaveBeenCalledWith(expect.any(Array));
  expect(onPreviewActionChange).toHaveBeenCalledWith(expect.any(Function));
  expect(container.querySelector('.dh-inline-selection-toolbar')).toBeNull();

  act(() => container.querySelector('.dh-choice-diff-module').click());
  const restore = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'Restore old content');
  act(() => restore.click());
  expect(chooseBlock).toHaveBeenCalledWith(expect.any(String), 'old');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test.each([
  ['current', 'Current wording'],
  ['old', 'Historical wording'],
])('renders every resolved Inline row when bulk choice is %s', (choice, expectedText) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const historicalHtml = '<p>Historical wording</p>';
  const currentHtml = '<p>Current wording</p>';
  const diff = buildRichTextDiffHtml(historicalHtml, currentHtml, '', {});
  const display = buildDiffDisplayRows(diff.blocks);
  const blockChoices = new Map(
    display.selectableRows.map((row) => [row.key, choice])
  );
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });

  act(() => {
    ReactDOM.render(
      <ComparisonPanel
        pageId="123"
        pageTitle="Page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, historicalHtml)}
        currentVersion={version(3, currentHtml)}
        recoveryChoices={{
          comparisonKey: '2:3',
          blockChoices,
          chooseBlock: jest.fn(),
          undoChoice: jest.fn(),
        }}
      />,
      container
    );
  });

  expect(container.querySelector('.dh-resolved-change-block__content').textContent)
    .toContain(expectedText);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('renders a resolved blank-line run after a bulk Current choice', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const historicalHtml = '<p>Before</p><p>After</p>';
  const currentHtml = '<p>Before</p><p><br /></p><p>After</p>';
  const diff = buildRichTextDiffHtml(historicalHtml, currentHtml, '', {});
  const display = buildDiffDisplayRows(diff.blocks);
  const blockChoices = new Map(
    display.selectableRows.map((row) => [row.key, 'current'])
  );
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });

  act(() => {
    ReactDOM.render(
      <ComparisonPanel
        pageId="123"
        pageTitle="Page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, historicalHtml)}
        currentVersion={version(3, currentHtml)}
        recoveryChoices={{
          comparisonKey: '2:3',
          blockChoices,
          chooseBlock: jest.fn(),
          undoChoice: jest.fn(),
        }}
      />,
      container
    );
  });

  expect(container.querySelector('.dh-resolved-change-block__content').textContent)
    .toContain('blank line');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('shared recovery preview renders the confirmation surface', () => {
  const html = renderToStaticMarkup(
    <RecoveryPreviewModal
      workflow={{
        draftPreview: {
          selectedVersionNumber: 2,
          currentVersionNumber: 5,
          previewHtml: '<p>Preview</p>',
          storageError: '',
        },
        writeBack: { status: 'idle', error: '', page: null },
        operationIsLoading: false,
        versionDifferenceNotes: null,
        showVersionDifferenceNotes: false,
        closePreview: () => {},
        setShowVersionDifferenceNotes: () => {},
        confirmWriteBack: () => {},
      }}
    />
  );

  expect(html).toContain('Review Draft');
  expect(html).toContain('Publish to Current Page');
});

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
    expect(result.diff.summary).toMatchObject({
      added: 2,
      removed: 1,
      addedBlocks: 1,
      removedBlocks: 0,
      modifiedBlocks: 1,
    });
    expect(
      result.display.selectableRows.map((row) => row.changeKind)
    ).toEqual(['modified', 'added']);
    // Semantic classification is display-only. The recovery engine still
    // receives the safe removed/added Storage representation.
    expect(changes.map((block) => block.type)).toEqual([
      'removed',
      'added',
      'added',
    ]);
  });

  test('recognises a formatting-only replacement as modified content', () => {
    const result = buildDraftDifferenceNotes(
      '<p>Important text</p>',
      '<p><strong>Important text</strong></p>'
    );

    expect(result.diff.blocks.map((block) => block.type)).toEqual([
      'removed',
      'added',
    ]);
    expect(result.diff.summary).toMatchObject({
      addedBlocks: 0,
      removedBlocks: 0,
      modifiedBlocks: 1,
    });
    expect(result.display.selectableRows).toMatchObject([
      { changeKind: 'modified' },
    ]);
  });

  test('keeps independent additions and removals out of the modified count', () => {
    const addition = buildDraftDifferenceNotes(
      '<p>Stable</p>',
      '<p>Stable</p><p>Draft only</p>'
    );
    const removal = buildDraftDifferenceNotes(
      '<p>Stable</p><p>Current only</p>',
      '<p>Stable</p>'
    );

    expect(addition.diff.summary).toMatchObject({
      addedBlocks: 1,
      removedBlocks: 0,
      modifiedBlocks: 0,
    });
    expect(removal.diff.summary).toMatchObject({
      addedBlocks: 0,
      removedBlocks: 1,
      modifiedBlocks: 0,
    });
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

describe('Inline rich-text change highlighting', () => {
  test('separates added words from formatting-only changes in one sentence', () => {
    const diff = buildRichTextDiffHtml(
      '<p>A have do something</p>',
      '<p>A and B do <strong>something</strong></p>',
      '',
      {}
    );
    const display = buildDiffDisplayRows(diff.blocks);
    const parts = getGitHubStyleDiffParts(display.selectableRows[0].blocks);
    const historicalDocument = new DOMParser().parseFromString(
      parts.find((part) => part.type === 'removed').html,
      'text/html'
    );
    const currentDocument = new DOMParser().parseFromString(
      parts.find((part) => part.type === 'added').html,
      'text/html'
    );

    expect(
      Array.from(
        historicalDocument.querySelectorAll('.sbs-inline-change--historical')
      ).map((node) => node.textContent.trim())
    ).toContain('have');
    expect(
      Array.from(
        currentDocument.querySelectorAll('.sbs-inline-change--current')
      ).map((node) => node.textContent.trim())
    ).toEqual(expect.arrayContaining(['and', 'B']));
    expect(
      Array.from(
        historicalDocument.querySelectorAll('.sbs-inline-change--format')
      ).map((node) => node.textContent)
    ).toContain('something');
    expect(
      currentDocument.querySelector(
        'strong > .sbs-inline-change--format'
      ).textContent
    ).toBe('something');
  });

  test('renders the shared highlights in the actual Inline comparison panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const version = (number, value) => ({
      number,
      authorName: 'User',
      createdAt: '2026-07-19T00:00:00.000Z',
      body: { value },
    });

    act(() => {
      ReactDOM.render(
        <ComparisonPanel
          pageId="123"
          pageTitle="Page"
          baseUrl=""
          attachmentsByFilename={{}}
          selectedVersion={version(2, '<p>A have do something</p>')}
          currentVersion={version(
            3,
            '<p>A and B do <strong>something</strong></p>'
          )}
          recoveryChoices={{
            comparisonKey: '2:3',
            blockChoices: new Map(),
            chooseBlock: jest.fn(),
            undoChoice: jest.fn(),
          }}
        />,
        container
      );
    });

    expect(
      Array.from(
        container.querySelectorAll('.sbs-inline-change--format')
      ).map((node) => node.textContent)
    ).toEqual(['something', 'something']);
    expect(
      Array.from(
        container.querySelectorAll(
          '.dh-github-diff-part--added .sbs-inline-change--current'
        )
      ).map((node) => node.textContent.trim())
    ).toEqual(expect.arrayContaining(['and', 'B']));

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
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

describe('Draft Preview ordered-list break recovery', () => {
  const oldStorage = [
    '<ol><li>One</li></ol>',
    '<p><br /></p>',
    '<ol start="2"><li>Two</li></ol>',
    '<p><br /></p>',
    '<ol start="3"><li>Three</li></ol>',
  ].join('');
  const currentStorage = '<ol><li>One</li><li>Two</li><li>Three</li></ol>';

  test('keeps the list-break change atomic and reconstructs either side exactly', () => {
    const diff = buildRichTextDiffHtml(oldStorage, currentStorage, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const row = display.selectableRows[0];
    const keptCurrent = buildRecoveryStorageHtml(
      diff.blocks,
      new Map(),
      display.blockChoiceKeys
    );
    const restoredOld = buildRecoveryStorageHtml(
      diff.blocks,
      new Map([[row.key, 'old']]),
      display.blockChoiceKeys
    );

    expect(display.selectableRows).toHaveLength(1);
    expect(row.blocks).toHaveLength(1);
    expect(row.blocks[0].block.nodeType).toBe('list_break_change');
    const parts = getGitHubStyleDiffParts(row.blocks);
    expect(parts.map((part) => part.type)).toEqual(['context', 'removed']);
    expect(parts[0].html).toContain('<li>One</li>');
    expect(parts[0].html).toContain('<li>Three</li>');
    expect(parts[1].html).toContain('2 blank lines removed');
    expect(keptCurrent).toMatchObject({ error: '', html: currentStorage });
    expect(restoredOld).toMatchObject({ error: '', html: oldStorage });
  });
});

describe('large table write-back controls', () => {
  test('keeps net-zero column structure changes on whole-table recovery', () => {
    const historicalTable = [
      '<table><tbody>',
      '<tr><td>Dimension</td><td>Assessment</td><td>test</td><td></td><td>Evidence</td><td>Status</td></tr>',
      '<tr><td>Functional</td><td>Ready</td><td></td><td></td><td>Regression</td><td>PASS</td></tr>',
      '<tr><td>Reliability</td><td>Stable</td><td></td><td></td><td>Soak</td><td>PASS</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentTable = [
      '<table><tbody>',
      '<tr><td>Dimension</td><td>Assessment</td><td>test</td><td>Evidence</td><td>Status</td><td></td></tr>',
      '<tr><td>Functional</td><td>Ready</td><td></td><td>Regression</td><td>PASS</td><td></td></tr>',
      '<tr><td>Reliability</td><td>Stable</td><td></td><td>Soak</td><td>PASS</td><td></td></tr>',
      '</tbody></table>',
    ].join('');
    const diff = buildRichTextDiffHtml(historicalTable, currentTable, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const row = display.selectableRows[0];
    const parts = getGitHubStyleDiffParts(row.blocks);

    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('table-structure-display');
    expect(getCellScopedTableDiff(row.blocks)).toBeNull();
    expect(diff.blocks[0].tableDiff.structureChange).toBe(
      'net_zero_structure'
    );
  });

  test('uses a read-only structure display while retaining whole-table actions', () => {
    const historicalTable = [
      '<table><tbody>',
      '<tr><td>H1</td><td>H2</td><td>H3</td></tr>',
      '<tr><td>A1</td><td>A2</td><td>A3</td></tr>',
      '<tr><td>C1</td><td>C2</td><td>C3</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentTable = [
      '<table><tbody>',
      '<tr><td>H1</td><td>XH</td><td>H2</td><td>H3</td></tr>',
      '<tr><td>A1</td><td>AX</td><td>A2</td><td>A3</td></tr>',
      '<tr><td>B1</td><td>BX</td><td>B2</td><td>B3</td></tr>',
      '<tr><td>C1</td><td>CX</td><td>C2</td><td>C3</td></tr>',
      '</tbody></table>',
    ].join('');
    const diff = buildRichTextDiffHtml(
      historicalTable,
      currentTable,
      '',
      {}
    );
    const display = buildDiffDisplayRows(diff.blocks);
    const parts = getGitHubStyleDiffParts(display.selectableRows[0].blocks);
    const config = getChangeChoiceActionConfig(parts, true, false, false);

    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('table-structure-display');
    expect((parts[0].html.match(/<table\b/g) || [])).toHaveLength(1);
    expect(parts[0].html).toContain('dh-table-structure-diff--added');
    expect(config).toEqual({
      position: 'after',
      visible: true,
      currentLabel: 'Keep current change',
      oldLabel: 'Restore old content',
    });
  });

  test('renders two changed cells inside one Inline comparison table', () => {
    const diff = buildRichTextDiffHtml(
      '<table><tbody><tr><td>A</td><td>Old one</td></tr><tr><td>B</td><td>Old two</td></tr></tbody></table>',
      '<table><tbody><tr><td>A</td><td>New one</td></tr><tr><td>B</td><td>New two</td></tr></tbody></table>',
      '',
      {}
    );
    const display = buildDiffDisplayRows(diff.blocks);
    const parts = getGitHubStyleDiffParts(display.selectableRows[0].blocks);
    const doc = new DOMParser().parseFromString(parts[0].html, 'text/html');

    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('table-cell-level');
    expect(doc.querySelectorAll('table')).toHaveLength(1);
    expect(doc.querySelectorAll('.dh-table-cell-diff--modified')).toHaveLength(2);
    expect(doc.querySelectorAll('td')).toHaveLength(4);
  });

  test('separates formatting changes from added text inside an Inline table cell', () => {
    const diff = buildRichTextDiffHtml(
      '<table><tbody><tr><td>Data safety</td></tr></tbody></table>',
      '<table><tbody><tr><td><strong>Data safety</strong> - and test</td></tr></tbody></table>',
      '',
      {}
    );
    const display = buildDiffDisplayRows(diff.blocks);
    const parts = getGitHubStyleDiffParts(display.selectableRows[0].blocks);
    const doc = new DOMParser().parseFromString(parts[0].html, 'text/html');
    const previousCellValue = doc.querySelector(
      '.dh-table-cell-version--previous .dh-table-cell-version__value'
    );
    const currentCellValue = doc.querySelector(
      '.dh-table-cell-version--current .dh-table-cell-version__value'
    );

    expect(previousCellValue.querySelector(
      '.sbs-inline-change--format'
    ).textContent).toBe('Data safety');
    expect(currentCellValue.querySelector(
      'strong > .sbs-inline-change--format'
    ).textContent).toBe('Data safety');
    expect(
      Array.from(
        currentCellValue.querySelectorAll('.sbs-inline-change--current')
      ).map((node) => node.textContent).join('').replace(/\s+/g, ' ').trim()
    ).toBe('- and test');
    expect(
      previousCellValue.querySelector('.sbs-inline-change--historical')
    ).toBeNull();
  });

  test('keeps whole-table recovery controls visible above a cell-level diff', () => {
    const config = getChangeChoiceActionConfig(
      [{ type: 'table-cell-level', html: '<table></table>' }],
      false
    );

    expect(config).toEqual({
      position: 'before',
      visible: true,
      currentLabel: 'Keep current table',
      oldLabel: 'Restore old table',
    });
  });

  test('keeps same-structure table controls hidden until a changed cell is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chooseBlock = jest.fn();
    const onSelectableKeysChange = jest.fn();
    const version = (number, value) => ({
      number,
      authorName: 'User',
      createdAt: '2026-07-19T00:00:00.000Z',
      body: { value },
    });
    const oldTable = [
      '<table><tbody>',
      '<tr><td>Old A</td><td>Stable</td></tr>',
      '<tr><td>Old B</td><td>Stable</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentTable = [
      '<table><tbody>',
      '<tr><td>New A</td><td>Stable</td></tr>',
      '<tr><td>New B</td><td>Stable</td></tr>',
      '</tbody></table>',
    ].join('');

    act(() => {
      ReactDOM.render(
        <ComparisonPanel
          pageId="123"
          pageTitle="Page"
          baseUrl=""
          attachmentsByFilename={{}}
          selectedVersion={version(2, oldTable)}
          currentVersion={version(3, currentTable)}
          recoveryChoices={{
            comparisonKey: '2:3',
            blockChoices: new Map(),
            chooseBlock,
            undoChoice: jest.fn(),
          }}
          onSelectableKeysChange={onSelectableKeysChange}
        />,
        container
      );
    });

    expect(
      Array.from(container.querySelectorAll('button')).filter(
        (button) => button.textContent === 'Keep current change'
      )
    ).toHaveLength(0);
    expect(onSelectableKeysChange).toHaveBeenLastCalledWith([
      expect.stringContaining('::table-cell::0:0'),
      expect.stringContaining('::table-cell::1:0'),
    ]);

    const changedCells = container.querySelectorAll(
      '[data-dh-table-cell-choice-key]'
    );
    expect(changedCells).toHaveLength(2);

    act(() => changedCells[0].click());
    expect(
      container.querySelectorAll('.dh-table-cell-choice__actions')
    ).toHaveLength(1);
    expect(
      container
        .querySelectorAll('[data-dh-table-cell-choice-key]')[0]
        .querySelector('.dh-table-cell-choice__actions')
    ).not.toBeNull();

    act(() =>
      container.querySelectorAll('[data-dh-table-cell-choice-key]')[1].click()
    );
    const activeActions = container.querySelector(
      '.dh-table-cell-choice__actions'
    );
    expect(activeActions.closest('[data-dh-table-cell-choice-key]')).toBe(
      container.querySelectorAll('[data-dh-table-cell-choice-key]')[1]
    );

    const restore = Array.from(activeActions.querySelectorAll('button')).find(
      (button) => button.textContent === 'Restore old content'
    );
    act(() => restore.click());
    expect(chooseBlock).toHaveBeenCalledWith(
      expect.stringContaining('::table-cell::1:0'),
      'old'
    );

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  });

  test('suppresses whole-table actions only for same-structure table changes', () => {
    expect(
      getChangeChoiceActionConfig(
        [{ type: 'table-cell-level', html: '<table></table>' }],
        false,
        true
      )
    ).toEqual({
      position: 'after',
      visible: false,
      currentLabel: 'Keep current change',
      oldLabel: 'Restore old content',
    });
  });

  test('keeps terminal row and column table actions collapsed below the block', () => {
    expect(
      getChangeChoiceActionConfig(
        [{ type: 'table-cell-level', html: '<table></table>' }],
        false,
        false,
        true
      )
    ).toEqual({
      position: 'after',
      visible: false,
      currentLabel: 'Keep current change',
      oldLabel: 'Restore old content',
    });
    expect(
      getChangeChoiceActionConfig(
        [{ type: 'table-cell-level', html: '<table></table>' }],
        true,
        false,
        true
      )
    ).toMatchObject({
      position: 'after',
      visible: true,
      currentLabel: 'Keep current change',
      oldLabel: 'Restore old content',
    });
  });

  test('opens terminal-row recovery actions at the bottom only after the table block is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const oldTable = [
      '<table><tbody>',
      '<tr><td>Stable field</td><td>Stable value</td></tr>',
      '<tr><td>Removed field</td><td>Removed value</td></tr>',
      '</tbody></table>',
    ].join('');
    const currentTable =
      '<table><tbody><tr><td>Stable field</td><td>Stable value</td></tr></tbody></table>';
    const version = (number, value) => ({
      number,
      authorName: 'User',
      createdAt: '2026-07-19T00:00:00.000Z',
      body: { value },
    });

    act(() => {
      ReactDOM.render(
        <ComparisonPanel
          pageId="123"
          pageTitle="Page"
          baseUrl=""
          attachmentsByFilename={{}}
          selectedVersion={version(2, oldTable)}
          currentVersion={version(3, currentTable)}
          recoveryChoices={{
            comparisonKey: '2:3',
            blockChoices: new Map(),
            chooseBlock: jest.fn(),
            undoChoice: jest.fn(),
          }}
        />,
        container
      );
    });

    const module = container.querySelector('.dh-choice-diff-module');
    expect(module).not.toBeNull();
    expect(module.querySelector('.dh-choice-diff-module__actions')).toBeNull();
    expect(container.textContent).not.toContain('Keep current table');

    act(() => module.click());
    const actions = module.querySelector(
      '.dh-choice-diff-module__actions--after'
    );
    expect(actions).not.toBeNull();
    expect(actions).toBe(module.lastElementChild);
    expect(
      Array.from(actions.querySelectorAll('button')).map(
        (button) => button.textContent
      )
    ).toEqual(['Keep current change', 'Restore old content']);

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  });

  test('places a cell action popover toward available space without widening the table', () => {
    const surface = { top: 0, right: 1000, bottom: 600, left: 0 };

    expect(
      getTableCellPopoverPlacement(
        { top: 100, right: 980, bottom: 140, left: 900 },
        surface,
        700
      )
    ).toMatchObject({
      horizontal: 'leftward',
      vertical: 'below',
      stacked: false,
    });
    expect(
      getTableCellPopoverPlacement(
        { top: 100, right: 80, bottom: 140, left: 20 },
        surface,
        700
      )
    ).toMatchObject({
      horizontal: 'rightward',
      vertical: 'below',
      stacked: false,
    });
    expect(
      getTableCellPopoverPlacement(
        { top: 540, right: 130, bottom: 590, left: 110 },
        { top: 0, right: 240, bottom: 600, left: 0 },
        600
      )
    ).toEqual({
      horizontal: 'rightward',
      vertical: 'above',
      stacked: true,
    });
  });

  test('renders a resolved cell with only Undo and keeps its full-cell background', () => {
    const oldTable =
      '<table><tbody><tr><td data-highlight-colour="#deebff"><strong>Old value</strong></td></tr></tbody></table>';
    const currentTable =
      '<table><tbody><tr><td data-highlight-colour="#ffebe6"><strong>New value</strong></td></tr></tbody></table>';
    const diff = buildRichTextDiffHtml(oldTable, currentTable, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const row = display.selectableRows[0];
    const parts = getGitHubStyleDiffParts(row.blocks);
    const tableDiff = row.blocks[0].block.tableDiff;
    const choiceKey = tableCellChoiceKey(row.key, 0, 0);
    const html = buildInteractiveTableCellDiffHtml({
      html: parts[0].html,
      tableDiff,
      tableChoiceKey: row.key,
      blockChoices: new Map([[choiceKey, 'old']]),
      // Even a stale active key must not reopen actions for a resolved cell.
      activeCellKey: choiceKey,
      popoverPlacement: null,
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cell = doc.querySelector('[data-dh-table-cell-choice-key]');

    expect(cell.getAttribute('data-dh-table-cell-resolved')).toBe('true');
    expect(cell.hasAttribute('tabindex')).toBe(false);
    expect(cell.getAttribute('data-dh-bg-color')).toBe('#deebff');
    expect(cell.textContent.trim()).toBe('Old valueUndo');
    expect(cell.textContent).not.toContain('Old content restored');
    expect(cell.querySelector('.dh-table-cell-choice__actions')).toBeNull();
    expect(cell.querySelector('.sbs-inline-change')).toBeNull();
    expect(
      cell.querySelector('.dh-table-cell-version--selected strong').textContent
    ).toBe('Old value');
    expect(
      cell.querySelector('.dh-table-cell-version--selected')
        .hasAttribute('data-dh-bg-color')
    ).toBe(false);
  });

  test('does not reopen choice actions when a resolved cell is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const oldTable =
      '<table><tbody><tr><td>Value before change</td></tr></tbody></table>';
    const currentTable =
      '<table><tbody><tr><td>Value after change</td></tr></tbody></table>';
    const diff = buildRichTextDiffHtml(oldTable, currentTable, '', {});
    const display = buildDiffDisplayRows(diff.blocks);
    const row = display.selectableRows[0];
    const choiceKey = tableCellChoiceKey(row.key, 0, 0);
    const undoChoice = jest.fn();
    const version = (number, value) => ({
      number,
      authorName: 'User',
      createdAt: '2026-07-19T00:00:00.000Z',
      body: { value },
    });

    act(() => {
      ReactDOM.render(
        <ComparisonPanel
          pageId="123"
          pageTitle="Page"
          baseUrl=""
          attachmentsByFilename={{}}
          selectedVersion={version(2, oldTable)}
          currentVersion={version(3, currentTable)}
          recoveryChoices={{
            comparisonKey: '2:3',
            blockChoices: new Map([[choiceKey, 'current']]),
            chooseBlock: jest.fn(),
            undoChoice,
          }}
        />,
        container
      );
    });

    const cell = container.querySelector('[data-dh-table-cell-resolved="true"]');
    expect(cell).not.toBeNull();
    act(() => cell.click());
    expect(container.querySelector('.dh-table-cell-choice__actions')).toBeNull();
    expect(
      Array.from(cell.querySelectorAll('button')).map(
        (button) => button.textContent
      )
    ).toEqual(['Undo']);

    act(() => cell.querySelector('button').click());
    expect(undoChoice).toHaveBeenCalledWith(choiceKey);

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  });

  test('keeps ordinary change controls collapsed until the row is active', () => {
    expect(getChangeChoiceActionConfig([{ type: 'removed', html: '<p>Old</p>' }], false))
      .toMatchObject({ position: 'after', visible: false });
  });
});
