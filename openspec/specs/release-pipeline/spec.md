# release-pipeline Specification

## Purpose

Which branch publishes CueBard releases, what a release run on any other ref does, and which pull requests the CI check guards.

## Requirements

### Requirement: Releases publish only from main

A release SHALL be built and published only when a version change in `package.json` reaches `main`, or when the release workflow is started by hand on `main`. On any other ref the workflow SHALL build and check the release files without publishing.

#### Scenario: Version bump merged into dev

- **WHEN** a pull request that changes the version is merged into `dev`
- **THEN** no release SHALL be published

#### Scenario: dev merged into main with a new version

- **WHEN** `dev` with version 2.1.0 is merged into `main` and no tag `v2.1.0` exists
- **THEN** release `v2.1.0` SHALL be published, tagged on the merge commit on `main`

#### Scenario: Manual run on a feature branch

- **WHEN** the release workflow is started by hand on a branch other than `main`
- **THEN** it SHALL build every platform and the update manifests and SHALL NOT publish

### Requirement: CI checks pull requests into main and dev

Every pull request into `main` or `dev` SHALL run the CI tests and typecheck, and SHALL NOT be mergeable while that check fails, except by an administrator.

#### Scenario: Failing test on a pull request into main

- **WHEN** a pull request into `main` has a failing test
- **THEN** GitHub SHALL block the merge for non-administrators
