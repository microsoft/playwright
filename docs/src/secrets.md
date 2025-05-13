---
id: secrets
title: "Secrets"
---

## Properly handling Secrets

During test execution, Playwright generates artifacts like console logs, the HTML report or a trace file, that all contain information about your test execution.
This information can contain sensitive data, like user credentials for a test user, access tokens to a staging backend, testing source code or sometimes even your application source code.

This means that you need to treat these files just as careful as you treat that sensitive data.
If you upload reports and traces as part of your CI workflow, make sure that you only upload them to trusted artifact stores, or that you encrypt the files before upload. The same is true for sharing artifacts with team members: Use a trusted file share or encrypt the files before sharing.

An easy way of ensuring confidentiality is to create an encrypted ZIP file with `zip -P <your password> -r playwright-report.zip playwright-report/`.

