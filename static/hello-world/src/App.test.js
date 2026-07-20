import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import App from './App';

test('keeps view controls in the comparison workspace and Close alone in the header', () => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<App />);

  const header = container.querySelector('.dh-header');
  const toolbar = container.querySelector('.dh-workspace-toolbar');

  expect(header.textContent).toContain('Close');
  expect(header.textContent).not.toContain('Inline');
  expect(header.textContent).not.toContain('Side-by-side');
  expect(toolbar.textContent).toContain('Inline');
  expect(toolbar.textContent).toContain('Side-by-side');
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
