# Side-by-side Recovery Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Side-by-side decisions to the existing preview-confirm-write-back workflow and fix its classification, state, error, summary, and responsive defects.

**Architecture:** Keep `diffDisplay.js` as the canonical row model. Extract recovery state, Storage reconstruction, preview creation, and confirmed write-back into `useRecoveryWorkflow`; render one shared `RecoveryPreviewModal` from both comparison modes.

**Tech Stack:** JavaScript, React 16 hooks, Jest through project-local `react-scripts`.

## Global Constraints

- Keep the backend `writeRecoveredPage` contract unchanged.
- Never write directly without the existing preview confirmation.
- Do not install dependencies, build, deploy, commit, or push.
- Keep all current Summary recovery behaviour and safety checks.

---

### Task 1: Canonical modified classification

**Files:** `static/hello-world/src/diffDisplay.js`, `diffDisplay.test.js`, `components/SideBySideDiffView.test.js`.

- [ ] Add a failing test with one direct `{ type: 'modified', oldText, newText }` block; expect one canonical modified row and one Side-by-side Modified row.
- [ ] Run the two focused suites with project-local `react-scripts`, `CI=true`, `--watchAll=false`, and `--runInBand`; expect RED.
- [ ] Update `createChangeDisplayRow` to treat a visible direct modified block as both old and current content.
- [ ] Make Side-by-side statistics derive from canonical row kinds, including direct modified blocks.
- [ ] Re-run focused suites; expect GREEN.

### Task 2: Shared recovery workflow

**Files:** Create `static/hello-world/src/useRecoveryWorkflow.js`, `useRecoveryWorkflow.test.js`, and `components/RecoveryPreviewModal.js`; modify `components/ComparisonPanel.js`.

**Interfaces:**
- `useRecoveryWorkflow({ blocks, display, pageId, selectedVersion, currentVersion, onPageUpdated })`
- Returns `blockChoices`, `chooseBlock`, `undoChoice`, `draftPreview`, `openPreview`, `closePreview`, `writeBack`, `confirmWriteBack`, `recoveryStorage`, `renderedPreviewHtml`, and preview-note state.

- [ ] Add failing hook/helper tests for choice-to-Storage reconstruction and comparison-key reset.
- [ ] Extract `buildRecoveryPreviewHtml` and the existing recovery calculations/actions without changing choice semantics (`current` versus `old`).
- [ ] Extract existing preview JSX into `RecoveryPreviewModal`; preserve Storage-error blocking, notes, loading, success, and confirmation.
- [ ] Replace Summary-local recovery state/actions with the hook and shared modal.
- [ ] Run ComparisonPanel, recoveryStorage, workflow, and diffDisplay suites; expect GREEN.

### Task 3: Side-by-side recovery integration and summaries

**Files:** Modify `components/SideBySideDiffView.js`, `SideBySideDiffView.test.js`, and `App.js`.

- [ ] Add failing tests that canonical Side-by-side choices use `old/current`, alter reconstructed preview output, and reset for a new version identity.
- [ ] Replace local cosmetic `rowChoices` with `useRecoveryWorkflow`.
- [ ] Map Keep to `current` and Restore to `old`; render decided state from the shared choice map.
- [ ] Add Preview draft and the shared preview modal; keep confirmed write-back as the only mutation path.
- [ ] Accept and call `onPageUpdated` and `onDiffSummaryChange`; pass both from `App`.
- [ ] Derive comment summary from canonical rows so Summary and Side-by-side agree.
- [ ] Run focused component and workflow suites; expect GREEN.

### Task 4: Error, limited, and responsive states

**Files:** Modify `components/SideBySideDiffView.js`, `SideBySideDiffView.css`, and tests.

- [ ] Add failing render/helper tests for explicit errors and limited current-version preview.
- [ ] Render a visible error and disable recovery when diff construction fails.
- [ ] In limited mode, render prepared current HTML and no “No differences” message.
- [ ] Replace the narrow-screen hide rule with vertical old/current stacking; retain both panes and markers.
- [ ] Add a structural CSS assertion that no narrow rule uses `display: none` for either pane.
- [ ] Run all frontend tests; expect zero failures.
- [ ] Run `git diff --check`, scan conflict markers, and confirm `main` remains aligned with `origin/main` with all work uncommitted.
