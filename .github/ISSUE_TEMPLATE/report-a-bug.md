---
name: Report a bug
about: Something doesn't work like it should? Tell us!
title: "[BUG]"
labels: ''
assignees: ''

---

**Context:**
- PlayWright Version: [what PlayWright version do you use?]
- Operating System: [e.g. Windows, Linux or Mac]
- Extra: [any specific details about your environment]

**Code Snippet**

Help us help you! Please put down a short code snippet that illustrates your bug and
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
