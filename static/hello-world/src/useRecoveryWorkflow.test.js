import {
  buildRecoveryPreviewHtml,
  createRecoveryDraft,
  initialRecoveryChoicesState,
  initialRecoveryWorkflowState,
  recoveryChoicesReducer,
  recoveryWorkflowReducer,
} from './useRecoveryWorkflow';

describe('recovery workflow model', () => {
  test('applies one choice to every selectable change and resets the batch', () => {
    const selected = recoveryChoicesReducer(initialRecoveryChoicesState, {
      type: 'choose-all',
      comparisonKey: '2:5',
      keys: ['0:1', '2', '0:1'],
      choice: 'old',
    });

    expect(selected.comparisonKey).toBe('2:5');
    expect(Array.from(selected.blockChoices.entries())).toEqual([
      ['0:1', 'old'],
      ['2', 'old'],
    ]);

    const reset = recoveryChoicesReducer(selected, {
      type: 'reset-choices',
      comparisonKey: '2:5',
    });
    expect(reset.blockChoices.size).toBe(0);
  });

  test('ignores stale choice actions and clears choices for a new comparison', () => {
    const selected = {
      comparisonKey: '2:5',
      blockChoices: new Map([['0:1', 'old']]),
    };

    expect(recoveryChoicesReducer(selected, {
      type: 'choose',
      comparisonKey: '1:5',
      key: '2',
      choice: 'current',
    })).toBe(selected);

    const reset = recoveryChoicesReducer(selected, {
      type: 'reset-comparison',
      comparisonKey: '3:5',
    });
    expect(reset.comparisonKey).toBe('3:5');
    expect(reset.blockChoices.size).toBe(0);
  });

  test('creates a draft from canonical choices and reconstructed content', () => {
    const selectableRows = [{ key: '0:1', blocks: [{ index: 0 }, { index: 1 }] }];
    const draft = createRecoveryDraft({
      selectedVersionNumber: 2,
      currentVersionNumber: 5,
      selectableRows,
      blockChoices: new Map([['0:1', 'old']]),
      previewHtml: '<p>Old</p>',
      storageHtml: '<p>Old</p>',
      storageError: '',
      createdAt: '2026-07-19T00:00:00.000Z',
    });

    expect(draft.changeChoices).toEqual([{ blockIndices: [0, 1], choice: 'old' }]);
    expect(draft.storageHtml).toBe('<p>Old</p>');
    expect(draft.currentVersionNumber).toBe(5);
  });

  test('resets decisions and preview when comparison identity changes', () => {
    const dirtyState = {
      ...initialRecoveryWorkflowState,
      comparisonKey: '2:5',
      blockChoices: new Map([['0:1', 'old']]),
      draftPreview: { storageHtml: '<p>Old</p>' },
      writeBack: { status: 'error', error: 'failed', page: null },
    };

    const next = recoveryWorkflowReducer(dirtyState, {
      type: 'reset-comparison',
      comparisonKey: '3:5',
    });

    expect(next.comparisonKey).toBe('3:5');
    expect(next.blockChoices.size).toBe(0);
    expect(next.draftPreview).toBeNull();
    expect(next.writeBack.status).toBe('idle');
  });

  test('builds direct modified previews from the selected side, never diff decorations', () => {
    const block = {
      type: 'modified',
      oldText: 'old text',
      newText: 'new text',
      oldHtml: '<p>old storage</p>',
      newHtml: '<p>new storage</p>',
      renderedHtml: '<p>decorated diff</p>',
    };

    expect(buildRecoveryPreviewHtml([block])).toBe('<p>new storage</p>');
    expect(
      buildRecoveryPreviewHtml([block], new Map([['0', 'old']]))
    ).toBe('<p>old storage</p>');
    expect(buildRecoveryPreviewHtml([{
      type: 'modified',
      renderedHtml: '<p>decorated only</p>',
    }])).toBe('');
  });
});
