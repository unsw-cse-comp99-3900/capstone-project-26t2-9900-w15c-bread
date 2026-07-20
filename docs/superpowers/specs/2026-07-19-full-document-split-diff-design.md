# Full-Document Split Diff Design

## Goal

Replace the current change-card Side-by-side view with a VS Code-style split
diff that renders the complete historical page on the left and the complete
current page on the right, aligned in document order.

The implementation remains uncommitted. It is developed in the team working
tree, mirrored into the personal Spike project, and deployed only through the
personal Forge app to `bread-test.atlassian.net`.

## Current Problem

The existing view filters out unchanged blocks and presents differences as a
matrix of Added, Deleted, and Modified cards. This makes the surface useful as a
change list, but it is not a full document comparison:

- unchanged context is absent;
- reading order is interrupted by change-only cards;
- Keep/Restore controls occupy a separate left column instead of the divider;
- labels describe recovery effects rather than the actual historical/current
  document sides;
- users cannot read either version as a continuous page.

## Fixed Document Sides

- Left: complete selected historical version, labelled `Historical / vN`.
- Right: complete current version, labelled `Current / vM`.
- Both sides are read-only source snapshots and never change when a recovery
  choice is made.
- The combined result remains a virtual Draft and is shown only through the
  existing Preview Draft workflow.

## Alignment Model

The canonical diff display model remains the source of block pairing and
recovery keys. A full-document split-row projection will convert every display
row into one of these visual rows:

| Row kind | Historical side | Current side |
| --- | --- | --- |
| unchanged | historical block | matching current block |
| modified | old block rendering | current block rendering |
| historical-only | removed historical block | equal-height placeholder |
| current-only | equal-height placeholder | added current block |
| layout-width | old width summary | current width summary |

Unchanged rows are always included. Each visual row owns both panes in one CSS
grid row, so the taller pane determines the shared row height and every later
block stays aligned.

Contiguous removed/added blocks continue to use the canonical pairing algorithm.
Original block indices and recovery choice keys must remain unchanged so Summary,
Preview Draft, and write-back reconstruct exactly the same storage content.

## Complete-Body Rendering

- Unchanged headings, paragraphs, lists, tables, macros, code blocks, media, and
  blank-line context render neutrally on both sides.
- Modified text blocks render their old and current HTML separately. Inline
  removed text is highlighted only on the left; inline added text is highlighted
  only on the right.
- Tables render as complete tables on each side. Compatible table changes retain
  cell-level highlighting where the existing table metadata supports it;
  otherwise the complete table block receives modified styling.
- Historical-only and current-only blocks use a visible placeholder on the
  missing side without inventing content.
- Layout boundaries are preserved as structural context when they can safely
  wrap aligned content. If a Confluence layout cannot be represented safely
  across a shared split grid, its cells are flattened in reading order while
  retaining all content; content must never be hidden or duplicated.

## Divider And Recovery Controls

The old controls column and separate marker column are replaced by one central
divider gutter.

Changed rows show two directional actions:

- `→` / `Restore historical content`: select the left historical block for the
  virtual Draft (`choice = old`).
- `←` / `Keep current content`: select the right current block for the virtual
  Draft (`choice = current`).

The active direction is highlighted. A selected row exposes Undo, which removes
the explicit choice and returns to the safe default of Current. Unchanged and
structural context rows show only the divider line and have no actions.

Arrow buttons must have explicit accessible labels and titles; direction alone
must not be the only explanation of the action.

## Visual Structure

The desktop comparison uses three grid columns:

```text
Historical complete document | divider/actions | Current complete document
```

- Pane headers remain sticky within the comparison surface where supported.
- Neutral rows have no Added/Deleted card label.
- Historical-only rows use removed/red styling on the left.
- Current-only rows use added/green styling on the right.
- Modified rows use old/red emphasis on the left and current/green emphasis on
  the right, with focused inline highlights.
- The stats describe the actual version diff: additions are current-only units,
  removals are historical-only units, and modifications are paired rows.

At narrow widths the comparison remains a two-column split inside a horizontally
scrollable minimum-width canvas. Neither document pane may be hidden or stacked,
because stacking would break one-to-one visual alignment.

## Preview And Write-Back

The existing shared recovery workflow remains authoritative:

1. Divider arrows update the canonical `blockChoices` map.
2. Preview Draft reconstructs selected rendered HTML and Confluence storage.
3. Version Difference Notes compares Current with the virtual Draft.
4. Write to Current Page uses the existing confirmation and optimistic current
   version check.

No write occurs when an arrow is clicked. The only external mutation remains the
confirmed Write to Current Page action.

## Error And Limited States

- Renderer errors remain explicit and never appear as an empty/no-difference
  page.
- A limited large-page diff continues to show the safe current-page preview and
  disables per-block merge controls when reliable alignment is unavailable.
- Missing side-specific HTML uses safe side text or a visible unavailable
  placeholder; decorated combined diff HTML must not be shown as both sides.

## Testing

Tests must cover:

- unchanged blocks rendered on both sides in document order;
- modified, historical-only, and current-only alignment;
- equal row ownership of both panes and the central divider structure;
- left/right arrow semantics, active state, Undo, and Preview Draft output;
- canonical recovery keys and summary callback compatibility;
- headings, lists, code blocks, tables, blank lines, and layout-width rows;
- narrow-screen CSS preserving both panes in a horizontal split;
- error and limited states;
- the complete existing frontend regression suite.

## Success Criteria

- Users can read the complete historical and current page from top to bottom.
- Every corresponding block is horizontally aligned.
- Unchanged content is visible on both sides.
- Added/deleted blocks preserve alignment with placeholders.
- Divider arrows select Historical or Current without modifying either source
  pane.
- Preview Draft and confirmed write-back use those selections correctly.
- All tests and the personal production build pass.
- Only the personal Spike development app is redeployed and upgraded on
  `bread-test.atlassian.net`; the team deployment and GitHub remain untouched.
