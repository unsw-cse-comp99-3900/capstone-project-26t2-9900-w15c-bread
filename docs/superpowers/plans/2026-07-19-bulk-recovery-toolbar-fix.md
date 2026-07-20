# Bulk Recovery And History Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent bulk recovery choices from blanking the app and clarify recovery, publishing, and History controls.

**Architecture:** Keep the existing shared recovery-choice state. Export the already-canonical resolved-preview helpers and consume them from Inline rendering, then move History visibility into a small layout rail while keeping comparison actions in the workspace toolbar. Wrap only the active comparison surface in an error boundary so header, History, and controls remain available after a renderer failure.

**Tech Stack:** React 16, Jest/react-dom test utilities, CSS, Atlassian Forge Custom UI.

## Global Constraints

- Keep `Reset choices`; it clears explicit decisions and returns progress to zero.
- Do not expose a bulk Current action. Use `Restore Historical for All`, `Review & Publish`, and `Publish to Current Page` labels.
- History is visible by default and changes only through the left-edge 36px rail.
- Do not add dependencies, change Forge identity, deploy, commit, or push.

---

### Task 1: Reproduce And Fix Resolved Inline Rendering

**Files:**
- Modify: `static/hello-world/src/useRecoveryWorkflow.js`
- Modify: `static/hello-world/src/components/recoveryDiffDisplay.js`
- Modify: `static/hello-world/src/components/ComparisonPanel.js`
- Test: `static/hello-world/src/components/ComparisonPanel.test.js`

**Interfaces:**
- Produces: exported `getBlockRenderedPreviewHtml(block, useCurrent)` and `blankLineRunSummaryHtml(block, suffix)` helpers.
- Consumes: resolved `Map<choiceKey, 'current' | 'old'>` selections.

- [ ] Add a mounted `ComparisonPanel` test with every selectable key set to Current and verify resolved content renders without throwing.
- [ ] Run the focused test and verify it fails with the missing helper `ReferenceError`.
- [ ] Export and import the two existing canonical helpers; do not duplicate their implementations.
- [ ] Re-run the focused test and verify it passes for Current and Historical bulk selections.

### Task 2: Clarify Toolbar And History Rail

**Files:**
- Modify: `static/hello-world/src/components/ComparisonWorkspaceToolbar.js`
- Modify: `static/hello-world/src/components/ComparisonWorkspaceToolbar.test.js`
- Modify: `static/hello-world/src/App.js`
- Modify: `static/hello-world/src/App.test.js`
- Modify: `static/hello-world/src/styles.css`

**Interfaces:**
- Consumes: existing `onChooseAll`, `onResetChoices`, `onToggleHistory`, and `onPreviewDraft` callbacks.
- Produces: toolbar without History control and `.dh-history-rail` with accessible expand/collapse button.

- [ ] Update tests first for the approved labels, retained Reset behavior, and History rail placement.
- [ ] Run focused toolbar/App tests and verify they fail on old labels and placement.
- [ ] Rename toolbar actions, remove History props from the toolbar, and render the rail next to the sidebar in `App`.
- [ ] Add the 36px rail CSS and responsive behavior, then re-run focused tests.

### Task 3: Add Comparison Failure Containment

**Files:**
- Create: `static/hello-world/src/components/ComparisonErrorBoundary.js`
- Create: `static/hello-world/src/components/ComparisonErrorBoundary.test.js`
- Modify: `static/hello-world/src/App.js`
- Modify: `static/hello-world/src/styles.css`

**Interfaces:**
- Produces: `ComparisonErrorBoundary` with a comparison-key reset and retry action.
- Consumes: one active comparison renderer as children.

- [ ] Write a test with a throwing child and assert a visible error/retry surface instead of an empty tree.
- [ ] Run it and verify failure because the boundary does not exist.
- [ ] Implement the minimal class error boundary and wrap the active comparison surface.
- [ ] Re-run the focused boundary/App tests.

### Task 4: Final Verification

**Files:**
- Verify all modified frontend files and design documentation.

- [ ] Run the complete frontend test suite and require all tests to pass.
- [ ] Run the frontend production build and require success.
- [ ] Inspect the local mock UI at both wide and narrow viewport widths, exercising both bulk actions, Reset, both comparison modes, the History rail, and Review & Publish without performing a write.
- [ ] Review `git diff` to confirm no unrelated files, manifest identity, deployment configuration, lock files, commits, or pushes changed.
