import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import path from 'path';
import SideBySideDiffView, {
  clampSplitPercent,
  getSideBySideBodyState,
} from './SideBySideDiffView';

test('clamps the shared document split to readable limits', () => {
  expect(clampSplitPercent(10)).toBe(30);
  expect(clampSplitPercent(52)).toBe(52);
  expect(clampSplitPercent(90)).toBe(70);
});

test('renders the full comparison without duplicating workspace controls', () => {
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });
  const html = renderToStaticMarkup(
    <SideBySideDiffView
      pageId="123"
      pageTitle="Page"
      baseUrl=""
      attachmentsByFilename={{}}
      selectedVersion={version(2, '<p>Old text</p>')}
      currentVersion={version(3, '<p>Current text</p>')}
    />
  );

  expect(html).not.toContain('Preview Draft');
  expect(html).not.toContain('sbs-toggle');
  expect(html).toContain('Historical / v2');
  expect(html).toContain('Current / v3');
  expect(html).toContain('Keep current content');
  expect(html).toContain('Restore historical content');
  expect(html).toContain('title="Use Historical in Draft"');
  expect(html).toContain('title="Use Current in Draft"');
  expect(html).toContain('sbs-pane--deleted');
  expect(html).toContain('sbs-pane--added');
});

test('uses the shared choice interface and reports workspace actions', () => {
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

  act(() => {
    ReactDOM.render(
      <SideBySideDiffView
        pageId="123"
        pageTitle="Page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, '<p>Old text</p>')}
        currentVersion={version(3, '<p>Current text</p>')}
        recoveryChoices={{
          comparisonKey: '2:3',
          blockChoices: new Map(),
          chooseBlock,
          undoChoice: jest.fn(),
        }}
        onSelectableKeysChange={onSelectableKeysChange}
        onPreviewActionChange={onPreviewActionChange}
      />,
      container
    );
  });

  expect(onSelectableKeysChange).toHaveBeenCalledWith(expect.any(Array));
  expect(onPreviewActionChange).toHaveBeenCalledWith(expect.any(Function));
  act(() => {
    container.querySelector('[aria-label="Restore historical content"]').click();
  });
  expect(chooseBlock).toHaveBeenCalledWith(expect.any(String), 'old');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('renders unchanged context in both complete document panes', () => {
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });
  const html = renderToStaticMarkup(
    <SideBySideDiffView
      pageId="123"
      pageTitle="Page"
      baseUrl=""
      attachmentsByFilename={{}}
      selectedVersion={version(2, '<h1>Stable title</h1><p>Old text</p><p>Stable ending</p>')}
      currentVersion={version(3, '<h1>Stable title</h1><p>Current text</p><p>Stable ending</p>')}
      activeView="side-by-side"
      onViewChange={() => {}}
    />
  );

  expect((html.match(/data-split-row-kind="unchanged"/g) || []).length).toBeGreaterThan(0);
  expect((html.match(/Stable title/g) || [])).toHaveLength(2);
  expect((html.match(/Stable ending/g) || [])).toHaveLength(2);
  expect(html).toContain('data-split-side="historical"');
  expect(html).toContain('data-split-side="current"');
});

test('distinguishes renderer errors and limited current previews from an empty diff', () => {
  expect(getSideBySideBodyState({ error: 'bad storage' }, [])).toBe('error');
  expect(getSideBySideBodyState({ limited: true }, [])).toBe('limited');
  expect(getSideBySideBodyState({ limited: false }, [])).toBe('empty');
  expect(getSideBySideBodyState({}, [{ kind: 'modified' }])).toBe('rows');
});

test('narrow-screen styles keep both comparison panes visible', () => {
  const css = fs.readFileSync(path.join(__dirname, 'SideBySideDiffView.css'), 'utf8');

  expect(css).toMatch(/\.sbs-document-canvas\s*\{[\s\S]*min-width:\s*1040px/);
  expect(css).toMatch(/\.sbs-document-scroll\s*\{[\s\S]*overflow-x:\s*auto/);
  expect(css).toMatch(
    /\.sbs-row\s*\{[\s\S]*grid-template-columns:[^;]*minmax\(460px,[^;]*44px[^;]*minmax\(460px,[^;]*;/
  );
  expect(css).not.toMatch(/@media[\s\S]*\.sbs-row\s*\{[\s\S]*flex-direction:\s*column/);
});

test('exposes an accessible keyboard-adjustable document separator', () => {
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
      <SideBySideDiffView
        pageId="123"
        pageTitle="Page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, '<p>Old text</p>')}
        currentVersion={version(3, '<p>Current text</p>')}
      />,
      container
    );
  });

  const separator = container.querySelector('[role="separator"]');
  expect(separator.getAttribute('aria-valuenow')).toBe('50');
  act(() => {
    separator.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    }));
  });
  expect(container.querySelector('[role="separator"]').getAttribute('aria-valuenow')).toBe('55');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('applies Restore to the draft preview, reports the summary, and resets on version change', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onDiffSummaryChange = jest.fn();
  let previewAction = null;
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });
  const currentVersion = version(3, '<p>Current text</p>');
  const renderView = (selectedVersion) => {
    act(() => {
      ReactDOM.render(
        <SideBySideDiffView
          pageId="123"
          pageTitle="Page"
          baseUrl=""
          attachmentsByFilename={{}}
          selectedVersion={selectedVersion}
          currentVersion={currentVersion}
          onDiffSummaryChange={onDiffSummaryChange}
          onPreviewActionChange={(action) => {
            previewAction = action;
          }}
        />,
        container
      );
    });
  };

  renderView(version(2, '<p>Old text</p>'));
  const restoreButton = container.querySelector('[aria-label="Restore historical content"]');
  expect(restoreButton).not.toBeNull();

  act(() => {
    restoreButton.click();
  });
  expect(
    container.querySelector('[aria-label="Restore historical content"]').className
  ).toContain('sbs-merge-arrow--active');

  act(() => {
    previewAction();
  });
  expect(container.querySelector('.dh-rich-page--preview').textContent).toContain('Old text');
  expect(onDiffSummaryChange).toHaveBeenCalledWith(
    2,
    expect.objectContaining({ modifiedBlocks: 1 })
  );

  act(() => {
    container.querySelector('[aria-label="Close draft preview"]').click();
  });
  const keepButton = container.querySelector('[aria-label="Keep current content"]');
  act(() => {
    keepButton.click();
  });
  expect(
    container.querySelector('[aria-label="Keep current content"]').className
  ).toContain('sbs-merge-arrow--active');
  act(() => {
    previewAction();
  });
  expect(container.querySelector('.dh-rich-page--preview').textContent).toContain('Current text');

  renderView(version(1, '<p>Earlier text</p>'));
  expect(container.querySelector('.dh-draft-modal')).toBeNull();
  expect(container.querySelector('.sbs-merge-arrow--active')).toBeNull();

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('restores historical layout widths through the shared preview workflow', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const oldStorage = [
    '<ac:layout><ac:layout-section ac:type="two_equal">',
    '<ac:layout-cell data-width="50"><p>Left</p></ac:layout-cell>',
    '<ac:layout-cell data-width="50"><p>Right</p></ac:layout-cell>',
    '</ac:layout-section></ac:layout>',
  ].join('');
  const currentStorage = [
    '<ac:layout><ac:layout-section ac:type="two_equal">',
    '<ac:layout-cell data-width="35"><p>Left</p></ac:layout-cell>',
    '<ac:layout-cell data-width="65"><p>Right</p></ac:layout-cell>',
    '</ac:layout-section></ac:layout>',
  ].join('');
  const version = (number, value) => ({
    number,
    authorName: 'User',
    createdAt: '2026-07-19T00:00:00.000Z',
    body: { value },
  });
  let previewAction = null;

  act(() => {
    ReactDOM.render(
      <SideBySideDiffView
        pageId="123"
        pageTitle="Layout page"
        baseUrl=""
        attachmentsByFilename={{}}
        selectedVersion={version(2, oldStorage)}
        currentVersion={version(3, currentStorage)}
        onPreviewActionChange={(action) => {
          previewAction = action;
        }}
      />,
      container
    );
  });

  expect(container.textContent).toContain('Old widths');
  expect(container.textContent).toContain('Current widths');
  act(() => {
    container.querySelector('[aria-label="Restore historical content"]').click();
  });
  act(() => {
    previewAction();
  });
  const preview = container.querySelector('.dh-rich-page--preview');
  expect(preview.querySelectorAll('[data-dh-layout-width="50"]')).toHaveLength(2);
  expect(preview.querySelector('[data-dh-layout-width="35"]')).toBeNull();

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});
