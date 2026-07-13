# Dynamic History

<<<<<<< Updated upstream
Dynamic History is a Confluence Forge content action app for viewing page
version history, comparing a selected historical version with the current
version, and creating an unpublished Confluence draft from a chosen recovery
result.
=======
<<<<<<< Updated upstream
Dynamic History is a Confluence Forge content action app for inspecting a page's
version history. It opens from the Confluence page actions menu, fetches the
current page's versions through a Forge resolver, and renders a timeline plus a
rich comparison between the current page and a selected historical version.
=======
Dynamic History is a Confluence Forge content action app for viewing page
version history, comparing a selected historical version with the current
version and safely writing a chosen recovery result back to the current page.
>>>>>>> Stashed changes
>>>>>>> Stashed changes

This app was originally created from a Forge Custom UI template, so the frontend
folder is still named `static/hello-world`.

## Project Map

Paths below are relative to the `9900` project folder.

```text
<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
manifest.yml                         Forge app module, resource, scopes, runtime
src/index.js                         Backend resolver for Confluence API access
static/hello-world/                  Custom UI React app
static/hello-world/src/App.js        Frontend data loading and page-level layout
static/hello-world/src/components/   Timeline and comparison UI components
static/hello-world/src/utils.js      Formatting, storage HTML rendering, diff helpers
static/hello-world/src/mockData.js   Local fallback data for development preview
static/hello-world/src/styles.css    App layout, timeline, and rich diff styles
=======
>>>>>>> Stashed changes
manifest.yml
  Forge app manifest. Defines the Confluence content action, Custom UI resource,
  resolver function, scopes, and runtime.

src/index.js
  Backend Forge resolver. Fetches Confluence page versions, attachments, authors,
<<<<<<< Updated upstream
  and creates unpublished draft pages.
=======
  retains the legacy unpublished-draft resolver and writes version-checked
  recovery updates.
>>>>>>> Stashed changes

static/hello-world/src/App.js
  Frontend entry point. Loads Forge bridge data in Confluence and mock data in
  local development.

static/hello-world/src/components/Timeline.js
static/hello-world/src/components/VersionCard.js
  Version timeline UI.

static/hello-world/src/components/ComparisonPanel.js
  Main comparison UI. Calls the rich diff helper, renders selectable change
<<<<<<< Updated upstream
  blocks, opens Draft Preview, and sends selected storage HTML to createDraft.
=======
  blocks, opens Draft Preview, and sends validated Storage HTML to the Draft or
  direct write-back resolver.

static/hello-world/src/recoveryStorage.js
  Rebuilds validated Confluence Storage from block choices and safely groups
  Task/Decision items before Draft creation or direct write-back.
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
  Focused tests for rich-text normalization, block-level recovery behavior,
  type-specific diffs, unsupported content, and preview safety.
=======
static/hello-world/src/recoveryStorage.test.js
  Focused tests for rich-text normalization, block-level recovery behavior,
  type-specific diffs, Storage reconstruction, unsupported content, and preview
  safety.
>>>>>>> Stashed changes
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
### createDraft

Creates an unpublished Confluence page beside the source page. The frontend
sends a reconstructed storage HTML string based on the user's selected recovery
choices. Unsupported or complex blocks must remain as their original storage
markup; they must not be converted into plain text.
=======
<<<<<<< Updated upstream
`body.value` is Confluence storage-format HTML. The frontend sanitises and
normalises it before rendering.
=======
### createDraft

Creates an unpublished Confluence page beside the source page. This legacy
backend resolver remains available for compatibility, but the current Preview
Draft UI does not invoke it.

### writeRecoveredPage

Writes the same validated recovery Storage HTML directly to the current page.
The resolver re-reads the page with `asUser()` immediately before updating it
and rejects the request when the page version no longer matches the version
used to prepare the preview. The existing `write:page:confluence` scope covers
both draft creation and direct write-back.
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
The Draft Preview modal shows the reconstructed result first. The final create
button calls `createDraft`; previewing alone does not write to Confluence.
=======
<<<<<<< Updated upstream
`utils.js` contains the shared frontend helpers:
=======
The Draft Preview modal shows the reconstructed result first. Its only actions
are `Back to changes` and `Write to Current Page`; the latter calls
`writeRecoveredPage`. Previewing alone never writes to Confluence.
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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
      type: 'same' | 'added' | 'removed',
      nodeType: string,
      tag: string,
      html?: string,
      renderedHtml?: string,
      oldHtml?: string,
      newHtml?: string,
      text?: string,
      tableDiff?: object,
      supportLevel?: 'full' | 'raw',
      rawPreview?: string,
      added?: number,
      removed?: number,
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

`modifiedBlocks` remains in the summary shape for compatibility with existing
UI code, but Sprint 2 diff output does not emit `modified` blocks and this count
is therefore `0`. A changed block is always represented by the old block as
`removed`, followed by the new block as `added`.

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

## Sprint 2 Diff Policy

The diff is deliberately block-based. Confluence pages are first rendered with
the existing safe renderer, then extracted into semantic blocks. The old and
current block sequences are aligned with a longest-common-subsequence comparison
using stable semantic signatures rather than plain visible text.

### Classification and Display

The structured result model has exactly three classifications:

```text
same     equivalent content exists in both versions
removed  content exists only in the selected historical version
added    content exists only in the current version
```

A replacement never creates a fourth `modified` or `changed` result type. It is
represented as a `removed` old block and an `added` new block. Result order is
preserved, with old content displayed before its corresponding new content.

The display layer groups compatible old/new blocks into one recovery decision:

- a directly adjacent `removed`/`added` pair can share one choice;
- when the diff produces a continuous run such as three removed blocks followed
  by three added blocks, blocks are paired in order by matching `nodeType` and
  HTML tag;
- each paired red/green group has one `Keep current change` and one
  `Restore old content` action;
- unmatched blocks remain independent, which avoids forcing one-to-many changes
  or unrelated semantic types into the same choice.

Removed rows use a red outer border and added rows use a green outer border. The
border wraps the complete row, including the `-`/`+` gutter. Diff rows have no
red or green fill, so original text colours, highlights, panel backgrounds,
date backgrounds, status colours, image presentation, and table-cell
backgrounds remain visible.

Implementation locations:

```text
static/hello-world/src/utils.js
  canonicalDomSignature
  extractDiffBlocks
  buildRichTextDiffHtml
  buildTableReplacementBlocks

static/hello-world/src/components/ComparisonPanel.js
  buildChangeRunRows
  buildDiffDisplayRows

static/hello-world/src/styles.css
  .dh-github-diff-part--removed
  .dh-github-diff-part--added
```

### Semantic Equality Rules

The stable DOM signature includes meaningful element structure, inline marks,
links, dimensions, spans, dates, and app rendering metadata. Attribute and CSS
declaration order do not affect equality. Serialization-only whitespace is
normalised, and equivalent inline tags such as `<b>`/`<strong>` and `<i>`/`<em>`
compare as the same content.

Visible breaks follow a specific rule:

```text
one <br> and multiple consecutive <br> elements are equivalent
no <br> and one or more <br> elements are different
```

Formatting is content for diff purposes. Changes to bold, italic, links, text
colour, highlight colour, alignment, indentation, or other preserved semantic
attributes make the containing block different.

### Type-by-Type Behavior

| Content type | Extraction unit | Diff behavior |
| --- | --- | --- |
| Paragraph | One complete paragraph | Text, inline formatting, links, dates, statuses, or visible-break changes produce the old paragraph as `removed` and the new paragraph as `added`. A paragraph split remains one removed block plus multiple added blocks. |
| Heading | One complete H1-H6 heading | Compared independently from paragraphs. Text, formatting, or heading-level changes produce removed/added blocks; a heading is never matched to a paragraph. |
| Ordered/unordered list | One complete `<ol>` or `<ul>`, including nested items | Item text, item order, nesting, or list type changes make the whole list different. Adjacent lists remain separate list blocks. |
| Task list | One task item per block | Task text and completed/incomplete state are compared independently for each task. The original task storage HTML remains attached to that item. |
| Blockquote | One complete blockquote | All nested paragraphs and formatting are compared as one block; an internal change replaces the whole quote. |
| Information panel | One panel per block | Each info, note, warning, tip, success, error, or generic panel is independent. Panel type, content, and preserved styling participate in comparison. |
| Decision list | One Decision item per block | Decision text and decided/undecided state are compared independently; changing one Decision does not replace the complete list. |
| Date | Inline content inside its containing block | Storage dates, ADF dates, links, and `<time>` elements are normalised to semantic dates. Equivalent representations compare the same; a date change makes the whole containing paragraph or block different. |
| Status, mention, emoji, and inline smart content | Inline content inside its containing block | Preserved semantic value and metadata participate in the containing block signature. A meaningful change replaces that containing block. |
| Image | One image/figure per block | Images compare persistent identity and display metadata, including attachment/content IDs, filename or source, dimensions, alignment/layout, border, alt/title, rotation, and embedded caption. A manually typed paragraph below an image is a separate paragraph. |
| Compatible table | One old table and one new table, with corresponding cells | Compatibility requires matching row count, effective column count, cell type/position, `rowspan`, and `colspan`. Only semantically changed cells receive red/green inset borders; unchanged cell styling and backgrounds are preserved. |
| Incompatible table | One complete old table and one complete new table | Row/column count or span changes disable cell matching. The complete old and new tables are shown as removed/added rows with outer borders and no forced cell-level markers. |
| Code block | One complete code macro/block | Escaped code text is part of the block signature. Any code-content change produces complete removed/added code blocks while preserving whitespace, line presentation, and language rendering metadata. |
| Expand macro | One complete Expand block | The summary and nested rendered content are compared together. A change produces a removed old Expand and an added new Expand. |
| Whiteboard or block smart-link card | One complete card | The rendered title and persistent target metadata are compared as one block while original storage remains available. |
| Unsupported macro/extension | One raw-preserved block | Equality is based on preserved raw storage. A raw change produces removed/added fallback cards; unsupported content is never silently dropped or converted to plain text. |
| Layout/container wrapper | Not a diff block when transparent | Ordinary block containers and Confluence layout wrappers expose their semantic children so an entire section does not become one oversized diff. Current multi-column layouts still render vertically. |

### Unsupported Content Safety

Unsupported content must never become blank, deleted, or silently converted into
plain text. Normal preview shows a readable fallback card while the original raw
HTML or JSON is retained for comparison and reconstruction. The raw inspector
escapes this source instead of rendering it with `dangerouslySetInnerHTML`, and
normal preview filters internal IDs and implementation metadata.

<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
## Common Commands
=======
>>>>>>> Stashed changes
Implementation locations:

```text
static/hello-world/src/utils.js
  createRawFallbackHtml
  cleanUserFacingName
  expandUnsupportedStorageNodes
  expandAdfNodes
  visibleTextContent

static/hello-world/src/styles.css
  [data-dh-node-type='unsupported']
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

<<<<<<< Updated upstream
Draft reconstruction is handled in the frontend by `ComparisonPanel.js`.
=======
Storage reconstruction is handled by `recoveryStorage.js` and is consumed by
`ComparisonPanel.js` for both Draft creation and direct write-back.
>>>>>>> Stashed changes

Important rule:

```text
<<<<<<< Updated upstream
The component chooses between oldHtml and newHtml for recovery.
=======
The recovery builder chooses between old and current raw Storage for each block.
>>>>>>> Stashed changes
It should not reconstruct complex Confluence storage from rendered preview HTML.
```

This protects unsupported macros, extensions, whiteboards, and other complex
storage nodes from being degraded into plain text.

Implementation location:

```text
<<<<<<< Updated upstream
static/hello-world/src/components/ComparisonPanel.js
  getBlockPreviewHtml
  buildDraftPreviewHtml
  buildRichTextDiffHtml call site
  createDraft invocation
=======
static/hello-world/src/recoveryStorage.js
  buildRecoveryStorageHtml

static/hello-world/src/components/ComparisonPanel.js
  prepareConfluenceHtml recovery-preview call
  buildRichTextDiffHtml call site
  writeRecoveredPage invocation
>>>>>>> Stashed changes
```

## Tests

Focused tests live in:

```text
static/hello-world/src/utils.test.js
<<<<<<< Updated upstream
```

Current coverage includes 56 focused tests for:
=======
static/hello-world/src/recoveryStorage.test.js
```

Current coverage includes 87 focused tests for:
>>>>>>> Stashed changes

- the `same`/`removed`/`added` result contract and removed-then-added
  replacement order;
- whole-block paragraph, heading, list, blockquote, panel, Decision, date,
  image, and code behavior;
- semantic inline formatting, link, attribute-order, serialization-whitespace,
  and visible-break comparison;
- compatible table cell borders and incompatible table structure fallback;
- preservation of original colours, highlights, panel/status/date styling, and
  table-cell backgrounds inside bordered diff rows;
- independent task items, decisions, images, and transparent container child
  blocks;
- same-version rendering after complex macros and media;
- nested unordered-list markers;
- text formatting, colours, highlights, alignment, and indentation;
- merged table cells and storage-format cell background colours;
- Confluence dates, panel metadata mapping, status labels, and decisions;
<<<<<<< Updated upstream
- code CDATA cleanup and malformed HTML code-block repair;
- image captions, dimensions, alignment, and ADF border metadata;
- unsupported-content fallbacks, raw storage preservation, and internal-field
  filtering;
- whiteboard smart-link cards and transparent container splitting.
=======
- code CDATA cleanup, lossless write-back, and malformed HTML code-block repair;
- image captions, dimensions, alignment, and ADF border metadata;
- unsupported-content fallbacks, raw storage preservation, and internal-field
  filtering;
- whiteboard smart-link cards and transparent container splitting;
- grouped Task/Decision Storage reconstruction, layout-boundary recovery,
  parser-safe self-closing Confluence elements, and unsafe write-back rejection;
- interrupted and fully changed Task groups, ADF Task Storage, and independent
  duplicate raw macro recovery groups.
>>>>>>> Stashed changes

Run the focused test suite from:

```powershell
cd static/hello-world
<<<<<<< Updated upstream
npx.cmd react-scripts test src/utils.test.js --watchAll=false --runInBand
=======
npx.cmd react-scripts test src/utils.test.js src/recoveryStorage.test.js --watchAll=false --runInBand
>>>>>>> Stashed changes
```

Last verified result:

```text
<<<<<<< Updated upstream
Test Suites: 1 passed
Tests: 56 passed
=======
Test Suites: 2 passed
Tests: 87 passed
>>>>>>> Stashed changes
```

Jest may print a warning that it did not exit immediately because of open
handles. The build also prints the existing Create React App warning about
`babel-preset-react-app`. Those warnings were not introduced by the rich-text
changes.

## Build and Deploy
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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

## Recent Sprint 2 Changes

<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
```powershell
forge lint
```
=======
>>>>>>> Stashed changes
This iteration added semantic Sprint 2 diff classification and display behavior
on top of the broader manual renderer used by the team's test page.

### Diff classification and display

- `utils.js` now aligns semantic blocks using canonical DOM signatures that
  retain meaningful formatting and metadata while ignoring serialization-only
  differences.
- Changed content is emitted only as an old `removed` block followed by a new
  `added` block; no new modified/changed result type was introduced.
- Paragraphs, headings, ordinary lists, blockquotes, panels, dates, images,
  decisions, code blocks, expands, and unsupported blocks follow the
  type-specific rules documented above.
- Compatible tables compare corresponding cells and mark only changed cells;
  incompatible tables fall back to complete old/new table blocks.
- `ComparisonPanel.js` groups compatible removed/added blocks in each continuous
  change run so one logical red/green pair shares one Keep/Restore choice.
- `styles.css` replaces red/green row fills with outer borders around the full
  row and gutter while retaining original rich-content styling.
- No dependencies, Forge scopes, manifest permissions, or backend APIs were
  added, and this work was not deployed to Forge.

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
<<<<<<< Updated upstream
- Code macros remove CDATA wrappers, retain whitespace and line numbers, and
  repair the malformed opening/closing markup observed in HTML code blocks.
=======
- Code macros remove CDATA wrappers for rendering, retain whitespace and line
  numbers, preserve the original CDATA for write-back, and repair malformed
  opening/closing markup observed in HTML code blocks.
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes

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
