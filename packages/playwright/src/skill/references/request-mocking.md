# Request Mocking

Intercept, mock, modify, and block network requests using `page.route()`.

## Basic Syntax

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/endpoint', route => {
    // Handle the route
  });
}"
```

## URL Patterns

```
**/api/users           - Exact path match
**/api/*/details       - Wildcard in path
**/*.{png,jpg,jpeg}    - Match file extensions
**/search?q=*          - Match query parameters
/\/api\/v\d+\/users/   - Regex pattern (passed as RegExp)
```

## Mock API Responses

### Return Static JSON

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/users', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
    });
  });
}"
```

### Return with Custom Headers

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/data', route => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ success: true })
    });
  });
}"
```

### Return HTML

```bash
playwright-cli run-code "async page => {
  await page.route('**/page.html', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Mocked Page</h1></body></html>'
    });
  });
}"
```

### Return Based on Request Data

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/search', async route => {
    const request = route.request();
    const postData = request.postDataJSON();

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: postData.query,
        results: ['mock result 1', 'mock result 2']
      })
    });
  });
}"
```

## Modify Real Responses

### Intercept and Transform

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/products', async route => {
    // Fetch the real response
    const response = await route.fetch();
    const json = await response.json();

    // Modify it
    json.products = json.products.map(p => ({
      ...p,
      price: 0,
      discount: '100%'
    }));

    // Return modified response
    await route.fulfill({ response, json });
  });
}"
```

### Add Fields to Response

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/user/profile', async route => {
    const response = await route.fetch();
    const json = await response.json();

    // Add mock fields
    json.isPremium = true;
    json.credits = 9999;

    await route.fulfill({ response, json });
  });
}"
```

### Filter Response Data

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/items', async route => {
    const response = await route.fetch();
    const json = await response.json();

    // Filter to only active items
    json.items = json.items.filter(item => item.active);

    await route.fulfill({ response, json });
  });
}"
```

## Modify Request Headers

### Add Authorization

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/**', async route => {
    const headers = {
      ...route.request().headers(),
      'Authorization': 'Bearer my-secret-token'
    };
    await route.continue({ headers });
  });
}"
```

### Add Custom Headers

```bash
playwright-cli run-code "async page => {
  await page.route('**/*', async route => {
    const headers = {
      ...route.request().headers(),
      'X-Test-Mode': 'true',
      'X-Request-Id': Date.now().toString()
    };
    await route.continue({ headers });
  });
}"
```

### Remove Headers

```bash
playwright-cli run-code "async page => {
  await page.route('**/*', async route => {
    const headers = { ...route.request().headers() };
    delete headers['cookie'];
    delete headers['authorization'];
    await route.continue({ headers });
  });
}"
```

## Block Requests

### Block by URL Pattern

```bash
# Block images
playwright-cli run-code "async page => {
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());
}"

# Block fonts
playwright-cli run-code "async page => {
  await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());
}"

# Block CSS
playwright-cli run-code "async page => {
  await page.route('**/*.css', route => route.abort());
}"
```

### Block Third-Party Scripts

```bash
playwright-cli run-code "async page => {
  await page.route('**/*google-analytics*/**', route => route.abort());
  await page.route('**/*googletagmanager*/**', route => route.abort());
  await page.route('**/*facebook*/**', route => route.abort());
  await page.route('**/*hotjar*/**', route => route.abort());
  await page.route('**/*intercom*/**', route => route.abort());
}"
```

### Block All External Requests

```bash
playwright-cli run-code "async page => {
  const allowedDomain = 'example.com';
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname.includes(allowedDomain)) {
      route.continue();
    } else {
      route.abort();
    }
  });
}"
```

## Simulate Errors

### HTTP Error Codes

```bash
# 404 Not Found
playwright-cli run-code "async page => {
  await page.route('**/api/missing', route => {
    route.fulfill({ status: 404, body: 'Not Found' });
  });
}"

# 500 Internal Server Error
playwright-cli run-code "async page => {
  await page.route('**/api/broken', route => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' })
    });
  });
}"

# 401 Unauthorized
playwright-cli run-code "async page => {
  await page.route('**/api/protected', route => {
    route.fulfill({
      status: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    });
  });
}"

# 429 Rate Limited
playwright-cli run-code "async page => {
  await page.route('**/api/limited', route => {
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Too Many Requests' })
    });
  });
}"
```

### Network Failures

```bash
# Connection refused
playwright-cli run-code "async page => {
  await page.route('**/api/unreachable', route => route.abort('connectionrefused'));
}"

# Timeout
playwright-cli run-code "async page => {
  await page.route('**/api/slow', route => route.abort('timedout'));
}"

# Connection reset
playwright-cli run-code "async page => {
  await page.route('**/api/reset', route => route.abort('connectionreset'));
}"

# Internet disconnected
playwright-cli run-code "async page => {
  await page.route('**/api/offline', route => route.abort('internetdisconnected'));
}"
```

## Delayed Responses

```bash
# Simulate slow API
playwright-cli run-code "async page => {
  await page.route('**/api/slow-endpoint', async route => {
    await new Promise(r => setTimeout(r, 3000)); // 3 second delay
    route.fulfill({
      status: 200,
      body: JSON.stringify({ data: 'finally loaded' })
    });
  });
}"
```

## Conditional Mocking

### Based on Request Method

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/resource', route => {
    const method = route.request().method();

    if (method === 'GET') {
      route.fulfill({
        body: JSON.stringify({ items: [] })
      });
    } else if (method === 'POST') {
      route.fulfill({
        status: 201,
        body: JSON.stringify({ id: 123, created: true })
      });
    } else if (method === 'DELETE') {
      route.fulfill({ status: 204 });
    } else {
      route.continue();
    }
  });
}"
```

### Based on Request Body

```bash
playwright-cli run-code "async page => {
  await page.route('**/api/login', route => {
    const body = route.request().postDataJSON();

    if (body.username === 'admin' && body.password === 'secret') {
      route.fulfill({
        body: JSON.stringify({ token: 'mock-jwt-token' })
      });
    } else {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      });
    }
  });
}"
```

## Remove Routes

```bash
# Remove specific route
playwright-cli run-code "async page => {
  const handler = route => route.abort();
  await page.route('**/api/blocked', handler);

  // Later, remove the route
  await page.unroute('**/api/blocked', handler);
}"

# Remove all routes for a pattern
playwright-cli run-code "async page => {
  await page.unroute('**/api/**');
}"
```

## Logging Requests

```bash
# Log all requests and responses
playwright-cli run-code "async page => {
  page.on('request', request => {
    console.log('>>', request.method(), request.url());
  });
  page.on('response', response => {
    console.log('<<', response.status(), response.url());
  });
}"

# Log only failed requests
playwright-cli run-code "async page => {
  page.on('requestfailed', request => {
    console.log('FAILED:', request.url(), request.failure().errorText);
  });
}"
```

## Wait for Requests

```bash
# Wait for specific request after action
playwright-cli run-code "async page => {
  const [response] = await Promise.all([
    page.waitForResponse('**/api/submit'),
    page.click('button[type=submit]')
  ]);
  return { status: response.status(), ok: response.ok() };
}"

# Wait for request with custom condition
playwright-cli run-code "async page => {
  const response = await page.waitForResponse(
    response => response.url().includes('/api/') && response.status() === 200
  );
  return await response.json();
}"
```

## HAR File Mocking

```bash
# Record network to HAR
playwright-cli run-code "async page => {
  await page.routeFromHAR('network.har', { update: true });
  // Navigate and interact - requests are recorded
}"

# Replay from HAR
playwright-cli run-code "async page => {
  await page.routeFromHAR('network.har');
  // Requests matching HAR entries return recorded responses
}"
```
