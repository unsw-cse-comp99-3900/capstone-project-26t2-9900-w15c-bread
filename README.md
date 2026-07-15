# Dynamic History

Dynamic History is a Confluence Forge content action for viewing page version
history, comparing a selected historical version with the current page, choosing
which changed blocks to keep, and writing the reconstructed result back as a new
version of the current page.

The repository is an existing Forge Custom UI app. Its React frontend remains in
the template-generated `static/hello-world` directory.

## Current User Flow

1. Open **Dynamic History** from a Confluence page content action.
2. Select a version from the left-hand timeline.
3. Compare that version with the newest/current version.
4. Click a changed block to reveal **Keep current change** and
   **Restore old content**.
5. After choosing, use **Undo** to clear that choice if necessary.
6. Open **Preview Draft** to inspect the reconstructed result.
7. Use **Write to Current Page** to create a new current-page version.

Each timeline card also provides **Add comment**. Version comments can include the
current diff summary and are shared with other app users through a Confluence
page content property. Each page version has at most one comment; editing it
replaces the previously stored comment for that version.

Previewing is read-only. The page is updated only after the final write button is
pressed. Despite the modal name, the current frontend does not create an
unpublished Confluence draft.

## Repository Map

Paths are relative to the repository root.

```text
manifest.yml
  Forge content-action module, Custom UI resource, resolver, runtime and scopes.

src/index.js
  Forge resolver for page versions, attachments, authors, legacy draft creation,
  and version-checked current-page write-back.

static/hello-world/src/App.js
  Frontend data loading, local mock fallback and top-level page state.

static/hello-world/src/components/Timeline.js
static/hello-world/src/components/VersionCard.js
  Version timeline.

static/hello-world/src/components/VersionCommentModal.js
  Version selector, diff context, comment editor and comment preview.

static/hello-world/src/components/ComparisonPanel.js
  Comparison UI, change grouping, Keep/Restore/Undo state, preview modal and
  write-back invocation.

static/hello-world/src/utils.js
  Storage-format renderer, sanitizer, semantic block extraction, signatures,
  LCS diff, layout handling and table comparison.

static/hello-world/src/recoveryStorage.js
  Reconstructs valid Confluence Storage from whole-block choices.

static/hello-world/src/styles.css
  App, renderer, diff, table and layout presentation.

static/hello-world/src/utils.test.js
static/hello-world/src/recoveryStorage.test.js
  Renderer, diff and Storage reconstruction regression tests.
```

## Forge Configuration

`manifest.yml` declares one `confluence:contentAction` and serves the built
frontend from `static/hello-world/build`.

Current runtime and scopes:

```text
nodejs24.x, arm64, 256 MB

read:page:confluence
read:attachment:confluence
read:confluence-user
write:page:confluence
```

The backend uses `api.asUser().requestConfluence(...)`, so Confluence evaluates
requests with the invoking user's permissions.

## Backend Resolvers

### `getPageVersions`

Returns the data required by the frontend:

- the current page title and live Storage body;
- historical versions in newest-first order, including Storage bodies;
- attachment download URLs indexed by filename;
- author display names where available; and
- the page/base URL metadata used by the renderer.

Version fetching follows cursor pagination with a safety cap of 1,000 versions.
Attachment fetching also has a 1,000-item safety cap. The newest timeline entry
uses the live page-by-id Storage body when available, because it is more reliable
for complex current pages than the versions listing alone.

### `writeRecoveredPage`

Writes reconstructed Storage directly to the current page. Before the PUT it:

- validates the page ID and non-empty Storage string;
- rejects payloads larger than 2 MB;
- re-reads the live page with `asUser()`;
- verifies that its version still equals `expectedVersionNumber`; and
- increments the page version with a recovery message.

If another edit has created a newer version since Preview Draft was prepared,
the resolver rejects the write instead of overwriting that edit.

### `addVersionComment`

Stores a comment against a page version in the
`dynamic-history-version-comments` Confluence page content property. Comments
include the author, creation time and optional diff summary. Property updates
use Confluence's optimistic version number and retry once after a concurrent
update. Saving another comment for the same version replaces the previous one,
and existing duplicate data is reduced to the most recently stored comment.
Comment text is limited to 2,000 characters and the property payload is kept
below 30 KB.

The resolver uses `asUser()`, so the user must be able to view the page to read
comments and update the page to add one. The existing `read:page:confluence` and
`write:page:confluence` scopes cover these content-property operations.

### `createDraft` (legacy)

The resolver can still create an unpublished page named with a
`— Restored draft` suffix. It is retained for compatibility, but the current
frontend has no invocation of `createDraft`.

## Frontend Data Flow

Inside Confluence, `App.js` loads `@forge/bridge` and invokes
`getPageVersions`. On `localhost` or when the bridge cannot initially be reached,
the app uses `mockData.js` so the UI can be developed locally.

The comparison direction is:

```text
selected historical version  ->  current version
```

Therefore `removed` means content from the selected historical version, while
`added` means content in the current version.

Selecting the current version compares the live body with itself through the
same renderer. It should show a zero-change full-page preview rather than a
shortened alternate path.

## Manual Storage Renderer

Both the comparison page and Preview Draft use the app's manual renderer. The
current implementation does **not** call the Confluence Content Body Conversion
API and does not use `AdfRenderer`.

The main renderer is:

```js
prepareConfluenceHtml(storageHtml, baseUrl, attachmentsByFilename, usersByAccountId)
```

It converts supported Storage/ADF constructs into ordinary preview HTML, then
sanitizes the result with explicit allowlists for tags, attributes, URLs, styles
and app-owned `data-dh-*` metadata. Display HTML is never used as the source of
truth for recovery; original Storage fragments are retained separately.

Before DOM parsing and ADF regular-expression rendering, XML-style self-closing
ADF elements are expanded safely. Self-closing `paragraph` and `hardBreak`
nodes render as semantic blank lines; other empty ADF nodes receive an explicit
closing tag. This prevents an empty historical node from matching a later ADF
closing tag and swallowing the remainder of the page into one whole-page diff.

Current renderer coverage includes:

- paragraphs, H1-H6 headings, links, rules, hard breaks and blockquotes;
- bold, italic, underline, strike, subscript, superscript, inline code, text
  colour, highlight, alignment and indentation;
- ordered, unordered, nested and task lists;
- tables with headers, cell backgrounds, alignment, `rowspan` and `colspan`;
- ADF and structured-macro panels, including stored/custom backgrounds;
- decisions and decided/undecided state;
- dates, statuses, mentions, emoji and supported smart-link metadata;
- code macros with compact line presentation, language metadata and CDATA
  cleanup for preview/write-back;
- attached and external images with dimensions, alignment/wrapping, captions
  and ADF borders;
- Expand content using `<details>/<summary>`;
- Confluence multi-column layouts; and
- readable cards for whiteboards and unsupported Storage.

Panel type is derived from ADF attributes or the structured macro name, never
from visible body text. The target site's legacy macro mapping is intentionally
preserved (`tip -> success`, `note -> warning`, `warning -> error`). Panel icons
are hidden and a bold type label is rendered before the original body.

Unsupported nodes render a safe fallback card and escaped raw inspector while
retaining the original Storage for comparison and recovery. They must not be
silently dropped or reconstructed from the fallback card.

## Diff Model

The main entry point is:

```js
buildRichTextDiffHtml(oldHtml, currentHtml, baseUrl, attachmentsByFilename, usersByAccountId)
```

The active page-level result contract uses only:

```text
same
removed
added
```

A replacement is represented as the old block followed by the new block. The
summary still contains `modifiedBlocks` for compatibility, but the current
page-level pipeline does not emit `modified` result blocks.

The renderer first extracts semantic blocks and generates canonical DOM
signatures. Signatures retain meaningful structure, formatting, dates, links,
image metadata and renderer attributes while ignoring serialization-only
differences such as attribute order and equivalent `<b>/<strong>` or
`<i>/<em>` tags. The old and current block sequences are aligned with LCS.

If `oldBlockCount * currentBlockCount` exceeds 120,000, the function returns a
limited current-side result rather than allocating an unsafe LCS matrix. The UI
shows a limited-comparison warning.

### Comparison and Selection Granularity

- Paragraphs, headings, ordinary lists, blockquotes, panels, code blocks,
  expands, images and unsupported blocks are complete comparison units.
- Task and Decision items are extracted independently, then reconstructed into
  valid list/group Storage.
- Inline date, status, mention, emoji and formatting changes make their
  containing block different.
- Compatible adjacent old/new blocks with the same semantic type and HTML tag
  share one Keep/Restore decision. Ambiguous multi-block runs use text
  similarity while preserving block order; adjacent Confluence spacer
  paragraphs follow the corresponding replacement choice so restoring old
  text does not leave extra blank lines.
- Consecutive empty editor paragraphs created by repeated Enter presses are
  collapsed into one count-aware `blank_line_run`. The comparison renders one
  net change: `2 -> 5` is only `3 blank lines added`, and `5 -> 2` is only
  `3 blank lines removed`; it is not reported as a remove-plus-add replacement.
  The internal `blank_line_change` retains both complete runs, so recovery keeps
  the exact selected paragraph count and original Storage. This recognises both
  direct Storage `<p>` elements and historical prepared forms such as top-level
  `<br>`, ADF `hardBreak`/content wrappers, empty formatting spans, and invisible
  editor caret characters. A display-level fallback also gives adjacent blank
  blocks one recovery key if historical wrappers survive source normalisation.
  Macros, media, links, mentions, and other empty-looking rich nodes remain
  untouched. Inline `<br>` breaks inside non-empty text (commonly produced by
  Shift+Enter) remain part of their containing paragraph.
- Recovery remains block-level. Table cells are not independently staged.
  Compatible layout sections additionally expose one atomic column-width
  choice, separate from their child-content choices.

Unresolved changes display red/green outer borders and `-`/`+` gutters without
red/green fills, so original content backgrounds remain visible. Clicking a
change reveals its actions. A resolved block displays the selected complete
content, its status, and an Undo button.

## Table Diff

Table matching uses logical grid coordinates rather than raw `<td>` indexes.
`rowspan` and `colspan` occupy all of their logical slots, preventing later cells
from shifting during matching.

When mapping is reliable, the comparison UI renders one table:

- unchanged cells appear once;
- a modified cell contains previous and current regions with red and green
  borders, preserving each version's own cell background;
- a complete row appended/removed at the bottom or a complete column
  appended/removed on the right is outlined as one structural region;
- simultaneous terminal row/column changes are rendered as one L-shaped region;
- opposite terminal changes use a neutral synthetic corner where neither
  source table has a real cell; and
- structural row/column regions omit `-`/`+` markers so narrow cells are not
  widened or covered.

The app falls back to complete old/current table rows when correspondence is
ambiguous, including middle row/column insertion, span changes, duplicate
logical coordinates, or other incompatible grid geometry.

Cell-level display does not change recovery granularity. The underlying old and
current complete table blocks still share one Keep/Restore choice.

## Confluence Layouts

The renderer supports standard layout types:

```text
single
two_equal
two_left_sidebar
two_right_sidebar
three_equal
three_with_sidebars
```

When every cell provides a valid stored width, those widths take precedence over
the original layout type. Widths are converted to validated integer flex weights
from 1 to 100, so manually resized layouts such as 25/75 or 25/50/25 keep their
relative proportions. At viewport widths up to 760 px, layouts intentionally
stack into one column.

For diff and recovery, a layout is split into non-selectable Layout/Section/Cell
boundaries plus independently selectable child blocks only when the old and
current layout compatibility signatures are identical. The signature includes
the layout type, breakout mode and cell count/order, but excludes cell body
content and stored widths. `layoutPath` prevents equal text in different columns
from being matched together.

Stored width vectors are compared separately for compatible sections. A resized
section renders one compact old/current ratio decision and outlines only the
affected columns; unchanged child content is not placed inside a removed/added
page frame. All affected cells in the section share one atomic choice so recovery
cannot mix incompatible ratios. Restoring old widths changes only the width
attributes on current cell opening tags, preserving current local IDs and other
editor metadata. Content choices inside those cells remain independent. An
unresolved width change and its affected columns use the same red visual language
as removed content; choosing current widths resolves it in green, while restoring
historical widths remains red.

Adding/removing/reordering columns, changing the layout type or breakout mode,
or otherwise changing the compatibility signature still falls back to complete
old/current layout blocks. Those genuinely structural changes do not yet support
per-column staging.

## Recovery and Preview Safety

`buildRecoveryStorageHtml` defaults every unresolved change to the current
version. Only an explicit `old` choice restores historical Storage.

The recovery layer:

- selects original old/current Storage rather than rendered HTML;
- preserves layout boundary tags for compatible layouts;
- rebuilds Task and Decision groups without duplicate wrappers/fallback items;
- preserves self-closing Confluence references and valid code CDATA;
- preserves self-closing namespaced ADF configuration and macro parameter
  elements so browser parsing cannot move later content inside them;
- normalizes preview-readable malformed code Storage before write-back; and
- stops with an error if required raw Storage is unavailable.

Preview Draft uses the already-rendered selected diff blocks exactly once. This
avoids rendering both an ADF node and its Storage fallback as duplicate visible
content. The separate reconstructed Storage string is the value sent to
`writeRecoveredPage`.

## Install, Test and Build

A fresh clone has two npm projects. Install each one when `node_modules` is
missing or its dependency files changed:

```powershell
# Repository root: Forge resolver dependencies
npm.cmd install --legacy-peer-deps

# Custom UI dependencies
cd static/hello-world
npm.cmd install --legacy-peer-deps
```

The frontend package currently has no `test` script, so run the focused suite
through the installed React Scripts binary:

```powershell
cd static/hello-world
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
```

Build the deployable Custom UI resource:

```powershell
cd static/hello-world
npm.cmd run build
```

Last verified on 2026-07-15:

```text
Test Suites: 2 passed, 2 total
Tests:       114 passed, 114 total
Production build: compiled successfully
```

The test run currently prints a Jest open-handle notice and the known Create
React App/Babel warning. The production build also reports old Browserslist data
and the same Babel warning; these warnings do not fail the commands.

## Forge Validation and Deployment

Run Forge commands from the repository root. Confirm the directory first:

```powershell
pwd
forge lint
forge deploy --non-interactive -e development
```

Only reinstall/upgrade when scopes or permissions changed, for example:

```powershell
forge install --non-interactive --upgrade --site <site-url> --product confluence --environment development
```

Code-only changes still require rebuilding `static/hello-world` before a normal
deploy because Forge serves the generated `build` directory. During an active
Forge tunnel, code changes are hot reloaded; manifest changes require redeploying
and restarting the tunnel.

## Maintenance Rules

- Keep display HTML and recoverable Storage separate.
- Do not render raw Storage directly with `dangerouslySetInnerHTML`.
- Keep unsupported content recoverable even when its visual fallback is limited.
- Preserve `layoutPath`, logical table coordinates and span checks when changing
  matching behavior.
- UI grouping may share a choice key, but must not mutate the underlying
  `same`/`removed`/`added` result order.
- Keep write-back version checking and `asUser()` permission enforcement.
- Run both focused test suites and the production build after renderer, diff or
  recovery changes.
