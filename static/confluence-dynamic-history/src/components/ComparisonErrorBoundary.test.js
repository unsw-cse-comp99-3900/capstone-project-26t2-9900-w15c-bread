import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ComparisonErrorBoundary from './ComparisonErrorBoundary';

function BrokenComparison() {
  throw new Error('renderer failed');
}

test('contains a comparison renderer failure and offers a retry', () => {
  const container = document.createElement('div');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  act(() => {
    ReactDOM.render(
      <ComparisonErrorBoundary resetKey="2:3:inline">
        <BrokenComparison />
      </ComparisonErrorBoundary>,
      container
    );
  });

  expect(container.querySelector('.dh-comparison-error')).not.toBeNull();
  expect(container.textContent).toContain('The comparison could not be displayed.');
  expect(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent === 'Retry comparison')).toBe(true);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  consoleError.mockRestore();
});
