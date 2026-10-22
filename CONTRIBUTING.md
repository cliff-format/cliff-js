# Contributing

## Setup

```bash
pnpm install
```

Node.js 22 or newer and pnpm are required.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm check:package
pnpm check:versions
pnpm check:boundaries
pnpm check:browser
pnpm fixtures:check
```

`pnpm verify` runs the project checks except the browser test suite. Browser tests use Playwright and are run in CI with `pnpm test:browser`.

The heavy `CI` workflow is skipped when every changed file is documentation, a license, or repository metadata. The lightweight `VCS` workflow still runs because the commit message is a version control artifact. Use the manual `workflow_dispatch` trigger when a full CI run is needed for a documentation-only change.

## Tests and fixtures

- Unit, conformance and JSON tests live under `packages/*/test`.
- The vendored specification examples and conformance fixtures live under `fixtures/upstream`.
- `fixtures/upstream/SOURCE.json` records the source repositories and commit SHAs.
- `pnpm fixtures:check` verifies the recorded sibling commits and the fixture directories. It never deletes files.
- Do not edit vendored fixtures to make a test pass. Fix the implementation or update the fixture from its source repository.

## Commits and pull requests

Follow [docs/version-control.md](docs/version-control.md):

- English Conventional Commits, optionally prefixed with `[AI]`.
- One logical change per commit.
- Short-lived English branch names.
- Squash or rebase merge; no merge commits.
- All version control artifacts are English.

## Release

Releases are prepared by a release pull request, tagged `vX.Y.Z` and published by the release workflow. See [docs/version-control.md](docs/version-control.md).

## Scope

0.1.0 contains only the core parser, serializer, validator and JSON converters. Do not add CLI, runtime i18n, AI integration or additional format converters to this release.
