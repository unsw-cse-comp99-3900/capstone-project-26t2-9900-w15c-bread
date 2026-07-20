import React from 'react';
import { buildRichTextDiffHtml } from '../utils';
import { buildDiffDisplayRows, isDisplayBlankLineBlock } from '../diffDisplay';

export function buildDraftDifferenceNotes(
  currentStorage,
  draftStorage,
  baseUrl = '',
  attachmentsByFilename = {},
  usersByAccountId = {}
) {
  const diff = buildRichTextDiffHtml(
    currentStorage,
    draftStorage,
    baseUrl,
    attachmentsByFilename,
    usersByAccountId
  );
  const display = buildDiffDisplayRows(diff.blocks || []);
  const classifiedSummary = display.selectableRows.reduce(
    (summary, row) => {
      if (row.changeKind === 'modified') summary.modifiedBlocks++;
      if (row.changeKind === 'added') summary.addedBlocks++;
      if (row.changeKind === 'removed') summary.removedBlocks++;
      return summary;
    },
    { addedBlocks: 0, removedBlocks: 0, modifiedBlocks: 0 }
  );

  return {
    diff: {
      ...diff,
      summary: { ...diff.summary, ...classifiedSummary },
    },
    display,
  };
}

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

export function blankLineRunSummaryHtml(block, suffix) {
  const count = block.blankLineCount;
  const noun = count === 1 ? 'blank line' : 'blank lines';
  return `<div class="dh-blank-line-run-summary">${count} ${noun} ${suffix}</div>`;
}

export function getDiffBlockHtml(block) {
  return (
    block.renderedHtml ||
    block.newRenderedHtml ||
    block.oldRenderedHtml ||
    block.newHtml ||
    block.oldHtml ||
    block.html ||
    fallbackTextHtml(block.newText || block.oldText || block.text)
  );
}

export function getGitHubStyleDiffParts(blockOrBlocks) {
  if (Array.isArray(blockOrBlocks)) {
    const tableBlocks = blockOrBlocks.map(({ block }) => block);
    const isBlankLineRun = Boolean(
      tableBlocks.length && tableBlocks.every(isDisplayBlankLineBlock)
    );
    if (isBlankLineRun) {
      return ['removed', 'added'].flatMap((type) => {
        const matchingBlocks = tableBlocks.filter((block) => block.type === type);
        if (!matchingBlocks.length) return [];
        const blankLineCount = matchingBlocks.reduce(
          (count, block) => count + (block.blankLineCount || 1),
          0
        );
        return [{
          type,
          html: blankLineRunSummaryHtml(
            { blankLineCount },
            type === 'added' ? 'added' : 'removed'
          ),
        }];
      });
    }

    const sharedTableDiff = tableBlocks[0] && tableBlocks[0].tableDiff;
    const isCellLevelTablePair = Boolean(
      tableBlocks.length === 2 &&
        tableBlocks[0].type === 'removed' &&
        tableBlocks[1].type === 'added' &&
        tableBlocks.every((block) => block.nodeType === 'table') &&
        sharedTableDiff &&
        sharedTableDiff.mode === 'cell_level' &&
        sharedTableDiff.comparisonHtml &&
        tableBlocks[1].tableDiff === sharedTableDiff
    );
    if (isCellLevelTablePair) {
      return [{ type: 'table-cell-level', html: sharedTableDiff.comparisonHtml }];
    }
    return blockOrBlocks.flatMap(({ block }) => getGitHubStyleDiffParts(block));
  }

  const block = blockOrBlocks;
  if (block.isListBreakChange) {
    const isAddition = block.blankLineDelta > 0;
    const contextHtml = isAddition ? block.newRenderedHtml : block.oldRenderedHtml;
    return [
      {
        type: 'context',
        html: contextHtml || fallbackTextHtml(block.newText || block.oldText),
      },
      {
        type: isAddition ? 'added' : 'removed',
        html: blankLineRunSummaryHtml(block, isAddition ? 'added' : 'removed'),
      },
    ];
  }
  if (
    block.nodeType === 'table' &&
    block.tableDiff &&
    block.tableDiff.mode === 'cell_level' &&
    block.tableDiff.comparisonHtml
  ) {
    return [{ type: 'table-cell-level', html: block.tableDiff.comparisonHtml }];
  }
  if (block.type === 'added') {
    return [{
      type: 'added',
      html: block.renderedHtml || block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.text),
    }];
  }
  if (block.type === 'removed') {
    return [{
      type: 'removed',
      html: block.renderedHtml || block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.text),
    }];
  }
  return [
    {
      type: 'removed',
      html: block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.oldText),
    },
    {
      type: 'added',
      html: block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.newText),
    },
  ];
}

export function formatLayoutWidthVector(widths) {
  const safeWidths = widths || [];
  if (!safeWidths.length || safeWidths.every((width) => !width)) {
    return 'Template default';
  }
  return safeWidths.map((width) => (width ? `${width}%` : 'auto')).join(' / ');
}

export function VersionDifferenceNotesRows({ rows, limited }) {
  if (!(rows || []).length) {
    return (
      <div className="dh-version-notes__empty">
        {limited
          ? 'This page is too large for a detailed comparison. The versions may still differ.'
          : 'The Draft is identical to the Current version.'}
      </div>
    );
  }

  return rows.map((row) => {
    if (row.type === 'layout_width_change') {
      const change = row.layoutWidthChange || {};
      return (
        <div className="dh-version-notes__change" key={row.key}>
          <div className="dh-version-notes__change-title">Column widths changed</div>
          <div className="dh-layout-width-change__values">
            <span className="dh-layout-width-change__value dh-layout-width-change__value--old">
              <span aria-hidden="true">-</span>{' '}{formatLayoutWidthVector(change.oldWidths)}
            </span>
            <span className="dh-layout-width-change__value dh-layout-width-change__value--current">
              <span aria-hidden="true">+</span>{' '}{formatLayoutWidthVector(change.newWidths)}
            </span>
          </div>
        </div>
      );
    }

    const changeTitle = row.changeKind === 'modified'
      ? 'Modified content'
      : row.changeKind === 'added'
        ? 'Added content'
        : 'Removed content';
    return (
      <div className="dh-version-notes__change" key={row.key}>
        <div className="dh-version-notes__change-title">{changeTitle}</div>
        {getGitHubStyleDiffParts(row.blocks || []).map((part, partIndex) => (
          <div
            className={`dh-github-diff-part dh-github-diff-part--${part.type}`}
            key={`${row.key}-${part.type}-${partIndex}`}
          >
            {!['table-cell-level', 'context'].includes(part.type) ? (
              <span className="dh-github-diff-part__marker">
                {part.type === 'added' ? '+' : '-'}
              </span>
            ) : null}
            <div
              className="dh-github-diff-part__content"
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          </div>
        ))}
      </div>
    );
  });
}
