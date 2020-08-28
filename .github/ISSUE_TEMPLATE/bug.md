---
name: Bug Report
about: Something doesn't work like it should? Tell us!
title: "[BUG]"
labels: ''
assignees: ''

---

**Context:**
- Playwright Version: [what Playwright version do you use?]
- Operating System: [e.g. Windows, Linux or Mac]
- Node.js version: [e.g. 10.12, 10.14]
- Browser: [e.g. All, Chromium, Firefox, WebKit]
- Extra: [any specific details about your environment]

<!-- CLI to auto-capture this info -->
<!-- npx envinfo --preset playwright -->

**Code Snippet**

Help us help you! Put down a short code snippet that illustrates your bug and
that we can run and debug locally. For example:

```javascript
const {chromium, webkit, firefox} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  // ...
})();
```

**Describe the bug**

Add any other details about the problem here.
