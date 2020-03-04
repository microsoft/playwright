# Preparing release notes

1. Use ["draft new release tag"](https://github.com/microsoft/playwright/releases/new).
1. Version starts with "v", e.g. "v1.1.0".
1. Fill "Raw notes".
    - `git fetch --tags upstream`
    - `git log --pretty="%h - %s" v1.0.0..HEAD`
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
    - Before publishing, replace `blob/master/docs` with `blob/v1.1.0/docs` in all the links.
1. Use "Save Draft", not "Publish".

