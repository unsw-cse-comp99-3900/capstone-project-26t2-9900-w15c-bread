import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ComparisonWorkspaceToolbar from './ComparisonWorkspaceToolbar';

test('renders view, bulk recovery, progress, and review controls', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onViewChange = jest.fn();
  const onChooseAll = jest.fn();
  const onResetChoices = jest.fn();
  const onPreviewDraft = jest.fn();

  act(() => {
    ReactDOM.render(
      <ComparisonWorkspaceToolbar
        activeView="inline"
        blockChoices={new Map([['a', 'old']])}
        onChooseAll={onChooseAll}
        onPreviewDraft={onPreviewDraft}
        onResetChoices={onResetChoices}
        onViewChange={onViewChange}
        selectableKeys={['a', 'b']}
      />,
      container
    );
  });

  const button = (label) => Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === label);

  expect(button('Inline').getAttribute('aria-selected')).toBe('true');
  expect(button('Side-by-side')).not.toBeNull();
  expect(button('Use Current for All')).toBeUndefined();
  expect(button('Restore Historical for All')).not.toBeNull();
  expect(button('Reset choices')).not.toBeNull();
  expect(button('Reset choices').title)
    .toBe('Clear all decisions and return every change to undecided.');
  expect(button('Review & Publish')).not.toBeNull();
  expect(button('Hide history')).toBeUndefined();
  expect(container.textContent).toContain('1 of 2 decided');

  act(() => button('Side-by-side').click());
  act(() => button('Restore Historical for All').click());
  act(() => button('Reset choices').click());
  act(() => button('Review & Publish').click());

  expect(onViewChange).toHaveBeenCalledWith('side-by-side');
  expect(onChooseAll).toHaveBeenCalledWith('old');
  expect(onResetChoices).toHaveBeenCalledTimes(1);
  expect(onPreviewDraft).toHaveBeenCalledTimes(1);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('disables recovery actions when there are no selectable changes', () => {
  const container = document.createElement('div');
  act(() => {
    ReactDOM.render(
      <ComparisonWorkspaceToolbar
        activeView="side-by-side"
        blockChoices={new Map()}
        onChooseAll={() => {}}
        onPreviewDraft={null}
        onResetChoices={() => {}}
        onViewChange={() => {}}
        selectableKeys={[]}
      />,
      container
    );
  });

  const recoveryButtons = Array.from(container.querySelectorAll(
    '.dh-workspace-toolbar__recovery button'
  ));
  expect(recoveryButtons).toHaveLength(3);
  expect(recoveryButtons.every((button) => button.disabled)).toBe(true);
  expect(container.textContent).toContain('0 of 0 decided');
  expect(container.textContent).not.toContain('history');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
});
