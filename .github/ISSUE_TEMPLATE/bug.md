---
name: Bug Report
about: Something doesn't work like it should? Tell us!
title: "[BUG]"
labels: ''
assignees: ''

---

<!-- ⚠️⚠️ Do not delete this template ⚠️⚠️ -->

<!-- 🔎 Search existing issues to avoid creating duplicates. -->
<!-- 🧪 Test using the latest Playwright release to see if your issue has already been fixed -->
<!-- 💡 Provide enough information for us to be able to reproduce your issue locally -->

### System info
- Playwright Version: [v1.XX]
- Operating System: [All, Windows 11, Ubuntu 20, macOS 13.2, etc.]
- Browser: [All, Chromium, Firefox, WebKit]
- Other info:

### Source code

- [ ] I provided exact source code that allows reproducing the issue locally.

<!-- For simple cases, please provide a self-contained test file along with the config file -->
<!-- For larger cases, you can provide a GitHub repo you created for this issue -->
<!-- If we can not reproduce the problem locally, we won't be able to act on it -->
<!-- You can still file without the exact code and we will try to help, but if we can't repro, it will be closed -->

**Link to the GitHub repository with the repro**

[https://github.com/your_profile/playwright_issue_title]

or

**Config file**

```js
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], },
    },
});
```

**Test file (self-contained)**

```js
it('should check the box using setChecked', async ({ page }) => {
  await page.setContent(`<input id='checkbox' type='checkbox'></input>`);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('checkbox')).toBeChecked();
});
```

**Steps**
- [Run the test]
- [...]

**Expected**

[Describe expected behavior]

**Actual**

[Describe actual behavior]
