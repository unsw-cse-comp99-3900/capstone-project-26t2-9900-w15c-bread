import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import VersionCard from './VersionCard';

function renderVersionCard(overrides = {}) {
  const container = document.createElement('div');
  const props = {
    version: {
      number: 2,
      authorName: 'Example User',
      createdAt: '2026-07-15T00:00:00.000Z',
      message: '',
      minorEdit: false,
    },
    isLatest: false,
    isSelected: false,
    comments: [],
    onSelect: () => {},
    onAddComment: () => {},
    ...overrides,
  };

  act(() => {
    ReactDOM.render(<VersionCard {...props} />, container);
  });

  return container;
}

describe('VersionCard comments and edit summary', () => {
  test('does not render a placeholder when the edit summary is empty', () => {
    const container = renderVersionCard();

    expect(container.textContent).not.toContain('No edit summary');
    expect(container.textContent).toContain('Add comment');

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
  });

  test('shows the single existing comment as editable', () => {
    const container = renderVersionCard({
      comments: [
        {
          id: 'comment-1',
          body: 'Only version comment',
          authorName: 'Comment Author',
        },
      ],
    });

    expect(container.textContent).toContain('Comment Author: Only version comment');
    expect(container.textContent).toContain('Edit comment');
    expect(container.textContent).not.toContain('Add comment');

    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
  });
});
