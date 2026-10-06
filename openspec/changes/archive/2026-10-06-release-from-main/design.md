## Context

- `.github/workflows/build-release.yml` triggers on `push` to `dev` with `paths: package.json`, and on `workflow_dispatch`. Its `check-version` job sets `publish=true` only when `GITHUB_REF == refs/heads/dev` (the "Decide whether to publish" step), refuses an existing tag, and the `release` job publishes with `target_commitish: ${{ github.sha }}`. Release notes start at the previous commit that changed `"version": "` in `package.json` (`git log -2 -G`).
- `.github/workflows/ci.yml` runs on `pull_request` to `dev` and as a reusable workflow (`workflow_call`) from the release workflow.
- `main` is the default branch, at 817f585 (2026-05-22), with 10 commits not in `dev` and 165 commits behind it. Nothing is protected.

## Goals / Non-Goals

**Goals:**

- `main` equals the latest release; `dev` can hold unreleased work.
- The release workflow cannot publish from any branch but `main`.
- Every pull request into `main` or `dev` is checked by CI before it can merge.

**Non-Goals:**

- Changing how builds, manifests, tags or release notes are made.
- Changing the default branch (stays `main`, so visitors see released code; `gh pr create` keeps passing `--base dev` explicitly as AGENTS.md says).
- Moving or rewriting existing tags.

## Decisions

### D1. Trigger and publish on `main` only

`on.push.branches: [main]` (paths unchanged), and the publish guard compares `GITHUB_REF` with `refs/heads/main`. A `workflow_dispatch` run on any other ref stays a dry run, as today. _Alternative_: a dedicated `release` branch. Rejected by the owner: one more branch to keep in step for no gain.

### D2. A release is `dev` → `main`

The version bump keeps its `release/v<X.Y.Z>` branch merged into `dev` first (so `dev` always carries the version being prepared), then a pull request from `dev` into `main` titled `Release v<X.Y.Z>`, merged with a merge commit. The push to `main` changes `package.json`, which runs the release. The release notes range still starts at the previous version bump, which is reachable from `main` after the merge.

### D3. Hotfix flow

`fix/<name>` from `main`, patch bump in the same pull request into `main`, then a pull request `main` → `dev` so `dev` does not lose the fix.

### D4. CI on pull requests to both branches

`ci.yml` `pull_request.branches: [dev, main]`. The required status check is the job named `test` (shown as "CI / test").

### D5. One-time catch-up of `main`, done by the architect

A pull request from `dev` into `main`, merge commit, no force push. The 10 commits only on `main` (May 2026, from the LivePlay fork: Nuxt pin and similar) are kept in history; every conflict is resolved to `dev`'s version, because `dev` is what 2.0.0 shipped. After this merge `main` and `dev` have the same tree. Because the merge changes `package.json`, the release workflow runs on `main`; version 2.0.0's tag already exists, so the existing-tag guard stops it before anything is built or published. That failure is expected and is the guard working.

### D6. Branch protection, done by the architect

For `main` and `dev`: required status check `test` (strict off, so a branch need not be rebased on the latest base), no force pushes, no deletion, admins may bypass. Applied with `gh api -X PUT repos/Stevesibilia/cuebard/branches/<branch>/protection` after D5.

## Risks / Trade-offs

- [The catch-up merge triggers a release run that fails on the existing v2.0.0 tag] → expected (D5); confirm the run stopped in `check-version` and published nothing.
- [Required check name changes if the job is renamed] → the protection names `test`; renaming the CI job means updating the protection.
- [A pull request into `main` from a branch other than `dev` skips integration] → AGENTS.md states only `dev` and hotfix branches merge into `main`.

## Migration Plan

1. Implementer: workflow and AGENTS.md changes on `chore/release-from-main`, PR into `dev`, merged.
2. Architect: PR `dev` → `main` (D5), merged; release run stops on the tag guard.
3. Architect: branch protection (D6).
4. The next release (2.1.0, after the restyle) follows D2.

Rollback: revert the workflow commit on `dev` and `main`; remove protection with `gh api -X DELETE`.
