import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GUIDE_LANGUAGE,
  GUIDE_LANGUAGES,
  USER_GUIDE_COPY,
  guideImageUrl,
} from './userGuideContent';
import './UserGuideModal.css';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function restoreAttribute(element, name, wasPresent, value) {
  if (wasPresent) {
    element.setAttribute(name, value === null ? '' : value);
  } else {
    element.removeAttribute(name);
  }
}

function GuideBlock({ block, blockIndex, imageBadge, sectionId }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;

  if (block.type === 'list' || block.type === 'ordered-list') {
    const List = block.type === 'ordered-list' ? 'ol' : 'ul';
    return (
      <List>
        {block.items.map((item, itemIndex) => (
          <li key={`${sectionId}-${blockIndex}-${itemIndex}`}>{item}</li>
        ))}
      </List>
    );
  }

  if (block.type === 'image') {
    return (
      <figure className="dh-user-guide__figure">
        <div className="dh-user-guide__image-frame">
          <span className="dh-user-guide__image-badge">{imageBadge}</span>
          <img
            alt={block.alt}
            className="dh-user-guide__image"
            loading="lazy"
            src={guideImageUrl(block.filename)}
          />
        </div>
        <figcaption>{block.caption}</figcaption>
      </figure>
    );
  }

  return null;
}

function GuideSection({ section, imageBadge }) {
  return (
    <section className="dh-user-guide__section" id={`dh-guide-${section.id}`}>
      <h3>{section.title}</h3>
      {section.blocks.map((block, blockIndex) => (
        <GuideBlock
          block={block}
          blockIndex={blockIndex}
          imageBadge={imageBadge}
          key={`${section.id}-${blockIndex}`}
          sectionId={section.id}
        />
      ))}
    </section>
  );
}

function UserGuideModal({ open, onClose }) {
  const [language, setLanguage] = useState(DEFAULT_GUIDE_LANGUAGE);
  const backdropRef = useRef(null);
  const closeButtonRef = useRef(null);
  const copy = USER_GUIDE_COPY[language];

  useEffect(() => {
    if (!open) setLanguage(DEFAULT_GUIDE_LANGUAGE);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return undefined;

    const backdrop = backdropRef.current;
    const opener = document.activeElement;
    const parent = backdrop && backdrop.parentElement;
    const backgroundState = parent
      ? Array.from(parent.children)
        .filter((element) => element !== backdrop)
        .map((element) => ({
          ariaHidden: element.getAttribute('aria-hidden'),
          element,
          hadAriaHidden: element.hasAttribute('aria-hidden'),
          hadInert: element.hasAttribute('inert'),
          inert: element.getAttribute('inert'),
        }))
      : [];

    backgroundState.forEach(({ element }) => {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('inert', '');
    });

    if (closeButtonRef.current) closeButtonRef.current.focus();

    const handleTabKeyDown = (event) => {
      if (event.key !== 'Tab' || !backdrop) return;

      const focusableElements = Array.from(backdrop.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      } else if (!backdrop.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      }
    };

    window.addEventListener('keydown', handleTabKeyDown);
    return () => {
      window.removeEventListener('keydown', handleTabKeyDown);
      backgroundState.forEach(({
        ariaHidden,
        element,
        hadAriaHidden,
        hadInert,
        inert,
      }) => {
        restoreAttribute(element, 'aria-hidden', hadAriaHidden, ariaHidden);
        restoreAttribute(element, 'inert', hadInert, inert);
      });
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dh-user-guide-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={backdropRef}
    >
      <section
        aria-describedby="dh-user-guide-intro"
        aria-labelledby="dh-user-guide-title"
        aria-modal="true"
        className="dh-user-guide"
        lang={language === 'zh' ? 'zh-CN' : 'en'}
        role="dialog"
      >
        <header className="dh-user-guide__header">
          <div>
            <h2 id="dh-user-guide-title">{copy.title}</h2>
            <p id="dh-user-guide-intro">{copy.intro}</p>
          </div>
          <div className="dh-user-guide__header-actions">
            <div
              aria-label="Guide language"
              className="dh-user-guide__languages"
              role="group"
            >
              {GUIDE_LANGUAGES.map((option) => (
                <button
                  aria-pressed={language === option.value}
                  className={language === option.value ? 'is-active' : ''}
                  key={option.value}
                  onClick={() => setLanguage(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              aria-label={copy.closeLabel}
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          </div>
        </header>
        <div className="dh-user-guide__body">
          {copy.sections.map((section) => (
            <GuideSection imageBadge={copy.imageBadge} key={section.id} section={section} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default UserGuideModal;
