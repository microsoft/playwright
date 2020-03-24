# Preparing release notes

1. Use ["draft new release tag"](https://github.com/microsoft/playwright/releases/new).
1. Version starts with "v", e.g. "vX.Y.Z".
1. Fill "Raw notes".
    - `git fetch --tags upstream`
    - `git log --pretty="%h - %s" v0.11.1..HEAD`
1. Fill "Bug fixes".
    - `git log v0.11.1..HEAD`
    - Manually look for `#1234` references in commit messages.
1. Fill "Current status".
    - `node utils/print_versions.js`
    - Copy tests status from [IsPlaywrightReady](https://aslushnikov.github.io/isplaywrightready/).
1. Fill "Highlights" if any.
    - Be creative.
1. Fill "Breaking API Changes" if any.
    - `git diff v0.11.1:docs/api.md docs/api.md`
1. Fill "New APIs" if any.
    - `git diff v0.11.1:docs/api.md docs/api.md`
1. When making links to the API, copy actual links from [GitHub](https://github.com/microsoft/playwright/blob/master/docs/api.md), and not from `api.md` source - these might be incorrect.
    - Before publishing, replace `blob/master/docs` with `blob/vX.Y.Z/docs` in all the links.
1. Use "Save Draft", not "Publish".

# Releasing to npm

1. Announce `PSA: release vX.Y.Z in progress. Please do not commit anything.`
    - **Important**: no other commits should land in-between release commit and bump commit.
1. Mark a new version.
    - Bump `package.json` version to `vX.Y.Z`.
    - `node utils/sync_package_versions.js && npm run doc`.
    - Send a PR titled `chore: mark version vX.Y.Z`.
    - Make sure the PR passes all required checks and merge it.
1. Publish to npm.
    - `npm login`
    - `utils/publish_all_packages.sh --release`
1. Click 'Publish release' button on the prepared release notes.
1. Mark post release.
    - Bump `package.json` version to `vX.Y.Z-post`.
    - `node utils/sync_package_versions.js && npm run doc`.
    - Merge a PR titled `chore: bump version to vX.Y.Z-post`.
1. Announce `PSA: release vX.Y.Z is out.`
