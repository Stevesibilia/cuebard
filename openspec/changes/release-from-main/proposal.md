## Why

Releases are published from `dev`, the integration branch, while `main` (the repository's default branch) stopped at the LivePlay fork's history in May and is 165 commits behind. Now that CueBard is no longer a fork, `main` should hold exactly what users run, so `dev` can carry unreleased work, such as the multi-step restyle, without that work being one version bump away from shipping.

## What Changes

- **BREAKING (process)** A release is published only from `main`. The release workflow triggers on a version change pushed to `main`; a manual run publishes only from `main`, and any other ref is a dry run.
- A release is a pull request from `dev` into `main`, after the version bump has been merged to `dev` through a `release/v<X.Y.Z>` branch.
- Hotfixes branch from `main`, merge into `main` with a patch bump, and `main` is then merged back into `dev`.
- CI runs on pull requests into `main` as well as `dev`.
- `main` is brought up to date once by merging `dev` into it (no force push; `dev`'s content wins every conflict).
- Branch protection on `main` and `dev`: the CI check is required, force pushes and deletion are blocked.
- AGENTS.md documents the new release and hotfix flow.

## Capabilities

### New Capabilities

- `release-pipeline`: which branch publishes releases, what a run on any other ref does, and which pull requests CI checks.

### Modified Capabilities

None.

## Impact

- `.github/workflows/build-release.yml` (trigger branch, publish guard, comments), `.github/workflows/ci.yml` (pull request branches).
- `AGENTS.md` release workflow section.
- GitHub settings (owner/architect): one-time `dev` → `main` merge, branch protection on `main` and `dev`.
- No application code changes. The updater reads GitHub releases and is unaffected.
