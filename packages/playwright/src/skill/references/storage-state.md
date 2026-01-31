# Storage Management

Manage cookies, localStorage, sessionStorage, and browser storage state.

## Storage State

Save and restore complete browser state including cookies and storage.

### Save Storage State

```bash
# Save to auto-generated filename (storage-state-{timestamp}.json)
playwright-cli state-save

# Save to specific filename
playwright-cli state-save my-auth-state.json
```

### Restore Storage State

```bash
# Load storage state from file
playwright-cli state-load my-auth-state.json

# Reload page to apply cookies
playwright-cli open https://example.com
```

### Storage State File Format

The saved file contains:

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123",
      "domain": "example.com",
      "path": "/",
      "expires": 1735689600,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://example.com",
      "localStorage": [
        { "name": "theme", "value": "dark" },
        { "name": "user_id", "value": "12345" }
      ]
    }
  ]
}
```

## Cookies

### Get All Cookies

```bash
playwright-cli run-code "async page => {
  const cookies = await page.context().cookies();
  return cookies;
}"
```

### Get Cookies for Specific URL

```bash
playwright-cli run-code "async page => {
  const cookies = await page.context().cookies('https://example.com');
  return cookies;
}"
```

### Add a Single Cookie

```bash
playwright-cli run-code "async page => {
  await page.context().addCookies([{
    name: 'session',
    value: 'abc123',
    domain: 'example.com',
    path: '/'
  }]);
}"
```

### Add Multiple Cookies

```bash
playwright-cli run-code "async page => {
  await page.context().addCookies([
    {
      name: 'session_id',
      value: 'sess_abc123',
      domain: 'example.com',
      path: '/',
      httpOnly: true,
      secure: true
    },
    {
      name: 'preferences',
      value: JSON.stringify({ theme: 'dark', lang: 'en' }),
      domain: 'example.com',
      path: '/'
    },
    {
      name: 'tracking_opt_out',
      value: 'true',
      domain: '.example.com',
      path: '/'
    }
  ]);
}"
```

### Add Cookie with Expiration

```bash
playwright-cli run-code "async page => {
  const oneWeekFromNow = Date.now() / 1000 + 7 * 24 * 60 * 60;
  await page.context().addCookies([{
    name: 'remember_me',
    value: 'token123',
    domain: 'example.com',
    path: '/',
    expires: oneWeekFromNow
  }]);
}"
```

### Clear All Cookies

```bash
playwright-cli run-code "async page => {
  await page.context().clearCookies();
}"
```

### Clear Cookies by Name

```bash
playwright-cli run-code "async page => {
  await page.context().clearCookies({ name: 'session_id' });
}"
```

### Clear Cookies by Domain

```bash
playwright-cli run-code "async page => {
  await page.context().clearCookies({ domain: 'example.com' });
}"
```

### Clear Cookies by Path

```bash
playwright-cli run-code "async page => {
  await page.context().clearCookies({ path: '/api' });
}"
```

### Find Specific Cookie

```bash
playwright-cli run-code "async page => {
  const cookies = await page.context().cookies();
  const session = cookies.find(c => c.name === 'session_id');
  return session ? session.value : null;
}"
```

## Local Storage

### Get All localStorage

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items[key] = localStorage.getItem(key);
    }
    return items;
  });
}"
```

### Get Single Value

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(() => localStorage.getItem('token'));
}"
```

### Get and Parse JSON Value

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(() => {
    const data = localStorage.getItem('user_settings');
    return data ? JSON.parse(data) : null;
  });
}"
```

### Set Value

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
}"
```

### Set JSON Value

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => {
    localStorage.setItem('user_settings', JSON.stringify({
      theme: 'dark',
      language: 'en',
      notifications: true
    }));
  });
}"
```

### Set Multiple Values

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => {
    localStorage.setItem('token', 'jwt_abc123');
    localStorage.setItem('user_id', '12345');
    localStorage.setItem('expires_at', Date.now() + 3600000);
  });
}"
```

### Remove Single Item

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => localStorage.removeItem('token'));
}"
```

### Clear All localStorage

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => localStorage.clear());
}"
```

## Session Storage

### Get All sessionStorage

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      items[key] = sessionStorage.getItem(key);
    }
    return items;
  });
}"
```

### Get Single Value

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(() => sessionStorage.getItem('form_data'));
}"
```

### Set Value

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => sessionStorage.setItem('step', '3'));
}"
```

### Clear sessionStorage

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => sessionStorage.clear());
}"
```

## IndexedDB

### List Databases

```bash
playwright-cli run-code "async page => {
  return await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    return databases;
  });
}"
```

### Delete Database

```bash
playwright-cli run-code "async page => {
  await page.evaluate(() => {
    indexedDB.deleteDatabase('myDatabase');
  });
}"
```

## Common Patterns

### Authentication State Reuse

```bash
# Step 1: Login and save state
playwright-cli open https://app.example.com/login
playwright-cli snapshot
playwright-cli fill e1 "user@example.com"
playwright-cli fill e2 "password123"
playwright-cli click e3

# Save the authenticated state
playwright-cli state-save auth.json

# Step 2: Later, restore state and skip login
playwright-cli state-load auth.json
playwright-cli open https://app.example.com/dashboard
# Already logged in!
```

### Save and Restore Roundtrip

```bash
# Set up authentication state
playwright-cli open https://example.com
playwright-cli eval "() => { document.cookie = 'session=abc123'; localStorage.setItem('user', 'john'); }"

# Save state to file
playwright-cli state-save my-session.json

# ... later, in a new session ...

# Restore state
playwright-cli state-load my-session.json
playwright-cli open https://example.com
# Cookies and localStorage are restored!
```

## Security Notes

- Never commit storage state files containing auth tokens
- Add `*.auth-state.json` to `.gitignore`
- Delete state files after automation completes
- Use environment variables for sensitive data
- Consider using `--in-memory` mode for sensitive operations
