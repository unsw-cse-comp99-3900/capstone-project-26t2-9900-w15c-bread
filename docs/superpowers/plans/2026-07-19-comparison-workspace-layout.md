# Comparison Workspace Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared comparison toolbar with persistent bulk recovery choices, a collapsible history focus mode, and a readable draggable Side-by-side split.

**Architecture:** `App` owns comparison-keyed recovery choices and the workspace shell. Both renderers continue to own their presentation-specific diff construction but receive one controlled choice interface, report canonical selectable keys, and register the active Preview action. A focused toolbar and a pure choice reducer keep bulk behaviour testable without duplicating it in the two views.

**Tech Stack:** JavaScript, React 16, Create React App/Jest, Atlassian Forge Custom UI, existing diff/recovery modules, CSS Grid.

## Global Constraints

- Keep all work uncommitted; do not push or create a pull request.
- Do not build, deploy, install, or run Forge commands.
- Do not modify app IDs, site names, manifest identity, dependencies, or lock files.
- Preserve canonical recovery keys, Preview Draft reconstruction, write confirmation, and optimistic version checking.
- Bulk buttons only modify the virtual Draft selection; no Confluence write occurs.
- Side-by-side keeps both complete documents visible in one horizontally scrollable canvas.
- Use the existing dirty team-project working tree because the required Side-by-side implementation is uncommitted on `main`.

---

### Task 1: Shared Choice Model And Controlled Recovery

**Files:**
- Modify: `static/hello-world/src/useRecoveryWorkflow.js`
- Modify: `static/hello-world/src/useRecoveryWorkflow.test.js`

**Interfaces:**
- Produces: `initialRecoveryChoicesState`, `recoveryChoicesReducer(state, action)`, and `useRecoveryChoices(comparisonKey)`.
- Extends: `useRecoveryWorkflow({ ..., recoveryChoices })` so its storage and preview use the controlled map.

- [ ] **Step 1: Write failing reducer tests**

Add tests requiring `choose-all`, `reset-choices`, and comparison identity reset:

```js
const selected = recoveryChoicesReducer(initialRecoveryChoicesState, {
  type: 'choose-all',
  comparisonKey: '2:3',
  keys: ['0:1', '2'],
  choice: 'old',
});
expect(Array.from(selected.blockChoices.entries())).toEqual([
  ['0:1', 'old'],
  ['2', 'old'],
]);
expect(recoveryChoicesReducer(selected, {
  type: 'reset-choices',
  comparisonKey: '2:3',
}).blockChoices.size).toBe(0);
```

- [ ] **Step 2: Run the workflow test and verify RED**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\useRecoveryWorkflow.test.js
```

Expected: FAIL because the shared choice exports do not exist.

- [ ] **Step 3: Implement the shared choice reducer and hook**

The reducer accepts `reset-comparison`, `choose`, `undo`, `choose-all`, and
`reset-choices`. Every mutating action carries `comparisonKey`; mismatched stale
actions return the existing state. `choose-all` creates a new map containing
exactly the supplied unique keys and requested choice.

The hook returns:

```js
{
  comparisonKey,
  blockChoices,
  chooseBlock(key, choice),
  undoChoice(key),
  chooseAll(keys, choice),
  resetChoices()
}
```

- [ ] **Step 4: Make `useRecoveryWorkflow` controlled-choice aware**

When `recoveryChoices` is supplied, use its `blockChoices`, `chooseBlock`, and
`undoChoice`; otherwise retain the existing internal reducer fallback. Use the
effective map for `buildRecoveryStorageHtml`, `buildRecoveryPreviewHtml`, and
`createRecoveryDraft`.

- [ ] **Step 5: Run the focused workflow test and verify GREEN**

Run the command from Step 2. Expected: the suite passes.

### Task 2: Shared Workspace Toolbar And Shell

**Files:**
- Create: `static/hello-world/src/components/ComparisonWorkspaceToolbar.js`
- Create: `static/hello-world/src/components/ComparisonWorkspaceToolbar.test.js`
- Create: `static/hello-world/src/App.test.js`
- Modify: `static/hello-world/src/App.js`
- Modify: `static/hello-world/src/styles.css`

**Interfaces:**
- Consumes: Task 1's `useRecoveryChoices(comparisonKey)`.
- Produces: toolbar callbacks for view, bulk choice, history visibility, and Preview Draft.

- [ ] **Step 1: Write failing toolbar and header tests**

Render the toolbar and require exact labels `Inline`, `Side-by-side`,
`Keep all Current`, `Restore all Historical`, `Reset choices`, `Show history`
or `Hide history`, and `Preview Draft`. Render `App` statically and assert
`.dh-header` contains `Close` but neither view-mode label.

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\ComparisonWorkspaceToolbar.test.js src\App.test.js
```

Expected: FAIL because the toolbar module and new shell do not exist.

- [ ] **Step 3: Implement `ComparisonWorkspaceToolbar`**

The component receives:

```js
{
  activeView,
  onViewChange,
  blockChoices,
  selectableKeys,
  onChooseAll,
  onResetChoices,
  historyCollapsed,
  onToggleHistory,
  onPreviewDraft
}
```

It computes decided count only from unique `selectableKeys`. Bulk and reset
buttons are disabled when their operation would be a no-op. Preview is disabled
when there are no selectable keys or no registered preview callback.

- [ ] **Step 4: Build the App workspace shell**

Remove the header view button. Add comparison-keyed `useRecoveryChoices`, active
selectable-key state, and an active Preview callback ref. Render the toolbar at
the top of `.dh-main`, then render the active view inside
`.dh-workspace-content`.

`handleViewChange(nextView)` changes only the active comparison presentation.
History starts visible and keeps its current visibility across both directions;
only `onToggleHistory` may change it. Pass `recoveryChoices`,
`onSelectableKeysChange`, and `onPreviewActionChange` to both views.

- [ ] **Step 5: Add shell CSS**

Set the sidebar to `288px`; collapse it with the layout modifier. Make main a
zero-padding, overflow-hidden flex column. Give Inline content `16px` padding
and Side-by-side content zero padding with its own scrolling.

- [ ] **Step 6: Run the new tests and verify GREEN**

Run the command from Step 2. Expected: both suites pass.

### Task 3: Wire Both Presentations To The Shared Workspace

**Files:**
- Modify: `static/hello-world/src/components/ComparisonPanel.js`
- Modify: `static/hello-world/src/components/SideBySideDiffView.js`
- Modify: `static/hello-world/src/components/ComparisonPanel.test.js`
- Modify: `static/hello-world/src/components/SideBySideDiffView.test.js`

**Interfaces:**
- Consumes: `recoveryChoices`, `onSelectableKeysChange(keys)`, and `onPreviewActionChange(action)` from `App`.
- Produces: the active renderer's canonical keys and Preview Draft function.

- [ ] **Step 1: Write failing controlled-choice integration tests**

Render each view with a shared choice object. Trigger an individual choice and
assert its callback is used. Re-render the other view with the resulting map and
assert the same canonical choice is active. Require no local Side-by-side view
toggle or duplicate Preview button.

- [ ] **Step 2: Run both component suites and verify RED**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\ComparisonPanel.test.js src\components\SideBySideDiffView.test.js
```

Expected: FAIL because the views do not accept shared choices or report their
active controls.

- [ ] **Step 3: Wire Inline**

Pass `recoveryChoices` into `useRecoveryWorkflow`. Report
`diffDisplay.selectableRows.map(row => row.key)` and the active
`recovery.openPreview` through effects. Remove the local selection-toolbar
header/Preview action while keeping per-change controls and content rendering.

- [ ] **Step 4: Wire Side-by-side**

Perform the same controlled workflow and callback registration. Remove
`ViewToggle`, `sbs-section`, and the local Preview action. Keep version metadata,
stats, full document rows, and divider recovery arrows.

- [ ] **Step 5: Run both component suites and verify GREEN**

Run the command from Step 2. Expected: both suites pass.

### Task 4: Readable Draggable Split

**Files:**
- Modify: `static/hello-world/src/components/SideBySideDiffView.js`
- Modify: `static/hello-world/src/components/SideBySideDiffView.css`
- Modify: `static/hello-world/src/components/SideBySideDiffView.test.js`

**Interfaces:**
- Produces: `clampSplitPercent(value)` and an accessible central separator controlling shared CSS fractional variables.

- [ ] **Step 1: Write failing splitter and CSS tests**

Require clamping at 30/70, `role="separator"`, `aria-valuenow="50"`, a 1040px
minimum canvas, 44px divider, and pane grid minimums of 460px.

- [ ] **Step 2: Run the Side-by-side suite and verify RED**

Use the Task 3 test command with only `SideBySideDiffView.test.js`. Expected:
FAIL against the existing fixed 64px/800px layout.

- [ ] **Step 3: Implement the splitter**

Store `splitPercent` at 50. Pointer movement converts the canvas-relative
horizontal coordinate to a percentage and clamps it. Keyboard Left/Right moves
5 points; Home/End selects 30/70. Apply:

```js
{
  '--sbs-left-fr': `${splitPercent}fr`,
  '--sbs-right-fr': `${100 - splitPercent}fr`,
}
```

to `.sbs-document-canvas` so every row shares the same split.

- [ ] **Step 4: Compact and widen the CSS layout**

Use `min-width: 1040px`,
`grid-template-columns: minmax(460px, var(--sbs-left-fr, 1fr)) 44px minmax(460px, var(--sbs-right-fr, 1fr))`, compact header/row padding, and a visible
col-resize splitter handle. Preserve horizontal overflow and aligned rows.

- [ ] **Step 5: Run the Side-by-side suite and verify GREEN**

Run the focused suite. Expected: it passes.

### Task 5: Regression Verification

**Files:**
- Review only: all files changed by Tasks 1–4

**Interfaces:**
- Consumes: all prior tasks.
- Produces: fresh test evidence without build, deploy, install, or Git mutation.

- [ ] **Step 1: Run the complete frontend suite**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand
```

Expected: all suites and tests pass with exit code 0.

- [ ] **Step 2: Inspect the final diff and constraints**

Confirm the header contains only Close, both modes use shared choices, bulk
buttons never invoke write-back, the sidebar is recoverable after collapse, and
no package, manifest, deployment, personal Spike, commit, or push change was
introduced by this work.
