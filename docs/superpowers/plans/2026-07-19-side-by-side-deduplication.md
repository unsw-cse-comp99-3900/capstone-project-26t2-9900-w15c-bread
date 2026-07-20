# Side-by-side Diff Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Summary and Side-by-side consume one canonical rich-diff display-row model without intentionally changing their UI behaviour.

**Architecture:** Move pure block pairing, row grouping, choice-key, blank-line, and preview helpers out of `ComparisonPanel.js` into `diffDisplay.js`. Keep rendering, state, recovery orchestration, and Forge calls in their current components.

**Tech Stack:** JavaScript, React 16, Jest through `react-scripts`.

## Global Constraints

- Do not change Keep/Restore integration, state reset, responsive layout, labels, statistics, or error presentation.
- Do not refactor mention resolution or Forge calls.
- Do not install dependencies, build, deploy, commit, or push.
- Preserve original diff block indices used by recovery storage.

---

### Task 1: Establish the shared display-row contract

**Files:**
- Create: `static/hello-world/src/diffDisplay.test.js`
- Create: `static/hello-world/src/diffDisplay.js`

**Interfaces:**
- Consumes: rich-diff blocks from `buildRichTextDiffHtml`.
- Produces: `buildDiffDisplayRows(blocks)`, `blockSelectionKey(index)`, and `blockGroupSelectionKey(indices)`.

- [ ] **Step 1: Write failing contract tests**

Test paired removed/added paragraphs, unrelated same-tag paragraphs, blank-line grouping, structural nesting, and preservation of original block indices. The central assertion is:

```js
const result = buildDiffDisplayRows([
  { type: 'removed', nodeType: 'paragraph', tag: 'p', text: 'old text' },
  { type: 'added', nodeType: 'paragraph', tag: 'p', text: 'new text' },
]);
expect(result.selectableRows).toHaveLength(1);
expect(result.selectableRows[0].changeKind).toBe('modified');
expect(result.selectableRows[0].blocks.map(({ index }) => index)).toEqual([0, 1]);
expect(result.blockChoiceKeys.get(0)).toBe(result.blockChoiceKeys.get(1));
```

- [ ] **Step 2: Verify RED**

From `static/hello-world`, run:

```powershell
$env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/diffDisplay.test.js
```

Expected: FAIL because `./diffDisplay` does not exist.

- [ ] **Step 3: Extract minimal implementation**

Move the existing canonical functions from `ComparisonPanel.js` without changing their bodies: key creation, text similarity/alignment, blank-line grouping, row creation, structural nesting, selectable-row collection, and `buildDiffDisplayRows`. Import `isBlankParagraphBlock` from `./utils`.

- [ ] **Step 4: Verify GREEN**

Run the same focused command. Expected: all tests PASS.

### Task 2: Migrate ComparisonPanel

**Files:**
- Modify: `static/hello-world/src/components/ComparisonPanel.js`
- Test: `static/hello-world/src/components/ComparisonPanel.test.js`
- Test: `static/hello-world/src/recoveryStorage.test.js`

**Interfaces:**
- Consumes: the three exports from `../diffDisplay`.
- Produces: unchanged `ComparisonPanel` props and recovery/write-back behaviour.

- [ ] **Step 1: Add a recovery mapping assertion**

Extend `diffDisplay.test.js` to assert every grouped block index maps to its row key in `blockChoiceKeys`.

- [ ] **Step 2: Run focused tests before migration**

Run `diffDisplay.test.js`; expected PASS.

- [ ] **Step 3: Replace local definitions with imports**

Import shared exports and remove only duplicated definitions and their now-unused private helpers. Do not alter JSX, state, effects, recovery calls, or write-back calls.

- [ ] **Step 4: Verify consumer and recovery tests**

```powershell
$env:CI='true'; npm test -- --watchAll=false --runTestsByPath src/diffDisplay.test.js src/components/ComparisonPanel.test.js src/recoveryStorage.test.js
```

Expected: all suites PASS.

### Task 3: Migrate Side-by-side

**Files:**
- Modify: `static/hello-world/src/components/SideBySideDiffView.js`
- Create: `static/hello-world/src/components/SideBySideDiffView.test.js`

**Interfaces:**
- Consumes: `buildDiffDisplayRows(blocks)` from `../diffDisplay`.
- Produces: existing Side-by-side header, stats, panes, labels, and local visual choices.

- [ ] **Step 1: Write a failing consistency test**

Mock a rich diff containing an ambiguous same-tag change run and assert Side-by-side renders the same Modified/separate grouping returned by `buildDiffDisplayRows`.

- [ ] **Step 2: Verify RED**

Run only `SideBySideDiffView.test.js`. Expected: FAIL while the component still uses `pairChangeRun/buildRows`.

- [ ] **Step 3: Replace duplicate row construction**

Use the canonical display rows and keys, adapt `changeKind` to existing Side-by-side labels, and remove `pairChangeRun`, `buildRows`, and unused helpers. Keep current copy and controls unchanged.

- [ ] **Step 4: Verify GREEN**

Run Side-by-side, shared-model, ComparisonPanel, and recovery-storage suites. Expected: all PASS.

### Task 4: Final verification

- [ ] **Step 1: Run all frontend tests**

Run `npm test -- --watchAll=false` with `CI=true` from `static/hello-world`. Expected: zero failures.

- [ ] **Step 2: Inspect the diff**

Run `git diff --check` and review the three production files. Expected: no conflict markers or whitespace errors; props, copy, and write-back code remain unchanged.

- [ ] **Step 3: Confirm repository state**

Run `git status --short --branch`. Expected: all feature and refactor changes remain uncommitted, and `main` still points to `origin/main`.
