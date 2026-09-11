---
name: playwright-cherry-pick
description: Cherry-pick a commit or PR from main into a release branch (release-<version>) and retitle it as cherry-pick(#<pr>): <original title>. Use when asked to cherry-pick, backport, or port a change into a release.
user_invocable: true
---

# Cherry-pick into a release branch

`/playwright-cherry-pick <version> <commit>`

Check out `release-<version>`, creating it if needed, synced to `microsoft/playwright`
(`git fetch upstream release-<version>` and use `FETCH_HEAD`, not a remote-tracking name).
Cherry-pick the commit and retitle it `cherry-pick(#<pr>): <original title>`, where `<pr>` is the
number from the trailing `(#<pr>)` of the original subject, dropped from the title. Body stays empty.
Report the result and stop.

**Never push.** The user asks explicitly, then: `git push upstream release-<version>`.
