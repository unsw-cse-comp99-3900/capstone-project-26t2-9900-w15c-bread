# Dynamic History

Dynamic History is a Confluence Forge content action app for inspecting a page's
version history. It opens from the Confluence page actions menu, fetches the
current page's versions through a Forge resolver, and renders a timeline plus a
rich comparison between the current page and a selected historical version.

This repository was created from a Forge Custom UI template, so some folder names
still use the original template naming, especially `static/hello-world`.

## Code Map

```text
manifest.yml                         Forge app module, resource, scopes, runtime
src/index.js                         Backend resolver for Confluence API access
static/hello-world/                  Custom UI React app
static/hello-world/src/App.js        Frontend data loading and page-level layout
static/hello-world/src/components/   Timeline and comparison UI components
static/hello-world/src/utils.js      Formatting, storage HTML rendering, diff helpers
static/hello-world/src/mockData.js   Local fallback data for development preview
static/hello-world/src/styles.css    App layout, timeline, and rich diff styles
```

## Forge Structure

`manifest.yml` defines one `confluence:contentAction` named **Dynamic History**.
The module uses the Custom UI resource at `static/hello-world/build` and calls the
backend resolver function in `src/index.js`.

Current scopes:

```text
read:page:confluence
read:attachment:confluence
read:confluence-user
```

The app uses the `nodejs24.x` Forge runtime.

## Backend Resolver

The main resolver is `getPageVersions` in `src/index.js`.

It determines the current Confluence page id from the Forge invocation context,
then uses `api.asUser().requestConfluence(...)` to fetch data the current user is
allowed to read.

The resolver currently does four main things:

1. Fetches page metadata, mainly the page title.
2. Fetches all page versions from the Confluence v2 pages API, newest first.
3. Fetches page attachments so storage-format image macros can be rendered.
4. Resolves author account ids to display names on a best-effort basis.

The frontend expects this shape:

```js
{
  pageId: string,
  pageTitle: string,
  baseUrl: string,
  attachmentsByFilename: {
    [filename: string]: string
  },
  versions: [
    {
      number: number,
      authorId: string,
      authorName: string,
      createdAt: string,
      message: string,
      minorEdit: boolean,
      title: string,
      body: {
        representation: 'storage',
        value: string
      }
    }
  ]
}
```

`body.value` is Confluence storage-format HTML. The frontend sanitises and
normalises it before rendering.

## Frontend Flow

`static/hello-world/src/App.js` is the frontend entry point after `index.js`.

It is responsible for:

- loading `@forge/bridge` only when running inside Confluence;
- calling `invoke('getPageVersions')`;
- falling back to `mockData` during local development;
- tracking the selected version number;
- rendering the header, left timeline, and right comparison panel.

The app selects the newest version by default once version data is loaded.

## Components

`Timeline.js` renders the list of versions and delegates each row to
`VersionCard.js`.

`VersionCard.js` renders a timeline-style card with:

- version number;
- current-version badge;
- minor-edit badge;
- relative timestamp;
- author avatar initials;
- edit summary.

`ComparisonPanel.js` renders the right-hand detail area. It compares the selected
historical version against the current version:

```text
selected historical version -> current version
```

In diff terms, the selected version is treated as the old content and the current
version is treated as the new content. This means additions show content that
exists now but did not exist in the selected historical version, while removals
show content that existed in the selected historical version but no longer exists
now.

If the selected version is already the current version, the panel renders the
current content without calculating a diff.

## Diff and Rendering Helpers

`utils.js` contains the shared frontend helpers:

- `formatDateTime`, `formatRelativeTime`, and `initials` for timeline display.
- `storageToPlainText` and `countWords` for metadata.
- `prepareConfluenceHtml` for rendering a safe subset of Confluence storage HTML.
- `buildRichTextDiffHtml` for block-level, inline, code block, and table diff
  rendering.
- `buildLineDiff` for plain line-based diff segments if a future UI needs it.

`prepareConfluenceHtml` expands some Confluence storage constructs before
rendering, including links, emoticons, code macros, and image attachments.
Attachment filenames are resolved through `attachmentsByFilename`, which comes
from the resolver.

`buildRichTextDiffHtml(oldHtml, currentHtml, baseUrl, attachmentsByFilename)`
returns:

```js
{
  html: string,
  blocks: [
    {
      type: 'same' | 'added' | 'removed' | 'modified',
      tag: string,
      nodeType:
        | 'paragraph'
        | 'heading'
        | 'list_item'
        | 'blockquote'
        | 'table'
        | 'table_cell'
        | 'code_block'
        | 'image',
      text?: string,
      oldText?: string,
      newText?: string,
      oldHtml?: string,
      newHtml?: string,
      renderedHtml?: string,
      inline?: [
        {
          type: 'same' | 'added' | 'removed',
          text: string
        }
      ],
      tableDiff?: object,
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
  },
  added: number,
  removed: number,
  limited: boolean
}
```

`html` is still returned so the existing comparison panel can render rich
Confluence content without a UI rewrite. `blocks` and `summary` are the
frontend-friendly structured diff contract. New UI features, selection behavior,
filters, and summary chips should use `blocks` and `summary` instead of parsing
the generated HTML string.

The top-level `added`, `removed`, and `limited` fields are retained for backward
compatibility with the previous UI contract.

### Diff Algorithm

The current algorithm uses a conservative layered approach:

1. Confluence storage HTML is normalised into safe renderable HTML.
2. The page is split into comparable blocks.
3. Blocks are matched first.
4. Matched blocks are diffed according to their content type.
5. The result is returned as both renderable HTML and structured data.

For normal text blocks such as paragraphs, headings, list items, blockquotes, and
table cells, the app uses token-level inline diffing for small and medium text.
When a text block is too large for safe token-level dynamic programming, it falls
back to a line/sentence-level comparison first, then applies inline diff only to
smaller similar line or sentence pairs. This prevents large pages from freezing
the browser while still showing useful additions and removals.

For code blocks, the app does not use normal paragraph rules. Confluence code
macros are converted to safe `<pre><code>` HTML, with code content escaped before
rendering. Code blocks are compared line by line so indentation, whitespace, and
line boundaries are preserved.

For tables, the app uses table-specific rendering:

- If the old table and current table have the same row and column shape, the UI
  renders one current-version table and highlights changed cells in place.
- If the table shape changes, the UI renders a previous table and a current table
  side by side instead of forcing the structures into one broken table.

The `limited` flag is set when a content section is too large for full inline
highlighting. In that case, the UI uses the safer line-level or fallback preview
instead of running an expensive full inline diff.

### Diff Fixes and Recent Enhancements

Recent diff work added and fixed the following behavior:

- Added explicit additions and removals highlighting for inline text.
- Added a structured `blocks` and `summary` output format for frontend use.
- Added long-text fallback diffing based on lines and sentences.
- Added code block handling so Confluence code macros no longer break rendering
  or produce a blank comparison page.
- Added code-block line diffing with preserved whitespace and indentation.
- Added table-aware diffing so unchanged table shape is kept as one table with
  changed cells highlighted.
- Added side-by-side previous/current table rendering when table shape changes.
- Added a defensive render fallback in `ComparisonPanel.js` so unexpected storage
  formats show an error preview instead of crashing the whole app.

The main implementation locations are:

```text
static/hello-world/src/utils.js
  prepareConfluenceHtml              Storage HTML normalisation and safe rendering
  buildRichTextDiffHtml              Main diff entry point used by the UI
  buildInlineTextDiff                Token-level inline text diff
  buildCoarseTextDiff                Line/sentence fallback for large text blocks
  buildCodeBlockDiff                 Code block line diff
  buildTableDiff                     Table diff dispatcher
  buildCellLevelTableDiff            Same-shape table cell diff
  buildSideBySideTableDiff           Different-shape table rendering

static/hello-world/src/components/ComparisonPanel.js
  Calls buildRichTextDiffHtml and reads summary data for the comparison chips.
  Contains the defensive fallback for unexpected diff rendering errors.

static/hello-world/src/styles.css
  Diff block, inline diff, code diff, and table diff styling.
```

## Styling

`styles.css` contains all frontend styling. The main layout is:

```text
header
left timeline sidebar | right comparison panel
```

Important class groups:

- `dh-layout`, `dh-sidebar`, `dh-main` for the two-pane shell.
- `dh-card*`, `dh-dot*`, `dh-badge*` for timeline rows.
- `dh-compare*`, `dh-change-chip*`, `dh-content-panel` for comparison metadata.
- `dh-rich-page`, `dh-rich-diff-block*`, `dh-rich-diff-inline*` for rendered rich
  page content and diff highlights.

## Local Mock Data

`mockData.js` is used when the app runs outside Confluence, for example during a
plain React local preview. Real Confluence data only exists when the app runs in a
Forge/Confluence context and `@forge/bridge` can call the resolver.

If you add fields to the resolver contract, update `mockData.js` as well so local
UI development does not drift from production data.

## Common Commands

Build the Custom UI bundle:

```powershell
cd static\hello-world
npm run build
cd ..\..
```

Deploy the Forge development environment:

```powershell
forge deploy --non-interactive -e development
```

Install or upgrade the development app on a Confluence site:

```powershell
forge install --non-interactive --upgrade --site <site> --product confluence --environment development
```

Run Forge lint:

```powershell
forge lint
```

## Development Notes

- Build `static/hello-world` before deploying, because Forge serves the generated
  `static/hello-world/build` resource.
- Use `api.asUser()` in resolver calls when reading user-visible Confluence data.
- Keep the resolver response contract and frontend mock data aligned.
- Do not commit secrets, Forge tokens, Atlassian cookies, or private credentials.
- The `static/hello-world` directory name is inherited from the Forge template; it
  now contains the Dynamic History frontend.
