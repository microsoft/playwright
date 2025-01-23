# How to File a Bug Report That Actually Gets Resolved

Make sure you’re on the latest Playwright release before filing. Check existing GitHub issues to avoid duplicates.

## Use the Template

Follow the **Bug Report** template. It guides you step-by-step:

- Fill it out thoroughly.
- Clearly list the steps needed to reproduce the bug.
- Provide what you expected to see versus what happened in reality.
- Include system info from `npx envinfo --preset playwright`.

## Keep Your Repro Minimal

We can't parse your entire code base. Reduce it down to the absolute essentials:

- Start a fresh project (`npm init playwright@latest new-project`).
- Add only the code/DOM needed to show the problem.
- Only use major frameworks if necessary (React, Angular, static HTTP server, etc.). 
- Avoid adding extra libraries unless absolutely necessary. Note that we won't install any suspect dependencies.

## Why This Matters
- Most issues that lack a repro turn out to be misconfigurations or usage errors.
- We can't fix problems if we can’t reproduce them ourselves.
- We can’t debug entire private projects or handle sensitive credentials.
- Each confirmed bug will have a test in our repo, so your repro must be as clean as possible.

## More Help

- [Stack Overflow’s Minimal Reproducible Example Guide](https://stackoverflow.com/help/minimal-reproducible-example)
- [Playwright Debugging Tools](https://playwright.dev/docs/debug)

## Bottom Line
A well-isolated bug speeds up verification and resolution. Minimal, public repro or it’s unlikely we can assist.
