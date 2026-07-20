# Side-by-side Diff Deduplication Design

## Goal

Remove duplicated diff display logic between `ComparisonPanel` and
`SideBySideDiffView` without intentionally changing user-visible behaviour.

## Scope

- Extract the established display-row model from `ComparisonPanel` into a
  shared, UI-independent module.
- Reuse the shared row grouping, pairing, choice-key, blank-line, and preview
  HTML helpers in both comparison views.
- Preserve each component's current layout, labels, state ownership, and
  interaction behaviour.
- Add focused unit tests for the shared model before moving production code.

## Out of Scope

- Connecting Side-by-side Keep/Restore controls to recovery or write-back.
- Resetting Side-by-side choices when versions change.
- Changing responsive layout, error presentation, statistics, or labels.
- Refactoring mention resolution or Forge API calls.
- Builds, deployments, dependency changes, commits, or pushes.

## Architecture

Create a shared pure-function module under `static/hello-world/src` that owns
the canonical transformation from rich-diff blocks to display rows. It will
export only the functions required by the two consumers. `ComparisonPanel`
will retain recovery state and write-back orchestration; `SideBySideDiffView`
will retain its renderer and local visual choice state.

Both components will consume the same row grouping and block-choice keys, so
paragraph pairing, empty-line grouping, structural nesting, and stable row
identity no longer have separate implementations.

## Data Flow

1. A component calls `buildRichTextDiffHtml` as it does today.
2. The resulting blocks are passed to the shared display-row builder.
3. The shared module returns display rows, selectable rows, and block-choice
   keys.
4. Each component renders that model using its existing UI.

## Compatibility

The refactor must preserve the existing `ComparisonPanel` recovery contract:
choice keys still map back to original diff block indices consumed by
`buildRecoveryStorageHtml` and `buildRecoveryPreviewHtml`.

Side-by-side must keep its current visible row categories and labels. Where its
old ad-hoc pairing differs from the established `ComparisonPanel` model, the
shared model is authoritative because it already protects write-back mapping.
This is treated as removal of inconsistent duplicate interpretation, not a new
feature.

## Testing

Use test-first development:

- Add tests for removed/added pairing, unrelated same-tag blocks, blank-line
  grouping, structural boundaries, and original block-index preservation.
- Run the new tests and confirm they fail because the shared module is absent.
- Extract the minimum production code needed to pass.
- Run existing comparison, recovery-storage, and utility tests afterward.

No production build or Forge command is included.
