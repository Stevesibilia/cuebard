# CueBard — Agent Instructions

## Repository

|                            |                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upstream (origin)**      | `git@github.com:tdoukinitsas/liveplay.git` — LivePlay, the project CueBard is based on. Read-only reference for porting, **do not push here**      |
| **CueBard (fork)**         | `git@github.com:Stevesibilia/cuebard.git` → GitHub: `Stevesibilia/cuebard` (named `enhanced-liveplay` until v2.0.0; GitHub redirects the old name) |
| **Default working branch** | `dev`                                                                                                                                              |

CueBard is a separate project from upstream LivePlay; `origin` is not kept up to date and is read-only. All pushes and PRs go to the `fork` remote / `Stevesibilia/cuebard`.

## Branch & PR workflow

**Always check if a PR is already merged before adding commits to its branch.** If merged, create a new branch from `dev` for the additional changes.

**Creating a branch, committing, and pushing require explicit user confirmation.** Do not perform these actions proactively — propose the action and wait for the user to approve before running it.

**Exception for implementer sessions:** an implementer may commit and push to the branch named in an architect's brief, when that branch already holds the architect's plan. Opening pull requests, merging, tagging and releasing stay with the architect, under the rules above.

**"Update the PR"** means: commit the current changes on the PR's branch and push to the fork. The push updates the existing PR automatically.

**Local and remote branch names must match.** Always push with `git push fork <branch-name>` where `<branch-name>` is identical to the local branch — never rename on push (no `local:remote` refspec). This keeps `git status`, PR URLs, and `gh pr` lookups predictable.

For every change:

1. **Branch from `dev`** on the fork — never work directly on `dev`
   ```bash
   git fetch fork
   git checkout -b <branch-name> fork/dev
   ```
2. **Commit** changes on the new branch
3. **Push to fork** (not upstream)
   ```bash
   git push fork <branch-name>
   ```
4. **Open a PR** against `dev` on `Stevesibilia/cuebard`
   ```bash
   gh pr create --repo Stevesibilia/cuebard --base dev --head <branch-name>
   ```

Typical branch naming: `feat/<name>`, `fix/<name>`, `release/v<version>`, `chore/<name>`.

**`main` holds what is released.** Only `dev` (a release) and hotfix branches (see Release workflow) are merged into `main`; every other change goes through `dev`. `main` and `dev` are protected: the CI check (`CI / test`) must pass before a pull request merges, force pushes and deletion are blocked. CI runs on pull requests into both branches.

## Release workflow

Releases are **fully automated** via `.github/workflows/build-release.yml`, and are published **only from `main`**.

The workflow triggers on any push to `main` that modifies `package.json`. It:

1. Detects the version bump
2. Builds on Windows, Linux, and macOS in parallel
3. Creates and publishes the GitHub release with all binaries attached

A manual run (`workflow_dispatch`) publishes only when started on `main`; on any other ref it is a dry run (builds everything, publishes nothing). A version bump merged into `dev` publishes nothing.

To cut a release:

1. Create a `release/v<X.Y.Z>` branch from `dev`
2. Bump `"version"` in `package.json`
3. Commit, push to fork, open a PR against `dev`, merge it
4. Open a PR from `dev` into `main` titled `Release v<X.Y.Z>`
   ```bash
   gh pr create --repo Stevesibilia/cuebard --base main --head dev --title "Release v<X.Y.Z>"
   ```
5. Merge it with a **merge commit** — CI handles the rest

To ship a hotfix without the unreleased work on `dev`:

1. Branch `fix/<name>` from `main`
2. Fix, and bump the patch version in `package.json` in the same PR
3. Open a PR against `main` and merge it — this publishes the release
4. Open a PR from `main` into `dev` so `dev` keeps the fix

Do **not** create GitHub releases manually.
