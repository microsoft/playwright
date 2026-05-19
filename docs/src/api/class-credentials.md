# class: Credentials
* since: v1.61

`Credentials` provides a virtual WebAuthn authenticator scoped to a [BrowserContext]. It lets tests
seed credentials, intercept `navigator.credentials.create()` / `navigator.credentials.get()` calls
in pages, and complete WebAuthn ceremonies without a real authenticator.

Implemented in userland via an injected script, so it works across Chromium, Firefox and WebKit.

**Usage**

```js
const context = await browser.newContext();
await context.credentials.install();
await context.credentials.create({ rpId: 'example.com' });
const page = await context.newPage();
await page.goto('https://example.com/login');
// Page's navigator.credentials.get() will be answered using the seeded credential.
```

## async method: Credentials.install
* since: v1.61

Installs the virtual WebAuthn authenticator into the context, overriding
`navigator.credentials.create()` and `navigator.credentials.get()` in all current
and future pages. Call this before the page first touches `navigator.credentials`.

Required: until `install()` is called, no interception is in place and the page sees
the platform's native (or absent) WebAuthn behaviour. Seeding credentials with
[`method: Credentials.create`] without `install()` populates the registry but the
page will never see those credentials.

## async method: Credentials.create
* since: v1.61
- returns: <[Object]>
  * alias: VirtualCredential
  - `id` <[string]> Base64url-encoded credential id.
  - `rpId` <[string]> Relying party id.
  - `userHandle` <[string]> Base64url-encoded user handle.
  - `privateKey` <[string]> Base64url-encoded PKCS#8 (DER) private key.
  - `publicKey` <[string]> Base64url-encoded SPKI (DER) public key.

Seeds a virtual WebAuthn credential. With only `rpId`, generates a fresh ECDSA P-256 keypair,
credential id and user handle. To import a pre-registered credential (e.g. authenticating as an
existing test user the server already knows about), supply all four of `id`, `userHandle`,
`privateKey` and `publicKey` together. Call [`method: Credentials.install`] before navigating to a
page that uses WebAuthn.

### param: Credentials.create.options
* since: v1.61
- `options` <[Object]>
  - `rpId` <[string]> Relying party id (typically the site's effective domain).
  - `id` ?<[string]> Base64url-encoded credential id. Auto-generated if omitted.
  - `userHandle` ?<[string]> Base64url-encoded user handle. Auto-generated if omitted.
  - `privateKey` ?<[string]> Base64url-encoded PKCS#8 (DER) private key. Auto-generated if omitted.
  - `publicKey` ?<[string]> Base64url-encoded SPKI (DER) public key. Auto-generated if omitted.

## async method: Credentials.delete
* since: v1.61

Removes a previously seeded credential.

### param: Credentials.delete.id
* since: v1.61
- `id` <[string]>

Base64url-encoded credential id.

## async method: Credentials.get
* since: v1.61
- returns: <[Array]<[Object]>>
  * alias: VirtualCredential
  - `id` <[string]>
  - `rpId` <[string]>
  - `userHandle` <[string]>
  - `privateKey` <[string]>
  - `publicKey` <[string]>

Returns seeded credentials, optionally filtered by `rpId` or `id`.

### option: Credentials.get.rpId
* since: v1.61
- `rpId` <[string]>

Only return credentials for this relying party id.

### option: Credentials.get.id
* since: v1.61
- `id` <[string]>

Only return the credential with this base64url-encoded id.

## async method: Credentials.setUserVerified
* since: v1.61

Toggles whether the virtual authenticator auto-approves user-verification prompts. Useful for
simulating a user denying biometric verification.

### param: Credentials.setUserVerified.value
* since: v1.61
- `value` <[boolean]>

`true` to auto-approve user verification (default), `false` to refuse.
