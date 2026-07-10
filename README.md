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
2. The live current-page storage body from the page-by-id endpoint.
3. All page versions, newest first.
4. Storage-format body HTML for each historical version.
5. Page attachments, used to resolve image attachment macros.
6. Author display names where available.

The newest version uses the live current-page body when it is available. This
avoids incomplete current-vs-current previews when the versions response omits
or truncates complex storage content. Historical versions continue to use the
versions endpoint.

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
static/hello-world/src/utils.js
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
static/hello-world/src/utils.js
  canPairForInlineDiff

static/hello-world/src/utils.js
  buildModifiedBlockDiff

static/hello-world/src/utils.js
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
static/hello-world/src/utils.js
  expandConfluenceTaskLists

static/hello-world/src/utils.js
  extractComparableBlocksFromPreparedNode

static/hello-world/src/utils.js
  buildTaskItemDiff

static/hello-world/src/styles.css
  [data-dh-node-type='task_item']

static/hello-world/src/styles.css
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
static/hello-world/src/utils.js
  expandConfluenceCodeMacros

static/hello-world/src/utils.js
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
static/hello-world/src/utils.js
  buildTableDiff

static/hello-world/src/utils.js
  buildCellLevelTableDiff

static/hello-world/src/utils.js
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
static/hello-world/src/utils.js
  expandKnownStructuredMacros

static/hello-world/src/utils.js
  buildBlockLevelModifiedDiff

static/hello-world/src/styles.css
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
static/hello-world/src/utils.js
  createRawFallbackHtml

static/hello-world/src/utils.js
  cleanUserFacingName

static/hello-world/src/utils.js
  expandUnsupportedStorageNodes

static/hello-world/src/utils.js
  expandAdfNodes

static/hello-world/src/utils.js
  visibleTextContent

static/hello-world/src/styles.css
  [data-dh-node-type='unsupported']

static/hello-world/src/styles.css
  [data-dh-raw-inspector='true']
```

## Confluence Storage Normalization

Preview rendering starts with:

```text
prepareConfluenceHtml
```

Location:

```text
static/hello-world/src/utils.js
  prepareConfluenceHtml
```

It expands a safe subset of Confluence storage HTML into display HTML:

```text
Confluence links
image attachments, dimensions, alignment, captions, and borders
code macros and line numbers
task lists
panel-like macros
ADF marks for formatting, colour, alignment, and indentation
ADF status, emoji, mention, date, task, decision, smart link nodes
unsupported macros/extensions
whiteboard smart links
```

After expansion, it sanitizes tags and attributes before returning preview HTML.
Allowed data attributes are used only for app-specific rendering and diff
classification.

## Manual Renderer Coverage

The comparison page and Draft Preview use the app's manual storage-format
renderer. They do not depend on the Confluence Content Body Conversion API.
Storage HTML and display HTML remain separate so the renderer can improve the
preview without changing the content used for recovery or draft creation.

The current manual renderer covers the team's required insert elements:

- text marks, including bold, italic, underline, strike-through, subscript,
  superscript, text colour, and highlight colour;
- headings H1-H6, paragraphs, blockquotes, horizontal rules, hard breaks, and
  links;
- ordered and unordered lists, including nested lists and empty parent bullets;
- tables, including headers, `rowspan`, `colspan`, cell alignment, and cell
  background colours such as `data-highlight-colour="#b3bac5"`;
- Confluence information panels represented as structured macros or ADF panel
  extensions, with type and colour derived from storage metadata rather than
  visible text;
- decision lists and their decided/undecided state;
- Confluence dates from storage macros, ADF nodes, links, and `<time>` elements;
- attached images with resolved URLs, width, height, alignment, wrapping,
  captions, and ADF border marks.

The renderer also includes the following enhanced support:

- Expand/Collapse macros using native `<details>` and `<summary>` preview
  markup;
- text alignment and level-based indentation without cumulative nested ADF
  offsets;
- code blocks with language metadata, compact numbered lines, CDATA cleanup,
  and repairs for malformed HTML code-block wrappers;
- status labels with their stored label and colour;
- safe readable cards for unsupported content while preserving the original
  storage markup for reconstruction.

Known limitation: Confluence `ac:layout`, `ac:layout-section`, and
`ac:layout-cell` wrappers are currently treated as transparent containers so
their child content can be diffed independently. As a result, multi-column page
layouts are displayed vertically. Restoring columns requires preserving layout
group metadata through block extraction and reassembling the rendered blocks;
this has not yet been implemented.

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
static/hello-world/src/utils.js
  isWhiteboardUrl

static/hello-world/src/utils.js
  cleanWhiteboardTitle

static/hello-world/src/utils.js
  renderWhiteboardCard

static/hello-world/src/utils.js
  expandConfluenceLinks

static/hello-world/src/utils.js
  expandWhiteboardAnchors

static/hello-world/src/utils.js
  expandAdfNodes

static/hello-world/src/styles.css
  [data-dh-node-type='whiteboard_card']

static/hello-world/src/styles.css
  [data-dh-whiteboard-icon='true']

static/hello-world/src/styles.css
  [data-dh-whiteboard-product='true']

static/hello-world/src/styles.css
  [data-dh-whiteboard-open='true']
```

## Block Extraction and Big Diff Prevention

One issue fixed during this work was Confluence layout or wrapper markup causing
large page sections to be treated as one giant diff block.

The current logic treats layout wrappers and ordinary containers as transparent
when they contain semantic child blocks.

Implementation locations:

```text
static/hello-world/src/utils.js
  hasBlockElementChildren

static/hello-world/src/utils.js
  isTransparentContainer

static/hello-world/src/utils.js
  isRawTransparentContainer

static/hello-world/src/utils.js
  collectRawBlockNodes

static/hello-world/src/utils.js
  extractComparableBlocksFromPreparedNode

static/hello-world/src/utils.js
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
static/hello-world/src/components/ComparisonPanel.js
  getSelectedBlockHtml

static/hello-world/src/components/ComparisonPanel.js
  renderDraftBlock

static/hello-world/src/components/ComparisonPanel.js
  buildRichTextDiffHtml call site

static/hello-world/src/components/ComparisonPanel.js
  createDraft invocation
```

## Tests

Focused tests live in:

```text
static/hello-world/src/utils.test.js
```

Current coverage includes 36 focused tests for:

- paragraph, heading, list-item, task-item, code-line, and table-cell diff
  behavior;
- same-version rendering after complex macros and media;
- nested unordered-list markers;
- text formatting, colours, highlights, alignment, and indentation;
- merged table cells and storage-format cell background colours;
- Confluence dates, panel metadata mapping, status labels, and decisions;
- code CDATA cleanup and malformed HTML code-block repair;
- image captions, dimensions, alignment, and ADF border metadata;
- unsupported-content fallbacks, raw storage preservation, and internal-field
  filtering;
- whiteboard smart-link cards and transparent container splitting.

Run the focused test suite from:

```powershell
cd static/hello-world
npx.cmd react-scripts test src/utils.test.js --watchAll=false --runInBand
```

Last verified result:

```text
Test Suites: 1 passed
Tests: 36 passed
```

Jest may print a warning that it did not exit immediately because of open
handles. The build also prints the existing Create React App warning about
`babel-preset-react-app`. Those warnings were not introduced by the rich-text
changes.

## Build and Deploy

Build the Custom UI bundle:

```powershell
cd static/hello-world
npm run build
```

Deploy to the `jzm-dev` Forge environment from the Forge app root:

```powershell
forge deploy --non-interactive -e jzm-dev
```

`npm install --legacy-peer-deps` is not required every time. Use it only when
dependencies are missing, `node_modules` was removed, or `package.json` /
`package-lock.json` dependencies changed.

The generated asset hashes change after each build. After deploying, verify that
the Forge iframe loads the current files from
`static/hello-world/build/static/`. If it still loads older `main.*.js` or
`main.*.css` files, the deployed environment or browser cache is not using the
latest build.

## Recent Manual Renderer Changes

This iteration replaced the earlier limited preview behavior with a broader
manual renderer for the Confluence storage formats used by the team's Sprint 2
test page.

### Current-page completeness

- `src/index.js` now requests the live page with `body-format=storage` and uses
  that body for the newest version when available.
- `ComparisonPanel.js` sends current-vs-current previews through the same
  semantic block renderer as normal comparisons. This prevents complex content
  near the end of a page from disappearing while keeping a zero-change summary.

### Storage normalization and rendering

- `utils.js` now normalizes safe text colours, highlights, table backgrounds,
  status colours, alignment, indentation, dates, and CSS lengths into explicit
  `data-dh-*` rendering metadata.
- Nested list structure and empty parent bullets are retained instead of being
  collapsed onto the first child item.
- Panel type is selected from ADF attributes or structured-macro names, not from
  the visible panel text. The preview uses a bold textual type label in place of
  the original icon and preserves the complete panel body.
- ADF decision lists render as readable decided/undecided rows instead of an
  unsupported-content card.
- Code macros remove CDATA wrappers, retain whitespace and line numbers, and
  repair the malformed opening/closing markup observed in HTML code blocks.
- Image rendering reads exact width and height attributes without confusing
  them with `original-width` or `original-height`. It also handles attachment
  captions, alignment, wrapping, native image dimensions, and ADF border marks.
- The sanitizer explicitly permits only the tags, attributes, URLs, styles, and
  app metadata needed by these renderers.

### Styling and verification

- `styles.css` adds Confluence-like presentation for headings, nested lists,
  tables, panels, decisions, dates, statuses, expands, code blocks, colours,
  indentation, and image figures.
- `utils.test.js` contains regression cases based on the actual storage markup
  observed during testing, including malformed CDATA, ADF panels and decisions,
  `data-highlight-colour`, image border marks, and exact image dimensions.
- No npm dependencies, Forge scopes, or manifest permissions were added for
  this renderer work.

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
