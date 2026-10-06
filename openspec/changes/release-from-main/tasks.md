## 1. Workflows (implementer, one commit)

- [x] 1.1 `build-release.yml`: `on.push.branches: [main]`; the publish guard compares `GITHUB_REF` with `refs/heads/main`; update the comments that mention `dev` as the publishing branch
- [x] 1.2 `ci.yml`: `on.pull_request.branches: [dev, main]`
- [x] 1.3 `actionlint` clean (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color=false -shellcheck=`)

## 2. Docs (implementer, one commit)

- [x] 2.1 AGENTS.md "Release workflow": releases publish from `main`; cutting a release = `release/v<X.Y.Z>` into `dev`, then PR `dev` → `main` titled `Release v<X.Y.Z>`, merge commit; hotfix flow (D3); a manual run anywhere but `main` is a dry run; never create GitHub releases by hand
- [x] 2.2 AGENTS.md "Branch & PR workflow": only `dev` and hotfix branches merge into `main`; both branches are protected and need the CI check

## 3. Hand-back (implementer)

- [ ] 3.1 Push `chore/release-from-main`, report literal actionlint output and the diff summary; do not open the PR

## 4. Architect

- [ ] 4.1 PR into `dev`, CI green, merge
- [ ] 4.2 PR `dev` → `main`, merge commit; confirm the release run stops at the tag guard and publishes nothing
- [ ] 4.3 Branch protection on `main` and `dev` (D6); verify with `gh api repos/Stevesibilia/cuebard/branches/<branch>/protection`
