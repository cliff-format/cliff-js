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
- `main` is the release branch; `dev` is the integration branch.
- Create work branches from `dev`: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `test/<slug>`, `refactor/<slug>`, `ci/<slug>`, `build/<slug>`, `chore/<slug>`, `perf/<slug>` or `style/<slug>`.
- Feature and fix pull requests target `dev`. Release pull requests target `main` and merge `dev` into `main`.
- Merge commits are allowed. The `dev` to `main` release merge must be a merge commit; `main` is not linear.
- All version control artifacts are English.

## Release

Releases are prepared on `dev`, merged into `main` with a release merge commit, tagged `vX.Y.Z` on `main`, and published by the release workflow. The GitHub Release body comes from `.github/release-notes/vX.Y.Z.md`. See [docs/version-control.md](docs/version-control.md).

The release workflow can also be started manually from the Actions tab. Its `dry_run` input defaults to `true`; a real run must be dispatched from the matching annotated tag. The workflow skips a package version that already exists on npm, so a GitHub Release for an already manually published version is safe.

For the first release, publish manually, then configure the package's trusted publisher with `npm trust github`. See the package settings on npm for the exact repository, workflow and environment.

## Scope

0.1.0 contains only the core parser, serializer, validator and JSON converters. Do not add CLI, runtime i18n, AI integration or additional format converters to this release.