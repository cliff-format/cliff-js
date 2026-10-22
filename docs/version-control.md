# Version Control Policy

This document defines the English-only version control policy for the CLIFF JavaScript packages. It follows the conventions used by the other CLIFF repositories: English Conventional Commits, a protected `main` release branch, a protected `dev` integration branch, annotated repository tags and an English changelog.

## 1. Scope

This policy applies to:

- commit messages and bodies;
- branch names;
- pull request titles;
- annotated tag messages and GitHub Release notes;
- `CHANGELOG.md`.

All version control artifacts are written in English. They must not contain Chinese, Japanese, Korean or other CJK text. Code, code comments and documentation may be translated separately.

The project uses Git and GitHub. It does not use Diversion or Chinese commit types.

## 2. Commits

Format:

```text
[AI] type(scope)!: English description

English body explaining why and what changed.

BREAKING CHANGE: English description of the incompatible change.
Refs: #123
```

- `[AI]` is optional. It is required for AI-generated or automated commits. All commits made by the implementation agent use it.
- `type` is one of: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `chore`, `build`, `ci`, `revert`.
- `scope` is optional and lowercase, for example `core`, `parser`, `tolerant`, `serializer`, `validator`, `json`, `fixtures`, `repo`, `ci`, `docs`, `deps`, `release`.
- The description is imperative English, at most 72 characters, and does not end with a period.
- The body starts after a blank line and explains why the change is needed and what it affects.
- Footers use English tokens: `BREAKING CHANGE:`, `Refs:`, `Fixes:`, `Co-authored-by:`.
- A breaking change must be marked with `!` after the type or scope, and/or a `BREAKING CHANGE:` footer.
- A commit contains one logical change and passes the build and tests before it is pushed.

Examples:

```text
[AI] feat(core): add the CLIFF data model and identifiers
[AI] fix(parser): reject markup instead of normalizing it
[AI] docs(vcs): codify the English commit policy
[AI] build(release): prepare v0.1.0
```

## 3. Branches and pull requests

- `main` is the release branch. It is protected, always releaseable, and receives merges only from `dev`.
- `dev` is the integration branch. It is protected, always buildable, and receives work through pull requests.
- Work branches start from `dev`:
  - `feature/<slug>` for features;
  - `fix/<slug>` for fixes;
  - `docs/<slug>`, `test/<slug>`, `refactor/<slug>`, `ci/<slug>`, `build/<slug>`, `chore/<slug>`, `perf/<slug>` or `style/<slug>` for the corresponding work;
  - `prototype/<slug>` for disposable experiments. Prototype code is not merged; reimplement it on `dev`.
- Feature and fix pull requests target `dev`. Release pull requests target `main` and merge `dev` into `main`.
- Branch names are lowercase ASCII with hyphen-separated words.
- Pull request titles use the same format as commit subjects.
- Merge commits are allowed; the `dev` to `main` release merge must be a merge commit, so `main` is not linear.
- Do not squash a release merge. Preserve the integration history.
- Delete a work branch after merge.
- `main` and `dev` prohibit direct pushes. A pull request must pass CI and the VCS checks before merge.

## 4. Versions and tags

- Versions follow Semantic Versioning 2.0.0.
- All published `@cliff-format/*` packages share one fixed version number. The root `package.json` version is the source of truth.
- The first release is `0.1.0`.
- During `0.y.z`, `feat` increments MINOR, `fix` increments PATCH and a breaking change increments MINOR. After `1.0.0`, a breaking change increments MAJOR.
- A release is tagged with an annotated repository tag `vX.Y.Z`; the message is `cliff-js X.Y.Z`.
- Tags are created only on `main`, after the release merge from `dev`. Never tag `dev` or a work branch.
- Package-prefixed tags are not used.
- Do not use build metadata in published npm versions. Put the commit SHA in the release notes instead.
- Pre-release versions use `v0.1.0-alpha.1` style tags and the npm dist-tag `next`. Stable releases use `latest`.

## 5. Release process

1. Ensure `dev` is stable and all checks pass.
2. On `dev`, set the root package version and every published package version to `X.Y.Z`.
3. On `dev`, update the English `CHANGELOG.md` and `.github/release-notes/vX.Y.Z.md`.
4. Commit with `[AI] build(release): prepare vX.Y.Z`.
5. Run `pnpm verify`, `pnpm check:versions` and `pnpm check:package`.
6. Open a release pull request from `dev` to `main` and run the full regression.
7. Merge with a merge commit. Do not squash the release merge.
8. On `main`, create the annotated tag `vX.Y.Z` and publish a GitHub Release whose body is the release-notes file.
9. The release workflow verifies the tag and package versions, builds, skips versions already on npm, and publishes missing packages with npm provenance.
10. The workflow also supports a manual dispatch. Its `dry_run` input defaults to `true`; a real manual run must be dispatched from the matching tag.
11. For the first release, publish manually, then configure the package's GitHub Actions trusted publisher with `npm trust github`.

The project does not use Changesets. Versions are prepared on `dev` before the release merge, matching the other CLIFF repositories.

## 6. Changelog

`CHANGELOG.md` is English and uses this shape:

```md
# Changelog

All notable changes to the CLIFF JavaScript packages are recorded here.

## 0.1.0 — 2026-10-22

### New Features

- ...

### Fixes

- ...

### Other Changes

- ...

### For developers

- ...
```

## 7. Enforcement

- `scripts/check-vcs.mjs` validates commit format, English text, `main`/`dev`/work branch names, pull request titles, tag messages and `CHANGELOG.md`.
- `scripts/check-versions.mjs` validates the fixed version group and the internal peer range.
- CI runs on `main`, `dev` and pull requests; branch protection requires the checks.
- The release workflow checks that `vX.Y.Z` matches every published package version and that the tag is on `main`.

## 8. References

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Semantic Versioning 2.0.0](https://semver.org/)