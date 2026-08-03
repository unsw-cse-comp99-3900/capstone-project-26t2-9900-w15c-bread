# Dynamic History

Dynamic History is an Atlassian Forge app for reviewing and selectively restoring
Confluence page history. It presents historical changes in readable Inline and
Side-by-side views, lets users decide which content to keep, previews the
reconstructed page, and publishes the result as a new version of the same page.

The app is designed for teams that need more control than Confluence's standard
whole-version restore workflow. It preserves the current page by default and
restores historical content only when the user explicitly selects it.

## Key Features

- Paginated page-version timeline with author, timestamp and edit metadata.
- Inline and resizable Side-by-side comparisons.
- Semantic rich-content diff rather than plain HTML string comparison.
- Per-change **Keep current change**, **Restore old content** and **Undo** actions.
- **Restore Historical for All** and **Reset choices** bulk actions.
- Cell-level table comparison and recovery when table structure is unchanged.
- Conservative structural table alignment for inserted or removed rows/columns.
- Draft review, difference notes and version-checked publication.
- Shared version comments stored in a Confluence content property.
- Bilingual in-app user guide with keyboard and screen-reader support.
- Local mock data for frontend development outside Confluence.

## User Workflow

1. Open **Dynamic History** from a Confluence page's content actions.
2. Select a historical version from the timeline.
3. Review changes in **Inline** or **Side-by-side** mode.
4. Select changed content and choose whether to keep the current version or
   restore the historical version.
5. Optionally use **Restore Historical for All**, **Reset choices**, or **Undo**.
6. Select **Review & Publish** to inspect the reconstructed page.
7. Optionally open **Version Difference Notes** to compare the current page with
   the reconstructed result.
8. Select **Publish to Current Page** to create a new Confluence page version.

Unresolved changes always default to current content. Opening the review dialog
does not modify Confluence; publication occurs only after the final publish
action.

## Architecture

```text
Confluence content action
        |
        v
React Custom UI
  - version timeline
  - manual Storage renderer
  - semantic diff and comparison views
  - recovery decisions and preview
        |
        | @forge/bridge invoke(...)
        v
Forge resolver
  - page versions and attachments
  - version comments
  - optimistic, version-checked page update
        |
        v
Confluence REST API (asUser)
```

The project contains two npm packages:

- The repository root contains the Forge resolver and platform dependencies.
- [static/confluence-dynamic-history](static/confluence-dynamic-history) contains
  the React Custom UI application.

### Repository Structure

| Path | Responsibility |
| --- | --- |
| [manifest.yml](manifest.yml) | Forge module, resource, runtime and permission scopes |
| [src/index.js](src/index.js) | Forge resolvers for versions, comments and page write-back |
| [static/confluence-dynamic-history/src/App.js](static/confluence-dynamic-history/src/App.js) | Frontend data loading and shared workspace state |
| [static/confluence-dynamic-history/src/components/ComparisonPanel.js](static/confluence-dynamic-history/src/components/ComparisonPanel.js) | Inline comparison and change interaction |
| [static/confluence-dynamic-history/src/components/SideBySideDiffView.js](static/confluence-dynamic-history/src/components/SideBySideDiffView.js) | Side-by-side comparison |
| [static/confluence-dynamic-history/src/utils.js](static/confluence-dynamic-history/src/utils.js) | Storage renderer, sanitizer, semantic extraction and diff |
| [static/confluence-dynamic-history/src/tableStructureDisplay.js](static/confluence-dynamic-history/src/tableStructureDisplay.js) | Shared two-dimensional table display matcher |
| [static/confluence-dynamic-history/src/tableCellRecovery.js](static/confluence-dynamic-history/src/tableCellRecovery.js) | Cell-scoped table recovery |
| [static/confluence-dynamic-history/src/recoveryStorage.js](static/confluence-dynamic-history/src/recoveryStorage.js) | Reconstructed Confluence Storage generation |
| [static/confluence-dynamic-history/src/useRecoveryWorkflow.js](static/confluence-dynamic-history/src/useRecoveryWorkflow.js) | Recovery state, preview and publication workflow |
| [docs/user-guide-content.md](docs/user-guide-content.md) | Approved English/Chinese user-guide content |

## Forge Configuration

The app is registered as one `confluence:contentAction` named
**Dynamic History**. Forge serves the production frontend from:

```text
static/confluence-dynamic-history/build
```

Runtime:

```text
Node.js 24.x
ARM64
256 MB
```

Required scopes:

```text
read:page:confluence
read:attachment:confluence
read:confluence-user
write:page:confluence
```

Product REST requests use `api.asUser().requestConfluence(...)`, so Confluence
continues to enforce the invoking user's page permissions.

## Backend Resolvers

### `getPageVersions`

Loads the current page, historical Storage bodies, author information, attachment
download metadata and stored version comments. Version and attachment pagination
each use a safety cap of 1,000 items.

### `addVersionComment`

Stores one Dynamic History comment per page version in the
`dynamic-history-version-comments` content property. Comments are limited to
2,000 characters; the property is capped below 30 KB and uses optimistic
versioning with one retry for concurrent updates.

### `writeRecoveredPage`

Validates the reconstructed Storage, rejects payloads above 2 MB, re-reads the
live page and confirms its expected version before updating it. If another user
has edited the page since review began, publication is rejected instead of
overwriting the newer edit.

### `createDraft`

This legacy resolver is retained for compatibility but is not called by the
current frontend.

## Rendering Design

Dynamic History uses a manual Confluence Storage renderer. It does not use the
Content Body Conversion API or `AdfRenderer`.

The principal entry point is:

```js
prepareConfluenceHtml(
  storageHtml,
  baseUrl,
  attachmentsByFilename,
  usersByAccountId
)
```

The renderer converts supported Storage and ADF constructs into preview HTML and
then sanitizes the output using explicit tag, attribute, URL and style
allowlists. The rendered HTML is display-only: original Storage fragments remain
the source of truth for recovery and publication.

Supported content includes:

- paragraphs, headings, links, rules, hard breaks and quotations;
- bold, italic, underline, strike, subscript, superscript and inline code;
- text colour, highlight, alignment and indentation;
- ordered, unordered, nested, task and decision lists;
- tables, headers, backgrounds, alignment, `rowspan` and `colspan`;
- information panels and custom panel colours;
- dates, status labels, mentions and emoji;
- code blocks with language metadata and compact line numbering;
- attached and external images with size, alignment, captions and borders;
- Expand content and Confluence multi-column layouts; and
- safe fallback cards for unsupported content.

Status colours are derived from Storage/ADF formatting properties, never from
the label text. A missing status colour is rendered as Confluence's neutral grey.
Unsupported blocks remain recoverable and expose escaped diagnostic data rather
than being silently discarded.

## Diff and Recovery Model

The comparison pipeline:

1. Renders Storage into a safe semantic DOM.
2. Extracts meaningful blocks and canonical signatures.
3. Ignores serialization-only differences such as attribute order.
4. Aligns historical and current block sequences using LCS.
5. Builds shared Inline and Side-by-side display models.
6. Associates recoverable changes with stable choice keys.

The comparison direction is:

```text
selected historical version -> current version
```

Red represents historical content removed from the current version; green
represents content present in the current version. Original content backgrounds
remain visible because change indicators use outlines and gutters rather than
full red/green fills.

For safety, the LCS matrix is limited when
`oldBlockCount * currentBlockCount > 120000`. The UI then reports a limited
comparison rather than allocating an unsafe matrix.

### Selection Granularity

- Paragraphs, headings, ordinary lists, quotations, panels, code blocks, expands,
  images and unsupported blocks are selected as complete blocks.
- Task and decision items can be compared independently and are rebuilt into
  valid Storage groups.
- Compatible layout-width changes form a separate atomic choice from content
  changes inside the layout.
- Tables use the rules below.

Inline and Side-by-side views share the same recovery choices. Switching views
does not change the reconstructed result.

## Table Comparison

Table matching uses logical grid coordinates. Cells covered by `rowspan` and
`colspan` occupy every relevant grid position so merged cells do not shift
subsequent matches.

### Unchanged table structure

When rows, columns and span geometry correspond reliably:

- unchanged cells render once;
- only modified cells receive old/current outlines;
- selecting a modified cell reveals cell-specific Keep/Restore actions; and
- recovery replaces only the selected cell's original Storage fragment.

### Row or column structure changes

For regular rectangular tables, a conservative two-dimensional matcher can
display rows and columns inserted or removed at the beginning, middle or end.
It also supports simultaneous row and column changes, including mixed
insert/remove cases.

This improves display granularity only. Structural changes retain one atomic
whole-table recovery decision, preventing a reconstructed table with invalid
geometry.

### Structural fallback

Ambiguous duplicate anchors, uncertain reorderings, changed span geometry or
structural edits involving merged cells fall back to complete historical/current
table comparison. A conservative fallback is preferred over an incorrect cell
mapping.

## Recovery and Publication Safety

`buildRecoveryStorageHtml` reconstructs Confluence Storage from original
historical/current fragments:

- unresolved choices use current Storage;
- only explicit historical choices restore old Storage;
- table-cell choices merge selected historical cells into the current table;
- layout wrappers, task/decision groups and macro structure are preserved;
- code CDATA and self-closing namespaced elements are normalized safely; and
- recovery stops if required raw Storage is unavailable.

Preview HTML is never written back to Confluence. The reconstructed Storage is
sent separately to `writeRecoveredPage`, which performs the final optimistic
page-version check.

## Local Development

### Prerequisites

- Node.js and npm
- Atlassian Forge CLI
- A Forge developer account and Confluence test site for deployment

### Install dependencies

Install both npm projects after a fresh clone or dependency-file change:

```powershell
# Forge resolver dependencies
npm install --legacy-peer-deps

# Custom UI dependencies
cd static/confluence-dynamic-history
npm install --legacy-peer-deps
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

### Run locally

```powershell
cd static/confluence-dynamic-history
npm start
```

The localhost frontend uses `mockData.js` when the Forge bridge is unavailable.

### Run tests

The frontend package intentionally invokes the installed React Scripts binary:

```powershell
cd static/confluence-dynamic-history
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --no-cache
```

Latest verified result:

```text
Test Suites: 15 passed, 15 total
Tests:       258 passed, 258 total
```

### Build

```powershell
cd static/confluence-dynamic-history
npm run build
```

The generated `build` directory is ignored by Git but must exist locally
before a standard Forge deployment.

## Validation and Deployment

Run Forge commands from the repository root:

```powershell
pwd
forge lint
forge deploy --non-interactive -e development
```

Install the development app for the first time:

```powershell
forge install --non-interactive --site <site-url> --product confluence --environment development
```

Use `--upgrade` only after changing scopes or permissions:

```powershell
forge install --non-interactive --upgrade --site <site-url> --product confluence --environment development
```

Code changes require a new frontend build followed by deployment. Manifest
changes require deployment and, when scopes change, an installation upgrade.

## Security and Data Integrity

- Confluence REST requests are made as the invoking user.
- Renderer output is sanitized before insertion into the comparison UI.
- Unsafe URLs, event handlers and unsupported inline styles are removed.
- Raw Storage is retained separately from rendered HTML.
- Page publication uses optimistic version checking.
- Unsupported content is preserved for recovery.
- Comments and write-back payloads have explicit size limits.

## Known Limitations

- Unsupported Confluence macros use a safe fallback instead of a native visual
  reproduction.
- Ambiguous table structures intentionally use whole-table comparison.
- Structural Confluence layout changes use whole-layout recovery.
- Very large comparisons may use the limited-comparison fallback.
- Localhost mode uses mock data and cannot publish to Confluence.
- The legacy `createDraft` resolver remains in the backend but is not part of
  the current user flow.

## Documentation

- [Bilingual user guide](docs/user-guide-content.md)

