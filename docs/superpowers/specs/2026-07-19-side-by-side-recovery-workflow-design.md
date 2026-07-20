# Side-by-side Recovery Workflow Design

## Goal

Make Side-by-side Keep/Restore decisions drive the same recovery preview and
confirmed Confluence write-back flow used by Summary, while correcting the
current classification, error, limited-mode, summary, and responsive issues.

## Scope

- Extract reusable recovery workflow state and calculations from
  `ComparisonPanel`.
- Share canonical diff row keys and recovery choices across both views.
- Reuse one preview-and-confirm write-back surface.
- Reset decisions whenever the selected or current version changes.
- Correct direct `modified` block classification.
- Provide Side-by-side diff summaries to version comments.
- Render explicit diff failures and a useful limited-mode current preview.
- Stack both comparison panes on narrow screens rather than hiding Current.
- Add focused frontend tests and run the complete existing frontend suite.

## Out of Scope

- Direct write-back without preview confirmation.
- Changing the backend `writeRecoveredPage` contract.
- Installing dependencies, deploying, committing, or pushing.
- Establishing a backend resolver test framework; that remains a separate task.

## Architecture

### Canonical display model

`diffDisplay.js` remains the single source for display rows, original block
indices, and recovery choice keys. Direct `modified` blocks are classified as
modified and retain both old and current rendered/storage forms.

### Shared recovery workflow

A reusable hook owns:

- block choices keyed by canonical row key;
- active choice UI state;
- reconstructed recovery Storage;
- rendered draft preview;
- preview metadata;
- write-back loading, error, and success state;
- version-identity reset behaviour.

The hook receives diff blocks, the canonical display model, page/version data,
and `onPageUpdated`. It exposes choice actions, preview actions, write-back
actions, and derived safety state. It does not render either comparison view.

### Shared preview surface

The existing recovery preview modal is extracted into a component that consumes
the workflow result. Summary and Side-by-side open this same component. Writing
to Confluence still requires a second explicit confirmation click.

### View integration

Summary retains its current inline diff renderer. Side-by-side replaces its
local `rowChoices` with the shared workflow choice map and renders a Preview
draft action using the same safety rules. Both views use the same choice values:
`current` keeps current content and `old` restores historical content.

Switching selected/current versions clears choices, preview, and write-back
status before the new comparison can be acted upon.

## Error And Limited States

- A diff exception renders a visible comparison error and disables recovery.
- A limited diff renders the prepared current-version HTML below the warning;
  it does not show “No differences.” Recovery controls remain unavailable.
- Recovery Storage errors remain blocking and appear in the shared preview.
- Existing optimistic version checking remains the final write-back guard.

## Responsive Behaviour

At narrow widths, every change becomes a vertical pair: historical content,
marker/label, then current content. Neither alternative is hidden. Controls
remain available only when both alternatives are visible.

## Comment Summary

Side-by-side reports the same normalized summary structure as Summary through
`onDiffSummaryChange(versionNumber, summary)`. Summary counts derive from the
canonical display rows so direct modified blocks and paired removed/added rows
are consistent between views.

## Testing

Use test-first development for each behaviour:

- direct `modified` classification and counts;
- canonical recovery choices producing expected Storage for both views;
- Side-by-side Keep/Restore changing shared preview output;
- version identity resetting decisions;
- visible error and limited states;
- Side-by-side comment summary callback;
- narrow layout retaining both panes through structural CSS assertions.

Run all existing frontend tests after focused suites. Do not run a production
build or Forge deployment as part of this task.
