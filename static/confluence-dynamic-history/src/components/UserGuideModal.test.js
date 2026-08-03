import {
  DEFAULT_GUIDE_LANGUAGE,
  GUIDE_LANGUAGES,
  USER_GUIDE_COPY,
  guideImageUrl,
} from './userGuideContent';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import UserGuideModal from './UserGuideModal';

function ClosableGuideHarness() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button id="stateful-guide-opener" onClick={() => setOpen(true)} type="button">
        Open guide
      </button>
      <UserGuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

test('keeps English and Chinese guide structures aligned', () => {
  expect(DEFAULT_GUIDE_LANGUAGE).toBe('en');
  expect(GUIDE_LANGUAGES).toEqual([
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
  ]);
  expect(USER_GUIDE_COPY.en.sections.map(({ id }) => id)).toEqual(
    USER_GUIDE_COPY.zh.sections.map(({ id }) => id)
  );
  expect(USER_GUIDE_COPY.en.sections.map(({ id }) => id)).toEqual([
    'open',
    'select',
    'views',
    'differences',
    'choose',
    'review',
    'publish',
    'comments',
    'troubleshooting',
  ]);
  USER_GUIDE_COPY.en.sections.forEach((section, index) => {
    expect(section.blocks.map(({ type }) => type)).toEqual(
      USER_GUIDE_COPY.zh.sections[index].blocks.map(({ type }) => type)
    );
  });
});

test('preserves approved lead-ins and narrative block order', () => {
  const section = (language, id) => USER_GUIDE_COPY[language].sections
    .find((candidate) => candidate.id === id);

  const select = section('en', 'select');
  expect(select.blocks.map(({ type }) => type)).toEqual([
    'paragraph',
    'paragraph',
    'list',
    'paragraph',
  ]);
  expect(select.blocks[1].text).toBe('Each version card can show:');
  expect(select.blocks[2].items[0]).toBe('the version number;');

  const choose = section('en', 'choose');
  expect(choose.blocks[0].text)
    .toBe('For each changed item, choose one of the available actions:');
  expect(choose.blocks[1].type).toBe('list');

  const comments = section('en', 'comments');
  expect(comments.blocks[1].text).toBe('In the comment window you can:');
  expect(comments.blocks[2].type).toBe('list');

  expect(section('en', 'troubleshooting').blocks[0].items).toContain(
    'Content cannot be rendered safely: do not publish from that comparison. '
      + 'Return to the page and ask the app administrator or project team for help.'
  );
});

test('uses only bundled anonymized tutorial images', () => {
  const imagesFor = (language) => USER_GUIDE_COPY[language].sections
    .flatMap((section) => section.blocks)
    .filter(({ type }) => type === 'image')
    .map(({ filename }) => filename);
  const images = imagesFor('en');

  expect(images).toEqual([
    '01-overview-current.png',
    '02-inline-comparison.png',
    '03-inline-choice-actions.png',
    '05-side-by-side-selection.png',
    '06-review-draft.png',
    '07-version-difference-notes.png',
    '08-version-comment.png',
  ]);
  expect(imagesFor('zh')).toEqual(images);
  expect(guideImageUrl(images[0])).toBe('/user-guide/01-overview-current.png');
});

test('renders each section block in its approved sequence', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    ReactDOM.render(<UserGuideModal open onClose={() => {}} />, container);
  });

  const childTags = (id) => Array.from(container.querySelector(`#dh-guide-${id}`).children)
    .map(({ tagName }) => tagName);
  expect(childTags('select')).toEqual(['H3', 'P', 'P', 'UL', 'P']);
  expect(childTags('choose')).toEqual([
    'H3', 'P', 'UL', 'P', 'P', 'UL', 'P', 'FIGURE', 'FIGURE',
  ]);
  expect(childTags('comments')).toEqual(['H3', 'P', 'P', 'UL', 'P', 'FIGURE']);
  expect(Array.from(container.querySelectorAll('.dh-user-guide__image'))
    .every((image) => image.getAttribute('loading') === 'lazy')).toBe(true);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('opens in English and switches to Chinese without closing', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();

  act(() => {
    ReactDOM.render(<UserGuideModal open onClose={onClose} />, container);
  });

  expect(container.querySelector('[role="dialog"]').textContent)
    .toContain('Dynamic History User Guide');
  expect(container.querySelector('[role="dialog"]').getAttribute('aria-describedby'))
    .toBe('dh-user-guide-intro');
  expect(container.querySelector('#dh-user-guide-intro').textContent)
    .toContain('Review earlier versions');
  expect(container.querySelectorAll('.dh-user-guide__image')).toHaveLength(7);

  const chineseButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === '中文');
  act(() => chineseButton.click());

  expect(container.querySelector('[role="dialog"]').textContent)
    .toContain('Dynamic History 用户指南');
  expect(onClose).not.toHaveBeenCalled();

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('reopens in English after switching to Chinese', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();

  act(() => {
    ReactDOM.render(<UserGuideModal open onClose={onClose} />, container);
  });
  const chineseButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === '中文');
  act(() => {
    chineseButton.click();
  });

  act(() => {
    ReactDOM.render(<UserGuideModal open={false} onClose={onClose} />, container);
  });
  act(() => {
    ReactDOM.render(<UserGuideModal open onClose={onClose} />, container);
  });

  const englishButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === 'English');
  expect(container.querySelector('[role="dialog"]').textContent)
    .toContain('Dynamic History User Guide');
  expect(englishButton.getAttribute('aria-pressed')).toBe('true');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test.each([
  ['close button', (container) => {
    container.querySelector('[aria-label="Close user guide"]').click();
  }],
  ['backdrop mousedown', (container) => {
    container.querySelector('.dh-user-guide-backdrop').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
  }],
  ['Escape', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }],
])('restores focus to the opener after %s closes the modal', (_path, closeModal) => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    ReactDOM.render(<ClosableGuideHarness />, container);
  });
  const opener = container.querySelector('#stateful-guide-opener');
  opener.focus();

  act(() => {
    opener.click();
  });
  expect(document.activeElement)
    .toBe(container.querySelector('[aria-label="Close user guide"]'));

  act(() => {
    closeModal(container);
  });
  expect(container.querySelector('[role="dialog"]')).toBe(null);
  expect(document.activeElement).toBe(opener);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('does not render when closed or close when interacting inside the panel', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();

  act(() => {
    ReactDOM.render(<UserGuideModal open={false} onClose={onClose} />, container);
  });
  expect(container.childElementCount).toBe(0);

  act(() => {
    ReactDOM.render(<UserGuideModal open onClose={onClose} />, container);
  });
  const dialog = container.querySelector('[role="dialog"]');
  act(() => {
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(onClose).not.toHaveBeenCalled();

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('moves focus into the dialog, traps Tab, and restores the opener on close', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();
  const renderGuide = (open) => {
    ReactDOM.render(
      <>
        <button id="guide-opener" type="button">Open guide</button>
        <UserGuideModal open={open} onClose={onClose} />
      </>,
      container
    );
  };

  act(() => {
    renderGuide(false);
  });
  const opener = container.querySelector('#guide-opener');
  opener.focus();

  act(() => {
    renderGuide(true);
  });
  const closeButton = container.querySelector('[aria-label="Close user guide"]');
  const firstButton = container.querySelector('.dh-user-guide__languages button');
  expect(document.activeElement).toBe(closeButton);

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
  });
  expect(document.activeElement).toBe(firstButton);

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
  });
  expect(document.activeElement).toBe(closeButton);

  act(() => {
    renderGuide(false);
  });
  expect(document.activeElement).toBe(opener);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('sets dialog language and restores background accessibility attributes', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();
  const renderGuide = (open) => {
    ReactDOM.render(
      <>
        <main id="plain-background">Background</main>
        <aside aria-hidden="false" id="existing-background" inert="preserve">Aside</aside>
        <UserGuideModal open={open} onClose={onClose} />
      </>,
      container
    );
  };

  act(() => {
    renderGuide(true);
  });
  const plainBackground = container.querySelector('#plain-background');
  const existingBackground = container.querySelector('#existing-background');
  const dialog = container.querySelector('[role="dialog"]');
  expect(plainBackground.hasAttribute('inert')).toBe(true);
  expect(plainBackground.getAttribute('aria-hidden')).toBe('true');
  expect(existingBackground.hasAttribute('inert')).toBe(true);
  expect(existingBackground.getAttribute('aria-hidden')).toBe('true');
  expect(dialog.getAttribute('lang')).toBe('en');
  expect(container.querySelector('.dh-user-guide__languages').getAttribute('role'))
    .toBe('group');

  const chineseButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent === '中文');
  act(() => {
    chineseButton.click();
  });
  expect(dialog.getAttribute('lang')).toBe('zh-CN');

  act(() => {
    renderGuide(false);
  });
  expect(plainBackground.hasAttribute('inert')).toBe(false);
  expect(plainBackground.hasAttribute('aria-hidden')).toBe(false);
  expect(existingBackground.getAttribute('inert')).toBe('preserve');
  expect(existingBackground.getAttribute('aria-hidden')).toBe('false');

  act(() => {
    renderGuide(true);
  });
  expect(plainBackground.hasAttribute('inert')).toBe(true);
  expect(plainBackground.getAttribute('aria-hidden')).toBe('true');
  expect(existingBackground.hasAttribute('inert')).toBe(true);
  expect(existingBackground.getAttribute('aria-hidden')).toBe('true');

  act(() => {
    renderGuide(false);
  });
  expect(plainBackground.hasAttribute('inert')).toBe(false);
  expect(plainBackground.hasAttribute('aria-hidden')).toBe(false);
  expect(existingBackground.getAttribute('inert')).toBe('preserve');
  expect(existingBackground.getAttribute('aria-hidden')).toBe('false');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('restores background attributes when unmounted while open', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onClose = jest.fn();
  const renderTree = (showModal) => {
    ReactDOM.render(
      <>
        <aside aria-hidden="false" id="unmount-background" inert="existing">
          Background
        </aside>
        {showModal ? <UserGuideModal open onClose={onClose} /> : null}
      </>,
      container
    );
  };

  act(() => {
    renderTree(true);
  });
  const background = container.querySelector('#unmount-background');
  expect(background.getAttribute('inert')).toBe('');
  expect(background.getAttribute('aria-hidden')).toBe('true');

  act(() => {
    renderTree(false);
  });
  expect(container.querySelector('#unmount-background')).toBe(background);
  expect(background.getAttribute('inert')).toBe('existing');
  expect(background.getAttribute('aria-hidden')).toBe('false');

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});
