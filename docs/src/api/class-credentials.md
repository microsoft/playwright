# class: Credentials
* since: v1.61

`Credentials` is a virtual WebAuthn authenticator scoped to a [BrowserContext]. It lets tests
register passkeys and answer `navigator.credentials.create()` / `navigator.credentials.get()`
ceremonies in the page, without a real authenticator or hardware security key.

There are two common ways to use it:

- **Seed a known credential.** The passkey already exists — for example, your backend provisioned
  it for a test user. Import it with [`method: Credentials.create`] so the app under test can sign
  in right away. See the first example below.
- **Capture a credential, then reuse it.** Let the app register a passkey once in a setup test,
  read it back with [`method: Credentials.get`], and seed it into later tests — the same way
  [`method: BrowserContext.storageState`] reuses signed-in state. See the second example below.

**Usage: seed a known credential**

```js
const context = await browser.newContext();

// A passkey your backend already provisioned for a test user.
await context.credentials.create({
  rpId: 'example.com',
  id: knownCredentialId, // base64url
  userHandle: knownUserHandle, // base64url
  privateKey: knownPrivateKey, // base64url PKCS#8 (DER)
  publicKey: knownPublicKey, // base64url SPKI (DER)
});
await context.credentials.install();

const page = await context.newPage();
await page.goto('https://example.com/login');
// The page's navigator.credentials.get() is answered with the seeded passkey.
```

**Usage: capture a passkey, then reuse it**

```js
// setup test: let the app register a passkey, then save it.
const context = await browser.newContext();
await context.credentials.install();

const page = await context.newPage();
await page.goto('https://example.com/register');
await page.getByRole('button', { name: 'Create a passkey' }).click();

// Read back the passkey the page registered — it includes the private key.
const [credential] = await context.credentials.get({ rpId: 'example.com' });
fs.writeFileSync('playwright/.auth/passkey.json', JSON.stringify(credential));
```

```js
// later test: seed the captured passkey so the app starts already enrolled.
const credential = JSON.parse(fs.readFileSync('playwright/.auth/passkey.json', 'utf8'));
const context = await browser.newContext();
await context.credentials.create(credential);
await context.credentials.install();

const page = await context.newPage();
await page.goto('https://example.com/login');
// navigator.credentials.get() resolves the captured passkey — already signed in.
```

**Defaults**

- The authenticator presents itself as a **platform** authenticator (`authenticatorAttachment` is
  `'platform'`), and `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` resolves
  to `true` in the page.
- Seeded credentials are **discoverable** (resident), so both username-then-passkey and
  usernameless passkey flows resolve them.
- Fresh keys are ECDSA P-256 (COSE algorithm `-7`). An omitted `id` or `userHandle` is
  filled with 16 random bytes.
- User verification is **on** by default — every assertion and attestation reports the user as
  verified. Toggle this with [`method: Credentials.setUserVerified`].

## async method: Credentials.install
* since: v1.61

Installs the virtual WebAuthn authenticator into the context, overriding
`navigator.credentials.create()` and `navigator.credentials.get()` in all current
and future pages. Call this before the page first touches `navigator.credentials`.

Required: until `install()` is called, no interception is in place and the page sees
the platform's native (or absent) WebAuthn behaviour. Seeding credentials with
[`method: Credentials.create`] without `install()` populates the authenticator, but the
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

Seeds a virtual WebAuthn credential and returns it.

With only `rpId`, generates a fresh **ECDSA P-256** keypair, credential id and user handle. The
seeded credential is discoverable (resident), so the page can resolve it from both
username-then-passkey and usernameless passkey flows. The returned object carries the `privateKey` and `publicKey`, so
it can be persisted to disk and re-seeded in a later test.

To **import a known credential**, supply all four of `id`, `userHandle`, `privateKey` and
`publicKey` together.

Call [`method: Credentials.install`] before navigating to a page that uses WebAuthn.

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

Removes a credential from the authenticator by its id. Works for any credential currently held —
both those seeded with [`method: Credentials.create`] and those the page registered itself by
calling `navigator.credentials.create()`.

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

Returns every credential currently held by the authenticator, optionally filtered by `rpId` or
`id`. This includes both credentials seeded with [`method: Credentials.create`] and credentials
the page registered itself by calling `navigator.credentials.create()`.

Each returned credential includes its `privateKey` and `publicKey`, so a passkey the app just
registered can be saved and re-seeded into a later test with [`method: Credentials.create`] — see the second example in the class overview.

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

Controls whether the virtual authenticator reports the user as **verified**. This is a
context-wide setting (default `true`) that toggles the user-verified (UV) flag in the
`authenticatorData` of every subsequent `navigator.credentials.create()` and
`navigator.credentials.get()` ceremony.

When set to `false`, ceremonies still **succeed**, but the resulting assertion/attestation reports
that user verification was *not* performed — the user-present (UP) flag stays set. It does **not**
simulate a cancelled or denied prompt, and it does not reject the call. Use it to test how your
relying party or app handles an assertion that lacks user verification, for example requiring
step-up authentication.

**Usage**

```js
await context.credentials.install();
await context.credentials.create({ rpId: 'example.com' });

// Report assertions as NOT user-verified, e.g. a presence-only tap.
await context.credentials.setUserVerified(false);

const page = await context.newPage();
await page.goto('https://example.com/login');
// Assert the app requires step-up auth or rejects the unverified sign-in.

// Restore verified assertions for later steps.
await context.credentials.setUserVerified(true);
```

### param: Credentials.setUserVerified.value
* since: v1.61
- `value` <[boolean]>

`true` to report assertions and attestations as user-verified (default), `false` to report them as
not user-verified.
