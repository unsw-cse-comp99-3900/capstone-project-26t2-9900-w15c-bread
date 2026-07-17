import React, { useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  extractMentionAccountIds,
  formatDateTime,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';
import './SideBySideDiffView.css';

const CHANGE_TYPES = new Set(['added', 'removed', 'modified']);

// The diff engine speaks in "what old had / what current has".
// The side-by-side surface speaks in "what will happen if the user keeps
// this row when writing back". We re-label as the write-back preview:
//   raw removed (in v_old, not in v_current) -> "Added"   (would be added back)
//   raw added   (in v_current, not in v_old) -> "Deleted" (would be removed)
//   paired removed+added at same slot        -> "Modified"

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const p = doc.createElement('p');
  p.textContent = text;
  return p.outerHTML;
}

function sameHtml(block) {
  return block.renderedHtml || block.html || fallbackTextHtml(block.text);
}
function oldHtmlOf(block) {
  return (
    block.renderedHtml ||
    block.oldRenderedHtml ||
    block.oldHtml ||
    fallbackTextHtml(block.oldText || block.text)
  );
}
function newHtmlOf(block) {
  return (
    block.renderedHtml ||
    block.newRenderedHtml ||
    block.newHtml ||
    fallbackTextHtml(block.newText || block.text)
  );
}

function pairChangeRun(runBlocks, startIndex) {
  const removed = [];
  const added = [];
  runBlocks.forEach((b, offset) => {
    const entry = { block: b, index: startIndex + offset };
    (b.type === 'removed' ? removed : added).push(entry);
  });

  const usedAdded = new Set();
  const rows = [];

  removed.forEach((rEntry) => {
    const match = added.find(
      (aEntry) =>
        !usedAdded.has(aEntry) &&
        aEntry.block.nodeType === rEntry.block.nodeType &&
        aEntry.block.tag === rEntry.block.tag
    );
    if (match) {
      usedAdded.add(match);
      rows.push({
        kind: 'modified',
        marker: '=',
        indices: [rEntry.index, match.index],
        left: rEntry.block,
        right: match.block,
      });
    } else {
      rows.push({
        kind: 'added-back',
        marker: '+',
        indices: [rEntry.index],
        left: rEntry.block,
        right: null,
      });
    }
  });

  added.forEach((aEntry) => {
    if (usedAdded.has(aEntry)) return;
    rows.push({
      kind: 'deleted',
      marker: '-',
      indices: [aEntry.index],
      left: null,
      right: aEntry.block,
    });
  });

  return rows;
}

function buildRows(blocks, showUnchanged) {
  const rows = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    if (block.isStructuralBoundary) {
      if (showUnchanged) rows.push({ kind: 'boundary', block, indices: [i] });
      i += 1;
      continue;
    }

    if (!CHANGE_TYPES.has(block.type)) {
      if (showUnchanged) rows.push({ kind: 'same', block, indices: [i] });
      i += 1;
      continue;
    }

    const runStart = i;
    const run = [];
    while (i < blocks.length && CHANGE_TYPES.has(blocks[i].type)) {
      run.push(blocks[i]);
      i += 1;
    }
    rows.push(...pairChangeRun(run, runStart));
  }
  return rows;
}

function RichContent({ html }) {
  const trimmed = typeof html === 'string' ? html.trim() : '';
  if (!trimmed) {
    return <div className="sbs-empty">(no content)</div>;
  }
  // The manual renderer needs a `.dh-rich-page` ancestor for panels, lists,
  // decisions, code blocks etc. to get their typography. We keep it INSIDE
  // the pane body so its 24/28 padding can be locally overridden without
  // touching the shared styles.css.
  return (
    <div
      className="dh-rich-page sbs-rich"
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}

function Pane({ tone, statusLabel, html }) {
  return (
    <div className={`sbs-pane sbs-pane--${tone}`}>
      {statusLabel ? (
        <span className={`sbs-pill sbs-pill--${tone}`}>{statusLabel}</span>
      ) : null}
      <div className="sbs-pane__body">
        <RichContent html={html} />
      </div>
    </div>
  );
}

function Placeholder({ text }) {
  return (
    <div className="sbs-pane sbs-pane--placeholder">
      <span className="sbs-placeholder-text">{text}</span>
    </div>
  );
}

function Marker({ symbol }) {
  const tone =
    symbol === '+'
      ? 'added'
      : symbol === '-'
      ? 'deleted'
      : symbol === '='
      ? 'modified'
      : 'same';
  return (
    <div className={`sbs-marker sbs-marker--${tone}`}>
      {symbol ? <span>{symbol}</span> : null}
    </div>
  );
}

// Per-row Keep/Restore controls (the ☐ ✓ ✕ column in the mockup).
// State is intentionally local so this page ships without needing the
// write-back stream's shared choice map. When that stream lands, either
// lift this state to App.js or override via `renderRowControls`.
//   choice === 'keep'   → keep current version (right column)
//   choice === 'revert' → restore old version (left column)
//   choice === undefined → undecided
function DefaultRowControls({ row, choice, onChoose }) {
  const inert = row.kind === 'same' || row.kind === 'boundary';
  const checked = Boolean(choice);
  const rootClass =
    'sbs-controls' + (inert ? ' sbs-controls--inert' : '');

  const toggleCheckbox = () => {
    if (inert) return;
    onChoose(checked ? null : 'keep');
  };

  return (
    <div className={rootClass}>
      <button
        type="button"
        className={
          'sbs-ctl sbs-ctl--check' + (checked ? ' sbs-ctl--checked' : '')
        }
        disabled={inert}
        aria-checked={checked}
        aria-label={checked ? 'Clear decision' : 'Mark decision'}
        onClick={toggleCheckbox}
      >
        {checked ? '✓' : ''}
      </button>
      <button
        type="button"
        className={
          'sbs-ctl sbs-ctl--keep' + (choice === 'keep' ? ' sbs-ctl--active' : '')
        }
        disabled={inert}
        aria-label="Keep current version"
        onClick={() => !inert && onChoose(choice === 'keep' ? null : 'keep')}
      >
        ✓
      </button>
      <button
        type="button"
        className={
          'sbs-ctl sbs-ctl--drop' + (choice === 'revert' ? ' sbs-ctl--active' : '')
        }
        disabled={inert}
        aria-label="Restore old version"
        onClick={() => !inert && onChoose(choice === 'revert' ? null : 'revert')}
      >
        ✕
      </button>
    </div>
  );
}

function ControlsCol({ row, choice, onChoose, renderRowControls }) {
  const node = renderRowControls
    ? renderRowControls(row)
    : <DefaultRowControls row={row} choice={choice} onChoose={onChoose} />;
  return <div className="sbs-col sbs-col--controls">{node}</div>;
}

const VIEW_TOGGLE_OPTIONS = [
  { value: 'inline', label: 'Summary' },
  { value: 'side-by-side', label: 'Side-by-side' },
];

function ViewToggle({ activeView, onViewChange }) {
  if (!onViewChange) return null;
  return (
    <div className="sbs-toggle" role="tablist">
      {VIEW_TOGGLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={activeView === opt.value}
          className={`sbs-toggle__btn${
            activeView === opt.value ? ' sbs-toggle__btn--active' : ''
          }`}
          onClick={() => onViewChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({ children }) {
  return <div className="sbs-row">{children}</div>;
}

function MarkerCol({ symbol }) {
  return (
    <div className="sbs-col sbs-col--marker">
      <Marker symbol={symbol} />
    </div>
  );
}

function PaneCol({ children }) {
  return <div className="sbs-col sbs-col--pane">{children}</div>;
}

function SideBySideDiffView({
  pageId,
  pageTitle,
  baseUrl,
  attachmentsByFilename,
  currentVersion,
  selectedVersion,
  renderRowControls,
  showUnchanged = false,
  activeView,
  onViewChange,
}) {
  const [mentionUsers, setMentionUsers] = useState({});
  const [rowChoices, setRowChoices] = useState(() => new Map());

  const chooseRow = (rowKey, next) => {
    setRowChoices((prev) => {
      const map = new Map(prev);
      if (next == null) map.delete(rowKey);
      else map.set(rowKey, next);
      return map;
    });
  };

  const currentBody =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBody =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';

  const mentionIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...extractMentionAccountIds(selectedBody),
          ...extractMentionAccountIds(currentBody),
        ])
      ).slice(0, 100),
    [currentBody, selectedBody]
  );

  useEffect(() => {
    let cancelled = false;
    if (!mentionIds.length) {
      setMentionUsers({});
      return () => {
        cancelled = true;
      };
    }
    async function resolve() {
      try {
        const { requestConfluence } = await import('@forge/bridge');
        const entries = await Promise.all(
          mentionIds.map(async (id) => {
            try {
              const res = await requestConfluence(
                `/wiki/rest/api/user?accountId=${encodeURIComponent(id)}`,
                { headers: { Accept: 'application/json' } }
              );
              if (!res.ok) return null;
              const user = await res.json();
              return user.displayName ? [id, user.displayName] : null;
            } catch (e) {
              return null;
            }
          })
        );
        if (!cancelled) setMentionUsers(Object.fromEntries(entries.filter(Boolean)));
      } catch (e) {
        if (!cancelled) setMentionUsers({});
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [mentionIds]);

  const hasBase = Boolean(currentVersion && selectedVersion);
  const isCurrent =
    currentVersion && selectedVersion && selectedVersion.number === currentVersion.number;

  const diff = useMemo(() => {
    if (!hasBase) return { blocks: [], limited: false };
    try {
      return buildRichTextDiffHtml(
        selectedBody,
        currentBody,
        baseUrl,
        attachmentsByFilename || {},
        mentionUsers
      );
    } catch (e) {
      return { blocks: [], limited: false, error: e.message };
    }
  }, [hasBase, selectedBody, currentBody, baseUrl, attachmentsByFilename, mentionUsers]);

  const rows = useMemo(
    () => buildRows(diff.blocks || [], showUnchanged),
    [diff.blocks, showUnchanged]
  );

  const stats = useMemo(() => {
    let additions = 0;
    let removals = 0;
    let modified = 0;
    (diff.blocks || []).forEach((b) => {
      if (b.type === 'removed') additions += 1;
      else if (b.type === 'added') removals += 1;
    });
    rows.forEach((r) => {
      if (r.kind === 'modified') modified += 1;
    });
    // A `modified` row represents one paired removed+added, so both were
    // already counted above. Subtract the paired ones out of the raw counts.
    additions -= modified;
    removals -= modified;
    return {
      additions: Math.max(additions, 0),
      removals: Math.max(removals, 0),
      modified,
      total: additions + removals + modified,
    };
  }, [diff.blocks, rows]);

  const selectedPlain = useMemo(
    () => storageToPlainText(selectedBody),
    [selectedBody]
  );
  const selectedWordCount = useMemo(() => countWords(selectedPlain), [selectedPlain]);
  const selectedHtmlChars = selectedBody ? selectedBody.length : 0;

  if (!hasBase) {
    return (
      <div className="sbs">
        <div className="sbs-state">Select a version to compare.</div>
      </div>
    );
  }

  if (isCurrent) {
    const html = prepareConfluenceHtml(
      currentBody,
      baseUrl,
      attachmentsByFilename || {},
      mentionUsers
    );
    return (
      <div className="sbs">
        <div className="sbs-state">
          <div
            className="dh-rich-page"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    );
  }

  const oldLabel = `Draft / v${selectedVersion.number} selection`;
  const newLabel = `Current / v${currentVersion.number}`;

  return (
    <div className="sbs">
      <div className="sbs-header">
        <div className="sbs-vchips">
          <span className="sbs-vchip">v{selectedVersion.number}</span>
          <span className="sbs-vs">vs</span>
          <span className="sbs-vchip sbs-vchip--current">
            v{currentVersion.number} · Current
          </span>
        </div>

        <div className="sbs-meta">
          {pageTitle ? <span>{pageTitle}</span> : null}
          {selectedVersion.authorName ? (
            <span>Edited by {selectedVersion.authorName}</span>
          ) : null}
          {selectedVersion.createdAt ? (
            <span>{formatDateTime(selectedVersion.createdAt)}</span>
          ) : null}
          <span>{selectedWordCount} words</span>
          <span>{selectedHtmlChars} HTML chars</span>
          {pageId ? <span>Page {pageId}</span> : null}
        </div>

        <div className="sbs-stats">
          <span className="sbs-stat sbs-stat--added">+ {stats.additions} additions</span>
          <span className="sbs-stat sbs-stat--deleted">- {stats.removals} removals</span>
          <span className="sbs-stat sbs-stat--modified">{stats.modified} modified</span>
          <span className="sbs-stat sbs-stat--total">{stats.total} total changes</span>
        </div>
      </div>

      <div className="sbs-section">
        <div>
          <h2 className="sbs-section__title">Side-by-side diff</h2>
          <p className="sbs-section__subtitle">
            Compare Draft and Current before adding comments
          </p>
        </div>
        <ViewToggle activeView={activeView} onViewChange={onViewChange} />
      </div>

      {diff.limited ? (
        <div className="sbs-banner">
          This comparison is too large for a full diff — showing the current version only.
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="sbs-state">No differences to display.</div>
      ) : (
        <div className="sbs-rows">
          <div className="sbs-row sbs-row--headings">
            <div className="sbs-col sbs-col--controls" />
            <div className="sbs-col sbs-col--pane sbs-heading">{oldLabel}</div>
            <div className="sbs-col sbs-col--marker" />
            <div className="sbs-col sbs-col--pane sbs-heading">{newLabel}</div>
          </div>

          {rows.map((row, index) => {
            const key = `${row.kind}-${row.indices.join('-')}-${index}`;
            const choice = rowChoices.get(key);
            const onChoose = (next) => chooseRow(key, next);

            if (row.kind === 'boundary') {
              const html = row.block.fullRenderedHtml || '';
              return (
                <Row key={key}>
                  <ControlsCol row={row} choice={choice} onChoose={onChoose} renderRowControls={null} />
                  <PaneCol>
                    <div className="sbs-pane sbs-pane--boundary">
                      <RichContent html={html} />
                    </div>
                  </PaneCol>
                  <MarkerCol symbol="" />
                  <PaneCol>
                    <div className="sbs-pane sbs-pane--boundary">
                      <RichContent html={html} />
                    </div>
                  </PaneCol>
                </Row>
              );
            }

            if (row.kind === 'same') {
              return (
                <Row key={key}>
                  <ControlsCol row={row} choice={choice} onChoose={onChoose} renderRowControls={null} />
                  <PaneCol>
                    <Pane tone="same" html={sameHtml(row.block)} />
                  </PaneCol>
                  <MarkerCol symbol="=" />
                  <PaneCol>
                    <Pane tone="same" html={sameHtml(row.block)} />
                  </PaneCol>
                </Row>
              );
            }

            if (row.kind === 'added-back') {
              return (
                <Row key={key}>
                  <ControlsCol row={row} choice={choice} onChoose={onChoose} renderRowControls={renderRowControls} />
                  <PaneCol>
                    <Pane tone="added" statusLabel="Added" html={oldHtmlOf(row.left)} />
                  </PaneCol>
                  <MarkerCol symbol="+" />
                  <PaneCol>
                    <Placeholder text="Not present in current" />
                  </PaneCol>
                </Row>
              );
            }

            if (row.kind === 'deleted') {
              return (
                <Row key={key}>
                  <ControlsCol row={row} choice={choice} onChoose={onChoose} renderRowControls={renderRowControls} />
                  <PaneCol>
                    <Placeholder text="Removed from draft" />
                  </PaneCol>
                  <MarkerCol symbol="-" />
                  <PaneCol>
                    <Pane tone="deleted" statusLabel="Deleted" html={newHtmlOf(row.right)} />
                  </PaneCol>
                </Row>
              );
            }

            return (
              <Row key={key}>
                <ControlsCol row={row} choice={choice} onChoose={onChoose} renderRowControls={renderRowControls} />
                <PaneCol>
                  <Pane tone="modified" statusLabel="Modified" html={oldHtmlOf(row.left)} />
                </PaneCol>
                <MarkerCol symbol="=" />
                <PaneCol>
                  <Pane tone="modified" statusLabel="Modified" html={newHtmlOf(row.right)} />
                </PaneCol>
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SideBySideDiffView;
