import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import App from './App';
import { mockData } from './mockData';

test('keeps help and Close in the header and view controls in the workspace', () => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<App />);

  const header = container.querySelector('.dh-header');
  const toolbar = container.querySelector('.dh-workspace-toolbar');

  expect(header.textContent).toContain('!');
  expect(header.textContent).toContain('Close');
  expect(header.textContent).not.toContain('Inline');
  expect(toolbar.textContent).toContain('Inline');
  expect(toolbar.textContent).toContain('Side-by-side');
  expect(header.querySelector('[aria-label="Open user guide"]')).not.toBeNull();
});

test('keeps the selected version, recovery choice, and saved comment through the guide lifecycle', () => {
  const originalCommentsByVersion = mockData.commentsByVersion;
  const commentText = 'Persisted review context for v5.';
  mockData.commentsByVersion = {
    ...originalCommentsByVersion,
    5: [{
      id: 'persisted-v5-comment',
      authorName: 'Sample User A',
      body: commentText,
      createdAt: '2026-07-31T00:00:00.000Z',
      includeDiffSummary: true,
    }],
  };

  const container = document.createElement('div');
  document.body.appendChild(container);

  try {
    act(() => {
      ReactDOM.render(<App />, container);
    });

    const versionFiveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim().startsWith('v5'));
    act(() => {
      versionFiveButton.click();
    });

    const sideBySideButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Side-by-side');
    act(() => {
      sideBySideButton.click();
    });
    expect(container.textContent).toContain('Historical / v5');

    const restoreButtons = Array.from(
      container.querySelectorAll('[aria-label="Restore historical content"]')
    );
    expect(restoreButtons).toHaveLength(10);
    act(() => {
      restoreButtons[0].click();
    });
    const recoveryProgress = Array.from(container.querySelectorAll('span'))
      .find((element) => element.textContent === '1 of 10 decided');
    expect(recoveryProgress).toBeDefined();
    expect(recoveryProgress.textContent).toBe('1 of 10 decided');
    expect(restoreButtons[0].getAttribute('aria-pressed')).toBe('true');

    const versionFiveCard = versionFiveButton.closest('li');
    expect(versionFiveCard.textContent).toContain(commentText);
    expect(versionFiveCard.textContent).toContain('Edit comment');

    act(() => {
      container.querySelector('[aria-label="Open user guide"]').click();
    });
    const guideDialog = container.querySelector('[role="dialog"]');
    expect(guideDialog).not.toBeNull();
    expect(guideDialog.querySelector('h2').textContent).toBe('Dynamic History User Guide');

    const chineseButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === '中文');
    act(() => {
      chineseButton.click();
    });
    expect(guideDialog.querySelector('h2').textContent).toBe('Dynamic History 用户指南');

    act(() => {
      container.querySelector('[aria-label="关闭用户指南"]').click();
    });

    const postCloseVersionFiveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim().startsWith('v5'));
    const postCloseVersionFiveCard = postCloseVersionFiveButton.closest('li');
    const postCloseHistoricalHeading = Array.from(container.querySelectorAll('div'))
      .find((element) => element.textContent === 'Historical / v5');
    const postCloseSideBySideButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Side-by-side');
    const postCloseRecoveryProgress = Array.from(container.querySelectorAll('span'))
      .find((element) => element.textContent === '1 of 10 decided');
    const postCloseRestoreButtons = Array.from(
      container.querySelectorAll('[aria-label="Restore historical content"]')
    );
    const postCloseEditCommentButton = Array.from(
      postCloseVersionFiveCard.querySelectorAll('button')
    ).find((button) => button.textContent.trim().endsWith('Edit comment'));

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(postCloseVersionFiveButton).toBeDefined();
    expect(postCloseHistoricalHeading).toBeDefined();
    expect(postCloseSideBySideButton.getAttribute('aria-selected')).toBe('true');
    expect(postCloseRecoveryProgress).toBeDefined();
    expect(postCloseRecoveryProgress.textContent).toBe('1 of 10 decided');
    expect(postCloseRestoreButtons).toHaveLength(10);
    expect(postCloseRestoreButtons[0].getAttribute('aria-pressed')).toBe('true');
    expect(postCloseVersionFiveCard.textContent).toContain(commentText);
    expect(postCloseEditCommentButton).toBeDefined();
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
    mockData.commentsByVersion = originalCommentsByVersion;
  }
});

test('keeps History visible when switching to Side-by-side', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    ReactDOM.render(<App />, container);
  });

  const sideBySideButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'Side-by-side');
  act(() => {
    sideBySideButton.click();
  });

  expect(container.querySelector('.dh-layout').className)
    .not.toContain('dh-layout--history-collapsed');
  const railButton = container.querySelector('.dh-history-rail button');
  expect(railButton.getAttribute('aria-label')).toBe('Hide history');
  expect(container.querySelector('.dh-workspace-toolbar__history')).toBeNull();

  act(() => {
    railButton.click();
  });
  expect(container.querySelector('.dh-layout').className)
    .toContain('dh-layout--history-collapsed');
  expect(container.querySelector('.dh-history-rail button').getAttribute('aria-label'))
    .toBe('Show history');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});
