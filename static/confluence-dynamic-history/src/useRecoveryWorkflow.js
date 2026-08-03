import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { blockSelectionKey } from './diffDisplay';
import { buildRecoveryStorageHtml } from './recoveryStorage';
import { buildCellScopedTableChoiceRun } from './tableCellRecovery';

const idleWriteBack = () => ({ status: 'idle', error: '', page: null });

export const initialRecoveryChoicesState = {
  comparisonKey: '',
  blockChoices: new Map(),
};

export function recoveryChoicesReducer(state, action) {
  if (action.type === 'reset-comparison') {
    if (state.comparisonKey === action.comparisonKey) return state;
    return {
      comparisonKey: action.comparisonKey,
      blockChoices: new Map(),
    };
  }

  // Choice actions are scoped to one pair of versions. Ignoring a stale
  // callback prevents a just-unmounted view from changing the next comparison.
  if (state.comparisonKey && state.comparisonKey !== action.comparisonKey) {
    return state;
  }

  const comparisonKey = state.comparisonKey || action.comparisonKey || '';
  switch (action.type) {
    case 'choose': {
      const blockChoices = new Map(state.blockChoices);
      blockChoices.set(action.key, action.choice);
      return { comparisonKey, blockChoices };
    }
    case 'undo': {
      const blockChoices = new Map(state.blockChoices);
      blockChoices.delete(action.key);
      return { comparisonKey, blockChoices };
    }
    case 'choose-all':
      return {
        comparisonKey,
        blockChoices: new Map(
          Array.from(new Set(action.keys || [])).map((key) => [key, action.choice])
        ),
      };
    case 'reset-choices':
      return { comparisonKey, blockChoices: new Map() };
    default:
      return state;
  }
}

export function useRecoveryChoices(comparisonKey) {
  const [state, dispatch] = useReducer(recoveryChoicesReducer, {
    comparisonKey,
    blockChoices: new Map(),
  });

  useEffect(() => {
    dispatch({ type: 'reset-comparison', comparisonKey });
  }, [comparisonKey]);

  // Effects run after render, so hide the previous pair's choices immediately
  // during the transition to a newly selected historical version.
  const blockChoices = state.comparisonKey === comparisonKey
    ? state.blockChoices
    : new Map();

  return useMemo(() => ({
    comparisonKey,
    blockChoices,
    chooseBlock: (key, choice) => dispatch({
      type: 'choose',
      comparisonKey,
      key,
      choice,
    }),
    undoChoice: (key) => dispatch({ type: 'undo', comparisonKey, key }),
    chooseAll: (keys, choice) => dispatch({
      type: 'choose-all',
      comparisonKey,
      keys,
      choice,
    }),
    resetChoices: () => dispatch({ type: 'reset-choices', comparisonKey }),
  }), [blockChoices, comparisonKey]);
}

export const initialRecoveryWorkflowState = {
  comparisonKey: '',
  blockChoices: new Map(),
  draftPreview: null,
  showVersionDifferenceNotes: false,
  writeBack: idleWriteBack(),
};

export function recoveryWorkflowReducer(state, action) {
  switch (action.type) {
    case 'reset-comparison':
      if (state.comparisonKey === action.comparisonKey) return state;
      return {
        ...initialRecoveryWorkflowState,
        comparisonKey: action.comparisonKey,
        blockChoices: new Map(),
        writeBack: idleWriteBack(),
      };
    case 'choose': {
      const blockChoices = new Map(state.blockChoices);
      blockChoices.set(action.key, action.choice);
      return { ...state, blockChoices };
    }
    case 'undo': {
      const blockChoices = new Map(state.blockChoices);
      blockChoices.delete(action.key);
      return { ...state, blockChoices };
    }
    case 'open-preview':
      return {
        ...state,
        draftPreview: action.draftPreview,
        showVersionDifferenceNotes: false,
        writeBack: idleWriteBack(),
      };
    case 'close-preview':
      return { ...state, draftPreview: null, showVersionDifferenceNotes: false };
    case 'show-notes':
      return { ...state, showVersionDifferenceNotes: action.show };
    case 'write-start':
      return { ...state, writeBack: { status: 'loading', error: '', page: null } };
    case 'write-success':
      return { ...state, writeBack: { status: 'success', error: '', page: action.page } };
    case 'write-error':
      return { ...state, writeBack: { status: 'error', error: action.error, page: null } };
    default:
      return state;
  }
}

export function createRecoveryDraft({
  selectedVersionNumber,
  currentVersionNumber,
  selectableRows,
  blockChoices,
  previewHtml,
  storageHtml,
  storageError,
  createdAt = new Date().toISOString(),
}) {
  return {
    selectedVersionNumber,
    currentVersionNumber,
    changeChoices: (selectableRows || []).map((row) => ({
      blockIndices: row.blocks.map(({ index }) => index),
      choice: blockChoices.get(row.key) || 'current',
    })),
    previewHtml,
    storageHtml,
    storageError,
    createdAt,
  };
}

function fallbackTextHtml(text) {
  if (!text) return '';
  const doc = new DOMParser().parseFromString('', 'text/html');
  const paragraph = doc.createElement('p');
  paragraph.textContent = text;
  return paragraph.outerHTML;
}

export function getBlockRenderedPreviewHtml(block, useCurrent) {
  if (!block) return '';
  if (block.isBlankLineCountChange) {
    return useCurrent
      ? block.newRenderedHtml || block.renderedHtml || ''
      : block.oldRenderedHtml || block.renderedHtml || '';
  }
  if (block.isStructuralBoundary) {
    return useCurrent
      ? block.newFullRenderedHtml || block.fullRenderedHtml || ''
      : block.oldFullRenderedHtml || block.fullRenderedHtml || '';
  }
  if (block.type === 'same') return block.renderedHtml || block.html || '';
  if (block.type === 'added') {
    return useCurrent ? block.renderedHtml || fallbackTextHtml(block.text) : '';
  }
  if (block.type === 'removed') {
    return useCurrent ? '' : block.renderedHtml || fallbackTextHtml(block.text);
  }
  if (block.type === 'modified') {
    return useCurrent
      ? block.newRenderedHtml || block.newHtml || fallbackTextHtml(block.newText)
      : block.oldRenderedHtml || block.oldHtml || fallbackTextHtml(block.oldText);
  }
  return block.renderedHtml || fallbackTextHtml(block.text);
}

export function buildRecoveryPreviewHtml(
  blocks,
  blockChoices = new Map(),
  blockChoiceKeys = new Map()
) {
  const safeBlocks = blocks || [];
  const html = [];

  for (let index = 0; index < safeBlocks.length; index++) {
    const tableCellRun = buildCellScopedTableChoiceRun({
      blocks: safeBlocks,
      index,
      blockChoices,
      blockChoiceKeys,
      storageFormat: false,
    });
    if (tableCellRun) {
      html.push(tableCellRun.html);
      index += tableCellRun.consumed - 1;
      continue;
    }

    const block = safeBlocks[index];
    const choiceKey = blockChoiceKeys.get(index) || blockSelectionKey(index);
    const useCurrent = (blockChoices.get(choiceKey) || 'current') !== 'old';
    html.push(getBlockRenderedPreviewHtml(block, useCurrent));
  }

  return html.join('');
}

export default function useRecoveryWorkflow({
  blocks,
  display,
  pageId,
  selectedVersion,
  currentVersion,
  onPageUpdated,
  createVersionDifferenceNotes,
  recoveryChoices,
}) {
  const comparisonKey = `${selectedVersion ? selectedVersion.number : ''}:${
    currentVersion ? currentVersion.number : ''
  }`;
  const [state, dispatch] = useReducer(recoveryWorkflowReducer, {
    ...initialRecoveryWorkflowState,
    comparisonKey,
    blockChoices: new Map(),
    writeBack: idleWriteBack(),
  });

  useEffect(() => {
    dispatch({ type: 'reset-comparison', comparisonKey });
  }, [comparisonKey]);

  const blockChoices = recoveryChoices && recoveryChoices.comparisonKey === comparisonKey
    ? recoveryChoices.blockChoices
    : state.blockChoices;

  const recoveryStorage = useMemo(
    () => buildRecoveryStorageHtml(blocks || [], blockChoices, display.blockChoiceKeys),
    [blockChoices, blocks, display.blockChoiceKeys]
  );
  const renderedPreviewHtml = useMemo(
    () => recoveryStorage.error
      ? ''
      : buildRecoveryPreviewHtml(blocks || [], blockChoices, display.blockChoiceKeys),
    [blockChoices, blocks, display.blockChoiceKeys, recoveryStorage.error]
  );
  const versionDifferenceNotes = useMemo(() => {
    if (!state.draftPreview || state.draftPreview.storageError || !createVersionDifferenceNotes) {
      return null;
    }
    return createVersionDifferenceNotes(state.draftPreview);
  }, [createVersionDifferenceNotes, state.draftPreview]);

  useEffect(() => {
    if (!state.draftPreview) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || state.writeBack.status === 'loading') return;
      if (state.showVersionDifferenceNotes) {
        dispatch({ type: 'show-notes', show: false });
      } else {
        dispatch({ type: 'close-preview' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.draftPreview, state.showVersionDifferenceNotes, state.writeBack.status]);

  const openPreview = useCallback(() => {
    dispatch({
      type: 'open-preview',
      draftPreview: createRecoveryDraft({
        selectedVersionNumber: selectedVersion ? selectedVersion.number : null,
        currentVersionNumber: currentVersion ? currentVersion.number : null,
        selectableRows: display.selectableRows,
        blockChoices,
        previewHtml: renderedPreviewHtml,
        storageHtml: recoveryStorage.html,
        storageError: recoveryStorage.error,
      }),
    });
  }, [
    blockChoices,
    currentVersion,
    display.selectableRows,
    recoveryStorage.error,
    recoveryStorage.html,
    renderedPreviewHtml,
    selectedVersion,
  ]);

  const confirmWriteBack = async () => {
    if (!state.draftPreview || state.draftPreview.storageError || state.writeBack.status === 'loading') {
      return;
    }
    dispatch({ type: 'write-start' });
    try {
      const { invoke } = await import('@forge/bridge');
      const updatedPage = await invoke('writeRecoveredPage', {
        pageId,
        bodyValue: state.draftPreview.storageHtml,
        expectedVersionNumber: state.draftPreview.currentVersionNumber,
      });
      if (updatedPage && updatedPage.ok === false) {
        throw new Error(updatedPage.error || 'Confluence rejected the recovered page update.');
      }
      if (!updatedPage || !updatedPage.id || !updatedPage.versionNumber) {
        throw new Error('Confluence did not return the updated page details.');
      }
      dispatch({ type: 'write-success', page: updatedPage });
      if (typeof onPageUpdated === 'function') onPageUpdated(updatedPage);
    } catch (error) {
      dispatch({
        type: 'write-error',
        error: error && error.message
          ? error.message
          : 'Confluence could not write the recovered content.',
      });
    }
  };

  return {
    ...state,
    blockChoices,
    recoveryStorage,
    renderedPreviewHtml,
    versionDifferenceNotes,
    chooseBlock: recoveryChoices
      ? recoveryChoices.chooseBlock
      : (key, choice) => dispatch({ type: 'choose', key, choice }),
    undoChoice: recoveryChoices
      ? recoveryChoices.undoChoice
      : (key) => dispatch({ type: 'undo', key }),
    openPreview,
    closePreview: () => dispatch({ type: 'close-preview' }),
    setShowVersionDifferenceNotes: (show) => dispatch({ type: 'show-notes', show }),
    confirmWriteBack,
    operationIsLoading: state.writeBack.status === 'loading',
  };
}
