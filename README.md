# Dynamic History

Dynamic History is a Confluence Forge content action app for viewing page
version history, comparing a selected historical version with the current
version, and creating an unpublished Confluence draft from a chosen recovery
result.

This app was originally created from a Forge Custom UI template, so the frontend
folder is still named `static/hello-world`.

## Project Map

Paths below are relative to the `9900` project folder.

```text
manifest.yml
  Forge app manifest. Defines the Confluence content action, Custom UI resource,
  resolver function, scopes, and runtime.

src/index.js
  Backend Forge resolver. Fetches Confluence page versions, attachments, authors,
  and creates unpublished draft pages.

static/hello-world/src/App.js
  Frontend entry point. Loads Forge bridge data in Confluence and mock data in
  local development.

static/hello-world/src/components/Timeline.js
static/hello-world/src/components/VersionCard.js
  Version timeline UI.

static/hello-world/src/components/ComparisonPanel.js
  Main comparison UI. Calls the rich diff helper, renders selectable change
  blocks, opens Draft Preview, and sends selected storage HTML to createDraft.

static/hello-world/src/utils.js
  Core rich-text handling. Converts Confluence storage HTML into safe preview
  HTML, splits content into semantic blocks, builds type-specific diffs, and
  keeps raw storage HTML available for draft reconstruction.

static/hello-world/src/styles.css
  Layout, timeline, rich preview, diff, unsupported fallback, task, panel, and
  whiteboard card styles.

static/hello-world/src/mockData.js
  Local mock page versions for development outside Confluence.

static/hello-world/src/utils.test.js
  Focused tests for rich-text normalization, block-level recovery behavior,
  type-specific diffs, unsupported content, and preview safety.
```

## Forge Structure

`manifest.yml` defines one `confluence:contentAction` named `Dynamic History`.
The module serves the Custom UI bundle from:

```text
static/hello-world/build
```

The backend resolver is declared in:

```text
src/index.js
```

Current scopes:

```text
read:page:confluence
read:attachment:confluence
read:confluence-user
write:page:confluence
```

The resolver uses `api.asUser().requestConfluence(...)` for Confluence REST API
calls so access follows the invoking user's Confluence permissions.

## Backend Flow

`src/index.js` exposes two important resolver actions.

### getPageVersions

Fetches the page data needed by the frontend:

1. Current page metadata and title.
2. All page versions, newest first.
3. Storage-format body HTML for each version.
4. Page attachments, used to resolve image attachment macros.
5. Author display names where available.

The frontend expects each version body as Confluence storage HTML:

```js
{
  body: {
    representation: 'storage',
    value: '<p>...</p>'
  }
}
```

### createDraft

Creates an unpublished Confluence page beside the source page. The frontend
sends a reconstructed storage HTML string based on the user's selected recovery
choices. Unsupported or complex blocks must remain as their original storage
markup; they must not be converted into plain text.

## Frontend Flow

`static/hello-world/src/App.js`:

1. Loads `@forge/bridge` only inside Confluence.
2. Calls `invoke('getPageVersions')`.
3. Falls back to `mockData` during local preview.
4. Tracks the selected historical version.
5. Renders the timeline and `ComparisonPanel`.

`ComparisonPanel.js` compares:

```text
selected historical version -> current version
```

So:

- added content means it exists in the current version but not in the selected
  historical version;
- removed content means it existed in the selected historical version but no
  longer exists in the current version.

For changed blocks, the user can choose:

```text
Keep current change
Restore old content
```

The Draft Preview modal shows the reconstructed result first. The final create
button calls `createDraft`; previewing alone does not write to Confluence.

## Rich Text Handling

The main entry point is:

```js
buildRichTextDiffHtml(oldHtml, currentHtml, baseUrl, attachmentsByFilename)
```

Location:

```text
static/hello-world/src/utils.js:1601
  buildRichTextDiffHtml
```

The function returns renderable preview HTML plus a structured block list:

```js
{
  html: string,
  blocks: [
    {
      type: 'same' | 'added' | 'removed' | 'modified',
      nodeType: string,
      html?: string,
      renderedHtml?: string,
      oldHtml?: string,
      newHtml?: string,
      oldRenderedHtml?: string,
      newRenderedHtml?: string,
      text?: string,
      oldText?: string,
      newText?: string,
      inline?: Array,
      tableDiff?: object,
      taskDiff?: object,
      supportLevel?: 'full' | 'raw',
      rawPreview?: string,
      added?: number,
      removed?: number,
      limited?: boolean
    }
  ],
  summary: {
    added: number,
    removed: number,
    addedBlocks: number,
    removedBlocks: number,
    modifiedBlocks: number,
    unchangedBlocks: number,
    limited: boolean
  }
}
```

Important distinction:

```text
html / oldHtml / newHtml
  Storage HTML used for reconstruction and draft creation.

renderedHtml / oldRenderedHtml / newRenderedHtml
  Safe readable preview HTML used only for display.
```

This separation is intentional. The app can show a readable fallback card for a
macro or smart link while still preserving the original Confluence storage markup
for draft creation.

## Current Diff Policy

The diff policy is conservative because Confluence documents are semantic rich
documents, not plain text files.

### Paragraphs and Headings

Paragraphs and headings are block-level comparison and recovery units.

If a paragraph or heading changes, the app shows the old block and the new block
as block-level removed/added or modified content. It does not split paragraph or
heading content into word-level, character-level, or line-level inline diff.

Reason:

```text
Paragraphs and headings are semantic units in Confluence pages. Keeping them as
whole recovery units makes draft reconstruction safer, especially for Chinese
and natural-language content.
```

Implementation locations:

```text
static/hello-world/src/utils.js:1249
  canPairForInlineDiff

static/hello-world/src/utils.js:1451
  buildModifiedBlockDiff

static/hello-world/src/utils.js:1494
  buildBlockLevelModifiedDiff
```

### Lists and Tasks

Lists are split by item when possible. This prevents one small list item change
from turning the whole list into a large changed block.

Task items preserve both:

```text
checkbox state
task text
```

Task storage HTML is kept for reconstruction. The preview uses readable markers:

```text
[x] completed task
[ ] incomplete task
```

Implementation locations:

```text
static/hello-world/src/utils.js:310
  expandConfluenceTaskLists

static/hello-world/src/utils.js:828
  extractComparableBlocksFromPreparedNode

static/hello-world/src/utils.js:1515
  buildTaskItemDiff

static/hello-world/src/styles.css:344
  [data-dh-node-type='task_item']

static/hello-world/src/styles.css:348
  [data-dh-task-marker='true']
```

### Code Blocks

Confluence code macros are converted into safe preview HTML:

```html
<pre data-dh-node-type="code_block"><code>...</code></pre>
```

Code content is escaped before rendering. Code blocks are compared line by line
so indentation and whitespace remain meaningful.

Implementation locations:

```text
static/hello-world/src/utils.js:193
  expandConfluenceCodeMacros

static/hello-world/src/utils.js:1279
  buildCodeBlockDiff
```

### Tables

Tables use table-specific diff logic.

If old and current tables have compatible row and cell structure, the app uses
cell-level comparison.

If table shape is incompatible, the app uses a safer side-by-side table fallback
instead of forcing two different structures into one table.

Implementation locations:

```text
static/hello-world/src/utils.js:1439
  buildTableDiff

static/hello-world/src/utils.js:1342
  buildCellLevelTableDiff

static/hello-world/src/utils.js:1403
  buildSideBySideTableDiff
```

### Panels and Quotes

Panels and blockquotes are readable block-level diffs. They are not split into
fragile inline fragments.

Known Confluence panel-like structured macros are rendered into readable preview
blocks where possible:

```text
info
note
warning
tip
success
error
panel
```

Implementation locations:

```text
static/hello-world/src/utils.js:446
  expandKnownStructuredMacros

static/hello-world/src/utils.js:1494
  buildBlockLevelModifiedDiff

static/hello-world/src/styles.css:357
  [data-dh-node-type='panel']
```

### Unsupported Content

Unsupported content must never become blank, deleted, or silently converted into
plain text.

Normal preview shows a readable fallback card:

```text
Unsupported Confluence block
Type: ...
This block cannot be fully rendered by this app. Original data is preserved.
```

The raw inspector shows the original raw HTML or JSON as escaped plain text. Raw
content is not rendered with `dangerouslySetInnerHTML`.

Normal preview must not expose internal implementation fields such as:

```text
UUIDs
macro IDs
XML gadget URLs
extension keys
localIds
statusIds
color values
```

Implementation locations:

```text
static/hello-world/src/utils.js:292
  createRawFallbackHtml

static/hello-world/src/utils.js:242
  cleanUserFacingName

static/hello-world/src/utils.js:498
  expandUnsupportedStorageNodes

static/hello-world/src/utils.js:354
  expandAdfNodes

static/hello-world/src/utils.js:624
  visibleTextContent

static/hello-world/src/styles.css:465
  [data-dh-node-type='unsupported']

static/hello-world/src/styles.css:478
  [data-dh-raw-inspector='true']
```

## Confluence Storage Normalization

Preview rendering starts with:

```text
prepareConfluenceHtml
```

Location:

```text
static/hello-world/src/utils.js:512
  prepareConfluenceHtml
```

It expands a safe subset of Confluence storage HTML into display HTML:

```text
Confluence links
image attachments
code macros
task lists
panel-like macros
ADF status, emoji, mention, date, task, decision, smart link nodes
unsupported macros/extensions
whiteboard smart links
```

After expansion, it sanitizes tags and attributes before returning preview HTML.
Allowed data attributes are used only for app-specific rendering and diff
classification.

## Whiteboard Cards

Whiteboard links are rendered as readable Confluence-style cards in preview.

If storage contains a title, the card uses that title, for example:

```text
Untitled whiteboard 2026-06-30
```

If storage does not contain a title, the card uses:

```text
Untitled whiteboard
```

The preview does not show the raw whiteboard URL as normal text. The original
link or ADF smart-link storage remains available for reconstruction.

Implementation locations:

```text
static/hello-world/src/utils.js:125
  isWhiteboardUrl

static/hello-world/src/utils.js:129
  cleanWhiteboardTitle

static/hello-world/src/utils.js:133
  renderWhiteboardCard

static/hello-world/src/utils.js:152
  expandConfluenceLinks

static/hello-world/src/utils.js:344
  expandWhiteboardAnchors

static/hello-world/src/utils.js:354
  expandAdfNodes

static/hello-world/src/styles.css:364
  [data-dh-node-type='whiteboard_card']

static/hello-world/src/styles.css:378
  [data-dh-whiteboard-icon='true']

static/hello-world/src/styles.css:430
  [data-dh-whiteboard-product='true']

static/hello-world/src/styles.css:455
  [data-dh-whiteboard-open='true']
```

## Block Extraction and Big Diff Prevention

One issue fixed during this work was Confluence layout or wrapper markup causing
large page sections to be treated as one giant diff block.

The current logic treats layout wrappers and ordinary containers as transparent
when they contain semantic child blocks.

Implementation locations:

```text
static/hello-world/src/utils.js:758
  hasBlockElementChildren

static/hello-world/src/utils.js:766
  isTransparentContainer

static/hello-world/src/utils.js:778
  isRawTransparentContainer

static/hello-world/src/utils.js:790
  collectRawBlockNodes

static/hello-world/src/utils.js:828
  extractComparableBlocksFromPreparedNode

static/hello-world/src/utils.js:865
  extractDiffBlocks
```

This allows tables, tasks, panels, whiteboard cards, headings, paragraphs, and
other blocks to be compared separately instead of as one page-sized block.

## Draft Reconstruction Safety

Draft reconstruction is handled in the frontend by `ComparisonPanel.js`.

Important rule:

```text
The component chooses between oldHtml and newHtml for recovery.
It should not reconstruct complex Confluence storage from rendered preview HTML.
```

This protects unsupported macros, extensions, whiteboards, and other complex
storage nodes from being degraded into plain text.

Implementation location:

```text
static/hello-world/src/components/ComparisonPanel.js:30
  getSelectedBlockHtml

static/hello-world/src/components/ComparisonPanel.js:60
  renderDraftBlock

static/hello-world/src/components/ComparisonPanel.js:197
  buildRichTextDiffHtml call site

static/hello-world/src/components/ComparisonPanel.js:319
  createDraft invocation
```

## Tests

Focused tests live in:

```text
static/hello-world/src/utils.test.js
```

Current coverage includes:

```text
static/hello-world/src/utils.test.js:10
  low-similarity paragraph replacement stays atomic

static/hello-world/src/utils.test.js:41
  paragraph remains a block-level recovery unit without inline diff

static/hello-world/src/utils.test.js:59
  heading remains a block-level recovery unit without inline diff

static/hello-world/src/utils.test.js:75
  list additions are compared by item

static/hello-world/src/utils.test.js:90
  task checkbox state and text changes are captured by task item

static/hello-world/src/utils.test.js:113
  unsupported block renders a readable non-blank fallback

static/hello-world/src/utils.test.js:145
  unsupported raw content is preserved for reconstruction

static/hello-world/src/utils.test.js:156
  transparent containers are split into semantic child blocks

static/hello-world/src/utils.test.js:171
  Confluence layout containers do not become one giant diff block

static/hello-world/src/utils.test.js:199
  ADF internals are not mixed into normal preview text

static/hello-world/src/utils.test.js:235
  whiteboard links render as readable cards while preserving raw link storage

static/hello-world/src/utils.test.js:250
  ADF whiteboard smart links render as readable cards
```

Run the focused test suite from:

```powershell
cd C:\Users\28055\Desktop\COMP9900\9900\static\hello-world
npx.cmd react-scripts test --watchAll=false --runTestsByPath src/utils.test.js
```

Last verified result:

```text
Test Suites: 1 passed
Tests: 14 passed
```

Jest may print a warning that it did not exit immediately because of open
handles. The build also prints the existing Create React App warning about
`babel-preset-react-app`. Those warnings were not introduced by the rich-text
changes.

## Build and Deploy

Build the Custom UI bundle:

```powershell
cd /d C:\Users\28055\Desktop\COMP9900\9900\static\hello-world
npm run build
```

Deploy to the `jzm-dev` Forge environment from the Forge app root:

```powershell
cd /d C:\Users\28055\Desktop\COMP9900\9900
forge deploy --non-interactive -e jzm-dev
```

`npm install --legacy-peer-deps` is not required every time. Use it only when
dependencies are missing, `node_modules` was removed, or `package.json` /
`package-lock.json` dependencies changed.

After the latest build, the generated frontend assets were:

```text
static/hello-world/build/static/js/main.1a61e3f5.js
static/hello-world/build/static/css/main.11df5e68.css
```

After deploying, the browser should load those hashes from the Forge iframe. If
the page still loads an older `main.*.js`, the deployed environment or browser
cache is not using the latest build.

## Today's Rich Text Changes

The main changes made in this round:

```text
static/hello-world/src/utils.js:512
  Added/updated the normalization and dispatch layer.

static/hello-world/src/utils.js:1249
  Kept paragraph and heading as block-level recovery units.

static/hello-world/src/utils.js:310
  Added list/task item handling.

static/hello-world/src/utils.js:1279
  Preserved code block line diff.

static/hello-world/src/utils.js:1342
  Preserved table row/cell diff when structure is compatible.

static/hello-world/src/utils.js:354
  Added safer panel, quote, unsupported, ADF, and whiteboard handling.

static/hello-world/src/utils.js:699
  Separated storage HTML from rendered preview HTML.

static/hello-world/src/utils.js:242
  Prevented internal IDs, gadget URLs, localIds, extension keys, colors, and
  status internals from leaking into normal preview text.

static/hello-world/src/components/ComparisonPanel.js:30
  Kept complex reconstruction logic out of the component.

static/hello-world/src/components/ComparisonPanel.js:197
  Used structured diff blocks for user recovery choices.

static/hello-world/src/components/ComparisonPanel.js:30
  Preserved oldHtml/newHtml for draft reconstruction.

static/hello-world/src/components/ComparisonPanel.js:60
  Used rendered preview HTML only for display.

static/hello-world/src/styles.css:344
  Added minimal styles for tasks, panels, unsupported fallback cards, raw
  inspector, and whiteboard cards.

static/hello-world/src/mockData.js:31
  Added small mock content for list, task, table, code, panel, quote, and
  unsupported blocks.

static/hello-world/src/utils.test.js:41
  Added focused tests for block-level paragraph/heading behavior, list/task
  diffs, unsupported fallback safety, raw preservation, container splitting, ADF
  cleanup, and whiteboard card rendering.
```

## Development Notes

- Build `static/hello-world` before Forge deploy because Forge serves the
  generated `static/hello-world/build` resource.
- Use `api.asUser()` for user-facing Confluence REST API access.
- Do not use `--no-verify` for deploy unless explicitly requested.
- If scopes or permissions in `manifest.yml` change, redeploy and then reinstall
  or upgrade the app.
- Keep `mockData.js` aligned with the resolver response shape.
- Do not move draft reconstruction into the visual preview layer.
- Do not use `dangerouslySetInnerHTML` for raw storage display.
- Unsupported content must remain recoverable even when preview rendering is
  incomplete.
