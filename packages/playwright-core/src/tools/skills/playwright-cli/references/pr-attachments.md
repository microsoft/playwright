# Attaching Screenshots and Videos to Pull Requests

`gh` 2.99+ uploads local images and videos with the repeatable `--attach` flag on `gh pr create`, `gh pr comment`, `gh pr edit`, `gh issue create`, `gh issue comment` and `gh issue edit`. PNG, JPEG, GIF, WebP, SVG, MP4, MOV and WebM are accepted, so `playwright-cli screenshot` and `video-start` output can be attached as is.

## When to attach

Attach visual evidence when it saves the reviewer a checkout: a screenshot of a UI fix, a before/after pair, a short video of a new user-facing flow, or the failure state when filing a bug. Skip it for refactors, backend-only changes and anything the diff already shows.

## From a local session

```bash
# capture the evidence
playwright-cli open http://localhost:3000/settings
playwright-cli screenshot --filename=settings-after.png
playwright-cli video-start settings-flow.webm
playwright-cli click e5
playwright-cli fill e7 "New name" --submit
playwright-cli video-stop

# attach when creating the PR; alt text goes after "#" (images only)
gh pr create --title "fix(settings): keep name after save" --body-file body.md \
  --attach './settings-after.png#Settings page after saving' --attach ./settings-flow.webm

# or comment on an existing PR / issue
gh pr comment 123 --body "Recorded the new flow end to end." --attach ./settings-flow.webm
gh issue comment 456 --body "Failure state after submitting the form." --attach ./failure.png
```

Reference the file in the body as `![alt](./settings-after.png)` to place it inline and `gh` rewrites the path to the uploaded URL. Unreferenced attachments are appended at the end in flag order.

## Limits

- Images up to 10 MB, videos up to 10 MB on free plans and 100 MB on paid plans, so keep recordings short.
- Alt text is not supported on videos.
- Uploads need push access to the repository.
- Available on GitHub.com and GitHub Enterprise Cloud only.

## From CI

Attach the screenshots and videos Playwright Test already saves under `test-results` (`screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`) with the same command:

```yaml
permissions:
  pull-requests: write
steps:
  - run: npx playwright test
  - name: Attach failure screenshots and videos to the PR
    if: failure() && github.event_name == 'pull_request'
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      files=$(find test-results -name '*.png' -o -name '*.webm' | head -20)
      if [ -n "$files" ]; then
        gh pr comment ${{ github.event.pull_request.number }} \
          --body "Failure screenshots and videos from run ${{ github.run_id }}." \
          $(printf -- '--attach %s ' $files)
      fi
```

For a polished walkthrough of a new feature, record a hero script as described in [video-recording.md](video-recording.md) and attach the resulting WebM the same way.
