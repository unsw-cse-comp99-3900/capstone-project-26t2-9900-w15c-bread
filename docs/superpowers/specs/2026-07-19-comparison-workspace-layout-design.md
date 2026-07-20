# Comparison Workspace Layout Design

## Goal

Move comparison controls out of the global header, restore bulk recovery
selection, preserve choices while switching views, and give the full-document
Side-by-side view substantially more readable space.

## Global Header And Workspace Toolbar

The global header contains only the app title, page title, and `Close` action.
`Inline` and `Side-by-side` belong to the comparison workspace and render in a
single compact toolbar above the active comparison view.

The toolbar contains:

- `Inline` and `Side-by-side` segmented view buttons;
- `Restore Historical for All` bulk-selection action;
- `Reset choices`;
- an explicit `x of n decided` counter;
- `Reset choices` for returning every change to the undecided state;
- `Review & Publish` for opening the non-mutating final review step.

Bulk actions only change the virtual Draft selection. They never write to
Confluence. The existing preview and confirmed write-back flow remains the only
external mutation path.

## Shared Recovery Choices

Recovery choices are owned above both comparison views and keyed by
`selectedVersion.number:currentVersion.number`. Inline and Side-by-side consume
the same `Map<choiceKey, 'current' | 'old'>`.

- Switching view mode preserves every explicit choice.
- Selecting a different historical/current comparison clears the choices.
- `Restore all Historical` sets every currently selectable canonical key to
  `old`.
- `Reset choices` removes all explicit choices, returning to the safe implicit
  Current default.
- Preview Draft always reads the active shared map.

Canonical block keys, preview reconstruction, storage reconstruction, write
confirmation, and optimistic Confluence version checks remain unchanged.

## History And Focus Mode

The history sidebar becomes 288px wide instead of 360px and can be collapsed.
It is visible by default in both Inline and Side-by-side. Switching comparison
views never changes its visibility; only the explicit `Show history` / `Hide
history` action changes the state. This preserves user intent instead of
surprising them whenever they change presentation. The visibility control is
not part of the comparison toolbar. It lives in a dedicated left-edge rail:
when History is visible, a compact `‹` button collapses it; when hidden, the
36px rail remains and a `›` button restores it. Tooltips and accessible labels
retain the explicit `Hide history` / `Show history` wording.

`Reset choices` removes all explicit decisions and returns progress to `0 of n
decided`. Current content can still be selected per change; there is no bulk
Current action.

The toolbar action is named `Review & Publish` because opening it does not
mutate Confluence. The review modal's final mutation action is named `Publish
to Current Page`.

The main area is a flex workspace with a fixed compact toolbar and a separately
scrollable content region. Inline keeps modest content padding. Side-by-side is
edge-to-edge inside the workspace.

## Side-by-side Density And Splitter

The Side-by-side metadata header is compressed into a responsive horizontal
summary. Its redundant local view toggle and section header are removed.

The complete-document canvas uses:

```text
Historical document | 44px draggable divider | Current document
```

Each document side has a minimum readable width of 460px. The canvas has a
minimum width of 1040px and scrolls horizontally when the host viewport is too
narrow rather than crushing text into unreadable columns.

The splitter controls a shared 30%–70% ratio for every aligned row. It supports:

- pointer dragging;
- Left/Right arrow keys in 5% steps;
- Home/End for 30%/70%;
- an accessible vertical separator role and current numeric value.

Per-row recovery arrows remain centred in the same divider column.

## Error And Safety Behaviour

- Large/limited or failed diffs expose no bulk-selection or Preview action.
- Bulk choices render resolved ordinary and blank-line rows without throwing.
- A comparison-area error boundary shows a recoverable error state instead of
  allowing a renderer exception to blank the entire application.
- Stale selectable keys are ignored after the comparison identity changes.
- Reset and bulk actions do not affect unchanged rows.
- View switching does not open, close, or write a Draft.
- No dependencies, manifest identity, app IDs, sites, or deployment settings
  change.

## Testing

Automated tests cover:

- header contains `Close` but no view switch;
- the workspace toolbar exposes both view modes, both bulk actions, Reset, and
  `Review & Publish`, but no History visibility action;
- the left History rail exposes the correct accessible collapse/expand action;
- both bulk choices render Inline resolved rows without a runtime exception;
- switching Inline and Side-by-side leaves History visible by default and
  preserves any explicit Show/Hide choice;
- bulk reducer semantics and comparison-key resets;
- controlled recovery choices are used by the review-and-publish preview;
- switching presentation can reuse the same choice map;
- Side-by-side exposes an accessible splitter and clamps it to 30%–70%;
- CSS contracts for the 288px collapsible history, edge-to-edge Side-by-side,
  44px divider, 460px pane minimums, and 1040px scroll canvas;
- the complete existing frontend test suite.

## Constraints

- Work only in the existing team-project working tree because this feature
  depends on the user's existing uncommitted implementation.
- Keep all changes uncommitted.
- Do not push, publish, install, or deploy.
- Do not modify the personal Spike project during this change.
