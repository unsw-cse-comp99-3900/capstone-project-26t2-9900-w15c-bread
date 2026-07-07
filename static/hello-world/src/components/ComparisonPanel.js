import React, { useEffect, useMemo, useState } from 'react';
import {
  buildRichTextDiffHtml,
  countWords,
  formatDateTime,
  getStorageNodeOuterHtml,
  prepareConfluenceHtml,
  storageToPlainText,
} from '../utils';

const CHANGE_BLOCK_TYPES = new Set(['added', 'removed', 'modified']);
const UNSUPPORTED_MISSING_RAW_ERROR =
  'This page contains unsupported blocks without raw data, so write-back is disabled to avoid data loss.';
const MISSING_STORAGE_ERROR =
  'Recovered content is missing raw Confluence storage for one or more blocks, so write-back is disabled to avoid data loss.';
const UNSUPPORTED_PLACEHOLDER_STORAGE_RE = /data-dh-node-type=["']unsupported["']|Unsupported Confluence block/i;

function blockSelectionKey(index) {
  // Sprint 1 uses the diff block index as the selection id. Keep this isolated
  // so a later stable block id can replace it without touching the UI logic.
  return String(index);
}

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

function getSelectedBlockPreviewHtml(block, selected) {
  if (!block) return '';

  if (block.type === 'same') {
    return block.renderedHtml || block.html || '';
  }

  if (block.type === 'added') {
    return selected
      ? block.newRenderedHtml || block.renderedHtml || block.newHtml || fallbackTextHtml(block.text)
      : '';
  }

  if (block.type === 'removed') {
    // The preview starts from the historical version. Applying a removal
    // therefore omits the old block; leaving it unselected preserves it.
    return selected
      ? ''
      : block.oldRenderedHtml || block.renderedHtml || block.oldHtml || fallbackTextHtml(block.text);
  }

  if (block.type === 'modified') {
    if (selected) {
      return (
        block.newRenderedHtml || block.renderedHtml || block.newHtml || fallbackTextHtml(block.newText)
      );
    }

    return block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.oldText);
  }

  return block.renderedHtml || block.html || '';
}

export function buildRecoveryPreviewHtml(blocks, blockChoices, renderStorageHtml = (html) => html) {
  const previewParts = [];
  const rawGroupRuns = collectRawStorageGroupRuns(blocks, blockChoices);
  const taskGroupRuns = collectTaskGroupRuns(blocks, blockChoices);
  const emittedTaskGroupKeys = new Set();

  for (let index = 0; index < (blocks || []).length; index++) {
    const rawRun = findStorageGroupRun(rawGroupRuns, index);

    if (rawRun) {
      if (rawRun.start === index) {
        previewParts.push(renderStorageHtml(rawRun.html));
      }
      continue;
    }

    const taskRun = findTaskGroupRun(taskGroupRuns, index);

    if (taskRun) {
      if (taskRun.start === index && shouldEmitStorageGroupRun(taskRun, emittedTaskGroupKeys)) {
        previewParts.push(renderStorageHtml(taskRun.html));
      }
      continue;
    }

    const block = blocks[index];
    // Unresolved changes restore the selected historical version by default.
    // A user choice only keeps current content when explicitly requested.
    const choice = blockChoices.get(blockSelectionKey(index));
    const selected = choice === 'current';

    if (blockIsOmittedFromRecovery(block, selected)) {
      continue;
    }

    previewParts.push(getSelectedBlockPreviewHtml(block, selected));
  }

  return previewParts.join('');
}

function getSelectedBlockStorageHtml(block, selected) {
  if (!block) return '';

  if (block.type === 'same') {
    return selected
      ? block.newRawHtml || block.newHtml || block.html || ''
      : block.oldRawHtml || block.oldHtml || block.html || '';
  }

  if (block.type === 'added') {
    return selected ? block.newRawHtml || block.newHtml || '' : '';
  }

  if (block.type === 'removed') {
    return selected ? '' : block.oldRawHtml || block.oldHtml || '';
  }

  if (block.type === 'modified') {
    return selected
      ? block.newRawHtml || block.newHtml || ''
      : block.oldRawHtml || block.oldHtml || '';
  }

  return block.html || '';
}

function blockIsOmittedFromRecovery(block, selected) {
  return (
    (block && block.type === 'added' && !selected) ||
    (block && block.type === 'removed' && selected)
  );
}

function isUnsupportedBlock(block) {
  return Boolean(block && (block.nodeType === 'unsupported' || block.supportLevel === 'raw'));
}


function isAdfNodeElement(node) {
  return (
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    String(node.tagName || '').toLowerCase() === 'ac:adf-node'
  );
}

function getAdfNodeType(node) {
  return String(
    (node && (node.getAttribute('type') || node.getAttribute('ac:type'))) || ''
  ).toLowerCase();
}

function findFirstElement(root, predicate) {
  return Array.from(root.querySelectorAll('*')).find(predicate) || null;
}

function getStorageOpeningTagAttributes(node) {
  const html = getStorageNodeOuterHtml(node);
  const match = /^<[^>\s]+([^>]*)>/.exec(html);
  return match ? match[1] : '';
}

function extractTaskItemStorage(storageHtml) {
  if (!storageHtml || !storageHtml.trim()) return null;

  const doc = new DOMParser().parseFromString(storageHtml, 'text/html');
  const adfTaskList = findFirstElement(
    doc.body,
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'tasklist'
  );

  if (adfTaskList) {
    const items = Array.from(adfTaskList.children).filter(
      (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'taskitem'
    );

    return items.length === 1
      ? {
          kind: 'adf-task-list',
          itemHtml: getStorageNodeOuterHtml(items[0]),
          wrapperAttrs: getStorageOpeningTagAttributes(adfTaskList),
        }
      : null;
  }

  const legacyTaskList = findFirstElement(
    doc.body,
    (node) => String(node.tagName || '').toLowerCase() === 'ac:task-list'
  );

  if (legacyTaskList) {
    const items = Array.from(legacyTaskList.children).filter(
      (node) => String(node.tagName || '').toLowerCase() === 'ac:task'
    );

    return items.length === 1
      ? {
          kind: 'confluence-task-list',
          itemHtml: getStorageNodeOuterHtml(items[0]),
          wrapperAttrs: getStorageOpeningTagAttributes(legacyTaskList),
        }
      : null;
  }

  const htmlList = findFirstElement(doc.body, (node) => /^(ul|ol)$/i.test(node.tagName || ''));

  if (htmlList) {
    const items = Array.from(htmlList.children).filter((node) => /^li$/i.test(node.tagName || ''));

    return items.length === 1
      ? {
          kind: htmlList.tagName.toLowerCase(),
          itemHtml: getStorageNodeOuterHtml(items[0]),
          wrapperAttrs: getStorageOpeningTagAttributes(htmlList),
        }
      : null;
  }

  return null;
}

function getSelectedTaskItemStorage(block, selected) {
  if (!block || block.nodeType !== 'task_item' || blockIsOmittedFromRecovery(block, selected)) {
    return null;
  }

  const storageHtml = getSelectedBlockStorageHtml(block, selected);
  return extractTaskItemStorage(storageHtml);
}

function getSelectedTaskStorageGroup(block, selected) {
  if (!block || block.nodeType !== 'task_item' || blockIsOmittedFromRecovery(block, selected)) {
    return null;
  }

  if (block.type === 'same') {
    const html = selected
      ? block.newStorageGroupHtml || block.storageGroupHtml
      : block.oldStorageGroupHtml || block.storageGroupHtml;
    const key = selected
      ? block.newStorageGroupKey || block.storageGroupKey
      : block.oldStorageGroupKey || block.storageGroupKey;

    return html && key ? { html, key: String(key).replace(/^[^:]+:/, '') } : null;
  }

  const html = selected ? block.newStorageGroupHtml : block.oldStorageGroupHtml;
  const key = selected ? block.newStorageGroupKey : block.oldStorageGroupKey;

  return html && key ? { html, key: String(key).replace(/^[^:]+:/, '') } : null;
}

function getTaskGroupKeySet(block) {
  if (!block || block.nodeType !== 'task_item') return new Set();

  return new Set(
    [
      block.oldStorageGroupKey,
      block.newStorageGroupKey,
      block.storageGroupKey,
    ]
      .filter(Boolean)
      .map((key) => String(key).replace(/^[^:]+:/, ''))
  );
}

function keySetsOverlap(first, second) {
  if (!first.size || !second.size) return false;
  return Array.from(first).some((key) => second.has(key));
}

function mergeKeySets(target, source) {
  source.forEach((key) => target.add(key));
}

function getStorageGroupRunIdentity(run) {
  return run && run.keys && run.keys.size
    ? Array.from(run.keys).sort().join('\n')
    : '';
}

function shouldEmitStorageGroupRun(run, emittedGroupKeys) {
  const identity = getStorageGroupRunIdentity(run);

  if (!identity) return true;
  if (emittedGroupKeys.has(identity)) return false;

  emittedGroupKeys.add(identity);
  return true;
}

function getRawStorageGroupKeySet(block) {
  if (!block || block.nodeType === 'task_item') return new Set();

  return new Set(
    [
      block.oldStorageGroupKey,
      block.newStorageGroupKey,
      block.storageGroupKey,
    ]
      .filter((key) => key && String(key).startsWith('raw-block:'))
      .map(String)
  );
}

function getSelectedRawStorageGroup(block, selected) {
  if (!block || block.nodeType === 'task_item' || blockIsOmittedFromRecovery(block, selected)) {
    return null;
  }

  if (block.type === 'same') {
    const html = selected
      ? block.newStorageGroupHtml || block.storageGroupHtml
      : block.oldStorageGroupHtml || block.storageGroupHtml;
    const key = selected
      ? block.newStorageGroupKey || block.storageGroupKey
      : block.oldStorageGroupKey || block.storageGroupKey;

    return html && key && String(key).startsWith('raw-block:')
      ? { html, key: String(key), selected }
      : null;
  }

  const html = selected ? block.newStorageGroupHtml : block.oldStorageGroupHtml;
  const key = selected ? block.newStorageGroupKey : block.oldStorageGroupKey;

  return html && key && String(key).startsWith('raw-block:')
    ? { html, key: String(key), selected }
    : null;
}

function collectRawStorageGroupRuns(blocks, blockChoices) {
  const runs = [];

  for (let index = 0; index < (blocks || []).length; index++) {
    const block = blocks[index];
    const runKeys = getRawStorageGroupKeySet(block);

    if (!runKeys.size) continue;

    let fallbackGroup = null;
    let selectedCurrentGroup = null;
    let endIndex = index;

    for (let cursor = index; cursor < (blocks || []).length; cursor++) {
      const candidate = blocks[cursor];
      const candidateKeys = getRawStorageGroupKeySet(candidate);

      if (!keySetsOverlap(runKeys, candidateKeys)) break;

      mergeKeySets(runKeys, candidateKeys);

      const choice = blockChoices.get(blockSelectionKey(cursor));
      const selected = choice === 'current';
      const group = getSelectedRawStorageGroup(candidate, selected);

      if (group) {
        fallbackGroup = fallbackGroup || group;
        if (group.selected) {
          selectedCurrentGroup = group;
        }
      }

      endIndex = cursor;
    }

    const group = selectedCurrentGroup || fallbackGroup;

    if (group) {
      runs.push({
        start: index,
        end: endIndex,
        keys: new Set(runKeys),
        html: group.html,
      });
    }

    index = endIndex;
  }

  return runs;
}

function renderTaskItemStorageGroup(kind, items, wrapperAttrs = '') {
  if (!items.length) return '';

  if (kind === 'adf-task-list') {
    return `<ac:adf-node${wrapperAttrs || ' type="taskList"'}>${items.join('')}</ac:adf-node>`;
  }

  if (kind === 'confluence-task-list') {
    return `<ac:task-list${wrapperAttrs}>${items.join('')}</ac:task-list>`;
  }

  if (kind === 'ul' || kind === 'ol') {
    return `<${kind}${wrapperAttrs}>${items.join('')}</${kind}>`;
  }

  return items.join('');
}

function collectTaskGroupRuns(blocks, blockChoices) {
  const runs = [];

  for (let index = 0; index < (blocks || []).length; index++) {
    const block = blocks[index];
    const runKeys = getTaskGroupKeySet(block);

    if (!runKeys.size) continue;

    const items = [];
    const selectedGroups = new Map();
    let kind = '';
    let wrapperAttrs = '';
    let endIndex = index;

    for (let cursor = index; cursor < (blocks || []).length; cursor++) {
      const candidate = blocks[cursor];
      const candidateKeys = getTaskGroupKeySet(candidate);

      if (!keySetsOverlap(runKeys, candidateKeys)) break;

      mergeKeySets(runKeys, candidateKeys);

      const choice = blockChoices.get(blockSelectionKey(cursor));
      const selected = choice === 'current';
      const selectedGroup = getSelectedTaskStorageGroup(candidate, selected);
      const item = getSelectedTaskItemStorage(candidate, selected);

      if (selectedGroup) {
        selectedGroups.set(`${selectedGroup.key}\n${selectedGroup.html}`, selectedGroup.html);
      }

      if (item) {
        kind = kind || item.kind;
        if (item.kind === kind) {
          wrapperAttrs = wrapperAttrs || item.wrapperAttrs || '';
          items.push(item.itemHtml);
        }
      }

      endIndex = cursor;
    }

    if (items.length) {
      const rawGroupHtml = selectedGroups.size === 1
        ? Array.from(selectedGroups.values())[0]
        : '';

      runs.push({
        start: index,
        end: endIndex,
        keys: new Set(runKeys),
        html: rawGroupHtml || renderTaskItemStorageGroup(kind, items, wrapperAttrs),
      });
    }

    index = endIndex;
  }

  return runs;
}

function findTaskGroupRun(runs, index) {
  return runs.find((run) => run.start <= index && index <= run.end) || null;
}

function findStorageGroupRun(runs, index) {
  return runs.find((run) => run.start <= index && index <= run.end) || null;
}

function validateRecoveryStorageBlock(block, selected) {
  if (!block || blockIsOmittedFromRecovery(block, selected)) {
    return '';
  }

  const storageHtml = getSelectedBlockStorageHtml(block, selected);

  if (isUnsupportedBlock(block)) {
    if (!storageHtml || !storageHtml.trim()) {
      return UNSUPPORTED_MISSING_RAW_ERROR;
    }

    if (UNSUPPORTED_PLACEHOLDER_STORAGE_RE.test(storageHtml)) {
      return UNSUPPORTED_MISSING_RAW_ERROR;
    }

    return '';
  }

  if (!storageHtml || !storageHtml.trim()) {
    return MISSING_STORAGE_ERROR;
  }

  return '';
}

export function buildRecoveryStorageHtml(blocks, blockChoices) {
  const storageParts = [];
  const rawGroupRuns = collectRawStorageGroupRuns(blocks, blockChoices);
  const taskGroupRuns = collectTaskGroupRuns(blocks, blockChoices);
  const emittedTaskGroupKeys = new Set();

  for (let index = 0; index < (blocks || []).length; index++) {
    const block = blocks[index];
    const choice = blockChoices.get(blockSelectionKey(index));
    const selected = choice === 'current';
    const error = validateRecoveryStorageBlock(block, selected);

    if (error) {
      return { html: '', error };
    }

    const rawRun = findStorageGroupRun(rawGroupRuns, index);

    if (rawRun) {
      if (rawRun.start === index) {
        storageParts.push(rawRun.html);
      }
      continue;
    }

    const taskRun = findTaskGroupRun(taskGroupRuns, index);

    if (taskRun) {
      if (taskRun.start === index && shouldEmitStorageGroupRun(taskRun, emittedTaskGroupKeys)) {
        storageParts.push(taskRun.html);
      }
      continue;
    }

    if (blockIsOmittedFromRecovery(block, selected)) {
      continue;
    }

    storageParts.push(getSelectedBlockStorageHtml(block, selected));
  }

  return { html: storageParts.join(''), error: '' };
}

function getDiffBlockHtml(block) {
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

function getGitHubStyleDiffParts(block) {
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

  // Internally the diff engine still identifies a related old/new pair as a
  // modified block. The UI deliberately presents it as GitHub-style removal
  // and addition rows so users only need to understand "-" and "+".
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

/**
 * Right-hand panel for rich version preview and version-to-version comparison.
 *
 * Props contract (provided by App):
 *   - pageId:          string | null  — the Confluence page id
 *   - selectedVersion: object | null  — the version the user picked in the timeline
 *
 * The selected historical version is compared against the current version so
 * users can see what changed between that point in history and the live page.
 */
function ComparisonPanel({
  pageId,
  pageTitle,
  baseUrl,
  attachmentsByFilename,
  currentVersion,
  selectedVersion,
}) {
  if (!selectedVersion) {
    return (
      <div className="dh-main__empty">
        <h2 className="dh-main__empty-title">Select a version to compare</h2>
        <p className="dh-main__empty-text">
          Pick any version from the timeline on the left to compare it against the
          current version of this page.
        </p>
      </div>
    );
  }

  return (
    <ComparisonPanelContent
      pageId={pageId}
      pageTitle={pageTitle}
      baseUrl={baseUrl}
      attachmentsByFilename={attachmentsByFilename}
      currentVersion={currentVersion}
      selectedVersion={selectedVersion}
    />
  );
}

function ComparisonPanelContent({
  pageId,
  pageTitle,
  baseUrl,
  attachmentsByFilename,
  currentVersion,
  selectedVersion,
}) {
  const [blockChoices, setBlockChoices] = useState(new Map());
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [recoveryPreview, setRecoveryPreview] = useState(null);
  const [writeBack, setWriteBack] = useState({
    status: 'idle',
    error: '',
    page: null,
  });

  const currentBodyValue =
    currentVersion && currentVersion.body ? currentVersion.body.value : '';
  const selectedBodyValue =
    selectedVersion && selectedVersion.body ? selectedVersion.body.value : '';
  const selectedPlainText = storageToPlainText(selectedBodyValue);
  const selectedWordCount = countWords(selectedPlainText);
  const hasComparisonBase = Boolean(currentVersion && selectedVersion);
  const isCurrent =
    currentVersion && selectedVersion.number === currentVersion.number;
  const emptyDiff = useMemo(() => ({
    html: '',
    blocks: [],
    summary: {
      added: 0,
      removed: 0,
      addedBlocks: 0,
      removedBlocks: 0,
      modifiedBlocks: 0,
      unchangedBlocks: 0,
      limited: false,
    },
    added: 0,
    removed: 0,
    limited: false,
  }), []);
  const { richDiff, selectedHtml } = useMemo(() => {
    let nextDiff = emptyDiff;
    let nextHtml = '';

    try {
      if (hasComparisonBase && !isCurrent) {
        nextDiff = buildRichTextDiffHtml(
          selectedBodyValue,
          currentBodyValue,
          baseUrl,
          attachmentsByFilename || {}
        );
        nextHtml = nextDiff.html;
      } else {
        nextHtml = prepareConfluenceHtml(
          currentBodyValue || selectedBodyValue,
          baseUrl,
          attachmentsByFilename || {}
        );
      }
    } catch (e) {
      console.error('[ComparisonPanel] Failed to render diff preview', e);
      nextDiff = {
        ...emptyDiff,
        summary: {
          ...emptyDiff.summary,
          limited: true,
        },
        limited: true,
      };
      nextHtml =
        '<p>The diff preview could not render this Confluence storage format safely.</p>';
    }

    return { richDiff: nextDiff, selectedHtml: nextHtml };
  }, [
    attachmentsByFilename,
    baseUrl,
    currentBodyValue,
    emptyDiff,
    hasComparisonBase,
    isCurrent,
    selectedBodyValue,
  ]);

  const selectableBlocks = useMemo(
    () =>
      (richDiff.blocks || [])
        .map((block, index) => ({ block, index, key: blockSelectionKey(index) }))
        .filter(({ block }) => CHANGE_BLOCK_TYPES.has(block.type)),
    [richDiff.blocks]
  );

  useEffect(() => {
    setBlockChoices(new Map());
    setActiveBlockKey(null);
    setRecoveryPreview(null);
    setWriteBack({ status: 'idle', error: '', page: null });
  }, [selectableBlocks, selectedVersion.number, currentVersion && currentVersion.number]);

  useEffect(() => {
    if (!recoveryPreview) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && writeBack.status !== 'loading') {
        setRecoveryPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [writeBack.status, recoveryPreview]);

  const handleChooseBlockVersion = (key, choice) => {
    setBlockChoices((previous) => {
      const next = new Map(previous);
      next.set(key, choice);
      return next;
    });
    setActiveBlockKey(null);
  };

  const handleUndoBlockChoice = (key) => {
    setBlockChoices((previous) => {
      const next = new Map(previous);
      next.delete(key);
      return next;
    });
    setActiveBlockKey(null);
  };

  const previewHtml = useMemo(
    () =>
      buildRecoveryPreviewHtml(
        richDiff.blocks || [],
        blockChoices,
        (html) => prepareConfluenceHtml(html, baseUrl, attachmentsByFilename || {})
      ),
    [attachmentsByFilename, baseUrl, blockChoices, richDiff.blocks]
  );
  const recoveryStorage = useMemo(
    () => buildRecoveryStorageHtml(richDiff.blocks || [], blockChoices),
    [blockChoices, richDiff.blocks]
  );

  const diffSummary = richDiff.summary || {
    added: richDiff.added || 0,
    removed: richDiff.removed || 0,
    modifiedBlocks: 0,
    limited: richDiff.limited || false,
  };
  const totalChanges = diffSummary.added + diffSummary.removed;
  const showChangeSelection = hasComparisonBase && !isCurrent && selectableBlocks.length > 0;

  const handlePreviewRecovery = () => {
    const recovery = {
      selectedVersionNumber: selectedVersion.number,
      currentVersionNumber: currentVersion ? currentVersion.number : null,
      changeChoices: selectableBlocks.map(({ index, key }) => ({
        blockIndex: index,
        choice: blockChoices.get(key) || 'old',
      })),
      previewHtml,
      storageHtml: recoveryStorage.html,
      writeBackDisabledReason: recoveryStorage.error,
      createdAt: new Date().toISOString(),
    };

    setWriteBack({
      status: recoveryStorage.error ? 'error' : 'idle',
      error: recoveryStorage.error,
      page: null,
    });
    setRecoveryPreview(recovery);
  };

  const handleConfirmWriteBack = async () => {
    if (
      !recoveryPreview ||
      recoveryPreview.writeBackDisabledReason ||
      writeBack.status === 'loading'
    ) {
      return;
    }

    setWriteBack({ status: 'loading', error: '', page: null });

    try {
      const { invoke } = await import('@forge/bridge');
      const updatedPage = await invoke('writeRecoveredPage', {
        pageId,
        bodyValue: recoveryPreview.storageHtml,
        expectedVersionNumber: recoveryPreview.currentVersionNumber,
      });

      if (!updatedPage || !updatedPage.id) {
        throw new Error('Confluence did not return the updated page details.');
      }

      setWriteBack({
        status: 'success',
        error: '',
        page: updatedPage,
      });
    } catch (error) {
      setWriteBack({
        status: 'error',
        error: error && error.message
          ? error.message
          : 'Confluence could not write the recovered content.',
        page: null,
      });
    }
  };

  return (
    <div className="dh-compare">
      <div className="dh-compare__header">
        <span className="dh-compare__pill">
          v{selectedVersion.number}
          {isCurrent ? ' · Current' : ''}
        </span>
        <span className="dh-compare__arrow">vs</span>
        <span className="dh-compare__pill dh-compare__pill--selected">
          v{currentVersion ? currentVersion.number : '?'} · Current
        </span>
      </div>

      <div className="dh-compare__meta">
        <span>{pageTitle || 'Current page'}</span>
        <span>Edited by {selectedVersion.authorName || 'Unknown user'}</span>
        <span>{formatDateTime(selectedVersion.createdAt)}</span>
        <span>{selectedWordCount} words</span>
        <span>{selectedBodyValue.length} HTML chars</span>
        {pageId ? <span>Page {pageId}</span> : null}
      </div>

      <div className="dh-change-summary">
        {hasComparisonBase ? (
          <>
            <span className="dh-change-chip">
              Compared with current v{currentVersion.number}
            </span>
            <span className="dh-change-chip dh-change-chip--added">
              + {diffSummary.added} additions
            </span>
            <span className="dh-change-chip dh-change-chip--removed">
              - {diffSummary.removed} removals
            </span>
            <span className="dh-change-chip">{totalChanges} total changes</span>
          </>
        ) : (
          <span className="dh-change-chip">
            Current version shown as a full content preview
          </span>
        )}
      </div>

      <div className="dh-content-panel">
        {showChangeSelection ? (
          <div className="dh-inline-selection-toolbar">
            <div>
              <h2 className="dh-inline-selection-toolbar__title">Choose content versions</h2>
              <p className="dh-inline-selection-toolbar__meta">
                {blockChoices.size} of {selectableBlocks.length} changes decided
              </p>
            </div>

            <div className="dh-inline-selection-toolbar__actions">
              <button className="dh-primary-button" type="button" onClick={handlePreviewRecovery}>
                Preview Recovery
              </button>
            </div>
          </div>
        ) : null}

        {diffSummary.limited && hasComparisonBase ? (
          <div className="dh-diff-warning">
            Some content is large, so the preview uses a safer line-level comparison where full
            inline highlighting would be too expensive.
          </div>
        ) : null}

        {selectedHtml ? (
          <article className="dh-rich-page">
            {showChangeSelection ? (
              <section className="dh-rendered-page-body">
                {(richDiff.blocks || []).map((block, index) => {
                  const key = blockSelectionKey(index);

                  if (!CHANGE_BLOCK_TYPES.has(block.type)) {
                    return (
                      <div
                        className="dh-rich-diff-unchanged"
                        key={key}
                        dangerouslySetInnerHTML={{ __html: getDiffBlockHtml(block) }}
                      />
                    );
                  }

                  const choice = blockChoices.get(key);

                  if (choice) {
                    const resolvedHtml = getSelectedBlockPreviewHtml(block, choice === 'current');

                    return (
                      <div
                        className={`dh-resolved-change-block dh-resolved-change-block--${choice}`}
                        key={key}
                      >
                        <div className="dh-resolved-change-block__status">
                          <span>
                            {choice === 'current'
                              ? 'Current version selected'
                              : 'Old version restored'}
                          </span>
                          <button
                            aria-label="Undo this content choice"
                            className="dh-resolved-change-block__undo"
                            onClick={() => handleUndoBlockChoice(key)}
                            title="Undo this content choice"
                            type="button"
                          >
                            ↶
                          </button>
                        </div>
                        {resolvedHtml ? (
                          <div
                            className="dh-resolved-change-block__content"
                            dangerouslySetInnerHTML={{ __html: resolvedHtml }}
                          />
                        ) : (
                          <div className="dh-resolved-change-block__empty">
                            This content is not present in the selected version.
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isActive = activeBlockKey === key;
                  const diffParts = getGitHubStyleDiffParts(block);

                  return (
                    <div
                      aria-expanded={isActive}
                      className={`dh-choice-diff-module${
                        isActive ? ' dh-choice-diff-module--active' : ''
                      }`}
                      key={key}
                      onClick={() =>
                        setActiveBlockKey((previous) => (previous === key ? null : key))
                      }
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveBlockKey((previous) => (previous === key ? null : key));
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {diffParts.map((part, partIndex) => (
                        <div
                          className={`dh-github-diff-part dh-github-diff-part--${part.type}`}
                          key={`${key}-${part.type}-${partIndex}`}
                        >
                          <span className="dh-github-diff-part__marker">
                            {part.type === 'added' ? '+' : '-'}
                          </span>
                          <div
                            className="dh-github-diff-part__content"
                            dangerouslySetInnerHTML={{ __html: part.html }}
                          />
                        </div>
                      ))}

                      {isActive ? (
                        <div
                          className="dh-choice-diff-module__actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            className="dh-choice-action dh-choice-action--current"
                            onClick={() => handleChooseBlockVersion(key, 'current')}
                            type="button"
                          >
                            Keep current change
                          </button>
                          <button
                            className="dh-choice-action"
                            onClick={() => handleChooseBlockVersion(key, 'old')}
                            type="button"
                          >
                            Restore old content
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ) : (
              <section
                className="dh-rendered-page-body"
                dangerouslySetInnerHTML={{ __html: selectedHtml }}
              />
            )}
          </article>
        ) : (
          <div className="dh-empty-content">
            Confluence did not return rendered rich content for this version.
          </div>
        )}
      </div>

      {recoveryPreview ? (
        <div
          className="dh-draft-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              writeBack.status !== 'loading'
            ) {
              setRecoveryPreview(null);
            }
          }}
        >
          <section
            aria-labelledby="dh-draft-preview-title"
            aria-modal="true"
            className="dh-draft-modal"
            role="dialog"
          >
            <header className="dh-draft-modal__header">
              <div>
                <h2 className="dh-draft-modal__title" id="dh-draft-preview-title">
                  Recovery Preview
                </h2>
                <p className="dh-draft-modal__meta">
                  v{recoveryPreview.selectedVersionNumber} selection to
                  {' '}v{recoveryPreview.currentVersionNumber || '?'}
                </p>
              </div>
              <button
                aria-label="Close recovery preview"
                className="dh-draft-modal__close"
                disabled={writeBack.status === 'loading'}
                onClick={() => setRecoveryPreview(null)}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="dh-draft-modal__body">
              {recoveryPreview.previewHtml ? (
                <article className="dh-rich-page dh-rich-page--preview">
                  <section
                    className="dh-rendered-page-body"
                    dangerouslySetInnerHTML={{ __html: recoveryPreview.previewHtml }}
                  />
                </article>
              ) : (
                <div className="dh-empty-content">
                  No selected changes are available for the recovery preview.
                </div>
              )}
            </div>

            <footer className="dh-draft-modal__footer">
              <div className="dh-draft-modal__result" aria-live="polite">
                {writeBack.status === 'idle'
                  ? 'Review the result, then write the recovered storage back to the current Confluence page.'
                  : null}
                {writeBack.status === 'loading'
                  ? 'Writing recovered content to Confluence...'
                  : null}
                {writeBack.status === 'error' ? (
                  <span className="dh-draft-modal__result--error">
                    {writeBack.error}
                  </span>
                ) : null}
                {writeBack.status === 'success' ? (
                  <span className="dh-draft-modal__result--success">
                    Page was updated to v{writeBack.page.versionNumber || '?'}.
                  </span>
                ) : null}
              </div>

              <div className="dh-draft-modal__footer-actions">
                <button
                  disabled={writeBack.status === 'loading'}
                  type="button"
                  onClick={() => setRecoveryPreview(null)}
                >
                  Back to changes
                </button>

                {writeBack.status !== 'success' ? (
                  <button
                    className="dh-primary-button"
                    disabled={writeBack.status === 'loading' || Boolean(recoveryPreview.writeBackDisabledReason)}
                    onClick={handleConfirmWriteBack}
                    type="button"
                  >
                    {writeBack.status === 'loading' ? 'Writing...' : 'Write Back to Current Page'}
                  </button>
                ) : null}
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ComparisonPanel;
