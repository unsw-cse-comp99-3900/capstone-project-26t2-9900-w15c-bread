# Full-Document Split Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the change-card Side-by-side surface with a VS Code-style full-document split diff whose historical and current blocks stay horizontally aligned and whose divider arrows drive the existing recovery workflow.

**Architecture:** A new pure `splitDiffModel.js` projects canonical diff rows into complete document rows, including unchanged context, stable recovery keys, actual version-side semantics, and safe side-specific HTML. `SideBySideDiffView.js` becomes the rendering/integration layer, while CSS changes the old four-column card layout into a horizontally scrollable three-column document grid.

**Tech Stack:** JavaScript, React 16, Create React App/Jest, Atlassian Forge Custom UI, existing `diffDisplay`, `useRecoveryWorkflow`, and `recoveryStorage` modules.

## Global Constraints

- Left is the complete read-only selected historical version, labelled `Historical / vN`.
- Right is the complete read-only current version, labelled `Current / vM`.
- Unchanged content is always visible on both sides.
- `→` selects Historical (`choice = old`); `←` selects Current (`choice = current`).
- Arrow selection never mutates either source pane; Preview Draft remains the combined result.
- Original block indices, canonical choice keys, recovery storage reconstruction, optimistic version checking, and write-back confirmation remain unchanged.
- The narrow view keeps both panes side by side inside a horizontally scrollable canvas; neither pane is hidden or stacked.
- No dependency changes or installations.
- Keep all work uncommitted; do not push or create a pull request.
- Never deploy the team Forge app or target the team Confluence site.
- After verification, mirror source into `C:\Users\29546\Documents\9900\confluence-history-api-spike` and deploy only its `development` environment to `bread-test.atlassian.net`.

---

### Task 1: Build The Full-Document Split Row Model

**Files:**
- Create: `static/hello-world/src/components/splitDiffModel.js`
- Create: `static/hello-world/src/components/splitDiffModel.test.js`
- Modify: `static/hello-world/src/utils.js`

**Interfaces:**
- Consumes: `buildDiffDisplayRows(blocks)` and each block's old/current rendered HTML, text, type, and original index.
- Produces: `buildFullDocumentSplitRows(blocks)`, `buildFullDocumentSplitStats(rows)`, and `getSplitBlockHtml(block, side)`.

- [ ] **Step 1: Write failing row-projection tests**

Create tests that require all context and actual version semantics:

```js
import {
  buildFullDocumentSplitRows,
  buildFullDocumentSplitStats,
} from './splitDiffModel';

const paragraph = (type, text) => ({
  type,
  nodeType: 'paragraph',
  tag: 'p',
  text,
  renderedHtml: `<p>${text}</p>`,
  oldHtml: type === 'removed' ? `<p>${text}</p>` : '',
  newHtml: type === 'added' ? `<p>${text}</p>` : '',
});

test('keeps unchanged context and aligns each version side in document order', () => {
  const rows = buildFullDocumentSplitRows([
    paragraph('same', 'Heading context'),
    paragraph('removed', 'Historical wording'),
    paragraph('added', 'Current wording'),
    paragraph('removed', 'Historical only'),
    paragraph('added', 'Current only'),
    paragraph('same', 'Ending context'),
  ]);

  expect(rows.map(({ kind }) => kind)).toEqual([
    'unchanged',
    'modified',
    'modified',
    'unchanged',
  ]);
  expect(rows[0]).toMatchObject({
    historical: expect.objectContaining({ text: 'Heading context' }),
    current: expect.objectContaining({ text: 'Heading context' }),
  });
  expect(rows[3].historical.text).toBe('Ending context');
  expect(rows[3].current.text).toBe('Ending context');
});

test('uses actual version semantics for one-sided rows and stats', () => {
  const rows = buildFullDocumentSplitRows([
    paragraph('removed', 'Only historical'),
    paragraph('same', 'Anchor'),
    paragraph('added', 'Only current'),
  ]);

  expect(rows.map(({ kind }) => kind)).toEqual([
    'historical-only',
    'unchanged',
    'current-only',
  ]);
  expect(buildFullDocumentSplitStats(rows)).toEqual({
    additions: 1,
    removals: 1,
    modified: 0,
    total: 2,
  });
});
```

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\splitDiffModel.test.js
```

Expected: FAIL because `splitDiffModel` does not exist.

- [ ] **Step 3: Implement the canonical full-document projection**

Create these public functions:

```js
export function buildFullDocumentSplitRows(blocks) {
  const display = buildDiffDisplayRows(blocks || []);
  const rows = [];
  appendDisplayRows(display.rows, rows);
  return rows;
}

export function buildFullDocumentSplitStats(rows) {
  const stats = (rows || []).reduce((result, row) => {
    if (row.kind === 'current-only') result.additions++;
    if (row.kind === 'historical-only') result.removals++;
    if (['modified', 'layout-width'].includes(row.kind)) result.modified++;
    return result;
  }, { additions: 0, removals: 0, modified: 0 });
  return { ...stats, total: stats.additions + stats.removals + stats.modified };
}
```

`appendDisplayRows` must:

- recurse through `layout_structure` rows without rendering boundary-only cards;
- emit `layout-width` before the layout children when a width choice exists;
- emit every non-boundary `same` block as `unchanged` with both sides populated;
- emit paired or direct modifications as `modified`;
- emit raw removed rows as `historical-only`;
- emit raw added rows as `current-only`;
- preserve `row.key` and all original `indices`.

- [ ] **Step 4: Add safe side-specific HTML tests**

```js
import { getSplitBlockHtml } from './splitDiffModel';

test('never mirrors decorated modified HTML into both source panes', () => {
  const block = {
    type: 'modified',
    oldRenderedHtml: '<p>Historical</p>',
    newRenderedHtml: '<p>Current</p>',
    renderedHtml: '<p>Combined decoration</p>',
  };
  expect(getSplitBlockHtml(block, 'historical')).toBe('<p>Historical</p>');
  expect(getSplitBlockHtml(block, 'current')).toBe('<p>Current</p>');
});
```

Implement the helper so modified rows never use combined `renderedHtml` as a
side fallback. One-sided blocks may use `renderedHtml` because it already belongs
to their only source side.

- [ ] **Step 5: Run the model tests and focused canonical tests**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\splitDiffModel.test.js src\diffDisplay.test.js src\recoveryStorage.test.js
```

Expected: all selected suites pass.

### Task 2: Replace Card Controls With The Central Merge Divider

**Files:**
- Modify: `static/hello-world/src/components/SideBySideDiffView.js`
- Modify: `static/hello-world/src/components/SideBySideDiffView.test.js`

**Interfaces:**
- Consumes: Task 1's `buildFullDocumentSplitRows`, `buildFullDocumentSplitStats`, and `getSplitBlockHtml`.
- Produces: A three-column full-document renderer wired to `useRecoveryWorkflow`.

- [ ] **Step 1: Write failing complete-body rendering tests**

Add an interaction render containing unchanged, modified, historical-only, and
current-only content. Assert:

```js
expect(container.textContent).toContain('Historical / v2');
expect(container.textContent).toContain('Current / v3');
expect(container.querySelectorAll('[data-split-row-kind="unchanged"]')).not.toHaveLength(0);
expect(container.querySelector('[data-split-side="historical"]').textContent).toContain('Stable context');
expect(container.querySelector('[data-split-side="current"]').textContent).toContain('Stable context');
expect(container.querySelector('[aria-label="Restore historical content"]')).not.toBeNull();
expect(container.querySelector('[aria-label="Keep current content"]')).not.toBeNull();
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\SideBySideDiffView.test.js
```

Expected: FAIL because the old labels, controls column, and change-only rows are still rendered.

- [ ] **Step 3: Switch the component to the full-document model**

Replace the local row builder/stats/HTML helpers with imports from
`splitDiffModel`. Remove the `showUnchanged` behavior toggle: complete context is
mandatory. Use these labels:

```js
const historicalLabel = `Historical / v${selectedVersion.number}`;
const currentLabel = `Current / v${currentVersion.number}`;
```

Render every row as:

```jsx
<div className="sbs-row" data-split-row-kind={row.kind}>
  <div className="sbs-pane-column" data-split-side="historical">...</div>
  <DividerControls row={row} choice={choice} onChoose={onChoose} />
  <div className="sbs-pane-column" data-split-side="current">...</div>
</div>
```

The missing side renders an equal-height placeholder because both panes share
the same parent grid row.

- [ ] **Step 4: Implement accessible directional controls**

Changed rows render:

```jsx
<button
  aria-label="Restore historical content"
  className={choice === 'old' ? 'sbs-merge-arrow sbs-merge-arrow--active' : 'sbs-merge-arrow'}
  onClick={() => onChoose(choice === 'old' ? null : 'old')}
  title="Use Historical in Draft"
  type="button"
>→</button>
<button
  aria-label="Keep current content"
  className={choice === 'current' ? 'sbs-merge-arrow sbs-merge-arrow--active' : 'sbs-merge-arrow'}
  onClick={() => onChoose(choice === 'current' ? null : 'current')}
  title="Use Current in Draft"
  type="button"
>←</button>
```

Unchanged rows render only the central guide. Selected rows also expose an Undo
button that calls `onChoose(null)`.

- [ ] **Step 5: Verify arrow semantics through Preview Draft**

Extend the existing interaction test:

```js
act(() => container.querySelector('[aria-label="Restore historical content"]').click());
act(() => findButton(container, 'Preview Draft').click());
expect(container.querySelector('.dh-rich-page--preview').textContent).toContain('Historical wording');

act(() => container.querySelector('[aria-label="Close draft preview"]').click());
act(() => container.querySelector('[aria-label="Keep current content"]').click());
act(() => findButton(container, 'Preview Draft').click());
expect(container.querySelector('.dh-rich-page--preview').textContent).toContain('Current wording');
```

- [ ] **Step 6: Run component and workflow tests**

Run:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand --runTestsByPath src\components\SideBySideDiffView.test.js src\useRecoveryWorkflow.test.js src\components\ComparisonPanel.test.js
```

Expected: all selected suites pass.

### Task 3: Implement The VS Code-Style Split Layout And Responsive Canvas

**Files:**
- Modify: `static/hello-world/src/components/SideBySideDiffView.css`
- Modify: `static/hello-world/src/components/SideBySideDiffView.test.js`

**Interfaces:**
- Consumes: Task 2's `sbs-row`, `sbs-pane-column`, and central divider markup.
- Produces: Equal-height aligned rows, a visual central divider, sticky headings, and narrow-screen horizontal scrolling.

- [ ] **Step 1: Write failing CSS contract tests**

Assert the stylesheet contains:

```js
expect(css).toMatch(/\.sbs-document-canvas\s*\{[\s\S]*min-width:\s*800px/);
expect(css).toMatch(/\.sbs-document-scroll\s*\{[\s\S]*overflow-x:\s*auto/);
expect(css).toMatch(/\.sbs-row\s*\{[\s\S]*grid-template-columns:\s*minmax\([^;]+\)\s+64px\s+minmax/);
expect(css).not.toMatch(/@media[\s\S]*\.sbs-row\s*\{[\s\S]*flex-direction:\s*column/);
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run the Side-by-side test suite and expect failure against the old flex/stacked
layout.

- [ ] **Step 3: Replace the four-column card layout**

Implement:

```css
.sbs-document-scroll {
  overflow-x: auto;
}

.sbs-document-canvas {
  min-width: 800px;
}

.sbs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
  align-items: stretch;
}

.sbs-divider {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
```

The divider's vertical guide spans every row. Pane backgrounds and borders are
applied by row kind, not by recovery-effect labels. The heading row uses the same
three columns so labels align with the body.

- [ ] **Step 4: Preserve split alignment on narrow screens**

Remove the mobile column stacking rule. Keep `min-width: 800px` and horizontal
scrolling. Ensure no CSS selector hides either `[data-split-side]` pane.

- [ ] **Step 5: Run the Side-by-side component/CSS tests**

Expected: full-document markup and responsive CSS tests pass.

### Task 4: Complete Regression Review And Personal-Only Deployment

**Files:**
- Mirror: `src/index.js`
- Mirror: `static/hello-world/src/**`
- Generate in personal project: `static/hello-world/build/**`
- Preserve in personal project: `manifest.yml`, frontend package files, personal app ID, and Spike title.

**Interfaces:**
- Consumes: Tasks 1-3's complete team working-tree implementation.
- Produces: Verified personal Spike deployment only.

- [ ] **Step 1: Run the complete team frontend suite**

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand
```

Expected: every test suite passes.

- [ ] **Step 2: Run static safety checks**

```powershell
git diff --check
rg -n "^(<<<<<<<|=======|>>>>>>>)" static\hello-world\src
```

Expected: diff check succeeds and conflict-marker search returns no matches.

- [ ] **Step 3: Mechanically mirror source into the personal Spike**

Resolve both absolute roots, verify they are distinct and under
`C:\Users\29546\Documents\9900`, then copy only `src/index.js` and
`static/hello-world/src/**`. Do not copy either manifest, package file,
repository metadata, node_modules, or build output.

- [ ] **Step 4: Verify personal identity before validation**

```powershell
Select-String -Path manifest.yml -Pattern 'b360e5c9-e1ec-4c0d-8bf8-b5f6a4e0dedd','Dynamic History \(Spike\)','write:page:confluence'
```

Expected: all personal markers match and the team app ID is absent.

- [ ] **Step 5: Test and build the personal frontend**

From `static/hello-world` in the personal Spike:

```powershell
$env:CI='true'
& '.\node_modules\.bin\react-scripts.cmd' test --watchAll=false --runInBand
npm run build
```

Expected: all tests pass and the production build compiles successfully.

- [ ] **Step 6: Lint and deploy only the personal app**

From the personal Forge app root:

```powershell
pwd
forge lint
forge deploy --non-interactive -e development
forge install --non-interactive --upgrade --site bread-test.atlassian.net --product confluence --environment development
```

Expected: lint reports no issues, the personal development deployment succeeds,
and the personal site upgrade completes. Stop before install if deploy fails.

- [ ] **Step 7: Preserve the uncommitted working trees**

Report the changed files, test/build/lint/deploy results, and explicitly confirm
that no commit, push, team deployment, or team-site installation occurred.
