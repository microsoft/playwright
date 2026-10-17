# Test registry

Every test in `tests/page` and `tests/library`, with its identifier. The identifier is
the first token of the test title. The test titles are the source of truth: this file is
made from them, and `npm run lint-tests` fails when this file does not match the tests.

The identifier is two uppercase letters for the subsystem, then a three-digit number.
The two letters come from the file name or from the testing aspect that the files
share. Two forms:

- `CL-001` — one behaviour, expected in every language port. One identifier shared by
  all ports, which is what makes a parity gap visible.
- `CL-PY-001` — specific to one port **by design** (here `PY` is Python): the API
  exists in only one language, or the language bindings are documented to behave
  differently. No such tests exist yet.

An identifier belongs to one test declaration in the source. When a loop declares the
same test more than once, all the copies share the identifier. The title column then
shows the variants in braces.

The Modified column is the date when the source of the test last changed. The Hash
column is a hash of that source: the test call from `test(` to its closing parenthesis,
without spaces and comments. When the hash changes, the update command below sets
Modified to the current date. The first dates come from the git history.

Each language port has a registry of the same form. To find the tests that changed
upstream, compare the hashes. Do not compare only the dates: a change can land some
days after its Modified date.

To add a test, give it the next free number of its subsystem. Do not use the number of a
removed test again. When you move a test to another file, keep its identifier. To add a
subsystem, add a row to the Subsystems table. When you add, change, move or remove a
test, update this file:

    PWTEST_UPDATE_REGISTRY=1 npm run test -- --list --reporter=./tests/config/registryReporter.ts

## Subsystems

98 subsystems, 4933 tests (5330 with loop copies).

| Code | Subsystem | Files | Tests |
|---|---|---|---|
| `AN` | Android WebViews | `library/unit/android-webviews` | 1 |
| `AR` | Aria snapshot | `page/{page-aria-snapshot, page-aria-snapshot-ai, page-aria-snapshot-json, to-match-aria-snapshot}`<br>`library/role-utils` | 170 |
| `AT` | Add script and style tags | `page/{page-add-script-tag, page-add-style-tag}` | 20 |
| `AU` | Authentication | `library/{browsercontext-credentials, browsercontext-webauthn}` | 24 |
| `AW` | Auto-waiting | `page/{page-autowaiting-basic, page-autowaiting-no-hang}` | 23 |
| `BC` | BrowserContext | `library/{browsercontext-basic, browsercontext-events, browsercontext-pages, browsercontext-page-event, browsercontext-reuse}` | 83 |
| `BP` | Browsers path | `library/browsers-path` | 2 |
| `BR` | Browser | `library/{browser, browser-server}` | 10 |
| `BT` | BrowserType | `library/{browsertype-basic, browsertype-launch, launcher, browsertype-launch-server, browsertype-connect, browsertype-launch-selenium}` | 103 |
| `BU` | Before unload | `library/beforeunload` | 12 |
| `CA` | Capabilities | `library/{capabilities, modernizr}` | 31 |
| `CC` | Client certificates | `library/client-certificates` | 41 |
| `CD` | CDP | `library/chromium/{connect-over-cdp, session}` | 52 |
| `CF` | Code frame | `library/unit/code-frame` | 13 |
| `CG` | Codegen | `library/inspector/{cli-codegen-1, cli-codegen-2, cli-codegen-3, cli-codegen-aria, cli-codegen-pick-locator, cli-codegen-javascript, cli-codegen-test, cli-codegen-python, cli-codegen-python-async, cli-codegen-pytest, cli-codegen-java, cli-codegen-csharp}`<br>`library/unit/codegen` | 191 |
| `CH` | Check | `page/page-check` | 17 |
| `CK` | Clock | `library/{page-clock, page-clock.frozen}`<br>`library/unit/clock` | 219 |
| `CL` | Click | `page/{page-click, page-click-scroll, page-click-react, page-click-during-navigation, page-click-timeout-1, page-click-timeout-2, page-click-timeout-3, page-click-timeout-4}` | 122 |
| `CM` | Console messages | `page/page-event-console` | 20 |
| `CN` | Channels | `library/channels` | 6 |
| `CO` | Cookies | `library/{browsercontext-cookies, browsercontext-add-cookies, browsercontext-clearcookies, browsercontext-cookies-third-party}` | 62 |
| `CR` | Chromium | `library/chromium/{chromium, launcher, extensions, bfcache, connect-to-worker, disable-web-security}` | 45 |
| `CS` | CSP | `library/browsercontext-csp` | 5 |
| `CV` | Coverage | `library/chromium/{js-coverage, css-coverage}`<br>`library/coverage` | 30 |
| `DB` | Debug | `library/{debugger, debug-controller}` | 22 |
| `DC` | Default (persistent) context | `library/{defaultbrowsercontext-1, defaultbrowsercontext-2}` | 42 |
| `DD` | Drag and drop | `page/{page-drag, page-drop}` | 27 |
| `DE` | Dispatch event | `page/page-dispatchevent` | 17 |
| `DI` | Dialog | `page/page-dialog` | 13 |
| `DO` | Download | `library/{download, downloads-path}` | 44 |
| `DV` | Device | `library/{browsercontext-device, browsercontext-dsf, browsercontext-viewport-mobile}` | 26 |
| `EE` | Event emitter | `page/page-listeners`<br>`library/events/{add-listeners, check-listener-leaks, events-list, listener-count, listeners-side-effects, listeners, max-listeners, method-names, modify-in-emit, num-args, once, prepend, remove-all-listeners-wait, remove-all-listeners, remove-listeners, set-max-listeners-side-effects, special-event-names, subclass, symbols}` | 56 |
| `EF` | Expose function | `page/page-expose-function`<br>`library/browsercontext-expose-function` | 28 |
| `EH` | ElementHandle | `page/{elementhandle-bounding-box, elementhandle-click, elementhandle-content-frame, elementhandle-convenience, elementhandle-eval-on-selector, elementhandle-misc, elementhandle-owner-frame, elementhandle-press, elementhandle-query-selector, elementhandle-screenshot, elementhandle-scroll-into-view, elementhandle-select-text, elementhandle-type, elementhandle-wait-for-element-state}` | 123 |
| `EM` | Emulation | `page/page-emulate-media`<br>`library/{emulation-focus, emulation-coop}` | 27 |
| `ER` | Page errors and crashes | `page/page-event-pageerror`<br>`library/page-event-crash` | 21 |
| `ES` | Eval on selector | `page/{eval-on-selector, eval-on-selector-all}` | 35 |
| `EV` | Evaluate | `page/{page-evaluate, page-evaluate-handle, page-evaluate-callback, page-evaluate-no-stall}` | 137 |
| `EX` | Expect | `page/{expect-boolean, expect-builtins, expect-matcher-result, expect-misc, expect-timeout, expect-to-have-accessible, expect-to-have-text, expect-to-have-value, expect-with-snapshot, matchers.misc}` | 328 |
| `FA` | Favicon | `library/favicon` | 1 |
| `FC` | File chooser | `page/page-filechooser` | 28 |
| `FE` | Fetch | `library/{global-fetch, global-fetch-cookie, browsercontext-fetch, browsercontext-fetch-algorithms, browsercontext-fetch-happy-eyeballs}` | 188 |
| `FF` | Firefox | `library/firefox/launcher`<br>`page/firefox-network-response` | 8 |
| `FI` | Fill | `page/page-fill` | 36 |
| `FO` | Focus | `page/page-focus` | 12 |
| `FR` | Frame | `page/{frame-evaluate, frame-frame-element, frame-goto, frame-hierarchy}` | 36 |
| `GE` | Geolocation | `library/geolocation` | 9 |
| `GN` | Locator and selector generator | `library/{locator-generator, selector-generator}` | 104 |
| `HA` | HAR | `library/{har, browsercontext-har, har-websocket}` | 112 |
| `HE` | Headful | `library/headful` | 16 |
| `HT` | Hit target | `library/hit-target` | 22 |
| `IF` | Input files | `page/page-set-input-files` | 21 |
| `IN` | Inspector | `library/inspector/{pause, recorder-api, console-api, title}` | 58 |
| `IS` | Init script | `page/{page-add-init-script, page-add-init-script-callback}`<br>`library/browsercontext-add-init-script` | 35 |
| `JH` | JSHandle | `page/{jshandle-as-element, jshandle-evaluate, jshandle-json-value, jshandle-properties, jshandle-to-string}` | 23 |
| `JS` | JSON schema | `library/unit/json-schema` | 10 |
| `KB` | Keyboard | `page/page-keyboard` | 53 |
| `LC` | Locale | `library/browsercontext-locale` | 14 |
| `LE` | Leaks | `page/page-leaks`<br>`library/heap` | 14 |
| `LG` | Logger | `library/logger` | 2 |
| `LH` | Locator handler | `page/page-add-locator-handler` | 14 |
| `LO` | Locator | `page/{locator-any-frame, locator-click, locator-convenience, locator-element-handle, locator-evaluate, locator-frame, locator-highlight, locator-is-visible, locator-list, locator-misc-1, locator-misc-2, locator-query, locator-wait-for-function}`<br>`library/locator-highlight` | 199 |
| `MC` | Multiple clients | `library/multiclient` | 19 |
| `MO` | Mouse | `page/{page-mouse, wheel}` | 23 |
| `NA` | Navigation | `page/{page-goto, page-navigation, page-history, page-event-load}`<br>`library/browsercontext-base-url` | 96 |
| `NE` | Network | `page/{page-network-request, page-network-response, page-network-sizes, page-network-idle, page-event-network, page-event-request, network-post-data, page-set-extra-http-headers}`<br>`library/{browsercontext-set-extra-http-headers, browsercontext-network-event, network-timeout, resource-timing, ignorehttpserrors}` | 142 |
| `OO` | OOPIF | `library/chromium/oopif` | 29 |
| `PA` | Page | `page/{page-basic, page-set-content, page-transition}`<br>`library/page-close` | 56 |
| `PC` | Playwright client | `library/playwright-client` | 1 |
| `PD` | PDF | `library/pdf` | 2 |
| `PE` | Permissions | `library/permissions` | 23 |
| `PO` | Popup | `page/page-event-popup`<br>`library/popup` | 28 |
| `PR` | Proxy | `library/{proxy, browsercontext-proxy, proxy-pattern, fetch-proxy}` | 47 |
| `PS` | Parser | `library/{locator-parser, component-parser, css-parser}` | 51 |
| `QS` | Query selector | `page/queryselector` | 17 |
| `RE` | Retarget | `page/retarget` | 15 |
| `RO` | Route | `page/{page-route, page-request-continue, page-request-fulfill, page-request-fallback, page-request-intercept, page-request-gc, interception}`<br>`library/{browsercontext-route, unroute-behavior}` | 201 |
| `SC` | Screencast | `library/{screencast, screencast-actions, screencast-overlay}` | 38 |
| `SE` | Selectors | `page/{selectors-css, selectors-text, selectors-role, selectors-get-by, selectors-frame, selectors-misc, selectors-register}`<br>`library/selectors-register` | 167 |
| `SI` | Signals | `library/signals` | 10 |
| `SL` | Slow motion | `library/slowmo` | 39 |
| `SM` | Strict mode | `page/page-strict`<br>`library/browsercontext-strict` | 14 |
| `SO` | Select option | `page/page-select-option` | 33 |
| `SQ` | Sequence | `library/unit/sequence` | 16 |
| `SS` | Screenshot | `page/page-screenshot`<br>`library/screenshot` | 94 |
| `ST` | Storage | `library/browsercontext-storage-state`<br>`page/{page-localstorage, page-cache-storage}` | 32 |
| `TA` | Tap | `library/{tap, locator-dispatchevent-touch}` | 10 |
| `TO` | Timeout runner | `library/unit/timeout-runner` | 1 |
| `TR` | Tracing | `library/tracing`<br>`library/chromium/tracing` | 49 |
| `TV` | Trace viewer | `library/{trace-viewer, snapshot-renderer}` | 135 |
| `TZ` | Timezone | `library/browsercontext-timezone-id` | 6 |
| `UA` | User agent | `library/browsercontext-user-agent` | 6 |
| `VI` | Video | `library/video` | 31 |
| `VP` | Viewport | `library/browsercontext-viewport` | 17 |
| `WA` | Wait for | `page/{page-wait-for-function, page-wait-for-selector-1, page-wait-for-selector-2, page-wait-for-load-state, page-wait-for-navigation, page-wait-for-url, page-wait-for-request, page-wait-for-response}` | 136 |
| `WM` | WebMCP | `library/{webmcp, webmcp-disabled}` | 15 |
| `WO` | Workers | `page/workers`<br>`library/{shared-worker, browsercontext-service-worker-policy}` | 31 |
| `WS` | WebSocket | `library/{web-socket, route-web-socket}` | 40 |

## Tests

### AN — Android WebViews

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `AN-001` | `library/unit/android-webviews.spec.ts` | should attribute a webview socket to the process that owns it | 2026-08-26 | `baf338e2` |

### AR — Aria snapshot

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `AR-001` | `page/page-aria-snapshot.spec.ts` | should snapshot | 2024-10-19 | `7942fe50` |
| `AR-002` | `page/page-aria-snapshot.spec.ts` | should snapshot list | 2024-10-19 | `39303d05` |
| `AR-003` | `page/page-aria-snapshot.spec.ts` | should snapshot list with accessible name | 2024-10-29 | `51806041` |
| `AR-004` | `page/page-aria-snapshot.spec.ts` | should quote names that look like regexes | 2026-09-23 | `cb49538e` |
| `AR-005` | `page/page-aria-snapshot.spec.ts` | should snapshot complex | 2025-03-11 | `32bb1e76` |
| `AR-006` | `page/page-aria-snapshot.spec.ts` | should allow text nodes | 2024-10-29 | `8b2db8fa` |
| `AR-007` | `page/page-aria-snapshot.spec.ts` | should snapshot details visibility | 2024-10-29 | `43298588` |
| `AR-008` | `page/page-aria-snapshot.spec.ts` | should not snapshot text directly inside closed details | 2026-10-07 | `7f8c2a4e` |
| `AR-009` | `page/page-aria-snapshot.spec.ts` | should not snapshot text that is not assigned to a slot | 2026-10-07 | `d8a983fa` |
| `AR-010` | `page/page-aria-snapshot.spec.ts` | should snapshot integration | 2025-03-11 | `8ce0ba22` |
| `AR-011` | `page/page-aria-snapshot.spec.ts` | should support multiline text | 2024-10-29 | `33046882` |
| `AR-012` | `page/page-aria-snapshot.spec.ts` | should concatenate span text | 2024-10-29 | `9fca72a7` |
| `AR-013` | `page/page-aria-snapshot.spec.ts` | should concatenate span text 2 | 2024-10-29 | `1183e6dc` |
| `AR-014` | `page/page-aria-snapshot.spec.ts` | should concatenate div text with spaces | 2024-10-29 | `cecfd1fa` |
| `AR-015` | `page/page-aria-snapshot.spec.ts` | should include pseudo in text | 2025-03-11 | `3a0c9ed4` |
| `AR-016` | `page/page-aria-snapshot.spec.ts` | should not include hidden pseudo in text | 2025-03-11 | `44235e81` |
| `AR-017` | `page/page-aria-snapshot.spec.ts` | should include new line for block pseudo | 2025-03-11 | `a704d991` |
| `AR-018` | `page/page-aria-snapshot.spec.ts` | should work with slots | 2024-10-18 | `8f622a97` |
| `AR-019` | `page/page-aria-snapshot.spec.ts` | should snapshot inner text | 2024-10-29 | `0e500cb4` |
| `AR-020` | `page/page-aria-snapshot.spec.ts` | should include pseudo codepoints | 2024-10-29 | `20b9ec79` |
| `AR-021` | `page/page-aria-snapshot.spec.ts` | check aria-hidden text | 2024-11-01 | `7830a3bc` |
| `AR-022` | `page/page-aria-snapshot.spec.ts` | should ignore presentation and none roles | 2024-11-01 | `dfb8a904` |
| `AR-023` | `page/page-aria-snapshot.spec.ts` | should treat input value as text in templates, but not for checkbox/radio/file | 2025-04-08 | `12dbd017` |
| `AR-024` | `page/page-aria-snapshot.spec.ts` | should not use on as checkbox value | 2024-12-10 | `5a4bafdc` |
| `AR-025` | `page/page-aria-snapshot.spec.ts` | should respect aria-owns | 2025-03-11 | `92bb4fd1` |
| `AR-026` | `page/page-aria-snapshot.spec.ts` | should be ok with circular ownership | 2025-03-11 | `79fc5066` |
| `AR-027` | `page/page-aria-snapshot.spec.ts` | should escape yaml text in text nodes | 2025-03-11 | `9365f289` |
| `AR-028` | `page/page-aria-snapshot.spec.ts` | should normalize whitespace | 2025-03-11 | `36be2bd9` |
| `AR-029` | `page/page-aria-snapshot.spec.ts` | should handle long strings | 2025-03-11 | `8e80fc6c` |
| `AR-030` | `page/page-aria-snapshot.spec.ts` | should escape special yaml characters | 2025-03-11 | `5d65ffcc` |
| `AR-031` | `page/page-aria-snapshot.spec.ts` | should escape special yaml values | 2026-10-16 | `824b3c4b` |
| `AR-032` | `page/page-aria-snapshot.spec.ts` | should not report textarea textContent | 2025-01-30 | `86e62561` |
| `AR-033` | `page/page-aria-snapshot.spec.ts` | should not show visible children of hidden elements | 2025-07-08 | `afb115d0` |
| `AR-034` | `page/page-aria-snapshot.spec.ts` | should not show unhidden children of aria-hidden elements | 2025-07-08 | `cb5b2297` |
| `AR-035` | `page/page-aria-snapshot.spec.ts` | should snapshot placeholder when different from the name | 2025-08-26 | `9914e858` |
| `AR-036` | `page/page-aria-snapshot.spec.ts` | match values both against regex and string | 2025-09-16 | `7c11db87` |
| `AR-037` | `page/page-aria-snapshot.spec.ts` | auto-waits the locator and does not include iframes | 2026-03-26 | `d8ab7d6e` |
| `AR-038` | `page/page-aria-snapshot.spec.ts` | should limit depth | 2026-03-26 | `25e8b0e1` |
| `AR-039` | `page/page-aria-snapshot.spec.ts` | should snapshot a locator inside an iframe | 2026-03-26 | `e500af58` |
| `AR-040` | `page/page-aria-snapshot.spec.ts` | should include frames on frameset pages | 2026-07-16 | `fa471735` |
| `AR-041` | `page/page-aria-snapshot.spec.ts` | should snapshot a locator inside a frameset frame | 2026-07-16 | `32c3d173` |
| `AR-042` | `page/page-aria-snapshot.spec.ts` | should snapshot with box from page | 2026-04-23 | `ef31f53f` |
| `AR-043` | `page/page-aria-snapshot.spec.ts` | should snapshot with box from locator | 2026-04-23 | `22aaec48` |
| `AR-044` | `page/page-aria-snapshot.spec.ts` | should not include box when option is omitted | 2026-04-23 | `bbce38a8` |
| `AR-045` | `page/page-aria-snapshot.spec.ts` | should not include hidden iframes | 2026-09-24 | `7cbbf678` |
| `AR-046` | `page/page-aria-snapshot.spec.ts` | should not include inert elements | 2026-10-08 | `db834b67` |
| `AR-047` | `page/page-aria-snapshot.spec.ts` | should only include the modal dialog content | 2026-10-08 | `243f959f` |
| `AR-048` | `page/page-aria-snapshot-ai.spec.ts` | should generate refs | 2026-10-01 | `98a0a197` |
| `AR-049` | `page/page-aria-snapshot-ai.spec.ts` | should list iframes | 2025-05-09 | `1f5dcad6` |
| `AR-050` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot a locator inside an iframe | 2026-03-20 | `c7c7c0e6` |
| `AR-051` | `page/page-aria-snapshot-ai.spec.ts` | should limit depth across iframe boundary | 2026-03-20 | `4f1d2943` |
| `AR-052` | `page/page-aria-snapshot-ai.spec.ts` | should stitch all frame snapshots | 2026-10-01 | `395921bd` |
| `AR-053` | `page/page-aria-snapshot-ai.spec.ts` | should re-number refs across navigations but not same-document navigations | 2026-10-01 | `dda0e04b` |
| `AR-054` | `page/page-aria-snapshot-ai.spec.ts` | should persist iframe references | 2026-10-01 | `63d51fe7` |
| `AR-055` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for elements with pointer-events:none | 2025-07-31 | `9ddfdf82` |
| `AR-056` | `page/page-aria-snapshot-ai.spec.ts` | emit generic roles for nodes w/o roles | 2025-08-29 | `1a61b89f` |
| `AR-057` | `page/page-aria-snapshot-ai.spec.ts` | should collapse generic nodes | 2025-05-09 | `e1f8ae3f` |
| `AR-058` | `page/page-aria-snapshot-ai.spec.ts` | should include cursor pointer hint | 2025-05-09 | `ce56b6b4` |
| `AR-059` | `page/page-aria-snapshot-ai.spec.ts` | should not nest cursor pointer hints | 2026-07-03 | `475f2360` |
| `AR-060` | `page/page-aria-snapshot-ai.spec.ts` | should omit names that just repeat printed descendant nodes | 2026-07-03 | `a9dce24c` |
| `AR-061` | `page/page-aria-snapshot-ai.spec.ts` | should omit redundant name when a contributing wrapper is collapsed | 2026-07-03 | `871cb72b` |
| `AR-062` | `page/page-aria-snapshot-ai.spec.ts` | should omit redundant name when a contributor is a skipped leaf generic | 2026-07-03 | `775f171e` |
| `AR-063` | `page/page-aria-snapshot-ai.spec.ts` | should keep the name when the contributing wrapper collapses into repeating text | 2026-10-13 | `cc916294` |
| `AR-064` | `page/page-aria-snapshot-ai.spec.ts` | should keep names not derived from printed nodes | 2026-07-03 | `27cacb34` |
| `AR-065` | `page/page-aria-snapshot-ai.spec.ts` | should omit images without an accessible name | 2026-07-29 | `2dd910fe` |
| `AR-066` | `page/page-aria-snapshot-ai.spec.ts` | should omit a nameless image nested inside a link | 2026-07-03 | `dd596841` |
| `AR-067` | `page/page-aria-snapshot-ai.spec.ts` | should keep icon-only clickable elements | 2026-07-29 | `282cc0f5` |
| `AR-068` | `page/page-aria-snapshot-ai.spec.ts` | should omit leaf generic whose text is already in an ancestor name | 2026-07-03 | `65395b95` |
| `AR-069` | `page/page-aria-snapshot-ai.spec.ts` | should omit name-repeating generic behind a wrapper | 2026-07-03 | `0ca1835a` |
| `AR-070` | `page/page-aria-snapshot-ai.spec.ts` | should resolve refs of distilled-away nodes | 2026-10-01 | `76c00e55` |
| `AR-071` | `page/page-aria-snapshot-ai.spec.ts` | should not distill snapshots outside of ai mode | 2026-07-03 | `1247a5c3` |
| `AR-072` | `page/page-aria-snapshot-ai.spec.ts` | should truncate data url in link | 2026-06-25 | `46271262` |
| `AR-073` | `page/page-aria-snapshot-ai.spec.ts` | should gracefully fallback when child frame cant be captured | 2025-07-01 | `3b70b22c` |
| `AR-074` | `page/page-aria-snapshot-ai.spec.ts` | should auto-wait for navigation | 2026-07-03 | `d870cd66` |
| `AR-075` | `page/page-aria-snapshot-ai.spec.ts` | should auto-wait for blocking CSS | 2025-06-05 | `b9edfef3` |
| `AR-076` | `page/page-aria-snapshot-ai.spec.ts` | should show visible children of hidden elements | 2025-08-29 | `8068ff46` |
| `AR-077` | `page/page-aria-snapshot-ai.spec.ts` | should include active element information | 2025-07-01 | `1aa5e639` |
| `AR-078` | `page/page-aria-snapshot-ai.spec.ts` | should update active element on focus | 2025-07-01 | `87badacc` |
| `AR-079` | `page/page-aria-snapshot-ai.spec.ts` | should mark iframe as active when it contains focused element | 2025-07-01 | `8d52fc42` |
| `AR-080` | `page/page-aria-snapshot-ai.spec.ts` | return empty snapshot when iframe is not loaded | 2026-01-07 | `2c413300` |
| `AR-081` | `page/page-aria-snapshot-ai.spec.ts` | should support many properties on iframes | 2025-08-06 | `eebbc682` |
| `AR-082` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot frameset pages | 2026-10-01 | `ce7f619e` |
| `AR-083` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot a locator inside a frameset frame | 2026-10-01 | `8d5b104f` |
| `AR-084` | `page/page-aria-snapshot-ai.spec.ts` | should stitch iframes inside a frameset frame | 2026-10-01 | `47d2af35` |
| `AR-085` | `page/page-aria-snapshot-ai.spec.ts` | should stitch nested frameset documents | 2026-10-01 | `bbd7379a` |
| `AR-086` | `page/page-aria-snapshot-ai.spec.ts` | should collapse inline generic nodes | 2025-08-28 | `f749589a` |
| `AR-087` | `page/page-aria-snapshot-ai.spec.ts` | should inline single leaf generic child into parent generic | 2026-07-03 | `f82639cc` |
| `AR-088` | `page/page-aria-snapshot-ai.spec.ts` | should inline a deeply nested generic | 2026-07-03 | `85751b38` |
| `AR-089` | `page/page-aria-snapshot-ai.spec.ts` | should not remove generic nodes with title | 2025-09-22 | `993b9621` |
| `AR-090` | `page/page-aria-snapshot-ai.spec.ts` | should limit depth | 2026-03-20 | `fdf1b54e` |
| `AR-091` | `page/page-aria-snapshot-ai.spec.ts` | should annotate aria-hidden elements | 2026-08-20 | `cfe8e7a6` |
| `AR-092` | `page/page-aria-snapshot-ai.spec.ts` | should only annotate the top element in a hidden subtree | 2026-08-20 | `8a71283c` |
| `AR-093` | `page/page-aria-snapshot-ai.spec.ts` | should not include hidden iframes | 2026-09-24 | `50840215` |
| `AR-094` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for inert elements | 2026-10-08 | `a7c504f7` |
| `AR-095` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for elements outside of a modal dialog | 2026-10-08 | `27d11c6f` |
| `AR-096` | `page/page-aria-snapshot-json.spec.ts` | should snapshot roles, names and text | 2026-08-03 | `f31180b8` |
| `AR-097` | `page/page-aria-snapshot-json.spec.ts` | should snapshot flags as properties | 2026-08-03 | `0cdf746f` |
| `AR-098` | `page/page-aria-snapshot-json.spec.ts` | should snapshot link url and textbox value | 2026-08-03 | `d1b8af99` |
| `AR-099` | `page/page-aria-snapshot-json.spec.ts` | should snapshot text fragments in children | 2026-08-03 | `a10cc06a` |
| `AR-100` | `page/page-aria-snapshot-json.spec.ts` | should snapshot top-level text fragments as text nodes | 2026-08-07 | `bfff64b7` |
| `AR-101` | `page/page-aria-snapshot-json.spec.ts` | should generate refs in ai mode | 2026-10-01 | `2d3b091c` |
| `AR-102` | `page/page-aria-snapshot-json.spec.ts` | should mark clickable elements with cursor in ai mode | 2026-08-03 | `6a63e046` |
| `AR-103` | `page/page-aria-snapshot-json.spec.ts` | should snapshot iframes in ai mode | 2026-08-03 | `f135730d` |
| `AR-104` | `page/page-aria-snapshot-json.spec.ts` | should limit depth | 2026-08-03 | `fec4e6cb` |
| `AR-105` | `page/page-aria-snapshot-json.spec.ts` | should include boxes when requested | 2026-08-03 | `48f3cdf6` |
| `AR-106` | `page/page-aria-snapshot-json.spec.ts` | should snapshot a locator | 2026-08-03 | `05e60d66` |
| `AR-107` | `page/to-match-aria-snapshot.spec.ts` | should match page | 2026-04-01 | `adbb70a4` |
| `AR-108` | `page/to-match-aria-snapshot.spec.ts` | should match page complex | 2026-04-01 | `709f79c8` |
| `AR-109` | `page/to-match-aria-snapshot.spec.ts` | should match page with not | 2026-04-01 | `7c5fbd9c` |
| `AR-110` | `page/to-match-aria-snapshot.spec.ts` | should fail page with timeout | 2026-04-01 | `3ff42282` |
| `AR-111` | `page/to-match-aria-snapshot.spec.ts` | should match | 2026-04-01 | `f70e9adb` |
| `AR-112` | `page/to-match-aria-snapshot.spec.ts` | should match in list | 2026-04-01 | `c8f22ef3` |
| `AR-113` | `page/to-match-aria-snapshot.spec.ts` | should match list with accessible name | 2026-04-01 | `d89d60d2` |
| `AR-114` | `page/to-match-aria-snapshot.spec.ts` | should match deep item | 2026-04-01 | `10c456b2` |
| `AR-115` | `page/to-match-aria-snapshot.spec.ts` | should match complex | 2026-04-01 | `378581fd` |
| `AR-116` | `page/to-match-aria-snapshot.spec.ts` | should match regex | 2026-04-01 | `b234597b` |
| `AR-117` | `page/to-match-aria-snapshot.spec.ts` | should allow text nodes | 2026-04-01 | `5cc85a06` |
| `AR-118` | `page/to-match-aria-snapshot.spec.ts` | details visibility | 2026-04-01 | `0650ff2f` |
| `AR-119` | `page/to-match-aria-snapshot.spec.ts` | checked attribute | 2026-04-01 | `96d8322d` |
| `AR-120` | `page/to-match-aria-snapshot.spec.ts` | disabled attribute | 2026-04-01 | `e4d7b19e` |
| `AR-121` | `page/to-match-aria-snapshot.spec.ts` | expanded attribute | 2026-04-01 | `03b29204` |
| `AR-122` | `page/to-match-aria-snapshot.spec.ts` | level attribute | 2026-04-01 | `4359f53a` |
| `AR-123` | `page/to-match-aria-snapshot.spec.ts` | pressed attribute | 2026-04-01 | `ee592ae1` |
| `AR-124` | `page/to-match-aria-snapshot.spec.ts` | selected attribute | 2026-04-01 | `d0f34cee` |
| `AR-125` | `page/to-match-aria-snapshot.spec.ts` | integration test | 2026-04-01 | `9ffe5de2` |
| `AR-126` | `page/to-match-aria-snapshot.spec.ts` | integration test 2 | 2026-04-01 | `4becdc4b` |
| `AR-127` | `page/to-match-aria-snapshot.spec.ts` | expected formatter | 2026-04-01 | `aa35e74d` |
| `AR-128` | `page/to-match-aria-snapshot.spec.ts` | should unpack escaped names | 2026-04-01 | `b40c9de2` |
| `AR-129` | `page/to-match-aria-snapshot.spec.ts` | should report error in YAML | 2026-06-05 | `acdd8f36` |
| `AR-130` | `page/to-match-aria-snapshot.spec.ts` | should report error in YAML keys | 2026-06-05 | `30358a14` |
| `AR-131` | `page/to-match-aria-snapshot.spec.ts` | call log should contain actual snapshot | 2026-04-01 | `e08a799a` |
| `AR-132` | `page/to-match-aria-snapshot.spec.ts` | should parse attributes | 2026-04-01 | `1154b207` |
| `AR-133` | `page/to-match-aria-snapshot.spec.ts` | should not unshift actual template text | 2026-04-01 | `77e81711` |
| `AR-134` | `page/to-match-aria-snapshot.spec.ts` | should not match what is not matched | 2026-04-01 | `e4ceb015` |
| `AR-135` | `page/to-match-aria-snapshot.spec.ts` | should match url | 2026-04-01 | `381db999` |
| `AR-136` | `page/to-match-aria-snapshot.spec.ts` | should detect unexpected children: equal | 2026-04-01 | `13fbd31e` |
| `AR-137` | `page/to-match-aria-snapshot.spec.ts` | should detect unexpected children: deep-equal | 2026-04-01 | `b04e80ca` |
| `AR-138` | `page/to-match-aria-snapshot.spec.ts` | should allow restoring contain mode inside deep-equal | 2026-04-01 | `3775e5e5` |
| `AR-139` | `page/to-match-aria-snapshot.spec.ts` | top-level deep-equal | 2026-04-01 | `7b2ef4d6` |
| `AR-140` | `page/to-match-aria-snapshot.spec.ts` | generated snapshot includes text children when name is longer than text | 2026-04-07 | `1dd53402` |
| `AR-141` | `page/to-match-aria-snapshot.spec.ts` | treat bad regex as a string | 2026-04-01 | `f2f9d5d9` |
| `AR-142` | `page/to-match-aria-snapshot.spec.ts` | invalid attribute | 2026-05-28 | `b534f6e9` |
| `AR-143` | `library/role-utils.spec.ts` | wpt accname {#0, #1, #2, #3} *(4 copies)* | 2026-07-31 | `cb47e784` |
| `AR-144` | `library/role-utils.spec.ts` | wpt accname non-manual | 2026-07-03 | `81de1f23` |
| `AR-145` | `library/role-utils.spec.ts` | axe-core implicit-role | 2024-08-27 | `84865189` |
| `AR-146` | `library/role-utils.spec.ts` | axe-core accessible-text | 2026-07-03 | `29fb7955` |
| `AR-147` | `library/role-utils.spec.ts` | accessible name with slots | 2026-10-07 | `711c9ce6` |
| `AR-148` | `library/role-utils.spec.ts` | accessible name with closed details | 2026-10-07 | `25cca3b5` |
| `AR-149` | `library/role-utils.spec.ts` | accessible name nested treeitem | 2023-03-28 | `b7a2b906` |
| `AR-150` | `library/role-utils.spec.ts` | svg title | 2023-03-28 | `921a1ea6` |
| `AR-151` | `library/role-utils.spec.ts` | native controls | 2026-06-26 | `35a6bd06` |
| `AR-152` | `library/role-utils.spec.ts` | input type=search maps to searchbox unless list points at a datalist | 2026-07-22 | `683ae0f1` |
| `AR-153` | `library/role-utils.spec.ts` | meter and progress get their name from an associated label | 2026-07-22 | `27d4b4d3` |
| `AR-154` | `library/role-utils.spec.ts` | native controls labelled-by | 2026-10-13 | `aeb53ae1` |
| `AR-155` | `library/role-utils.spec.ts` | display:contents should be visible when contents are visible | 2023-06-08 | `1f786a13` |
| `AR-156` | `library/role-utils.spec.ts` | should remove soft hyphens and zero-width spaces | 2025-02-25 | `dc4928c9` |
| `AR-157` | `library/role-utils.spec.ts` | label/labelled-by aria-hidden with descendants | 2024-04-17 | `a113c1c1` |
| `AR-158` | `library/role-utils.spec.ts` | own aria-label concatenated with aria-labelledby | 2024-04-17 | `be17b3f9` |
| `AR-159` | `library/role-utils.spec.ts` | control embedded in a label | 2024-04-17 | `46137535` |
| `AR-160` | `library/role-utils.spec.ts` | control embedded in a target element | 2024-04-17 | `07c55a31` |
| `AR-161` | `library/role-utils.spec.ts` | searchbox embedded control should contribute its value | 2026-08-27 | `01cd8427` |
| `AR-162` | `library/role-utils.spec.ts` | svg role=presentation | 2025-07-23 | `6404e92c` |
| `AR-163` | `library/role-utils.spec.ts` | should work with form and tricky input names | 2024-05-02 | `8b06502e` |
| `AR-164` | `library/role-utils.spec.ts` | should ignore stylesheet from hidden aria-labelledby subtree | 2024-08-20 | `5fb51bab` |
| `AR-165` | `library/role-utils.spec.ts` | should not include hidden pseudo into accessible name | 2024-08-21 | `07ae4e7e` |
| `AR-166` | `library/role-utils.spec.ts` | should resolve pseudo content from attr | 2025-01-28 | `19d9560d` |
| `AR-167` | `library/role-utils.spec.ts` | should resolve pseudo content alternative text | 2025-05-08 | `0f106acd` |
| `AR-168` | `library/role-utils.spec.ts` | should resolve css content property for an element | 2025-05-08 | `69b09951` |
| `AR-169` | `library/role-utils.spec.ts` | should ignore invalid aria-labelledby | 2024-11-19 | `a81cae78` |
| `AR-170` | `library/role-utils.spec.ts` | should support search element | 2025-07-01 | `0d957a73` |

### AT — Add script and style tags

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `AT-001` | `page/page-add-script-tag.spec.ts` | should throw an error if no options are provided | 2020-08-11 | `654fe256` |
| `AT-002` | `page/page-add-script-tag.spec.ts` | should work with a url | 2020-08-11 | `9aef0d88` |
| `AT-003` | `page/page-add-script-tag.spec.ts` | should work with a url and type=module | 2020-08-11 | `276b07ab` |
| `AT-004` | `page/page-add-script-tag.spec.ts` | should work with a path and type=module | 2021-04-05 | `95605017` |
| `AT-005` | `page/page-add-script-tag.spec.ts` | should work with a content and type=module | 2020-08-11 | `815b3b72` |
| `AT-006` | `page/page-add-script-tag.spec.ts` | should throw an error if loading from url fail | 2020-08-04 | `ad6372d6` |
| `AT-007` | `page/page-add-script-tag.spec.ts` | should work with a path | 2021-04-05 | `61430eae` |
| `AT-008` | `page/page-add-script-tag.spec.ts` | should include sourceURL when path is provided | 2021-05-13 | `74991793` |
| `AT-009` | `page/page-add-script-tag.spec.ts` | should work with content | 2020-08-11 | `0985855e` |
| `AT-010` | `page/page-add-script-tag.spec.ts` | should throw when added with content to the CSP page | 2020-08-28 | `fc525784` |
| `AT-011` | `page/page-add-script-tag.spec.ts` | should throw when added with URL to the CSP page | 2021-04-09 | `61cd9fa5` |
| `AT-012` | `page/page-add-script-tag.spec.ts` | should throw a nice error when the request fails | 2020-08-04 | `81936e3d` |
| `AT-013` | `page/page-add-style-tag.spec.ts` | should throw an error if no options are provided | 2020-08-11 | `a4359074` |
| `AT-014` | `page/page-add-style-tag.spec.ts` | should work with a url @smoke | 2022-03-10 | `d6007ef4` |
| `AT-015` | `page/page-add-style-tag.spec.ts` | should throw an error if loading from url fail | 2020-08-04 | `c1dc6ed5` |
| `AT-016` | `page/page-add-style-tag.spec.ts` | should work with a path | 2021-04-05 | `12e10f8a` |
| `AT-017` | `page/page-add-style-tag.spec.ts` | should include sourceURL when path is provided | 2021-04-05 | `44c9b76a` |
| `AT-018` | `page/page-add-style-tag.spec.ts` | should work with content | 2020-08-04 | `3ac75cc8` |
| `AT-019` | `page/page-add-style-tag.spec.ts` | should throw when added with content to the CSP page | 2020-08-04 | `73d8237c` |
| `AT-020` | `page/page-add-style-tag.spec.ts` | should throw when added with URL to the CSP page | 2021-04-09 | `57bc82fa` |

### AU — Authentication

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `AU-001` | `library/browsercontext-credentials.spec.ts` | should fail without credentials | 2024-11-13 | `52f9b775` |
| `AU-002` | `library/browsercontext-credentials.spec.ts` | should work with setHTTPCredentials | 2024-11-13 | `7bd41733` |
| `AU-003` | `library/browsercontext-credentials.spec.ts` | should work with setHTTPCredentials and multiple credentials | 2026-07-24 | `39c3521f` |
| `AU-004` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials @smoke | 2023-10-23 | `aea4229d` |
| `AU-005` | `library/browsercontext-credentials.spec.ts` | should fail with wrong credentials | 2023-10-23 | `ca295e6e` |
| `AU-006` | `library/browsercontext-credentials.spec.ts` | should return resource body | 2023-10-23 | `395317c3` |
| `AU-007` | `library/browsercontext-credentials.spec.ts` | should work with a single credential in an array | 2026-07-24 | `2021248d` |
| `AU-008` | `library/browsercontext-credentials.spec.ts` | should work with multiple credentials for different origins | 2026-07-24 | `81824515` |
| `AU-009` | `library/browsercontext-credentials.spec.ts` | should fall back to credentials without origin | 2026-07-24 | `adc2977a` |
| `AU-010` | `library/browsercontext-credentials.spec.ts` | should use the first matching credential | 2026-07-24 | `e015be81` |
| `AU-011` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials and matching origin | 2023-10-23 | `e8457a83` |
| `AU-012` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials and matching origin case insensitive | 2023-10-23 | `f702c63a` |
| `AU-013` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching scheme | 2024-11-13 | `c1dc8eeb` |
| `AU-014` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching hostname | 2024-11-13 | `bf2ad34e` |
| `AU-015` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching port | 2024-11-13 | `c45b8bb7` |
| `AU-016` | `library/browsercontext-credentials.spec.ts` | should not override Authorization header set by the page | 2026-08-19 | `9b63a7b5` |
| `AU-017` | `library/browsercontext-webauthn.spec.ts` | should not intercept navigator.credentials without install() | 2026-06-12 | `7da85de1` |
| `AU-018` | `library/browsercontext-webauthn.spec.ts` | should seed a known credential and authenticate | 2026-06-12 | `7c6a6a99` |
| `AU-019` | `library/browsercontext-webauthn.spec.ts` | should capture a page-created credential and reuse it in another context | 2026-06-12 | `488ebfa1` |
| `AU-020` | `library/browsercontext-webauthn.spec.ts` | should reuse a page-created credential via the storageState option | 2026-06-19 | `2a89d5f8` |
| `AU-021` | `library/browsercontext-webauthn.spec.ts` | should seed and report signCount | 2026-10-01 | `e5017136` |
| `AU-022` | `library/browsercontext-webauthn.spec.ts` | should reject invalid signCount | 2026-10-01 | `91df036c` |
| `AU-023` | `library/browsercontext-webauthn.spec.ts` | should preserve signCount via the storageState option | 2026-10-01 | `6463d1b1` |
| `AU-024` | `library/browsercontext-webauthn.spec.ts` | should serialize credentials with toJSON | 2026-10-05 | `4218bdcf` |

### AW — Auto-waiting

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `AW-001` | `page/page-autowaiting-basic.spec.ts` | should await navigation when clicking anchor | 2021-03-17 | `81eafbfb` |
| `AW-002` | `page/page-autowaiting-basic.spec.ts` | should not stall on JS navigation link | 2022-01-07 | `a5e787a7` |
| `AW-003` | `page/page-autowaiting-basic.spec.ts` | should await cross-process navigation when clicking anchor | 2021-03-17 | `736cf83a` |
| `AW-004` | `page/page-autowaiting-basic.spec.ts` | should await form-get on click | 2020-08-03 | `982a3fe8` |
| `AW-005` | `page/page-autowaiting-basic.spec.ts` | should await form-post on click | 2021-03-17 | `919032dc` |
| `AW-006` | `page/page-autowaiting-basic.spec.ts` | should work with noWaitAfter: true | 2021-03-17 | `c818e046` |
| `AW-007` | `page/page-autowaiting-basic.spec.ts` | should work with dblclick without noWaitAfter when navigation is stalled | 2024-07-18 | `33ccfefd` |
| `AW-008` | `page/page-autowaiting-basic.spec.ts` | should work with waitForLoadState(load) | 2022-06-16 | `fa94f9b5` |
| `AW-009` | `page/page-autowaiting-basic.spec.ts` | should work with goto following click | 2020-08-03 | `62236490` |
| `AW-010` | `page/page-autowaiting-basic.spec.ts` | should report navigation in the log when clicking anchor | 2021-04-05 | `3d6c9153` |
| `AW-011` | `page/page-autowaiting-basic.spec.ts` | should report and collapse log in action | 2024-11-01 | `1255ce48` |
| `AW-012` | `page/page-autowaiting-basic.spec.ts` | should report and collapse log in expect | 2024-11-01 | `6d49121b` |
| `AW-013` | `page/page-autowaiting-no-hang.spec.ts` | clicking on links which do not commit navigation | 2020-08-03 | `dd7b5320` |
| `AW-014` | `page/page-autowaiting-no-hang.spec.ts` | calling window.stop async | 2022-07-28 | `5f1d26e6` |
| `AW-015` | `page/page-autowaiting-no-hang.spec.ts` | calling window.stop sync | 2025-03-11 | `67089b7a` |
| `AW-016` | `page/page-autowaiting-no-hang.spec.ts` | assigning location to about:blank | 2020-08-03 | `f807befe` |
| `AW-017` | `page/page-autowaiting-no-hang.spec.ts` | assigning location to about:blank after non-about:blank | 2020-08-03 | `42f9ef9d` |
| `AW-018` | `page/page-autowaiting-no-hang.spec.ts` | calling window.open and window.close | 2020-08-03 | `f53d1acc` |
| `AW-019` | `page/page-autowaiting-no-hang.spec.ts` | opening a popup | 2020-08-06 | `00a12977` |
| `AW-020` | `page/page-autowaiting-no-hang.spec.ts` | clicking in the middle of navigation that aborts | 2024-10-04 | `015e4b9a` |
| `AW-021` | `page/page-autowaiting-no-hang.spec.ts` | clicking in the middle of navigation that commits | 2024-10-04 | `f0550aee` |
| `AW-022` | `page/page-autowaiting-no-hang.spec.ts` | clicking a link intercepted by the Navigation API same-document | 2026-06-11 | `cee47244` |
| `AW-023` | `page/page-autowaiting-no-hang.spec.ts` | goBack in the middle of navigation that commits | 2024-10-04 | `2ff17e0d` |

### BC — BrowserContext

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `BC-001` | `library/browsercontext-basic.spec.ts` | should create new context @smoke | 2025-05-22 | `1a74766e` |
| `BC-002` | `library/browsercontext-basic.spec.ts` | should be able to click across browser contexts | 2024-02-29 | `7ed2a70f` |
| `BC-003` | `library/browsercontext-basic.spec.ts` | should be able to hover across browser contexts in parallel | 2026-06-11 | `1fca42d7` |
| `BC-004` | `library/browsercontext-basic.spec.ts` | window.open should use parent tab context | 2020-08-03 | `73462b64` |
| `BC-005` | `library/browsercontext-basic.spec.ts` | should isolate localStorage and cookies @smoke | 2022-03-10 | `dff63d9f` |
| `BC-006` | `library/browsercontext-basic.spec.ts` | should propagate default viewport to the page | 2020-09-18 | `5d8df45b` |
| `BC-007` | `library/browsercontext-basic.spec.ts` | should make a copy of default viewport | 2020-09-18 | `a0db80f8` |
| `BC-008` | `library/browsercontext-basic.spec.ts` | should respect deviceScaleFactor | 2020-08-03 | `4e9a0d11` |
| `BC-009` | `library/browsercontext-basic.spec.ts` | should not allow deviceScaleFactor with null viewport | 2020-08-03 | `cd9f1bb7` |
| `BC-010` | `library/browsercontext-basic.spec.ts` | should not allow isMobile with null viewport | 2020-08-03 | `5f929c2c` |
| `BC-011` | `library/browsercontext-basic.spec.ts` | close() should work for empty context | 2020-08-03 | `f5d8bb1f` |
| `BC-012` | `library/browsercontext-basic.spec.ts` | close() should abort waitForEvent | 2023-10-12 | `3bdd542a` |
| `BC-013` | `library/browsercontext-basic.spec.ts` | close() should be callable twice | 2021-10-28 | `4b5eaa0e` |
| `BC-014` | `library/browsercontext-basic.spec.ts` | should pass self to close event | 2021-01-22 | `1246f5a6` |
| `BC-015` | `library/browsercontext-basic.spec.ts` | should not report frameless pages on error | 2023-10-23 | `d29dd643` |
| `BC-016` | `library/browsercontext-basic.spec.ts` | should return all of the pages | 2020-08-03 | `4d611dcf` |
| `BC-017` | `library/browsercontext-basic.spec.ts` | should close all belonging pages once closing context | 2020-08-03 | `3e8a6f95` |
| `BC-018` | `library/browsercontext-basic.spec.ts` | should disable javascript | 2023-10-23 | `a3b59564` |
| `BC-019` | `library/browsercontext-basic.spec.ts` | should be able to navigate after disabling javascript | 2020-08-03 | `3552ac2b` |
| `BC-020` | `library/browsercontext-basic.spec.ts` | should not hang on promises after disabling javascript | 2025-12-15 | `d1b28301` |
| `BC-021` | `library/browsercontext-basic.spec.ts` | setContent should work after disabling javascript | 2023-03-14 | `0de1e81d` |
| `BC-022` | `library/browsercontext-basic.spec.ts` | should retry click after disabling javascript | 2026-09-30 | `b201b5ed` |
| `BC-023` | `library/browsercontext-basic.spec.ts` | should work with offline option | 2023-12-08 | `c251d17c` |
| `BC-024` | `library/browsercontext-basic.spec.ts` | fetch with keepalive should throw when offline | 2025-05-12 | `e1d46ed4` |
| `BC-025` | `library/browsercontext-basic.spec.ts` | should emulate navigator.onLine | 2020-08-03 | `235cf9da` |
| `BC-026` | `library/browsercontext-basic.spec.ts` | should emulate navigator.onLine across navigations | 2026-09-25 | `43794c4e` |
| `BC-027` | `library/browsercontext-basic.spec.ts` | should emulate offline event | 2026-07-16 | `f2e484d1` |
| `BC-028` | `library/browsercontext-basic.spec.ts` | should emulate media in popup | 2021-05-06 | `e8043ec1` |
| `BC-029` | `library/browsercontext-basic.spec.ts` | should emulate media in cross-process iframe | 2021-05-06 | `45cd9a09` |
| `BC-030` | `library/browsercontext-basic.spec.ts` | default user agent | 2023-04-12 | `205c393d` |
| `BC-031` | `library/browsercontext-basic.spec.ts` | should create two pages in parallel in various contexts | 2025-04-03 | `1b52caa0` |
| `BC-032` | `library/browsercontext-events.spec.ts` | console event should work @smoke | 2023-05-04 | `73fa0018` |
| `BC-033` | `library/browsercontext-events.spec.ts` | console event should work with element handles | 2025-08-11 | `5f3e0710` |
| `BC-034` | `library/browsercontext-events.spec.ts` | console event should work in popup | 2023-05-04 | `acd6793c` |
| `BC-035` | `library/browsercontext-events.spec.ts` | console event should work in popup 2 | 2025-12-15 | `b69bff37` |
| `BC-036` | `library/browsercontext-events.spec.ts` | console event should work in immediately closed popup | 2025-12-15 | `5ace1da9` |
| `BC-037` | `library/browsercontext-events.spec.ts` | dialog event should work @smoke | 2023-05-04 | `54096b08` |
| `BC-038` | `library/browsercontext-events.spec.ts` | dialogclosed event should work | 2026-07-28 | `9189d7e7` |
| `BC-039` | `library/browsercontext-events.spec.ts` | dialog event should work in popup | 2023-05-04 | `52af245c` |
| `BC-040` | `library/browsercontext-events.spec.ts` | dialog event should work in popup 2 | 2023-05-04 | `cbd0aa92` |
| `BC-041` | `library/browsercontext-events.spec.ts` | dialog event should work in immediately closed popup | 2023-10-23 | `5fa9decf` |
| `BC-042` | `library/browsercontext-events.spec.ts` | dialog event should work with inline script tag | 2023-05-04 | `04c74b05` |
| `BC-043` | `library/browsercontext-events.spec.ts` | weberror event should work | 2023-09-06 | `9419d2fd` |
| `BC-044` | `library/browsercontext-events.spec.ts` | weberror event should include location | 2026-04-27 | `f103eee8` |
| `BC-045` | `library/browsercontext-events.spec.ts` | pageload event should work @smoke | 2026-04-21 | `9877447c` |
| `BC-046` | `library/browsercontext-events.spec.ts` | framenavigated event should work @smoke | 2026-04-21 | `3bd08fad` |
| `BC-047` | `library/browsercontext-events.spec.ts` | pageclose event should work @smoke | 2026-04-21 | `4adf4874` |
| `BC-048` | `library/browsercontext-events.spec.ts` | frameattached event should work @smoke | 2026-04-21 | `4632a785` |
| `BC-049` | `library/browsercontext-events.spec.ts` | framedetached event should work @smoke | 2026-04-21 | `04ffe390` |
| `BC-050` | `library/browsercontext-events.spec.ts` | download event should work @smoke | 2026-04-21 | `d7d74afe` |
| `BC-051` | `library/browsercontext-pages.spec.ts` | should not be visible in context.pages | 2021-04-05 | `75d9f472` |
| `BC-052` | `library/browsercontext-pages.spec.ts` | page.context should return the correct instance | 2021-04-05 | `ffb1645b` |
| `BC-053` | `library/browsercontext-pages.spec.ts` | frame.focus should work multiple times | 2023-10-23 | `2cca1d23` |
| `BC-054` | `library/browsercontext-pages.spec.ts` | should click with disabled javascript | 2021-03-18 | `a101bc31` |
| `BC-055` | `library/browsercontext-pages.spec.ts` | should not hang with touch-enabled viewports | 2021-03-18 | `58f9e71f` |
| `BC-056` | `library/browsercontext-pages.spec.ts` | should click the button with deviceScaleFactor set | 2023-10-23 | `099a94ba` |
| `BC-057` | `library/browsercontext-pages.spec.ts` | should click the button with offset with page scale | 2025-12-15 | `6d6885a7` |
| `BC-058` | `library/browsercontext-pages.spec.ts` | should return bounding box with page scale | 2025-12-15 | `1dd72eb8` |
| `BC-059` | `library/browsercontext-pages.spec.ts` | should not leak listeners during navigation of 20 pages | 2023-10-23 | `4cbcf622` |
| `BC-060` | `library/browsercontext-pages.spec.ts` | should close page while a reload is committing | 2026-08-14 | `5dc6daa2` |
| `BC-061` | `library/browsercontext-pages.spec.ts` | should keep selection in multiple pages | 2023-10-16 | `1bba48c2` |
| `BC-062` | `library/browsercontext-page-event.spec.ts` | should have url | 2020-08-03 | `5dd1d2f7` |
| `BC-063` | `library/browsercontext-page-event.spec.ts` | should have url after domcontentloaded | 2020-08-03 | `ee5979cd` |
| `BC-064` | `library/browsercontext-page-event.spec.ts` | should have about:blank url with domcontentloaded | 2020-08-03 | `b08da512` |
| `BC-065` | `library/browsercontext-page-event.spec.ts` | should have about:blank for empty url with domcontentloaded | 2020-08-03 | `45be532f` |
| `BC-066` | `library/browsercontext-page-event.spec.ts` | should report when a new page is created and closed | 2020-08-03 | `25e77ec1` |
| `BC-067` | `library/browsercontext-page-event.spec.ts` | should report initialized pages | 2023-06-02 | `981cb8d5` |
| `BC-068` | `library/browsercontext-page-event.spec.ts` | should not crash while redirecting of original request was missed | 2020-08-03 | `01d8f9a6` |
| `BC-069` | `library/browsercontext-page-event.spec.ts` | should have an opener | 2020-08-03 | `f1d1291b` |
| `BC-070` | `library/browsercontext-page-event.spec.ts` | should fire page lifecycle events | 2020-08-03 | `ac245ef1` |
| `BC-071` | `library/browsercontext-page-event.spec.ts` | should work with Shift-clicking | 2021-04-03 | `be9754c3` |
| `BC-072` | `library/browsercontext-page-event.spec.ts` | should work with Ctrl-clicking | 2026-07-17 | `1be22320` |
| `BC-073` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should re-add binding after reset *(2 copies)* | 2023-01-07 | `a5721f1b` |
| `BC-074` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset serviceworker *(2 copies)* | 2026-03-26 | `50ff721f` |
| `BC-075` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset serviceworker that hangs in importScripts *(2 copies)* | 2023-01-07 | `5381b12d` |
| `BC-076` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should not cache resources *(2 copies)* | 2023-03-03 | `5f8df87b` |
| `BC-077` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should ignore binding from beforeunload *(2 copies)* | 2023-05-05 | `eaf98d63` |
| `BC-078` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset mouse position *(2 copies)* | 2025-11-24 | `17b2a392` |
| `BC-079` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset tracing *(2 copies)* | 2024-09-17 | `409b7bf9` |
| `BC-080` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should work with clock emulation *(2 copies)* | 2024-06-18 | `fa5c30b4` |
| `BC-081` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should continue issuing events after closing the reused page *(2 copies)* | 2023-08-07 | `f6095a75` |
| `BC-082` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should work with routeWebSocket *(2 copies)* | 2026-03-25 | `a8d00fa0` |
| `BC-083` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should update viewport and media *(2 copies)* | 2025-07-01 | `a171c3e9` |

### BP — Browsers path

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `BP-001` | `library/browsers-path.spec.ts` | should import on an unsupported platform when PLAYWRIGHT\_BROWSERS\_PATH=0 | 2026-07-23 | `319fff81` |
| `BP-002` | `library/browsers-path.spec.ts` | should import on an unsupported platform with an explicit PLAYWRIGHT\_BROWSERS\_PATH | 2026-07-23 | `234fd39e` |

### BR — Browser

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `BR-001` | `library/browser.spec.ts` | should return browserType | 2022-06-06 | `8cec4165` |
| `BR-002` | `library/browser.spec.ts` | should create new page @smoke | 2022-03-10 | `9be67c15` |
| `BR-003` | `library/browser.spec.ts` | should throw upon second create new page | 2023-10-23 | `4401fb4c` |
| `BR-004` | `library/browser.spec.ts` | version should work | 2021-05-13 | `b8b6bcc8` |
| `BR-005` | `library/browser.spec.ts` | should dispatch page.on(close) upon browser.close and reject evaluate | 2023-10-12 | `eea06574` |
| `BR-006` | `library/browser.spec.ts` | should fire context event on newContext | 2026-04-23 | `0e8b7290` |
| `BR-007` | `library/browser.spec.ts` | newContext should not leave a context upon failure | 2025-06-20 | `9af81239` |
| `BR-008` | `library/browser-server.spec.ts` | should start and stop pipe server | 2026-05-18 | `13f2a903` |
| `BR-009` | `library/browser-server.spec.ts` | should write descriptor on start and remove on stop | 2026-03-31 | `652f63cf` |
| `BR-010` | `library/browser-server.spec.ts` | should start ws server with host/port and produce well-formed endpoint | 2026-05-06 | `1e422557` |

### BT — BrowserType

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `BT-001` | `library/browsertype-basic.spec.ts` | browserType.executablePath should work | 2025-02-07 | `b2a175f9` |
| `BT-002` | `library/browsertype-basic.spec.ts` | browserType.name should work | 2021-04-01 | `e1c9d26c` |
| `BT-003` | `library/browsertype-basic.spec.ts` | should throw when trying to connect with not-chromium | 2026-05-27 | `9c0ed6a1` |
| `BT-004` | `library/browsertype-launch.spec.ts` | should reject all promises when browser is closed | 2025-03-25 | `be56ef28` |
| `BT-005` | `library/browsertype-launch.spec.ts` | should throw if userDataDir option is passed | 2023-10-24 | `03c77c58` |
| `BT-006` | `library/browsertype-launch.spec.ts` | should throw if userDataDir is passed as an argument | 2023-10-24 | `3a3f9bd9` |
| `BT-007` | `library/browsertype-launch.spec.ts` | should throw if port option is passed | 2023-10-24 | `85d1fcf5` |
| `BT-008` | `library/browsertype-launch.spec.ts` | should throw if port option is passed for persistent context | 2023-10-24 | `8f4be2ee` |
| `BT-009` | `library/browsertype-launch.spec.ts` | should throw if page argument is passed | 2025-12-15 | `a7efa7ea` |
| `BT-010` | `library/browsertype-launch.spec.ts` | should reject if launched browser fails immediately | 2026-06-17 | `52a80df7` |
| `BT-011` | `library/browsertype-launch.spec.ts` | should reject if executable path is invalid | 2026-06-17 | `3f7ad1cd` |
| `BT-012` | `library/browsertype-launch.spec.ts` | should handle timeout | 2023-10-24 | `5d47fa1d` |
| `BT-013` | `library/browsertype-launch.spec.ts` | should handle exception and report launch log | 2026-05-06 | `f7c6a3d0` |
| `BT-014` | `library/browsertype-launch.spec.ts` | should accept objects as options | 2023-02-08 | `1edc8dbf` |
| `BT-015` | `library/browsertype-launch.spec.ts` | should fire close event for all contexts | 2021-10-28 | `21b35a25` |
| `BT-016` | `library/browsertype-launch.spec.ts` | should be callable twice | 2021-10-28 | `f1ef7650` |
| `BT-017` | `library/browsertype-launch.spec.ts` | should allow await using | 2024-10-25 | `87750719` |
| `BT-018` | `library/launcher.spec.ts` | should have an errors object | 2021-10-19 | `4222849e` |
| `BT-019` | `library/launcher.spec.ts` | should have a devices object | 2021-10-19 | `721335e7` |
| `BT-020` | `library/launcher.spec.ts` | should kill browser process on timeout after close | 2021-10-28 | `09822871` |
| `BT-021` | `library/launcher.spec.ts` | should throw a friendly error if its headed and there is no xserver on linux running | 2026-03-25 | `c5958e89` |
| `BT-022` | `library/browsertype-launch-server.spec.ts` | launch server › should work | 2021-10-28 | `409e99ec` |
| `BT-023` | `library/browsertype-launch-server.spec.ts` | launch server › should validate options | 2025-06-13 | `05f5ce7e` |
| `BT-024` | `library/browsertype-launch-server.spec.ts` | launch server › should work with host | 2024-05-27 | `327b1eab` |
| `BT-025` | `library/browsertype-launch-server.spec.ts` | launch server › should work with port | 2021-10-28 | `b6e652d6` |
| `BT-026` | `library/browsertype-launch-server.spec.ts` | launch server › should work with wsPath | 2021-10-28 | `af089f55` |
| `BT-027` | `library/browsertype-launch-server.spec.ts` | launch server › should work when wsPath is missing leading slash | 2021-10-28 | `0e25f52f` |
| `BT-028` | `library/browsertype-launch-server.spec.ts` | launch server › should default to random wsPath | 2021-10-28 | `49f7bd20` |
| `BT-029` | `library/browsertype-launch-server.spec.ts` | launch server › should provide an error when ws endpoint is incorrect | 2026-03-07 | `e1023102` |
| `BT-030` | `library/browsertype-launch-server.spec.ts` | launch server › should fire "close" event during kill | 2021-10-28 | `e5557a3c` |
| `BT-031` | `library/browsertype-launch-server.spec.ts` | launch server › should return child\_process instance | 2021-10-28 | `8f3dafd9` |
| `BT-032` | `library/browsertype-launch-server.spec.ts` | launch server › should fire close event | 2024-02-12 | `aba416db` |
| `BT-033` | `library/browsertype-launch-server.spec.ts` | launch server › should log protocol | 2021-10-28 | `ae615f96` |
| `BT-034` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should connect over wss *(2 copies)* | 2025-10-31 | `82eec255` |
| `BT-035` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print HTTP error *(2 copies)* | 2023-01-11 | `701984a2` |
| `BT-036` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print ws error *(2 copies)* | 2023-01-11 | `90a48b63` |
| `BT-037` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print custom ws close error *(2 copies)* | 2024-04-02 | `792e2f7e` |
| `BT-038` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to reconnect to a browser *(2 copies)* | 2022-12-07 | `3312fe90` |
| `BT-039` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should not crash on malformed json frame *(2 copies)* | 2026-05-10 | `978beaab` |
| `BT-040` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to visit ipv6 *(2 copies)* | 2025-09-09 | `940d974d` |
| `BT-041` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should ignore page.pause when headed *(2 copies)* | 2025-02-07 | `5454711d` |
| `BT-042` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to visit ipv6 through localhost *(2 copies)* | 2025-09-09 | `7be6f0b0` |
| `BT-043` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect two browsers at the same time *(2 copies)* | 2022-12-07 | `4c72583c` |
| `BT-044` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should timeout in socket while connecting *(2 copies)* | 2022-12-07 | `bf97da87` |
| `BT-045` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should timeout in connect while connecting *(2 copies)* | 2022-12-07 | `abb7e4e2` |
| `BT-046` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send extra headers with connect request *(2 copies)* | 2022-12-07 | `67416374` |
| `BT-047` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send extra headers with connect request in object form *(2 copies)* | 2026-06-26 | `c9e6c2da` |
| `BT-048` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send default User-Agent and X-Playwright-Browser headers with connect request *(2 copies)* | 2026-02-27 | `416eaff3` |
| `BT-049` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should support slowmo option *(2 copies)* | 2022-12-07 | `37480e5d` |
| `BT-050` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › disconnected event should be emitted when browser is closed or server is closed *(2 copies)* | 2022-12-07 | `6ae809d6` |
| `BT-051` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › disconnected event should have browser as argument *(2 copies)* | 2022-12-07 | `83fa8cf3` |
| `BT-052` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should handle exceptions during connect *(2 copies)* | 2025-10-31 | `2ccc4515` |
| `BT-053` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should set the browser connected state *(2 copies)* | 2022-12-07 | `c57c3990` |
| `BT-054` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should throw when used after isConnected returns false *(2 copies)* | 2024-04-02 | `02e43d71` |
| `BT-055` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should throw when calling waitForNavigation after disconnect *(2 copies)* | 2023-10-12 | `e87c354b` |
| `BT-056` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject navigation when browser closes *(2 copies)* | 2022-12-07 | `3aecfb78` |
| `BT-057` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForSelector when browser closes *(2 copies)* | 2022-12-07 | `2808a8c6` |
| `BT-058` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should emit close events on pages and contexts *(2 copies)* | 2022-12-07 | `f3ec3056` |
| `BT-059` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should terminate network waiters *(2 copies)* | 2023-10-12 | `b4c4f278` |
| `BT-060` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForEvent before browser.close finishes *(2 copies)* | 2024-07-25 | `91c48840` |
| `BT-061` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForEvent before browser.onDisconnect fires *(2 copies)* | 2024-07-25 | `5025c748` |
| `BT-062` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should respect selectors *(2 copies)* | 2022-12-07 | `9fb05c4a` |
| `BT-063` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should not throw on close after disconnect *(2 copies)* | 2022-12-07 | `0a73555a` |
| `BT-064` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should saveAs videos from remote browser *(2 copies)* | 2026-04-09 | `8677b835` |
| `BT-065` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save videos to artifactsDir *(2 copies)* | 2026-04-09 | `9a05a7af` |
| `BT-066` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should name video file after page guid when connecting to remote browser with artifactsDir *(2 copies)* | 2026-04-09 | `188cef0f` |
| `BT-067` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect 20 times to a single server without warnings *(2 copies)* | 2023-05-23 | `eb0f6d82` |
| `BT-068` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save download *(2 copies)* | 2022-12-07 | `7e37bf7e` |
| `BT-069` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should error when saving download after deletion *(2 copies)* | 2022-12-07 | `32c9f38c` |
| `BT-070` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should properly disconnect when connection closes from the client side *(2 copies)* | 2023-10-12 | `731b1b27` |
| `BT-071` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect when the wsEndpoint is passed as an option *(2 copies)* | 2026-03-07 | `705cb4e7` |
| `BT-072` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save har *(2 copies)* | 2022-12-07 | `d7e1b14b` |
| `BT-073` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should filter launch options *(2 copies)* | 2025-02-07 | `d04a3856` |
| `BT-074` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should record trace with sources *(2 copies)* | 2026-08-11 | `5709d49f` |
| `BT-075` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should fulfill with global fetch result *(2 copies)* | 2023-06-02 | `9bffa60f` |
| `BT-076` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should upload large file *(2 copies)* | 2026-04-01 | `96d677c9` |
| `BT-077` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should upload a folder *(2 copies)* | 2026-02-18 | `913fb6a0` |
| `BT-078` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › setInputFiles should preserve lastModified timestamp *(2 copies)* | 2026-08-07 | `d6f1e199` |
| `BT-079` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should connect over http *(2 copies)* | 2025-10-31 | `cceb25df` |
| `BT-080` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should forward non-forwarded requests *(2 copies)* | 2026-05-04 | `610375ac` |
| `BT-081` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy localhost requests @smoke *(2 copies)* | 2026-09-02 | `f9d97288` |
| `BT-082` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy ipv6 localhost requests @smoke *(2 copies)* | 2026-09-02 | `4c9112ce` |
| `BT-083` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy requests from fetch api *(2 copies)* | 2026-09-02 | `81b0bb87` |
| `BT-084` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy requests from fetch api over ipv6 *(2 copies)* | 2026-09-02 | `6cb381e4` |
| `BT-085` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy local.playwright requests *(2 copies)* | 2026-09-02 | `d99a495a` |
| `BT-086` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should lead to the error page for forwarded requests when the connection is refused *(2 copies)* | 2026-05-04 | `edfd6b93` |
| `BT-087` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy based on the pattern *(2 copies)* | 2026-09-02 | `91966aa8` |
| `BT-088` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should check proxy pattern on the client *(2 copies)* | 2026-09-02 | `f579f3d1` |
| `BT-089` | `library/browsertype-connect.spec.ts` | launchServer only › should work with cluster | 2022-12-07 | `a719e640` |
| `BT-090` | `library/browsertype-connect.spec.ts` | launchServer only › should properly disconnect when connection closes from the server side | 2023-10-12 | `1bd09ecb` |
| `BT-091` | `library/browsertype-connect.spec.ts` | launchServer only › should be able to reconnect to a browser 12 times without warnings | 2022-12-23 | `3e527844` |
| `BT-092` | `library/browsertype-connect.spec.ts` | launchServer only › cannot launch another browser | 2025-06-19 | `577ad2f9` |
| `BT-093` | `library/browsertype-connect.spec.ts` | should refuse connecting when versions do not match | 2026-02-27 | `827365ef` |
| `BT-094` | `library/browsertype-connect.spec.ts` | should filter local paths from unsafe launch options | 2026-09-02 | `7e3653f3` |
| `BT-095` | `library/browsertype-connect.spec.ts` | should timeout after redirect when connecting over http | 2025-06-23 | `1b76347c` |
| `BT-096` | `library/browsertype-connect.spec.ts` | should not retain closed browsers in launch mode | 2026-10-15 | `60f21f27` |
| `BT-097` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone chromium | 2025-05-16 | `1e88174a` |
| `BT-098` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 hub + node chromium | 2025-05-16 | `cf0485fd` |
| `BT-099` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 standalone chromium | 2025-05-16 | `5b049d9b` |
| `BT-100` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 hub + node chromium | 2025-05-16 | `4352e3b1` |
| `BT-101` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 standalone chromium broken driver | 2025-05-16 | `14b54e23` |
| `BT-102` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone non-chromium | 2022-04-22 | `78401899` |
| `BT-103` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone chromium through run-driver | 2026-04-06 | `7e3bd873` |

### BU — Before unload

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `BU-001` | `library/beforeunload.spec.ts` | should close browser with beforeunload page | 2021-10-28 | `c2076ac6` |
| `BU-002` | `library/beforeunload.spec.ts` | should close browsercontext with beforeunload page | 2021-04-06 | `f08bb99c` |
| `BU-003` | `library/beforeunload.spec.ts` | should be able to navigate away from page with beforeunload | 2021-09-09 | `2dd9bfb7` |
| `BU-004` | `library/beforeunload.spec.ts` | should close page with beforeunload listener | 2021-04-06 | `ec9b3060` |
| `BU-005` | `library/beforeunload.spec.ts` | should run beforeunload if asked for @smoke | 2022-03-10 | `1f0d9965` |
| `BU-006` | `library/beforeunload.spec.ts` | should access page after beforeunload | 2021-04-06 | `cc1a2fd7` |
| `BU-007` | `library/beforeunload.spec.ts` | should not stall on evaluate when dismissing beforeunload | 2023-09-27 | `ab7070a5` |
| `BU-008` | `library/beforeunload.spec.ts` | should not stall on click when dismissing beforeunload | 2024-12-03 | `a5628446` |
| `BU-009` | `library/beforeunload.spec.ts` | should support dismissing the dialog multiple times | 2025-10-03 | `64de88f7` |
| `BU-010` | `library/beforeunload.spec.ts` | should support closing the page after a previous dismiss | 2025-10-03 | `752eebe0` |
| `BU-011` | `library/beforeunload.spec.ts` | should support closing the page via a subsequent onbeforeunload dialog | 2025-10-03 | `9ac6ca7e` |
| `BU-012` | `library/beforeunload.spec.ts` | does not get stalled by beforeUnload | 2026-01-20 | `cd6a4ef9` |

### CA — Capabilities

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CA-001` | `library/capabilities.spec.ts` | SharedArrayBuffer should work @smoke | 2025-12-10 | `1be072ff` |
| `CA-002` | `library/capabilities.spec.ts` | Web Assembly should work @smoke | 2025-07-09 | `0184a651` |
| `CA-003` | `library/capabilities.spec.ts` | WebSocket should work @smoke | 2025-07-01 | `ea04cc83` |
| `CA-004` | `library/capabilities.spec.ts` | should respect CSP @smoke | 2022-03-10 | `7f297c98` |
| `CA-005` | `library/capabilities.spec.ts` | should play video @smoke | 2024-10-04 | `8fb9ae16` |
| `CA-006` | `library/capabilities.spec.ts` | should play webm video @smoke | 2024-10-04 | `6e16a080` |
| `CA-007` | `library/capabilities.spec.ts` | should play audio @smoke | 2026-06-12 | `f00fac29` |
| `CA-008` | `library/capabilities.spec.ts` | should support webgl @smoke | 2025-07-09 | `375472bb` |
| `CA-009` | `library/capabilities.spec.ts` | should support webgl 2 @smoke | 2025-07-09 | `4c2fca9d` |
| `CA-010` | `library/capabilities.spec.ts` | should not crash on page with mp4 @smoke | 2022-03-10 | `29cf33f3` |
| `CA-011` | `library/capabilities.spec.ts` | should not crash on showDirectoryPicker | 2024-09-27 | `6b59166d` |
| `CA-012` | `library/capabilities.spec.ts` | should not crash on storage.getDirectory() | 2026-07-24 | `5e902103` |
| `CA-013` | `library/capabilities.spec.ts` | navigator.clipboard should be present | 2023-02-21 | `a67af826` |
| `CA-014` | `library/capabilities.spec.ts` | should set CloseEvent.wasClean to false when the server terminates a WebSocket connection | 2023-02-21 | `8431eb2c` |
| `CA-015` | `library/capabilities.spec.ts` | serviceWorker should intercept document request | 2023-03-16 | `4d8f3279` |
| `CA-016` | `library/capabilities.spec.ts` | webkit should define window.safari | 2024-01-22 | `5ddce512` |
| `CA-017` | `library/capabilities.spec.ts` | make sure that XMLHttpRequest upload events are emitted correctly | 2023-03-17 | `e2aa9e1c` |
| `CA-018` | `library/capabilities.spec.ts` | loading in HTMLImageElement.prototype | 2024-11-14 | `11d09d82` |
| `CA-019` | `library/capabilities.spec.ts` | window.GestureEvent in WebKit | 2023-05-05 | `f88aac67` |
| `CA-020` | `library/capabilities.spec.ts` | requestFullscreen | 2025-12-10 | `1f209093` |
| `CA-021` | `library/capabilities.spec.ts` | should send no Content-Length header for GET requests with a Content-Type | 2024-11-14 | `7cd49d02` |
| `CA-022` | `library/capabilities.spec.ts` | Intl.ListFormat should work | 2023-11-16 | `dd7bf3e9` |
| `CA-023` | `library/capabilities.spec.ts` | service worker should cover the iframe | 2024-03-21 | `a4c6dca4` |
| `CA-024` | `library/capabilities.spec.ts` | service worker should register in an iframe | 2024-03-21 | `efb1c321` |
| `CA-025` | `library/capabilities.spec.ts` | should be able to render avif images | 2026-06-12 | `1604f405` |
| `CA-026` | `library/capabilities.spec.ts` | should not crash when clicking a label with a \<input type="file"/\> | 2024-11-18 | `7f96e398` |
| `CA-027` | `library/capabilities.spec.ts` | should not crash when clicking a color input | 2025-07-09 | `4448258a` |
| `CA-028` | `library/capabilities.spec.ts` | should not auto play audio | 2026-06-12 | `2c076018` |
| `CA-029` | `library/capabilities.spec.ts` | should not crash on feature detection for PublicKeyCredential | 2025-05-02 | `ef33002d` |
| `CA-030` | `library/modernizr.spec.ts` | Safari Desktop | 2026-07-08 | `f5c7bc73` |
| `CA-031` | `library/modernizr.spec.ts` | Mobile Safari | 2026-07-08 | `1ec61f04` |

### CC — Client certificates

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CC-001` | `library/client-certificates.spec.ts` | fetch › validate input | 2024-07-12 | `2c81f56a` |
| `CC-002` | `library/client-certificates.spec.ts` | fetch › should fail with no client certificates provided | 2024-08-02 | `98045591` |
| `CC-003` | `library/client-certificates.spec.ts` | fetch › should keep supporting http | 2024-08-02 | `4acc6f54` |
| `CC-004` | `library/client-certificates.spec.ts` | fetch › should throw with untrusted client certs | 2024-08-02 | `f7a33d14` |
| `CC-005` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates | 2024-08-02 | `0862099e` |
| `CC-006` | `library/client-certificates.spec.ts` | fetch › should not leak client certificate to cross-origin redirect target | 2026-04-30 | `b24e662a` |
| `CC-007` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates in pfx format | 2024-08-05 | `b278df27` |
| `CC-008` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates and when a http proxy is used | 2024-09-16 | `27061bd6` |
| `CC-009` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates and when a socks proxy is used | 2024-09-18 | `d708e89b` |
| `CC-010` | `library/client-certificates.spec.ts` | fetch › should throw a http error if the pfx passphrase is incorect | 2024-08-06 | `90839001` |
| `CC-011` | `library/client-certificates.spec.ts` | fetch › should fail with matching certificates in legacy pfx format | 2024-08-06 | `2941bff9` |
| `CC-012` | `library/client-certificates.spec.ts` | fetch › should work in the browser with request interception | 2024-08-02 | `305d95b5` |
| `CC-013` | `library/client-certificates.spec.ts` | browser › validate input | 2024-07-12 | `c372a2e5` |
| `CC-014` | `library/client-certificates.spec.ts` | browser › should keep supporting http | 2024-07-23 | `f625b5a9` |
| `CC-015` | `library/client-certificates.spec.ts` | browser › should pass through to non-matching origin with self-signed cert | 2026-05-11 | `ed9c708a` |
| `CC-016` | `library/client-certificates.spec.ts` | browser › should not intercept TLS for origins without a client certificate | 2026-07-30 | `7622f04f` |
| `CC-017` | `library/client-certificates.spec.ts` | browser › should fail with no client certificates | 2024-09-27 | `cb561f24` |
| `CC-018` | `library/client-certificates.spec.ts` | browser › should fail with self-signed client certificates | 2024-09-27 | `d2a12f93` |
| `CC-019` | `library/client-certificates.spec.ts` | browser › should complete browser TLS handshake when server rejects client certificate after it | 2026-10-13 | `efc2f076` |
| `CC-020` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates | 2024-09-27 | `c279485d` |
| `CC-021` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates when passing as content | 2024-09-27 | `ea6f5017` |
| `CC-022` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used | 2024-09-27 | `1b5e2a6e` |
| `CC-023` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used from env | 2025-07-29 | `e4299b0b` |
| `CC-024` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used from config but env is there | 2025-07-29 | `0d3a6467` |
| `CC-025` | `library/client-certificates.spec.ts` | browser › should respect launch proxy and proxy bypass | 2026-09-24 | `714c5cea` |
| `CC-026` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a socks proxy is used | 2025-01-29 | `739b0e5e` |
| `CC-027` | `library/client-certificates.spec.ts` | browser › should not hang on tls errors during TLS 1.2 handshake | 2024-08-15 | `6e6c7bc1` |
| `CC-028` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates in pfx format | 2024-09-27 | `48a8b19d` |
| `CC-029` | `library/client-certificates.spec.ts` | browser › should handle TLS renegotiation with client certificates | 2026-09-24 | `7c2382aa` |
| `CC-030` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates in pfx format when passing as content | 2024-09-27 | `99ab988a` |
| `CC-031` | `library/client-certificates.spec.ts` | browser › should fail with matching certificates in legacy pfx format | 2024-09-27 | `a4510aaa` |
| `CC-032` | `library/client-certificates.spec.ts` | browser › should throw a http error if the pfx passphrase is incorect | 2024-09-27 | `ec8c1e6a` |
| `CC-033` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates on context APIRequestContext instance | 2024-09-18 | `748a12cf` |
| `CC-034` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and trailing slash | 2024-09-27 | `0ead07cd` |
| `CC-035` | `library/client-certificates.spec.ts` | browser › should have ignoreHTTPSErrors=false by default | 2026-05-11 | `c7c2e6e1` |
| `CC-036` | `library/client-certificates.spec.ts` | browser › support http2 | 2024-09-27 | `266cc03b` |
| `CC-037` | `library/client-certificates.spec.ts` | browser › support http2 if the browser only supports http1.1 | 2024-09-18 | `e4774510` |
| `CC-038` | `library/client-certificates.spec.ts` | browser › should return target connection errors when using http2 | 2026-05-11 | `9bdbde6f` |
| `CC-039` | `library/client-certificates.spec.ts` | browser › should handle rejected certificate in handshake with HTTP/2 | 2024-08-22 | `ce4efa39` |
| `CC-040` | `library/client-certificates.spec.ts` | browser › persistentContext › validate input | 2024-07-12 | `bbc9c196` |
| `CC-041` | `library/client-certificates.spec.ts` | browser › persistentContext › should pass with matching certificates | 2024-09-27 | `7436bff1` |

### CD — CDP

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CD-001` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session | 2023-02-08 | `a8460af8` |
| `CD-002` | `library/chromium/connect-over-cdp.spec.ts` | should connect when an existing page has no renderer | 2026-09-30 | `50a4c2ae` |
| `CD-003` | `library/chromium/connect-over-cdp.spec.ts` | should connect when the opener of an existing page has no renderer | 2026-10-03 | `6e2a960e` |
| `CD-004` | `library/chromium/connect-over-cdp.spec.ts` | should connect when an existing page has been discarded | 2026-09-30 | `a30167f4` |
| `CD-005` | `library/chromium/connect-over-cdp.spec.ts` | should cleanup artifacts dir after connectOverCDP disconnects due to ws close | 2023-02-08 | `58a6ad48` |
| `CD-006` | `library/chromium/connect-over-cdp.spec.ts` | should reject pending CDPSession calls when the browser is killed | 2026-10-08 | `998fcad0` |
| `CD-007` | `library/chromium/connect-over-cdp.spec.ts` | should write traces to provided artifactsDir on connectOverCDP | 2026-05-15 | `a412d1d2` |
| `CD-008` | `library/chromium/connect-over-cdp.spec.ts` | should connectOverCDP and manage downloads in default context | 2023-02-08 | `0b3180fc` |
| `CD-009` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session twice | 2026-09-22 | `d4009dfa` |
| `CD-010` | `library/chromium/connect-over-cdp.spec.ts` | should connect to existing page with iframe and navigate | 2023-02-08 | `e28e47cb` |
| `CD-011` | `library/chromium/connect-over-cdp.spec.ts` | should connect to existing service workers | 2023-02-08 | `c43fef14` |
| `CD-012` | `library/chromium/connect-over-cdp.spec.ts` | should connect over a ws endpoint | 2023-10-05 | `cdde8841` |
| `CD-013` | `library/chromium/connect-over-cdp.spec.ts` | should send extra headers with connect request | 2024-02-08 | `ed479bf4` |
| `CD-014` | `library/chromium/connect-over-cdp.spec.ts` | should keep URL parameters when adding json/version | 2025-06-26 | `db422253` |
| `CD-015` | `library/chromium/connect-over-cdp.spec.ts` | should append /json/version with a slash if there isnt one | 2025-06-26 | `a6501eb9` |
| `CD-016` | `library/chromium/connect-over-cdp.spec.ts` | should send default User-Agent header with connect request | 2023-02-08 | `ed85998c` |
| `CD-017` | `library/chromium/connect-over-cdp.spec.ts` | should report all pages in an existing browser | 2023-02-08 | `944d384e` |
| `CD-018` | `library/chromium/connect-over-cdp.spec.ts` | should connect via https | 2023-02-08 | `5f3c666e` |
| `CD-019` | `library/chromium/connect-over-cdp.spec.ts` | should return valid browser from context.browser() | 2023-02-08 | `8c02faba` |
| `CD-020` | `library/chromium/connect-over-cdp.spec.ts` | should report an expected error when the endpointURL returns a non-expected status code | 2023-02-08 | `16576e93` |
| `CD-021` | `library/chromium/connect-over-cdp.spec.ts` | should report an expected error when the endpoint URL JSON webSocketDebuggerUrl is undefined | 2023-02-08 | `58d83ad6` |
| `CD-022` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session when passed as a first argument | 2023-02-08 | `e2de5933` |
| `CD-023` | `library/chromium/connect-over-cdp.spec.ts` | should use proxy with connectOverCDP | 2026-10-16 | `f00b8df2` |
| `CD-024` | `library/chromium/connect-over-cdp.spec.ts` | should use env proxy with connectOverCDP discovery request | 2026-04-28 | `d6f363e9` |
| `CD-025` | `library/chromium/connect-over-cdp.spec.ts` | should send target Host header when using env HTTP proxy with connectOverCDP | 2026-05-20 | `bb29ba7a` |
| `CD-026` | `library/chromium/connect-over-cdp.spec.ts` | should be able to connect via localhost | 2023-02-08 | `9cbb5f85` |
| `CD-027` | `library/chromium/connect-over-cdp.spec.ts` | emulate media should not be affected by second connectOverCDP with noDefaults | 2026-06-12 | `6115253d` |
| `CD-028` | `library/chromium/connect-over-cdp.spec.ts` | should allow tracing over cdp session | 2024-09-17 | `f97c3546` |
| `CD-029` | `library/chromium/connect-over-cdp.spec.ts` | setInputFiles should preserve lastModified timestamp | 2026-08-07 | `313e827f` |
| `CD-030` | `library/chromium/connect-over-cdp.spec.ts` | setInputFiles should use local path when isLocal is set | 2026-06-01 | `b313b669` |
| `CD-031` | `library/chromium/connect-over-cdp.spec.ts` | should print custom ws close error | 2024-04-02 | `460ebaa7` |
| `CD-032` | `library/chromium/connect-over-cdp.spec.ts` | should not reuse utility worlds between two clients | 2026-04-02 | `65f1aebb` |
| `CD-033` | `library/chromium/connect-over-cdp.spec.ts` | should get title and URL of existing page | 2026-01-27 | `3b8ab874` |
| `CD-034` | `library/chromium/connect-over-cdp.spec.ts` | should skip default overrides with noDefaults | 2026-04-21 | `2299973f` |
| `CD-035` | `library/chromium/connect-over-cdp.spec.ts` | noDefaults should not affect new contexts | 2026-04-21 | `df43d732` |
| `CD-036` | `library/chromium/connect-over-cdp.spec.ts` | should connect over CDP using a ConnectionTransport | 2026-05-22 | `ce7da3d7` |
| `CD-037` | `library/chromium/session.spec.ts` | should work | 2021-04-02 | `9c199d97` |
| `CD-038` | `library/chromium/session.spec.ts` | should respect timeout and signal options | 2026-10-15 | `23894e87` |
| `CD-039` | `library/chromium/session.spec.ts` | should send events | 2021-04-02 | `db1fefbf` |
| `CD-040` | `library/chromium/session.spec.ts` | should only accept a page or frame | 2021-08-16 | `6c20a252` |
| `CD-041` | `library/chromium/session.spec.ts` | should enable and disable domains independently | 2021-04-29 | `209138d3` |
| `CD-042` | `library/chromium/session.spec.ts` | should be able to detach session | 2021-04-02 | `2c21bd5c` |
| `CD-043` | `library/chromium/session.spec.ts` | should throw nice errors | 2021-04-02 | `978891bc` |
| `CD-044` | `library/chromium/session.spec.ts` | should work with main frame | 2021-08-16 | `ac3cdd37` |
| `CD-045` | `library/chromium/session.spec.ts` | should throw if target is part of main | 2021-08-16 | `4126ac3c` |
| `CD-046` | `library/chromium/session.spec.ts` | should not break page.close() | 2021-04-05 | `a5541400` |
| `CD-047` | `library/chromium/session.spec.ts` | should detach when page closes | 2021-04-05 | `62cea07c` |
| `CD-048` | `library/chromium/session.spec.ts` | should reject protocol calls when page closes | 2023-10-12 | `4d5017aa` |
| `CD-049` | `library/chromium/session.spec.ts` | should emit event for each CDP event | 2026-03-09 | `c3a1aa5b` |
| `CD-050` | `library/chromium/session.spec.ts` | should emit close event when session is detached | 2026-03-21 | `9a84d9cc` |
| `CD-051` | `library/chromium/session.spec.ts` | should emit close event when page closes | 2026-03-21 | `d84fe31c` |
| `CD-052` | `library/chromium/session.spec.ts` | should work with newBrowserCDPSession | 2022-08-23 | `4e9d6fe2` |

### CF — Code frame

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CF-001` | `library/unit/code-frame.spec.ts` | should mark the column | 2026-10-13 | `24613bd4` |
| `CF-002` | `library/unit/code-frame.spec.ts` | should mark the line without a column | 2026-10-13 | `71c80d93` |
| `CF-003` | `library/unit/code-frame.spec.ts` | should respect linesAbove and linesBelow | 2026-10-13 | `48918d0f` |
| `CF-004` | `library/unit/code-frame.spec.ts` | should clip to the source lines | 2026-10-13 | `e39dc098` |
| `CF-005` | `library/unit/code-frame.spec.ts` | should pad line numbers to the widest one | 2026-10-13 | `af40576e` |
| `CF-006` | `library/unit/code-frame.spec.ts` | should print the message after the marker | 2026-10-13 | `14c60a7b` |
| `CF-007` | `library/unit/code-frame.spec.ts` | should print the message above the frame without a column | 2026-10-13 | `48434a25` |
| `CF-008` | `library/unit/code-frame.spec.ts` | should keep tabs before the marker | 2026-10-13 | `78b95f45` |
| `CF-009` | `library/unit/code-frame.spec.ts` | should not add a space after the gutter for empty lines | 2026-10-13 | `eb877d96` |
| `CF-010` | `library/unit/code-frame.spec.ts` | should split lines on all line terminators | 2026-10-13 | `7424a07b` |
| `CF-011` | `library/unit/code-frame.spec.ts` | should highlight code | 2026-10-13 | `36443d49` |
| `CF-012` | `library/unit/code-frame.spec.ts` | should highlight multi-line tokens on each line | 2026-10-13 | `5f03de1c` |
| `CF-013` | `library/unit/code-frame.spec.ts` | should highlight keywords used as property names as identifiers | 2026-10-13 | `e8612de3` |

### CG — Codegen

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CG-001` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click | 2024-09-19 | `bedd8a85` |
| `CG-002` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should double click | 2024-09-19 | `4c3a1391` |
| `CG-003` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click twice | 2026-02-26 | `6a836185` |
| `CG-004` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should type after clicking twice | 2026-02-26 | `5918b50e` |
| `CG-005` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should ignore programmatic events | 2024-09-19 | `cc7835a8` |
| `CG-006` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click after same-document navigation | 2024-09-19 | `3db79c88` |
| `CG-007` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should make a positioned click on a canvas | 2025-09-11 | `48244e2f` |
| `CG-008` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should work with TrustedTypes | 2024-09-19 | `ce353ccf` |
| `CG-009` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not target selector preview by text regexp | 2024-09-19 | `577b0b08` |
| `CG-010` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill | 2024-09-19 | `9235ce78` |
| `CG-011` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill japanese text | 2024-09-19 | `321ce3f1` |
| `CG-012` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill textarea | 2024-09-19 | `29f4e65b` |
| `CG-013` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill textarea with new lines at the end | 2026-06-23 | `658837ee` |
| `CG-014` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill \[contentEditable\] | 2024-09-19 | `27d9f4dd` |
| `CG-015` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill \[contentEditable\] with initial text | 2026-07-31 | `9a1aa1b2` |
| `CG-016` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should press | 2025-06-27 | `209ded9a` |
| `CG-017` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should update selected element after pressing Tab | 2025-01-16 | `b6e1e76e` |
| `CG-018` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record ArrowDown | 2025-06-27 | `8d7db3bf` |
| `CG-019` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should emit single keyup on ArrowDown | 2024-09-19 | `3586079e` |
| `CG-020` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not record a click on Enter press | 2026-07-23 | `9ceff352` |
| `CG-021` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check | 2024-09-19 | `f12fc767` |
| `CG-022` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check a radio button | 2024-09-19 | `be4dc665` |
| `CG-023` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check with keyboard | 2024-09-19 | `a119a8e2` |
| `CG-024` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check with keyboard after hover | 2025-06-27 | `d6988f99` |
| `CG-025` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should uncheck | 2024-09-19 | `f22c6c65` |
| `CG-026` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should select | 2024-09-19 | `50eb1334` |
| `CG-027` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should select with size attribute | 2024-09-19 | `a2ccbe9e` |
| `CG-028` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should await popup | 2025-06-30 | `cfaf1b60` |
| `CG-029` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should attribute navigation to click | 2024-09-19 | `667fac1a` |
| `CG-030` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should attribute navigation to press/fill | 2025-01-29 | `a0ddfbd0` |
| `CG-031` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should ignore AltGraph | 2024-09-19 | `2aee7df1` |
| `CG-032` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should middle click | 2025-09-11 | `1091222f` |
| `CG-033` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record slider | 2026-08-18 | `414d4d09` |
| `CG-034` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click button with nested div | 2024-09-19 | `b5163741` |
| `CG-035` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record omnibox navigations after performAction | 2026-02-26 | `149e7f47` |
| `CG-036` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record omnibox navigations after recordAction | 2026-02-26 | `2b8e7e3e` |
| `CG-037` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not throw csp directive violation errors | 2026-04-23 | `eba1dfac` |
| `CG-038` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should clear when recording is disabled | 2024-12-06 | `21aa5ca7` |
| `CG-039` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain open page | 2024-09-19 | `5137742e` |
| `CG-040` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain second page | 2024-09-19 | `5db15e2f` |
| `CG-041` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain close page | 2024-09-19 | `2e4b9de8` |
| `CG-042` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should not lead to an error if html gets clicked | 2025-08-01 | `7a7aab09` |
| `CG-043` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload a single file | 2026-05-15 | `431cd38d` |
| `CG-044` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload multiple files | 2025-04-08 | `20f33a4b` |
| `CG-045` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should clear files | 2025-04-08 | `00904df9` |
| `CG-046` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload a file via hidden input triggered by button | 2026-06-11 | `bd4a7e5b` |
| `CG-047` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should download files | 2025-12-09 | `d170434a` |
| `CG-048` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should handle dialogs | 2024-09-19 | `099d7855` |
| `CG-049` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should handle history.postData | 2024-09-19 | `1dba1f21` |
| `CG-050` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should record open in a new tab with url | 2025-01-16 | `a53c880b` |
| `CG-051` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should not clash pages | 2024-09-19 | `f367ae83` |
| `CG-052` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › click should emit events in order | 2024-09-25 | `f7d1ffdd` |
| `CG-053` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should reset hover model on action when element detaches | 2024-09-19 | `a68c8ce0` |
| `CG-054` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should update active model on action | 2026-02-26 | `a2660b7d` |
| `CG-055` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should check input with chaining id | 2024-09-19 | `8d02a560` |
| `CG-056` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should record navigations after identical pushState | 2024-09-19 | `59210a2e` |
| `CG-057` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should fill tricky characters | 2024-09-19 | `60262c10` |
| `CG-058` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should --test-id-attribute | 2024-09-19 | `c7081ab5` |
| `CG-059` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should generate getByTestId for any of the configured testIdAttributes | 2026-05-14 | `158f8453` |
| `CG-060` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should auto-generate toBeVisible | 2026-07-11 | `0c3ff8aa` |
| `CG-061` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should click locator.first | 2025-07-09 | `0c2f8a57` |
| `CG-062` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should click locator.nth | 2024-09-19 | `f34419f1` |
| `CG-063` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (1) | 2026-07-10 | `1d7a2354` |
| `CG-064` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (2) | 2026-08-28 | `db736251` |
| `CG-065` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (3) | 2026-08-28 | `8ed46574` |
| `CG-066` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (4) | 2026-08-28 | `def4640d` |
| `CG-067` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with special characters in name attribute | 2025-05-26 | `bece9789` |
| `CG-068` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with title attribute | 2024-09-19 | `c9e0016a` |
| `CG-069` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with name attribute | 2024-09-19 | `41bb0dd6` |
| `CG-070` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with id attribute | 2024-09-19 | `7e9a5473` |
| `CG-071` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with testId | 2024-09-19 | `c8581ac5` |
| `CG-072` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate role locators undef frame locators | 2024-09-19 | `35beb2dc` |
| `CG-073` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByTestId | 2024-09-19 | `a7ca4877` |
| `CG-074` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByPlaceholder | 2024-12-12 | `42553179` |
| `CG-075` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByAltText | 2024-09-19 | `bfa7a135` |
| `CG-076` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByLabel | 2024-12-12 | `833ca4ba` |
| `CG-077` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByLabel without regex | 2024-12-12 | `cd1c006f` |
| `CG-078` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should pass through pointer events | 2026-07-23 | `40298e2d` |
| `CG-079` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should consume contextmenu events, despite a custom context menu | 2025-09-15 | `488e0cab` |
| `CG-080` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate click action from dialog | 2026-07-23 | `54496928` |
| `CG-081` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate double click action from dialog | 2026-07-23 | `0c410326` |
| `CG-082` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate hover action | 2025-09-22 | `1d4fbcd0` |
| `CG-083` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value | 2024-09-19 | `cf124fdc` |
| `CG-084` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value on disabled input | 2026-02-26 | `9e36652f` |
| `CG-085` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value on disabled select | 2024-09-19 | `bd9b5e04` |
| `CG-086` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert visibility | 2024-09-19 | `93b6d398` |
| `CG-087` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should keep toolbar visible even if webpage erases content in hydration | 2025-03-25 | `3c4394be` |
| `CG-088` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should display inline svg icons on text assertion dialog inside iframe | 2024-10-22 | `de79f27e` |
| `CG-089` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should keep dialog open when clicking inside | 2025-10-30 | `e12d17a8` |
| `CG-090` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when top layer popover is open | 2026-02-09 | `c5eed7dc` |
| `CG-091` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when top layer popover inside shadow DOM is open | 2026-02-09 | `de01c72f` |
| `CG-092` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when manual popover with fullscreen backdrop is open | 2026-02-09 | `16ad3bea` |
| `CG-093` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when fullscreen element is open | 2026-07-23 | `87f6c15f` |
| `CG-094` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen with frameLocator() › should prepend the frame selector to disambiguate | 2026-08-28 | `59050d72` |
| `CG-095` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen with frameLocator() › should not use frameLocator() when it saves a single frameLocator(selector) | 2026-08-28 | `215d0570` |
| `CG-096` | `library/inspector/cli-codegen-aria.spec.ts` | should generate aria snapshot | 2024-10-15 | `fa47896f` |
| `CG-097` | `library/inspector/cli-codegen-aria.spec.ts` | should generate regex in aria snapshot | 2024-10-31 | `5e43ed21` |
| `CG-098` | `library/inspector/cli-codegen-aria.spec.ts` | should generate regex for uuid in aria snapshot | 2026-02-09 | `1c57d4b7` |
| `CG-099` | `library/inspector/cli-codegen-aria.spec.ts` | should inspect aria snapshot | 2025-04-22 | `36836b9c` |
| `CG-100` | `library/inspector/cli-codegen-aria.spec.ts` | should update aria snapshot highlight | 2024-11-16 | `4cf87249` |
| `CG-101` | `library/inspector/cli-codegen-aria.spec.ts` | should show aria snapshot error | 2025-10-22 | `fd6cecb7` |
| `CG-102` | `library/inspector/cli-codegen-aria.spec.ts` | should generate valid javascript with multiline snapshot assertion | 2026-10-16 | `003c0b8f` |
| `CG-103` | `library/inspector/cli-codegen-pick-locator.spec.ts` | should inspect locator | 2024-11-15 | `64a56e7e` |
| `CG-104` | `library/inspector/cli-codegen-pick-locator.spec.ts` | should update locator highlight | 2024-11-15 | `76ae7987` |
| `CG-105` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct imports and context options | 2025-06-30 | `3435e952` |
| `CG-106` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options for custom settings | 2025-06-30 | `24f35a92` |
| `CG-107` | `library/inspector/cli-codegen-javascript.spec.ts` | should work with --http-credentials | 2026-08-20 | `4317cba5` |
| `CG-108` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options when using a device | 2025-06-30 | `8cff99a3` |
| `CG-109` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options when using a device and additional options | 2025-06-30 | `46d0a9ae` |
| `CG-110` | `library/inspector/cli-codegen-javascript.spec.ts` | should save the codegen output to a file if specified | 2025-08-12 | `6f816b5d` |
| `CG-111` | `library/inspector/cli-codegen-javascript.spec.ts` | should print load/save storageState | 2025-06-30 | `fc6d4d45` |
| `CG-112` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct imports and context options | 2025-08-12 | `06410ab1` |
| `CG-113` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options for custom settings | 2025-06-30 | `88abcf3c` |
| `CG-114` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options when using a device | 2025-06-30 | `2f24a8d5` |
| `CG-115` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options when using a device and additional options | 2025-06-30 | `9402afeb` |
| `CG-116` | `library/inspector/cli-codegen-test.spec.ts` | should print load storageState | 2025-06-30 | `35c7d6d1` |
| `CG-117` | `library/inspector/cli-codegen-test.spec.ts` | should not generate recordHAR with --save-har | 2025-08-12 | `c7f17634` |
| `CG-118` | `library/inspector/cli-codegen-test.spec.ts` | should generate routeFromHAR with --save-har | 2025-08-12 | `cc8320bd` |
| `CG-119` | `library/inspector/cli-codegen-test.spec.ts` | should generate routeFromHAR with --save-har and --save-har-glob | 2025-08-12 | `8a52366d` |
| `CG-120` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct imports and context options | 2025-06-30 | `91938a56` |
| `CG-121` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options for custom settings | 2025-06-30 | `9ccc303f` |
| `CG-122` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options when using a device | 2025-06-30 | `09a34f6d` |
| `CG-123` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options when using a device and additional options | 2025-06-30 | `7818e5c2` |
| `CG-124` | `library/inspector/cli-codegen-python.spec.ts` | should save the codegen output to a file if specified | 2025-08-12 | `f419ff1e` |
| `CG-125` | `library/inspector/cli-codegen-python.spec.ts` | should print load/save storage\_state | 2025-06-30 | `9e1563e5` |
| `CG-126` | `library/inspector/cli-codegen-python.spec.ts` | should work with --save-har | 2025-08-12 | `a8e926fd` |
| `CG-127` | `library/inspector/cli-codegen-python.spec.ts` | should work with --save-har and --save-har-glob | 2025-08-12 | `85b7fc40` |
| `CG-128` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct imports and context options | 2025-06-30 | `76748f27` |
| `CG-129` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options for custom settings | 2025-06-30 | `dd8bebc1` |
| `CG-130` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options when using a device | 2025-06-30 | `b54bb85d` |
| `CG-131` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options when using a device and additional options | 2025-06-30 | `4a86264f` |
| `CG-132` | `library/inspector/cli-codegen-python-async.spec.ts` | should save the codegen output to a file if specified | 2025-08-12 | `b1f2cb20` |
| `CG-133` | `library/inspector/cli-codegen-python-async.spec.ts` | should print load/save storage\_state | 2025-06-30 | `1a554fa7` |
| `CG-134` | `library/inspector/cli-codegen-python-async.spec.ts` | should work with --save-har | 2025-08-12 | `8bfeb949` |
| `CG-135` | `library/inspector/cli-codegen-python-async.spec.ts` | should work with --save-har and --save-har-glob | 2025-08-12 | `a7d51e84` |
| `CG-136` | `library/inspector/cli-codegen-pytest.spec.ts` | should print the correct imports and context options | 2025-06-30 | `cf1b607a` |
| `CG-137` | `library/inspector/cli-codegen-pytest.spec.ts` | should print the correct context options when using a device and lang | 2025-08-12 | `35494ece` |
| `CG-138` | `library/inspector/cli-codegen-pytest.spec.ts` | should save the codegen output to a file if specified | 2025-08-12 | `b2237ba1` |
| `CG-139` | `library/inspector/cli-codegen-pytest.spec.ts` | should work with --save-har | 2025-08-12 | `0e7d5c47` |
| `CG-140` | `library/inspector/cli-codegen-pytest.spec.ts` | should work with --save-har and --save-har-glob | 2025-08-12 | `e61a1ca9` |
| `CG-141` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct imports and context options | 2025-06-30 | `b566afe3` |
| `CG-142` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options for custom settings | 2025-06-30 | `0cee44a1` |
| `CG-143` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options when using a device | 2025-08-12 | `bb5fbe99` |
| `CG-144` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options when using a device and additional options | 2025-08-12 | `1024016f` |
| `CG-145` | `library/inspector/cli-codegen-java.spec.ts` | should print load/save storage\_state | 2025-06-30 | `98ca116a` |
| `CG-146` | `library/inspector/cli-codegen-java.spec.ts` | should work with --save-har and --save-har-glob as java-library | 2025-08-12 | `ca700bf4` |
| `CG-147` | `library/inspector/cli-codegen-java.spec.ts` | should work with --save-har and --save-har-glob as java-junit | 2025-08-12 | `5d9bbda6` |
| `CG-148` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct imports in junit | 2025-06-30 | `608878dc` |
| `CG-149` | `library/inspector/cli-codegen-java.spec.ts` | should print a valid basic program in junit | 2025-06-30 | `641bf9f1` |
| `CG-150` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct imports and context options | 2025-09-11 | `c9ddfb57` |
| `CG-151` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options for custom settings | 2025-09-11 | `4985a3c2` |
| `CG-152` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options when using a device | 2025-09-11 | `b0b47048` |
| `CG-153` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options when using a device and additional options | 2025-09-11 | `f11548f8` |
| `CG-154` | `library/inspector/cli-codegen-csharp.spec.ts` | should print load/save storageState | 2025-09-11 | `a9846229` |
| `CG-155` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har | 2025-08-12 | `9f3a939d` |
| `CG-156` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har and --save-har-glob | 2025-09-11 | `566fc618` |
| `CG-157` | `library/inspector/cli-codegen-csharp.spec.ts` | should not print context options method override in {nunit, mstest, xunit} if no options were passed *(3 copies)* | 2025-08-12 | `eac2571c` |
| `CG-158` | `library/inspector/cli-codegen-csharp.spec.ts` | should print context options method override in {nunit, mstest, xunit} if options were passed *(3 copies)* | 2025-09-11 | `32819714` |
| `CG-159` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har in {nunit, mstest, xunit} *(3 copies)* | 2025-08-12 | `ffeb7aca` |
| `CG-160` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har and --save-har-glob in {nunit, mstest, xunit} *(3 copies)* | 2025-09-11 | `2ec550a0` |
| `CG-161` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in mstest | 2025-09-11 | `82c0ab74` |
| `CG-162` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in nunit | 2025-09-11 | `592f4622` |
| `CG-163` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in xunit | 2026-05-01 | `7fbaaa24` |
| `CG-164` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall | 2024-11-20 | `7f452259` |
| `CG-165` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with POST method and no body | 2024-11-20 | `74ab1899` |
| `CG-166` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with PUT method and JSON body | 2024-11-20 | `06c88453` |
| `CG-167` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with PATCH method and form data | 2024-11-20 | `b37690af` |
| `CG-168` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with DELETE method and custom header | 2024-11-20 | `2782f2d1` |
| `CG-169` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with HEAD method | 2024-11-20 | `ee53a5d7` |
| `CG-170` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with complex query parameters | 2024-11-20 | `14ff0159` |
| `CG-171` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with multiple headers | 2024-11-20 | `9663c923` |
| `CG-172` | `library/unit/codegen.spec.ts` | javascript › escape sequences | 2024-11-20 | `5ad08e02` |
| `CG-173` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall | 2024-11-20 | `d31fb73d` |
| `CG-174` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with POST method and no body | 2024-11-20 | `4421276d` |
| `CG-175` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with PUT method and JSON body | 2024-11-20 | `e7b15c93` |
| `CG-176` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with PATCH method and form data | 2024-11-20 | `adccd7cd` |
| `CG-177` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with DELETE method and custom header | 2024-11-20 | `df212ae2` |
| `CG-178` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with HEAD method | 2024-11-20 | `2c733fbe` |
| `CG-179` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with complex query parameters | 2024-11-20 | `06ec0995` |
| `CG-180` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with multiple headers | 2024-11-20 | `d6ddbb28` |
| `CG-181` | `library/unit/codegen.spec.ts` | python › escape sequences | 2024-11-20 | `3780fe9a` |
| `CG-182` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall | 2024-11-20 | `73a6e131` |
| `CG-183` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall with POST method and no body | 2024-11-20 | `e9a3f0dd` |
| `CG-184` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall with PUT method and JSON body | 2024-11-20 | `6a47ea58` |
| `CG-185` | `library/unit/codegen.spec.ts` | csharp › escape sequences | 2024-11-20 | `fb4652dc` |
| `CG-186` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall | 2024-11-20 | `46f712fe` |
| `CG-187` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with POST method and no body | 2024-11-20 | `60fb5767` |
| `CG-188` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with PUT method and JSON body | 2024-11-20 | `28a1246e` |
| `CG-189` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with PATCH method and form data | 2024-11-20 | `dac6863a` |
| `CG-190` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with DELETE method and custom header | 2024-11-20 | `cb58cdf3` |
| `CG-191` | `library/unit/codegen.spec.ts` | java › escape sequences | 2024-11-20 | `c543ab95` |

### CH — Check

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CH-001` | `page/page-check.spec.ts` | should check the box @smoke | 2025-01-23 | `8dc960f7` |
| `CH-002` | `page/page-check.spec.ts` | should not check the checked box | 2020-08-06 | `2c7f67c3` |
| `CH-003` | `page/page-check.spec.ts` | should uncheck the box | 2020-08-06 | `852b05d7` |
| `CH-004` | `page/page-check.spec.ts` | should not uncheck the unchecked box | 2020-08-06 | `d911750b` |
| `CH-005` | `page/page-check.spec.ts` | should check radio | 2020-08-06 | `338b832a` |
| `CH-006` | `page/page-check.spec.ts` | should check radio by aria role | 2021-09-09 | `5c581872` |
| `CH-007` | `page/page-check.spec.ts` | should uncheck radio by aria role | 2021-09-09 | `4293f80a` |
| `CH-008` | `page/page-check.spec.ts` | should check the box by aria role | 2022-10-25 | `7d1b1d5d` |
| `CH-009` | `page/page-check.spec.ts` | should uncheck the box by aria role | 2022-10-25 | `12df1abc` |
| `CH-010` | `page/page-check.spec.ts` | should throw when not a checkbox | 2021-01-09 | `cfcc0f2d` |
| `CH-011` | `page/page-check.spec.ts` | should throw when not a checkbox 2 | 2022-10-25 | `0acaa2a4` |
| `CH-012` | `page/page-check.spec.ts` | should check the box inside a button | 2021-04-01 | `9b5ed2fd` |
| `CH-013` | `page/page-check.spec.ts` | should check the label with position | 2021-04-12 | `ce513959` |
| `CH-014` | `page/page-check.spec.ts` | trial run should not check | 2021-04-21 | `013b1ee4` |
| `CH-015` | `page/page-check.spec.ts` | trial run should not uncheck | 2021-04-21 | `c4a62174` |
| `CH-016` | `page/page-check.spec.ts` | should check the box using setChecked | 2021-08-30 | `53433adb` |
| `CH-017` | `page/page-check.spec.ts` | should throw when trying to uncheck radio button | 2025-08-29 | `b1605091` |

### CK — Clock

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CK-001` | `library/page-clock.spec.ts` | runFor › triggers immediately without specified delay | 2024-06-04 | `90a311b3` |
| `CK-002` | `library/page-clock.spec.ts` | runFor › does not trigger without sufficient delay | 2024-06-04 | `37acdb08` |
| `CK-003` | `library/page-clock.spec.ts` | runFor › triggers after sufficient delay | 2024-06-04 | `4467c61e` |
| `CK-004` | `library/page-clock.spec.ts` | runFor › triggers simultaneous timers | 2024-06-04 | `3e413c1c` |
| `CK-005` | `library/page-clock.spec.ts` | runFor › triggers multiple simultaneous timers | 2024-06-04 | `de311374` |
| `CK-006` | `library/page-clock.spec.ts` | runFor › waits after setTimeout was called | 2024-06-04 | `1c84e6e1` |
| `CK-007` | `library/page-clock.spec.ts` | runFor › triggers event when some throw | 2024-06-04 | `bbd2bf02` |
| `CK-008` | `library/page-clock.spec.ts` | runFor › creates updated Date while ticking | 2024-06-11 | `4c462491` |
| `CK-009` | `library/page-clock.spec.ts` | runFor › passes 8 seconds | 2024-06-04 | `9327909d` |
| `CK-010` | `library/page-clock.spec.ts` | runFor › passes 1 minute | 2024-06-04 | `0078aa11` |
| `CK-011` | `library/page-clock.spec.ts` | runFor › passes 2 hours, 34 minutes and 10 seconds | 2026-10-16 | `4469996c` |
| `CK-012` | `library/page-clock.spec.ts` | runFor › throws for invalid format | 2024-06-04 | `ef366b61` |
| `CK-013` | `library/page-clock.spec.ts` | runFor › returns the current now value | 2024-06-11 | `5ae7ec65` |
| `CK-014` | `library/page-clock.spec.ts` | fastForward › ignores timers which wouldn't be run | 2024-06-11 | `17569e8a` |
| `CK-015` | `library/page-clock.spec.ts` | fastForward › pushes back execution time for skipped timers | 2024-06-11 | `36444376` |
| `CK-016` | `library/page-clock.spec.ts` | fastForward › supports string time arguments | 2024-06-11 | `ae8f7df7` |
| `CK-017` | `library/page-clock.spec.ts` | stubTimers › sets initial timestamp | 2024-06-11 | `27b769a7` |
| `CK-018` | `library/page-clock.spec.ts` | stubTimers › should throw for invalid date | 2024-06-18 | `23e4f727` |
| `CK-019` | `library/page-clock.spec.ts` | stubTimers › replaces global setTimeout | 2024-06-04 | `19b29656` |
| `CK-020` | `library/page-clock.spec.ts` | stubTimers › global fake setTimeout should return id | 2024-05-30 | `2ecadee7` |
| `CK-021` | `library/page-clock.spec.ts` | stubTimers › replaces global clearTimeout | 2024-06-04 | `4e277a53` |
| `CK-022` | `library/page-clock.spec.ts` | stubTimers › replaces global setInterval | 2024-06-04 | `63cc521e` |
| `CK-023` | `library/page-clock.spec.ts` | stubTimers › replaces global clearInterval | 2024-06-04 | `9adff950` |
| `CK-024` | `library/page-clock.spec.ts` | stubTimers › replaces global performance.now | 2024-06-11 | `ad13923e` |
| `CK-025` | `library/page-clock.spec.ts` | stubTimers › fakes Date constructor | 2024-06-11 | `f2a38ec1` |
| `CK-026` | `library/page-clock.spec.ts` | stubTimers › replaces global performance.timeOrigin | 2024-06-13 | `dc9e8e21` |
| `CK-027` | `library/page-clock.spec.ts` | popup › should tick after popup | 2024-06-13 | `752fb2ec` |
| `CK-028` | `library/page-clock.spec.ts` | popup › should tick before popup | 2024-06-13 | `2bdb6879` |
| `CK-029` | `library/page-clock.spec.ts` | popup › should run time before popup | 2024-06-11 | `e30e3edc` |
| `CK-030` | `library/page-clock.spec.ts` | popup › should not run time before popup on pause | 2024-10-07 | `ce20291b` |
| `CK-031` | `library/page-clock.spec.ts` | setFixedTime › does not fake methods | 2024-06-11 | `40383836` |
| `CK-032` | `library/page-clock.spec.ts` | setFixedTime › allows setting time multiple times | 2024-06-11 | `e12cc6f0` |
| `CK-033` | `library/page-clock.spec.ts` | setFixedTime › fixed time is not affected by clock manipulation | 2024-06-11 | `6afeb788` |
| `CK-034` | `library/page-clock.spec.ts` | setFixedTime › allows installing fake timers after settings time | 2024-06-11 | `17559f74` |
| `CK-035` | `library/page-clock.spec.ts` | while running › should progress time | 2026-07-08 | `891e2af9` |
| `CK-036` | `library/page-clock.spec.ts` | while running › should runFor | 2026-07-08 | `7c4c983b` |
| `CK-037` | `library/page-clock.spec.ts` | while running › should fastForward | 2026-07-08 | `cb37887e` |
| `CK-038` | `library/page-clock.spec.ts` | while running › should pause | 2026-07-08 | `8977293f` |
| `CK-039` | `library/page-clock.spec.ts` | while running › should reject an invalid target time with an active requestAnimationFrame loop | 2026-07-16 | `5576da8e` |
| `CK-040` | `library/page-clock.spec.ts` | while running › should pause and fastForward | 2026-07-08 | `8c31089b` |
| `CK-041` | `library/page-clock.spec.ts` | while running › should set system time on pause | 2026-07-08 | `70cc677b` |
| `CK-042` | `library/page-clock.spec.ts` | while on pause › fastForward should not run nested immediate | 2024-06-11 | `4dda6628` |
| `CK-043` | `library/page-clock.spec.ts` | while on pause › runFor should not run nested immediate | 2024-06-11 | `c9a5d3af` |
| `CK-044` | `library/page-clock.spec.ts` | while on pause › runFor should not run nested immediate from microtask | 2024-06-11 | `4e851dd6` |
| `CK-045` | `library/page-clock.spec.ts` | while on pause › should stay paused on the next page when an init script reads the time | 2026-10-08 | `8bc9d5ca` |
| `CK-046` | `library/page-clock.spec.ts` | while on pause › should not advance performance.now() before the first clock call on a new page | 2026-10-08 | `62a2fcb1` |
| `CK-047` | `library/page-clock.spec.ts` | Date.now › check Date.now is an integer | 2024-07-12 | `2f628ab1` |
| `CK-048` | `library/page-clock.spec.ts` | Date.now › check Date.now is an integer (2) | 2024-07-12 | `8e336b02` |
| `CK-049` | `library/page-clock.spec.ts` | Temporal.Now › should follow fixed time | 2026-09-21 | `33511221` |
| `CK-050` | `library/page-clock.spec.ts` | Temporal.Now › should advance with the clock | 2026-09-21 | `450d5595` |
| `CK-051` | `library/page-clock.spec.ts` | Temporal.Now › should use the system time zone by default | 2026-09-21 | `a643dc03` |
| `CK-052` | `library/page-clock.spec.ts` | Temporal.Now › should keep the rest of Temporal intact | 2026-09-21 | `2d7ef755` |
| `CK-053` | `library/page-clock.spec.ts` | AbortSignal.timeout | 2026-02-23 | `a92651cd` |
| `CK-054` | `library/page-clock.spec.ts` | correctly increments Date.now()/performance.now() during blocking execution | 2025-04-07 | `760efd94` |
| `CK-055` | `library/page-clock.frozen.spec.ts` | clock should be frozen | 2024-06-17 | `84dc5e78` |
| `CK-056` | `library/page-clock.frozen.spec.ts` | clock should be realtime | 2024-06-28 | `63770a38` |
| `CK-057` | `library/unit/clock.spec.ts` | setTimeout › throws if no arguments | 2024-06-06 | `a5ee3d4c` |
| `CK-058` | `library/unit/clock.spec.ts` | setTimeout › does not throw if \|undefined\| or \|null\| is passed as a callback | 2024-08-26 | `bdfd3a9a` |
| `CK-059` | `library/unit/clock.spec.ts` | setTimeout › returns numeric id or object with numeric id | 2024-06-06 | `0fac7496` |
| `CK-060` | `library/unit/clock.spec.ts` | setTimeout › returns unique id | 2024-06-06 | `8c476dd7` |
| `CK-061` | `library/unit/clock.spec.ts` | setTimeout › starts id from a large number | 2024-06-06 | `60974dcc` |
| `CK-062` | `library/unit/clock.spec.ts` | setTimeout › sets timers on instance | 2024-06-11 | `4dac75e6` |
| `CK-063` | `library/unit/clock.spec.ts` | setTimeout › parses numeric string times | 2024-06-11 | `412a7bed` |
| `CK-064` | `library/unit/clock.spec.ts` | setTimeout › parses no-numeric string times | 2024-06-11 | `17efa904` |
| `CK-065` | `library/unit/clock.spec.ts` | setTimeout › passes setTimeout parameters | 2024-06-11 | `d8beeae2` |
| `CK-066` | `library/unit/clock.spec.ts` | setTimeout › calls correct timeout on recursive tick | 2024-06-11 | `ae8fc070` |
| `CK-067` | `library/unit/clock.spec.ts` | setTimeout › does not depend on this | 2024-06-11 | `d2d97584` |
| `CK-068` | `library/unit/clock.spec.ts` | setTimeout › is not influenced by forward system clock changes | 2024-06-11 | `b2446c48` |
| `CK-069` | `library/unit/clock.spec.ts` | setTimeout › is not influenced by backward system clock changes | 2024-06-11 | `cc6e59d9` |
| `CK-070` | `library/unit/clock.spec.ts` | setTimeout › use of eval when not in node › evals non-function callbacks | 2024-06-11 | `5fbf8fd8` |
| `CK-071` | `library/unit/clock.spec.ts` | setTimeout › use of eval when not in node › only evals on global scope | 2024-06-11 | `8b10910d` |
| `CK-072` | `library/unit/clock.spec.ts` | runFor › triggers immediately without specified delay | 2024-06-11 | `1310f052` |
| `CK-073` | `library/unit/clock.spec.ts` | runFor › does not trigger without sufficient delay | 2024-06-11 | `2e49c8cd` |
| `CK-074` | `library/unit/clock.spec.ts` | runFor › triggers after sufficient delay | 2024-06-11 | `64628fd7` |
| `CK-075` | `library/unit/clock.spec.ts` | runFor › triggers simultaneous timers | 2024-06-11 | `0dda5072` |
| `CK-076` | `library/unit/clock.spec.ts` | runFor › triggers multiple simultaneous timers | 2024-06-11 | `d6f99359` |
| `CK-077` | `library/unit/clock.spec.ts` | runFor › triggers multiple simultaneous timers with zero callAt | 2024-06-11 | `0fa07815` |
| `CK-078` | `library/unit/clock.spec.ts` | runFor › waits after setTimeout was called | 2024-06-11 | `e75492f1` |
| `CK-079` | `library/unit/clock.spec.ts` | runFor › mini integration test | 2024-06-11 | `90e63272` |
| `CK-080` | `library/unit/clock.spec.ts` | runFor › triggers even when some throw | 2024-06-11 | `25968d3a` |
| `CK-081` | `library/unit/clock.spec.ts` | runFor › calls function with global object or null (strict mode) as this | 2024-06-11 | `45559404` |
| `CK-082` | `library/unit/clock.spec.ts` | runFor › triggers in the order scheduled | 2024-06-11 | `933eed4e` |
| `CK-083` | `library/unit/clock.spec.ts` | runFor › creates updated Date while ticking | 2024-06-11 | `1bfbe140` |
| `CK-084` | `library/unit/clock.spec.ts` | runFor › fires timer in intervals of 13 | 2024-06-11 | `e4beddfb` |
| `CK-085` | `library/unit/clock.spec.ts` | runFor › fires timer in intervals of "13" | 2024-06-11 | `63b9c1e7` |
| `CK-086` | `library/unit/clock.spec.ts` | runFor › fires timers in correct order | 2024-06-11 | `7f2b6210` |
| `CK-087` | `library/unit/clock.spec.ts` | runFor › triggers timeouts and intervals in the order scheduled | 2024-06-11 | `690e1911` |
| `CK-088` | `library/unit/clock.spec.ts` | runFor › does not fire canceled intervals | 2024-06-11 | `39a6ddfc` |
| `CK-089` | `library/unit/clock.spec.ts` | runFor › throws for negative minutes | 2024-06-11 | `dd4dacd6` |
| `CK-090` | `library/unit/clock.spec.ts` | runFor › fires nested setTimeout calls properly | 2024-06-11 | `0d4cb4e6` |
| `CK-091` | `library/unit/clock.spec.ts` | runFor › does not silently catch errors | 2024-06-11 | `43c4355b` |
| `CK-092` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes | 2024-06-11 | `0c2d043a` |
| `CK-093` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes 2 | 2024-06-11 | `b3f68538` |
| `CK-094` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes when an error is thrown | 2024-06-11 | `108c2a98` |
| `CK-095` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes when an error is thrown 2 | 2024-06-11 | `328c67a2` |
| `CK-096` | `library/unit/clock.spec.ts` | runFor › throws on negative ticks | 2024-06-11 | `639ffafc` |
| `CK-097` | `library/unit/clock.spec.ts` | runFor › creates updated Date while ticking promises | 2024-06-11 | `b9c4e1c4` |
| `CK-098` | `library/unit/clock.spec.ts` | runFor › fires promise timers in correct order | 2024-06-11 | `bd610c05` |
| `CK-099` | `library/unit/clock.spec.ts` | runFor › does not fire intervals canceled in a promise | 2024-06-11 | `621d73e5` |
| `CK-100` | `library/unit/clock.spec.ts` | runFor › fires nested setTimeout calls in user-created promises properly | 2024-06-11 | `3fa06b8a` |
| `CK-101` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes in promises | 2024-06-11 | `5bd57c5b` |
| `CK-102` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises | 2024-06-11 | `1e2f0142` |
| `CK-103` | `library/unit/clock.spec.ts` | runFor › should settle chained user-created promises | 2024-06-11 | `ed4d665d` |
| `CK-104` | `library/unit/clock.spec.ts` | runFor › should settle multiple user-created promises | 2024-06-11 | `b210a115` |
| `CK-105` | `library/unit/clock.spec.ts` | runFor › should settle nested user-created promises | 2024-06-11 | `204154c7` |
| `CK-106` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises even if some throw | 2024-06-11 | `fd28a983` |
| `CK-107` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises before calling more timeouts | 2024-06-11 | `80c9ea99` |
| `CK-108` | `library/unit/clock.spec.ts` | runFor › should settle local promises before calling timeouts | 2024-06-11 | `86aee1df` |
| `CK-109` | `library/unit/clock.spec.ts` | runFor › should settle local nested promises before calling timeouts | 2024-06-11 | `2cedf613` |
| `CK-110` | `library/unit/clock.spec.ts` | runFor › does not rewind back in time | 2025-10-14 | `22609e6c` |
| `CK-111` | `library/unit/clock.spec.ts` | clearTimeout › removes timeout | 2024-06-11 | `a27709ae` |
| `CK-112` | `library/unit/clock.spec.ts` | clearTimeout › removes interval | 2024-06-11 | `a450f4b8` |
| `CK-113` | `library/unit/clock.spec.ts` | clearTimeout › removes interval with undefined interval | 2024-06-11 | `7d0bf990` |
| `CK-114` | `library/unit/clock.spec.ts` | clearTimeout › ignores null argument | 2024-06-06 | `22bdd2c0` |
| `CK-115` | `library/unit/clock.spec.ts` | setInterval › throws if no arguments | 2024-06-06 | `5fcc3aac` |
| `CK-116` | `library/unit/clock.spec.ts` | setInterval › does not throw if \|undefined\| or \|null\| is passed as a callback | 2024-08-26 | `19f28fb4` |
| `CK-117` | `library/unit/clock.spec.ts` | setInterval › returns numeric id or object with numeric id | 2024-06-06 | `86ea5f53` |
| `CK-118` | `library/unit/clock.spec.ts` | setInterval › returns unique id | 2024-06-06 | `ddd747d5` |
| `CK-119` | `library/unit/clock.spec.ts` | setInterval › schedules recurring timeout | 2024-06-11 | `91e1b7d2` |
| `CK-120` | `library/unit/clock.spec.ts` | setInterval › is not influenced by forward system clock changes | 2024-06-11 | `3232b308` |
| `CK-121` | `library/unit/clock.spec.ts` | setInterval › is not influenced by backward system clock changes | 2024-06-11 | `c97ff798` |
| `CK-122` | `library/unit/clock.spec.ts` | setInterval › does not schedule recurring timeout when cleared | 2024-06-11 | `032274a8` |
| `CK-123` | `library/unit/clock.spec.ts` | setInterval › passes setTimeout parameters | 2024-06-11 | `542be139` |
| `CK-124` | `library/unit/clock.spec.ts` | clearInterval › removes interval | 2024-06-11 | `a1a549bf` |
| `CK-125` | `library/unit/clock.spec.ts` | clearInterval › removes interval with undefined interval | 2024-06-11 | `c18d3581` |
| `CK-126` | `library/unit/clock.spec.ts` | clearInterval › removes timeout | 2024-06-11 | `45330eb5` |
| `CK-127` | `library/unit/clock.spec.ts` | clearInterval › ignores null argument | 2024-06-06 | `6e14666a` |
| `CK-128` | `library/unit/clock.spec.ts` | date › provides date constructor | 2024-06-06 | `19d2bb2b` |
| `CK-129` | `library/unit/clock.spec.ts` | date › creates real Date objects | 2024-06-06 | `ca31c29a` |
| `CK-130` | `library/unit/clock.spec.ts` | date › returns date as string when called as function | 2024-06-06 | `8b6a6c2d` |
| `CK-131` | `library/unit/clock.spec.ts` | date › creates Date objects representing clock time | 2024-06-06 | `e2294cfc` |
| `CK-132` | `library/unit/clock.spec.ts` | date › returns date as string representing clock time | 2024-06-06 | `5a39bec7` |
| `CK-133` | `library/unit/clock.spec.ts` | date › listens to ticking clock | 2024-06-11 | `122158e9` |
| `CK-134` | `library/unit/clock.spec.ts` | date › listens to system clock changes | 2024-06-11 | `a47bc07c` |
| `CK-135` | `library/unit/clock.spec.ts` | date › creates regular date when passing timestamp | 2024-06-06 | `47c34270` |
| `CK-136` | `library/unit/clock.spec.ts` | date › creates regular date when passing a date as string | 2024-06-06 | `fd2318ca` |
| `CK-137` | `library/unit/clock.spec.ts` | date › creates regular date when passing a date as RFC 2822 string | 2024-06-06 | `df6ee535` |
| `CK-138` | `library/unit/clock.spec.ts` | date › creates regular date when passing year, month | 2024-06-06 | `a5a47894` |
| `CK-139` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d | 2024-06-06 | `43d7b480` |
| `CK-140` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h | 2024-06-06 | `07be8ef2` |
| `CK-141` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m | 2024-06-06 | `2ce7d099` |
| `CK-142` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m, s | 2024-06-06 | `e9657883` |
| `CK-143` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m, s, ms | 2024-06-06 | `4026ca2b` |
| `CK-144` | `library/unit/clock.spec.ts` | date › returns date as string when calling with arguments | 2024-06-06 | `91c2c096` |
| `CK-145` | `library/unit/clock.spec.ts` | date › returns date as string when calling with timestamp | 2024-06-06 | `02f29a20` |
| `CK-146` | `library/unit/clock.spec.ts` | date › mirrors native Date.prototype | 2024-06-06 | `4c344f95` |
| `CK-147` | `library/unit/clock.spec.ts` | date › supports now method if present | 2024-06-06 | `9836f99e` |
| `CK-148` | `library/unit/clock.spec.ts` | date › returns clock.now() | 2024-06-06 | `de460af1` |
| `CK-149` | `library/unit/clock.spec.ts` | date › mirrors parse method | 2024-06-06 | `e12b4def` |
| `CK-150` | `library/unit/clock.spec.ts` | date › mirrors UTC method | 2024-06-06 | `51504457` |
| `CK-151` | `library/unit/clock.spec.ts` | date › mirrors toUTCString method | 2024-06-06 | `11bac835` |
| `CK-152` | `library/unit/clock.spec.ts` | stubTimers › returns clock object | 2024-06-11 | `1cd3c4c8` |
| `CK-153` | `library/unit/clock.spec.ts` | stubTimers › takes an object parameter | 2024-06-11 | `a7b8f69a` |
| `CK-154` | `library/unit/clock.spec.ts` | stubTimers › sets initial timestamp | 2024-06-11 | `0db6bacb` |
| `CK-155` | `library/unit/clock.spec.ts` | stubTimers › replaces global setTimeout | 2024-06-11 | `3eafcbe8` |
| `CK-156` | `library/unit/clock.spec.ts` | stubTimers › global fake setTimeout should return id | 2024-06-07 | `7c398451` |
| `CK-157` | `library/unit/clock.spec.ts` | stubTimers › replaces global clearTimeout | 2024-06-11 | `950f8033` |
| `CK-158` | `library/unit/clock.spec.ts` | stubTimers › replaces global setInterval | 2024-06-11 | `87bd26ca` |
| `CK-159` | `library/unit/clock.spec.ts` | stubTimers › replaces global clearInterval | 2024-06-11 | `ffc22509` |
| `CK-160` | `library/unit/clock.spec.ts` | stubTimers › replaces global performance.now | 2024-06-11 | `7445e606` |
| `CK-161` | `library/unit/clock.spec.ts` | stubTimers › replace Event.prototype.timeStamp | 2024-08-02 | `5c856d74` |
| `CK-162` | `library/unit/clock.spec.ts` | stubTimers › uninstalls global performance.now | 2024-06-07 | `d091e9f3` |
| `CK-163` | `library/unit/clock.spec.ts` | stubTimers › should let performance.mark still be callable after install() (#136) | 2024-06-07 | `9ed83ac8` |
| `CK-164` | `library/unit/clock.spec.ts` | stubTimers › should not alter the global performance properties and methods | 2024-06-07 | `165be4f6` |
| `CK-165` | `library/unit/clock.spec.ts` | stubTimers › should replace the getEntries, getEntriesByX methods with noops that return \[\] | 2024-06-07 | `6ac19a55` |
| `CK-166` | `library/unit/clock.spec.ts` | stubTimers › should return PerformanceEntry-like objects from performance.mark and performance.measure | 2026-03-24 | `d1eb62c0` |
| `CK-167` | `library/unit/clock.spec.ts` | stubTimers › restores global property on uninstall if it was inherited onto the global object | 2025-03-25 | `b9bf41f1` |
| `CK-168` | `library/unit/clock.spec.ts` | stubTimers › fakes Date constructor | 2024-06-06 | `15a31b55` |
| `CK-169` | `library/unit/clock.spec.ts` | stubTimers › fake Date constructor should mirror Date's properties | 2024-06-07 | `97a3db46` |
| `CK-170` | `library/unit/clock.spec.ts` | stubTimers › mirrors custom Date properties | 2024-06-07 | `73490620` |
| `CK-171` | `library/unit/clock.spec.ts` | stubTimers › uninstalls Date constructor | 2024-06-06 | `6e464038` |
| `CK-172` | `library/unit/clock.spec.ts` | stubTimers › fakes provided methods | 2024-06-06 | `941991b7` |
| `CK-173` | `library/unit/clock.spec.ts` | stubTimers › resets faked methods | 2024-06-11 | `8ce99385` |
| `CK-174` | `library/unit/clock.spec.ts` | stubTimers › does not fake methods not provided | 2024-06-06 | `9df9d42f` |
| `CK-175` | `library/unit/clock.spec.ts` | requestAnimationFrame › throws if no arguments | 2024-06-06 | `93d1a515` |
| `CK-176` | `library/unit/clock.spec.ts` | requestAnimationFrame › returns numeric id or object with numeric id | 2024-06-06 | `31cea094` |
| `CK-177` | `library/unit/clock.spec.ts` | requestAnimationFrame › returns unique id | 2024-06-06 | `7f854505` |
| `CK-178` | `library/unit/clock.spec.ts` | requestAnimationFrame › should run every 16ms | 2024-06-11 | `41d709a3` |
| `CK-179` | `library/unit/clock.spec.ts` | requestAnimationFrame › should be called with performance.now() when available | 2024-06-11 | `1e618ab6` |
| `CK-180` | `library/unit/clock.spec.ts` | requestAnimationFrame › should be called with performance.now() even when performance unavailable | 2024-06-11 | `052517a3` |
| `CK-181` | `library/unit/clock.spec.ts` | requestAnimationFrame › should call callback once | 2024-06-11 | `84313550` |
| `CK-182` | `library/unit/clock.spec.ts` | requestAnimationFrame › should schedule two callbacks before the next frame at the same time | 2024-06-11 | `f1e7aabc` |
| `CK-183` | `library/unit/clock.spec.ts` | requestAnimationFrame › should properly schedule callback for 3rd frame | 2024-06-11 | `6918577f` |
| `CK-184` | `library/unit/clock.spec.ts` | requestAnimationFrame › should schedule for next frame if on current frame | 2024-06-11 | `9bea22cd` |
| `CK-185` | `library/unit/clock.spec.ts` | cancelAnimationFrame › removes animation frame | 2024-06-11 | `2ad970a0` |
| `CK-186` | `library/unit/clock.spec.ts` | cancelAnimationFrame › does not remove timeout | 2024-06-11 | `4d8eee09` |
| `CK-187` | `library/unit/clock.spec.ts` | cancelAnimationFrame › does not remove interval | 2024-06-11 | `d72ffaeb` |
| `CK-188` | `library/unit/clock.spec.ts` | cancelAnimationFrame › ignores null argument | 2024-06-06 | `e3f9a953` |
| `CK-189` | `library/unit/clock.spec.ts` | fastForward › ignores timers which wouldn't be run | 2024-06-11 | `f81cd922` |
| `CK-190` | `library/unit/clock.spec.ts` | fastForward › pushes back execution time for skipped timers | 2024-06-11 | `8c2548b3` |
| `CK-191` | `library/unit/clock.spec.ts` | fastForward › handles multiple pending timers and types | 2024-06-11 | `32db7520` |
| `CK-192` | `library/unit/clock.spec.ts` | fastForward › does not rewind back in time | 2025-10-09 | `7da46a03` |
| `CK-193` | `library/unit/clock.spec.ts` | fastForward › error does not break the clock | 2025-10-09 | `bf64bcf6` |
| `CK-194` | `library/unit/clock.spec.ts` | fastForward › error does not pause forever | 2025-10-14 | `7f202a97` |
| `CK-195` | `library/unit/clock.spec.ts` | pauseAt › pause at target time | 2024-06-13 | `a7f6f44f` |
| `CK-196` | `library/unit/clock.spec.ts` | pauseAt › fire target timers | 2024-06-13 | `74eee0b1` |
| `CK-197` | `library/unit/clock.spec.ts` | pauseAt › returns consumed clicks | 2024-06-13 | `163b7db0` |
| `CK-198` | `library/unit/clock.spec.ts` | performance.now() › should start at 0 | 2024-06-06 | `ec09af03` |
| `CK-199` | `library/unit/clock.spec.ts` | performance.now() › should run along with clock.tick | 2024-06-11 | `c11b3ca8` |
| `CK-200` | `library/unit/clock.spec.ts` | performance.now() › should listen to multiple ticks in performance.now | 2024-06-11 | `0d2d4d19` |
| `CK-201` | `library/unit/clock.spec.ts` | performance.now() › should run with ticks with timers set | 2024-06-11 | `68f54780` |
| `CK-202` | `library/unit/clock.spec.ts` | requestIdleCallback › throws if no arguments | 2024-06-06 | `3b4f0d5e` |
| `CK-203` | `library/unit/clock.spec.ts` | requestIdleCallback › returns numeric id | 2024-06-06 | `58cf3af8` |
| `CK-204` | `library/unit/clock.spec.ts` | requestIdleCallback › returns unique id | 2024-06-06 | `283eae18` |
| `CK-205` | `library/unit/clock.spec.ts` | requestIdleCallback › runs after all timers | 2024-06-11 | `267f1035` |
| `CK-206` | `library/unit/clock.spec.ts` | requestIdleCallback › runs no later than timeout option even if there are any timers | 2024-06-11 | `f83b8e60` |
| `CK-207` | `library/unit/clock.spec.ts` | requestIdleCallback › doesn't runs if there are any timers and no timeout option | 2024-06-11 | `f790fe9c` |
| `CK-208` | `library/unit/clock.spec.ts` | cancelIdleCallback › removes idle callback | 2024-06-11 | `3da54509` |
| `CK-209` | `library/unit/clock.spec.ts` | Intl API › Executes formatRange like normal | 2024-06-06 | `afbb0e0d` |
| `CK-210` | `library/unit/clock.spec.ts` | Intl API › Executes formatRangeToParts like normal | 2024-06-06 | `5a87b323` |
| `CK-211` | `library/unit/clock.spec.ts` | Intl API › Executes resolvedOptions like normal | 2024-06-06 | `5ff0d250` |
| `CK-212` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns true when passed a timestamp argument that is first of the month | 2024-06-06 | `9a9ea8a1` |
| `CK-213` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns false when passed a timestamp argument that is not first of the month | 2024-06-06 | `e287b611` |
| `CK-214` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns true when passed no timestamp and system time is first of the month | 2026-10-15 | `e8cabd55` |
| `CK-215` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns false when passed no timestamp and system time is not first of the month | 2024-06-11 | `6dc36e45` |
| `CK-216` | `library/unit/clock.spec.ts` | Intl API › Executes supportedLocalesOf like normal | 2024-06-06 | `0e21dd62` |
| `CK-217` | `library/unit/clock.spec.ts` | Intl API › Creates a RelativeTimeFormat like normal | 2024-06-06 | `0e057997` |
| `CK-218` | `library/unit/clock.spec.ts` | works with slow setTimeout in busy embedder | 2024-06-11 | `a7fc2567` |
| `CK-219` | `library/unit/clock.spec.ts` | works with slow setTimeout in busy embedder when not paused | 2024-06-11 | `c9c764ed` |

### CL — Click

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CL-001` | `page/page-click.spec.ts` | should click the button @smoke | 2022-03-10 | `ee0b1b4e` |
| `CL-002` | `page/page-click.spec.ts` | should click button inside frameset | 2022-11-19 | `d86a212e` |
| `CL-003` | `page/page-click.spec.ts` | should issue clicks in parallel in page and popup | 2023-02-06 | `96dd4c6b` |
| `CL-004` | `page/page-click.spec.ts` | should click svg | 2025-04-23 | `20b66148` |
| `CL-005` | `page/page-click.spec.ts` | should click the button if window.Node is removed | 2020-08-07 | `6ce15613` |
| `CL-006` | `page/page-click.spec.ts` | should click on a span with an inline element inside | 2025-04-23 | `5df85836` |
| `CL-007` | `page/page-click.spec.ts` | should click the aligned 1x1 div | 2024-11-07 | `da1632a7` |
| `CL-008` | `page/page-click.spec.ts` | should click the half-aligned 1x1 div | 2024-11-07 | `893d6e26` |
| `CL-009` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v1 | 2024-11-07 | `0533f208` |
| `CL-010` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v2 | 2024-11-07 | `f3dd9127` |
| `CL-011` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v3 | 2024-11-07 | `5c8f4ba4` |
| `CL-012` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v4 | 2024-11-07 | `36f8f51c` |
| `CL-013` | `page/page-click.spec.ts` | should click the button after navigation  | 2020-08-07 | `ee1815c3` |
| `CL-014` | `page/page-click.spec.ts` | should click the button after a cross origin navigation  | 2020-08-07 | `e178a044` |
| `CL-015` | `page/page-click.spec.ts` | should click when one of inline box children is outside of viewport | 2025-04-23 | `95981174` |
| `CL-016` | `page/page-click.spec.ts` | should select the text by triple clicking | 2020-08-03 | `2037fd0c` |
| `CL-017` | `page/page-click.spec.ts` | should click offscreen buttons | 2023-03-10 | `18965fb8` |
| `CL-018` | `page/page-click.spec.ts` | should waitFor visible when already visible | 2020-08-07 | `ad7a1089` |
| `CL-019` | `page/page-click.spec.ts` | should not wait with force | 2020-08-07 | `7fb009ee` |
| `CL-020` | `page/page-click.spec.ts` | should waitFor display:none to be gone | 2020-08-07 | `d3959df0` |
| `CL-021` | `page/page-click.spec.ts` | should waitFor visibility:hidden to be gone | 2020-08-07 | `eda235a0` |
| `CL-022` | `page/page-click.spec.ts` | should waitFor visible when parent is hidden | 2020-08-07 | `f553edbc` |
| `CL-023` | `page/page-click.spec.ts` | should click wrapped links | 2020-08-07 | `41934e6c` |
| `CL-024` | `page/page-click.spec.ts` | should click on checkbox input and toggle | 2025-11-24 | `7163124a` |
| `CL-025` | `page/page-click.spec.ts` | should click on checkbox label and toggle | 2020-08-07 | `583f3874` |
| `CL-026` | `page/page-click.spec.ts` | should scroll and click the button | 2020-08-03 | `16995804` |
| `CL-027` | `page/page-click.spec.ts` | should scroll and click the button with smooth scroll behavior | 2026-02-02 | `561eb655` |
| `CL-028` | `page/page-click.spec.ts` | should double click the button | 2020-08-07 | `7956816d` |
| `CL-029` | `page/page-click.spec.ts` | should click a partially obscured button | 2020-08-07 | `62b55980` |
| `CL-030` | `page/page-click.spec.ts` | should click a rotated button | 2020-08-07 | `5114e8fc` |
| `CL-031` | `page/page-click.spec.ts` | should fire contextmenu event on right click | 2020-08-03 | `542e6396` |
| `CL-032` | `page/page-click.spec.ts` | should click links which cause navigation | 2020-08-03 | `b7ccee6b` |
| `CL-033` | `page/page-click.spec.ts` | should not wait for navigation after clicking a link answered with 204 | 2026-10-12 | `5853b46e` |
| `CL-034` | `page/page-click.spec.ts` | should click the button inside an iframe | 2020-09-18 | `a4fb513a` |
| `CL-035` | `page/page-click.spec.ts` | should click the button with fixed position inside an iframe | 2024-10-04 | `8820aa50` |
| `CL-036` | `page/page-click.spec.ts` | should click the button behind sticky header | 2020-12-16 | `44966514` |
| `CL-037` | `page/page-click.spec.ts` | should click the button behind position:absolute header | 2025-06-18 | `36b814a4` |
| `CL-038` | `page/page-click.spec.ts` | should click the button with px border with offset | 2026-03-11 | `d106c0fd` |
| `CL-039` | `page/page-click.spec.ts` | should click the button with em border with offset | 2026-03-11 | `d65ab3f5` |
| `CL-040` | `page/page-click.spec.ts` | should click a very large button with offset | 2026-03-11 | `a45e15e4` |
| `CL-041` | `page/page-click.spec.ts` | should click a button in scrolling container with offset | 2026-03-11 | `714b088b` |
| `CL-042` | `page/page-click.spec.ts` | should wait for stable position | 2024-05-31 | `dc215aab` |
| `CL-043` | `page/page-click.spec.ts` | should wait for becoming hit target | 2020-08-07 | `954e372c` |
| `CL-044` | `page/page-click.spec.ts` | should wait for becoming hit target with trial run | 2021-04-21 | `28fa13af` |
| `CL-045` | `page/page-click.spec.ts` | trial run should work with short timeout | 2022-06-30 | `889eaa7b` |
| `CL-046` | `page/page-click.spec.ts` | trial run should not click | 2021-04-21 | `b62acf1f` |
| `CL-047` | `page/page-click.spec.ts` | trial run should not double click | 2021-04-21 | `b3d8b8a4` |
| `CL-048` | `page/page-click.spec.ts` | should fail when obscured and not waiting for hit target | 2020-08-07 | `6ce9df9d` |
| `CL-049` | `page/page-click.spec.ts` | should wait for button to be enabled | 2025-04-23 | `72afd0f0` |
| `CL-050` | `page/page-click.spec.ts` | should wait for element to become non-inert | 2026-10-08 | `19dd31b8` |
| `CL-051` | `page/page-click.spec.ts` | should wait for modal dialog to close | 2026-10-08 | `a19d9827` |
| `CL-052` | `page/page-click.spec.ts` | should wait for input to be enabled | 2025-04-23 | `7bf8575a` |
| `CL-053` | `page/page-click.spec.ts` | should wait for select to be enabled | 2022-06-09 | `16f396af` |
| `CL-054` | `page/page-click.spec.ts` | should click disabled div | 2025-04-23 | `326c16f7` |
| `CL-055` | `page/page-click.spec.ts` | should wait for BUTTON to be clickable when it has pointer-events:none | 2025-04-23 | `09923f37` |
| `CL-056` | `page/page-click.spec.ts` | should wait for LABEL to be clickable when it has pointer-events:none | 2025-04-23 | `3cc91300` |
| `CL-057` | `page/page-click.spec.ts` | should update modifiers correctly | 2020-08-07 | `300011e3` |
| `CL-058` | `page/page-click.spec.ts` | should click an offscreen element when scroll-behavior is smooth | 2020-08-03 | `59136c62` |
| `CL-059` | `page/page-click.spec.ts` | should report nice error when element is detached and force-clicked | 2020-08-07 | `4f237349` |
| `CL-060` | `page/page-click.spec.ts` | should fail when element detaches after animation | 2020-08-07 | `452ae831` |
| `CL-061` | `page/page-click.spec.ts` | should retry when element detaches after animation | 2020-08-07 | `9a5c79ee` |
| `CL-062` | `page/page-click.spec.ts` | should retry when element is animating from outside the viewport | 2021-03-18 | `d9341c6b` |
| `CL-063` | `page/page-click.spec.ts` | should fail when element is animating from outside the viewport with force | 2021-03-18 | `98f573cb` |
| `CL-064` | `page/page-click.spec.ts` | should dispatch microtasks in order | 2021-03-18 | `6bb70e5c` |
| `CL-065` | `page/page-click.spec.ts` | should click the button when window.innerWidth is corrupted | 2020-08-07 | `dac0d810` |
| `CL-066` | `page/page-click.spec.ts` | should click zero-sized input by label | 2021-03-18 | `12056a43` |
| `CL-067` | `page/page-click.spec.ts` | should not throw protocol error when navigating during the click | 2021-09-18 | `97f5c4ef` |
| `CL-068` | `page/page-click.spec.ts` | should retry when navigating during the click | 2022-08-03 | `15f34f0d` |
| `CL-069` | `page/page-click.spec.ts` | should not hang when frame is detached | 2024-01-17 | `1f7356ef` |
| `CL-070` | `page/page-click.spec.ts` | should climb dom for inner label with pointer-events:none | 2025-04-23 | `d601c7c8` |
| `CL-071` | `page/page-click.spec.ts` | should climb up to \[role=button\] | 2025-04-23 | `f266d721` |
| `CL-072` | `page/page-click.spec.ts` | should climb up to a anchor | 2025-04-23 | `6e32292b` |
| `CL-073` | `page/page-click.spec.ts` | should climb up to a \[role=link\] | 2025-04-23 | `7449157b` |
| `CL-074` | `page/page-click.spec.ts` | should click in an iframe with border | 2022-11-19 | `0c486f62` |
| `CL-075` | `page/page-click.spec.ts` | should click in an iframe with border 2 | 2022-11-19 | `02847c08` |
| `CL-076` | `page/page-click.spec.ts` | should not retain removed iframe after clicking inside it | 2026-09-15 | `b8d76dc7` |
| `CL-077` | `page/page-click.spec.ts` | should click in a transformed iframe | 2022-11-19 | `6277b8c6` |
| `CL-078` | `page/page-click.spec.ts` | should click a button that is overlaid by a permission popup | 2026-01-22 | `0220c867` |
| `CL-079` | `page/page-click.spec.ts` | should click in a transformed iframe with force | 2022-11-19 | `ebf0f894` |
| `CL-080` | `page/page-click.spec.ts` | should click in a nested transformed iframe | 2022-11-19 | `264b8b5b` |
| `CL-081` | `page/page-click.spec.ts` | ensure events are dispatched in the individual tasks | 2025-03-25 | `ed3c2211` |
| `CL-082` | `page/page-click.spec.ts` | should click if opened select covers the button | 2025-04-23 | `e844ca6b` |
| `CL-083` | `page/page-click.spec.ts` | should fire contextmenu event on right click in correct order | 2026-07-02 | `e0dae3c1` |
| `CL-084` | `page/page-click.spec.ts` | should click after a right click | 2026-07-02 | `c0e8230f` |
| `CL-085` | `page/page-click.spec.ts` | should set PointerEvent.pressure on pointerdown | 2026-06-12 | `a6f125c4` |
| `CL-086` | `page/page-click.spec.ts` | should set PointerEvent.pressure on pointermove | 2026-06-12 | `abf2e2f3` |
| `CL-087` | `page/page-click.spec.ts` | should click into shadow root with slotted div | 2025-10-10 | `d010decb` |
| `CL-088` | `page/page-click.spec.ts` | should click shadow root button | 2025-10-10 | `90043558` |
| `CL-089` | `page/page-click.spec.ts` | should click with tweened mouse movement | 2025-10-31 | `0940804b` |
| `CL-090` | `page/page-click.spec.ts` | should abort via signal | 2026-07-14 | `16af2948` |
| `CL-091` | `page/page-click.spec.ts` | should throw an Error when aborted in-flight with a string reason | 2026-07-14 | `b8e08846` |
| `CL-092` | `page/page-click.spec.ts` | should abort via already-aborted signal | 2026-06-30 | `a8c6b8ce` |
| `CL-093` | `page/page-click.spec.ts` | should throw an Error when aborted via an already-aborted signal with a string reason | 2026-06-30 | `cf027600` |
| `CL-094` | `page/page-click-scroll.spec.ts` | should not hit scroll bar | 2022-08-02 | `6309c473` |
| `CL-095` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents | 2022-08-08 | `70f41374` |
| `CL-096` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents with a child | 2022-08-08 | `922f98f2` |
| `CL-097` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents with position | 2022-08-08 | `1b70c663` |
| `CL-098` | `page/page-click-scroll.spec.ts` | should not crash when force-clicking hidden input | 2024-10-07 | `0d68a529` |
| `CL-099` | `page/page-click-scroll.spec.ts` | should scroll into view span element | 2023-03-07 | `a7ae5da1` |
| `CL-100` | `page/page-click-scroll.spec.ts` | should scroll into view element in iframe | 2023-09-30 | `5f72bba3` |
| `CL-101` | `page/page-click-scroll.spec.ts` | should not scroll the page when scroll is "none" | 2026-06-23 | `37a96a27` |
| `CL-102` | `page/page-click-scroll.spec.ts` | should click in-viewport element when scroll is "none" | 2026-06-23 | `cc7b96c9` |
| `CL-103` | `page/page-click-scroll.spec.ts` | should not scroll nested container when scroll is "none" | 2026-06-23 | `23de99bf` |
| `CL-104` | `page/page-click-scroll.spec.ts` | should not scroll on hover when scroll is "none" | 2026-06-23 | `5f3b250b` |
| `CL-105` | `page/page-click-scroll.spec.ts` | should scroll instantly on retry when scroll-behavior is smooth | 2026-09-15 | `7477825c` |
| `CL-106` | `page/page-click-react.spec.ts` | should timeout when click opens alert | 2020-08-07 | `35e9f51d` |
| `CL-107` | `page/page-click-react.spec.ts` | should not retarget when element changes on hover | 2020-08-07 | `49729304` |
| `CL-108` | `page/page-click-react.spec.ts` | should not retarget when element is recycled on hover | 2020-08-07 | `34a0fe52` |
| `CL-109` | `page/page-click-during-navigation.spec.ts` | should not fail with internal error upon navigation | 2022-01-07 | `1b9cf830` |
| `CL-110` | `page/page-click-timeout-1.spec.ts` | should avoid side effects after timeout | 2021-04-02 | `9a1fbd8e` |
| `CL-111` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for button to be enabled | 2024-01-17 | `81b704e6` |
| `CL-112` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for inert element to become non-inert | 2026-10-08 | `a96e6971` |
| `CL-113` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for element outside of a modal dialog | 2026-10-08 | `a62f82cd` |
| `CL-114` | `page/page-click-timeout-2.spec.ts` | should timeout waiting for display:none to be gone | 2024-01-17 | `3feb3366` |
| `CL-115` | `page/page-click-timeout-2.spec.ts` | should timeout waiting for visibility:hidden to be gone | 2024-01-17 | `abb9d921` |
| `CL-116` | `page/page-click-timeout-3.spec.ts` | should fail when element jumps during hit testing | 2021-04-02 | `6f6e6cd0` |
| `CL-117` | `page/page-click-timeout-3.spec.ts` | should timeout waiting for hit target | 2020-09-29 | `37889a36` |
| `CL-118` | `page/page-click-timeout-3.spec.ts` | should still click when force but hit target is obscured | 2021-11-06 | `0433ce6a` |
| `CL-119` | `page/page-click-timeout-3.spec.ts` | should report wrong hit target subtree | 2020-08-14 | `6bce0265` |
| `CL-120` | `page/page-click-timeout-4.spec.ts` | should timeout waiting for stable position | 2024-05-31 | `d01378ae` |
| `CL-121` | `page/page-click-timeout-4.spec.ts` | should click for the second time after first timeout | 2021-11-06 | `ec003a15` |
| `CL-122` | `page/page-click-timeout-4.spec.ts` | should fail to click the button behind a large header after scrolling around | 2026-01-22 | `7936c462` |

### CM — Console messages

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CM-001` | `page/page-event-console.spec.ts` | should work @smoke | 2026-07-17 | `4d3bc83f` |
| `CM-002` | `page/page-event-console.spec.ts` | should emit same log twice | 2024-02-27 | `c2c8dc67` |
| `CM-003` | `page/page-event-console.spec.ts` | should use text() for inspection | 2020-08-28 | `e4420382` |
| `CM-004` | `page/page-event-console.spec.ts` | should work for different console API calls | 2021-11-29 | `94bdfe74` |
| `CM-005` | `page/page-event-console.spec.ts` | should format the message correctly with time/timeLog/timeEnd | 2026-04-29 | `d8fdb969` |
| `CM-006` | `page/page-event-console.spec.ts` | should not fail for window object | 2026-07-17 | `07847c95` |
| `CM-007` | `page/page-event-console.spec.ts` | should not fail for object that can't be coerced to a primitive | 2026-09-11 | `6099956d` |
| `CM-008` | `page/page-event-console.spec.ts` | should trigger correct Log | 2025-09-11 | `bd6c1d57` |
| `CM-009` | `page/page-event-console.spec.ts` | should have location for console API calls | 2026-05-04 | `9b03082a` |
| `CM-010` | `page/page-event-console.spec.ts` | should not throw when there are console messages in detached iframes | 2020-08-28 | `1f3f6fdd` |
| `CM-011` | `page/page-event-console.spec.ts` | should use object previews for arrays and objects | 2026-07-17 | `086aa904` |
| `CM-012` | `page/page-event-console.spec.ts` | should use object previews for errors | 2025-12-15 | `5d2c12c1` |
| `CM-013` | `page/page-event-console.spec.ts` | do not update console count on unhandled rejections | 2023-06-02 | `f0e888a9` |
| `CM-014` | `page/page-event-console.spec.ts` | should have timestamp | 2026-05-12 | `729cce50` |
| `CM-015` | `page/page-event-console.spec.ts` | should have increasing timestamps | 2026-02-04 | `49087cbf` |
| `CM-016` | `page/page-event-console.spec.ts` | should have timestamp in consoleMessages | 2026-05-12 | `a420cf3d` |
| `CM-017` | `page/page-event-console.spec.ts` | consoleMessages should work | 2025-09-18 | `29e440a7` |
| `CM-018` | `page/page-event-console.spec.ts` | clearConsoleMessages should work | 2026-02-12 | `f8963a79` |
| `CM-019` | `page/page-event-console.spec.ts` | consoleMessages since-navigation filter should work | 2026-03-23 | `51b71111` |
| `CM-020` | `page/page-event-console.spec.ts` | pageErrors since-navigation filter should work | 2026-03-23 | `cf78e802` |

### CN — Channels

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CN-001` | `library/channels.spec.ts` | should scope context handles | 2026-08-11 | `a9c9695f` |
| `CN-002` | `library/channels.spec.ts` | should scope CDPSession handles | 2026-05-09 | `7a12e2cc` |
| `CN-003` | `library/channels.spec.ts` | should scope browser handles | 2026-08-11 | `c3531978` |
| `CN-004` | `library/channels.spec.ts` | should not generate dispatchers for subresources w/o listeners | 2026-08-11 | `60e38e49` |
| `CN-005` | `library/channels.spec.ts` | should work with the domain module | 2026-06-01 | `f889ae80` |
| `CN-006` | `library/channels.spec.ts` | exposeFunction should not leak | 2026-08-11 | `c7b0123d` |

### CO — Cookies

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CO-001` | `library/browsercontext-cookies.spec.ts` | should return no cookies in pristine browser context | 2020-08-03 | `9266810f` |
| `CO-002` | `library/browsercontext-cookies.spec.ts` | should get a cookie @smoke | 2025-07-01 | `881f14a8` |
| `CO-003` | `library/browsercontext-cookies.spec.ts` | should get a non-session cookie | 2025-07-01 | `4e385c89` |
| `CO-004` | `library/browsercontext-cookies.spec.ts` | should allow adding cookies with \>400 days expiration | 2025-10-22 | `49270525` |
| `CO-005` | `library/browsercontext-cookies.spec.ts` | should properly report httpOnly cookie | 2020-08-03 | `b58c0194` |
| `CO-006` | `library/browsercontext-cookies.spec.ts` | should properly report "Strict" sameSite cookie | 2025-09-09 | `a3f9164a` |
| `CO-007` | `library/browsercontext-cookies.spec.ts` | should properly report "Lax" sameSite cookie | 2025-09-09 | `11b24822` |
| `CO-008` | `library/browsercontext-cookies.spec.ts` | should get multiple cookies | 2025-07-01 | `1194546a` |
| `CO-009` | `library/browsercontext-cookies.spec.ts` | should get cookies from multiple urls | 2025-09-09 | `98c5a2d5` |
| `CO-010` | `library/browsercontext-cookies.spec.ts` | should work with subdomain cookie | 2025-09-09 | `94aad4c4` |
| `CO-011` | `library/browsercontext-cookies.spec.ts` | should only return cookies that apply to the url | 2026-10-06 | `e205c809` |
| `CO-012` | `library/browsercontext-cookies.spec.ts` | should return cookies with empty value | 2021-10-07 | `8c6014ff` |
| `CO-013` | `library/browsercontext-cookies.spec.ts` | should return secure cookies based on HTTP(S) protocol | 2025-09-09 | `79cf5664` |
| `CO-014` | `library/browsercontext-cookies.spec.ts` | should return secure cookies for http {127.0.0.1, \[::1\]} *(2 copies)* | 2026-10-05 | `9a28c1a8` |
| `CO-015` | `library/browsercontext-cookies.spec.ts` | should add cookies with an expiration | 2024-10-28 | `90c7cf53` |
| `CO-016` | `library/browsercontext-cookies.spec.ts` | should support requestStorageAccess | 2025-09-09 | `bf03600b` |
| `CO-017` | `library/browsercontext-cookies.spec.ts` | should parse cookie with large Max-Age correctly | 2025-07-01 | `77599253` |
| `CO-018` | `library/browsercontext-cookies.spec.ts` | iframe should inherit cookies from parent | 2025-04-08 | `d1775085` |
| `CO-019` | `library/browsercontext-add-cookies.spec.ts` | should work @smoke | 2024-05-30 | `6cbe92b1` |
| `CO-020` | `library/browsercontext-add-cookies.spec.ts` | should work with expires=-1 | 2021-08-09 | `be849f04` |
| `CO-021` | `library/browsercontext-add-cookies.spec.ts` | should add cookies with empty value | 2021-10-07 | `46684251` |
| `CO-022` | `library/browsercontext-add-cookies.spec.ts` | should set cookies with SameSite attribute and no secure attribute | 2026-04-07 | `889479cf` |
| `CO-023` | `library/browsercontext-add-cookies.spec.ts` | should roundtrip cookie | 2022-12-14 | `6742ffde` |
| `CO-024` | `library/browsercontext-add-cookies.spec.ts` | should send cookie header | 2023-10-23 | `eb14f60b` |
| `CO-025` | `library/browsercontext-add-cookies.spec.ts` | should isolate cookies in browser contexts | 2020-08-03 | `444020ad` |
| `CO-026` | `library/browsercontext-add-cookies.spec.ts` | should isolate session cookies | 2020-08-03 | `d9ea34e3` |
| `CO-027` | `library/browsercontext-add-cookies.spec.ts` | should isolate persistent cookies | 2020-08-03 | `2b0e0853` |
| `CO-028` | `library/browsercontext-add-cookies.spec.ts` | should isolate send cookie header | 2020-08-06 | `ba93f3ad` |
| `CO-029` | `library/browsercontext-add-cookies.spec.ts` | should isolate cookies between launches | 2021-10-28 | `56730efa` |
| `CO-030` | `library/browsercontext-add-cookies.spec.ts` | should set multiple cookies | 2020-08-03 | `ec9f7d97` |
| `CO-031` | `library/browsercontext-add-cookies.spec.ts` | should have \|expires\| set to \|-1\| for session cookies | 2020-08-03 | `ea38d932` |
| `CO-032` | `library/browsercontext-add-cookies.spec.ts` | should set cookie with reasonable defaults | 2025-07-01 | `87898763` |
| `CO-033` | `library/browsercontext-add-cookies.spec.ts` | should set a cookie with a path | 2025-09-09 | `fffa9d71` |
| `CO-034` | `library/browsercontext-add-cookies.spec.ts` | should not set a cookie with blank page URL | 2020-08-03 | `52d5c4b8` |
| `CO-035` | `library/browsercontext-add-cookies.spec.ts` | should not set a cookie on a data URL page | 2020-08-03 | `120daa43` |
| `CO-036` | `library/browsercontext-add-cookies.spec.ts` | should default to setting secure cookie for HTTPS websites | 2020-08-03 | `ad6be1ce` |
| `CO-037` | `library/browsercontext-add-cookies.spec.ts` | should be able to set unsecure cookie for HTTP website | 2020-08-03 | `2988583b` |
| `CO-038` | `library/browsercontext-add-cookies.spec.ts` | should set a cookie on a different domain | 2025-09-09 | `3263baa6` |
| `CO-039` | `library/browsercontext-add-cookies.spec.ts` | should set cookies for a frame | 2023-10-23 | `420d89ac` |
| `CO-040` | `library/browsercontext-add-cookies.spec.ts` | should allow unnamed cookies | 2026-05-04 | `36b7b57d` |
| `CO-041` | `library/browsercontext-add-cookies.spec.ts` | should set secure cookies on secure WebSocket | 2025-07-01 | `2b34d149` |
| `CO-042` | `library/browsercontext-clearcookies.spec.ts` | should clear cookies | 2020-08-03 | `331e67e7` |
| `CO-043` | `library/browsercontext-clearcookies.spec.ts` | should isolate cookies when clearing | 2020-08-03 | `d0a607a1` |
| `CO-044` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name | 2024-03-26 | `fa6af54f` |
| `CO-045` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name regex | 2024-03-26 | `5caa3006` |
| `CO-046` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by domain | 2024-03-26 | `dc218933` |
| `CO-047` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by path | 2024-03-26 | `f920af82` |
| `CO-048` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name and domain | 2024-03-26 | `baf72ec4` |
| `CO-049` | `library/browsercontext-clearcookies.spec.ts` | should not transiently delete non-matching cookies when filtering | 2026-06-12 | `6fa690c5` |
| `CO-050` | `library/browsercontext-clearcookies.spec.ts` | should remove partitioned cookies by name | 2026-05-28 | `86d778d0` |
| `CO-051` | `library/browsercontext-clearcookies.spec.ts` | should remove nameless cookies by empty name | 2026-10-05 | `a77e51af` |
| `CO-052` | `library/browsercontext-cookies-third-party.spec.ts` | third party non-partitioned cookies | 2026-02-04 | `464cba79` |
| `CO-053` | `library/browsercontext-cookies-third-party.spec.ts` | save/load third party non-partitioned cookies | 2026-02-04 | `52d43d6c` |
| `CO-054` | `library/browsercontext-cookies-third-party.spec.ts` | third party 'Partitioned;' cookies | 2026-07-07 | `0eb3ac8a` |
| `CO-055` | `library/browsercontext-cookies-third-party.spec.ts` | save/load third party 'Partitioned;' cookies | 2026-07-07 | `42fd7f43` |
| `CO-056` | `library/browsercontext-cookies-third-party.spec.ts` | add 'Partitioned;' cookie via API | 2026-07-08 | `a685f760` |
| `CO-057` | `library/browsercontext-cookies-third-party.spec.ts` | same origin third party 'Partitioned;' cookie with different origin intermediate iframe | 2026-02-04 | `f1762feb` |
| `CO-058` | `library/browsercontext-cookies-third-party.spec.ts` | top level 'Partitioned;' cookie and same origin iframe | 2026-02-04 | `111aa711` |
| `CO-059` | `library/browsercontext-cookies-third-party.spec.ts` | should be able to send third party cookies via an iframe | 2026-02-04 | `4deb8bc4` |
| `CO-060` | `library/browsercontext-cookies-third-party.spec.ts` | should(not) block third party cookies - persistent context | 2025-08-25 | `ba6a0f6e` |
| `CO-061` | `library/browsercontext-cookies-third-party.spec.ts` | should(not) block third party cookies - ephemeral context | 2025-08-25 | `c6f18c93` |
| `CO-062` | `library/browsercontext-cookies-third-party.spec.ts` | should not block third party SameSite=None cookies | 2025-05-12 | `2a2ec516` |

### CR — Chromium

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CR-001` | `library/chromium/chromium.spec.ts` | should create a worker from a service worker | 2021-05-06 | `45d7c8d3` |
| `CR-002` | `library/chromium/chromium.spec.ts` | should create a worker from service worker with noop routing | 2022-07-01 | `cf0c0626` |
| `CR-003` | `library/chromium/chromium.spec.ts` | should emit new service worker on update | 2022-07-15 | `d1b3e4bb` |
| `CR-004` | `library/chromium/chromium.spec.ts` | http credentials › httpCredentials | 2022-07-15 | `8831e539` |
| `CR-005` | `library/chromium/chromium.spec.ts` | serviceWorkers() should return current workers | 2022-07-15 | `22478327` |
| `CR-006` | `library/chromium/chromium.spec.ts` | should not create a worker from a shared worker | 2022-07-15 | `a4842755` |
| `CR-008` | `library/chromium/chromium.spec.ts` | should close service worker together with the context | 2022-07-15 | `fda9b711` |
| `CR-009` | `library/chromium/chromium.spec.ts` | should pass args with spaces | 2022-07-15 | `9f0ef53e` |
| `CR-010` | `library/chromium/chromium.spec.ts` | serviceWorker(), and fromServiceWorker() work | 2022-07-15 | `6fa730e0` |
| `CR-011` | `library/chromium/chromium.spec.ts` | should intercept service worker requests (main and within) | 2022-07-15 | `ea2f303d` |
| `CR-012` | `library/chromium/chromium.spec.ts` | should report failure (due to content-type) of main service worker request | 2022-07-15 | `82512354` |
| `CR-013` | `library/chromium/chromium.spec.ts` | should report failure (due to redirect) of main service worker request | 2022-07-15 | `4e1261c8` |
| `CR-014` | `library/chromium/chromium.spec.ts` | should intercept service worker importScripts | 2022-07-15 | `0a5df11b` |
| `CR-015` | `library/chromium/chromium.spec.ts` | should report intercepted service worker requests in HAR | 2022-07-15 | `3fdef1b9` |
| `CR-016` | `library/chromium/chromium.spec.ts` | should intercept only serviceworker request, not page | 2022-07-15 | `eaa08d40` |
| `CR-017` | `library/chromium/chromium.spec.ts` | should produce network events, routing, and annotations for Service Worker | 2022-07-15 | `f16eed4d` |
| `CR-018` | `library/chromium/chromium.spec.ts` | should produce network events, routing, and annotations for Service Worker (advanced) | 2023-10-05 | `38da24c2` |
| `CR-019` | `library/chromium/chromium.spec.ts` | should intercept service worker update requests | 2022-07-15 | `945e0058` |
| `CR-020` | `library/chromium/chromium.spec.ts` | setOffline | 2022-07-15 | `79651618` |
| `CR-021` | `library/chromium/chromium.spec.ts` | setExtraHTTPHeaders | 2022-07-15 | `564d0b2b` |
| `CR-022` | `library/chromium/chromium.spec.ts` | should throw when connecting twice to an already running persistent context (--remote-debugging-port) | 2026-04-14 | `506be8ed` |
| `CR-023` | `library/chromium/chromium.spec.ts` | should throw when connecting twice to an already running persistent context (--remote-debugging-pipe) | 2025-12-09 | `be1e57be` |
| `CR-024` | `library/chromium/chromium.spec.ts` | PLAYWRIGHT\_DISABLE\_SERVICE\_WORKER\_NETWORK | 2025-10-15 | `a592023f` |
| `CR-025` | `library/chromium/chromium.spec.ts` | should emit console messages from service worker | 2025-11-13 | `89ad81f1` |
| `CR-026` | `library/chromium/chromium.spec.ts` | should capture console.log from ServiceWorker start | 2025-11-13 | `baa5025a` |
| `CR-027` | `library/chromium/chromium.spec.ts` | WebUI navigation › should refuse WebUI pages that crash the browser in an isolated context | 2026-08-11 | `4dabae9f` |
| `CR-028` | `library/chromium/chromium.spec.ts` | WebUI navigation › should refuse WebUI pages that crash Edge in an isolated context | 2026-08-11 | `371e96f0` |
| `CR-029` | `library/chromium/chromium.spec.ts` | WebUI navigation › should navigate to WebUI pages that work in an isolated context | 2026-08-11 | `2fd9751d` |
| `CR-030` | `library/chromium/chromium.spec.ts` | WebUI navigation › should navigate to any WebUI page in a persistent context | 2026-08-11 | `aec17b06` |
| `CR-031` | `library/chromium/chromium.spec.ts` | should fire dialogclosed event when dialog is closed out of band | 2026-07-28 | `a8b53522` |
| `CR-032` | `library/chromium/chromium.spec.ts` | should not leak service worker session after context close | 2026-09-30 | `54c2ffa1` |
| `CR-033` | `library/chromium/launcher.spec.ts` | should throw with remote-debugging-pipe argument | 2021-10-28 | `254912d8` |
| `CR-034` | `library/chromium/launcher.spec.ts` | should not throw with remote-debugging-port argument | 2021-10-28 | `e391bbf5` |
| `CR-035` | `library/chromium/launcher.spec.ts` | should not create pages automatically | 2021-10-28 | `7e3a20b2` |
| `CR-036` | `library/chromium/extensions.spec.ts` | MV3 › should support service worker stop and restart lifecycle | 2026-04-14 | `678c0774` |
| `CR-037` | `library/chromium/extensions.spec.ts` | MV3 › should give access to the service worker | 2025-07-25 | `e5c68c4e` |
| `CR-038` | `library/chromium/extensions.spec.ts` | MV3 › should give access to the service worker when recording video | 2025-07-25 | `1dfb3e46` |
| `CR-039` | `library/chromium/extensions.spec.ts` | MV3 › should support request/response events in the service worker | 2025-11-21 | `b77aa61f` |
| `CR-040` | `library/chromium/extensions.spec.ts` | MV3 › should report console messages from content script | 2025-07-01 | `34fde7f7` |
| `CR-041` | `library/chromium/extensions.spec.ts` | MV3 › should use custom userAgent in service worker fetch requests | 2026-06-05 | `4e66f26b` |
| `CR-042` | `library/chromium/bfcache.spec.ts` | bindings should work after restoring from bfcache | 2024-08-07 | `75306601` |
| `CR-043` | `library/chromium/connect-to-worker.spec.ts` | should connect, evaluate, receive console and disconnect | 2026-04-29 | `a1418905` |
| `CR-044` | `library/chromium/connect-to-worker.spec.ts` | should receive close when node process exits | 2026-04-29 | `fa7c71a4` |
| `CR-045` | `library/chromium/disable-web-security.spec.ts` | test utility world in popup w/ --disable-web-security | 2024-06-27 | `c936b529` |
| `CR-046` | `library/chromium/disable-web-security.spec.ts` | test init script w/ --disable-web-security | 2024-06-27 | `af397444` |

### CS — CSP

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CS-001` | `library/browsercontext-csp.spec.ts` | should bypass CSP meta tag @smoke | 2025-11-21 | `591bca90` |
| `CS-002` | `library/browsercontext-csp.spec.ts` | should bypass CSP header | 2025-11-21 | `236e5db2` |
| `CS-003` | `library/browsercontext-csp.spec.ts` | should bypass after cross-process navigation | 2025-11-21 | `f3e41f9e` |
| `CS-004` | `library/browsercontext-csp.spec.ts` | should bypass CSP in iframes as well | 2025-11-21 | `d2ab6ba1` |
| `CS-005` | `library/browsercontext-csp.spec.ts` | should not crash on javascript: navigation | 2026-10-16 | `6bd37aaa` |

### CV — Coverage

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `CV-001` | `library/chromium/js-coverage.spec.ts` | should work | 2021-05-24 | `5847409c` |
| `CV-002` | `library/chromium/js-coverage.spec.ts` | should report sourceURLs | 2020-08-28 | `415ed9d1` |
| `CV-003` | `library/chromium/js-coverage.spec.ts` | should ignore eval() scripts by default | 2020-08-28 | `e33c4532` |
| `CV-004` | `library/chromium/js-coverage.spec.ts` | shouldn't ignore eval() scripts if reportAnonymousScripts is true | 2025-03-25 | `cb7ec5a1` |
| `CV-005` | `library/chromium/js-coverage.spec.ts` | should report multiple scripts | 2020-08-28 | `21b91f46` |
| `CV-006` | `library/chromium/js-coverage.spec.ts` | should NOT report scripts across navigations when enabled | 2020-08-28 | `807fbcc2` |
| `CV-007` | `library/chromium/js-coverage.spec.ts` | should not hang when there is a debugger statement | 2020-08-28 | `cb74cde4` |
| `CV-008` | `library/chromium/css-coverage.spec.ts` | should work | 2021-04-05 | `d3ba41db` |
| `CV-009` | `library/chromium/css-coverage.spec.ts` | should report sourceURLs | 2020-08-28 | `1bbbb745` |
| `CV-010` | `library/chromium/css-coverage.spec.ts` | should report multiple stylesheets | 2020-08-28 | `105a06a2` |
| `CV-011` | `library/chromium/css-coverage.spec.ts` | should report stylesheets that have no coverage | 2020-08-28 | `e150da13` |
| `CV-012` | `library/chromium/css-coverage.spec.ts` | should work with media queries | 2023-05-18 | `2dd37b0d` |
| `CV-013` | `library/chromium/css-coverage.spec.ts` | should work with complicated usecases | 2023-05-18 | `b3a41c52` |
| `CV-014` | `library/chromium/css-coverage.spec.ts` | should ignore injected stylesheets | 2020-08-28 | `bc6ed997` |
| `CV-015` | `library/chromium/css-coverage.spec.ts` | should report stylesheets across navigations | 2020-08-28 | `781659d4` |
| `CV-016` | `library/chromium/css-coverage.spec.ts` | should NOT report scripts across navigations | 2020-08-28 | `2ef0d873` |
| `CV-017` | `library/chromium/css-coverage.spec.ts` | should work with a recently loaded stylesheet | 2025-03-25 | `e5211fe7` |
| `CV-018` | `library/coverage.spec.ts` | should collect istanbul coverage into the trace | 2026-10-01 | `d426268c` |
| `CV-019` | `library/coverage.spec.ts` | should collect coverage per trace chunk | 2026-10-01 | `807e1cba` |
| `CV-020` | `library/coverage.spec.ts` | should report maps once and counters incrementally | 2026-10-01 | `ed286aa5` |
| `CV-021` | `library/coverage.spec.ts` | should accumulate counters across pulls and keep never hit files | 2026-10-01 | `2d605a40` |
| `CV-022` | `library/coverage.spec.ts` | should collect coverage of a page closed by in-page script | 2026-10-01 | `521af227` |
| `CV-023` | `library/coverage.spec.ts` | should not double count a stash picked up twice | 2026-10-01 | `c4814c60` |
| `CV-024` | `library/coverage.spec.ts` | should discard stashes of other sessions | 2026-10-01 | `7ba562a6` |
| `CV-025` | `library/coverage.spec.ts` | should collect coverage of an origin left without a page | 2026-10-01 | `6f6372b1` |
| `CV-026` | `library/coverage.spec.ts` | should pull counters as the actions go | 2026-10-01 | `a6ee2ea8` |
| `CV-027` | `library/coverage.spec.ts` | should not collect coverage without the option | 2026-09-16 | `46bf59d8` |
| `CV-028` | `library/coverage.spec.ts` | should count only the hits after start | 2026-10-01 | `52b84b6b` |
| `CV-029` | `library/coverage.spec.ts` | should stop collecting when tracing stops | 2026-10-01 | `7d18f463` |
| `CV-030` | `library/coverage.spec.ts` | should surface a failure to stash the coverage | 2026-10-01 | `7d4e3296` |

### DB — Debug

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DB-001` | `library/debugger.spec.ts` | should pause at next and resume | 2026-03-26 | `fb3a951a` |
| `DB-002` | `library/debugger.spec.ts` | should pause at pause call | 2026-03-26 | `5dae342e` |
| `DB-003` | `library/debugger.spec.ts` | should run to location | 2026-03-26 | `720bceb4` |
| `DB-004` | `library/debugger.spec.ts` | should stream api calls via \_enable | 2026-07-23 | `78c0c151` |
| `DB-005` | `library/debugger.spec.ts` | should report error status for failed api calls | 2026-07-23 | `26c4d9a8` |
| `DB-006` | `library/debugger.spec.ts` | should not stream internal api calls | 2026-07-23 | `471ba7ea` |
| `DB-007` | `library/debugger.spec.ts` | should not pause at internal api calls | 2026-07-23 | `74a06ea1` |
| `DB-008` | `library/debugger.spec.ts` | should expose the action point while paused on an input action | 2026-07-23 | `8b89bb43` |
| `DB-009` | `library/debugger.spec.ts` | should replay ongoing calls when enabled late | 2026-07-23 | `4898db24` |
| `DB-010` | `library/debugger.spec.ts` | should keep pause working when api calls are enabled | 2026-07-23 | `21c54604` |
| `DB-011` | `library/debug-controller.spec.ts` | should pick element | 2026-06-30 | `e22f3bd4` |
| `DB-012` | `library/debug-controller.spec.ts` | should report pages | 2026-06-30 | `2b1046be` |
| `DB-013` | `library/debug-controller.spec.ts` | should reset for reuse | 2025-07-29 | `12b6f20c` |
| `DB-014` | `library/debug-controller.spec.ts` | should highlight all | 2026-06-30 | `619f439c` |
| `DB-015` | `library/debug-controller.spec.ts` | should record | 2026-06-30 | `1e61d725` |
| `DB-016` | `library/debug-controller.spec.ts` | should record expect signal | 2026-07-23 | `346bf279` |
| `DB-017` | `library/debug-controller.spec.ts` | should record custom data-testid | 2026-06-30 | `ccdd4d24` |
| `DB-018` | `library/debug-controller.spec.ts` | should not leak actions from the previous recording session | 2026-09-02 | `55dbed73` |
| `DB-019` | `library/debug-controller.spec.ts` | should reset routes before reuse | 2025-07-09 | `2d60647c` |
| `DB-020` | `library/debug-controller.spec.ts` | should highlight inside iframe | 2026-08-17 | `c78315d1` |
| `DB-021` | `library/debug-controller.spec.ts` | should highlight aria template | 2026-06-30 | `b5141c73` |
| `DB-022` | `library/debug-controller.spec.ts` | should report error in aria template | 2026-06-30 | `da6cd184` |

### DC — Default (persistent) context

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DC-001` | `library/defaultbrowsercontext-1.spec.ts` | context.cookies() should work @smoke | 2025-07-03 | `013e39c8` |
| `DC-002` | `library/defaultbrowsercontext-1.spec.ts` | context.addCookies() should work | 2025-09-09 | `fdda045b` |
| `DC-003` | `library/defaultbrowsercontext-1.spec.ts` | context.clearCookies() should work | 2025-01-05 | `f64a46d9` |
| `DC-004` | `library/defaultbrowsercontext-1.spec.ts` | should support viewport option | 2020-09-18 | `08a326fb` |
| `DC-005` | `library/defaultbrowsercontext-1.spec.ts` | should support deviceScaleFactor option | 2020-08-28 | `4ff3ae59` |
| `DC-006` | `library/defaultbrowsercontext-1.spec.ts` | should support userAgent option | 2020-08-28 | `68927dfc` |
| `DC-007` | `library/defaultbrowsercontext-1.spec.ts` | should support bypassCSP option | 2025-11-21 | `faff8dc0` |
| `DC-008` | `library/defaultbrowsercontext-1.spec.ts` | should support javascriptEnabled option | 2021-05-13 | `274cb19f` |
| `DC-009` | `library/defaultbrowsercontext-1.spec.ts` | should support httpCredentials option | 2020-08-28 | `3ef53a21` |
| `DC-010` | `library/defaultbrowsercontext-1.spec.ts` | should support offline option | 2020-08-28 | `ffa34556` |
| `DC-011` | `library/defaultbrowsercontext-1.spec.ts` | should support acceptDownloads option | 2023-01-30 | `541b8a23` |
| `DC-012` | `library/defaultbrowsercontext-2.spec.ts` | should support hasTouch option | 2020-08-28 | `7be5bb56` |
| `DC-013` | `library/defaultbrowsercontext-2.spec.ts` | should work in persistent context | 2021-04-03 | `1661d9c6` |
| `DC-014` | `library/defaultbrowsercontext-2.spec.ts` | should support colorScheme option | 2020-08-28 | `635c9739` |
| `DC-015` | `library/defaultbrowsercontext-2.spec.ts` | should support reducedMotion option | 2021-05-21 | `ef613ae7` |
| `DC-016` | `library/defaultbrowsercontext-2.spec.ts` | should support forcedColors option | 2021-09-03 | `9af79bbf` |
| `DC-017` | `library/defaultbrowsercontext-2.spec.ts` | should support contrast option | 2025-02-04 | `b0c9359f` |
| `DC-018` | `library/defaultbrowsercontext-2.spec.ts` | should support timezoneId option | 2021-06-03 | `82e63ae8` |
| `DC-019` | `library/defaultbrowsercontext-2.spec.ts` | should support locale option | 2022-06-08 | `8f25383e` |
| `DC-020` | `library/defaultbrowsercontext-2.spec.ts` | should support geolocation and permissions options | 2020-08-28 | `92e07848` |
| `DC-021` | `library/defaultbrowsercontext-2.spec.ts` | should support ignoreHTTPSErrors option | 2020-08-28 | `88032b82` |
| `DC-022` | `library/defaultbrowsercontext-2.spec.ts` | should support extraHTTPHeaders option | 2021-01-22 | `9dde1c64` |
| `DC-023` | `library/defaultbrowsercontext-2.spec.ts` | should accept userDataDir | 2021-10-28 | `d2d8cdb5` |
| `DC-024` | `library/defaultbrowsercontext-2.spec.ts` | should accept relative userDataDir | 2025-02-11 | `6c806187` |
| `DC-025` | `library/defaultbrowsercontext-2.spec.ts` | should restore state from userDataDir | 2026-06-15 | `c7a90cb4` |
| `DC-026` | `library/defaultbrowsercontext-2.spec.ts` | should create userDataDir if it does not exist | 2021-10-28 | `8fa770d8` |
| `DC-027` | `library/defaultbrowsercontext-2.spec.ts` | should goto about:blank on relaunched persistent context | 2026-07-17 | `8980a1f5` |
| `DC-028` | `library/defaultbrowsercontext-2.spec.ts` | should have default URL when launching browser | 2020-08-28 | `ed311b7e` |
| `DC-029` | `library/defaultbrowsercontext-2.spec.ts` | should throw if page argument is passed | 2025-12-15 | `2af5c241` |
| `DC-030` | `library/defaultbrowsercontext-2.spec.ts` | should have passed URL when launching with ignoreDefaultArgs: true | 2025-10-31 | `e5eb3dfb` |
| `DC-031` | `library/defaultbrowsercontext-2.spec.ts` | should handle timeout | 2025-10-31 | `58fa7244` |
| `DC-032` | `library/defaultbrowsercontext-2.spec.ts` | should handle exception | 2025-10-31 | `133b8c87` |
| `DC-033` | `library/defaultbrowsercontext-2.spec.ts` | should fire close event for a persistent context | 2020-08-28 | `c1749929` |
| `DC-034` | `library/defaultbrowsercontext-2.spec.ts` | coverage should work | 2021-04-03 | `39a9d17a` |
| `DC-035` | `library/defaultbrowsercontext-2.spec.ts` | should respect selectors | 2025-08-07 | `a064f984` |
| `DC-036` | `library/defaultbrowsercontext-2.spec.ts` | should connect to a browser with the default page | 2025-10-31 | `7336cc34` |
| `DC-037` | `library/defaultbrowsercontext-2.spec.ts` | should support har option | 2022-08-02 | `70a4737e` |
| `DC-038` | `library/defaultbrowsercontext-2.spec.ts` | user agent is up to date | 2025-10-31 | `f8d6b868` |
| `DC-039` | `library/defaultbrowsercontext-2.spec.ts` | dialog.accept should work | 2025-10-31 | `4d7749c2` |
| `DC-040` | `library/defaultbrowsercontext-2.spec.ts` | CacheStorage entry should survive page.reload() | 2026-07-10 | `64e42a16` |
| `DC-041` | `library/defaultbrowsercontext-2.spec.ts` | exposes browser | 2025-05-22 | `cfc2825a` |
| `DC-042` | `library/defaultbrowsercontext-2.spec.ts` | should support storage.getDirectory() | 2026-07-24 | `b6c9c714` |

### DD — Drag and drop

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DD-001` | `page/page-drag.spec.ts` | Drag and drop › should work @smoke | 2022-03-10 | `df84d752` |
| `DD-002` | `page/page-drag.spec.ts` | Drag and drop › should send the right events | 2022-11-04 | `ce14e470` |
| `DD-003` | `page/page-drag.spec.ts` | Drag and drop › should not send dragover on the first mousemove | 2022-11-04 | `630b4bda` |
| `DD-004` | `page/page-drag.spec.ts` | Drag and drop › should work inside iframe | 2023-02-10 | `43cb86a8` |
| `DD-005` | `page/page-drag.spec.ts` | Drag and drop › should cancel on escape | 2022-11-04 | `40d3fbd4` |
| `DD-006` | `page/page-drag.spec.ts` | Drag and drop › iframe › should drag into an iframe | 2022-09-30 | `cd91feb3` |
| `DD-007` | `page/page-drag.spec.ts` | Drag and drop › iframe › should drag out of an iframe | 2022-09-30 | `37c1c13d` |
| `DD-008` | `page/page-drag.spec.ts` | Drag and drop › should respect the drop effect | 2023-03-14 | `6a5f5163` |
| `DD-009` | `page/page-drag.spec.ts` | Drag and drop › should work if the drag is canceled | 2021-06-07 | `1e5be138` |
| `DD-010` | `page/page-drag.spec.ts` | Drag and drop › should work if the drag event is captured but not canceled | 2021-06-07 | `47f7764d` |
| `DD-011` | `page/page-drag.spec.ts` | Drag and drop › should be able to drag the mouse in a frame | 2024-06-17 | `b44dbfd2` |
| `DD-012` | `page/page-drag.spec.ts` | Drag and drop › should work if a frame is stalled | 2023-06-02 | `4689c21e` |
| `DD-013` | `page/page-drag.spec.ts` | Drag and drop › should work with the helper method | 2021-07-19 | `24a6bd0a` |
| `DD-014` | `page/page-drag.spec.ts` | Drag and drop › should {dragAndDrop, dragTo} with tweened mouse movement *(2 copies)* | 2026-01-30 | `7c1c63d5` |
| `DD-015` | `page/page-drag.spec.ts` | Drag and drop › should allow specifying the position | 2021-08-03 | `d017c4ec` |
| `DD-016` | `page/page-drag.spec.ts` | Drag and drop › should work with locators | 2021-11-22 | `7022f848` |
| `DD-017` | `page/page-drag.spec.ts` | should work if not doing a drag | 2024-06-12 | `22f6de30` |
| `DD-018` | `page/page-drag.spec.ts` | should report event.buttons | 2025-03-25 | `85dce14d` |
| `DD-019` | `page/page-drag.spec.ts` | should handle custom dataTransfer | 2023-02-02 | `9607fcde` |
| `DD-020` | `page/page-drag.spec.ts` | what happens when dragging element is destroyed | 2023-04-04 | `a53e8e44` |
| `DD-021` | `page/page-drop.spec.ts` | should drop a file payload | 2026-04-21 | `fe73dec7` |
| `DD-022` | `page/page-drop.spec.ts` | should drop multiple file payloads | 2026-04-21 | `2484a56c` |
| `DD-023` | `page/page-drop.spec.ts` | should drop a file by local path | 2026-04-21 | `dfb24768` |
| `DD-024` | `page/page-drop.spec.ts` | should drop clipboard-like data | 2026-04-21 | `52dfe2aa` |
| `DD-025` | `page/page-drop.spec.ts` | should drop files and data together | 2026-04-21 | `a383be63` |
| `DD-026` | `page/page-drop.spec.ts` | should throw when target does not accept drop | 2026-04-17 | `6531fdb7` |
| `DD-027` | `page/page-drop.spec.ts` | should throw when neither files nor data provided | 2026-04-17 | `5c45eee7` |

### DE — Dispatch event

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DE-001` | `page/page-dispatchevent.spec.ts` | should dispatch click event @smoke | 2022-03-10 | `f48d86ab` |
| `DE-002` | `page/page-dispatchevent.spec.ts` | should dispatch click event properties | 2020-08-11 | `477f757f` |
| `DE-003` | `page/page-dispatchevent.spec.ts` | should dispatch click svg | 2020-08-14 | `b168da6b` |
| `DE-004` | `page/page-dispatchevent.spec.ts` | should dispatch click on a span with an inline element inside | 2021-03-18 | `5d85a058` |
| `DE-005` | `page/page-dispatchevent.spec.ts` | should dispatch click after navigation  | 2020-08-11 | `f93efa12` |
| `DE-006` | `page/page-dispatchevent.spec.ts` | should dispatch click after a cross origin navigation  | 2020-08-11 | `97ad84f9` |
| `DE-007` | `page/page-dispatchevent.spec.ts` | should not fail when element is blocked on hover | 2021-03-18 | `a7a4b87a` |
| `DE-008` | `page/page-dispatchevent.spec.ts` | should dispatch click when node is added in shadow dom | 2024-05-31 | `05251cb1` |
| `DE-009` | `page/page-dispatchevent.spec.ts` | should be atomic | 2025-08-07 | `1f93e163` |
| `DE-010` | `page/page-dispatchevent.spec.ts` | should dispatch drag drop events | 2020-09-22 | `e3c956ec` |
| `DE-011` | `page/page-dispatchevent.spec.ts` | should dispatch drag drop events via ElementHandles | 2021-07-09 | `1929c5ba` |
| `DE-012` | `page/page-dispatchevent.spec.ts` | should dispatch click event via ElementHandles | 2021-07-09 | `6d141b58` |
| `DE-013` | `page/page-dispatchevent.spec.ts` | should dispatch wheel event | 2022-07-13 | `51593540` |
| `DE-014` | `page/page-dispatchevent.spec.ts` | should dispatch device orientation event | 2023-11-10 | `cd32f3f1` |
| `DE-015` | `page/page-dispatchevent.spec.ts` | should dispatch absolute device orientation event | 2023-11-10 | `13183d98` |
| `DE-016` | `page/page-dispatchevent.spec.ts` | should dispatch device motion event | 2023-11-13 | `b891add3` |
| `DE-017` | `page/page-dispatchevent.spec.ts` | should throw if argument is from different frame | 2023-12-19 | `4e4ada80` |

### DI — Dialog

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DI-001` | `page/page-dialog.spec.ts` | should fire | 2023-06-02 | `c4e507f6` |
| `DI-002` | `page/page-dialog.spec.ts` | should fire dialogclosed when dialog is accepted | 2026-07-28 | `09390afe` |
| `DI-003` | `page/page-dialog.spec.ts` | should fire dialogclosed when dialog is dismissed | 2026-07-28 | `a497892d` |
| `DI-004` | `page/page-dialog.spec.ts` | should fire dialogclosed for auto-dismissed dialogs | 2026-07-28 | `94c215bd` |
| `DI-005` | `page/page-dialog.spec.ts` | should allow accepting prompts @smoke | 2023-06-02 | `f3379666` |
| `DI-006` | `page/page-dialog.spec.ts` | should dismiss the prompt | 2024-04-24 | `99daebf6` |
| `DI-007` | `page/page-dialog.spec.ts` | should accept the confirm prompt | 2023-06-02 | `b0d5606e` |
| `DI-008` | `page/page-dialog.spec.ts` | should dismiss the confirm prompt | 2023-06-02 | `a1b43c70` |
| `DI-009` | `page/page-dialog.spec.ts` | should be able to close context with open alert | 2025-03-25 | `9f76057b` |
| `DI-010` | `page/page-dialog.spec.ts` | should handle multiple alerts | 2023-06-02 | `4a9253a4` |
| `DI-011` | `page/page-dialog.spec.ts` | should handle multiple confirms | 2023-06-02 | `05719c5d` |
| `DI-012` | `page/page-dialog.spec.ts` | should auto-dismiss the prompt without listeners | 2021-04-09 | `c787bc27` |
| `DI-013` | `page/page-dialog.spec.ts` | should auto-dismiss the alert without listeners | 2021-02-03 | `2541dd97` |

### DO — Download

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DO-001` | `library/download.spec.ts` | download event › should report download when navigation turns into download @smoke | 2026-07-17 | `99a22333` |
| `DO-002` | `library/download.spec.ts` | download event › should work with Cross-Origin-Opener-Policy | 2026-07-17 | `3bbe2fb6` |
| `DO-003` | `library/download.spec.ts` | download event › should report downloads with acceptDownloads: false | 2023-10-17 | `95b89770` |
| `DO-004` | `library/download.spec.ts` | download event › should report downloads with acceptDownloads: true | 2021-12-06 | `ca44d8de` |
| `DO-005` | `library/download.spec.ts` | download event › should report proper download url when download is from download attribute | 2021-12-06 | `c9a232b8` |
| `DO-006` | `library/download.spec.ts` | download event › should report downloads for download attribute | 2021-12-06 | `cb1fcd60` |
| `DO-007` | `library/download.spec.ts` | download event › should save to user-specified path without updating original path | 2021-12-06 | `5e790f0e` |
| `DO-008` | `library/download.spec.ts` | download event › should save to two different paths with multiple saveAs calls | 2021-12-06 | `5c2d7968` |
| `DO-009` | `library/download.spec.ts` | download event › should save to overwritten filepath | 2021-12-06 | `66154c9b` |
| `DO-010` | `library/download.spec.ts` | download event › should create subdirectories when saving to non-existent user-specified path | 2021-12-06 | `4eba615f` |
| `DO-011` | `library/download.spec.ts` | download event › should error when saving with downloads disabled | 2021-04-05 | `5c37ae04` |
| `DO-012` | `library/download.spec.ts` | download event › should error when saving after deletion | 2021-12-06 | `2823177b` |
| `DO-013` | `library/download.spec.ts` | download event › should report non-navigation downloads | 2021-12-06 | `6376e2da` |
| `DO-014` | `library/download.spec.ts` | download event › should report download path within page.on('download', …) handler for Files | 2023-06-02 | `7e472ab8` |
| `DO-015` | `library/download.spec.ts` | download event › should report download path within page.on('download', …) handler for Blobs | 2023-06-02 | `9e8b9782` |
| `DO-016` | `library/download.spec.ts` | download event › should report alt-click downloads | 2024-10-04 | `47c3cced` |
| `DO-017` | `library/download.spec.ts` | download event › should report new window downloads | 2021-12-06 | `f37c9bfd` |
| `DO-018` | `library/download.spec.ts` | download event › should delete file | 2021-12-06 | `d1caf905` |
| `DO-019` | `library/download.spec.ts` | download event › should expose stream | 2021-12-06 | `6e330b40` |
| `DO-020` | `library/download.spec.ts` | download event › should delete downloads on context destruction | 2021-12-06 | `e9293d45` |
| `DO-021` | `library/download.spec.ts` | download event › should delete downloads on browser gone | 2026-02-27 | `20966739` |
| `DO-022` | `library/download.spec.ts` | download event › should save downloads to artifactsDir | 2026-03-11 | `22d35a1f` |
| `DO-023` | `library/download.spec.ts` | download event › should close the context without awaiting the failed download | 2023-10-17 | `b82dcfd0` |
| `DO-024` | `library/download.spec.ts` | download event › should close the context without awaiting the download | 2025-09-09 | `03bf80d8` |
| `DO-025` | `library/download.spec.ts` | download event › should throw if browser dies | 2025-09-09 | `41202457` |
| `DO-026` | `library/download.spec.ts` | download event › should download large binary.zip | 2023-10-17 | `4a6b4403` |
| `DO-027` | `library/download.spec.ts` | download event › should be able to cancel pending downloads | 2021-12-06 | `0ffb7a91` |
| `DO-028` | `library/download.spec.ts` | download event › should not fail explicitly to cancel a download even if that is already finished | 2021-12-06 | `20da81e9` |
| `DO-029` | `library/download.spec.ts` | download event › should report downloads with interception | 2021-12-06 | `de5918cf` |
| `DO-030` | `library/download.spec.ts` | download event › should emit download event from nested iframes | 2023-10-17 | `198895d2` |
| `DO-031` | `library/download.spec.ts` | should be able to download a PDF file | 2021-12-06 | `2f0da9cb` |
| `DO-032` | `library/download.spec.ts` | should be able to download a inline PDF file via response interception | 2022-08-24 | `66ee7d2d` |
| `DO-033` | `library/download.spec.ts` | should be able to download a inline PDF file via navigation | 2026-01-26 | `9fc93072` |
| `DO-034` | `library/download.spec.ts` | should save to user-specified path | 2021-12-06 | `a6fab16d` |
| `DO-035` | `library/download.spec.ts` | should download even if there is no "attachment" value | 2023-01-26 | `b7ec1176` |
| `DO-036` | `library/download.spec.ts` | should convert navigation to a resource with unsupported mime type into download | 2023-01-26 | `ff07dd80` |
| `DO-037` | `library/download.spec.ts` | should download links with data url | 2023-10-05 | `f2262c9c` |
| `DO-038` | `library/download.spec.ts` | should download successfully when routing | 2023-10-16 | `93af439b` |
| `DO-039` | `library/downloads-path.spec.ts` | downloads path › should keep downloadsPath folder | 2021-10-28 | `8be15d4c` |
| `DO-040` | `library/downloads-path.spec.ts` | downloads path › should delete downloads when context closes | 2021-12-06 | `4752562b` |
| `DO-041` | `library/downloads-path.spec.ts` | downloads path › should report downloads in downloadsPath folder | 2021-12-06 | `ddfd11ac` |
| `DO-042` | `library/downloads-path.spec.ts` | downloads path › should report downloads in downloadsPath folder with a relative path | 2021-12-06 | `b94dd256` |
| `DO-043` | `library/downloads-path.spec.ts` | downloads path › should accept downloads in persistent context | 2021-12-06 | `a13d26b8` |
| `DO-044` | `library/downloads-path.spec.ts` | downloads path › should delete downloads when persistent context closes | 2021-12-06 | `e630e2d5` |

### DV — Device

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `DV-001` | `library/browsercontext-device.spec.ts` | device › should work @smoke | 2022-03-10 | `a158d925` |
| `DV-002` | `library/browsercontext-device.spec.ts` | device › should support clicking | 2023-10-23 | `21453297` |
| `DV-003` | `library/browsercontext-device.spec.ts` | device › should scroll to click | 2023-10-23 | `958bdbf7` |
| `DV-004` | `library/browsercontext-device.spec.ts` | device › should scroll twice when emulated | 2021-10-28 | `0c866b5a` |
| `DV-005` | `library/browsercontext-device.spec.ts` | device › should reset scroll top after a navigation | 2021-05-15 | `1a1645a3` |
| `DV-006` | `library/browsercontext-device.spec.ts` | device › should scroll to a precise position with mobile scale | 2021-05-15 | `7e17b0b9` |
| `DV-007` | `library/browsercontext-device.spec.ts` | device › should emulate viewport and screen size | 2021-10-28 | `3f941166` |
| `DV-008` | `library/browsercontext-device.spec.ts` | device › should emulate viewport without screen size | 2021-10-28 | `d1268ad1` |
| `DV-009` | `library/browsercontext-dsf.spec.ts` | should fetch lodpi assets @smoke | 2022-03-10 | `40d1c2b4` |
| `DV-010` | `library/browsercontext-dsf.spec.ts` | should fetch hidpi assets | 2020-12-02 | `771a64d6` |
| `DV-011` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support mobile emulation | 2020-08-28 | `01af3c66` |
| `DV-012` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support touch emulation | 2023-10-23 | `535d09e8` |
| `DV-013` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should be detectable | 2024-10-10 | `295de8d9` |
| `DV-014` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should detect touch when applying viewport with touches | 2024-10-10 | `ce96f31a` |
| `DV-015` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support landscape emulation | 2020-08-28 | `ac568dda` |
| `DV-016` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support window.orientation emulation | 2020-08-28 | `a04ccbdd` |
| `DV-017` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should preserve window.orientation override after navigation | 2026-02-27 | `f4c61eb6` |
| `DV-018` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should preserve screen.orientation.type override after navigation | 2026-02-27 | `bef4ca40` |
| `DV-019` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should fire orientationchange event | 2020-08-28 | `ce28bb1f` |
| `DV-020` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › default mobile viewports to 980 width | 2020-08-28 | `edb397c0` |
| `DV-021` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › respect meta viewport tag | 2020-08-28 | `754ea431` |
| `DV-022` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should emulate the hover media feature | 2020-10-20 | `8127ca62` |
| `DV-023` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › mouse should work with mobile viewports and cross process navigations | 2024-10-10 | `3ec50ba3` |
| `DV-024` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should scroll when emulating a mobile viewport | 2022-02-25 | `1174afc7` |
| `DV-025` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should scroll mobile page with background-attachment: fixed | 2024-10-10 | `52e97373` |
| `DV-026` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › view scale should reset after navigation | 2024-10-10 | `f1c27100` |

### EE — Event emitter

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EE-001` | `page/page-listeners.spec.ts` | should not throw with ignoreErrors | 2024-08-06 | `9533dd8c` |
| `EE-002` | `page/page-listeners.spec.ts` | should wait | 2024-08-06 | `7f0dc4d1` |
| `EE-003` | `page/page-listeners.spec.ts` | wait should throw | 2024-08-06 | `d4079a3e` |
| `EE-004` | `library/events/add-listeners.spec.ts` | EventEmitter tests › should work | 2024-07-30 | `7b59c801` |
| `EE-005` | `library/events/add-listeners.spec.ts` | EventEmitter tests › set max listeners test | 2024-07-30 | `fdc0e549` |
| `EE-006` | `library/events/add-listeners.spec.ts` | EventEmitter tests › Listener order | 2024-07-30 | `7f0da429` |
| `EE-007` | `library/events/add-listeners.spec.ts` | EventEmitter tests › listener type check | 2024-07-30 | `bed7dfa1` |
| `EE-008` | `library/events/check-listener-leaks.spec.ts` | defaultMaxListeners | 2024-07-30 | `b6835c48` |
| `EE-009` | `library/events/check-listener-leaks.spec.ts` | process-wide | 2024-07-30 | `1a04d35e` |
| `EE-010` | `library/events/check-listener-leaks.spec.ts` | \_maxListeners still has precedence over defaultMaxListeners | 2024-07-30 | `250be93e` |
| `EE-011` | `library/events/events-list.spec.ts` | EventEmitter › should maintain event names correctly | 2024-07-30 | `8756222c` |
| `EE-012` | `library/events/listener-count.spec.ts` | Listener count test | 2024-07-30 | `c7ba4485` |
| `EE-013` | `library/events/listeners-side-effects.spec.ts` | listeners empty check | 2024-07-30 | `85912061` |
| `EE-014` | `library/events/listeners.spec.ts` | EventEmitter listeners with one listener | 2024-08-06 | `4e871a49` |
| `EE-015` | `library/events/listeners.spec.ts` | Array copy modification does not modify orig | 2024-07-30 | `fd713836` |
| `EE-016` | `library/events/listeners.spec.ts` | Modify array copy after multiple adds | 2024-07-30 | `3f20af11` |
| `EE-017` | `library/events/listeners.spec.ts` | listeners and once | 2024-07-30 | `d7bc98c4` |
| `EE-018` | `library/events/listeners.spec.ts` | listeners with conflicting types | 2024-07-30 | `52b2b7ac` |
| `EE-019` | `library/events/listeners.spec.ts` | EventEmitter with no members | 2024-07-30 | `9b796b28` |
| `EE-020` | `library/events/listeners.spec.ts` | listeners on prototype | 2024-07-30 | `60454d41` |
| `EE-021` | `library/events/listeners.spec.ts` | raw listeners | 2024-07-30 | `7a337d03` |
| `EE-022` | `library/events/listeners.spec.ts` | raw listeners order | 2024-07-30 | `97ccd431` |
| `EE-023` | `library/events/max-listeners.spec.ts` | emit maxListeners on e | 2024-07-30 | `cc7fcd6a` |
| `EE-024` | `library/events/method-names.spec.ts` | EventEmitter prototype test | 2024-07-30 | `0c9a44a5` |
| `EE-025` | `library/events/modify-in-emit.spec.ts` | add and remove listeners | 2024-08-06 | `245c2727` |
| `EE-026` | `library/events/modify-in-emit.spec.ts` | removing callbacks in emit | 2024-07-30 | `31e756fb` |
| `EE-027` | `library/events/num-args.spec.ts` | should work | 2024-07-30 | `abe86cc2` |
| `EE-028` | `library/events/once.spec.ts` | should work | 2024-07-30 | `13bd764d` |
| `EE-029` | `library/events/once.spec.ts` | once() has different code paths based on the number of arguments being emitted | 2024-07-30 | `35f772d5` |
| `EE-030` | `library/events/prepend.spec.ts` | EventEmitter functionality | 2024-07-30 | `192625ea` |
| `EE-031` | `library/events/prepend.spec.ts` | Verify that the listener must be a function | 2024-07-30 | `85fe1940` |
| `EE-032` | `library/events/remove-all-listeners-wait.spec.ts` | should not throw with ignoreErrors | 2024-08-06 | `184e0c5a` |
| `EE-033` | `library/events/remove-all-listeners-wait.spec.ts` | should wait | 2024-08-06 | `4938fa4c` |
| `EE-034` | `library/events/remove-all-listeners-wait.spec.ts` | should wait all | 2024-08-06 | `1fc3a906` |
| `EE-035` | `library/events/remove-all-listeners-wait.spec.ts` | wait should throw | 2024-08-06 | `55092576` |
| `EE-036` | `library/events/remove-all-listeners.spec.ts` | listeners | 2024-08-06 | `6ebb76b9` |
| `EE-037` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners removes all listeners | 2024-08-06 | `369f78de` |
| `EE-038` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners with no event type | 2024-07-30 | `fb2369e8` |
| `EE-039` | `library/events/remove-all-listeners.spec.ts` | listener count after removeAllListeners | 2024-08-06 | `c5288ce1` |
| `EE-040` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners returns EventEmitter | 2024-07-30 | `21294f7f` |
| `EE-041` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners on undefined \_events | 2024-07-30 | `a8d6a3df` |
| `EE-042` | `library/events/remove-listeners.spec.ts` | First test | 2024-07-30 | `65288010` |
| `EE-043` | `library/events/remove-listeners.spec.ts` | Second test | 2024-07-30 | `606b300b` |
| `EE-044` | `library/events/remove-listeners.spec.ts` | Third test | 2024-07-30 | `d448a26d` |
| `EE-045` | `library/events/remove-listeners.spec.ts` | Fourth test | 2024-07-30 | `2430283e` |
| `EE-046` | `library/events/remove-listeners.spec.ts` | Fifth test | 2024-07-30 | `03c80257` |
| `EE-047` | `library/events/remove-listeners.spec.ts` | Sixth test | 2024-07-30 | `a65e4d5b` |
| `EE-048` | `library/events/remove-listeners.spec.ts` | Seventh test | 2024-07-30 | `806f0c4b` |
| `EE-049` | `library/events/remove-listeners.spec.ts` | Eighth test | 2024-07-30 | `1f286917` |
| `EE-050` | `library/events/remove-listeners.spec.ts` | Ninth test | 2024-07-30 | `d96d15e4` |
| `EE-051` | `library/events/remove-listeners.spec.ts` | Tenth test | 2024-07-30 | `107e84f8` |
| `EE-052` | `library/events/set-max-listeners-side-effects.spec.ts` | set max listeners test | 2024-07-30 | `49762cce` |
| `EE-053` | `library/events/special-event-names.spec.ts` | should support special event names | 2024-07-30 | `434ca05a` |
| `EE-054` | `library/events/subclass.spec.ts` | myee instance | 2024-07-30 | `c07ca452` |
| `EE-055` | `library/events/subclass.spec.ts` | MyEE2 instance | 2024-07-30 | `88dff5a8` |
| `EE-056` | `library/events/symbols.spec.ts` | should support symbols | 2024-08-06 | `407ee55a` |

### EF — Expose function

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EF-001` | `page/page-expose-function.spec.ts` | exposeBinding should work @smoke | 2022-03-10 | `8bf3ce4c` |
| `EF-002` | `page/page-expose-function.spec.ts` | should work | 2020-08-11 | `658d4d3b` |
| `EF-003` | `page/page-expose-function.spec.ts` | should dispose | 2026-03-04 | `b6b7f1e3` |
| `EF-004` | `page/page-expose-function.spec.ts` | should work with handles and complex objects | 2020-08-11 | `5bb4e021` |
| `EF-005` | `page/page-expose-function.spec.ts` | should throw exception in page context | 2020-08-28 | `9e43ff93` |
| `EF-006` | `page/page-expose-function.spec.ts` | should support throwing "null" | 2020-08-28 | `b74231d5` |
| `EF-007` | `page/page-expose-function.spec.ts` | should be callable from-inside addInitScript | 2025-05-01 | `11ba5a27` |
| `EF-008` | `page/page-expose-function.spec.ts` | should survive navigation | 2020-08-11 | `efc662af` |
| `EF-009` | `page/page-expose-function.spec.ts` | should await returned promise | 2020-08-11 | `a19f0f80` |
| `EF-010` | `page/page-expose-function.spec.ts` | should work on frames | 2020-08-11 | `cb0878c5` |
| `EF-011` | `page/page-expose-function.spec.ts` | should work on frames before navigation | 2020-08-11 | `20ae9c83` |
| `EF-012` | `page/page-expose-function.spec.ts` | should work after cross origin navigation | 2020-08-11 | `b89c401f` |
| `EF-013` | `page/page-expose-function.spec.ts` | should work with complex objects | 2020-08-11 | `4a339d09` |
| `EF-014` | `page/page-expose-function.spec.ts` | should throw for duplicate registrations | 2020-10-02 | `2792a78a` |
| `EF-015` | `page/page-expose-function.spec.ts` | should work with setContent | 2021-02-26 | `8cbec11d` |
| `EF-016` | `page/page-expose-function.spec.ts` | should alias Window, Document and Node | 2022-05-09 | `6a198750` |
| `EF-017` | `page/page-expose-function.spec.ts` | should serialize cycles | 2022-05-10 | `dbffc2e9` |
| `EF-018` | `page/page-expose-function.spec.ts` | should work with overridden console object | 2022-07-08 | `f95f7179` |
| `EF-019` | `page/page-expose-function.spec.ts` | should work with busted Array.prototype.map/push | 2023-04-21 | `ef26bd2f` |
| `EF-020` | `page/page-expose-function.spec.ts` | should fail with busted Array.prototype.toJSON | 2024-09-10 | `3ec7354d` |
| `EF-021` | `page/page-expose-function.spec.ts` | exposeBinding should work in parallel | 2025-10-06 | `2095afc7` |
| `EF-022` | `library/browsercontext-expose-function.spec.ts` | expose binding should work | 2023-10-23 | `05f02ef1` |
| `EF-023` | `library/browsercontext-expose-function.spec.ts` | should work | 2023-10-23 | `16b1d40d` |
| `EF-024` | `library/browsercontext-expose-function.spec.ts` | should dispose | 2026-03-04 | `0ed40030` |
| `EF-025` | `library/browsercontext-expose-function.spec.ts` | should throw for duplicate registrations | 2020-10-12 | `af3a3334` |
| `EF-026` | `library/browsercontext-expose-function.spec.ts` | should be callable from-inside addInitScript | 2025-05-01 | `4e6f4aa1` |
| `EF-027` | `library/browsercontext-expose-function.spec.ts` | should work with CSP | 2021-05-10 | `969da174` |
| `EF-028` | `library/browsercontext-expose-function.spec.ts` | should call binding from pagehide handler when navigating away | 2026-10-02 | `22afea68` |

### EH — ElementHandle

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EH-001` | `page/elementhandle-bounding-box.spec.ts` | should work | 2022-06-09 | `ba007a3e` |
| `EH-002` | `page/elementhandle-bounding-box.spec.ts` | should handle nested frames | 2025-12-03 | `a89e4d8c` |
| `EH-003` | `page/elementhandle-bounding-box.spec.ts` | should get frame box | 2023-05-14 | `02b0a646` |
| `EH-004` | `page/elementhandle-bounding-box.spec.ts` | should handle scroll offset and click | 2020-11-19 | `aae2b93d` |
| `EH-005` | `page/elementhandle-bounding-box.spec.ts` | should return null for invisible elements | 2020-08-03 | `a6a3a357` |
| `EH-006` | `page/elementhandle-bounding-box.spec.ts` | should get bounding box of element inside a cross-origin iframe | 2026-07-01 | `62591468` |
| `EH-007` | `page/elementhandle-bounding-box.spec.ts` | should force a layout | 2020-08-03 | `7ddea1ec` |
| `EH-008` | `page/elementhandle-bounding-box.spec.ts` | should work with SVG nodes | 2020-08-03 | `44f302a9` |
| `EH-009` | `page/elementhandle-bounding-box.spec.ts` | should work when inline box child is outside of viewport | 2020-08-03 | `3db68375` |
| `EH-010` | `page/elementhandle-click.spec.ts` | should work @smoke | 2022-03-10 | `6a9f7010` |
| `EH-011` | `page/elementhandle-click.spec.ts` | should work with Node removed | 2020-08-11 | `0a3617d5` |
| `EH-012` | `page/elementhandle-click.spec.ts` | should work for Shadow DOM v1 | 2020-08-11 | `e3a7d49b` |
| `EH-013` | `page/elementhandle-click.spec.ts` | should work for TextNodes | 2025-10-22 | `70320f35` |
| `EH-014` | `page/elementhandle-click.spec.ts` | should throw for detached nodes | 2020-08-03 | `66a576e5` |
| `EH-015` | `page/elementhandle-click.spec.ts` | should throw for hidden nodes with force | 2020-08-03 | `4d2927b9` |
| `EH-016` | `page/elementhandle-click.spec.ts` | should throw for recursively hidden nodes with force | 2020-08-03 | `80247a80` |
| `EH-017` | `page/elementhandle-click.spec.ts` | should throw for \<br\> elements with force | 2020-08-03 | `c717d090` |
| `EH-018` | `page/elementhandle-click.spec.ts` | should double click the button | 2020-08-11 | `4c5040b2` |
| `EH-019` | `page/elementhandle-content-frame.spec.ts` | should work | 2020-09-18 | `6b2c9941` |
| `EH-020` | `page/elementhandle-content-frame.spec.ts` | should work for cross-process iframes | 2020-09-18 | `0510e459` |
| `EH-021` | `page/elementhandle-content-frame.spec.ts` | should work for cross-frame evaluations | 2020-09-18 | `bf6cbe31` |
| `EH-022` | `page/elementhandle-content-frame.spec.ts` | should return null for non-iframes | 2020-09-18 | `1d9eb04c` |
| `EH-023` | `page/elementhandle-content-frame.spec.ts` | should return null for document.documentElement | 2020-09-18 | `e9b55cc9` |
| `EH-024` | `page/elementhandle-convenience.spec.ts` | should have a nice preview | 2020-08-03 | `18ad7b24` |
| `EH-025` | `page/elementhandle-convenience.spec.ts` | should have a nice preview for non-ascii attributes/children | 2024-05-31 | `0b914237` |
| `EH-026` | `page/elementhandle-convenience.spec.ts` | getAttribute should work | 2020-08-03 | `acf2d18c` |
| `EH-027` | `page/elementhandle-convenience.spec.ts` | inputValue should work | 2021-09-25 | `889e0a5a` |
| `EH-028` | `page/elementhandle-convenience.spec.ts` | innerHTML should work | 2020-08-03 | `a13ad61b` |
| `EH-029` | `page/elementhandle-convenience.spec.ts` | innerText should work | 2020-08-03 | `023eaee9` |
| `EH-030` | `page/elementhandle-convenience.spec.ts` | innerText should throw | 2021-09-25 | `45ff9a1a` |
| `EH-031` | `page/elementhandle-convenience.spec.ts` | textContent should work | 2020-08-03 | `d8abdcbf` |
| `EH-032` | `page/elementhandle-convenience.spec.ts` | textContent should work on ShadowRoot | 2023-08-24 | `8e59c47c` |
| `EH-033` | `page/elementhandle-convenience.spec.ts` | isVisible and isHidden should work | 2021-02-10 | `479ed1d5` |
| `EH-034` | `page/elementhandle-convenience.spec.ts` | isVisible should not throw when the DOM element is not connected | 2021-08-05 | `a2cb63b5` |
| `EH-035` | `page/elementhandle-convenience.spec.ts` | isEnabled and isDisabled should work | 2021-01-08 | `76842aef` |
| `EH-036` | `page/elementhandle-convenience.spec.ts` | isEnabled and isDisabled should work with \<select/\> option/optgroup correctly | 2022-03-01 | `956610fc` |
| `EH-037` | `page/elementhandle-convenience.spec.ts` | isEditable should work | 2021-01-08 | `ae71bf99` |
| `EH-038` | `page/elementhandle-convenience.spec.ts` | isChecked should work | 2021-01-09 | `accfebd1` |
| `EH-039` | `page/elementhandle-eval-on-selector.spec.ts` | should work | 2020-08-11 | `188892ce` |
| `EH-040` | `page/elementhandle-eval-on-selector.spec.ts` | should retrieve content from subtree | 2020-08-11 | `41f807ae` |
| `EH-041` | `page/elementhandle-eval-on-selector.spec.ts` | should throw in case of missing selector | 2023-10-12 | `94039a1f` |
| `EH-042` | `page/elementhandle-eval-on-selector.spec.ts` | should work for all | 2020-08-11 | `03d1fce6` |
| `EH-043` | `page/elementhandle-eval-on-selector.spec.ts` | should retrieve content from subtree for all | 2020-08-11 | `005dbc43` |
| `EH-044` | `page/elementhandle-eval-on-selector.spec.ts` | should not throw in case of missing selector for all | 2020-08-03 | `ab69fce0` |
| `EH-045` | `page/elementhandle-misc.spec.ts` | should hover | 2020-08-03 | `dd27f6b2` |
| `EH-046` | `page/elementhandle-misc.spec.ts` | should hover when Node is removed | 2020-08-03 | `ea1035f2` |
| `EH-047` | `page/elementhandle-misc.spec.ts` | should fill input | 2020-08-11 | `4681ff60` |
| `EH-048` | `page/elementhandle-misc.spec.ts` | should fill input when Node is removed | 2020-08-11 | `f4570d6a` |
| `EH-049` | `page/elementhandle-misc.spec.ts` | should check the box | 2020-08-11 | `6c18f60b` |
| `EH-050` | `page/elementhandle-misc.spec.ts` | should check the box using setChecked | 2021-08-30 | `a9b3cab3` |
| `EH-051` | `page/elementhandle-misc.spec.ts` | should uncheck the box | 2020-08-11 | `3406c9ed` |
| `EH-052` | `page/elementhandle-misc.spec.ts` | should select single option | 2020-08-11 | `21bebeb3` |
| `EH-053` | `page/elementhandle-misc.spec.ts` | should focus a button | 2020-08-03 | `9c510e75` |
| `EH-054` | `page/elementhandle-misc.spec.ts` | should allow disposing twice | 2024-03-15 | `fbdbca31` |
| `EH-055` | `page/elementhandle-owner-frame.spec.ts` | should work | 2020-09-18 | `a195d3c1` |
| `EH-056` | `page/elementhandle-owner-frame.spec.ts` | should work for cross-process iframes | 2020-09-18 | `0d03d31d` |
| `EH-057` | `page/elementhandle-owner-frame.spec.ts` | should work for document | 2021-01-22 | `13add427` |
| `EH-058` | `page/elementhandle-owner-frame.spec.ts` | should work for iframe elements | 2020-09-18 | `569abdb0` |
| `EH-059` | `page/elementhandle-owner-frame.spec.ts` | should work for cross-frame evaluations | 2020-09-18 | `85e7206e` |
| `EH-060` | `page/elementhandle-owner-frame.spec.ts` | should work for detached elements | 2020-08-03 | `79eb55a3` |
| `EH-061` | `page/elementhandle-owner-frame.spec.ts` | should work for adopted elements | 2022-07-28 | `d9974495` |
| `EH-062` | `page/elementhandle-press.spec.ts` | should work | 2020-08-03 | `d89cb1c5` |
| `EH-063` | `page/elementhandle-press.spec.ts` | should not select existing value | 2020-08-03 | `f959a9d2` |
| `EH-064` | `page/elementhandle-press.spec.ts` | should reset selection when not focused | 2020-08-03 | `9611f47c` |
| `EH-065` | `page/elementhandle-press.spec.ts` | should not modify selection when focused | 2020-08-03 | `0e927f7c` |
| `EH-066` | `page/elementhandle-press.spec.ts` | should work with number input | 2022-03-06 | `e50abf1f` |
| `EH-067` | `page/elementhandle-query-selector.spec.ts` | should query existing element | 2020-08-03 | `d49f42a7` |
| `EH-068` | `page/elementhandle-query-selector.spec.ts` | should return null for non-existing element | 2020-08-03 | `2d6b302a` |
| `EH-069` | `page/elementhandle-query-selector.spec.ts` | should work for adopted elements | 2022-07-28 | `4a7164fa` |
| `EH-070` | `page/elementhandle-query-selector.spec.ts` | should query existing elements | 2020-08-03 | `6df7a06b` |
| `EH-071` | `page/elementhandle-query-selector.spec.ts` | should return empty array for non-existing elements | 2020-08-03 | `fba06337` |
| `EH-072` | `page/elementhandle-query-selector.spec.ts` | xpath should query existing element | 2020-08-03 | `9ae33172` |
| `EH-073` | `page/elementhandle-query-selector.spec.ts` | xpath should return null for non-existing element | 2020-08-03 | `864b430a` |
| `EH-074` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work | 2020-10-06 | `4f4e8230` |
| `EH-075` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work with webp | 2026-07-17 | `707198c0` |
| `EH-076` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work when main world busts JSON.stringify | 2023-02-03 | `4d2c9ace` |
| `EH-077` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should take into account padding and border | 2024-11-21 | `75a85bf9` |
| `EH-078` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport in parallel | 2022-07-07 | `a96e8abf` |
| `EH-079` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport | 2020-10-06 | `c2cdded2` |
| `EH-080` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should scroll element into view | 2020-10-06 | `cbb54501` |
| `EH-081` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should scroll 15000px into view | 2020-10-06 | `da289fd6` |
| `EH-082` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work with a rotated element | 2020-10-06 | `d16530ac` |
| `EH-083` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should fail to screenshot a detached element | 2020-08-28 | `fbc8ac29` |
| `EH-084` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should timeout waiting for visible | 2020-08-28 | `f7ae4752` |
| `EH-085` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should wait for visible | 2024-05-31 | `c3920ac3` |
| `EH-086` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work for an element with fractional dimensions | 2022-07-28 | `41008016` |
| `EH-087` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work for an element with an offset | 2022-07-28 | `dc020b44` |
| `EH-088` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should wait for element to stop moving | 2024-05-31 | `11e8f9dd` |
| `EH-089` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should take screenshot of disabled button | 2021-04-05 | `ad19b0cb` |
| `EH-090` | `page/elementhandle-screenshot.spec.ts` | element screenshot › path option should create subdirectories | 2021-04-05 | `1fd48194` |
| `EH-091` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should prefer type over extension | 2021-04-05 | `ff1b0a46` |
| `EH-092` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should not issue resize event | 2021-04-05 | `8fad2166` |
| `EH-093` | `page/elementhandle-scroll-into-view.spec.ts` | should work @smoke | 2022-03-10 | `66dddb0e` |
| `EH-094` | `page/elementhandle-scroll-into-view.spec.ts` | should throw for detached element | 2020-08-03 | `ebc40343` |
| `EH-095` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for display:none to become visible | 2020-08-03 | `3c166365` |
| `EH-096` | `page/elementhandle-scroll-into-view.spec.ts` | should scroll display:contents into view | 2024-08-05 | `1743da99` |
| `EH-097` | `page/elementhandle-scroll-into-view.spec.ts` | should work for visibility:hidden element | 2022-04-23 | `065b9739` |
| `EH-098` | `page/elementhandle-scroll-into-view.spec.ts` | should work for zero-sized element | 2022-04-23 | `cc14dda4` |
| `EH-099` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for nested display:none to become visible | 2020-08-03 | `f228c00c` |
| `EH-100` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for element to stop moving | 2020-08-03 | `7b1eb0f5` |
| `EH-101` | `page/elementhandle-scroll-into-view.spec.ts` | should timeout waiting for visible | 2024-01-17 | `329519d3` |
| `EH-102` | `page/elementhandle-select-text.spec.ts` | should select textarea | 2021-05-13 | `c36770b7` |
| `EH-103` | `page/elementhandle-select-text.spec.ts` | should select input | 2021-05-13 | `d32931c4` |
| `EH-104` | `page/elementhandle-select-text.spec.ts` | should select plain div | 2020-08-03 | `a0d026a1` |
| `EH-105` | `page/elementhandle-select-text.spec.ts` | should timeout waiting for invisible element | 2020-08-03 | `a308e7e4` |
| `EH-106` | `page/elementhandle-select-text.spec.ts` | should wait for visible | 2024-05-31 | `7ffe144b` |
| `EH-107` | `page/elementhandle-type.spec.ts` | should work | 2020-08-03 | `4d0391bd` |
| `EH-108` | `page/elementhandle-type.spec.ts` | should not select existing value | 2020-08-03 | `5bce8cf3` |
| `EH-109` | `page/elementhandle-type.spec.ts` | should reset selection when not focused | 2020-08-03 | `707ea543` |
| `EH-110` | `page/elementhandle-type.spec.ts` | should not modify selection when focused | 2020-08-03 | `d52d3d0c` |
| `EH-111` | `page/elementhandle-type.spec.ts` | should work with number input | 2022-03-06 | `033ae853` |
| `EH-112` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for visible | 2020-08-17 | `16ec0394` |
| `EH-113` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for already visible | 2020-08-17 | `7197c1a2` |
| `EH-114` | `page/elementhandle-wait-for-element-state.spec.ts` | should timeout waiting for visible | 2020-08-17 | `29ef84ee` |
| `EH-115` | `page/elementhandle-wait-for-element-state.spec.ts` | should throw waiting for visible when detached | 2020-08-17 | `64cb4b6d` |
| `EH-116` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for hidden | 2020-08-17 | `abe414cb` |
| `EH-117` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for already hidden | 2020-08-17 | `356a4044` |
| `EH-118` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for hidden when detached | 2020-08-17 | `25f1b16d` |
| `EH-119` | `page/elementhandle-wait-for-element-state.spec.ts` | should throw waiting for enabled when detached | 2020-08-17 | `1849ab56` |
| `EH-120` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for aria enabled button | 2021-11-22 | `016304f0` |
| `EH-121` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for button with an aria-disabled parent | 2022-03-28 | `f6648ac8` |
| `EH-122` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for stable position | 2024-05-31 | `4ad2438d` |
| `EH-123` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for editable input | 2021-01-08 | `17cb1d8a` |

### EM — Emulation

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EM-001` | `page/page-emulate-media.spec.ts` | should emulate type @smoke | 2022-03-10 | `a922da7b` |
| `EM-002` | `page/page-emulate-media.spec.ts` | should throw in case of bad media argument | 2022-10-31 | `ebdb9813` |
| `EM-003` | `page/page-emulate-media.spec.ts` | should emulate colorScheme should work @smoke | 2022-03-10 | `0de936db` |
| `EM-004` | `page/page-emulate-media.spec.ts` | should default to light | 2021-03-18 | `31bec364` |
| `EM-005` | `page/page-emulate-media.spec.ts` | should throw in case of bad colorScheme argument | 2022-10-31 | `9a02381e` |
| `EM-006` | `page/page-emulate-media.spec.ts` | should work during navigation | 2020-08-11 | `33eb3041` |
| `EM-007` | `page/page-emulate-media.spec.ts` | should change the actual colors in css | 2020-08-28 | `4889e38b` |
| `EM-008` | `page/page-emulate-media.spec.ts` | should emulate reduced motion | 2021-05-21 | `64b29e78` |
| `EM-009` | `page/page-emulate-media.spec.ts` | should keep reduced motion and color emulation after reload | 2025-12-10 | `fcf8bc19` |
| `EM-010` | `page/page-emulate-media.spec.ts` | should emulate forcedColors  | 2022-07-28 | `3dd3b89b` |
| `EM-011` | `page/page-emulate-media.spec.ts` | should emulate contrast  | 2025-02-04 | `d7b24c64` |
| `EM-012` | `page/page-emulate-media.spec.ts` | should report hover and fine pointer for desktop | 2026-05-06 | `c419ff0a` |
| `EM-013` | `library/emulation-focus.spec.ts` | should think that it is focused by default | 2020-08-03 | `03fcd6bb` |
| `EM-014` | `library/emulation-focus.spec.ts` | should think that all pages are focused @smoke | 2022-03-10 | `fcfca7bc` |
| `EM-015` | `library/emulation-focus.spec.ts` | should focus popups by default | 2020-08-03 | `7914fe19` |
| `EM-016` | `library/emulation-focus.spec.ts` | should provide target for keyboard events | 2021-05-06 | `97b46a28` |
| `EM-017` | `library/emulation-focus.spec.ts` | should not affect mouse event target page | 2021-05-06 | `041eacf9` |
| `EM-018` | `library/emulation-focus.spec.ts` | should change document.activeElement | 2021-05-06 | `ee9bdece` |
| `EM-019` | `library/emulation-focus.spec.ts` | should not affect screenshots | 2025-05-28 | `f26335f8` |
| `EM-020` | `library/emulation-focus.spec.ts` | should change focused iframe | 2022-06-09 | `aa5afa67` |
| `EM-021` | `library/emulation-focus.spec.ts` | should focus with more than one page/context | 2021-04-05 | `2836f55f` |
| `EM-022` | `library/emulation-focus.spec.ts` | should not fire blur events when interacting with more than one page/context | 2024-04-18 | `b6cc9c6b` |
| `EM-023` | `library/emulation-focus.spec.ts` | should not blur iframe when interacting with another page/context | 2026-10-16 | `8690255f` |
| `EM-024` | `library/emulation-focus.spec.ts` | should trigger hover state concurrently | 2026-07-09 | `63ea51d6` |
| `EM-025` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve context options | 2026-10-14 | `f13a3dac` |
| `EM-026` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve page.emulateMedia | 2026-10-14 | `db7e4964` |
| `EM-027` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve mobile emulation | 2026-10-14 | `92550503` |

### ER — Page errors and crashes

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `ER-001` | `page/page-event-pageerror.spec.ts` | should fire | 2026-10-16 | `90e22d68` |
| `ER-002` | `page/page-event-pageerror.spec.ts` | should not receive console message for pageError | 2025-12-15 | `b6b4e1f7` |
| `ER-003` | `page/page-event-pageerror.spec.ts` | should contain sourceURL | 2021-05-13 | `668281fb` |
| `ER-004` | `page/page-event-pageerror.spec.ts` | should contain the Error.name property | 2025-03-25 | `e6014a01` |
| `ER-005` | `page/page-event-pageerror.spec.ts` | should support an empty Error.name property | 2025-03-25 | `cbb7cb68` |
| `ER-006` | `page/page-event-pageerror.spec.ts` | should handle odd values | 2025-03-25 | `cb090835` |
| `ER-007` | `page/page-event-pageerror.spec.ts` | should handle object | 2025-03-25 | `3635ebf2` |
| `ER-008` | `page/page-event-pageerror.spec.ts` | should handle window | 2025-03-25 | `512c0845` |
| `ER-009` | `page/page-event-pageerror.spec.ts` | should remove a listener of a non-existing event handler | 2022-06-29 | `5b763fe8` |
| `ER-010` | `page/page-event-pageerror.spec.ts` | should emit error from unhandled rejects | 2022-07-06 | `87085421` |
| `ER-011` | `page/page-event-pageerror.spec.ts` | pageErrors should work | 2025-12-01 | `fdd225a0` |
| `ER-012` | `page/page-event-pageerror.spec.ts` | clearPageErrors should work | 2026-02-13 | `7b898229` |
| `ER-013` | `page/page-event-pageerror.spec.ts` | should fire illegal character error | 2026-06-15 | `308addbd` |
| `ER-014` | `library/page-event-crash.spec.ts` | should emit crash event when page crashes | 2023-03-17 | `ac2a47fc` |
| `ER-015` | `library/page-event-crash.spec.ts` | should throw on any action after page crashes | 2026-06-19 | `390587c2` |
| `ER-016` | `library/page-event-crash.spec.ts` | expect should not hang when page crashed | 2026-06-19 | `2ef38d7e` |
| `ER-017` | `library/page-event-crash.spec.ts` | should cancel waitForEvent when page crashes | 2023-03-17 | `69bf302c` |
| `ER-018` | `library/page-event-crash.spec.ts` | should cancel navigation when page crashes | 2023-07-11 | `7a30abb8` |
| `ER-019` | `library/page-event-crash.spec.ts` | should be able to close context when page crashes | 2025-12-09 | `97674f2e` |
| `ER-020` | `library/page-event-crash.spec.ts` | should be able to close page after crash | 2026-10-01 | `e5391cae` |
| `ER-021` | `library/page-event-crash.spec.ts` | should reject in-flight worker.evaluate when page crashes | 2026-10-08 | `4bf3b2b6` |

### ES — Eval on selector

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `ES-001` | `page/eval-on-selector.spec.ts` | should work with css selector | 2020-08-03 | `284599d8` |
| `ES-002` | `page/eval-on-selector.spec.ts` | should work with id selector | 2020-08-03 | `a202281f` |
| `ES-003` | `page/eval-on-selector.spec.ts` | should work with data-test selector | 2020-08-03 | `5afbe1e0` |
| `ES-004` | `page/eval-on-selector.spec.ts` | should work with data-testid selector | 2020-08-03 | `60fd781e` |
| `ES-005` | `page/eval-on-selector.spec.ts` | should work with data-test-id selector | 2020-08-03 | `86701033` |
| `ES-006` | `page/eval-on-selector.spec.ts` | should work with text selector in quotes | 2021-07-09 | `0c196bd2` |
| `ES-007` | `page/eval-on-selector.spec.ts` | should work with xpath selector | 2020-08-03 | `952bc663` |
| `ES-008` | `page/eval-on-selector.spec.ts` | should work with text selector | 2020-08-03 | `adf1aab2` |
| `ES-009` | `page/eval-on-selector.spec.ts` | should auto-detect css selector | 2020-08-03 | `dc77c69c` |
| `ES-010` | `page/eval-on-selector.spec.ts` | should auto-detect css selector with attributes | 2020-08-03 | `4cd5e6b7` |
| `ES-011` | `page/eval-on-selector.spec.ts` | should auto-detect nested selectors | 2020-08-03 | `4a201423` |
| `ES-012` | `page/eval-on-selector.spec.ts` | should accept arguments | 2020-08-03 | `c3702016` |
| `ES-013` | `page/eval-on-selector.spec.ts` | should accept ElementHandles as arguments | 2020-08-03 | `cba1eaa7` |
| `ES-014` | `page/eval-on-selector.spec.ts` | should throw error if no element is found | 2023-10-12 | `fffd35e2` |
| `ES-015` | `page/eval-on-selector.spec.ts` | should support \>\> syntax | 2020-08-03 | `d81ba90f` |
| `ES-016` | `page/eval-on-selector.spec.ts` | should support \>\> syntax with different engines | 2020-08-03 | `8025b591` |
| `ES-017` | `page/eval-on-selector.spec.ts` | should support spaces with \>\> syntax | 2020-08-03 | `6dd8f586` |
| `ES-018` | `page/eval-on-selector.spec.ts` | should not stop at first failure with \>\> syntax | 2020-08-03 | `957ed3b4` |
| `ES-019` | `page/eval-on-selector.spec.ts` | should support \* capture | 2020-08-03 | `4f7f2f41` |
| `ES-020` | `page/eval-on-selector.spec.ts` | should throw on multiple \* captures | 2020-08-03 | `ab7ceb23` |
| `ES-021` | `page/eval-on-selector.spec.ts` | should throw on malformed \* capture | 2020-08-03 | `f9cffafa` |
| `ES-022` | `page/eval-on-selector.spec.ts` | should work with spaces in css attributes | 2020-08-03 | `d03d4d95` |
| `ES-023` | `page/eval-on-selector.spec.ts` | should work with quotes in css attributes | 2020-08-03 | `23b8a76a` |
| `ES-024` | `page/eval-on-selector.spec.ts` | should work with spaces in css attributes when missing | 2020-08-03 | `9ee26bdd` |
| `ES-025` | `page/eval-on-selector.spec.ts` | should work with quotes in css attributes when missing | 2020-08-03 | `c5af8783` |
| `ES-026` | `page/eval-on-selector.spec.ts` | should return complex values | 2020-08-03 | `d05ae1a5` |
| `ES-027` | `page/eval-on-selector-all.spec.ts` | should work with css selector | 2020-08-03 | `3a2101fd` |
| `ES-028` | `page/eval-on-selector-all.spec.ts` | should work with text selector | 2020-08-03 | `845c9d8d` |
| `ES-029` | `page/eval-on-selector-all.spec.ts` | should work with xpath selector | 2020-08-03 | `36609358` |
| `ES-030` | `page/eval-on-selector-all.spec.ts` | should auto-detect css selector | 2020-08-03 | `0eabac04` |
| `ES-031` | `page/eval-on-selector-all.spec.ts` | should support \>\> syntax | 2020-08-03 | `3cbd445e` |
| `ES-032` | `page/eval-on-selector-all.spec.ts` | should support \* capture | 2020-08-03 | `9e4976ed` |
| `ES-033` | `page/eval-on-selector-all.spec.ts` | should support \* capture when multiple paths match | 2020-08-03 | `3efba94e` |
| `ES-034` | `page/eval-on-selector-all.spec.ts` | should return complex values | 2020-08-03 | `0c953b09` |
| `ES-035` | `page/eval-on-selector-all.spec.ts` | should work with bogus Array.from | 2021-06-03 | `daa1ebd4` |

### EV — Evaluate

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EV-001` | `page/page-evaluate.spec.ts` | should work @smoke | 2022-03-10 | `39028106` |
| `EV-002` | `page/page-evaluate.spec.ts` | should transfer NaN | 2021-03-18 | `9c5aaa18` |
| `EV-003` | `page/page-evaluate.spec.ts` | should transfer -0 | 2021-03-18 | `6f76e27a` |
| `EV-004` | `page/page-evaluate.spec.ts` | should transfer Infinity | 2021-03-18 | `57108975` |
| `EV-005` | `page/page-evaluate.spec.ts` | should transfer -Infinity | 2021-03-18 | `b23a4a49` |
| `EV-006` | `page/page-evaluate.spec.ts` | should roundtrip unserializable values | 2020-08-03 | `55e18948` |
| `EV-007` | `page/page-evaluate.spec.ts` | should roundtrip promise to value | 2020-08-03 | `3cf0e365` |
| `EV-008` | `page/page-evaluate.spec.ts` | should roundtrip promise to unserializable values | 2020-08-03 | `78688dea` |
| `EV-009` | `page/page-evaluate.spec.ts` | should transfer arrays | 2021-03-18 | `79fbe805` |
| `EV-010` | `page/page-evaluate.spec.ts` | should transfer arrays as arrays, not objects | 2021-03-18 | `f8f153b3` |
| `EV-011` | `page/page-evaluate.spec.ts` | should transfer typed arrays | 2025-03-26 | `11e1a682` |
| `EV-012` | `page/page-evaluate.spec.ts` | should transfer bigint | 2023-06-28 | `c7e4cfa2` |
| `EV-013` | `page/page-evaluate.spec.ts` | should transfer maps as empty objects | 2026-09-14 | `a6f8d5a6` |
| `EV-014` | `page/page-evaluate.spec.ts` | should transfer sets as empty objects | 2026-09-14 | `6bea103a` |
| `EV-015` | `page/page-evaluate.spec.ts` | should modify global environment | 2020-08-11 | `ca3e72e5` |
| `EV-016` | `page/page-evaluate.spec.ts` | should evaluate in the page context | 2020-08-03 | `8b9dd036` |
| `EV-017` | `page/page-evaluate.spec.ts` | should return undefined for objects with symbols | 2021-03-18 | `25598fb4` |
| `EV-018` | `page/page-evaluate.spec.ts` | should work with function shorthands | 2021-04-02 | `735a0122` |
| `EV-019` | `page/page-evaluate.spec.ts` | should work with unicode chars | 2021-03-18 | `40b3962b` |
| `EV-020` | `page/page-evaluate.spec.ts` | should work with large strings | 2026-05-13 | `0ed52e7c` |
| `EV-021` | `page/page-evaluate.spec.ts` | should work with large unicode strings | 2026-05-13 | `fe22d453` |
| `EV-022` | `page/page-evaluate.spec.ts` | should throw when evaluation triggers reload | 2021-03-18 | `52ba3f8e` |
| `EV-023` | `page/page-evaluate.spec.ts` | should await promise | 2021-03-18 | `00876ff7` |
| `EV-024` | `page/page-evaluate.spec.ts` | should work right after framenavigated | 2020-08-03 | `25f13890` |
| `EV-025` | `page/page-evaluate.spec.ts` | should work right after a cross-origin navigation | 2020-08-03 | `386cac80` |
| `EV-026` | `page/page-evaluate.spec.ts` | should work from-inside an exposed function | 2021-03-18 | `8715c007` |
| `EV-027` | `page/page-evaluate.spec.ts` | should reject promise with exception | 2021-03-18 | `b96b06f8` |
| `EV-028` | `page/page-evaluate.spec.ts` | should support thrown strings as error messages | 2021-03-18 | `24edbdb9` |
| `EV-029` | `page/page-evaluate.spec.ts` | should support thrown numbers as error messages | 2021-03-18 | `78ae6472` |
| `EV-030` | `page/page-evaluate.spec.ts` | should reject when a falsy value is thrown | 2026-09-16 | `6f164ce9` |
| `EV-031` | `page/page-evaluate.spec.ts` | should include a non-error rejection value in the error message | 2026-09-16 | `733f13cf` |
| `EV-032` | `page/page-evaluate.spec.ts` | should return complex objects | 2021-03-18 | `06fa89f0` |
| `EV-033` | `page/page-evaluate.spec.ts` | should return NaN | 2021-03-18 | `64a25f97` |
| `EV-034` | `page/page-evaluate.spec.ts` | should return -0 | 2021-03-18 | `41f954ce` |
| `EV-035` | `page/page-evaluate.spec.ts` | should return Infinity | 2021-03-18 | `8e758299` |
| `EV-036` | `page/page-evaluate.spec.ts` | should return -Infinity | 2021-03-18 | `b190a788` |
| `EV-037` | `page/page-evaluate.spec.ts` | should work with overwritten Promise | 2026-10-15 | `30ed5da3` |
| `EV-038` | `page/page-evaluate.spec.ts` | should throw when passed more than one parameter | 2021-03-18 | `49d4271b` |
| `EV-039` | `page/page-evaluate.spec.ts` | should accept "undefined" as one of multiple parameters | 2021-03-18 | `bee0c41b` |
| `EV-040` | `page/page-evaluate.spec.ts` | should properly serialize undefined arguments | 2020-08-03 | `a54a8b90` |
| `EV-041` | `page/page-evaluate.spec.ts` | should properly serialize undefined fields | 2020-08-03 | `19276729` |
| `EV-042` | `page/page-evaluate.spec.ts` | should return undefined properties | 2020-08-03 | `aef7446b` |
| `EV-043` | `page/page-evaluate.spec.ts` | should properly serialize null arguments | 2020-08-03 | `6eab6760` |
| `EV-044` | `page/page-evaluate.spec.ts` | should properly serialize null fields | 2020-08-03 | `0ea2e30b` |
| `EV-045` | `page/page-evaluate.spec.ts` | should properly serialize PerformanceMeasure object | 2026-07-06 | `6eede2ca` |
| `EV-046` | `page/page-evaluate.spec.ts` | should properly serialize window.performance object | 2025-10-08 | `6aca323f` |
| `EV-047` | `page/page-evaluate.spec.ts` | should return undefined for non-serializable objects | 2022-05-10 | `c02ff8f4` |
| `EV-048` | `page/page-evaluate.spec.ts` | should throw for too deep reference chain | 2026-05-04 | `9194601c` |
| `EV-049` | `page/page-evaluate.spec.ts` | should throw for too deep reference chain 2 | 2026-06-04 | `3753e3ff` |
| `EV-050` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable shallow function | 2026-10-15 | `2a242274` |
| `EV-051` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable object one deep function | 2026-10-15 | `c9ac3d6f` |
| `EV-052` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable object nested function | 2026-10-15 | `706575bd` |
| `EV-053` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable array nested function | 2026-10-15 | `1bcdabcc` |
| `EV-054` | `page/page-evaluate.spec.ts` | should alias Window, Document and Node | 2022-05-10 | `2e4605f9` |
| `EV-055` | `page/page-evaluate.spec.ts` | should work for circular object | 2022-05-10 | `db48bc58` |
| `EV-056` | `page/page-evaluate.spec.ts` | should be able to throw a tricky error | 2021-03-18 | `04df2f40` |
| `EV-057` | `page/page-evaluate.spec.ts` | should accept a string | 2021-03-18 | `526476d7` |
| `EV-058` | `page/page-evaluate.spec.ts` | should accept a string with semi colons | 2021-03-18 | `c74de8ac` |
| `EV-059` | `page/page-evaluate.spec.ts` | should accept a string with comments | 2021-03-18 | `74d93a4c` |
| `EV-060` | `page/page-evaluate.spec.ts` | should accept element handle as an argument | 2021-03-18 | `9bcb1373` |
| `EV-061` | `page/page-evaluate.spec.ts` | should throw if underlying element was disposed | 2023-11-01 | `63689af3` |
| `EV-062` | `page/page-evaluate.spec.ts` | should simulate a user gesture | 2021-03-18 | `e3629a8c` |
| `EV-063` | `page/page-evaluate.spec.ts` | should throw a nice error after a navigation | 2021-03-18 | `32046eb3` |
| `EV-064` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a navigation | 2020-08-11 | `3e9cc3d9` |
| `EV-065` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a synchronous navigation and returns an object | 2023-01-30 | `7953fb0c` |
| `EV-066` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a synchronous navigation and returns undefined | 2023-01-30 | `a925b5f6` |
| `EV-067` | `page/page-evaluate.spec.ts` | should transfer 100Mb of data from page to node.js | 2021-04-02 | `9568010c` |
| `EV-068` | `page/page-evaluate.spec.ts` | should throw error with detailed information on exception inside promise  | 2020-09-26 | `a2680ada` |
| `EV-069` | `page/page-evaluate.spec.ts` | should work even when JSON is set to null | 2020-08-03 | `0e58a66f` |
| `EV-070` | `page/page-evaluate.spec.ts` | should await promise from popup | 2020-08-28 | `e58ad04e` |
| `EV-071` | `page/page-evaluate.spec.ts` | should work with new Function() and CSP | 2020-08-03 | `10839369` |
| `EV-072` | `page/page-evaluate.spec.ts` | should work with non-strict expressions | 2020-08-11 | `7c2ec0f3` |
| `EV-073` | `page/page-evaluate.spec.ts` | should respect use strict expression | 2020-09-26 | `b16ffd19` |
| `EV-074` | `page/page-evaluate.spec.ts` | should not leak utility script | 2026-04-28 | `60a62a31` |
| `EV-075` | `page/page-evaluate.spec.ts` | should not leak handles | 2020-09-26 | `eb2d0a02` |
| `EV-076` | `page/page-evaluate.spec.ts` | should work with CSP | 2020-08-03 | `f350deb6` |
| `EV-077` | `page/page-evaluate.spec.ts` | should evaluate exception with a function on the stack | 2024-07-15 | `28db4d8e` |
| `EV-078` | `page/page-evaluate.spec.ts` | should evaluate exception | 2024-07-15 | `6b8fe724` |
| `EV-079` | `page/page-evaluate.spec.ts` | should pass exception argument | 2024-07-15 | `fa5fafc5` |
| `EV-080` | `page/page-evaluate.spec.ts` | should evaluate date | 2020-08-03 | `423352e0` |
| `EV-081` | `page/page-evaluate.spec.ts` | should roundtrip date | 2020-08-03 | `29b25672` |
| `EV-082` | `page/page-evaluate.spec.ts` | should roundtrip regex | 2020-08-03 | `e12142a4` |
| `EV-083` | `page/page-evaluate.spec.ts` | should jsonValue() date | 2020-08-03 | `f2d12d85` |
| `EV-084` | `page/page-evaluate.spec.ts` | should evaluate url | 2022-07-05 | `f9385c90` |
| `EV-085` | `page/page-evaluate.spec.ts` | should roundtrip url | 2022-07-05 | `243a4a4b` |
| `EV-086` | `page/page-evaluate.spec.ts` | should jsonValue() url | 2022-07-05 | `70644b12` |
| `EV-087` | `page/page-evaluate.spec.ts` | should not use toJSON when evaluating | 2020-09-26 | `750d445c` |
| `EV-088` | `page/page-evaluate.spec.ts` | should not use Array.prototype.toJSON when evaluating | 2021-06-10 | `b90770d0` |
| `EV-089` | `page/page-evaluate.spec.ts` | should not add a toJSON property to newly created Arrays after evaluation | 2021-06-23 | `da542ed0` |
| `EV-090` | `page/page-evaluate.spec.ts` | should not use toJSON in jsonValue | 2020-09-26 | `4827bd72` |
| `EV-091` | `page/page-evaluate.spec.ts` | should ignore buggy toJSON | 2023-09-21 | `87a13110` |
| `EV-092` | `page/page-evaluate.spec.ts` | should not expose the injected script export | 2021-01-09 | `c34bceb5` |
| `EV-093` | `page/page-evaluate.spec.ts` | should throw when frame is detached | 2021-11-03 | `558f848d` |
| `EV-094` | `page/page-evaluate.spec.ts` | should work with overridden Object.defineProperty | 2022-09-07 | `7968ea22` |
| `EV-095` | `page/page-evaluate.spec.ts` | should work with busted Array.prototype.map/push | 2023-04-21 | `f3fabb69` |
| `EV-096` | `page/page-evaluate.spec.ts` | should work with overridden globalThis.Window/Document/Node | 2022-09-13 | `8d104901` |
| `EV-097` | `page/page-evaluate.spec.ts` | should work with overridden URL/Date/RegExp | 2023-03-10 | `52ecbe3a` |
| `EV-098` | `page/page-evaluate.spec.ts` | should work with Array.from/map | 2023-12-08 | `0675faa4` |
| `EV-099` | `page/page-evaluate.spec.ts` | should work with a using declaration | 2026-10-01 | `b1a7e22f` |
| `EV-100` | `page/page-evaluate.spec.ts` | should ignore dangerous object keys | 2025-05-14 | `1728711a` |
| `EV-101` | `page/page-evaluate-handle.spec.ts` | should work | 2021-03-18 | `29ef18d3` |
| `EV-102` | `page/page-evaluate-handle.spec.ts` | should accept object handle as an argument | 2021-03-18 | `6e74138c` |
| `EV-103` | `page/page-evaluate-handle.spec.ts` | should accept object handle to primitive types | 2021-03-18 | `5623baf7` |
| `EV-104` | `page/page-evaluate-handle.spec.ts` | should accept nested handle | 2021-03-18 | `ba596325` |
| `EV-105` | `page/page-evaluate-handle.spec.ts` | should accept nested window handle | 2021-03-18 | `f5bed9bb` |
| `EV-106` | `page/page-evaluate-handle.spec.ts` | should accept multiple nested handles | 2021-03-18 | `0731c362` |
| `EV-107` | `page/page-evaluate-handle.spec.ts` | should accept same handle multiple times | 2021-03-18 | `f9a0abcb` |
| `EV-108` | `page/page-evaluate-handle.spec.ts` | should accept same nested object multiple times | 2021-03-18 | `ca50af63` |
| `EV-109` | `page/page-evaluate-handle.spec.ts` | should accept object handle to unserializable value | 2021-03-18 | `49aac5af` |
| `EV-110` | `page/page-evaluate-handle.spec.ts` | should pass configurable args | 2021-03-18 | `63494567` |
| `EV-111` | `page/page-evaluate-handle.spec.ts` | should work with primitives | 2021-03-18 | `87af2095` |
| `EV-112` | `page/page-evaluate-callback.spec.ts` | should throw without the exposeFunctions option | 2026-10-15 | `15a944d0` |
| `EV-113` | `page/page-evaluate-callback.spec.ts` | should call a function passed as an argument | 2026-07-20 | `a9a6cfb4` |
| `EV-114` | `page/page-evaluate-callback.spec.ts` | should accept a function as the whole argument | 2026-07-16 | `af6760c0` |
| `EV-115` | `page/page-evaluate-callback.spec.ts` | should pass arguments to the callback | 2026-07-16 | `1bc832d3` |
| `EV-116` | `page/page-evaluate-callback.spec.ts` | should return the callback result to the page | 2026-07-16 | `5903348f` |
| `EV-117` | `page/page-evaluate-callback.spec.ts` | should support handle as a callback result | 2026-07-20 | `72e14485` |
| `EV-118` | `page/page-evaluate-callback.spec.ts` | should support nested handles in the callback result | 2026-07-20 | `84dbd754` |
| `EV-119` | `page/page-evaluate-callback.spec.ts` | should await an async callback result | 2026-07-16 | `642d829a` |
| `EV-120` | `page/page-evaluate-callback.spec.ts` | should propagate callback errors to the page | 2026-07-16 | `792b130a` |
| `EV-121` | `page/page-evaluate-callback.spec.ts` | should work with a fire-and-forget setTimeout callback | 2026-07-16 | `49b76e87` |
| `EV-122` | `page/page-evaluate-callback.spec.ts` | should support multiple callbacks | 2026-07-16 | `d9e796c8` |
| `EV-123` | `page/page-evaluate-callback.spec.ts` | should work with evaluateHandle | 2026-07-16 | `1f18561f` |
| `EV-124` | `page/page-evaluate-callback.spec.ts` | should work in a child frame | 2026-07-16 | `ec7368fa` |
| `EV-125` | `page/page-evaluate-callback.spec.ts` | should route callbacks back to the calling frame | 2026-07-23 | `9461097e` |
| `EV-126` | `page/page-evaluate-callback.spec.ts` | should work with jsHandle.evaluate | 2026-07-16 | `f7c0af47` |
| `EV-127` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluate | 2026-07-16 | `cbebbfa2` |
| `EV-128` | `page/page-evaluate-callback.spec.ts` | should return the callback result with locator.evaluate | 2026-07-16 | `37482076` |
| `EV-129` | `page/page-evaluate-callback.spec.ts` | should propagate callback errors with locator.evaluate | 2026-07-16 | `1d8f1bce` |
| `EV-130` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluateHandle | 2026-07-16 | `b0c887e5` |
| `EV-131` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluate inside an iframe | 2026-07-16 | `78c05ef9` |
| `EV-132` | `page/page-evaluate-callback.spec.ts` | should survive a navigation and keep working | 2026-07-16 | `a1f61ff8` |
| `EV-133` | `page/page-evaluate-callback.spec.ts` | should not register the callback on the global object | 2026-07-16 | `99750f7a` |
| `EV-134` | `page/page-evaluate-callback.spec.ts` | should scope the page-side callback to the execution context | 2026-07-16 | `9cf63c36` |
| `EV-135` | `page/page-evaluate-no-stall.spec.ts` | should work | 2021-04-29 | `a0bb06ca` |
| `EV-136` | `page/page-evaluate-no-stall.spec.ts` | should throw while pending navigation | 2023-06-02 | `79e86091` |
| `EV-137` | `page/page-evaluate-no-stall.spec.ts` | should throw when no main execution context | 2021-06-14 | `ce7c9b7d` |

### EX — Expect

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `EX-001` | `page/expect-boolean.spec.ts` | toBeChecked › default | 2022-08-10 | `58b06c8a` |
| `EX-002` | `page/expect-boolean.spec.ts` | toBeChecked › with checked:true | 2022-08-10 | `480b24de` |
| `EX-003` | `page/expect-boolean.spec.ts` | toBeChecked › with checked:false | 2022-08-10 | `cd3e9aeb` |
| `EX-004` | `page/expect-boolean.spec.ts` | toBeChecked › with indeterminate:true | 2025-01-10 | `55a71ce3` |
| `EX-005` | `page/expect-boolean.spec.ts` | toBeChecked › with indeterminate:true and checked | 2025-01-10 | `89dcd41f` |
| `EX-006` | `page/expect-boolean.spec.ts` | toBeChecked › fail | 2026-08-27 | `6c7ddcbc` |
| `EX-007` | `page/expect-boolean.spec.ts` | toBeChecked › with not | 2022-08-10 | `d12e7975` |
| `EX-008` | `page/expect-boolean.spec.ts` | toBeChecked › with not and checked:false | 2022-08-10 | `22d5ed49` |
| `EX-009` | `page/expect-boolean.spec.ts` | toBeChecked › fail with not | 2026-08-27 | `dbe72864` |
| `EX-010` | `page/expect-boolean.spec.ts` | toBeChecked › fail with checked:false | 2026-08-27 | `f915492b` |
| `EX-011` | `page/expect-boolean.spec.ts` | toBeChecked › fail with indeterminate: true | 2026-08-27 | `21c6a115` |
| `EX-012` | `page/expect-boolean.spec.ts` | toBeChecked › fail missing | 2026-08-27 | `a0512676` |
| `EX-013` | `page/expect-boolean.spec.ts` | toBeChecked › with role | 2022-10-25 | `ad75c05f` |
| `EX-014` | `page/expect-boolean.spec.ts` | toBeChecked › friendly log | 2022-11-17 | `824894fb` |
| `EX-015` | `page/expect-boolean.spec.ts` | toBeChecked › with impossible timeout | 2022-11-18 | `e9a69b31` |
| `EX-016` | `page/expect-boolean.spec.ts` | toBeChecked › with impossible timeout .not | 2022-11-18 | `91a0f9b6` |
| `EX-017` | `page/expect-boolean.spec.ts` | toBeEditable › default | 2022-09-06 | `70b93f56` |
| `EX-018` | `page/expect-boolean.spec.ts` | toBeEditable › with not | 2022-09-06 | `7c983e85` |
| `EX-019` | `page/expect-boolean.spec.ts` | toBeEditable › with editable:true | 2022-09-06 | `dadfef4d` |
| `EX-020` | `page/expect-boolean.spec.ts` | toBeEditable › with editable:false | 2022-09-06 | `b9a134d3` |
| `EX-021` | `page/expect-boolean.spec.ts` | toBeEditable › with not and editable:false | 2022-09-06 | `010a1371` |
| `EX-022` | `page/expect-boolean.spec.ts` | toBeEditable › throws | 2024-11-22 | `9d7aa421` |
| `EX-023` | `page/expect-boolean.spec.ts` | toBeEnabled › default | 2022-09-06 | `c601add3` |
| `EX-024` | `page/expect-boolean.spec.ts` | toBeEnabled › with enabled:true | 2022-09-06 | `eee95cc8` |
| `EX-025` | `page/expect-boolean.spec.ts` | toBeEnabled › with enabled:false | 2022-09-06 | `f573bce8` |
| `EX-026` | `page/expect-boolean.spec.ts` | toBeEnabled › failed | 2022-11-04 | `28539f99` |
| `EX-027` | `page/expect-boolean.spec.ts` | toBeEnabled › eventually | 2022-09-06 | `cea10837` |
| `EX-028` | `page/expect-boolean.spec.ts` | toBeEnabled › eventually with not | 2022-09-06 | `3bcd9dd6` |
| `EX-029` | `page/expect-boolean.spec.ts` | toBeEnabled › with not and enabled:false | 2022-09-06 | `50f3f2ca` |
| `EX-030` | `page/expect-boolean.spec.ts` | toBeEnabled › toBeDisabled | 2022-08-10 | `6ce32a72` |
| `EX-031` | `page/expect-boolean.spec.ts` | toBeEmpty input | 2022-08-10 | `ce918493` |
| `EX-032` | `page/expect-boolean.spec.ts` | not.toBeEmpty | 2022-08-10 | `9dd50ea3` |
| `EX-033` | `page/expect-boolean.spec.ts` | toBeEmpty div | 2022-08-10 | `264d5478` |
| `EX-034` | `page/expect-boolean.spec.ts` | toBeDisabled with value | 2022-08-10 | `d9fec802` |
| `EX-035` | `page/expect-boolean.spec.ts` | toBeChecked with value | 2022-08-10 | `40a5a486` |
| `EX-036` | `page/expect-boolean.spec.ts` | toBeHidden with value | 2022-08-10 | `cfd7383e` |
| `EX-037` | `page/expect-boolean.spec.ts` | not.toBeDisabled div | 2022-08-10 | `f13e44b5` |
| `EX-038` | `page/expect-boolean.spec.ts` | toBeVisible › default | 2022-09-09 | `8e94d67d` |
| `EX-039` | `page/expect-boolean.spec.ts` | toBeVisible › with not | 2022-09-09 | `20b51eee` |
| `EX-040` | `page/expect-boolean.spec.ts` | toBeVisible › with visible:true | 2022-09-09 | `b955126b` |
| `EX-041` | `page/expect-boolean.spec.ts` | toBeVisible › with visible:false | 2022-09-09 | `b3a1dd16` |
| `EX-042` | `page/expect-boolean.spec.ts` | toBeVisible › with not and visible:false | 2022-09-09 | `05bdc9b5` |
| `EX-043` | `page/expect-boolean.spec.ts` | toBeVisible › eventually | 2022-09-09 | `e2ba7945` |
| `EX-044` | `page/expect-boolean.spec.ts` | toBeVisible › eventually with not | 2022-09-09 | `edf709a8` |
| `EX-045` | `page/expect-boolean.spec.ts` | toBeVisible › fail | 2022-11-04 | `47338c74` |
| `EX-046` | `page/expect-boolean.spec.ts` | toBeVisible › fail with not | 2022-11-04 | `9d5c33a6` |
| `EX-047` | `page/expect-boolean.spec.ts` | toBeVisible › with impossible timeout | 2022-11-18 | `0236f969` |
| `EX-048` | `page/expect-boolean.spec.ts` | toBeVisible › with impossible timeout .not | 2022-11-18 | `de6bbba7` |
| `EX-049` | `page/expect-boolean.spec.ts` | toBeVisible › with frameLocator | 2022-12-21 | `d09c766b` |
| `EX-050` | `page/expect-boolean.spec.ts` | toBeVisible › with frameLocator 2 | 2022-12-21 | `b6125615` |
| `EX-051` | `page/expect-boolean.spec.ts` | toBeVisible › over navigation | 2022-12-21 | `b92f4e52` |
| `EX-052` | `page/expect-boolean.spec.ts` | toBeHidden › default | 2022-09-09 | `29f5a1b9` |
| `EX-053` | `page/expect-boolean.spec.ts` | toBeHidden › when nothing matches | 2022-09-09 | `ee75b76c` |
| `EX-054` | `page/expect-boolean.spec.ts` | toBeHidden › with not | 2022-09-09 | `9f9105f1` |
| `EX-055` | `page/expect-boolean.spec.ts` | toBeHidden › eventually with not | 2022-09-09 | `51583ee4` |
| `EX-056` | `page/expect-boolean.spec.ts` | toBeHidden › eventually | 2022-09-09 | `f4cda645` |
| `EX-057` | `page/expect-boolean.spec.ts` | toBeHidden › fail | 2026-01-07 | `5071bece` |
| `EX-058` | `page/expect-boolean.spec.ts` | toBeHidden › fail with not | 2026-01-07 | `35058152` |
| `EX-059` | `page/expect-boolean.spec.ts` | toBeHidden › fail with not when nothing matching | 2026-08-27 | `15f9f64c` |
| `EX-060` | `page/expect-boolean.spec.ts` | toBeHidden › with impossible timeout .not | 2022-11-18 | `ed16a30e` |
| `EX-061` | `page/expect-boolean.spec.ts` | toBeHidden › with impossible timeout | 2022-11-18 | `e0a7eef7` |
| `EX-062` | `page/expect-boolean.spec.ts` | toBeFocused | 2022-08-10 | `520c5699` |
| `EX-063` | `page/expect-boolean.spec.ts` | toBeFocused with shadow elements | 2022-08-10 | `9f407563` |
| `EX-064` | `page/expect-boolean.spec.ts` | should print unknown engine error | 2022-08-10 | `cfb03e2f` |
| `EX-065` | `page/expect-boolean.spec.ts` | should print selector syntax error | 2025-01-15 | `37f97136` |
| `EX-066` | `page/expect-boolean.spec.ts` | toBeOK | 2022-08-10 | `21690226` |
| `EX-067` | `page/expect-boolean.spec.ts` | not.toBeOK | 2022-08-10 | `18093359` |
| `EX-068` | `page/expect-boolean.spec.ts` | toBeOK fail with invalid argument | 2022-08-10 | `a116ca49` |
| `EX-069` | `page/expect-boolean.spec.ts` | toBeOK fail with promise | 2022-12-27 | `eedeeaa3` |
| `EX-070` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › text content type | 2025-09-10 | `fa947d87` |
| `EX-071` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › no content type | 2022-08-10 | `44bd55e6` |
| `EX-072` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › image content type | 2022-08-10 | `38734f16` |
| `EX-073` | `page/expect-boolean.spec.ts` | toBeAttached › default | 2023-03-29 | `0f9ea0cc` |
| `EX-074` | `page/expect-boolean.spec.ts` | toBeAttached › with hidden element | 2023-03-29 | `df60ae5e` |
| `EX-075` | `page/expect-boolean.spec.ts` | toBeAttached › with not | 2023-03-29 | `449891fc` |
| `EX-076` | `page/expect-boolean.spec.ts` | toBeAttached › with attached:true | 2023-03-29 | `ed82d185` |
| `EX-077` | `page/expect-boolean.spec.ts` | toBeAttached › with attached:false | 2023-03-29 | `b224d843` |
| `EX-078` | `page/expect-boolean.spec.ts` | toBeAttached › with not and attached:false | 2023-03-29 | `73d62116` |
| `EX-079` | `page/expect-boolean.spec.ts` | toBeAttached › eventually | 2023-03-29 | `33662d4f` |
| `EX-080` | `page/expect-boolean.spec.ts` | toBeAttached › eventually with not | 2023-03-29 | `c179f8fc` |
| `EX-081` | `page/expect-boolean.spec.ts` | toBeAttached › fail | 2023-03-29 | `eec416de` |
| `EX-082` | `page/expect-boolean.spec.ts` | toBeAttached › fail with not | 2026-01-07 | `dcc66e33` |
| `EX-083` | `page/expect-boolean.spec.ts` | toBeAttached › with impossible timeout | 2023-03-29 | `36f7fc7d` |
| `EX-084` | `page/expect-boolean.spec.ts` | toBeAttached › with impossible timeout .not | 2023-03-29 | `00329c23` |
| `EX-085` | `page/expect-boolean.spec.ts` | toBeAttached › with frameLocator | 2023-03-29 | `00fb264d` |
| `EX-086` | `page/expect-boolean.spec.ts` | toBeAttached › over navigation | 2023-03-29 | `0ca8aa80` |
| `EX-087` | `page/expect-builtins.spec.ts` | .toBe() › does not throw | 2026-04-21 | `1fd8ad88` |
| `EX-088` | `page/expect-builtins.spec.ts` | .toBe() › fails for: {1 and 2 #0, true and false #1, {} and {} #2, {"a":1} and {"a":1} #3, {"a":1} and {"a":5} #4, {"b":2} and {"b":2} #5, "2020-02-20T00:00:00.000Z" and "2020-02-20T00:00:00.000Z" #6, {} and {} #7, \["abc"\] and \["cde"\] #8, \[\] and \[\] #9, null and undefined #10, 0 and 0 #11} *(12 copies)* | 2026-04-21 | `cc2adb8a` |
| `EX-089` | `page/expect-builtins.spec.ts` | .toBe() › fails for {'false', '1', '"a"', 'undefined', 'null', '{}', '\[\]'} with '.not' *(7 copies)* | 2026-04-21 | `eb946f1e` |
| `EX-090` | `page/expect-builtins.spec.ts` | .toBe() › does not crash on circular references | 2026-04-21 | `dcf0d4e0` |
| `EX-091` | `page/expect-builtins.spec.ts` | .toBe() › matcherResult property contains matcher name, expected and actual values | 2026-04-21 | `1cfe6034` |
| `EX-092` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not ignore keys with undefined values | 2026-04-21 | `f4d2a5ce` |
| `EX-093` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not ignore keys with undefined values inside an array | 2026-04-21 | `671ba65d` |
| `EX-094` | `page/expect-builtins.spec.ts` | .toStrictEqual() › passes when comparing same type | 2026-04-21 | `dab77b67` |
| `EX-095` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not pass for different types | 2026-04-21 | `b28beda3` |
| `EX-096` | `page/expect-builtins.spec.ts` | .toStrictEqual() › passes for matching buffers | 2026-04-21 | `89e912f0` |
| `EX-097` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not pass when ArrayBuffers are not equal | 2026-04-21 | `5f9ecdc1` |
| `EX-098` | `page/expect-builtins.spec.ts` | .toEqual() › {pass: false} expect().toEqual() {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16} *(17 copies)* | 2026-04-21 | `4145e815` |
| `EX-099` | `page/expect-builtins.spec.ts` | .toEqual() › {pass: true} expect().toEqual() {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17} *(18 copies)* | 2026-04-21 | `591f8f40` |
| `EX-100` | `page/expect-builtins.spec.ts` | .toEqual() › assertion error matcherResult property contains matcher name, expected and actual values | 2026-04-21 | `35e1c2ab` |
| `EX-101` | `page/expect-builtins.spec.ts` | .toEqual() › symbol based keys in arrays are processed correctly | 2026-04-21 | `ca4c9d83` |
| `EX-102` | `page/expect-builtins.spec.ts` | .toEqual() › non-enumerable members should be skipped during equal | 2026-04-21 | `bd5294b0` |
| `EX-103` | `page/expect-builtins.spec.ts` | .toEqual() › objectContaining sample can be used multiple times | 2026-04-21 | `c7521dc1` |
| `EX-104` | `page/expect-builtins.spec.ts` | .toEqual() › cyclic object equality › properties with the same circularity are equal | 2026-04-21 | `f1ccf17d` |
| `EX-105` | `page/expect-builtins.spec.ts` | .toEqual() › cyclic object equality › properties with different circularity are not equal | 2026-04-21 | `699c7b37` |
| `EX-106` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › passing instanceof {#0, #1, #2, #3, #4} *(5 copies)* | 2026-04-21 | `afa3896d` |
| `EX-107` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › failing instanceof {#0, #1, #2, #3} *(4 copies)* | 2026-04-21 | `a750ba51` |
| `EX-108` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › throws if constructor is not a function | 2026-04-21 | `b9454341` |
| `EX-109` | `page/expect-builtins.spec.ts` | .toBeTruthy(), .toBeFalsy() › {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} is truthy *(9 copies)* | 2026-04-21 | `72a141aa` |
| `EX-110` | `page/expect-builtins.spec.ts` | .toBeTruthy(), .toBeFalsy() › {'false', 'null', 'NaN', '0', '', 'undefined'} is falsy *(6 copies)* | 2026-04-21 | `955ee2d3` |
| `EX-111` | `page/expect-builtins.spec.ts` | .toBeNaN() › {pass: true} | 2026-04-21 | `3a640bbe` |
| `EX-112` | `page/expect-builtins.spec.ts` | .toBeNaN() › throws | 2026-04-21 | `09c8351f` |
| `EX-113` | `page/expect-builtins.spec.ts` | .toBeNull() › fails for {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} *(9 copies)* | 2026-04-21 | `56cb1864` |
| `EX-114` | `page/expect-builtins.spec.ts` | .toBeNull() › fails for null with .not | 2026-04-21 | `2316957d` |
| `EX-115` | `page/expect-builtins.spec.ts` | .toBeNull() › pass for null | 2026-04-21 | `b686cbfe` |
| `EX-116` | `page/expect-builtins.spec.ts` | .toBeDefined(), .toBeUndefined() › {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} is defined *(9 copies)* | 2026-04-21 | `559480b9` |
| `EX-117` | `page/expect-builtins.spec.ts` | .toBeDefined(), .toBeUndefined() › undefined is undefined | 2026-04-21 | `0976f481` |
| `EX-118` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › comparing {1 and 2, -Infinity and Infinity, 5e-324 and 1.7976931348623157e+308, 0.1 and 0.2} *(4 copies)* | 2026-04-21 | `5cdc7fc6` |
| `EX-119` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › can compare BigInt to Numbers | 2026-04-21 | `06807218` |
| `EX-120` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › equal numbers: {\[1, 1\], \[5e-324, 5e-324\], \[Infinity, Infinity\], \[-Infinity, -Infinity\]} *(4 copies)* | 2026-04-21 | `428ff852` |
| `EX-121` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › iterable | 2026-04-21 | `efbfc0d8` |
| `EX-122` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › contains {#0, #1, #2, #3, #4, #5, #6, #7} *(8 copies)* | 2026-04-21 | `e78c709a` |
| `EX-123` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › does not contain {#0, #1, #2, #3} *(4 copies)* | 2026-04-21 | `1d1ec697` |
| `EX-124` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › error cases | 2026-04-21 | `13df58b8` |
| `EX-125` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › contains a value equal {#0, #1, #2, #3, #4} *(5 copies)* | 2026-04-21 | `352eecdd` |
| `EX-126` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › error cases for toContainEqual | 2026-04-21 | `fc620343` |
| `EX-127` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: true} {expect(0).toBeCloseTo(0), expect(0).toBeCloseTo(0.001), expect(1.23).toBeCloseTo(1.229), expect(1.23).toBeCloseTo(1.226), expect(1.23).toBeCloseTo(1.234), expect(Infinity).toBeCloseTo(Infinity), expect(-Infinity).toBeCloseTo(-Infinity)} *(7 copies)* | 2026-04-21 | `f1f99eb4` |
| `EX-128` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: false} {expect(0).toBeCloseTo(0.01), expect(1).toBeCloseTo(1.23), expect(Infinity).toBeCloseTo(-Infinity), expect(Infinity).toBeCloseTo(1.23), expect(-Infinity).toBeCloseTo(-1.23)} *(5 copies)* | 2026-04-21 | `101db1c6` |
| `EX-129` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: true} {expect(0).toBeCloseTo(0.1, 0), expect(0).toBeCloseTo(0.0001, 3), expect(0).toBeCloseTo(0.000004, 5), expect(2.0000002).toBeCloseTo(2, 5)} *(4 copies)* | 2026-04-21 | `0dc7f059` |
| `EX-130` | `page/expect-builtins.spec.ts` | .toMatch() › {pass: true} {expect(foo).toMatch(foo), expect(Foo bar).toMatch(/^foo/i)} *(2 copies)* | 2026-04-21 | `816ee1b0` |
| `EX-131` | `page/expect-builtins.spec.ts` | .toMatch() › throws: \[bar, {foo\], /foo/\]} *(2 copies)* | 2026-04-21 | `16359dbb` |
| `EX-132` | `page/expect-builtins.spec.ts` | .toMatch() › throws if non String actual value passed {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* | 2026-04-21 | `df085a1a` |
| `EX-133` | `page/expect-builtins.spec.ts` | .toMatch() › throws if non String/RegExp expected value passed {#0, #1, #2, #3, #4, #5} *(6 copies)* | 2026-04-21 | `18727aa1` |
| `EX-134` | `page/expect-builtins.spec.ts` | .toMatch() › escapes strings properly | 2026-04-21 | `86bcf76d` |
| `EX-135` | `page/expect-builtins.spec.ts` | .toMatch() › does not maintain RegExp state between calls | 2026-04-21 | `093ecb27` |
| `EX-136` | `page/expect-builtins.spec.ts` | .toHaveLength › {pass: true} {toHaveLength(2) #0, toHaveLength(0) #1, toHaveLength(2) #2, toHaveLength(3) #3, toHaveLength(0) #4, toHaveLength(0) #5} *(6 copies)* | 2026-04-21 | `b923ae4f` |
| `EX-137` | `page/expect-builtins.spec.ts` | .toHaveLength › {pass: false} {toHaveLength(3) #0, toHaveLength(1) #1, toHaveLength(99) #2, toHaveLength(66) #3, toHaveLength(1) #4} *(5 copies)* | 2026-04-21 | `3bdc68eb` |
| `EX-138` | `page/expect-builtins.spec.ts` | .toHaveLength › error cases | 2026-04-21 | `c96000bf` |
| `EX-139` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: true} toHaveProperty with value {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9} *(10 copies)* | 2026-04-21 | `0f97066b` |
| `EX-140` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: false} toHaveProperty with value {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* | 2026-04-21 | `8305ae03` |
| `EX-141` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: true} toHaveProperty without value {#0, #1, #2, #3, #4} *(5 copies)* | 2026-04-21 | `ce2f1949` |
| `EX-142` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: false} toHaveProperty without value {#0, #1, #2} *(3 copies)* | 2026-04-21 | `55f50e63` |
| `EX-143` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {error} toHaveProperty {#0, #1, #2, #3, #4} *(5 copies)* | 2026-04-21 | `9a5b4964` |
| `EX-144` | `page/expect-builtins.spec.ts` | .toMatchObject() › {pass: true} toMatchObject {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11} *(12 copies)* | 2026-04-21 | `3557c8d3` |
| `EX-145` | `page/expect-builtins.spec.ts` | .toMatchObject() › {pass: false} toMatchObject {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* | 2026-04-21 | `0e5a21f2` |
| `EX-146` | `page/expect-builtins.spec.ts` | .toMatchObject() › throws toMatchObject {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* | 2026-04-21 | `75af442b` |
| `EX-147` | `page/expect-builtins.spec.ts` | .toMatchObject() › does not match properties up in the prototype chain | 2026-04-21 | `fc49ce1b` |
| `EX-148` | `page/expect-builtins.spec.ts` | .toThrow() › to throw or not to throw | 2026-04-21 | `33844f74` |
| `EX-149` | `page/expect-builtins.spec.ts` | .toThrow() › substring passes | 2026-04-21 | `7b70d291` |
| `EX-150` | `page/expect-builtins.spec.ts` | .toThrow() › substring fails when did not throw | 2026-04-21 | `139b067a` |
| `EX-151` | `page/expect-builtins.spec.ts` | .toThrow() › substring fails when message did not match | 2026-04-21 | `7ab4b277` |
| `EX-152` | `page/expect-builtins.spec.ts` | .toThrow() › regexp passes | 2026-04-21 | `5d705950` |
| `EX-153` | `page/expect-builtins.spec.ts` | .toThrow() › regexp fails when did not throw | 2026-04-21 | `d0330f57` |
| `EX-154` | `page/expect-builtins.spec.ts` | .toThrow() › error class passes | 2026-04-21 | `ebaa82f2` |
| `EX-155` | `page/expect-builtins.spec.ts` | .toThrow() › object with message passes | 2026-04-21 | `aa1cd806` |
| `EX-156` | `page/expect-builtins.spec.ts` | .toThrow() › properly escapes strings when matching against errors | 2026-04-21 | `b5d96722` |
| `EX-157` | `page/expect-builtins.spec.ts` | .toThrow() › error message and cause properties | 2026-04-21 | `39a49027` |
| `EX-158` | `page/expect-builtins.spec.ts` | asymmetric matchers › Any matches primitives | 2026-04-21 | `40ad9eaf` |
| `EX-159` | `page/expect-builtins.spec.ts` | asymmetric matchers › Any throws when called with empty constructor | 2026-04-21 | `f066e93b` |
| `EX-160` | `page/expect-builtins.spec.ts` | asymmetric matchers › Anything matches any type | 2026-04-21 | `24cc2695` |
| `EX-161` | `page/expect-builtins.spec.ts` | asymmetric matchers › Anything does not match null and undefined | 2026-04-21 | `3eaf0eb4` |
| `EX-162` | `page/expect-builtins.spec.ts` | asymmetric matchers › ArrayContaining matches | 2026-04-21 | `c627a89a` |
| `EX-163` | `page/expect-builtins.spec.ts` | asymmetric matchers › ArrayContaining does not match | 2026-04-21 | `4fa121fc` |
| `EX-164` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining matches | 2026-04-21 | `fee1f48f` |
| `EX-165` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining does not match | 2026-04-21 | `475b49ba` |
| `EX-166` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining throws for non-objects | 2026-04-21 | `80a49e73` |
| `EX-167` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringContaining matches string against string | 2026-04-21 | `3f668e90` |
| `EX-168` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringMatching matches string against regexp | 2026-04-21 | `864c1b85` |
| `EX-169` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringMatching matches string against string | 2026-04-21 | `71bbd622` |
| `EX-170` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo matches | 2026-04-21 | `52f583f9` |
| `EX-171` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo does not match | 2026-04-21 | `3378b4ea` |
| `EX-172` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo with precision | 2026-04-21 | `24655799` |
| `EX-173` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo throws if expected is not number | 2026-04-21 | `e95ba21a` |
| `EX-174` | `page/expect-builtins.spec.ts` | asymmetric matchers › arrayOf matches | 2026-04-21 | `81de90bf` |
| `EX-175` | `page/expect-builtins.spec.ts` | asymmetric matchers › arrayOf does not match | 2026-04-21 | `4627bf05` |
| `EX-176` | `page/expect-matcher-result.spec.ts` | toMatchText-based assertions should have matcher result | 2026-04-24 | `ed64dac1` |
| `EX-177` | `page/expect-matcher-result.spec.ts` | toBeTruthy-based assertions should have matcher result | 2026-04-24 | `b67841e7` |
| `EX-178` | `page/expect-matcher-result.spec.ts` | toEqual-based assertions should have matcher result | 2025-07-16 | `6a6625bd` |
| `EX-179` | `page/expect-matcher-result.spec.ts` | toBeChecked({ checked }) should have expected | 2026-04-24 | `5ace31cc` |
| `EX-180` | `page/expect-matcher-result.spec.ts` | toHaveScreenshot should populate matcherResult | 2026-04-21 | `16f51078` |
| `EX-181` | `page/expect-misc.spec.ts` | toHaveCount › toHaveCount pass | 2022-08-10 | `32e6942f` |
| `EX-182` | `page/expect-misc.spec.ts` | toHaveCount › pass zero | 2022-08-10 | `92643abb` |
| `EX-183` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass zero | 2022-08-10 | `267ee1e9` |
| `EX-184` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass non-zero | 2022-08-10 | `d95543c6` |
| `EX-185` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass not non-zero | 2022-08-10 | `a72936e9` |
| `EX-186` | `page/expect-misc.spec.ts` | toHaveCount › fail zero | 2026-08-27 | `b955b2b2` |
| `EX-187` | `page/expect-misc.spec.ts` | toHaveCount › fail zero 2 | 2026-08-27 | `269c68e3` |
| `EX-188` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass | 2022-08-10 | `6811c3c2` |
| `EX-189` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail | 2022-08-10 | `cbe2535c` |
| `EX-190` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass string | 2022-08-10 | `5a5b5da3` |
| `EX-191` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail string | 2026-08-27 | `db2d5f24` |
| `EX-192` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass number | 2022-08-10 | `403dfb09` |
| `EX-193` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail number | 2026-08-27 | `d7439e2e` |
| `EX-194` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass boolean | 2022-08-10 | `e5d4687a` |
| `EX-195` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail boolean | 2026-08-27 | `d7e90b32` |
| `EX-196` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass boolean 2 | 2022-08-10 | `a42faa3d` |
| `EX-197` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail boolean 2 | 2026-08-27 | `f6b5082d` |
| `EX-198` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass undefined | 2022-08-10 | `1f4286f8` |
| `EX-199` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass null | 2022-08-10 | `612e9a2e` |
| `EX-200` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass nested | 2023-10-06 | `db426db9` |
| `EX-201` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail nested | 2023-10-06 | `331f8979` |
| `EX-202` | `page/expect-misc.spec.ts` | toHaveClass › pass | 2022-08-10 | `a1ae3baa` |
| `EX-203` | `page/expect-misc.spec.ts` | toHaveClass › pass with SVGs | 2022-08-10 | `ee116384` |
| `EX-204` | `page/expect-misc.spec.ts` | toHaveClass › fail | 2026-08-27 | `7f20bad9` |
| `EX-205` | `page/expect-misc.spec.ts` | toHaveClass › pass with array | 2022-08-10 | `3de62c21` |
| `EX-206` | `page/expect-misc.spec.ts` | toHaveClass › fail with array | 2026-08-27 | `3e8f437a` |
| `EX-207` | `page/expect-misc.spec.ts` | toContainClass › pass | 2025-04-09 | `6bddab9d` |
| `EX-208` | `page/expect-misc.spec.ts` | toContainClass › pass with SVGs | 2025-04-09 | `64d3a439` |
| `EX-209` | `page/expect-misc.spec.ts` | toContainClass › fail | 2026-08-27 | `58f252ab` |
| `EX-210` | `page/expect-misc.spec.ts` | toContainClass › pass with array | 2025-04-09 | `0ef6233c` |
| `EX-211` | `page/expect-misc.spec.ts` | toContainClass › fail with array | 2026-08-27 | `f825377f` |
| `EX-212` | `page/expect-misc.spec.ts` | toHaveTitle › pass | 2022-08-10 | `110f9bff` |
| `EX-213` | `page/expect-misc.spec.ts` | toHaveTitle › fail | 2025-09-10 | `9ef2984c` |
| `EX-214` | `page/expect-misc.spec.ts` | toHaveURL › pass | 2022-08-10 | `e81a15ae` |
| `EX-215` | `page/expect-misc.spec.ts` | toHaveURL › fail string | 2025-09-10 | `71477a7c` |
| `EX-216` | `page/expect-misc.spec.ts` | toHaveURL › fail with invalid argument | 2025-09-10 | `060db398` |
| `EX-217` | `page/expect-misc.spec.ts` | toHaveURL › fail with positive predicate | 2025-09-10 | `278f63d9` |
| `EX-218` | `page/expect-misc.spec.ts` | toHaveURL › fail with negative predicate | 2025-09-10 | `dda6c60f` |
| `EX-219` | `page/expect-misc.spec.ts` | toHaveURL › resolve predicate on initial call | 2025-01-24 | `d1f7e9e4` |
| `EX-220` | `page/expect-misc.spec.ts` | toHaveURL › resolve predicate after retries | 2025-01-24 | `acb93d5f` |
| `EX-221` | `page/expect-misc.spec.ts` | toHaveURL › support ignoreCase | 2024-04-02 | `e09fe8e5` |
| `EX-222` | `page/expect-misc.spec.ts` | toHaveURL › support URLPattern | 2026-01-30 | `44576ffb` |
| `EX-223` | `page/expect-misc.spec.ts` | toHaveAttribute › pass | 2022-09-16 | `4ac695f0` |
| `EX-224` | `page/expect-misc.spec.ts` | toHaveAttribute › should not match missing attribute | 2026-08-27 | `68a2aff8` |
| `EX-225` | `page/expect-misc.spec.ts` | toHaveAttribute › should match boolean attribute | 2026-08-27 | `50622a16` |
| `EX-226` | `page/expect-misc.spec.ts` | toHaveAttribute › should match attribute without value | 2023-10-04 | `588fc38e` |
| `EX-227` | `page/expect-misc.spec.ts` | toHaveAttribute › should support boolean attribute with options | 2023-10-04 | `3f802ea9` |
| `EX-228` | `page/expect-misc.spec.ts` | toHaveAttribute › support ignoreCase | 2023-10-26 | `3c623318` |
| `EX-229` | `page/expect-misc.spec.ts` | toHaveCSS › pass | 2026-01-22 | `6f17f3de` |
| `EX-230` | `page/expect-misc.spec.ts` | toHaveCSS › should support pseudo element | 2026-04-14 | `b324ed33` |
| `EX-231` | `page/expect-misc.spec.ts` | toHaveCSS › custom css properties | 2026-01-22 | `65e03a78` |
| `EX-232` | `page/expect-misc.spec.ts` | toHaveId › pass | 2022-08-10 | `e8b73936` |
| `EX-233` | `page/expect-misc.spec.ts` | toBeInViewport › should work | 2023-02-13 | `7fa86a07` |
| `EX-234` | `page/expect-misc.spec.ts` | toBeInViewport › should respect ratio option | 2024-10-07 | `653f176f` |
| `EX-235` | `page/expect-misc.spec.ts` | toBeInViewport › should have good stack | 2026-01-27 | `3ed6d551` |
| `EX-236` | `page/expect-misc.spec.ts` | toBeInViewport › should report intersection even if fully covered by other element | 2023-02-10 | `9158d01c` |
| `EX-237` | `page/expect-misc.spec.ts` | toHaveCount should not produce logs twice | 2023-04-03 | `d1a98e64` |
| `EX-238` | `page/expect-misc.spec.ts` | toHaveText should not produce logs twice | 2023-04-03 | `d3276117` |
| `EX-239` | `page/expect-misc.spec.ts` | toHaveText that does not match should not produce logs twice | 2023-04-03 | `7bcb1002` |
| `EX-240` | `page/expect-misc.spec.ts` | strict mode violation error format | 2025-09-10 | `6effe3aa` |
| `EX-241` | `page/expect-misc.spec.ts` | invalid selector error format | 2025-09-10 | `901b5d46` |
| `EX-242` | `page/expect-misc.spec.ts` | should report expect error details when page closes during expect | 2026-06-19 | `8e145a75` |
| `EX-243` | `page/expect-misc.spec.ts` | should report page close reason when page closes during expect | 2026-09-23 | `df8810b1` |
| `EX-244` | `page/expect-timeout.spec.ts` | should print element not found | 2025-09-10 | `0d0f08d6` |
| `EX-245` | `page/expect-timeout.spec.ts` | should print timed out error message when value does not match | 2025-09-10 | `34951eb5` |
| `EX-246` | `page/expect-timeout.spec.ts` | should print timed out error message with impossible timeout | 2025-09-10 | `2f15fbe0` |
| `EX-247` | `page/expect-timeout.spec.ts` | should print timed out error message when value does not match with impossible timeout | 2025-09-10 | `d7ac6924` |
| `EX-248` | `page/expect-timeout.spec.ts` | should have timeout error name | 2023-11-30 | `3b4f8062` |
| `EX-249` | `page/expect-timeout.spec.ts` | should not throw when navigating during one-shot check | 2024-08-12 | `44b379f9` |
| `EX-250` | `page/expect-timeout.spec.ts` | should not throw when navigating during first locator handler check | 2024-08-12 | `2d87a9c9` |
| `EX-251` | `page/expect-timeout.spec.ts` | should timeout during first locator handler check | 2025-09-10 | `0d7b79b7` |
| `EX-252` | `page/expect-timeout.spec.ts` | should not miss element that appears between retries before the deadline | 2026-05-06 | `a95108b7` |
| `EX-253` | `page/expect-timeout.spec.ts` | should fail like a timeout when the signal is aborted mid-assertion | 2026-08-27 | `c9b6d635` |
| `EX-254` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveText is aborted mid-assertion | 2026-07-01 | `6bcf7b57` |
| `EX-255` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveCount is aborted mid-assertion | 2026-07-01 | `121fe920` |
| `EX-256` | `page/expect-timeout.spec.ts` | should fail like a timeout when toMatchAriaSnapshot is aborted mid-assertion | 2026-07-01 | `ab9b20e3` |
| `EX-257` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveURL is aborted mid-assertion | 2026-07-01 | `54965487` |
| `EX-258` | `page/expect-timeout.spec.ts` | should fail the assertion when the signal is already aborted | 2026-07-01 | `8956153f` |
| `EX-259` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleName | 2026-04-15 | `97746c10` |
| `EX-260` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleDescription | 2025-05-27 | `007e1469` |
| `EX-261` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage | 2025-05-27 | `016b472e` |
| `EX-262` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle multiple aria-errormessage references | 2025-05-27 | `4496f618` |
| `EX-263` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › no aria-invalid attribute | 2025-05-27 | `bd19c4ea` |
| `EX-264` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › aria-invalid="false" | 2025-05-27 | `2e7b0625` |
| `EX-265` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › aria-invalid="" (empty string) | 2025-05-27 | `0731e31f` |
| `EX-266` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in true › aria-invalid="true" | 2025-05-27 | `31d42ab9` |
| `EX-267` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in true › aria-invalid="foo" (unrecognized value) | 2025-05-27 | `b5d21b78` |
| `EX-268` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is false and aria-invalid is true | 2025-05-27 | `8c8fb164` |
| `EX-269` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is true and aria-invalid is true | 2025-05-27 | `ee74e72e` |
| `EX-270` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is false and aria-invalid is false | 2025-05-27 | `39ff5909` |
| `EX-271` | `page/expect-to-have-accessible.spec.ts` | should not show error message when validity is true and aria-invalid is false | 2025-05-27 | `5ebaa161` |
| `EX-272` | `page/expect-to-have-accessible.spec.ts` | should show error message for all roles | 2025-05-27 | `1a2f8d72` |
| `EX-273` | `page/expect-to-have-accessible.spec.ts` | toHaveRole | 2025-05-27 | `0361703a` |
| `EX-274` | `page/expect-to-have-text.spec.ts` | toHaveText with regex › pass | 2022-08-10 | `1e7de6dd` |
| `EX-275` | `page/expect-to-have-text.spec.ts` | toHaveText with regex › fail | 2025-09-10 | `420ca24b` |
| `EX-276` | `page/expect-to-have-text.spec.ts` | toContainText with regex › pass | 2022-08-10 | `0d36db77` |
| `EX-277` | `page/expect-to-have-text.spec.ts` | toContainText with regex › fail | 2022-08-10 | `14ba5f22` |
| `EX-278` | `page/expect-to-have-text.spec.ts` | toContainText with string › pass | 2025-09-10 | `8d377186` |
| `EX-279` | `page/expect-to-have-text.spec.ts` | toContainText with string › fail | 2025-09-10 | `82d8469a` |
| `EX-280` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass | 2025-02-25 | `02280af2` |
| `EX-281` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass contain | 2022-08-10 | `33aad47b` |
| `EX-282` | `page/expect-to-have-text.spec.ts` | toHaveText with text › fail | 2025-09-10 | `1e117713` |
| `EX-283` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass eventually | 2022-08-10 | `ab4d2a98` |
| `EX-284` | `page/expect-to-have-text.spec.ts` | toHaveText with text › with userInnerText | 2022-08-10 | `2024c32a` |
| `EX-285` | `page/expect-to-have-text.spec.ts` | toHaveText with text › in shadow dom | 2022-08-11 | `9341ca05` |
| `EX-286` | `page/expect-to-have-text.spec.ts` | toHaveText with text › fail with impossible timeout | 2025-09-10 | `bca77ff7` |
| `EX-287` | `page/expect-to-have-text.spec.ts` | toHaveText with text › do not show "element(s) not found" when the real failure is a string mismatch | 2025-10-21 | `9bd3d1bd` |
| `EX-288` | `page/expect-to-have-text.spec.ts` | not.toHaveText › pass | 2022-08-10 | `ee6c5419` |
| `EX-289` | `page/expect-to-have-text.spec.ts` | not.toHaveText › fail | 2025-09-10 | `5c010e80` |
| `EX-290` | `page/expect-to-have-text.spec.ts` | not.toHaveText › should work when selector does not match | 2025-09-10 | `bd7adc1c` |
| `EX-291` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass | 2022-08-10 | `4e79a407` |
| `EX-292` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass lazy | 2022-08-10 | `049d7d5c` |
| `EX-293` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass empty | 2022-08-10 | `9484bc7f` |
| `EX-294` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass not empty | 2022-08-10 | `a5e47db0` |
| `EX-295` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass on empty | 2022-08-10 | `5590b6db` |
| `EX-296` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail on not+empty | 2026-08-27 | `ecc4e78d` |
| `EX-297` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass eventually empty | 2022-08-10 | `562608e6` |
| `EX-298` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail | 2026-08-27 | `9189d54f` |
| `EX-299` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail on repeating array matchers | 2022-11-04 | `7ef215cf` |
| `EX-300` | `page/expect-to-have-text.spec.ts` | toContainText with array › pass | 2022-08-10 | `94d36a86` |
| `EX-301` | `page/expect-to-have-text.spec.ts` | toContainText with array › fail | 2022-08-10 | `123c625e` |
| `EX-302` | `page/expect-to-have-value.spec.ts` | should work | 2022-08-10 | `91942a4c` |
| `EX-303` | `page/expect-to-have-value.spec.ts` | should work with label | 2022-08-10 | `7778f01b` |
| `EX-304` | `page/expect-to-have-value.spec.ts` | should work with regex | 2022-08-10 | `ffd15b25` |
| `EX-305` | `page/expect-to-have-value.spec.ts` | should support failure | 2022-08-10 | `81545a50` |
| `EX-306` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › works with text | 2022-08-10 | `8c98792a` |
| `EX-307` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › follows labels | 2022-08-10 | `c2a5bd85` |
| `EX-308` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › exact match with text failure | 2022-08-10 | `2d964d18` |
| `EX-309` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › works with regex | 2022-08-10 | `ad838a6a` |
| `EX-310` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when items not selected | 2022-08-10 | `5073e42d` |
| `EX-311` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when multiple not specified | 2022-08-10 | `a5e74ce6` |
| `EX-312` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when not a select element | 2022-08-10 | `ac6e9e52` |
| `EX-313` | `page/expect-with-snapshot.spec.ts` | containment matchers print full element subtree › toHaveText failure includes full element subtree | 2026-04-24 | `95eb005c` |
| `EX-314` | `page/expect-with-snapshot.spec.ts` | containment matchers print full element subtree › toContainText failure includes full element subtree | 2026-04-24 | `6712f33f` |
| `EX-315` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toBeChecked failure prints just the input | 2026-04-24 | `1d67754a` |
| `EX-316` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveAttribute failure clips descendant subtree | 2026-04-24 | `bec2757a` |
| `EX-317` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveRole failure prints just the element line | 2026-04-24 | `79475eb9` |
| `EX-318` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveValue failure prints the input element | 2026-04-24 | `44ee2530` |
| `EX-319` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveCSS failure prints the element line | 2026-04-24 | `a0118b98` |
| `EX-320` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toBeVisible on hidden element prints full page snapshot | 2026-04-24 | `9e9f01b6` |
| `EX-321` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toBeVisible on missing element prints full page snapshot | 2026-04-24 | `f99d2b02` |
| `EX-322` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toHaveText on missing element prints full page snapshot | 2026-04-24 | `70b22bd9` |
| `EX-323` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toHaveTitle failure prints full page snapshot | 2026-04-24 | `adaadd7e` |
| `EX-324` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toHaveCount failure has no aria snapshot | 2026-04-24 | `1980480e` |
| `EX-325` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toHaveText with array has no aria snapshot | 2026-04-24 | `a9e6c302` |
| `EX-326` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toMatchAriaSnapshot failure has no extra aria snapshot | 2026-04-24 | `5888972a` |
| `EX-327` | `page/matchers.misc.spec.ts` | should outlive frame navigation | 2022-08-02 | `3385450a` |
| `EX-328` | `page/matchers.misc.spec.ts` | should print no-locator-resolved error when locator matcher did not resolve to any element | 2025-09-04 | `7bf3bef3` |

### FA — Favicon

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FA-001` | `library/favicon.spec.ts` | should load svg favicon with prefer-color-scheme | 2025-10-03 | `aa9fc1d5` |

### FC — File chooser

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FC-001` | `page/page-filechooser.spec.ts` | should upload multiple large files | 2025-12-09 | `48e2abf4` |
| `FC-002` | `page/page-filechooser.spec.ts` | should emit event once | 2025-02-12 | `7300c6b2` |
| `FC-003` | `page/page-filechooser.spec.ts` | should emit event via prepend | 2025-02-12 | `bf8602e1` |
| `FC-004` | `page/page-filechooser.spec.ts` | should emit event for iframe | 2025-02-12 | `c47de2c0` |
| `FC-005` | `page/page-filechooser.spec.ts` | should emit event on/off | 2025-02-12 | `0395b90c` |
| `FC-006` | `page/page-filechooser.spec.ts` | should emit event addListener/removeListener | 2025-02-12 | `590def52` |
| `FC-007` | `page/page-filechooser.spec.ts` | should work when file input is attached to DOM | 2025-02-12 | `73af6751` |
| `FC-008` | `page/page-filechooser.spec.ts` | should work when file input is not attached to DOM | 2025-02-12 | `0da7b53b` |
| `FC-009` | `page/page-filechooser.spec.ts` | should not throw when filechooser belongs to iframe | 2025-02-12 | `2c2827b9` |
| `FC-010` | `page/page-filechooser.spec.ts` | should not throw when frame is detached immediately | 2025-02-12 | `a25f55a9` |
| `FC-011` | `page/page-filechooser.spec.ts` | should respect timeout | 2025-02-12 | `93215dd0` |
| `FC-012` | `page/page-filechooser.spec.ts` | should respect default timeout when there is no custom timeout | 2025-02-12 | `8faa0201` |
| `FC-013` | `page/page-filechooser.spec.ts` | should prioritize exact timeout over default timeout | 2025-02-12 | `243b6eed` |
| `FC-014` | `page/page-filechooser.spec.ts` | should work with no timeout | 2025-03-25 | `56a08e70` |
| `FC-015` | `page/page-filechooser.spec.ts` | should abort with signal | 2026-07-01 | `44b1d805` |
| `FC-016` | `page/page-filechooser.spec.ts` | should return the same file chooser when there are many watchdogs simultaneously | 2025-02-12 | `0085bb01` |
| `FC-017` | `page/page-filechooser.spec.ts` | should accept single file | 2025-02-12 | `d53cd6d8` |
| `FC-018` | `page/page-filechooser.spec.ts` | should not trim big uploaded files | 2025-02-12 | `2d9193ea` |
| `FC-019` | `page/page-filechooser.spec.ts` | should be able to read selected file | 2025-02-12 | `cb8083f7` |
| `FC-020` | `page/page-filechooser.spec.ts` | should be able to reset selected files with empty file list | 2025-02-12 | `0a525381` |
| `FC-021` | `page/page-filechooser.spec.ts` | should work for single file pick | 2025-02-12 | `ba793701` |
| `FC-022` | `page/page-filechooser.spec.ts` | should work for "multiple" | 2025-02-12 | `20a11058` |
| `FC-023` | `page/page-filechooser.spec.ts` | should work for "webkitdirectory" | 2025-02-12 | `821c9033` |
| `FC-024` | `page/page-filechooser.spec.ts` | should emit event after navigation | 2025-02-12 | `3e511a5e` |
| `FC-025` | `page/page-filechooser.spec.ts` | should trigger listener added before navigation | 2025-02-12 | `357305ff` |
| `FC-026` | `page/page-filechooser.spec.ts` | user activation › should not open file chooser without user activation | 2026-10-15 | `9511cd10` |
| `FC-027` | `page/page-filechooser.spec.ts` | user activation › should open file chooser with user activation | 2026-10-14 | `f7bbfa24` |
| `FC-028` | `page/page-filechooser.spec.ts` | user activation › should consume user activation when opening file chooser | 2026-10-15 | `c04eda11` |

### FE — Fetch

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FE-001` | `library/global-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should work @smoke *(7 copies)* | 2024-07-30 | `e8530c93` |
| `FE-002` | `library/global-fetch.spec.ts` | should dispose global request | 2024-07-30 | `cd613384` |
| `FE-003` | `library/global-fetch.spec.ts` | should support global userAgent option | 2024-07-30 | `df4b3ad9` |
| `FE-004` | `library/global-fetch.spec.ts` | should support global timeout option | 2025-06-05 | `6ac86fef` |
| `FE-005` | `library/global-fetch.spec.ts` | should propagate extra http headers with redirects | 2024-07-30 | `6eacefa0` |
| `FE-006` | `library/global-fetch.spec.ts` | should preserve authorization on same-origin redirect but strip on cross-origin | 2026-04-30 | `24b11489` |
| `FE-007` | `library/global-fetch.spec.ts` | should support global httpCredentials option | 2021-10-06 | `333efdab` |
| `FE-008` | `library/global-fetch.spec.ts` | should return error with wrong credentials | 2024-07-30 | `786a024a` |
| `FE-009` | `library/global-fetch.spec.ts` | should work with correct credentials and matching origin | 2024-07-30 | `bc982d61` |
| `FE-010` | `library/global-fetch.spec.ts` | should work with correct credentials and matching origin case insensitive | 2024-07-30 | `a2507f10` |
| `FE-011` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching scheme | 2024-07-30 | `b16b3acf` |
| `FE-012` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching hostname | 2024-07-30 | `f13a103a` |
| `FE-013` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching port | 2024-07-30 | `59dc0457` |
| `FE-014` | `library/global-fetch.spec.ts` | should support WWW-Authenticate: Basic | 2024-07-30 | `2c0fc2db` |
| `FE-015` | `library/global-fetch.spec.ts` | should support HTTPCredentials.send | 2024-07-30 | `dac18431` |
| `FE-016` | `library/global-fetch.spec.ts` | should support multiple httpCredentials | 2026-07-24 | `99add10e` |
| `FE-017` | `library/global-fetch.spec.ts` | should support HTTPCredentials.send with multiple httpCredentials | 2026-07-24 | `34f45ea3` |
| `FE-018` | `library/global-fetch.spec.ts` | should support global ignoreHTTPSErrors option | 2024-07-30 | `76a7343f` |
| `FE-019` | `library/global-fetch.spec.ts` | should propagate ignoreHTTPSErrors on redirects | 2024-07-30 | `b686f60e` |
| `FE-020` | `library/global-fetch.spec.ts` | should return server address from response | 2026-06-12 | `efe1befb` |
| `FE-021` | `library/global-fetch.spec.ts` | should return security details from response | 2026-06-12 | `8bf405b6` |
| `FE-022` | `library/global-fetch.spec.ts` | should return security details for a resumed TLS session | 2026-08-21 | `4bf810f8` |
| `FE-023` | `library/global-fetch.spec.ts` | should return null security details for http response | 2026-05-21 | `a157cf02` |
| `FE-024` | `library/global-fetch.spec.ts` | should return security details for certificate with multiple CN attributes | 2026-07-16 | `91fff7af` |
| `FE-025` | `library/global-fetch.spec.ts` | should resolve url relative to global baseURL option | 2024-07-30 | `dfdccd2b` |
| `FE-026` | `library/global-fetch.spec.ts` | should fallback to given URL if baseURL is bogus | 2024-10-01 | `ca03d0d8` |
| `FE-027` | `library/global-fetch.spec.ts` | should set playwright as user-agent | 2024-07-30 | `20af93f4` |
| `FE-028` | `library/global-fetch.spec.ts` | should be able to construct with context options | 2025-12-10 | `35102011` |
| `FE-029` | `library/global-fetch.spec.ts` | should return empty body | 2021-10-07 | `f0df921e` |
| `FE-030` | `library/global-fetch.spec.ts` | should abort requests when context is disposed | 2025-07-04 | `d53255ee` |
| `FE-031` | `library/global-fetch.spec.ts` | should abort redirected requests when context is disposed | 2026-05-20 | `0c2f4dc3` |
| `FE-032` | `library/global-fetch.spec.ts` | should remove content-length from redirected post requests | 2022-05-04 | `0c29e28b` |
| `FE-033` | `library/global-fetch.spec.ts` | should json stringify {object, array, string, string (falsey), bool, bool (false), number, number (falsey), null, literal string undefined} body when content-type is application/json *(10 copies)* | 2026-10-14 | `e22f8582` |
| `FE-034` | `library/global-fetch.spec.ts` | should not double stringify {object, array, string, string (falsey), bool, bool (false), number, number (falsey), null, literal string undefined} body when content-type is application/json *(10 copies)* | 2021-11-11 | `586f81f4` |
| `FE-035` | `library/global-fetch.spec.ts` | should accept already serialized data as Buffer when content-type is application/json | 2021-11-11 | `d1ae0a0e` |
| `FE-036` | `library/global-fetch.spec.ts` | should have nice toString | 2021-11-16 | `2a77c39a` |
| `FE-037` | `library/global-fetch.spec.ts` | should not fail on empty body with encoding | 2022-01-28 | `22469884` |
| `FE-038` | `library/global-fetch.spec.ts` | should return body for failing requests | 2022-02-15 | `396b323b` |
| `FE-039` | `library/global-fetch.spec.ts` | should throw an error when maxRedirects is exceeded | 2025-03-17 | `0457628e` |
| `FE-040` | `library/global-fetch.spec.ts` | should not follow redirects when maxRedirects is set to 0 | 2025-03-17 | `ee35b23a` |
| `FE-041` | `library/global-fetch.spec.ts` | should throw an error when maxRedirects is less than 0 | 2025-03-17 | `f23cb2b9` |
| `FE-042` | `library/global-fetch.spec.ts` | should not follow redirects when maxRedirects is set to 0 in newContext | 2025-03-17 | `fc9d291a` |
| `FE-043` | `library/global-fetch.spec.ts` | should follow redirects up to maxRedirects limit set in newContext | 2025-03-17 | `8c5759dd` |
| `FE-044` | `library/global-fetch.spec.ts` | should use maxRedirects from fetch when provided, overriding newContext | 2025-03-17 | `b1b2718a` |
| `FE-045` | `library/global-fetch.spec.ts` | should keep headers capitalization | 2023-03-10 | `4c3bd90a` |
| `FE-046` | `library/global-fetch.spec.ts` | should serialize post data on the client | 2023-10-16 | `6508a24c` |
| `FE-047` | `library/global-fetch.spec.ts` | should throw after dispose | 2023-10-30 | `d6fd74a3` |
| `FE-048` | `library/global-fetch.spec.ts` | should retry ECONNRESET | 2024-07-30 | `e8147fbd` |
| `FE-049` | `library/global-fetch.spec.ts` | should expose node error code on network errors | 2026-10-01 | `69149b68` |
| `FE-050` | `library/global-fetch.spec.ts` | should append node error code to the message | 2026-09-08 | `eba05883` |
| `FE-051` | `library/global-fetch.spec.ts` | should not crash when server refuses body before reading it | 2026-08-05 | `e8368415` |
| `FE-052` | `library/global-fetch.spec.ts` | should throw when failOnStatusCode is set to true inside APIRequest context options | 2025-02-26 | `3a97d900` |
| `FE-053` | `library/global-fetch.spec.ts` | should not throw when failOnStatusCode is set to false inside APIRequest context options | 2025-02-26 | `8f62a09a` |
| `FE-054` | `library/global-fetch-cookie.spec.ts` | should store cookie from Set-Cookie header | 2023-01-05 | `9db1758b` |
| `FE-055` | `library/global-fetch-cookie.spec.ts` | addCookies should add cookies to the cookie jar | 2026-10-01 | `bb338371` |
| `FE-056` | `library/global-fetch-cookie.spec.ts` | addCookies should validate cookies | 2026-10-01 | `8235bef0` |
| `FE-057` | `library/global-fetch-cookie.spec.ts` | cookies should return cookies filtered by urls | 2026-10-06 | `8c415c8b` |
| `FE-058` | `library/global-fetch-cookie.spec.ts` | cookies should only return cookies that apply to the url | 2026-10-06 | `b6326754` |
| `FE-059` | `library/global-fetch-cookie.spec.ts` | should only send cookies that apply to the url | 2026-10-06 | `bf04afa7` |
| `FE-060` | `library/global-fetch-cookie.spec.ts` | cookies should include cookies from Set-Cookie header | 2026-10-01 | `cc401ea1` |
| `FE-061` | `library/global-fetch-cookie.spec.ts` | clearCookies should remove all cookies | 2026-10-01 | `dba88199` |
| `FE-062` | `library/global-fetch-cookie.spec.ts` | clearCookies should filter by name, domain and path | 2026-10-01 | `031fae6f` |
| `FE-063` | `library/global-fetch-cookie.spec.ts` | clearCookies should remove nameless cookies by empty name | 2026-10-05 | `56642bb9` |
| `FE-064` | `library/global-fetch-cookie.spec.ts` | should send nameless cookies as value only | 2026-10-06 | `5d57357b` |
| `FE-065` | `library/global-fetch-cookie.spec.ts` | should store Set-Cookie without equals sign as nameless cookie | 2026-10-06 | `bd6090c5` |
| `FE-066` | `library/global-fetch-cookie.spec.ts` | should filter outgoing cookies by path | 2021-09-30 | `8872be00` |
| `FE-067` | `library/global-fetch-cookie.spec.ts` | should filter outgoing cookies by domain | 2023-01-05 | `c16f203d` |
| `FE-068` | `library/global-fetch-cookie.spec.ts` | should do case-insensitive match of cookie domain | 2023-01-05 | `347ea838` |
| `FE-069` | `library/global-fetch-cookie.spec.ts` | should do case-insensitive match of request domain | 2023-01-05 | `cfd213d4` |
| `FE-070` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over https | 2021-09-30 | `f920581c` |
| `FE-071` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for localhost | 2022-03-02 | `858f4304` |
| `FE-072` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for subdomains of localhost | 2025-06-11 | `f05bb9a0` |
| `FE-073` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for {127.0.0.1, \[::1\]} *(2 copies)* | 2026-10-05 | `3c5de676` |
| `FE-074` | `library/global-fetch-cookie.spec.ts` | should send not expired cookies | 2021-09-30 | `996d9a00` |
| `FE-075` | `library/global-fetch-cookie.spec.ts` | should remove expired cookies | 2021-09-30 | `89fc642f` |
| `FE-076` | `library/global-fetch-cookie.spec.ts` | should remove cookie with negative max-age | 2023-07-20 | `ac41ad62` |
| `FE-077` | `library/global-fetch-cookie.spec.ts` | should prefer max-age over expires regardless of the order | 2026-10-06 | `abaa49df` |
| `FE-078` | `library/global-fetch-cookie.spec.ts` | should ignore max-age that is not a number | 2026-10-06 | `01b6cc36` |
| `FE-079` | `library/global-fetch-cookie.spec.ts` | should remove cookie with expires far in the past | 2023-07-20 | `654f8fc5` |
| `FE-080` | `library/global-fetch-cookie.spec.ts` | should store cookie from Set-Cookie header even if it contains equal signs | 2023-01-05 | `c097215c` |
| `FE-081` | `library/global-fetch-cookie.spec.ts` | should override cookie from Set-Cookie header | 2022-10-12 | `a6585338` |
| `FE-082` | `library/global-fetch-cookie.spec.ts` | should override cookie from Set-Cookie header even if it expired | 2022-10-12 | `b49c357a` |
| `FE-083` | `library/global-fetch-cookie.spec.ts` | should export cookies to storage state | 2023-01-05 | `e8253356` |
| `FE-084` | `library/global-fetch-cookie.spec.ts` | should preserve origin storage on import/export of storage state | 2026-09-01 | `2eee4993` |
| `FE-085` | `library/global-fetch-cookie.spec.ts` | should send cookies from storage state | 2023-01-05 | `f01b88a6` |
| `FE-086` | `library/global-fetch-cookie.spec.ts` | storage state should round-trip through file | 2021-10-06 | `07a58410` |
| `FE-087` | `library/global-fetch-cookie.spec.ts` | should work with empty storage state | 2023-09-12 | `5b029e5a` |
| `FE-088` | `library/browsercontext-fetch.spec.ts` | get should work @smoke | 2023-01-05 | `82342745` |
| `FE-089` | `library/browsercontext-fetch.spec.ts` | fetch should work | 2021-10-05 | `ade42cf0` |
| `FE-090` | `library/browsercontext-fetch.spec.ts` | should return timing | 2026-07-15 | `569c7212` |
| `FE-091` | `library/browsercontext-fetch.spec.ts` | should return timing for https | 2026-07-15 | `8d09b978` |
| `FE-092` | `library/browsercontext-fetch.spec.ts` | should throw on network error | 2021-12-01 | `795d5f2f` |
| `FE-093` | `library/browsercontext-fetch.spec.ts` | should throw on network error after redirect | 2021-12-01 | `133ea607` |
| `FE-094` | `library/browsercontext-fetch.spec.ts` | should throw on network error when sending body | 2021-12-01 | `de7e96f8` |
| `FE-095` | `library/browsercontext-fetch.spec.ts` | should throw on network error when sending body after redirect | 2021-12-01 | `f3fb2641` |
| `FE-096` | `library/browsercontext-fetch.spec.ts` | should add session cookies to request | 2023-01-05 | `715d2fba` |
| `FE-097` | `library/browsercontext-fetch.spec.ts` | should filter cookies by domain | 2025-05-27 | `2e19ba56` |
| `FE-098` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as object *(7 copies)* | 2024-08-13 | `a677dd83` |
| `FE-099` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as URLSearchParams *(7 copies)* | 2024-08-13 | `c41c29d5` |
| `FE-100` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as string *(7 copies)* | 2024-08-13 | `7e218a16` |
| `FE-101` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should append string and URLSearchParams params to the URL query *(7 copies)* | 2026-10-08 | `483667ea` |
| `FE-102` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support failOnStatusCode *(7 copies)* | 2024-08-02 | `379877c3` |
| `FE-103` | `library/browsercontext-fetch.spec.ts` | {fetchshould, deleteshould, getshould, headshould, patchshould, postshould, putshould} support ignoreHTTPSErrors option *(7 copies)* | 2021-10-05 | `dc532735` |
| `FE-104` | `library/browsercontext-fetch.spec.ts` | should not add context cookie if cookie header passed as a parameter | 2023-01-05 | `105dcb4c` |
| `FE-105` | `library/browsercontext-fetch.spec.ts` | should follow redirects | 2023-01-05 | `898ad111` |
| `FE-106` | `library/browsercontext-fetch.spec.ts` | should follow redirects correctly when Location header contains UTF-8 characters | 2024-05-21 | `d4c70c2d` |
| `FE-107` | `library/browsercontext-fetch.spec.ts` | should add cookies from Set-Cookie header | 2021-10-05 | `8978ee74` |
| `FE-108` | `library/browsercontext-fetch.spec.ts` | page.request.addCookies should add cookies to the browser context | 2026-10-01 | `dbb0576f` |
| `FE-109` | `library/browsercontext-fetch.spec.ts` | page.request.cookies should return browser context cookies | 2026-10-01 | `401d0e7f` |
| `FE-110` | `library/browsercontext-fetch.spec.ts` | page.request.clearCookies should clear browser context cookies | 2026-10-01 | `45d74930` |
| `FE-111` | `library/browsercontext-fetch.spec.ts` | should preserve cookie order from Set-Cookie header | 2025-02-14 | `95bd4592` |
| `FE-112` | `library/browsercontext-fetch.spec.ts` | should support cookie with empty value | 2021-10-07 | `ba270cae` |
| `FE-113` | `library/browsercontext-fetch.spec.ts` | should not lose body while handling Set-Cookie header | 2021-10-05 | `3fd1c34d` |
| `FE-114` | `library/browsercontext-fetch.spec.ts` | should remove cookie with negative max-age | 2023-07-20 | `e7ec7f12` |
| `FE-115` | `library/browsercontext-fetch.spec.ts` | should remove cookie with expires far in the past | 2023-07-20 | `298997bc` |
| `FE-116` | `library/browsercontext-fetch.spec.ts` | should handle cookies on redirects | 2025-09-09 | `5cfe8112` |
| `FE-117` | `library/browsercontext-fetch.spec.ts` | should return raw headers | 2023-10-23 | `fefce8aa` |
| `FE-118` | `library/browsercontext-fetch.spec.ts` | should work with http credentials | 2021-10-05 | `a94f3ede` |
| `FE-119` | `library/browsercontext-fetch.spec.ts` | should work with setHTTPCredentials | 2021-10-05 | `090342fa` |
| `FE-120` | `library/browsercontext-fetch.spec.ts` | should return error with wrong credentials | 2021-10-05 | `69cbc585` |
| `FE-121` | `library/browsercontext-fetch.spec.ts` | should support multiple httpCredentials | 2026-07-24 | `e79f594b` |
| `FE-122` | `library/browsercontext-fetch.spec.ts` | should support HTTPCredentials.send for newContext | 2024-06-20 | `e9fca8d1` |
| `FE-123` | `library/browsercontext-fetch.spec.ts` | should support HTTPCredentials.send for browser.newPage | 2024-06-20 | `b9ddc79b` |
| `FE-124` | `library/browsercontext-fetch.spec.ts` | delete should support post data | 2022-09-26 | `cbe8efeb` |
| `FE-125` | `library/browsercontext-fetch.spec.ts` | get should support post data | 2022-09-26 | `f16aab3b` |
| `FE-126` | `library/browsercontext-fetch.spec.ts` | head should support post data | 2022-09-26 | `268e2dbb` |
| `FE-127` | `library/browsercontext-fetch.spec.ts` | patch should support post data | 2022-09-26 | `eacd32e2` |
| `FE-128` | `library/browsercontext-fetch.spec.ts` | post should support post data | 2022-09-26 | `f810ef6c` |
| `FE-129` | `library/browsercontext-fetch.spec.ts` | put should support post data | 2022-09-26 | `22c84cf0` |
| `FE-130` | `library/browsercontext-fetch.spec.ts` | should add default headers | 2021-10-05 | `b3788d01` |
| `FE-131` | `library/browsercontext-fetch.spec.ts` | should send content-length | 2021-10-05 | `9c23dfb1` |
| `FE-132` | `library/browsercontext-fetch.spec.ts` | should add default headers to redirects | 2021-10-05 | `2d797a90` |
| `FE-133` | `library/browsercontext-fetch.spec.ts` | should allow to override default headers | 2021-10-05 | `52dc9070` |
| `FE-134` | `library/browsercontext-fetch.spec.ts` | should propagate custom headers with redirects | 2021-10-05 | `4330182f` |
| `FE-135` | `library/browsercontext-fetch.spec.ts` | should propagate extra http headers with redirects | 2021-10-05 | `c8217393` |
| `FE-136` | `library/browsercontext-fetch.spec.ts` | should throw on invalid header value | 2021-10-05 | `36b98fe9` |
| `FE-137` | `library/browsercontext-fetch.spec.ts` | should throw on non-http(s) protocol | 2021-10-05 | `9de5e79d` |
| `FE-138` | `library/browsercontext-fetch.spec.ts` | should support https | 2021-10-05 | `9189c0b6` |
| `FE-139` | `library/browsercontext-fetch.spec.ts` | should inherit ignoreHTTPSErrors from context | 2021-10-05 | `90c2a981` |
| `FE-140` | `library/browsercontext-fetch.spec.ts` | should resolve url relative to baseURL | 2021-10-05 | `4b3adf0f` |
| `FE-141` | `library/browsercontext-fetch.spec.ts` | should support gzip compression | 2021-10-05 | `421b1d6d` |
| `FE-142` | `library/browsercontext-fetch.spec.ts` | should support case-insensitive content-encoding | 2026-06-26 | `d7ffb2ae` |
| `FE-143` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted gzip body | 2022-03-05 | `e16e16a0` |
| `FE-144` | `library/browsercontext-fetch.spec.ts` | should support brotli compression | 2021-10-05 | `1165f38a` |
| `FE-145` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted brotli body | 2022-03-05 | `7998b649` |
| `FE-146` | `library/browsercontext-fetch.spec.ts` | should support deflate compression | 2021-10-05 | `141666cd` |
| `FE-147` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted deflate body | 2022-03-05 | `4fd3e936` |
| `FE-148` | `library/browsercontext-fetch.spec.ts` | should support timeout option | 2025-06-05 | `3aa2dca8` |
| `FE-149` | `library/browsercontext-fetch.spec.ts` | should support a timeout of 0 | 2021-10-05 | `00d59a5b` |
| `FE-150` | `library/browsercontext-fetch.spec.ts` | should respect timeout after redirects | 2025-06-05 | `e33cb859` |
| `FE-151` | `library/browsercontext-fetch.spec.ts` | should not hang on a brotli encoded Range request | 2024-10-25 | `bfbb0ee6` |
| `FE-152` | `library/browsercontext-fetch.spec.ts` | should dispose | 2021-10-05 | `ef7d3f5f` |
| `FE-153` | `library/browsercontext-fetch.spec.ts` | should dispose when context closes | 2021-10-05 | `236b891a` |
| `FE-154` | `library/browsercontext-fetch.spec.ts` | should override request parameters | 2021-10-05 | `cc566737` |
| `FE-155` | `library/browsercontext-fetch.spec.ts` | should support application/x-www-form-urlencoded | 2021-10-05 | `3a3d82bc` |
| `FE-156` | `library/browsercontext-fetch.spec.ts` | should support application/x-www-form-urlencoded with param lists | 2024-09-13 | `f12b8f0b` |
| `FE-157` | `library/browsercontext-fetch.spec.ts` | should encode to application/json by default | 2021-10-05 | `7214b23b` |
| `FE-158` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data | 2026-06-26 | `1ff8ba4e` |
| `FE-159` | `library/browsercontext-fetch.spec.ts` | should escape quotes and newlines in multipart field and file names | 2026-10-15 | `fbeb1273` |
| `FE-160` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data with ReadStream values | 2023-10-25 | `858c080d` |
| `FE-161` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data and keep the order | 2023-10-25 | `cf9066c2` |
| `FE-162` | `library/browsercontext-fetch.spec.ts` | should support repeating names in multipart/form-data | 2024-10-25 | `63080711` |
| `FE-163` | `library/browsercontext-fetch.spec.ts` | should serialize data to json regardless of content-type | 2021-10-05 | `0c7d494a` |
| `FE-164` | `library/browsercontext-fetch.spec.ts` | should throw nice error on unsupported data type | 2021-10-05 | `bf99e2f8` |
| `FE-165` | `library/browsercontext-fetch.spec.ts` | context request should export same storage state as context | 2021-10-05 | `6af954f6` |
| `FE-166` | `library/browsercontext-fetch.spec.ts` | should send secure cookie over http for localhost | 2025-09-09 | `94c47f27` |
| `FE-167` | `library/browsercontext-fetch.spec.ts` | should accept bool and numeric params and filter out undefined | 2025-02-06 | `1b189a18` |
| `FE-168` | `library/browsercontext-fetch.spec.ts` | should abort requests when browser context closes | 2026-05-20 | `afd974a3` |
| `FE-169` | `library/browsercontext-fetch.spec.ts` | should work with connectOverCDP | 2022-04-22 | `30750f63` |
| `FE-170` | `library/browsercontext-fetch.spec.ts` | should support SameSite cookie attribute over https | 2025-09-09 | `2c56b550` |
| `FE-171` | `library/browsercontext-fetch.spec.ts` | should set domain=localhost cookie | 2025-09-09 | `99e5cd5e` |
| `FE-172` | `library/browsercontext-fetch.spec.ts` | fetch should not throw on long set-cookie value | 2023-09-19 | `47d67098` |
| `FE-173` | `library/browsercontext-fetch.spec.ts` | should support set-cookie with SameSite and without Secure attribute over HTTP | 2026-04-07 | `9d9917e1` |
| `FE-174` | `library/browsercontext-fetch.spec.ts` | should update host header on redirect | 2026-07-17 | `33ef9c4e` |
| `FE-175` | `library/browsercontext-fetch.spec.ts` | should not work after dispose | 2023-11-01 | `6910d6ff` |
| `FE-176` | `library/browsercontext-fetch.spec.ts` | should not work after context dispose | 2024-05-22 | `63ca2f77` |
| `FE-177` | `library/browsercontext-fetch.spec.ts` | should retry on ECONNRESET | 2024-07-29 | `6c763c44` |
| `FE-178` | `library/browsercontext-fetch.spec.ts` | should retry ECONNRESET on compressed response | 2026-05-28 | `0a537067` |
| `FE-179` | `library/browsercontext-fetch.spec.ts` | should retry ECONNRESET mid-stream during gzip decompression | 2026-05-28 | `69f748c7` |
| `FE-180` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should support decompression *(3 copies)* | 2024-07-24 | `24252fcd` |
| `FE-181` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail if response content-length header is missing {(gzip), (deflate), (br)} *(3 copies)* | 2024-07-24 | `a0211a0b` |
| `FE-182` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with chunked responses (without Content-Length header) *(3 copies)* | 2024-07-24 | `5c743f52` |
| `FE-183` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with an empty response without content-length header (Z\_BUF\_ERROR) *(3 copies)* | 2024-07-24 | `2ae7a218` |
| `FE-184` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with an empty response with content-length header (Z\_BUF\_ERROR) *(3 copies)* | 2024-07-24 | `a929ce63` |
| `FE-185` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | get should work | 2023-06-02 | `0b2b5e08` |
| `FE-186` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | get should work on request fixture | 2023-06-02 | `50577a23` |
| `FE-187` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | https post should work with ignoreHTTPSErrors option | 2025-08-26 | `6b17aa8e` |
| `FE-188` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | should work with ip6 and port as the host | 2023-06-02 | `307d9de9` |

### FF — Firefox

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FF-001` | `library/firefox/launcher.spec.ts` | should pass firefox user preferences | 2025-01-22 | `e6aa2b94` |
| `FF-002` | `library/firefox/launcher.spec.ts` | should pass firefox user preferences in persistent | 2025-01-22 | `e630ca9a` |
| `FF-003` | `library/firefox/launcher.spec.ts` | should support custom firefox policies | 2026-04-29 | `8b1ed881` |
| `FF-004` | `library/firefox/launcher.spec.ts` | should resize viewport with fractional device scale factor | 2026-10-14 | `45470834` |
| `FF-005` | `page/firefox-network-response.spec.ts` | should preserve original response header fields for {200, 302} responses *(2 copies)* | 2026-10-05 | `5986e7c5` |
| `FF-006` | `page/firefox-network-response.spec.ts` | should preserve synthesized response header fields | 2026-10-05 | `d54d2d23` |
| `FF-007` | `page/firefox-network-response.spec.ts` | should report current effective fields after cache revalidation | 2026-10-05 | `d4349894` |
| `FF-008` | `page/firefox-network-response.spec.ts` | should report a standalone 304 response without waiting for a cache merge | 2026-10-05 | `79cf35d6` |

### FI — Fill

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FI-001` | `page/page-fill.spec.ts` | should fill textarea @smoke | 2022-03-10 | `1101b5d1` |
| `FI-002` | `page/page-fill.spec.ts` | should fill input | 2020-08-11 | `eb79a90b` |
| `FI-003` | `page/page-fill.spec.ts` | should throw on unsupported inputs | 2022-12-24 | `39895f25` |
| `FI-004` | `page/page-fill.spec.ts` | should fill different input types | 2020-12-02 | `2186a309` |
| `FI-005` | `page/page-fill.spec.ts` | should fill range input | 2026-10-13 | `a45aa8c6` |
| `FI-006` | `page/page-fill.spec.ts` | should fill color input | 2021-12-06 | `93fe3739` |
| `FI-007` | `page/page-fill.spec.ts` | should fill color input case insensitive | 2026-06-15 | `4192f8b8` |
| `FI-008` | `page/page-fill.spec.ts` | should fill date input after clicking | 2020-08-04 | `e4e06aeb` |
| `FI-009` | `page/page-fill.spec.ts` | input event.composed should be true and cross shadow dom boundary - {color, date, time, datetime-local, month, range, week} *(7 copies)* | 2023-12-23 | `a95f8d41` |
| `FI-010` | `page/page-fill.spec.ts` | should fill time input | 2020-09-26 | `36224295` |
| `FI-011` | `page/page-fill.spec.ts` | should fill month input | 2020-12-02 | `4e6381e5` |
| `FI-012` | `page/page-fill.spec.ts` | should fill week input | 2020-12-02 | `02130916` |
| `FI-013` | `page/page-fill.spec.ts` | should fill datetime-local input | 2026-10-15 | `0ef5d886` |
| `FI-014` | `page/page-fill.spec.ts` | should fill contenteditable | 2020-08-04 | `2c7a6eb4` |
| `FI-015` | `page/page-fill.spec.ts` | should fill contenteditable with new lines | 2025-12-15 | `a60bf708` |
| `FI-016` | `page/page-fill.spec.ts` | should not double-fill in contenteditable with beforeinput handler in Firefox | 2026-07-10 | `ba4cd3c8` |
| `FI-017` | `page/page-fill.spec.ts` | should fill elements with existing value and selection | 2020-08-11 | `7856dc20` |
| `FI-018` | `page/page-fill.spec.ts` | should throw nice error without injected script stack when element is not an \<input\> | 2024-11-22 | `0de80316` |
| `FI-019` | `page/page-fill.spec.ts` | should throw if passed a non-string value | 2020-09-09 | `edf449b3` |
| `FI-020` | `page/page-fill.spec.ts` | should retry on disabled element | 2020-08-11 | `a59e2757` |
| `FI-021` | `page/page-fill.spec.ts` | should retry on readonly element | 2020-08-11 | `520eca89` |
| `FI-022` | `page/page-fill.spec.ts` | should retry on invisible element | 2020-08-11 | `8b5300a4` |
| `FI-023` | `page/page-fill.spec.ts` | should be able to fill the body | 2020-08-04 | `f3ec7bd6` |
| `FI-024` | `page/page-fill.spec.ts` | should fill fixed position input | 2020-08-04 | `66ca5052` |
| `FI-025` | `page/page-fill.spec.ts` | should be able to fill when focus is in the wrong frame | 2020-08-04 | `73a0a062` |
| `FI-026` | `page/page-fill.spec.ts` | should be able to fill the input\[type=number\] | 2020-08-11 | `73be0eb2` |
| `FI-027` | `page/page-fill.spec.ts` | should be able to fill exponent into the input\[type=number\] | 2020-08-11 | `c0e9ad27` |
| `FI-028` | `page/page-fill.spec.ts` | should be able to fill input\[type=number\] with empty string | 2020-08-11 | `71ab93c9` |
| `FI-029` | `page/page-fill.spec.ts` | should not be able to fill text into the input\[type=number\] | 2020-08-04 | `043da506` |
| `FI-030` | `page/page-fill.spec.ts` | should be able to clear using fill() | 2022-10-25 | `23bbbd83` |
| `FI-031` | `page/page-fill.spec.ts` | should not throw when fill causes navigation | 2021-01-19 | `1f067f6e` |
| `FI-032` | `page/page-fill.spec.ts` | fill back to back | 2022-07-25 | `c9cb9726` |
| `FI-033` | `page/page-fill.spec.ts` | should fill contenteditable with focus handler that collapses selection | 2026-03-03 | `883f09a8` |
| `FI-034` | `page/page-fill.spec.ts` | should retry on inert element | 2026-10-08 | `103bcdc8` |
| `FI-035` | `page/page-fill.spec.ts` | should retry on element outside of a modal dialog | 2026-10-08 | `c0ccc79b` |
| `FI-036` | `page/page-fill.spec.ts` | should fail with a nice error on inert element | 2026-10-08 | `c0118430` |

### FO — Focus

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FO-001` | `page/page-focus.spec.ts` | should work @smoke | 2025-12-15 | `63b7392a` |
| `FO-002` | `page/page-focus.spec.ts` | should emit focus event | 2020-08-22 | `20290656` |
| `FO-003` | `page/page-focus.spec.ts` | should emit blur event | 2020-08-22 | `9f0c28e8` |
| `FO-004` | `page/page-focus.spec.ts` | should traverse focus | 2020-08-28 | `6645a6cb` |
| `FO-005` | `page/page-focus.spec.ts` | should traverse focus in all directions | 2020-08-11 | `dd87af3f` |
| `FO-006` | `page/page-focus.spec.ts` | should traverse only form elements | 2024-05-08 | `28ebb3c9` |
| `FO-007` | `page/page-focus.spec.ts` | clicking checkbox should activate it | 2026-06-12 | `2bc78bdd` |
| `FO-008` | `page/page-focus.spec.ts` | tab should cycle between single input and browser | 2026-06-12 | `204b3952` |
| `FO-009` | `page/page-focus.spec.ts` | tab should cycle between document elements and browser | 2026-06-12 | `def35b57` |
| `FO-010` | `page/page-focus.spec.ts` | keeps focus on element when attempting to focus a non-focusable element | 2022-05-19 | `01c82435` |
| `FO-011` | `page/page-focus.spec.ts` | should move focus from an iframe to its parent | 2026-10-16 | `db6e53e2` |
| `FO-012` | `page/page-focus.spec.ts` | should tab from an iframe to its parent | 2026-10-16 | `a35a3d6b` |

### FR — Frame

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `FR-001` | `page/frame-evaluate.spec.ts` | should have different execution contexts | 2020-09-18 | `720a2f5d` |
| `FR-002` | `page/frame-evaluate.spec.ts` | should have correct execution contexts @smoke | 2022-03-10 | `5d12e0e0` |
| `FR-003` | `page/frame-evaluate.spec.ts` | should dispose context on navigation | 2022-07-31 | `00b8510b` |
| `FR-004` | `page/frame-evaluate.spec.ts` | should dispose context on cross-origin navigation | 2022-07-31 | `c3609175` |
| `FR-005` | `page/frame-evaluate.spec.ts` | should execute after cross-site navigation | 2021-03-19 | `583cd7eb` |
| `FR-006` | `page/frame-evaluate.spec.ts` | should not allow cross-frame js handles | 2020-08-11 | `732a0170` |
| `FR-007` | `page/frame-evaluate.spec.ts` | should allow cross-frame element handles | 2020-08-03 | `7cacfe2e` |
| `FR-008` | `page/frame-evaluate.spec.ts` | should not allow cross-frame element handles when frames do not script each other | 2022-07-28 | `551affcf` |
| `FR-009` | `page/frame-evaluate.spec.ts` | should throw for detached frames | 2021-11-03 | `ad457d92` |
| `FR-010` | `page/frame-evaluate.spec.ts` | should be isolated between frames | 2020-09-18 | `e60f8515` |
| `FR-011` | `page/frame-evaluate.spec.ts` | should work in iframes that failed initial navigation | 2026-06-12 | `e728aa48` |
| `FR-012` | `page/frame-evaluate.spec.ts` | should work in iframes that interrupted initial javascript url navigation | 2021-04-05 | `70aa62f5` |
| `FR-013` | `page/frame-evaluate.spec.ts` | evaluateHandle should work | 2020-08-03 | `35abdaac` |
| `FR-014` | `page/frame-frame-element.spec.ts` | should work @smoke | 2022-03-10 | `e34cb7f2` |
| `FR-015` | `page/frame-frame-element.spec.ts` | should work with contentFrame | 2020-09-18 | `97e8e803` |
| `FR-016` | `page/frame-frame-element.spec.ts` | should work with frameset | 2021-05-09 | `842ac7ec` |
| `FR-017` | `page/frame-frame-element.spec.ts` | should throw when detached | 2020-09-18 | `f1fbadf1` |
| `FR-018` | `page/frame-frame-element.spec.ts` | should work inside closed shadow root | 2025-12-03 | `5842f2b1` |
| `FR-019` | `page/frame-frame-element.spec.ts` | should work inside declarative shadow root | 2025-12-03 | `5441614c` |
| `FR-020` | `page/frame-goto.spec.ts` | should navigate subframes @smoke | 2022-03-10 | `11a96678` |
| `FR-021` | `page/frame-goto.spec.ts` | should reject when frame detaches | 2023-07-25 | `e68ab827` |
| `FR-022` | `page/frame-goto.spec.ts` | should continue after client redirect | 2025-12-15 | `40a92510` |
| `FR-023` | `page/frame-goto.spec.ts` | should return matching responses | 2020-09-18 | `9d541e9e` |
| `FR-024` | `page/frame-hierarchy.spec.ts` | should handle nested frames @smoke | 2025-12-15 | `cf340c26` |
| `FR-025` | `page/frame-hierarchy.spec.ts` | should send events when frames are manipulated dynamically | 2020-09-18 | `be80f7e7` |
| `FR-026` | `page/frame-hierarchy.spec.ts` | should send "framenavigated" when navigating on anchor URLs | 2020-08-03 | `4378985a` |
| `FR-027` | `page/frame-hierarchy.spec.ts` | should persist mainFrame on cross-process navigation | 2020-08-03 | `e7653e92` |
| `FR-028` | `page/frame-hierarchy.spec.ts` | should not send attach/detach events for main frame | 2020-08-03 | `7d20d623` |
| `FR-029` | `page/frame-hierarchy.spec.ts` | should detach child frames on navigation | 2020-08-03 | `0d570ebd` |
| `FR-030` | `page/frame-hierarchy.spec.ts` | should support framesets | 2020-08-03 | `a89a84e1` |
| `FR-031` | `page/frame-hierarchy.spec.ts` | should report frame from-inside shadow DOM | 2020-08-03 | `0ad0b7fc` |
| `FR-032` | `page/frame-hierarchy.spec.ts` | should report frame.name() | 2025-12-15 | `6328cc42` |
| `FR-033` | `page/frame-hierarchy.spec.ts` | should report frame.parent() | 2020-09-18 | `88030766` |
| `FR-034` | `page/frame-hierarchy.spec.ts` | should report different frame instance when frame re-attaches | 2022-07-28 | `79b975d4` |
| `FR-035` | `page/frame-hierarchy.spec.ts` | should refuse to display x-frame-options:deny iframe | 2023-01-28 | `0d081e73` |
| `FR-036` | `page/frame-hierarchy.spec.ts` | should return frame.page() | 2020-08-12 | `6390b852` |

### GE — Geolocation

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `GE-001` | `library/geolocation.spec.ts` | should work @smoke | 2022-03-10 | `06297eb1` |
| `GE-002` | `library/geolocation.spec.ts` | should throw when invalid longitude | 2021-04-03 | `bc410efb` |
| `GE-003` | `library/geolocation.spec.ts` | should isolate contexts | 2021-04-03 | `44448307` |
| `GE-004` | `library/geolocation.spec.ts` | should throw with missing latitude | 2025-07-31 | `9977dd23` |
| `GE-005` | `library/geolocation.spec.ts` | should not modify passed default options object | 2020-08-03 | `a3cd456c` |
| `GE-006` | `library/geolocation.spec.ts` | should throw with missing longitude in default options | 2025-07-31 | `fc6edc66` |
| `GE-007` | `library/geolocation.spec.ts` | should use context options | 2020-08-03 | `6a2e7938` |
| `GE-008` | `library/geolocation.spec.ts` | watchPosition should be notified | 2022-07-27 | `b21095ca` |
| `GE-009` | `library/geolocation.spec.ts` | should use context options for popup | 2021-04-03 | `0539399b` |

### GN — Locator and selector generator

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `GN-001` | `library/locator-generator.spec.ts` | reverse engineer locators | 2026-10-07 | `05c858f3` |
| `GN-002` | `library/locator-generator.spec.ts` | reverse engineer getByRole | 2026-04-21 | `436955a1` |
| `GN-003` | `library/locator-generator.spec.ts` | refuses to translate internal:role with conflicting name/description exactness | 2026-05-29 | `be1f93fd` |
| `GN-004` | `library/locator-generator.spec.ts` | reverse engineer internal:role with regex and string name/description | 2026-09-21 | `815027af` |
| `GN-005` | `library/locator-generator.spec.ts` | reverse engineer ignore-case locators | 2022-10-18 | `897f12a3` |
| `GN-006` | `library/locator-generator.spec.ts` | reverse engineer ordered locators | 2022-10-31 | `c637135a` |
| `GN-007` | `library/locator-generator.spec.ts` | reverse engineer locators with regex | 2022-10-31 | `6ede8bb1` |
| `GN-008` | `library/locator-generator.spec.ts` | reverse engineer hasText | 2022-12-28 | `8fe95df2` |
| `GN-009` | `library/locator-generator.spec.ts` | reverse engineer hasNotText | 2023-04-05 | `819b1f11` |
| `GN-010` | `library/locator-generator.spec.ts` | reverse engineer visible | 2026-09-01 | `41bac11b` |
| `GN-011` | `library/locator-generator.spec.ts` | reverse engineer has | 2022-12-28 | `7cac4b1b` |
| `GN-012` | `library/locator-generator.spec.ts` | reverse engineer hasNot | 2023-04-05 | `9c7185f9` |
| `GN-013` | `library/locator-generator.spec.ts` | reverse engineer has + hasText | 2024-01-10 | `eae991a2` |
| `GN-014` | `library/locator-generator.spec.ts` | reverse engineer frameLocator | 2026-10-07 | `78663ae0` |
| `GN-015` | `library/locator-generator.spec.ts` | reverse engineer frameLocator without a selector | 2026-08-28 | `52e2ae5c` |
| `GN-016` | `library/locator-generator.spec.ts` | generate multiple locators | 2026-10-07 | `521066a9` |
| `GN-017` | `library/locator-generator.spec.ts` | reverse engineer internal:has-text locators | 2024-09-19 | `139da90e` |
| `GN-018` | `library/locator-generator.spec.ts` | asLocator internal:and | 2024-09-19 | `81363cc5` |
| `GN-019` | `library/locator-generator.spec.ts` | asLocator internal:or | 2024-09-19 | `eb1700ba` |
| `GN-020` | `library/locator-generator.spec.ts` | asLocator internal:chain | 2024-09-19 | `27a35bc9` |
| `GN-021` | `library/locator-generator.spec.ts` | reverse engineer nested locators | 2026-10-07 | `25088142` |
| `GN-022` | `library/locator-generator.spec.ts` | asLocator xpath | 2026-09-24 | `6b9f9c8f` |
| `GN-023` | `library/locator-generator.spec.ts` | reverse engineer regex flags | 2026-09-24 | `5ab4ac6b` |
| `GN-024` | `library/locator-generator.spec.ts` | should not oom in locator parser | 2024-12-19 | `b342121c` |
| `GN-025` | `library/locator-generator.spec.ts` | asLocatorDescription invalid input | 2025-07-04 | `da58393b` |
| `GN-026` | `library/locator-generator.spec.ts` | resolveSelector returns locatorCode for sdkLanguage | 2026-10-06 | `7c725a7f` |
| `GN-027` | `library/locator-generator.spec.ts` | asLocatorDescription via LocalUtils | 2026-10-07 | `92bb4024` |
| `GN-028` | `library/selector-generator.spec.ts` | selector generator › should prefer button over inner span | 2025-05-26 | `9470da5a` |
| `GN-029` | `library/selector-generator.spec.ts` | selector generator › should prefer role=button over inner span | 2025-05-26 | `35df7706` |
| `GN-030` | `library/selector-generator.spec.ts` | selector generator › should not prefer zero-sized button over inner span | 2024-07-08 | `182ae0c2` |
| `GN-031` | `library/selector-generator.spec.ts` | selector generator › should generate text and normalize whitespace | 2022-10-18 | `a6c50feb` |
| `GN-032` | `library/selector-generator.spec.ts` | selector generator › should not escape spaces inside named attr selectors | 2024-12-12 | `98be35bd` |
| `GN-033` | `library/selector-generator.spec.ts` | selector generator › should generate text for \<input type=button\> | 2022-11-11 | `9cfca39d` |
| `GN-034` | `library/selector-generator.spec.ts` | selector generator › should trim text | 2023-11-13 | `e98571ca` |
| `GN-035` | `library/selector-generator.spec.ts` | selector generator › should try to improve role name | 2023-11-13 | `a11c0b14` |
| `GN-036` | `library/selector-generator.spec.ts` | selector generator › should use description when name is not unique | 2026-05-29 | `17ad111a` |
| `GN-037` | `library/selector-generator.spec.ts` | selector generator › should not use description when name is unique | 2026-04-21 | `ae2dd189` |
| `GN-038` | `library/selector-generator.spec.ts` | selector generator › should use description from aria-describedby | 2026-05-29 | `ce91c7cd` |
| `GN-039` | `library/selector-generator.spec.ts` | selector generator › should fall back to nth when name and description are both not unique | 2026-04-21 | `421e98ba` |
| `GN-040` | `library/selector-generator.spec.ts` | selector generator › should use consistent exactness for name and description | 2026-05-29 | `785a593c` |
| `GN-041` | `library/selector-generator.spec.ts` | selector generator › should use description when role has no name | 2026-04-21 | `6ecc7758` |
| `GN-042` | `library/selector-generator.spec.ts` | selector generator › should try to improve text | 2023-11-13 | `6a8d9555` |
| `GN-043` | `library/selector-generator.spec.ts` | selector generator › should try to improve text by shortening | 2023-11-13 | `13275b8e` |
| `GN-044` | `library/selector-generator.spec.ts` | selector generator › should try to improve label text by shortening | 2024-12-12 | `a33d757d` |
| `GN-045` | `library/selector-generator.spec.ts` | selector generator › should not improve guid text | 2023-11-13 | `f3efc3b5` |
| `GN-046` | `library/selector-generator.spec.ts` | selector generator › should not escape text with \>\> | 2022-10-18 | `0bccca00` |
| `GN-047` | `library/selector-generator.spec.ts` | selector generator › should escape text with quote | 2022-10-18 | `c6ccd636` |
| `GN-048` | `library/selector-generator.spec.ts` | selector generator › should escape text with slash | 2022-10-18 | `64324514` |
| `GN-049` | `library/selector-generator.spec.ts` | selector generator › should not use text for select | 2022-11-10 | `57f6c771` |
| `GN-050` | `library/selector-generator.spec.ts` | selector generator › should use ordinal for identical nodes | 2022-10-18 | `bb30b35f` |
| `GN-051` | `library/selector-generator.spec.ts` | selector generator › should prefer data-testid | 2022-11-08 | `f8e88fa1` |
| `GN-052` | `library/selector-generator.spec.ts` | selector generator › should use data-testid in strict errors | 2025-05-21 | `351c553d` |
| `GN-053` | `library/selector-generator.spec.ts` | selector generator › should handle first non-unique data-testid | 2022-11-08 | `66f961c7` |
| `GN-054` | `library/selector-generator.spec.ts` | selector generator › should handle second non-unique data-testid | 2022-11-08 | `cabe0c16` |
| `GN-055` | `library/selector-generator.spec.ts` | selector generator › should use readable id | 2021-02-09 | `88991f3a` |
| `GN-056` | `library/selector-generator.spec.ts` | selector generator › should not use generated id | 2022-02-04 | `11e2c3dc` |
| `GN-057` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text | 2022-10-21 | `19b13f46` |
| `GN-058` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text with regexp | 2023-03-15 | `3c47a7cf` |
| `GN-059` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text with regexp with a quote | 2024-05-13 | `268f50b0` |
| `GN-060` | `library/selector-generator.spec.ts` | selector generator › should chain text after parent | 2022-11-10 | `91982db6` |
| `GN-061` | `library/selector-generator.spec.ts` | selector generator › should use parent text | 2022-10-21 | `58b588cf` |
| `GN-062` | `library/selector-generator.spec.ts` | selector generator › should separate selectors by \>\> | 2022-10-18 | `440869a8` |
| `GN-063` | `library/selector-generator.spec.ts` | selector generator › should trim long text | 2023-11-13 | `c709b5e2` |
| `GN-064` | `library/selector-generator.spec.ts` | selector generator › should use nested ordinals | 2022-10-03 | `5dbb6c0d` |
| `GN-065` | `library/selector-generator.spec.ts` | selector generator › should prefer class to ordinal | 2025-06-10 | `a2dab5ee` |
| `GN-066` | `library/selector-generator.spec.ts` | selector generator › should properly join child selectors under nested ordinals | 2022-10-03 | `9fd6c0fd` |
| `GN-067` | `library/selector-generator.spec.ts` | selector generator › should not use input\[value\] | 2022-11-10 | `f1d9be38` |
| `GN-068` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › role | 2022-11-10 | `6b80092c` |
| `GN-069` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › placeholder | 2024-12-12 | `5a8942a3` |
| `GN-070` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › name | 2024-04-18 | `50f307eb` |
| `GN-071` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › type | 2024-04-18 | `bb09c5a0` |
| `GN-072` | `library/selector-generator.spec.ts` | selector generator › should find text in shadow dom | 2022-10-18 | `71d23580` |
| `GN-073` | `library/selector-generator.spec.ts` | selector generator › should match in shadow dom | 2022-11-10 | `3308f157` |
| `GN-074` | `library/selector-generator.spec.ts` | selector generator › should match in deep shadow dom | 2022-11-10 | `a5ca1306` |
| `GN-075` | `library/selector-generator.spec.ts` | selector generator › should work in dynamic iframes without navigation | 2022-10-18 | `1be9ebb5` |
| `GN-076` | `library/selector-generator.spec.ts` | selector generator › should use the name attributes for elements that can have it | 2022-06-03 | `86911c70` |
| `GN-077` | `library/selector-generator.spec.ts` | selector generator › should work with tricky attributes | 2025-05-26 | `cc0060dc` |
| `GN-078` | `library/selector-generator.spec.ts` | selector generator › should work without CSS.escape | 2025-05-26 | `35ede2a5` |
| `GN-079` | `library/selector-generator.spec.ts` | selector generator › should not over-escape for CSS syntax | 2025-05-26 | `98dabb11` |
| `GN-080` | `library/selector-generator.spec.ts` | selector generator › should ignore empty aria-label for candidate consideration | 2022-03-22 | `10c64856` |
| `GN-081` | `library/selector-generator.spec.ts` | selector generator › should accept valid aria-label for candidate consideration | 2024-12-12 | `15ec6189` |
| `GN-082` | `library/selector-generator.spec.ts` | selector generator › should generate title selector | 2026-04-21 | `bba53abe` |
| `GN-083` | `library/selector-generator.spec.ts` | selector generator › should ignore empty role for candidate consideration | 2022-03-22 | `47fcf7b3` |
| `GN-084` | `library/selector-generator.spec.ts` | selector generator › should not accept invalid role for candidate consideration | 2022-10-03 | `3d5a19c2` |
| `GN-085` | `library/selector-generator.spec.ts` | selector generator › should ignore empty data-test-id for candidate consideration | 2022-03-22 | `37279a04` |
| `GN-086` | `library/selector-generator.spec.ts` | selector generator › should accept valid data-test-id for candidate consideration | 2022-03-22 | `36d86126` |
| `GN-087` | `library/selector-generator.spec.ts` | selector generator › should generate label selector | 2026-07-22 | `6f7d1d29` |
| `GN-088` | `library/selector-generator.spec.ts` | selector generator › should prefer role other input\[type\] | 2022-11-10 | `b2d7276b` |
| `GN-089` | `library/selector-generator.spec.ts` | selector generator › should generate exact text when necessary | 2022-12-23 | `7997fba3` |
| `GN-090` | `library/selector-generator.spec.ts` | selector generator › should generate exact title when necessary | 2022-12-23 | `27e97102` |
| `GN-091` | `library/selector-generator.spec.ts` | selector generator › should generate exact placeholder when necessary | 2024-12-12 | `9fc2beb7` |
| `GN-092` | `library/selector-generator.spec.ts` | selector generator › should generate exact role when necessary | 2022-12-23 | `3efedc4f` |
| `GN-093` | `library/selector-generator.spec.ts` | selector generator › should generate exact label when necessary | 2024-12-12 | `8fe7fe4b` |
| `GN-094` | `library/selector-generator.spec.ts` | selector generator › should generate relative selector | 2024-01-23 | `b60db6c3` |
| `GN-095` | `library/selector-generator.spec.ts` | selector generator › should generate noText: no text engine | 2026-07-31 | `a281bef1` |
| `GN-096` | `library/selector-generator.spec.ts` | selector generator › should generate noText: no name from content | 2026-07-31 | `29e5d570` |
| `GN-097` | `library/selector-generator.spec.ts` | selector generator › should generate noText: name from aria-label | 2026-07-31 | `c821c142` |
| `GN-098` | `library/selector-generator.spec.ts` | selector generator › should generate noText: name from external aria-labelledby | 2026-07-31 | `568bb814` |
| `GN-099` | `library/selector-generator.spec.ts` | selector generator › should generate noText: ignore aria-labelledby pointing inside the element | 2026-07-31 | `57ade51d` |
| `GN-100` | `library/selector-generator.spec.ts` | selector generator › should generate noText: contenteditable heading | 2026-07-31 | `4b1e9949` |
| `GN-101` | `library/selector-generator.spec.ts` | selector generator › should generate noText: description from external aria-describedby | 2026-07-31 | `f5837507` |
| `GN-102` | `library/selector-generator.spec.ts` | selector generator › should generate noText: ignore aria-describedby pointing inside the element | 2026-07-31 | `652e1c2f` |
| `GN-103` | `library/selector-generator.spec.ts` | selector generator › should prefer role with hasText to css with hasText | 2026-07-31 | `27a2a8d3` |
| `GN-104` | `library/selector-generator.spec.ts` | selector generator › should not use icon fonts aria name | 2025-11-11 | `8f1447d2` |

### HA — HAR

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `HA-001` | `library/har.spec.ts` | should have version and creator | 2023-07-31 | `f68050c9` |
| `HA-002` | `library/har.spec.ts` | should have browser | 2025-08-20 | `d9c5e288` |
| `HA-003` | `library/har.spec.ts` | should have pages | 2023-10-23 | `47553221` |
| `HA-004` | `library/har.spec.ts` | should have pages in persistent context | 2025-05-21 | `212cf5ba` |
| `HA-005` | `library/har.spec.ts` | should include request | 2023-10-23 | `1761d7bc` |
| `HA-006` | `library/har.spec.ts` | should populate entry startedDateTime from the browser | 2026-06-04 | `2e25765e` |
| `HA-007` | `library/har.spec.ts` | should include response | 2023-10-23 | `a294cb84` |
| `HA-008` | `library/har.spec.ts` | should include redirectURL | 2021-04-03 | `e8f8c793` |
| `HA-009` | `library/har.spec.ts` | should include query params | 2021-04-03 | `85d76da5` |
| `HA-010` | `library/har.spec.ts` | should include postData | 2021-04-03 | `964391eb` |
| `HA-011` | `library/har.spec.ts` | should include binary postData | 2021-04-03 | `5b848a90` |
| `HA-012` | `library/har.spec.ts` | should include form params | 2021-04-03 | `cae8ae58` |
| `HA-013` | `library/har.spec.ts` | should include cookies | 2021-04-03 | `a252cbe4` |
| `HA-014` | `library/har.spec.ts` | should include set-cookies | 2023-10-23 | `7c5cc9ff` |
| `HA-015` | `library/har.spec.ts` | should include set-cookies without equals sign as nameless | 2026-10-06 | `01c23934` |
| `HA-016` | `library/har.spec.ts` | should include set-cookies with lowercase attributes | 2026-06-26 | `b0c52208` |
| `HA-017` | `library/har.spec.ts` | should skip invalid Expires | 2023-09-15 | `146ae372` |
| `HA-018` | `library/har.spec.ts` | should include set-cookies with comma | 2021-09-03 | `0917492c` |
| `HA-019` | `library/har.spec.ts` | should include secure set-cookies | 2021-04-03 | `3f90b161` |
| `HA-020` | `library/har.spec.ts` | should record request overrides | 2025-03-20 | `d072c59b` |
| `HA-021` | `library/har.spec.ts` | should include content @smoke | 2023-10-23 | `43b96f96` |
| `HA-022` | `library/har.spec.ts` | should use attach mode for zip extension | 2023-10-23 | `8cf777aa` |
| `HA-023` | `library/har.spec.ts` | should omit content | 2022-06-22 | `7c946dd8` |
| `HA-024` | `library/har.spec.ts` | should omit content legacy | 2022-06-22 | `8ef61093` |
| `HA-025` | `library/har.spec.ts` | should attach content | 2023-10-23 | `fd058261` |
| `HA-026` | `library/har.spec.ts` | should filter by glob | 2022-06-08 | `50e6ce0c` |
| `HA-027` | `library/har.spec.ts` | should filter by regexp | 2022-06-08 | `7019eead` |
| `HA-028` | `library/har.spec.ts` | should include sizes | 2021-09-02 | `15d7c634` |
| `HA-029` | `library/har.spec.ts` | should work with gzip compression | 2023-10-23 | `853879b6` |
| `HA-030` | `library/har.spec.ts` | should calculate time | 2021-05-11 | `43157d17` |
| `HA-031` | `library/har.spec.ts` | should return receive time | 2022-12-23 | `e7e1e1d5` |
| `HA-032` | `library/har.spec.ts` | should report the correct \_transferSize with PNG files | 2021-08-27 | `b2675990` |
| `HA-033` | `library/har.spec.ts` | should have -1 \_transferSize when its a failed request | 2023-10-23 | `8e63dfe4` |
| `HA-034` | `library/har.spec.ts` | should record failed request headers | 2023-10-23 | `a947c7d4` |
| `HA-035` | `library/har.spec.ts` | should record failed request overrides | 2025-03-20 | `326c304c` |
| `HA-036` | `library/har.spec.ts` | should report the correct request body size | 2023-06-02 | `5f58f7cf` |
| `HA-037` | `library/har.spec.ts` | should report the correct request body size when the bodySize is 0 | 2023-06-02 | `58811536` |
| `HA-038` | `library/har.spec.ts` | should report the correct response body size when the bodySize is 0 | 2023-10-23 | `5d1d2827` |
| `HA-039` | `library/har.spec.ts` | should have popup requests | 2023-10-23 | `25dad67b` |
| `HA-040` | `library/har.spec.ts` | should not contain internal pages | 2023-10-23 | `4c383ed0` |
| `HA-041` | `library/har.spec.ts` | should have connection details | 2021-10-15 | `1406e258` |
| `HA-042` | `library/har.spec.ts` | should have security details | 2026-08-11 | `22faf2a2` |
| `HA-043` | `library/har.spec.ts` | should have connection details for redirects | 2026-06-09 | `27b2476c` |
| `HA-044` | `library/har.spec.ts` | should have connection details for failed requests | 2023-10-23 | `d1f141dd` |
| `HA-045` | `library/har.spec.ts` | should return server address directly from response | 2023-10-23 | `89031cf8` |
| `HA-046` | `library/har.spec.ts` | should return security details directly from response | 2026-07-30 | `7eacdd27` |
| `HA-047` | `library/har.spec.ts` | should contain http2 for http2 requests | 2025-10-06 | `721056af` |
| `HA-048` | `library/har.spec.ts` | should filter favicon and favicon redirects | 2025-10-03 | `3f1e01a8` |
| `HA-049` | `library/har.spec.ts` | should have different hars for concurrent contexts | 2023-10-23 | `e91654c1` |
| `HA-050` | `library/har.spec.ts` | should exclude API request | 2026-08-11 | `c375e8af` |
| `HA-051` | `library/har.spec.ts` | should correctly record API request cookies with equals sign in value | 2026-08-11 | `197cccae` |
| `HA-052` | `library/har.spec.ts` | should record nameless API request cookies | 2026-10-06 | `18e3c45f` |
| `HA-053` | `library/har.spec.ts` | should respect minimal mode for API Requests | 2026-08-11 | `650f976f` |
| `HA-054` | `library/har.spec.ts` | should include redirects from API request | 2026-09-04 | `ba093b7c` |
| `HA-055` | `library/har.spec.ts` | should not hang on resources served from cache | 2025-12-15 | `64bc4dac` |
| `HA-056` | `library/har.spec.ts` | should not hang on slow chunked response | 2025-08-20 | `a0f9ea21` |
| `HA-057` | `library/har.spec.ts` | should close the context when saving the har fails | 2026-08-13 | `a5e8a8b7` |
| `HA-058` | `library/har.spec.ts` | should support HAR larger than 512MB | 2026-08-11 | `a6033e86` |
| `HA-059` | `library/har.spec.ts` | should record resource type | 2026-06-01 | `56fda961` |
| `HA-060` | `library/har.spec.ts` | tracing.startHar › should record a HAR with options | 2026-04-13 | `c58e41df` |
| `HA-061` | `library/har.spec.ts` | tracing.startHar › should record a HAR for a context APIRequestContext | 2026-08-11 | `f2ff429d` |
| `HA-062` | `library/har.spec.ts` | tracing.startHar › should include pages | 2026-06-04 | `2fe8797c` |
| `HA-063` | `library/har.spec.ts` | tracing.startHar › should record a zipped HAR for APIRequestContext | 2026-04-13 | `82274171` |
| `HA-064` | `library/har.spec.ts` | tracing.startHar › should record correct cookie expires for APIRequestContext | 2026-06-26 | `1381d113` |
| `HA-065` | `library/har.spec.ts` | tracing.startHar › should record mixed-case request content-type for APIRequestContext | 2026-06-26 | `37937bf5` |
| `HA-066` | `library/har.spec.ts` | tracing.startHar › should record a HAR with resourcesDir | 2026-08-11 | `7e6830a6` |
| `HA-067` | `library/har.spec.ts` | tracing.startHar › should reject resourcesDir together with a .zip har file | 2026-04-29 | `217fbaff` |
| `HA-068` | `library/browsercontext-har.spec.ts` | should context.routeFromHAR, matching the method and following redirects | 2022-08-02 | `d40fb71b` |
| `HA-069` | `library/browsercontext-har.spec.ts` | should page.routeFromHAR, matching the method and following redirects | 2022-08-02 | `6405e9fa` |
| `HA-070` | `library/browsercontext-har.spec.ts` | fallback:continue should continue when not found in har | 2022-08-02 | `4ea66684` |
| `HA-071` | `library/browsercontext-har.spec.ts` | by default should abort requests not found in har | 2022-08-02 | `a3a08b6c` |
| `HA-072` | `library/browsercontext-har.spec.ts` | fallback:continue should continue requests on bad har | 2022-08-02 | `4284da27` |
| `HA-073` | `library/browsercontext-har.spec.ts` | should only handle requests matching url filter | 2022-08-02 | `adca3c77` |
| `HA-074` | `library/browsercontext-har.spec.ts` | should only context.routeFromHAR requests matching url filter | 2022-08-02 | `c902f5ee` |
| `HA-075` | `library/browsercontext-har.spec.ts` | should only page.routeFromHAR requests matching url filter | 2022-08-02 | `5918d0af` |
| `HA-076` | `library/browsercontext-har.spec.ts` | should apply overrides before routing from har | 2024-01-26 | `90956613` |
| `HA-077` | `library/browsercontext-har.spec.ts` | should support regex filter | 2022-08-02 | `6ad825da` |
| `HA-078` | `library/browsercontext-har.spec.ts` | newPage should fulfill from har, matching the method and following redirects | 2022-08-02 | `1a793c2d` |
| `HA-079` | `library/browsercontext-har.spec.ts` | should change document URL after redirected navigation | 2023-10-23 | `ec9677f3` |
| `HA-080` | `library/browsercontext-har.spec.ts` | should change document URL after redirected navigation on click | 2023-10-23 | `69af4653` |
| `HA-081` | `library/browsercontext-har.spec.ts` | should goBack to redirected navigation | 2023-10-23 | `a311de85` |
| `HA-082` | `library/browsercontext-har.spec.ts` | should goForward to redirected navigation | 2023-10-23 | `5f37ede2` |
| `HA-083` | `library/browsercontext-har.spec.ts` | should reload redirected navigation | 2023-10-23 | `b17f18d3` |
| `HA-084` | `library/browsercontext-har.spec.ts` | should fulfill from har with content in a file | 2022-08-02 | `98bd373e` |
| `HA-085` | `library/browsercontext-har.spec.ts` | should round-trip har.zip | 2022-08-02 | `686df29e` |
| `HA-086` | `library/browsercontext-har.spec.ts` | should produce extracted zip | 2022-08-02 | `f5813f0e` |
| `HA-087` | `library/browsercontext-har.spec.ts` | should round-trip extracted har.zip | 2022-08-02 | `60be41b3` |
| `HA-088` | `library/browsercontext-har.spec.ts` | should round-trip har with postData | 2024-01-26 | `daba2723` |
| `HA-089` | `library/browsercontext-har.spec.ts` | should record overridden requests to har | 2024-01-26 | `1913b1c6` |
| `HA-090` | `library/browsercontext-har.spec.ts` | should disambiguate by header | 2022-08-02 | `2997176f` |
| `HA-091` | `library/browsercontext-har.spec.ts` | should update har.zip for context | 2022-08-02 | `6372fc5a` |
| `HA-092` | `library/browsercontext-har.spec.ts` | should ignore boundary when matching multipart/form-data body | 2024-07-12 | `75d1db43` |
| `HA-093` | `library/browsercontext-har.spec.ts` | should record single set-cookie headers | 2026-02-14 | `70422c7e` |
| `HA-094` | `library/browsercontext-har.spec.ts` | should record multiple set-cookie headers | 2026-02-14 | `d1ebc69c` |
| `HA-095` | `library/browsercontext-har.spec.ts` | should update har.zip for page | 2023-02-27 | `17f37f2b` |
| `HA-096` | `library/browsercontext-har.spec.ts` | should update har.zip for page with different options | 2023-03-17 | `a650109d` |
| `HA-097` | `library/browsercontext-har.spec.ts` | should update extracted har.zip for page | 2022-08-02 | `b76b9dd2` |
| `HA-098` | `library/browsercontext-har.spec.ts` | page.unrouteAll should stop page.routeFromHAR | 2023-12-14 | `e5f77548` |
| `HA-099` | `library/browsercontext-har.spec.ts` | context.unrouteAll should stop context.routeFromHAR | 2023-12-14 | `b38a6929` |
| `HA-100` | `library/browsercontext-har.spec.ts` | should ignore aborted requests | 2024-02-06 | `2cd6c153` |
| `HA-101` | `library/har-websocket.spec.ts` | should only have one websocket entry | 2026-06-08 | `0ebec077` |
| `HA-102` | `library/har-websocket.spec.ts` | should include websocket handshake headers and status | 2026-08-11 | `c751a4d6` |
| `HA-103` | `library/har-websocket.spec.ts` | should embed websocket messages | 2026-06-15 | `914d33d9` |
| `HA-104` | `library/har-websocket.spec.ts` | should attach websocket messages | 2026-06-15 | `666fc99a` |
| `HA-105` | `library/har-websocket.spec.ts` | should attach websocket messages for a still open websocket after stopping | 2026-08-04 | `7a95d4e6` |
| `HA-106` | `library/har-websocket.spec.ts` | should omit websocket messages | 2026-06-08 | `0a0efd25` |
| `HA-107` | `library/har-websocket.spec.ts` | should record websocket connection failure | 2026-06-15 | `f8e1eb3c` |
| `HA-108` | `library/har-websocket.spec.ts` | should record websocket handshake failure | 2026-06-01 | `6f258e0f` |
| `HA-109` | `library/har-websocket.spec.ts` | should still capture websocket when route passes messages through | 2026-06-01 | `09f161ae` |
| `HA-110` | `library/har-websocket.spec.ts` | should still allow routeWebSocket to fully mock the connection when capturing HAR | 2026-06-01 | `a15aa035` |
| `HA-111` | `library/har-websocket.spec.ts` | should still allow routeWebSocket to modify messages when capturing HAR | 2026-06-01 | `62062b58` |
| `HA-112` | `library/har-websocket.spec.ts` | should respect PLAYWRIGHT\_HAR\_NO\_WEBSOCKET\_FRAMES | 2026-06-15 | `72652fe1` |

### HE — Headful

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `HE-001` | `library/headful.spec.ts` | should have default url when launching browser @smoke | 2023-01-27 | `ce4fadaf` |
| `HE-002` | `library/headful.spec.ts` | should close browser with beforeunload page | 2023-01-27 | `aa75620b` |
| `HE-003` | `library/headful.spec.ts` | should close browsercontext with pending beforeunload dialog | 2023-01-27 | `d10f1eda` |
| `HE-004` | `library/headful.spec.ts` | should not crash when creating second context | 2023-01-27 | `12017a29` |
| `HE-005` | `library/headful.spec.ts` | should click when viewport size is larger than screen | 2023-04-22 | `f7f466ba` |
| `HE-006` | `library/headful.spec.ts` | should dispatch click events to oversized viewports | 2023-04-22 | `1d4272ec` |
| `HE-007` | `library/headful.spec.ts` | should click background tab | 2023-01-27 | `cdd24049` |
| `HE-008` | `library/headful.spec.ts` | should close browser after context menu was triggered | 2023-01-27 | `8fb8ad2f` |
| `HE-009` | `library/headful.spec.ts` | should(not) block third party cookies | 2025-08-29 | `bcc84401` |
| `HE-010` | `library/headful.spec.ts` | should not block third party SameSite=None cookies | 2024-06-17 | `ce2d2941` |
| `HE-011` | `library/headful.spec.ts` | should not override viewport size when passed null | 2024-10-04 | `5837a398` |
| `HE-012` | `library/headful.spec.ts` | Page.bringToFront should work | 2023-01-27 | `b777a0f3` |
| `HE-013` | `library/headful.spec.ts` | should click in OOPIF | 2023-01-28 | `cbfde10b` |
| `HE-014` | `library/headful.spec.ts` | should click bottom row w/ infobar in OOPIF | 2025-09-17 | `f6bd9150` |
| `HE-015` | `library/headful.spec.ts` | headless and headful should use same default fonts | 2025-12-15 | `be4d4089` |
| `HE-016` | `library/headful.spec.ts` | should have the same hyphen rendering on headless and headed | 2025-01-18 | `32988e64` |

### HT — Hit target

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `HT-001` | `library/hit-target.spec.ts` | should block all events when hit target is wrong | 2026-01-07 | `e64e6414` |
| `HT-002` | `library/hit-target.spec.ts` | should block click when mousedown fails | 2022-01-04 | `e68ce63c` |
| `HT-003` | `library/hit-target.spec.ts` | should click when element detaches in mousedown | 2026-01-22 | `94081437` |
| `HT-004` | `library/hit-target.spec.ts` | should block all events when hit target is wrong and element detaches | 2026-01-07 | `d34b97c9` |
| `HT-005` | `library/hit-target.spec.ts` | should not block programmatic events | 2022-01-04 | `73f30c42` |
| `HT-006` | `library/hit-target.spec.ts` | should click the button again after document.write | 2021-11-06 | `87fee8ad` |
| `HT-007` | `library/hit-target.spec.ts` | should work with mui select | 2021-12-01 | `a3e950ad` |
| `HT-008` | `library/hit-target.spec.ts` | should work with drag and drop that moves the element under cursor | 2022-02-01 | `4f106068` |
| `HT-009` | `library/hit-target.spec.ts` | should work with block inside inline | 2022-03-19 | `b436f123` |
| `HT-010` | `library/hit-target.spec.ts` | should work with block-block-block inside inline-inline | 2022-03-19 | `758d1079` |
| `HT-011` | `library/hit-target.spec.ts` | should work with block inside inline in shadow dom | 2022-03-19 | `f427ca5e` |
| `HT-012` | `library/hit-target.spec.ts` | should not click iframe overlaying the target | 2025-12-10 | `fa0028c8` |
| `HT-013` | `library/hit-target.spec.ts` | should not click an element overlaying iframe with the target | 2024-04-22 | `c1a08d98` |
| `HT-014` | `library/hit-target.spec.ts` | should click into frame inside closed shadow root | 2025-12-03 | `8e71939c` |
| `HT-015` | `library/hit-target.spec.ts` | should click an element inside closed shadow root | 2022-09-07 | `0ada8f75` |
| `HT-016` | `library/hit-target.spec.ts` | should detect overlay from another shadow root | 2026-01-07 | `2b438b12` |
| `HT-017` | `library/hit-target.spec.ts` | should detect overlaid element in a transformed iframe | 2026-01-22 | `cf2bd12c` |
| `HT-018` | `library/hit-target.spec.ts` | should click in iframe with padding | 2022-12-28 | `eb387ce6` |
| `HT-019` | `library/hit-target.spec.ts` | should click in iframe with padding 2 | 2022-12-28 | `e29732ff` |
| `HT-020` | `library/hit-target.spec.ts` | should click in custom element | 2023-03-14 | `401dc104` |
| `HT-021` | `library/hit-target.spec.ts` | should click in nested custom elements | 2026-10-05 | `da61798a` |
| `HT-022` | `library/hit-target.spec.ts` | should click an element inside nested closed shadow roots | 2026-10-05 | `982c86cb` |

### IF — Input files

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `IF-001` | `page/page-set-input-files.spec.ts` | should upload the file | 2025-02-12 | `9e87bbdd` |
| `IF-002` | `page/page-set-input-files.spec.ts` | should upload a folder | 2026-02-27 | `d194d855` |
| `IF-003` | `page/page-set-input-files.spec.ts` | should upload a folder via label | 2026-10-14 | `82e44125` |
| `IF-004` | `page/page-set-input-files.spec.ts` | should upload a folder and throw for multiple directories | 2026-02-27 | `7e2584c2` |
| `IF-005` | `page/page-set-input-files.spec.ts` | should throw if a directory and files are passed | 2026-02-27 | `202d3084` |
| `IF-006` | `page/page-set-input-files.spec.ts` | should throw when uploading a folder in a normal file upload input | 2026-02-27 | `ff3c053a` |
| `IF-007` | `page/page-set-input-files.spec.ts` | should throw when uploading a file in a directory upload input | 2026-02-27 | `40b73cf3` |
| `IF-008` | `page/page-set-input-files.spec.ts` | should upload a file after popup | 2025-02-12 | `4f5c88f5` |
| `IF-009` | `page/page-set-input-files.spec.ts` | should upload large file | 2025-12-09 | `d6f69d09` |
| `IF-010` | `page/page-set-input-files.spec.ts` | should throw an error if the file does not exist | 2025-02-12 | `c8b68986` |
| `IF-011` | `page/page-set-input-files.spec.ts` | should upload large file with relative path | 2025-12-09 | `1414689e` |
| `IF-012` | `page/page-set-input-files.spec.ts` | should upload the file with spaces in name | 2025-02-12 | `9326460b` |
| `IF-013` | `page/page-set-input-files.spec.ts` | should work @smoke | 2025-02-12 | `cd593025` |
| `IF-014` | `page/page-set-input-files.spec.ts` | should set from memory | 2025-02-12 | `af90d2c8` |
| `IF-015` | `page/page-set-input-files.spec.ts` | should work with CSP | 2025-02-12 | `2631e740` |
| `IF-016` | `page/page-set-input-files.spec.ts` | should detect mime type | 2025-02-12 | `4cbb0f8b` |
| `IF-017` | `page/page-set-input-files.spec.ts` | should not trim big uploaded files | 2025-02-12 | `c24622b9` |
| `IF-018` | `page/page-set-input-files.spec.ts` | should emit input and change events | 2025-02-12 | `2c5ffa0a` |
| `IF-019` | `page/page-set-input-files.spec.ts` | input event.composed should be true and cross shadow dom boundary | 2025-02-12 | `753ef8b7` |
| `IF-020` | `page/page-set-input-files.spec.ts` | input should trigger events when files changed second time | 2025-02-12 | `7cab852e` |
| `IF-021` | `page/page-set-input-files.spec.ts` | should preserve lastModified timestamp | 2026-08-07 | `7e397cf0` |

### IN — Inspector

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `IN-001` | `library/inspector/pause.spec.ts` | should resume when closing inspector | 2024-11-11 | `26aa3b20` |
| `IN-002` | `library/inspector/pause.spec.ts` | should not reset timeouts | 2024-11-11 | `17663592` |
| `IN-003` | `library/inspector/pause.spec.ts` | should collapse log entries to a single line | 2025-10-20 | `7d2a7ef2` |
| `IN-004` | `library/inspector/pause.spec.ts` | pause › should pause and resume the script | 2024-11-11 | `3b6e8110` |
| `IN-005` | `library/inspector/pause.spec.ts` | pause › should pause and resume the script with keyboard shortcut | 2025-07-11 | `a1c28d0b` |
| `IN-006` | `library/inspector/pause.spec.ts` | pause › should resume from console | 2026-02-27 | `ce70104a` |
| `IN-007` | `library/inspector/pause.spec.ts` | pause › should pause after a navigation | 2024-11-11 | `5019b025` |
| `IN-008` | `library/inspector/pause.spec.ts` | pause › should show source | 2025-08-13 | `60b943ec` |
| `IN-009` | `library/inspector/pause.spec.ts` | pause › should pause on next pause | 2024-11-11 | `c5fa324a` |
| `IN-010` | `library/inspector/pause.spec.ts` | pause › should step | 2024-11-11 | `4571dd15` |
| `IN-011` | `library/inspector/pause.spec.ts` | pause › should disable timeout on paused actions | 2025-12-12 | `191e9b45` |
| `IN-012` | `library/inspector/pause.spec.ts` | pause › should step with keyboard shortcut | 2024-11-11 | `e8e61abf` |
| `IN-013` | `library/inspector/pause.spec.ts` | pause › should highlight pointer, only in main frame | 2026-03-14 | `a74257c0` |
| `IN-014` | `library/inspector/pause.spec.ts` | pause › should skip input when resuming | 2024-11-11 | `a758c13f` |
| `IN-015` | `library/inspector/pause.spec.ts` | pause › should populate log | 2026-08-27 | `1d271f39` |
| `IN-016` | `library/inspector/pause.spec.ts` | pause › should hide internal calls | 2025-08-08 | `2cbbcb5c` |
| `IN-017` | `library/inspector/pause.spec.ts` | pause › should show expect.toHaveText | 2026-08-27 | `d1806a23` |
| `IN-018` | `library/inspector/pause.spec.ts` | pause › should highlight waitForEvent | 2024-11-11 | `ff2dfd56` |
| `IN-019` | `library/inspector/pause.spec.ts` | pause › should populate log with waitForEvent | 2026-08-27 | `1e47cc25` |
| `IN-020` | `library/inspector/pause.spec.ts` | pause › should populate log with error | 2026-08-27 | `a1e111b0` |
| `IN-021` | `library/inspector/pause.spec.ts` | pause › should populate log with expect failure | 2026-08-27 | `d0393ec3` |
| `IN-022` | `library/inspector/pause.spec.ts` | pause › should populate log with error in waitForEvent | 2025-05-22 | `aa044557` |
| `IN-023` | `library/inspector/pause.spec.ts` | pause › should pause on page close | 2024-11-11 | `49de7d62` |
| `IN-024` | `library/inspector/pause.spec.ts` | pause › should pause on context close | 2024-11-11 | `63103149` |
| `IN-025` | `library/inspector/pause.spec.ts` | pause › should highlight on explore | 2024-11-12 | `2e119b59` |
| `IN-026` | `library/inspector/pause.spec.ts` | pause › should highlight on explore (csharp) | 2026-01-01 | `cdf4b9d0` |
| `IN-027` | `library/inspector/pause.spec.ts` | pause › should not prevent key events | 2024-11-11 | `fd36026b` |
| `IN-028` | `library/inspector/pause.spec.ts` | pause › should highlight locators with custom testId | 2026-08-17 | `a0f1678d` |
| `IN-029` | `library/inspector/pause.spec.ts` | pause › should record from debugger | 2025-07-03 | `9af7c2de` |
| `IN-030` | `library/inspector/recorder-api.spec.ts` | context should implement the internal api used by the tools | 2026-09-09 | `682e8a8a` |
| `IN-031` | `library/inspector/recorder-api.spec.ts` | should click | 2026-07-23 | `b6613b20` |
| `IN-032` | `library/inspector/recorder-api.spec.ts` | should double click | 2026-07-24 | `4203c448` |
| `IN-033` | `library/inspector/recorder-api.spec.ts` | should right click | 2025-09-09 | `7d443af8` |
| `IN-034` | `library/inspector/recorder-api.spec.ts` | should send updated code with the signal | 2026-07-24 | `39e6434e` |
| `IN-035` | `library/inspector/recorder-api.spec.ts` | should not amend the last action with a signal from another page | 2026-08-24 | `688fad77` |
| `IN-036` | `library/inspector/recorder-api.spec.ts` | should type | 2026-07-24 | `774e13c0` |
| `IN-037` | `library/inspector/recorder-api.spec.ts` | should stop recording | 2026-09-09 | `17ab2ed1` |
| `IN-038` | `library/inspector/recorder-api.spec.ts` | should record again after stop | 2026-09-09 | `97d7751c` |
| `IN-039` | `library/inspector/recorder-api.spec.ts` | should not start recording while the recorder is shown | 2026-09-09 | `3f78af65` |
| `IN-040` | `library/inspector/recorder-api.spec.ts` | should not show the recorder while recording | 2026-09-09 | `a09b8087` |
| `IN-041` | `library/inspector/recorder-api.spec.ts` | should not start recording twice | 2026-09-09 | `3dc0832e` |
| `IN-042` | `library/inspector/recorder-api.spec.ts` | page.pickLocator should return locator for picked element | 2026-03-11 | `bcc65a5c` |
| `IN-043` | `library/inspector/recorder-api.spec.ts` | page.cancelPickLocator should cancel ongoing pickLocator | 2026-03-12 | `e4a43724` |
| `IN-044` | `library/inspector/recorder-api.spec.ts` | closing page should cancel ongoing pickLocator | 2026-03-12 | `42bfda45` |
| `IN-045` | `library/inspector/recorder-api.spec.ts` | page2.pickLocator() should cancel page1.pickLocator() | 2026-06-12 | `9de55db4` |
| `IN-046` | `library/inspector/console-api.spec.ts` | should support playwright.$, playwright.$$ | 2021-12-08 | `e3867f37` |
| `IN-047` | `library/inspector/console-api.spec.ts` | should support playwright.selector | 2021-12-07 | `d8242b7e` |
| `IN-048` | `library/inspector/console-api.spec.ts` | should support playwright.locator.value | 2021-12-14 | `6feb642a` |
| `IN-049` | `library/inspector/console-api.spec.ts` | should support playwright.locator.values | 2023-04-05 | `e39ced08` |
| `IN-050` | `library/inspector/console-api.spec.ts` | should support playwright.locator({ has }) | 2024-02-20 | `34050361` |
| `IN-051` | `library/inspector/console-api.spec.ts` | should support playwright.locator({ hasNot }) | 2023-04-05 | `ddebc1d0` |
| `IN-052` | `library/inspector/console-api.spec.ts` | should support locator.and() | 2023-05-05 | `9edb0e71` |
| `IN-053` | `library/inspector/console-api.spec.ts` | should support locator.or() | 2023-03-27 | `8ebda9ff` |
| `IN-054` | `library/inspector/console-api.spec.ts` | should support playwright.getBy\* | 2026-09-01 | `b6d8241b` |
| `IN-055` | `library/inspector/console-api.spec.ts` | expected properties on playwright object | 2024-10-14 | `457e8384` |
| `IN-056` | `library/inspector/title.spec.ts` | should reflect formatted URL of the page | 2025-02-07 | `569c7aed` |
| `IN-057` | `library/inspector/title.spec.ts` | should update primary page URL when original primary closes | 2025-07-03 | `6804de07` |
| `IN-058` | `library/inspector/title.spec.ts` | should render primary language | 2025-07-30 | `ec415c75` |

### IS — Init script

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `IS-001` | `page/page-add-init-script.spec.ts` | should evaluate before anything else on the page | 2020-08-28 | `6c9bef45` |
| `IS-002` | `page/page-add-init-script.spec.ts` | should work with a path | 2021-04-05 | `3dff55cf` |
| `IS-003` | `page/page-add-init-script.spec.ts` | should work with content @smoke | 2022-03-10 | `150da47e` |
| `IS-004` | `page/page-add-init-script.spec.ts` | should throw without path and content | 2021-03-19 | `9fbfd063` |
| `IS-005` | `page/page-add-init-script.spec.ts` | should work with trailing comments | 2022-04-04 | `72b1ce0d` |
| `IS-006` | `page/page-add-init-script.spec.ts` | should support multiple scripts | 2020-08-28 | `c79dd308` |
| `IS-007` | `page/page-add-init-script.spec.ts` | should work with CSP | 2020-08-28 | `54dedf3d` |
| `IS-008` | `page/page-add-init-script.spec.ts` | should work after a cross origin navigation | 2020-08-28 | `5363c8a4` |
| `IS-009` | `page/page-add-init-script.spec.ts` | should remove init script after dispose | 2026-03-04 | `6d4a8f4c` |
| `IS-010` | `page/page-add-init-script.spec.ts` | should remove one of multiple init scripts after dispose | 2026-03-04 | `8c7b871f` |
| `IS-011` | `page/page-add-init-script.spec.ts` | init script should run only once in iframe | 2025-12-15 | `0292f4b0` |
| `IS-012` | `page/page-add-init-script-callback.spec.ts` | should drop functions without the exposeFunctions option | 2026-07-21 | `3c61ec9f` |
| `IS-013` | `page/page-add-init-script-callback.spec.ts` | should throw when the script is not a function | 2026-07-21 | `e318f7f9` |
| `IS-014` | `page/page-add-init-script-callback.spec.ts` | should call a function passed as an argument | 2026-07-21 | `11c0cb81` |
| `IS-015` | `page/page-add-init-script-callback.spec.ts` | should accept a function as the whole argument | 2026-07-21 | `cccdb8be` |
| `IS-016` | `page/page-add-init-script-callback.spec.ts` | should pass arguments to the callback | 2026-07-21 | `7ec5b276` |
| `IS-017` | `page/page-add-init-script-callback.spec.ts` | should return the callback result to the page | 2026-07-21 | `8224ba56` |
| `IS-018` | `page/page-add-init-script-callback.spec.ts` | should propagate callback errors to the page | 2026-07-21 | `3211b8fb` |
| `IS-019` | `page/page-add-init-script-callback.spec.ts` | should support multiple callbacks | 2026-07-21 | `667bbff9` |
| `IS-020` | `page/page-add-init-script-callback.spec.ts` | should survive a navigation and keep working | 2026-07-21 | `b1df000d` |
| `IS-021` | `page/page-add-init-script-callback.spec.ts` | should work in a child frame | 2026-07-21 | `55cf7d06` |
| `IS-022` | `page/page-add-init-script-callback.spec.ts` | should not register the callback on the global object | 2026-07-21 | `1eb9d9ee` |
| `IS-023` | `page/page-add-init-script-callback.spec.ts` | should remove exposed functions after dispose | 2026-07-21 | `e5aff85b` |
| `IS-024` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts @smoke | 2023-10-23 | `bc2fbee3` |
| `IS-025` | `library/browsercontext-add-init-script.spec.ts` | should work without navigation, after all bindings | 2023-10-23 | `6fea2005` |
| `IS-026` | `library/browsercontext-add-init-script.spec.ts` | should work without navigation in popup | 2023-10-23 | `2febe03e` |
| `IS-027` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts with a path | 2023-10-23 | `87e8efb7` |
| `IS-028` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts for already created pages | 2023-10-23 | `3709dc2e` |
| `IS-029` | `library/browsercontext-add-init-script.spec.ts` | should remove context init script after dispose | 2026-03-04 | `44eb1211` |
| `IS-030` | `library/browsercontext-add-init-script.spec.ts` | should remove context init script and keep working in new pages | 2026-03-04 | `2ac9f0e2` |
| `IS-031` | `library/browsercontext-add-init-script.spec.ts` | should expose functions passed as arguments | 2026-07-21 | `122990bd` |
| `IS-032` | `library/browsercontext-add-init-script.spec.ts` | should expose functions that survive navigation | 2026-07-21 | `71a14b54` |
| `IS-033` | `library/browsercontext-add-init-script.spec.ts` | should expose functions in popups | 2026-07-21 | `51efa064` |
| `IS-034` | `library/browsercontext-add-init-script.spec.ts` | should remove exposed functions after dispose | 2026-07-21 | `b6a6712c` |
| `IS-035` | `library/browsercontext-add-init-script.spec.ts` | init script should run only once in popup | 2025-05-27 | `e75f3e70` |

### JH — JSHandle

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `JH-001` | `page/jshandle-as-element.spec.ts` | should work @smoke | 2022-03-10 | `c6ca681b` |
| `JH-002` | `page/jshandle-as-element.spec.ts` | should return null for non-elements | 2021-04-01 | `5584440f` |
| `JH-003` | `page/jshandle-as-element.spec.ts` | should return ElementHandle for TextNodes | 2021-04-01 | `3415ee21` |
| `JH-004` | `page/jshandle-as-element.spec.ts` | should work with nullified Node | 2021-04-01 | `fa05a532` |
| `JH-005` | `page/jshandle-evaluate.spec.ts` | should work with function @smoke | 2022-03-10 | `abbd1533` |
| `JH-006` | `page/jshandle-evaluate.spec.ts` | should work with expression | 2020-08-14 | `e775ca8b` |
| `JH-007` | `page/jshandle-json-value.spec.ts` | should work @smoke | 2022-03-10 | `5975f73f` |
| `JH-008` | `page/jshandle-json-value.spec.ts` | should work with dates | 2020-08-14 | `2b2621cd` |
| `JH-009` | `page/jshandle-json-value.spec.ts` | should handle circular objects | 2022-05-10 | `66c81abf` |
| `JH-010` | `page/jshandle-properties.spec.ts` | should work @smoke | 2022-03-10 | `5c02e033` |
| `JH-011` | `page/jshandle-properties.spec.ts` | should work with undefined, null, and empty | 2020-08-14 | `6ba69a10` |
| `JH-012` | `page/jshandle-properties.spec.ts` | should work with unserializable values | 2020-08-14 | `4d5cedab` |
| `JH-013` | `page/jshandle-properties.spec.ts` | getProperties should work | 2020-08-14 | `17a201fc` |
| `JH-014` | `page/jshandle-properties.spec.ts` | getProperties should return empty map for non-objects | 2020-08-14 | `b11b94f4` |
| `JH-015` | `page/jshandle-properties.spec.ts` | getProperties should return properties inhertied from super class | 2026-09-17 | `66aaab9b` |
| `JH-016` | `page/jshandle-properties.spec.ts` | getProperties should return own enumerable properties only | 2026-09-17 | `f2c32911` |
| `JH-017` | `page/jshandle-properties.spec.ts` | getProperties should work with elements | 2021-01-04 | `f0713927` |
| `JH-018` | `page/jshandle-to-string.spec.ts` | should work for primitives | 2021-08-06 | `b5fcec48` |
| `JH-019` | `page/jshandle-to-string.spec.ts` | should work for complicated objects | 2025-12-15 | `eb8fadf4` |
| `JH-020` | `page/jshandle-to-string.spec.ts` | should beautifully render sparse arrays | 2023-01-27 | `5a21f2aa` |
| `JH-021` | `page/jshandle-to-string.spec.ts` | should work for promises | 2021-08-06 | `3f2db213` |
| `JH-022` | `page/jshandle-to-string.spec.ts` | should work with different subtypes @smoke | 2025-12-15 | `59cc299b` |
| `JH-023` | `page/jshandle-to-string.spec.ts` | should work with previewable subtypes | 2025-12-15 | `5ad3447c` |

### JS — JSON schema

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `JS-001` | `library/unit/json-schema.spec.ts` | should validate string type | 2026-03-27 | `ece569ef` |
| `JS-002` | `library/unit/json-schema.spec.ts` | should validate string pattern | 2026-03-27 | `16cec27b` |
| `JS-003` | `library/unit/json-schema.spec.ts` | should validate array type | 2026-03-27 | `b4fcaa71` |
| `JS-004` | `library/unit/json-schema.spec.ts` | should validate array items | 2026-03-27 | `f435dbcb` |
| `JS-005` | `library/unit/json-schema.spec.ts` | should validate object type | 2026-03-27 | `c203a265` |
| `JS-006` | `library/unit/json-schema.spec.ts` | should validate required properties | 2026-03-27 | `484a31fa` |
| `JS-007` | `library/unit/json-schema.spec.ts` | should validate optional properties | 2026-03-27 | `1f856b01` |
| `JS-008` | `library/unit/json-schema.spec.ts` | should validate oneOf | 2026-03-27 | `03087e43` |
| `JS-009` | `library/unit/json-schema.spec.ts` | should validate nested objects | 2026-03-27 | `0439e100` |
| `JS-010` | `library/unit/json-schema.spec.ts` | should validate test details schema | 2026-03-27 | `ae1b2201` |

### KB — Keyboard

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `KB-001` | `page/page-keyboard.spec.ts` | should type into a textarea @smoke | 2022-03-10 | `16afa8aa` |
| `KB-002` | `page/page-keyboard.spec.ts` | should move with the arrow keys | 2020-08-03 | `57cc124b` |
| `KB-003` | `page/page-keyboard.spec.ts` | should send a character with ElementHandle.press | 2020-08-03 | `73a68e2d` |
| `KB-004` | `page/page-keyboard.spec.ts` | should send a character with insertText | 2020-08-11 | `c0d6e85e` |
| `KB-005` | `page/page-keyboard.spec.ts` | should not type text with Alt modifier | 2026-09-26 | `41568cac` |
| `KB-006` | `page/page-keyboard.spec.ts` | insertText should only emit input event | 2020-08-03 | `c8d42ff9` |
| `KB-007` | `page/page-keyboard.spec.ts` | should emit keydown, keypress, textInput and input when typing a character | 2026-05-29 | `5a7cf4c7` |
| `KB-008` | `page/page-keyboard.spec.ts` | should dispatch key events in separate tasks | 2026-07-17 | `aa92442e` |
| `KB-009` | `page/page-keyboard.spec.ts` | should report shiftKey | 2026-09-26 | `67625388` |
| `KB-010` | `page/page-keyboard.spec.ts` | should report multiple modifiers | 2025-01-24 | `5a20bae8` |
| `KB-011` | `page/page-keyboard.spec.ts` | should send proper codes while typing | 2025-01-24 | `f1bc4358` |
| `KB-012` | `page/page-keyboard.spec.ts` | should send proper codes while typing with shift | 2025-01-24 | `6da3622e` |
| `KB-013` | `page/page-keyboard.spec.ts` | should not type canceled events | 2020-08-03 | `732a26bb` |
| `KB-014` | `page/page-keyboard.spec.ts` | should press plus | 2025-01-24 | `55d62beb` |
| `KB-015` | `page/page-keyboard.spec.ts` | should press shift plus | 2025-01-24 | `7e113aa5` |
| `KB-016` | `page/page-keyboard.spec.ts` | should support plus-separated modifiers | 2025-01-24 | `c42fcf59` |
| `KB-017` | `page/page-keyboard.spec.ts` | should support multiple plus-separated modifiers | 2025-01-24 | `44e68b49` |
| `KB-018` | `page/page-keyboard.spec.ts` | should shift raw codes | 2025-01-24 | `04cde4f5` |
| `KB-019` | `page/page-keyboard.spec.ts` | should specify repeat property | 2020-08-03 | `41180112` |
| `KB-020` | `page/page-keyboard.spec.ts` | should type all kinds of characters | 2020-08-03 | `544054ed` |
| `KB-021` | `page/page-keyboard.spec.ts` | should specify location | 2025-01-08 | `91d7c890` |
| `KB-022` | `page/page-keyboard.spec.ts` | should specify numpad location on keyup | 2026-09-25 | `202d30ad` |
| `KB-023` | `page/page-keyboard.spec.ts` | should press NumpadDecimal as Delete | 2026-09-28 | `b220a73d` |
| `KB-024` | `page/page-keyboard.spec.ts` | should type numpad digits with Shift | 2026-09-28 | `046f0f4a` |
| `KB-025` | `page/page-keyboard.spec.ts` | should press Enter | 2020-08-11 | `ffcbf0a7` |
| `KB-026` | `page/page-keyboard.spec.ts` | should press audio and media control keys | 2026-03-10 | `f2991462` |
| `KB-027` | `page/page-keyboard.spec.ts` | should throw on unknown keys | 2021-09-07 | `fdeb53a5` |
| `KB-028` | `page/page-keyboard.spec.ts` | should type emoji | 2020-08-03 | `13c87783` |
| `KB-029` | `page/page-keyboard.spec.ts` | should type emoji into an iframe | 2020-09-18 | `de1e9b14` |
| `KB-030` | `page/page-keyboard.spec.ts` | should handle selectAll | 2024-04-29 | `7398da36` |
| `KB-031` | `page/page-keyboard.spec.ts` | pressing Meta should not result in any text insertion on any platform | 2023-12-08 | `9c0215af` |
| `KB-032` | `page/page-keyboard.spec.ts` | should be able to prevent selectAll | 2024-04-29 | `2b73e0a8` |
| `KB-033` | `page/page-keyboard.spec.ts` | should support MacOS shortcuts | 2021-04-05 | `7454f987` |
| `KB-034` | `page/page-keyboard.spec.ts` | should press the meta key | 2023-12-08 | `dfe95348` |
| `KB-035` | `page/page-keyboard.spec.ts` | should work with keyboard events with empty.html | 2022-08-09 | `fd593f03` |
| `KB-036` | `page/page-keyboard.spec.ts` | should work after a cross origin navigation | 2020-08-03 | `8c9ad7cc` |
| `KB-037` | `page/page-keyboard.spec.ts` | should expose keyIdentifier in webkit | 2021-04-05 | `c0905f5c` |
| `KB-038` | `page/page-keyboard.spec.ts` | should scroll with PageDown | 2020-08-03 | `60a22499` |
| `KB-039` | `page/page-keyboard.spec.ts` | should move around the selection in a contenteditable | 2021-04-05 | `0536602e` |
| `KB-040` | `page/page-keyboard.spec.ts` | should move to the start of the document | 2021-04-05 | `5239a53d` |
| `KB-041` | `page/page-keyboard.spec.ts` | should dispatch a click event on a button when Space gets pressed | 2021-12-07 | `b3f8adf2` |
| `KB-042` | `page/page-keyboard.spec.ts` | should dispatch a click event on a button when Enter gets pressed | 2021-12-07 | `a4ac8523` |
| `KB-043` | `page/page-keyboard.spec.ts` | should support simple copy-pasting | 2024-04-29 | `3bce1adc` |
| `KB-044` | `page/page-keyboard.spec.ts` | should support simple cut-pasting | 2024-04-29 | `9da74272` |
| `KB-045` | `page/page-keyboard.spec.ts` | should support undo-redo | 2025-09-09 | `5d01fe62` |
| `KB-046` | `page/page-keyboard.spec.ts` | should type repeatedly in contenteditable in shadow dom | 2022-04-12 | `fbc46921` |
| `KB-047` | `page/page-keyboard.spec.ts` | should type repeatedly in contenteditable in shadow dom with nested elements | 2022-05-19 | `1139b1a1` |
| `KB-048` | `page/page-keyboard.spec.ts` | should type repeatedly in input in shadow dom | 2022-05-19 | `6a8cc971` |
| `KB-049` | `page/page-keyboard.spec.ts` | type to non-focusable element should maintain old focus | 2022-05-19 | `a8079bd5` |
| `KB-050` | `page/page-keyboard.spec.ts` | should dispatch insertText after context menu was opened | 2023-02-23 | `e6481373` |
| `KB-051` | `page/page-keyboard.spec.ts` | should type after context menu was opened | 2023-02-23 | `3f80720b` |
| `KB-052` | `page/page-keyboard.spec.ts` | should have correct Keydown/Keyup order when pressing Escape key | 2025-01-24 | `ee9bde3a` |
| `KB-053` | `page/page-keyboard.spec.ts` | should close dialog on Escape key press in contenteditable | 2026-02-27 | `d692d826` |

### LC — Locale

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `LC-001` | `library/browsercontext-locale.spec.ts` | should affect accept-language header @smoke | 2022-03-10 | `ada2d59e` |
| `LC-002` | `library/browsercontext-locale.spec.ts` | should affect navigator.language | 2022-06-08 | `6634e025` |
| `LC-003` | `library/browsercontext-locale.spec.ts` | should format number | 2026-04-17 | `a7135465` |
| `LC-004` | `library/browsercontext-locale.spec.ts` | should format date | 2021-06-03 | `3fd011d7` |
| `LC-005` | `library/browsercontext-locale.spec.ts` | should format number in popups | 2026-04-17 | `a196f0ef` |
| `LC-006` | `library/browsercontext-locale.spec.ts` | should affect navigator.language in popups | 2022-06-08 | `9ed7555c` |
| `LC-007` | `library/browsercontext-locale.spec.ts` | should work for multiple pages sharing same process | 2020-08-03 | `e4534022` |
| `LC-008` | `library/browsercontext-locale.spec.ts` | should be isolated between contexts | 2026-02-02 | `2923d26d` |
| `LC-009` | `library/browsercontext-locale.spec.ts` | should not change default locale in another context | 2022-06-08 | `df502d44` |
| `LC-010` | `library/browsercontext-locale.spec.ts` | should propagate locale to workers | 2026-07-22 | `146c9454` |
| `LC-011` | `library/browsercontext-locale.spec.ts` | should affect Intl.DateTimeFormat().resolvedOptions().locale | 2023-11-01 | `33c5202f` |
| `LC-012` | `library/browsercontext-locale.spec.ts` | should send user Accept-Language header | 2026-07-21 | `a89012e5` |
| `LC-013` | `library/browsercontext-locale.spec.ts` | should send Accept-Language header on WebSocket handshake | 2026-09-02 | `db8369fb` |
| `LC-014` | `library/browsercontext-locale.spec.ts` | should send Accept-Language header on WebSocket handshake from a worker | 2026-09-02 | `fa74af00` |

### LE — Leaks

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `LE-001` | `page/page-leaks.spec.ts` | click should not leak | 2024-09-27 | `8f624b8a` |
| `LE-002` | `page/page-leaks.spec.ts` | fill should not leak | 2024-09-27 | `798ec7bf` |
| `LE-003` | `page/page-leaks.spec.ts` | expect should not leak | 2024-09-27 | `17c6e645` |
| `LE-004` | `page/page-leaks.spec.ts` | waitFor should not leak | 2024-09-27 | `e7645f37` |
| `LE-005` | `library/heap.spec.ts` | test {#0, #1, #2} to request page and context *(3 copies)* | 2022-05-23 | `c2abf303` |
| `LE-006` | `library/heap.spec.ts` | test to request page and context | 2022-05-23 | `227885dd` |
| `LE-007` | `library/heap.spec.ts` | should not leak fixtures w/ page | 2026-04-15 | `5ac166f3` |
| `LE-008` | `library/heap.spec.ts` | should not leak fixtures w/o page | 2026-04-15 | `7a6ee6c9` |
| `LE-009` | `library/heap.spec.ts` | should not leak server-side objects | 2026-06-01 | `4b65d12d` |
| `LE-010` | `library/heap.spec.ts` | should not leak dispatchers after closing page | 2026-04-15 | `41d3188a` |
| `LE-011` | `library/heap.spec.ts` | should not leak workers | 2026-06-23 | `ae314430` |
| `LE-012` | `library/heap.spec.ts` | should collect stale handles | 2026-04-15 | `3d31f890` |
| `LE-013` | `library/heap.spec.ts` | should collect frames | 2026-06-04 | `24216154` |
| `LE-014` | `library/heap.spec.ts` | cycle handles | 2026-06-09 | `224733f6` |

### LG — Logger

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `LG-001` | `library/logger.spec.ts` | should log @smoke | 2023-02-08 | `264ae7dd` |
| `LG-002` | `library/logger.spec.ts` | should log context-level | 2021-10-28 | `59d91040` |

### LH — Locator handler

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `LH-001` | `page/page-add-locator-handler.spec.ts` | should work | 2024-04-24 | `b678156c` |
| `LH-002` | `page/page-add-locator-handler.spec.ts` | should work with a custom check | 2024-04-25 | `89082d82` |
| `LH-003` | `page/page-add-locator-handler.spec.ts` | should work with locator.hover() | 2024-08-05 | `5285d24a` |
| `LH-004` | `page/page-add-locator-handler.spec.ts` | should not work with force:true | 2024-02-09 | `2f488baa` |
| `LH-005` | `page/page-add-locator-handler.spec.ts` | should throw when handler times out | 2024-02-09 | `0db69c82` |
| `LH-006` | `page/page-add-locator-handler.spec.ts` | should work with toBeVisible | 2024-02-09 | `317737c7` |
| `LH-007` | `page/page-add-locator-handler.spec.ts` | should work with locator.waitFor | 2024-09-18 | `d7c43683` |
| `LH-008` | `page/page-add-locator-handler.spec.ts` | should work with toHaveScreenshot | 2024-02-13 | `d37f3053` |
| `LH-009` | `page/page-add-locator-handler.spec.ts` | should work when owner frame detaches | 2024-04-24 | `4239523e` |
| `LH-010` | `page/page-add-locator-handler.spec.ts` | should work with times: option | 2024-04-25 | `9f520bef` |
| `LH-011` | `page/page-add-locator-handler.spec.ts` | should wait for hidden by default | 2024-04-24 | `baa04197` |
| `LH-012` | `page/page-add-locator-handler.spec.ts` | should wait for hidden by default 2 | 2025-06-16 | `7c975e25` |
| `LH-013` | `page/page-add-locator-handler.spec.ts` | should work with noWaitAfter | 2024-04-25 | `6f4b8b25` |
| `LH-014` | `page/page-add-locator-handler.spec.ts` | should removeLocatorHandler | 2024-04-25 | `398628b4` |

### LO — Locator

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `LO-001` | `page/locator-any-frame.spec.ts` | should click a button inside an iframe | 2026-08-28 | `e4fe4787` |
| `LO-002` | `page/locator-any-frame.spec.ts` | should click a button in the main frame | 2026-08-28 | `9917ff80` |
| `LO-003` | `page/locator-any-frame.spec.ts` | should fail click when elements match in multiple frames | 2026-08-28 | `fc723785` |
| `LO-004` | `page/locator-any-frame.spec.ts` | should fail click upon strict mode violation inside a single frame | 2026-08-28 | `9f8b3368` |
| `LO-005` | `page/locator-any-frame.spec.ts` | should time out on click when there are no matches | 2026-08-28 | `f50bc246` |
| `LO-006` | `page/locator-any-frame.spec.ts` | should count elements in a single frame | 2026-08-28 | `7b6342cd` |
| `LO-007` | `page/locator-any-frame.spec.ts` | should fail count when elements match in multiple frames | 2026-08-28 | `8b903890` |
| `LO-008` | `page/locator-any-frame.spec.ts` | should support toHaveCount | 2026-08-28 | `1c2ab819` |
| `LO-009` | `page/locator-any-frame.spec.ts` | should wait for a frame to appear with toHaveCount | 2026-08-28 | `e504c784` |
| `LO-010` | `page/locator-any-frame.spec.ts` | should fail toHaveCount when elements match in multiple frames | 2026-08-28 | `876e6ba7` |
| `LO-011` | `page/locator-any-frame.spec.ts` | should support toHaveText | 2026-08-28 | `ea0afed9` |
| `LO-012` | `page/locator-any-frame.spec.ts` | should support toHaveText with an array | 2026-08-28 | `11eb4dd2` |
| `LO-013` | `page/locator-any-frame.spec.ts` | should fail toHaveText when elements match in multiple frames | 2026-08-28 | `8372d72f` |
| `LO-014` | `page/locator-any-frame.spec.ts` | should fail toHaveText with an array when elements match in multiple frames | 2026-08-28 | `161a2978` |
| `LO-015` | `page/locator-any-frame.spec.ts` | should fail toHaveText upon strict mode violation inside a single frame | 2026-08-28 | `f12ee4f7` |
| `LO-016` | `page/locator-any-frame.spec.ts` | should support evaluate | 2026-08-28 | `2fc5ea74` |
| `LO-017` | `page/locator-any-frame.spec.ts` | should fail evaluate when elements match in multiple frames | 2026-08-28 | `f7d97c86` |
| `LO-018` | `page/locator-any-frame.spec.ts` | should time out on evaluate when there are no matches | 2026-08-28 | `90e8bde9` |
| `LO-019` | `page/locator-any-frame.spec.ts` | should support evaluateAll | 2026-08-28 | `8440fec3` |
| `LO-020` | `page/locator-any-frame.spec.ts` | should fail evaluateAll when elements match in multiple frames | 2026-08-28 | `d4ac3d80` |
| `LO-021` | `page/locator-any-frame.spec.ts` | should support hasText filter | 2026-08-28 | `dc94db8d` |
| `LO-022` | `page/locator-any-frame.spec.ts` | should support first/last/nth | 2026-08-28 | `17bce68d` |
| `LO-023` | `page/locator-any-frame.spec.ts` | should support nth in the middle of the chain | 2026-08-28 | `0c4362f6` |
| `LO-024` | `page/locator-any-frame.spec.ts` | should support composite locators | 2026-08-28 | `7e4b27c6` |
| `LO-025` | `page/locator-any-frame.spec.ts` | should support capture | 2026-08-28 | `03350e5a` |
| `LO-026` | `page/locator-any-frame.spec.ts` | should find a frame inside the scope | 2026-08-28 | `88fbb8c0` |
| `LO-027` | `page/locator-any-frame.spec.ts` | should find a nested frame inside the scope | 2026-08-28 | `5d4a68c5` |
| `LO-028` | `page/locator-any-frame.spec.ts` | should find a frame inside the scope while another iframe is stalled | 2026-08-28 | `e5cf268f` |
| `LO-029` | `page/locator-any-frame.spec.ts` | should respect the scope without a frame inside the scope | 2026-08-28 | `888c2357` |
| `LO-030` | `page/locator-any-frame.spec.ts` | should not match a chain across a frame boundary | 2026-08-28 | `e79fdd48` |
| `LO-031` | `page/locator-any-frame.spec.ts` | should only search frames inside the starting frame | 2026-08-28 | `5bc1b685` |
| `LO-032` | `page/locator-any-frame.spec.ts` | should enter a frame found in a nested frame | 2026-08-28 | `1789c746` |
| `LO-033` | `page/locator-any-frame.spec.ts` | should click inside an entered frame | 2026-08-28 | `31c9cfb8` |
| `LO-034` | `page/locator-any-frame.spec.ts` | should not search nested frames after entering a frame | 2026-08-28 | `7251dad8` |
| `LO-035` | `page/locator-any-frame.spec.ts` | should support two frameLocators | 2026-08-28 | `c51dafff` |
| `LO-036` | `page/locator-any-frame.spec.ts` | should support locator before frameLocator | 2026-08-28 | `eebbe0eb` |
| `LO-037` | `page/locator-any-frame.spec.ts` | should support owner of a frameLocator | 2026-08-28 | `87bc7f5d` |
| `LO-038` | `page/locator-any-frame.spec.ts` | should wait for the frame to enter to appear | 2026-08-28 | `9be1e10b` |
| `LO-039` | `page/locator-any-frame.spec.ts` | should fail when the frame to enter matches in multiple frames | 2026-08-28 | `6db5c2aa` |
| `LO-040` | `page/locator-any-frame.spec.ts` | should support contentFrame | 2026-08-28 | `a659b265` |
| `LO-041` | `page/locator-any-frame.spec.ts` | should render frameLocator() in the locator description | 2026-08-28 | `676bf19b` |
| `LO-042` | `page/locator-any-frame.spec.ts` | should not allow frameLocator() inside a composite locator | 2026-08-28 | `f3510f48` |
| `LO-043` | `page/locator-any-frame.spec.ts` | should support a composite locator under frameLocator() | 2026-08-28 | `a1469cf3` |
| `LO-044` | `page/locator-any-frame.spec.ts` | should support a composite locator under frameLocator() and a frame locator | 2026-08-28 | `be5bfbdb` |
| `LO-045` | `page/locator-any-frame.spec.ts` | should not allow first/last/nth on frameLocator() | 2026-08-28 | `61641673` |
| `LO-046` | `page/locator-any-frame.spec.ts` | should not allow owner on frameLocator() | 2026-08-28 | `833c2136` |
| `LO-047` | `page/locator-any-frame.spec.ts` | should resolve aria-ref selectors | 2026-08-28 | `6420cf12` |
| `LO-048` | `page/locator-any-frame.spec.ts` | should click while another iframe is stalled | 2026-08-28 | `4a3d93bd` |
| `LO-049` | `page/locator-any-frame.spec.ts` | should support toBeVisible while another iframe is stalled | 2026-08-28 | `1fca4f5e` |
| `LO-050` | `page/locator-any-frame.spec.ts` | should support toHaveCount while another iframe is stalled | 2026-08-28 | `4eff3560` |
| `LO-051` | `page/locator-any-frame.spec.ts` | should treat elements inside hidden iframe as hidden | 2026-09-24 | `a9f28217` |
| `LO-052` | `page/locator-click.spec.ts` | should work @smoke | 2022-03-10 | `2801e6c8` |
| `LO-053` | `page/locator-click.spec.ts` | should work with Node removed | 2021-07-23 | `4231b6b3` |
| `LO-054` | `page/locator-click.spec.ts` | should double click the button | 2021-07-23 | `1271a43a` |
| `LO-055` | `page/locator-click.spec.ts` | should click if the target element is removed in pointerup event | 2023-04-11 | `2e451247` |
| `LO-056` | `page/locator-click.spec.ts` | should click if the target element is removed in pointerdown event | 2023-04-11 | `5795c498` |
| `LO-057` | `page/locator-convenience.spec.ts` | should have a nice preview | 2023-09-16 | `cce9b633` |
| `LO-058` | `page/locator-convenience.spec.ts` | getAttribute should work | 2021-07-23 | `c0c23d3a` |
| `LO-059` | `page/locator-convenience.spec.ts` | inputValue should work | 2021-09-25 | `e895cae1` |
| `LO-060` | `page/locator-convenience.spec.ts` | innerHTML should work | 2021-07-29 | `7e8eca92` |
| `LO-061` | `page/locator-convenience.spec.ts` | innerText should work | 2021-07-29 | `77838149` |
| `LO-062` | `page/locator-convenience.spec.ts` | innerText should throw | 2021-09-25 | `ac896a21` |
| `LO-063` | `page/locator-convenience.spec.ts` | innerText should produce log | 2022-11-04 | `68e46a0f` |
| `LO-064` | `page/locator-convenience.spec.ts` | textContent should work | 2021-07-29 | `7be6d28e` |
| `LO-065` | `page/locator-convenience.spec.ts` | isEnabled and isDisabled should work | 2021-07-23 | `497fa32e` |
| `LO-066` | `page/locator-convenience.spec.ts` | isEditable should work | 2024-11-22 | `037bfff7` |
| `LO-067` | `page/locator-convenience.spec.ts` | isChecked should work | 2021-07-23 | `46cb61a8` |
| `LO-068` | `page/locator-convenience.spec.ts` | isChecked should work for indeterminate input | 2023-02-11 | `8ba87a37` |
| `LO-069` | `page/locator-convenience.spec.ts` | allTextContents should work | 2021-08-03 | `4780a8bd` |
| `LO-070` | `page/locator-convenience.spec.ts` | allInnerTexts should work | 2021-08-03 | `c29e9b1c` |
| `LO-071` | `page/locator-convenience.spec.ts` | should return page | 2022-01-26 | `55311ef4` |
| `LO-072` | `page/locator-convenience.spec.ts` | description should return null for locator without description | 2025-10-15 | `710209fc` |
| `LO-073` | `page/locator-convenience.spec.ts` | description should return description for locator with simple description | 2025-10-15 | `849cb1f7` |
| `LO-074` | `page/locator-convenience.spec.ts` | description should return description with special characters | 2025-10-15 | `8f59d6a2` |
| `LO-075` | `page/locator-convenience.spec.ts` | description should return description for chained locators | 2025-10-15 | `6000c311` |
| `LO-076` | `page/locator-convenience.spec.ts` | description should return description for locator with multiple describe calls | 2025-10-15 | `0b6aabd6` |
| `LO-077` | `page/locator-convenience.spec.ts` | toString() returns formatted locator | 2025-11-11 | `2853900b` |
| `LO-078` | `page/locator-convenience.spec.ts` | toString() prefers description | 2025-11-11 | `2776e026` |
| `LO-079` | `page/locator-element-handle.spec.ts` | should query existing element @smoke | 2022-03-10 | `f1bd6d21` |
| `LO-080` | `page/locator-element-handle.spec.ts` | should query existing elements | 2021-07-27 | `247f6e4a` |
| `LO-081` | `page/locator-element-handle.spec.ts` | should return empty array for non-existing elements | 2021-07-27 | `b5ac2a62` |
| `LO-082` | `page/locator-element-handle.spec.ts` | xpath should query existing element | 2021-07-27 | `1e8e963d` |
| `LO-083` | `page/locator-element-handle.spec.ts` | xpath should return null for non-existing element | 2021-07-27 | `99d0ab2d` |
| `LO-084` | `page/locator-evaluate.spec.ts` | should work @smoke | 2022-03-10 | `0401d247` |
| `LO-085` | `page/locator-evaluate.spec.ts` | should retrieve content from subtree | 2021-07-23 | `73bcb8aa` |
| `LO-086` | `page/locator-evaluate.spec.ts` | should work for all | 2021-07-23 | `32711091` |
| `LO-087` | `page/locator-evaluate.spec.ts` | should retrieve content from subtree for all | 2021-07-23 | `9c939719` |
| `LO-088` | `page/locator-evaluate.spec.ts` | should not throw in case of missing selector for all | 2021-07-23 | `4352602d` |
| `LO-089` | `page/locator-frame.spec.ts` | should work for iframe @smoke | 2022-09-29 | `6a9991a8` |
| `LO-090` | `page/locator-frame.spec.ts` | should work for nested iframe | 2022-09-29 | `3beb78f7` |
| `LO-091` | `page/locator-frame.spec.ts` | should work for $ and $$ | 2022-09-29 | `88de195b` |
| `LO-092` | `page/locator-frame.spec.ts` | should wait for frame | 2024-09-19 | `698f645a` |
| `LO-093` | `page/locator-frame.spec.ts` | should wait for frame 2 | 2021-11-08 | `ac8ac134` |
| `LO-094` | `page/locator-frame.spec.ts` | should wait for frame to go | 2022-08-03 | `64439195` |
| `LO-095` | `page/locator-frame.spec.ts` | should not wait for frame | 2021-11-08 | `57c9b69e` |
| `LO-096` | `page/locator-frame.spec.ts` | should not wait for frame 2 | 2021-11-08 | `15c16d2d` |
| `LO-097` | `page/locator-frame.spec.ts` | should not wait for frame 3 | 2021-11-08 | `3f3a0642` |
| `LO-098` | `page/locator-frame.spec.ts` | should click in lazy iframe | 2023-06-02 | `92da0428` |
| `LO-099` | `page/locator-frame.spec.ts` | waitFor should survive frame reattach | 2021-11-08 | `a5ab702a` |
| `LO-100` | `page/locator-frame.spec.ts` | click should survive frame reattach | 2021-11-08 | `56f68395` |
| `LO-101` | `page/locator-frame.spec.ts` | click should survive iframe navigation | 2023-06-02 | `8a6997d4` |
| `LO-102` | `page/locator-frame.spec.ts` | should non work for non-frame | 2021-11-08 | `7a7bc27b` |
| `LO-103` | `page/locator-frame.spec.ts` | locator.frameLocator should work for iframe | 2021-11-08 | `d0c18134` |
| `LO-104` | `page/locator-frame.spec.ts` | locator.frameLocator should throw on ambiguity | 2022-11-04 | `3d8583b7` |
| `LO-105` | `page/locator-frame.spec.ts` | locator.frameLocator should not throw on first/last/nth | 2021-11-09 | `f1f98d02` |
| `LO-106` | `page/locator-frame.spec.ts` | getBy coverage | 2022-10-04 | `f94bf991` |
| `LO-107` | `page/locator-frame.spec.ts` | wait for hidden should succeed when frame is not in dom | 2023-03-31 | `e1dd7432` |
| `LO-108` | `page/locator-frame.spec.ts` | should work with COEP/COOP/CORP isolated iframe | 2023-11-10 | `b430546d` |
| `LO-109` | `page/locator-frame.spec.ts` | locator.contentFrame should work | 2024-03-25 | `fefb2e7e` |
| `LO-110` | `page/locator-frame.spec.ts` | frameLocator.owner should work | 2024-03-25 | `5ab69711` |
| `LO-111` | `page/locator-frame.spec.ts` | should treat elements inside hidden iframe as hidden | 2026-09-24 | `1cc3d860` |
| `LO-112` | `page/locator-frame.spec.ts` | should wait for hidden iframe to become visible | 2026-09-24 | `b7886a6a` |
| `LO-113` | `page/locator-frame.spec.ts` | should treat elements inside hidden cross-origin iframe as hidden | 2026-09-24 | `2d697451` |
| `LO-114` | `page/locator-highlight.spec.ts` | should highlight locator | 2022-10-24 | `f57bf0f1` |
| `LO-115` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work | 2022-08-20 | `a7609a46` |
| `LO-116` | `page/locator-is-visible.spec.ts` | isVisible should be true for opacity:0 | 2022-08-20 | `0ae7f8e8` |
| `LO-117` | `page/locator-is-visible.spec.ts` | isVisible should be true for element outside view | 2022-08-20 | `d01e3c92` |
| `LO-118` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with details | 2022-08-20 | `f9f99389` |
| `LO-119` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with nested details | 2026-09-28 | `815de7b7` |
| `LO-120` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with unslotted content | 2026-09-28 | `78e08c2a` |
| `LO-121` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with list box options | 2026-10-01 | `86c86328` |
| `LO-122` | `page/locator-is-visible.spec.ts` | isVisible inside a button | 2022-08-20 | `30a1bbb0` |
| `LO-123` | `page/locator-is-visible.spec.ts` | isVisible inside a role=button | 2022-08-20 | `aca6bfc9` |
| `LO-124` | `page/locator-is-visible.spec.ts` | isVisible during navigation should not throw | 2023-10-05 | `563c71e8` |
| `LO-125` | `page/locator-is-visible.spec.ts` | isVisible with invalid selector should throw | 2023-05-10 | `54563b8b` |
| `LO-126` | `page/locator-list.spec.ts` | locator.all should work | 2022-12-15 | `29fbdc22` |
| `LO-127` | `page/locator-misc-1.spec.ts` | should hover @smoke | 2024-10-08 | `2d1acbe5` |
| `LO-128` | `page/locator-misc-1.spec.ts` | should hover when Node is removed | 2024-10-07 | `11efc4e4` |
| `LO-129` | `page/locator-misc-1.spec.ts` | should fill input | 2021-07-23 | `5ca30bd9` |
| `LO-130` | `page/locator-misc-1.spec.ts` | should fill input when Node is removed | 2021-07-23 | `030bb4ee` |
| `LO-131` | `page/locator-misc-1.spec.ts` | should clear input | 2022-10-25 | `79532d7f` |
| `LO-132` | `page/locator-misc-1.spec.ts` | should check the box | 2021-07-23 | `604597ec` |
| `LO-133` | `page/locator-misc-1.spec.ts` | should check the box using setChecked | 2021-08-30 | `aacb89ae` |
| `LO-134` | `page/locator-misc-1.spec.ts` | should uncheck the box | 2021-07-23 | `83e89892` |
| `LO-135` | `page/locator-misc-1.spec.ts` | should select single option | 2021-07-23 | `94348dde` |
| `LO-136` | `page/locator-misc-1.spec.ts` | should focus and blur a button | 2022-10-25 | `32803eee` |
| `LO-137` | `page/locator-misc-1.spec.ts` | focus should respect strictness | 2021-12-03 | `268ad6eb` |
| `LO-138` | `page/locator-misc-1.spec.ts` | should dispatch click event via ElementHandles | 2021-07-23 | `07b9dcfd` |
| `LO-139` | `page/locator-misc-1.spec.ts` | should upload the file | 2021-07-27 | `c8f129bf` |
| `LO-140` | `page/locator-misc-2.spec.ts` | should press @smoke | 2022-03-10 | `6d382df3` |
| `LO-141` | `page/locator-misc-2.spec.ts` | should scroll into view | 2021-07-23 | `d66ec561` |
| `LO-142` | `page/locator-misc-2.spec.ts` | should scroll zero-sized element into view | 2024-11-14 | `761c013c` |
| `LO-143` | `page/locator-misc-2.spec.ts` | should select textarea | 2021-07-23 | `abb52efc` |
| `LO-144` | `page/locator-misc-2.spec.ts` | should type | 2021-07-23 | `d988f689` |
| `LO-145` | `page/locator-misc-2.spec.ts` | should pressSequentially | 2023-08-22 | `b58a54b0` |
| `LO-146` | `page/locator-misc-2.spec.ts` | should take screenshot | 2022-04-15 | `7068ef83` |
| `LO-147` | `page/locator-misc-2.spec.ts` | should return bounding box | 2022-06-09 | `65c35e58` |
| `LO-148` | `page/locator-misc-2.spec.ts` | should waitFor | 2021-09-28 | `4175e477` |
| `LO-149` | `page/locator-misc-2.spec.ts` | should waitFor hidden | 2021-09-28 | `60f78575` |
| `LO-150` | `page/locator-misc-2.spec.ts` | should combine visible with other selectors | 2021-10-18 | `183688e2` |
| `LO-151` | `page/locator-misc-2.spec.ts` | should support filter(visible) | 2025-02-27 | `957671b3` |
| `LO-152` | `page/locator-misc-2.spec.ts` | should support visible() | 2026-09-01 | `832255d8` |
| `LO-153` | `page/locator-misc-2.spec.ts` | locator.count should work with deleted Map in main world | 2022-01-07 | `317098ee` |
| `LO-154` | `page/locator-misc-2.spec.ts` | Locator.locator() and FrameLocator.locator() should accept locator | 2023-03-03 | `75beaf9f` |
| `LO-155` | `page/locator-misc-2.spec.ts` | should fill programmatically enabled textarea | 2025-06-16 | `447bc899` |
| `LO-156` | `page/locator-misc-2.spec.ts` | press should throw on unknown keys | 2025-07-23 | `99555f76` |
| `LO-157` | `page/locator-query.spec.ts` | should respect first() and last() @smoke | 2022-03-10 | `39183860` |
| `LO-158` | `page/locator-query.spec.ts` | should respect nth() | 2021-07-27 | `06fb52ee` |
| `LO-159` | `page/locator-query.spec.ts` | should throw on capture w/ nth() | 2021-08-11 | `10b1f539` |
| `LO-160` | `page/locator-query.spec.ts` | should throw on due to strictness | 2021-07-28 | `fb11ed58` |
| `LO-161` | `page/locator-query.spec.ts` | should throw on due to strictness 2 | 2021-07-28 | `cc1d4d1a` |
| `LO-162` | `page/locator-query.spec.ts` | should filter by text | 2021-12-14 | `0913b2c0` |
| `LO-163` | `page/locator-query.spec.ts` | should filter by text 2 | 2021-12-14 | `bf53daa8` |
| `LO-164` | `page/locator-query.spec.ts` | should filter by regex | 2021-12-14 | `b1c93729` |
| `LO-165` | `page/locator-query.spec.ts` | should filter by text with quotes | 2021-12-14 | `1cde2242` |
| `LO-166` | `page/locator-query.spec.ts` | should filter by regex with quotes | 2021-12-14 | `aeeba69f` |
| `LO-167` | `page/locator-query.spec.ts` | should filter by regex with a single quote | 2023-09-19 | `dc041b97` |
| `LO-168` | `page/locator-query.spec.ts` | should filter by regex and regexp flags | 2021-12-14 | `5d301302` |
| `LO-169` | `page/locator-query.spec.ts` | should filter by case-insensitive regex in a child | 2022-07-11 | `1cab526b` |
| `LO-170` | `page/locator-query.spec.ts` | should filter by case-insensitive regex in multiple children | 2022-07-14 | `883afb45` |
| `LO-171` | `page/locator-query.spec.ts` | should filter by regex with special symbols | 2022-07-14 | `83442307` |
| `LO-172` | `page/locator-query.spec.ts` | should support has:locator | 2023-03-30 | `dddb0300` |
| `LO-173` | `page/locator-query.spec.ts` | should support locator.filter | 2023-04-05 | `7aa9857c` |
| `LO-174` | `page/locator-query.spec.ts` | should support locator.and | 2023-05-05 | `65b36666` |
| `LO-175` | `page/locator-query.spec.ts` | should support locator.or | 2024-05-08 | `745eca82` |
| `LO-176` | `page/locator-query.spec.ts` | should support locator.locator with and/or | 2023-07-14 | `f4577a1f` |
| `LO-177` | `page/locator-query.spec.ts` | should support locator.within | 2026-09-23 | `94f1cbfa` |
| `LO-178` | `page/locator-query.spec.ts` | should allow some, but not all nested frameLocators | 2024-09-19 | `303e5653` |
| `LO-179` | `page/locator-query.spec.ts` | should keep the capture when removing a common frame prefix | 2026-08-28 | `8bb3a5bf` |
| `LO-180` | `page/locator-query.spec.ts` | should enforce same frame for has/leftOf/rightOf/above/below/near | 2022-05-12 | `0684b2e9` |
| `LO-181` | `page/locator-query.spec.ts` | alias methods coverage | 2022-09-29 | `c9ae4759` |
| `LO-182` | `page/locator-query.spec.ts` | count() should not throw during navigation | 2026-07-02 | `d81965af` |
| `LO-183` | `page/locator-wait-for-function.spec.ts` | should wait for an attribute to appear | 2026-06-23 | `62d85dd9` |
| `LO-184` | `page/locator-wait-for-function.spec.ts` | should return immediately when already truthy | 2026-06-23 | `bdefe9c7` |
| `LO-185` | `page/locator-wait-for-function.spec.ts` | should accept ElementHandle arguments | 2026-06-23 | `2bb9a2b2` |
| `LO-186` | `page/locator-wait-for-function.spec.ts` | should accept string expression | 2026-06-23 | `a324cfee` |
| `LO-187` | `page/locator-wait-for-function.spec.ts` | should resolve a promise returned by the predicate | 2026-06-23 | `8da723bf` |
| `LO-188` | `page/locator-wait-for-function.spec.ts` | should wait for element to appear and survive rerender | 2026-06-23 | `3ec37944` |
| `LO-189` | `page/locator-wait-for-function.spec.ts` | should throw when predicate throws | 2026-06-23 | `95cef33d` |
| `LO-190` | `page/locator-wait-for-function.spec.ts` | should throw on strict mode violation | 2026-06-23 | `c1c62e56` |
| `LO-191` | `page/locator-wait-for-function.spec.ts` | should abort via signal | 2026-06-30 | `76556842` |
| `LO-192` | `page/locator-wait-for-function.spec.ts` | should abort via already-aborted signal | 2026-06-30 | `c025595b` |
| `LO-193` | `library/locator-highlight.spec.ts` | highlight should accept a CSS string style | 2026-04-23 | `30a80d1b` |
| `LO-194` | `library/locator-highlight.spec.ts` | highlight should accept an object style (JS only) | 2026-04-23 | `2da1d5d8` |
| `LO-195` | `library/locator-highlight.spec.ts` | hideHighlight removes a styled highlight | 2026-04-15 | `b489e448` |
| `LO-196` | `library/locator-highlight.spec.ts` | highlight should survive navigation | 2026-08-17 | `0f17712a` |
| `LO-197` | `library/locator-highlight.spec.ts` | Page.hideHighlight clears all locator highlights | 2026-04-15 | `3b5ddb40` |
| `LO-198` | `library/locator-highlight.spec.ts` | highlight should work with a custom selector engine that runs in the main world | 2026-09-22 | `4d8c1324` |
| `LO-199` | `library/locator-highlight.spec.ts` | highlight should resolve relative to the frame of the locator | 2026-09-23 | `554e8740` |

### MC — Multiple clients

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `MC-001` | `library/multiclient.spec.ts` | should connect two clients | 2025-06-02 | `49cfe9d3` |
| `MC-002` | `library/multiclient.spec.ts` | should fire context event on remote newContext | 2026-04-22 | `6264e1e1` |
| `MC-003` | `library/multiclient.spec.ts` | should have separate default timeouts | 2025-05-26 | `fc485b14` |
| `MC-004` | `library/multiclient.spec.ts` | should receive viewport size changes | 2025-05-26 | `f35a7062` |
| `MC-005` | `library/multiclient.spec.ts` | should not allow parallel js coverage and cleanup upon disconnect | 2025-05-30 | `a4de6da2` |
| `MC-006` | `library/multiclient.spec.ts` | should not allow parallel css coverage | 2025-05-30 | `f0db1977` |
| `MC-007` | `library/multiclient.spec.ts` | should unpause clock | 2025-05-30 | `123f2aea` |
| `MC-008` | `library/multiclient.spec.ts` | last emulateMedia wins | 2025-05-26 | `00680f61` |
| `MC-009` | `library/multiclient.spec.ts` | should chain routes | 2025-05-30 | `3fe32983` |
| `MC-010` | `library/multiclient.spec.ts` | should chain routes with changed url | 2025-05-30 | `1a0af714` |
| `MC-011` | `library/multiclient.spec.ts` | should remove exposed bindings upon disconnect | 2025-05-30 | `c493c996` |
| `MC-012` | `library/multiclient.spec.ts` | should unroute websockets | 2025-07-07 | `21ebb282` |
| `MC-013` | `library/multiclient.spec.ts` | should remove init scripts upon disconnect | 2025-05-30 | `eef19afa` |
| `MC-014` | `library/multiclient.spec.ts` | should remove locator handlers upon disconnect | 2025-05-30 | `a15177d5` |
| `MC-015` | `library/multiclient.spec.ts` | should launch persistent | 2025-06-04 | `7f7d37f1` |
| `MC-016` | `library/multiclient.spec.ts` | should avoid side effects upon disconnect | 2025-07-04 | `89ab4d12` |
| `MC-017` | `library/multiclient.spec.ts` | screencast should deliver cached last frame to a new client | 2026-04-23 | `50b629d9` |
| `MC-018` | `library/multiclient.spec.ts` | should stop tracing upon disconnect | 2025-07-12 | `eb8ac636` |
| `MC-019` | `library/multiclient.spec.ts` | should not deliver an action buffered before the second recording started | 2026-10-12 | `2730ed90` |

### MO — Mouse

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `MO-001` | `page/page-mouse.spec.ts` | should click the document @smoke | 2022-03-10 | `971ee8e8` |
| `MO-002` | `page/page-mouse.spec.ts` | should dblclick the div | 2020-08-28 | `2ee453bb` |
| `MO-003` | `page/page-mouse.spec.ts` | down and up should generate click | 2024-09-06 | `d9d854c0` |
| `MO-004` | `page/page-mouse.spec.ts` | should pointerdown the div with a custom button | 2021-12-12 | `849dddd7` |
| `MO-005` | `page/page-mouse.spec.ts` | should report correct buttons property | 2022-02-10 | `f88dcce4` |
| `MO-006` | `page/page-mouse.spec.ts` | should report correct pointerType property | 2025-12-04 | `628f4a10` |
| `MO-007` | `page/page-mouse.spec.ts` | should select the text with mouse | 2024-05-31 | `4d8d8e34` |
| `MO-008` | `page/page-mouse.spec.ts` | should trigger hover state | 2024-10-02 | `a6ffc008` |
| `MO-009` | `page/page-mouse.spec.ts` | should trigger hover state on disabled button | 2024-10-02 | `870573b6` |
| `MO-010` | `page/page-mouse.spec.ts` | should trigger hover state with removed window.Node | 2024-10-02 | `35952e17` |
| `MO-011` | `page/page-mouse.spec.ts` | should set modifier keys on click | 2021-05-13 | `4f706d4d` |
| `MO-012` | `page/page-mouse.spec.ts` | should tween mouse movement | 2026-01-30 | `657cf1c1` |
| `MO-013` | `page/page-mouse.spec.ts` | should always round down | 2022-08-02 | `e8651750` |
| `MO-014` | `page/page-mouse.spec.ts` | should not crash on mouse drag with any button | 2023-02-23 | `a59d95aa` |
| `MO-015` | `page/page-mouse.spec.ts` | should dispatch mouse move after context menu was opened | 2026-04-22 | `d79b87ea` |
| `MO-016` | `page/page-mouse.spec.ts` | should track hover across iframe boundaries | 2026-07-14 | `2d5e521b` |
| `MO-017` | `page/wheel.spec.ts` | should dispatch wheel events @smoke | 2022-05-12 | `4b46d49a` |
| `MO-018` | `page/wheel.spec.ts` | should dispatch wheel events after popup was opened @smoke | 2023-02-06 | `268bd6a0` |
| `MO-019` | `page/wheel.spec.ts` | should dispatch wheel event on svg element | 2022-07-26 | `a74bbd51` |
| `MO-020` | `page/wheel.spec.ts` | should scroll when nobody is listening | 2021-09-14 | `e77d601f` |
| `MO-021` | `page/wheel.spec.ts` | should set the modifiers | 2022-05-12 | `90fb415d` |
| `MO-022` | `page/wheel.spec.ts` | should scroll horizontally | 2022-05-12 | `5a9d49ad` |
| `MO-023` | `page/wheel.spec.ts` | should work when the event is canceled | 2024-05-31 | `bd6124f1` |

### NA — Navigation

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `NA-001` | `page/page-goto.spec.ts` | should work @smoke | 2022-03-10 | `d989acac` |
| `NA-002` | `page/page-goto.spec.ts` | should work with file URL | 2025-09-09 | `f2d88bf9` |
| `NA-003` | `page/page-goto.spec.ts` | should navigate from file URL to about:blank | 2026-07-30 | `9e1535ef` |
| `NA-004` | `page/page-goto.spec.ts` | should work with file URL with subframes | 2025-09-09 | `ca22b5b1` |
| `NA-005` | `page/page-goto.spec.ts` | should use http for no protocol | 2021-04-09 | `47a424bb` |
| `NA-006` | `page/page-goto.spec.ts` | should work cross-process | 2020-08-04 | `2a31b7c8` |
| `NA-007` | `page/page-goto.spec.ts` | should work with cross-process that fails before committing | 2021-09-28 | `abf6bbf9` |
| `NA-008` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy | 2025-12-10 | `9bdd3f84` |
| `NA-009` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy and {history, Cross-Origin-Embedder-Policy and history} state *(2 copies)* | 2026-09-22 | `23f52f28` |
| `NA-010` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy and interception | 2025-12-10 | `36eef904` |
| `NA-011` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy after redirect | 2025-12-10 | `3cae25cd` |
| `NA-012` | `page/page-goto.spec.ts` | should capture iframe navigation request | 2020-08-04 | `0fb894b8` |
| `NA-013` | `page/page-goto.spec.ts` | should capture cross-process iframe navigation request | 2020-08-04 | `906f62fc` |
| `NA-014` | `page/page-goto.spec.ts` | should work with anchor navigation | 2020-08-04 | `e35cd3dc` |
| `NA-015` | `page/page-goto.spec.ts` | should work with redirects | 2020-08-04 | `2318cd63` |
| `NA-016` | `page/page-goto.spec.ts` | should navigate to about:blank | 2020-08-04 | `def4886f` |
| `NA-017` | `page/page-goto.spec.ts` | should return response when page changes its URL after load | 2020-08-04 | `c5781858` |
| `NA-018` | `page/page-goto.spec.ts` | should work with subframes return 204 | 2020-08-12 | `5977cac1` |
| `NA-019` | `page/page-goto.spec.ts` | should work with subframes return 204 with domcontentloaded | 2020-08-12 | `e80a2e7e` |
| `NA-020` | `page/page-goto.spec.ts` | should fail when server returns 204 | 2024-10-10 | `7f3529b6` |
| `NA-021` | `page/page-goto.spec.ts` | should navigate to empty page with domcontentloaded | 2020-08-04 | `a3c6c801` |
| `NA-022` | `page/page-goto.spec.ts` | should work when page calls history API in beforeunload | 2020-08-04 | `e9803ed1` |
| `NA-023` | `page/page-goto.spec.ts` | should fail when navigating to bad url | 2025-12-15 | `304b906d` |
| `NA-024` | `page/page-goto.spec.ts` | should fail when navigating to bad SSL | 2025-09-09 | `b04e11b3` |
| `NA-025` | `page/page-goto.spec.ts` | should fail when navigating to bad SSL after redirects | 2025-09-09 | `c249d5c6` |
| `NA-026` | `page/page-goto.spec.ts` | should not crash when navigating to bad SSL after a cross origin navigation | 2020-08-04 | `76f39536` |
| `NA-027` | `page/page-goto.spec.ts` | should not throw if networkidle0 is passed as an option | 2020-09-09 | `c1fe8794` |
| `NA-028` | `page/page-goto.spec.ts` | should throw if networkidle2 is passed as an option | 2021-11-02 | `fb8b23a6` |
| `NA-029` | `page/page-goto.spec.ts` | should fail when main resources failed to load | 2026-04-30 | `b411bce3` |
| `NA-030` | `page/page-goto.spec.ts` | should fail when exceeding maximum navigation timeout | 2020-08-04 | `34d47817` |
| `NA-031` | `page/page-goto.spec.ts` | should fail when exceeding default maximum navigation timeout | 2026-05-15 | `1608116f` |
| `NA-032` | `page/page-goto.spec.ts` | should fail when exceeding browser context navigation timeout | 2026-05-15 | `592341ed` |
| `NA-033` | `page/page-goto.spec.ts` | should fail when exceeding default maximum timeout | 2026-05-06 | `1ad0d6d0` |
| `NA-034` | `page/page-goto.spec.ts` | should fail when exceeding browser context timeout | 2026-05-06 | `09f96b54` |
| `NA-035` | `page/page-goto.spec.ts` | should prioritize default navigation timeout over default timeout | 2020-08-04 | `924f55f6` |
| `NA-036` | `page/page-goto.spec.ts` | should disable timeout when its set to 0 | 2020-08-04 | `dd4b5898` |
| `NA-037` | `page/page-goto.spec.ts` | should fail when replaced by another navigation | 2025-12-15 | `96275517` |
| `NA-038` | `page/page-goto.spec.ts` | js redirect overrides url bar navigation  | 2023-06-21 | `3ff37534` |
| `NA-039` | `page/page-goto.spec.ts` | should succeed on url bar navigation when there is pending navigation | 2024-06-17 | `ad50faa4` |
| `NA-040` | `page/page-goto.spec.ts` | should work when navigating to valid url | 2020-08-04 | `391c8ce4` |
| `NA-041` | `page/page-goto.spec.ts` | should work when navigating to data url | 2020-08-04 | `b68ccdb5` |
| `NA-042` | `page/page-goto.spec.ts` | should work when navigating to 404 | 2020-08-04 | `eeb1479d` |
| `NA-043` | `page/page-goto.spec.ts` | should return last response in redirect chain | 2020-08-04 | `b681fc51` |
| `NA-044` | `page/page-goto.spec.ts` | should not leak listeners during navigation | 2020-08-11 | `ec04c630` |
| `NA-045` | `page/page-goto.spec.ts` | should not leak listeners during bad navigation | 2020-08-11 | `441b6abf` |
| `NA-046` | `page/page-goto.spec.ts` | should not leak listeners during 20 waitForNavigation | 2021-04-05 | `ffd118cc` |
| `NA-047` | `page/page-goto.spec.ts` | should navigate to dataURL and not fire dataURL requests | 2020-08-04 | `73c4b7b8` |
| `NA-048` | `page/page-goto.spec.ts` | should navigate to URL with hash and fire requests without hash | 2020-08-04 | `ac0837e5` |
| `NA-049` | `page/page-goto.spec.ts` | should work with self requesting page | 2020-08-04 | `bb1791b7` |
| `NA-050` | `page/page-goto.spec.ts` | should fail when navigating and show the url at the error message | 2020-08-04 | `186fcef2` |
| `NA-051` | `page/page-goto.spec.ts` | should be able to navigate to a page controlled by service worker | 2021-10-02 | `4d377456` |
| `NA-052` | `page/page-goto.spec.ts` | should send referer | 2020-08-04 | `7d43def6` |
| `NA-053` | `page/page-goto.spec.ts` | should send referer of cross-origin URL | 2023-10-31 | `d403373f` |
| `NA-054` | `page/page-goto.spec.ts` | should reject referer option when setExtraHTTPHeaders provides referer | 2020-08-04 | `e7261e1a` |
| `NA-055` | `page/page-goto.spec.ts` | should override referrer-policy | 2020-08-31 | `13fe7d87` |
| `NA-056` | `page/page-goto.spec.ts` | should fail when canceled by another navigation | 2020-08-04 | `09ca13a3` |
| `NA-057` | `page/page-goto.spec.ts` | should work with lazy loading iframes | 2024-06-20 | `9d472f3e` |
| `NA-058` | `page/page-goto.spec.ts` | should report raw buffer for main resource | 2025-09-09 | `4d7ac63c` |
| `NA-059` | `page/page-goto.spec.ts` | should not throw unhandled rejections on invalid url | 2021-01-25 | `39bc43f4` |
| `NA-060` | `page/page-goto.spec.ts` | should not crash when RTCPeerConnection is used | 2021-04-09 | `29e64dc0` |
| `NA-061` | `page/page-goto.spec.ts` | should properly wait for load | 2021-09-09 | `a9d80766` |
| `NA-062` | `page/page-goto.spec.ts` | should not resolve goto upon window.stop() | 2025-12-15 | `54e670ba` |
| `NA-063` | `page/page-goto.spec.ts` | should return from goto if new navigation is started | 2022-08-03 | `9b21fe6b` |
| `NA-064` | `page/page-goto.spec.ts` | should return when navigation is committed if commit is specified | 2023-01-11 | `5bd53d15` |
| `NA-065` | `page/page-goto.spec.ts` | should wait for load when iframe attaches and detaches | 2024-06-17 | `c13ef0d4` |
| `NA-066` | `page/page-goto.spec.ts` | should return url with basic auth info | 2023-06-20 | `b6edd745` |
| `NA-067` | `page/page-navigation.spec.ts` | should work with \_blank target | 2020-08-04 | `b850a6c7` |
| `NA-068` | `page/page-navigation.spec.ts` | should work with cross-process \_blank target | 2020-08-04 | `067b8806` |
| `NA-069` | `page/page-navigation.spec.ts` | should work with \_blank target in form | 2026-03-25 | `0c4e79d5` |
| `NA-070` | `page/page-navigation.spec.ts` | should not throw TargetClosedException on cross-origin redirect after click | 2026-07-22 | `118a59d8` |
| `NA-071` | `page/page-history.spec.ts` | page.goBack should work @smoke | 2022-03-10 | `a935d7e2` |
| `NA-072` | `page/page-history.spec.ts` | page.goBack should work with HistoryAPI | 2020-08-04 | `9ea05387` |
| `NA-073` | `page/page-history.spec.ts` | page.goBack should work for file urls | 2025-09-09 | `3dc776e6` |
| `NA-074` | `page/page-history.spec.ts` | goBack/goForward should work with bfcache-able pages | 2024-08-07 | `5fe6b3f4` |
| `NA-075` | `page/page-history.spec.ts` | page.reload should work | 2020-08-28 | `4018c67b` |
| `NA-076` | `page/page-history.spec.ts` | page.reload should work with data url | 2020-08-04 | `adbe3b4a` |
| `NA-077` | `page/page-history.spec.ts` | page.reload during renderer-initiated navigation | 2021-01-22 | `96fc7f63` |
| `NA-078` | `page/page-history.spec.ts` | page.reload should not resolve with same-document navigation | 2022-08-12 | `3e489a87` |
| `NA-079` | `page/page-history.spec.ts` | page.reload should work with same origin redirect | 2022-08-19 | `24862976` |
| `NA-080` | `page/page-history.spec.ts` | page.reload should work with cross-origin redirect | 2022-08-19 | `311a4c43` |
| `NA-081` | `page/page-history.spec.ts` | page.reload should work on a page with a hash | 2023-03-02 | `1ffc587d` |
| `NA-082` | `page/page-history.spec.ts` | page.reload should work on a page with a hash at the end | 2023-03-10 | `c7214d9e` |
| `NA-083` | `page/page-history.spec.ts` | page.goBack during renderer-initiated navigation | 2021-01-22 | `58815217` |
| `NA-084` | `page/page-history.spec.ts` | page.goForward during renderer-initiated navigation | 2021-01-22 | `0633ff1e` |
| `NA-085` | `page/page-history.spec.ts` | regression test for issue 20791 | 2024-06-17 | `3db867c8` |
| `NA-086` | `page/page-history.spec.ts` | should reload proper page | 2026-04-22 | `80b6ba8f` |
| `NA-087` | `page/page-event-load.spec.ts` | should fire once | 2025-12-15 | `392495b5` |
| `NA-088` | `page/page-event-load.spec.ts` | should fire once with iframe navigation | 2025-12-15 | `d80a767b` |
| `NA-089` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browser.newContext is passed to page.goto @smoke | 2023-10-23 | `2976305b` |
| `NA-090` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browser.newPage is passed to page.goto | 2023-10-23 | `d4fea180` |
| `NA-091` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browserType.launchPersistentContext is passed to page.goto | 2023-10-23 | `9cfc2d3d` |
| `NA-092` | `library/browsercontext-base-url.spec.ts` | should construct the URLs correctly when a baseURL without a trailing slash in browser.newPage is passed to page.goto | 2023-10-23 | `2a394d8b` |
| `NA-093` | `library/browsercontext-base-url.spec.ts` | should construct the URLs correctly when a baseURL with a trailing slash in browser.newPage is passed to page.goto | 2023-10-23 | `24d4ed5d` |
| `NA-094` | `library/browsercontext-base-url.spec.ts` | should not construct a new URL when valid URLs are passed | 2023-10-23 | `53bdb33c` |
| `NA-095` | `library/browsercontext-base-url.spec.ts` | should be able to match a URL relative to its given URL with urlMatcher | 2021-07-06 | `422ace1d` |
| `NA-096` | `library/browsercontext-base-url.spec.ts` | should not construct a new URL with baseURL when a glob was used | 2021-07-13 | `ab65bfe5` |

### NE — Network

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `NE-001` | `page/page-network-request.spec.ts` | should work for main frame navigation request | 2020-08-03 | `dd62d85b` |
| `NE-002` | `page/page-network-request.spec.ts` | should work for subframe navigation request | 2020-09-18 | `b7a68f76` |
| `NE-003` | `page/page-network-request.spec.ts` | should work for fetch requests @smoke | 2022-03-10 | `a5a5ea08` |
| `NE-004` | `page/page-network-request.spec.ts` | should work for a redirect | 2020-10-02 | `9426e0a4` |
| `NE-005` | `page/page-network-request.spec.ts` | should not work for a redirect and interception | 2023-06-02 | `dd5d3cc0` |
| `NE-006` | `page/page-network-request.spec.ts` | should return headers | 2021-05-13 | `c900d289` |
| `NE-007` | `page/page-network-request.spec.ts` | should get the same headers as the server | 2025-09-09 | `88134ac7` |
| `NE-008` | `page/page-network-request.spec.ts` | should not return allHeaders() until they are available | 2025-09-09 | `90c018fe` |
| `NE-009` | `page/page-network-request.spec.ts` | should get the same headers as the server CORS | 2025-09-09 | `53f7a911` |
| `NE-010` | `page/page-network-request.spec.ts` | should not get preflight CORS requests when intercepting | 2026-02-12 | `789b5b0a` |
| `NE-011` | `page/page-network-request.spec.ts` | should return postData | 2022-08-02 | `a48435a2` |
| `NE-012` | `page/page-network-request.spec.ts` | should work with binary post data | 2022-08-02 | `5a43c5ac` |
| `NE-013` | `page/page-network-request.spec.ts` | should work with binary post data and interception | 2022-08-02 | `5373451b` |
| `NE-014` | `page/page-network-request.spec.ts` | should override post data content type | 2023-06-02 | `425cb7cb` |
| `NE-015` | `page/page-network-request.spec.ts` | should get \|undefined\| with postData() when there is no post data | 2022-08-02 | `0d4704a6` |
| `NE-016` | `page/page-network-request.spec.ts` | should parse the json post data | 2022-08-02 | `01f0dd39` |
| `NE-017` | `page/page-network-request.spec.ts` | should parse the data if content-type is application/x-www-form-urlencoded | 2022-08-02 | `ef0572ea` |
| `NE-018` | `page/page-network-request.spec.ts` | should parse the data if content-type is application/x-www-form-urlencoded; charset=UTF-8 | 2024-03-12 | `9f957707` |
| `NE-019` | `page/page-network-request.spec.ts` | should get \|undefined\| with postDataJSON() when there is no post data | 2021-07-09 | `362a62d3` |
| `NE-020` | `page/page-network-request.spec.ts` | should return multipart/form-data | 2024-05-24 | `a1919245` |
| `NE-021` | `page/page-network-request.spec.ts` | should return event source | 2020-08-03 | `5f22767f` |
| `NE-022` | `page/page-network-request.spec.ts` | should return navigation bit | 2020-08-03 | `bcd84321` |
| `NE-023` | `page/page-network-request.spec.ts` | should return navigation bit when navigating to image | 2020-08-03 | `564f618a` |
| `NE-024` | `page/page-network-request.spec.ts` | should report raw headers | 2025-09-09 | `fe92efa6` |
| `NE-025` | `page/page-network-request.spec.ts` | should report raw response headers in redirects | 2021-09-07 | `7b81166c` |
| `NE-026` | `page/page-network-request.spec.ts` | should report all cookies in one header | 2022-07-28 | `ee511e44` |
| `NE-027` | `page/page-network-request.spec.ts` | should not allow to access frame on popup main request | 2023-08-22 | `50878de0` |
| `NE-028` | `page/page-network-request.spec.ts` | page.reload return 304 status code | 2025-12-15 | `4335bfcf` |
| `NE-029` | `page/page-network-request.spec.ts` | should handle mixed-content blocked requests | 2024-03-07 | `391b89ba` |
| `NE-030` | `page/page-network-response.spec.ts` | should work @smoke | 2022-03-10 | `3b2cd9fe` |
| `NE-031` | `page/page-network-response.spec.ts` | should return multiple header value | 2023-01-28 | `ec26bd14` |
| `NE-032` | `page/page-network-response.spec.ts` | should return text | 2020-08-03 | `98d915c7` |
| `NE-033` | `page/page-network-response.spec.ts` | should return uncompressed text | 2020-08-03 | `f79b7d5b` |
| `NE-034` | `page/page-network-response.spec.ts` | should return uncompressed text for brotli encoding | 2026-05-07 | `b402231a` |
| `NE-035` | `page/page-network-response.spec.ts` | should return text for identity encoding | 2026-09-03 | `e08bd509` |
| `NE-036` | `page/page-network-response.spec.ts` | should throw when requesting body of redirected response | 2020-08-03 | `6a971cc8` |
| `NE-037` | `page/page-network-response.spec.ts` | should wait until response completes | 2020-08-03 | `53c7031a` |
| `NE-038` | `page/page-network-response.spec.ts` | should return json | 2020-08-03 | `d1d40f61` |
| `NE-039` | `page/page-network-response.spec.ts` | should return body | 2021-04-05 | `e814de08` |
| `NE-040` | `page/page-network-response.spec.ts` | should return body with compression | 2021-04-05 | `823c4a65` |
| `NE-041` | `page/page-network-response.spec.ts` | should return non-utf8 body even when content-type says utf8 | 2026-07-22 | `5db339c2` |
| `NE-042` | `page/page-network-response.spec.ts` | should return status text | 2020-08-03 | `df431fdf` |
| `NE-043` | `page/page-network-response.spec.ts` | should report all headers | 2023-01-28 | `6b9bae7c` |
| `NE-044` | `page/page-network-response.spec.ts` | should report multiple set-cookie headers | 2022-07-28 | `fb5065fe` |
| `NE-045` | `page/page-network-response.spec.ts` | should behave the same way for headers and allHeaders | 2023-01-28 | `92c8a968` |
| `NE-046` | `page/page-network-response.spec.ts` | should provide a Response with a file URL | 2025-09-09 | `cc84bac6` |
| `NE-047` | `page/page-network-response.spec.ts` | should return set-cookie header after route.fulfill | 2022-01-06 | `b7ac6a38` |
| `NE-048` | `page/page-network-response.spec.ts` | should return headers after route.fulfill | 2022-01-06 | `6f449ca7` |
| `NE-049` | `page/page-network-response.spec.ts` | should report if request was fromServiceWorker | 2022-06-09 | `f0059970` |
| `NE-050` | `page/page-network-response.spec.ts` | should return body for prefetch script | 2026-08-11 | `23232d86` |
| `NE-051` | `page/page-network-response.spec.ts` | should return body for image with evicted body | 2026-08-05 | `4c7cbec1` |
| `NE-052` | `page/page-network-response.spec.ts` | should bypass disk cache when page interception is enabled | 2024-03-28 | `f9aeaa25` |
| `NE-053` | `page/page-network-response.spec.ts` | request.existingResponse should return null before response is received | 2026-02-02 | `ce774648` |
| `NE-054` | `page/page-network-response.spec.ts` | request.existingResponse should return the response after it is received | 2026-02-02 | `1b28df0e` |
| `NE-055` | `page/page-network-response.spec.ts` | should return http version | 2026-03-03 | `97364044` |
| `NE-056` | `page/page-network-response.spec.ts` | Response.formData() should parse multipart/form-data in page context | 2026-04-17 | `2820d131` |
| `NE-057` | `page/page-network-response.spec.ts` | should give a readable error when response.body() races with navigation | 2026-09-22 | `90055f48` |
| `NE-058` | `page/page-network-sizes.spec.ts` | should set bodySize and headersSize | 2021-09-07 | `6091f2d1` |
| `NE-059` | `page/page-network-sizes.spec.ts` | should set bodySize to 0 if there was no body | 2025-06-10 | `97172661` |
| `NE-060` | `page/page-network-sizes.spec.ts` | should set bodySize, headersSize, and transferSize | 2021-09-07 | `0da14fe5` |
| `NE-061` | `page/page-network-sizes.spec.ts` | should set bodySize to 0 when there was no response body | 2021-09-07 | `ae855019` |
| `NE-062` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize | 2021-09-07 | `4fd4aab9` |
| `NE-063` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize for chunked request | 2026-10-15 | `8a58aab4` |
| `NE-064` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize with gzip compression | 2021-09-07 | `9e8dcdf3` |
| `NE-065` | `page/page-network-sizes.spec.ts` | should handle redirects | 2021-09-07 | `55cfc028` |
| `NE-066` | `page/page-network-sizes.spec.ts` | should throw for failed requests | 2021-09-07 | `9ace0c2d` |
| `NE-067` | `page/page-network-sizes.spec.ts` | should work with {200, 401, 404, 500} status code *(4 copies)* | 2021-09-07 | `b745c670` |
| `NE-068` | `page/page-network-sizes.spec.ts` | should have correct responseBodySize for 404 with content | 2022-01-07 | `750b6b23` |
| `NE-069` | `page/page-network-sizes.spec.ts` | should return sizes without hanging | 2021-10-07 | `14182eb8` |
| `NE-070` | `page/page-network-idle.spec.ts` | should navigate to empty page with networkidle | 2020-08-04 | `98d32f28` |
| `NE-071` | `page/page-network-idle.spec.ts` | should wait for networkidle to succeed navigation | 2020-08-04 | `48b7475b` |
| `NE-072` | `page/page-network-idle.spec.ts` | should wait for networkidle to succeed navigation with request from previous navigation | 2020-08-04 | `664650d8` |
| `NE-073` | `page/page-network-idle.spec.ts` | should wait for networkidle in waitForNavigation | 2023-06-02 | `d1390704` |
| `NE-074` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent | 2020-08-04 | `ab40a9e2` |
| `NE-075` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent with request from previous navigation | 2020-08-04 | `3aba89ea` |
| `NE-076` | `page/page-network-idle.spec.ts` | should wait for networkidle when navigating iframe | 2020-08-04 | `a4e48942` |
| `NE-077` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent from the child frame | 2020-08-04 | `8a161527` |
| `NE-078` | `page/page-network-idle.spec.ts` | should wait for networkidle from the child frame | 2020-08-04 | `b4ce98cf` |
| `NE-079` | `page/page-network-idle.spec.ts` | should wait for networkidle from the popup | 2022-08-02 | `df959b12` |
| `NE-080` | `page/page-network-idle.spec.ts` | should wait for networkidle when iframe attaches and detaches | 2022-10-03 | `bbf48ecc` |
| `NE-081` | `page/page-network-idle.spec.ts` | should work after repeated navigations in the same page | 2023-06-02 | `1b105bd8` |
| `NE-082` | `page/page-network-idle.spec.ts` | should not wait for an open EventSource connection | 2026-07-01 | `9e7c70ad` |
| `NE-083` | `page/page-network-idle.spec.ts` | should not wait for an open EventSource connection in setContent | 2026-07-01 | `fc3a5b24` |
| `NE-084` | `page/page-event-network.spec.ts` | Page.Events.Request @smoke | 2022-03-10 | `fec5d57f` |
| `NE-085` | `page/page-event-network.spec.ts` | Page.Events.Response @smoke | 2022-03-10 | `0573513e` |
| `NE-086` | `page/page-event-network.spec.ts` | Page.Events.RequestFailed @smoke | 2025-10-03 | `23a3fe5b` |
| `NE-087` | `page/page-event-network.spec.ts` | Page.Events.RequestFinished @smoke | 2022-03-10 | `998fa4df` |
| `NE-088` | `page/page-event-network.spec.ts` | should fire events in proper order | 2020-08-28 | `21021f8d` |
| `NE-089` | `page/page-event-network.spec.ts` | should support redirects | 2021-09-01 | `14a951e9` |
| `NE-090` | `page/page-event-network.spec.ts` | should resolve responses after a navigation | 2023-01-30 | `d13db991` |
| `NE-091` | `page/page-event-request.spec.ts` | should fire for navigation requests | 2020-08-03 | `2f147fe6` |
| `NE-092` | `page/page-event-request.spec.ts` | should fire for iframes | 2020-09-18 | `edc24345` |
| `NE-093` | `page/page-event-request.spec.ts` | should fire for fetches | 2020-08-03 | `e8eb40e5` |
| `NE-094` | `page/page-event-request.spec.ts` | should fire for fetches with keepalive: true | 2025-01-27 | `7dd0f3ce` |
| `NE-095` | `page/page-event-request.spec.ts` | should report requests and responses handled by service worker | 2023-09-27 | `fff405ed` |
| `NE-096` | `page/page-event-request.spec.ts` | should report requests and responses handled by service worker with routing | 2023-12-04 | `d570b778` |
| `NE-097` | `page/page-event-request.spec.ts` | should report navigation requests and responses handled by service worker | 2024-06-20 | `87f67d78` |
| `NE-098` | `page/page-event-request.spec.ts` | should report navigation requests and responses handled by service worker with routing | 2024-06-20 | `b882136f` |
| `NE-099` | `page/page-event-request.spec.ts` | should return response body when Cross-Origin-Opener-Policy is set | 2025-12-10 | `a2840802` |
| `NE-100` | `page/page-event-request.spec.ts` | should fire requestfailed when intercepting race | 2023-12-15 | `c4ac813f` |
| `NE-101` | `page/page-event-request.spec.ts` | main resource xhr should have type xhr | 2023-05-25 | `dc447e6c` |
| `NE-102` | `page/page-event-request.spec.ts` | should finish 204 request | 2026-09-21 | `2e92274a` |
| `NE-103` | `page/page-event-request.spec.ts` | should fail 204 navigation request | 2026-10-12 | `ede43457` |
| `NE-104` | `page/page-event-request.spec.ts` | \<picture\> resource should have type image | 2024-10-21 | `a211d617` |
| `NE-105` | `page/page-event-request.spec.ts` | should not expose preflight OPTIONS request | 2025-06-30 | `11a83591` |
| `NE-106` | `page/page-event-request.spec.ts` | should not expose preflight OPTIONS request with network interception | 2026-02-12 | `8ae396c3` |
| `NE-107` | `page/page-event-request.spec.ts` | should return last requests | 2025-09-27 | `a80dbf4e` |
| `NE-108` | `page/network-post-data.spec.ts` | should return correct postData buffer for utf-8 body | 2021-03-06 | `0db7e334` |
| `NE-109` | `page/network-post-data.spec.ts` | should return post data w/o content-type @smoke | 2022-03-10 | `98729473` |
| `NE-110` | `page/network-post-data.spec.ts` | should throw on invalid JSON in post data | 2021-03-06 | `f03cedde` |
| `NE-111` | `page/network-post-data.spec.ts` | should return post data for PUT requests | 2021-03-06 | `efd61dc8` |
| `NE-112` | `page/network-post-data.spec.ts` | should get post data for file/blob | 2023-06-02 | `9888e33f` |
| `NE-113` | `page/network-post-data.spec.ts` | should get post data for navigator.sendBeacon api calls | 2022-02-22 | `889e8676` |
| `NE-114` | `page/page-set-extra-http-headers.spec.ts` | should work @smoke | 2022-03-10 | `25ff17c6` |
| `NE-115` | `page/page-set-extra-http-headers.spec.ts` | should work with redirects | 2020-08-03 | `cbda91a4` |
| `NE-116` | `page/page-set-extra-http-headers.spec.ts` | should work with extra headers from browser context | 2021-03-23 | `ec9ef6bd` |
| `NE-117` | `page/page-set-extra-http-headers.spec.ts` | should throw for non-string header values | 2021-04-02 | `b3c6c887` |
| `NE-118` | `page/page-set-extra-http-headers.spec.ts` | should not duplicate referer header | 2026-09-08 | `1b63679b` |
| `NE-119` | `library/browsercontext-set-extra-http-headers.spec.ts` | should override extra headers from browser context | 2021-03-23 | `425a4de2` |
| `NE-120` | `library/browsercontext-set-extra-http-headers.spec.ts` | should throw for non-string header values | 2021-04-02 | `bc730b3b` |
| `NE-121` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.Request | 2023-10-23 | `129c0f86` |
| `NE-122` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.Response | 2023-10-23 | `f65bb578` |
| `NE-123` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.RequestFailed | 2023-10-23 | `315ccbfb` |
| `NE-124` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.RequestFinished | 2023-10-23 | `6724a882` |
| `NE-125` | `library/browsercontext-network-event.spec.ts` | should fire events in proper order | 2023-10-23 | `6f78b840` |
| `NE-126` | `library/browsercontext-network-event.spec.ts` | should not fire events for favicon or favicon redirects | 2025-10-03 | `fc10ee82` |
| `NE-127` | `library/browsercontext-network-event.spec.ts` | should reject response.finished if context closes | 2024-09-30 | `6c0f2974` |
| `NE-128` | `library/network-timeout.spec.ts` | httpRequest should honor socketTimeout while connecting | 2026-09-10 | `c0914e0c` |
| `NE-129` | `library/network-timeout.spec.ts` | httpRequest should honor socketTimeout for stalled responses | 2026-09-10 | `1f464e6d` |
| `NE-130` | `library/network-timeout.spec.ts` | httpRequest should honor ipv4first result order | 2026-09-24 | `b57891bc` |
| `NE-131` | `library/resource-timing.spec.ts` | should work @smoke | 2022-03-10 | `1c2e02ff` |
| `NE-132` | `library/resource-timing.spec.ts` | should work for subresource | 2023-02-06 | `5a111c18` |
| `NE-133` | `library/resource-timing.spec.ts` | should work for SSL | 2026-06-12 | `e23f8b78` |
| `NE-134` | `library/resource-timing.spec.ts` | should work for redirect | 2021-04-05 | `10b1d6dc` |
| `NE-135` | `library/resource-timing.spec.ts` | should work when serving from memory cache | 2025-12-15 | `4a03a96b` |
| `NE-136` | `library/ignorehttpserrors.spec.ts` | should work @smoke | 2022-03-10 | `5c43c8d6` |
| `NE-137` | `library/ignorehttpserrors.spec.ts` | should isolate contexts | 2020-08-03 | `2cf7df63` |
| `NE-138` | `library/ignorehttpserrors.spec.ts` | should isolated contexts that share network process | 2025-05-16 | `e6282567` |
| `NE-139` | `library/ignorehttpserrors.spec.ts` | should work with mixed content | 2022-08-26 | `a8807ce3` |
| `NE-140` | `library/ignorehttpserrors.spec.ts` | should work with WebSocket | 2021-05-26 | `bd156def` |
| `NE-141` | `library/ignorehttpserrors.spec.ts` | should fail with WebSocket if not ignored | 2020-08-03 | `2f78e27a` |
| `NE-142` | `library/ignorehttpserrors.spec.ts` | serviceWorker should intercept document request | 2026-06-12 | `9fcbaac2` |

### OO — OOPIF

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `OO-001` | `library/chromium/oopif.spec.ts` | should report oopif frames | 2024-09-06 | `75a7fddd` |
| `OO-002` | `library/chromium/oopif.spec.ts` | should handle oopif detach | 2024-09-06 | `d69d5856` |
| `OO-003` | `library/chromium/oopif.spec.ts` | should remove workers of a detached oopif | 2026-08-17 | `6eebc003` |
| `OO-004` | `library/chromium/oopif.spec.ts` | should not hang in unrouteAll when oopif worker is gone | 2026-08-17 | `c406bdde` |
| `OO-005` | `library/chromium/oopif.spec.ts` | should handle remote -\> local -\> remote transitions | 2024-09-06 | `bc43dc14` |
| `OO-006` | `library/chromium/oopif.spec.ts` | should get the proper viewport | 2026-06-12 | `b23b386f` |
| `OO-007` | `library/chromium/oopif.spec.ts` | should expose function | 2024-09-06 | `e7ab8a88` |
| `OO-008` | `library/chromium/oopif.spec.ts` | should emulate media | 2024-09-06 | `76747370` |
| `OO-009` | `library/chromium/oopif.spec.ts` | should emulate offline | 2024-09-06 | `f29d7b7a` |
| `OO-010` | `library/chromium/oopif.spec.ts` | should support context options | 2024-09-06 | `366b09ca` |
| `OO-011` | `library/chromium/oopif.spec.ts` | should respect route | 2024-09-06 | `bedc6924` |
| `OO-012` | `library/chromium/oopif.spec.ts` | should take screenshot | 2024-09-06 | `634708ae` |
| `OO-013` | `library/chromium/oopif.spec.ts` | should load oopif iframes with subresources and route | 2024-09-06 | `e73e0387` |
| `OO-014` | `library/chromium/oopif.spec.ts` | should report main requests | 2024-09-06 | `9b8c6e0e` |
| `OO-015` | `library/chromium/oopif.spec.ts` | should support exposeFunction | 2024-09-06 | `1b5f3a70` |
| `OO-016` | `library/chromium/oopif.spec.ts` | should support addInitScript | 2024-09-06 | `2c07870e` |
| `OO-017` | `library/chromium/oopif.spec.ts` | should click a button when it overlays oopif | 2024-09-06 | `725f8ba8` |
| `OO-018` | `library/chromium/oopif.spec.ts` | should report google.com frame with headed | 2024-10-30 | `86c48732` |
| `OO-019` | `library/chromium/oopif.spec.ts` | ElementHandle.boundingBox() should work | 2024-09-24 | `d702cf32` |
| `OO-020` | `library/chromium/oopif.spec.ts` | should click | 2024-09-06 | `7cb1af2f` |
| `OO-021` | `library/chromium/oopif.spec.ts` | contentFrame should work | 2024-09-06 | `9434d221` |
| `OO-022` | `library/chromium/oopif.spec.ts` | should allow cdp sessions on oopifs | 2024-09-06 | `5c1352d8` |
| `OO-023` | `library/chromium/oopif.spec.ts` | should emit filechooser event for iframe | 2024-09-06 | `ccb9fcf6` |
| `OO-024` | `library/chromium/oopif.spec.ts` | should be able to click in iframe | 2024-09-06 | `7ea4dc17` |
| `OO-025` | `library/chromium/oopif.spec.ts` | should not throw on exposeFunction when oopif detaches | 2024-09-06 | `8abe7077` |
| `OO-026` | `library/chromium/oopif.spec.ts` | should intercept response body from oopif | 2023-03-02 | `a725d5a7` |
| `OO-027` | `library/chromium/oopif.spec.ts` | should navigate a local frame to oopif with frame.goto | 2026-10-05 | `487270d1` |
| `OO-028` | `library/chromium/oopif.spec.ts` | should allow to re-connect to OOPIFs with CDP when iframes were there already | 2026-04-14 | `433cb9fe` |
| `OO-029` | `library/chromium/oopif.spec.ts` | should report the whole frame tree when connecting over CDP to nested OOPIFs | 2026-10-05 | `d742456e` |

### PA — Page

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PA-001` | `page/page-basic.spec.ts` | should fire load when expected | 2021-03-18 | `0a1b2235` |
| `PA-002` | `page/page-basic.spec.ts` | async stacks should work | 2020-08-04 | `8dbc55e9` |
| `PA-003` | `page/page-basic.spec.ts` | should provide access to the opener page | 2020-08-04 | `729a94d9` |
| `PA-004` | `page/page-basic.spec.ts` | should fire domcontentloaded when expected | 2021-03-18 | `c9d8b76a` |
| `PA-005` | `page/page-basic.spec.ts` | should pass self as argument to domcontentloaded event | 2021-03-18 | `94501121` |
| `PA-006` | `page/page-basic.spec.ts` | should pass self as argument to load event | 2021-03-18 | `e0b429c5` |
| `PA-007` | `page/page-basic.spec.ts` | page.url should work | 2022-07-28 | `1e944c34` |
| `PA-008` | `page/page-basic.spec.ts` | page.url should include hashes | 2020-08-28 | `775783de` |
| `PA-009` | `page/page-basic.spec.ts` | page.title should return the page title | 2020-08-04 | `961051ac` |
| `PA-010` | `page/page-basic.spec.ts` | page.title should not throw during navigation | 2026-03-17 | `05c3923f` |
| `PA-011` | `page/page-basic.spec.ts` | page.close should work with window.close | 2021-03-18 | `ecd458f3` |
| `PA-012` | `page/page-basic.spec.ts` | page.frame should respect name | 2025-12-15 | `aaec6031` |
| `PA-013` | `page/page-basic.spec.ts` | page.frame should respect url | 2020-08-04 | `df03ae80` |
| `PA-014` | `page/page-basic.spec.ts` | should have sane user agent | 2026-06-22 | `1d5a6d43` |
| `PA-015` | `page/page-basic.spec.ts` | page.press should work | 2020-08-04 | `806ec8a4` |
| `PA-016` | `page/page-basic.spec.ts` | page.press should work for Enter | 2021-03-18 | `53869d79` |
| `PA-017` | `page/page-basic.spec.ts` | frame.press should work | 2020-08-04 | `07d01797` |
| `PA-018` | `page/page-basic.spec.ts` | has navigator.webdriver set to true | 2026-05-06 | `20af98fe` |
| `PA-019` | `page/page-basic.spec.ts` | should iterate over page properties | 2023-02-28 | `f8a3abb0` |
| `PA-020` | `page/page-set-content.spec.ts` | should work @smoke | 2022-03-10 | `e925feab` |
| `PA-021` | `page/page-set-content.spec.ts` | should work with domcontentloaded | 2020-08-04 | `de12debe` |
| `PA-022` | `page/page-set-content.spec.ts` | should work with commit | 2021-11-02 | `8486fcb1` |
| `PA-023` | `page/page-set-content.spec.ts` | should work with doctype | 2020-08-04 | `4f4033ae` |
| `PA-024` | `page/page-set-content.spec.ts` | should work with HTML 4 doctype | 2020-08-04 | `c78050b0` |
| `PA-025` | `page/page-set-content.spec.ts` | should include shadow roots | 2026-09-22 | `305498ff` |
| `PA-026` | `page/page-set-content.spec.ts` | should respect timeout | 2020-08-04 | `3438b680` |
| `PA-027` | `page/page-set-content.spec.ts` | should respect default navigation timeout | 2020-08-04 | `0a01bd88` |
| `PA-028` | `page/page-set-content.spec.ts` | should await resources to load | 2020-08-04 | `03e99771` |
| `PA-029` | `page/page-set-content.spec.ts` | should work fast enough | 2020-08-04 | `a7fd85d3` |
| `PA-030` | `page/page-set-content.spec.ts` | should work with tricky content | 2020-08-04 | `b3e634c1` |
| `PA-031` | `page/page-set-content.spec.ts` | should work with accents | 2020-08-04 | `3018f21e` |
| `PA-032` | `page/page-set-content.spec.ts` | should work with emojis | 2020-08-04 | `ecdb5d2d` |
| `PA-033` | `page/page-set-content.spec.ts` | should work with newline | 2020-08-04 | `df6fceee` |
| `PA-034` | `page/page-set-content.spec.ts` | content() should throw nice error during navigation | 2021-09-22 | `8c5d2b4b` |
| `PA-035` | `page/page-set-content.spec.ts` | should return empty content there is no iframe src | 2026-06-12 | `0d0948fa` |
| `PA-036` | `page/page-set-content.spec.ts` | should handle timeout properly | 2026-04-02 | `5cc02ca5` |
| `PA-037` | `page/page-set-content.spec.ts` | should handle timeout properly 2 | 2026-04-02 | `7217cb49` |
| `PA-038` | `page/page-transition.spec.ts` | should not crash when filter transition completes | 2026-09-10 | `77595496` |
| `PA-039` | `library/page-close.spec.ts` | should close page with active dialog | 2025-06-23 | `b265dc19` |
| `PA-040` | `library/page-close.spec.ts` | expect should not print timed out error message when page closes | 2025-06-23 | `7c05c02d` |
| `PA-041` | `library/page-close.spec.ts` | addLocatorHandler should throw when page closes | 2025-12-10 | `b3d4aeef` |
| `PA-042` | `library/page-close.spec.ts` | should reject all promises when page is closed | 2025-06-23 | `0b5702bf` |
| `PA-043` | `library/page-close.spec.ts` | should set the page close state | 2025-06-23 | `0983d647` |
| `PA-044` | `library/page-close.spec.ts` | should pass page to close event | 2025-06-23 | `14e7cfb3` |
| `PA-045` | `library/page-close.spec.ts` | should terminate network waiters | 2025-06-23 | `2f97ce97` |
| `PA-046` | `library/page-close.spec.ts` | should be callable twice | 2025-06-23 | `7a5009f8` |
| `PA-047` | `library/page-close.spec.ts` | should return null if parent page has been closed | 2025-06-23 | `026850f0` |
| `PA-048` | `library/page-close.spec.ts` | should fail with error upon disconnect | 2025-06-23 | `a32a516f` |
| `PA-049` | `library/page-close.spec.ts` | page.close should work with window.close | 2025-06-23 | `4ed8bb8e` |
| `PA-050` | `library/page-close.spec.ts` | should not throw UnhandledPromiseRejection when page closes | 2025-06-23 | `18c6860e` |
| `PA-051` | `library/page-close.spec.ts` | interrupt request.response() and request.allHeaders() on page.close | 2025-10-03 | `3ae2e3b1` |
| `PA-052` | `library/page-close.spec.ts` | should not treat navigations as new popups | 2025-06-23 | `5b772b28` |
| `PA-053` | `library/page-close.spec.ts` | should not result in unhandled rejection | 2025-06-23 | `eb104b66` |
| `PA-054` | `library/page-close.spec.ts` | should reject response.finished if page closes | 2025-06-23 | `0a105440` |
| `PA-055` | `library/page-close.spec.ts` | should not throw when continuing while page is closing | 2025-06-23 | `3d7414e4` |
| `PA-056` | `library/page-close.spec.ts` | should not throw when continuing after page is closed | 2025-06-23 | `6a44228c` |

### PC — Playwright client

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PC-001` | `library/playwright-client.spec.ts` | should connect from a page and drive the same browser | 2026-07-02 | `d855f92a` |

### PD — PDF

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PD-001` | `library/pdf.spec.ts` | should be able to save file | 2024-12-06 | `ab41bca1` |
| `PD-002` | `library/pdf.spec.ts` | should be able to generate outline | 2024-12-06 | `7b9b76ea` |

### PE — Permissions

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PE-001` | `library/permissions.spec.ts` | permissions › should be prompt by default | 2021-04-06 | `55d35904` |
| `PE-002` | `library/permissions.spec.ts` | permissions › should deny permission when not listed | 2026-02-27 | `42f3dcca` |
| `PE-003` | `library/permissions.spec.ts` | permissions › should fail when bad permission is given | 2026-01-26 | `df847824` |
| `PE-004` | `library/permissions.spec.ts` | permissions › should grant geolocation permission when origin is listed | 2021-04-06 | `067dc194` |
| `PE-005` | `library/permissions.spec.ts` | permissions › should prompt for geolocation permission when origin is not listed | 2022-04-22 | `b3b52871` |
| `PE-006` | `library/permissions.spec.ts` | permissions › should grant notifications permission when listed | 2021-04-06 | `235a60b4` |
| `PE-007` | `library/permissions.spec.ts` | permissions › should accumulate when adding | 2021-04-06 | `cc85e386` |
| `PE-008` | `library/permissions.spec.ts` | permissions › should clear permissions | 2021-04-06 | `0917943d` |
| `PE-009` | `library/permissions.spec.ts` | permissions › should grant permission when listed for all domains | 2021-04-06 | `3ca8253a` |
| `PE-010` | `library/permissions.spec.ts` | permissions › should grant permission when creating context | 2020-08-18 | `e1bc6151` |
| `PE-011` | `library/permissions.spec.ts` | permissions › should reset permissions | 2021-04-06 | `cdaac4b9` |
| `PE-012` | `library/permissions.spec.ts` | permissions › should trigger permission onchange | 2026-01-26 | `7358eed4` |
| `PE-013` | `library/permissions.spec.ts` | permissions › should isolate permissions between browser contexts | 2026-02-27 | `0a856ebd` |
| `PE-014` | `library/permissions.spec.ts` | should support clipboard read | 2026-08-13 | `34ce56fb` |
| `PE-015` | `library/permissions.spec.ts` | should isolate the headless clipboard from the operating system | 2026-08-13 | `67f49024` |
| `PE-016` | `library/permissions.spec.ts` | storage access | 2024-10-04 | `49eecc14` |
| `PE-017` | `library/permissions.spec.ts` | should be able to use the local-fonts API | 2026-06-12 | `cbeffd6d` |
| `PE-018` | `library/permissions.spec.ts` | local network request is allowed from public origin | 2026-07-22 | `80ca1dbc` |
| `PE-019` | `library/permissions.spec.ts` | can request screen-wake-lock | 2026-02-11 | `d083cca5` |
| `PE-020` | `library/permissions.spec.ts` | camera and microphone › should capture when camera and microphone are granted | 2026-07-17 | `47bb5fa4` |
| `PE-021` | `library/permissions.spec.ts` | camera and microphone › should reject when no permission is granted | 2026-07-17 | `8008f3db` |
| `PE-022` | `library/permissions.spec.ts` | camera and microphone › should gate audio and video independently | 2026-07-17 | `5a972fce` |
| `PE-023` | `library/permissions.spec.ts` | camera and microphone › should stop capturing after permissions are cleared | 2026-07-17 | `6b3e1d99` |

### PO — Popup

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PO-001` | `page/page-event-popup.spec.ts` | should work @smoke | 2022-03-10 | `017ac09a` |
| `PO-002` | `page/page-event-popup.spec.ts` | should work with window features | 2020-12-16 | `3f91b543` |
| `PO-003` | `page/page-event-popup.spec.ts` | should emit for immediately closed popups | 2021-03-19 | `969147f7` |
| `PO-004` | `page/page-event-popup.spec.ts` | should emit for immediately closed popups 2 | 2021-05-13 | `0ea67247` |
| `PO-005` | `page/page-event-popup.spec.ts` | should be able to capture alert | 2023-05-05 | `7141607a` |
| `PO-006` | `page/page-event-popup.spec.ts` | should work with empty url | 2020-12-16 | `a4ad9c16` |
| `PO-007` | `page/page-event-popup.spec.ts` | should work with noopener and no url | 2020-12-16 | `765af43f` |
| `PO-008` | `page/page-event-popup.spec.ts` | should work with noopener and about:blank | 2020-12-16 | `2d374c0e` |
| `PO-009` | `page/page-event-popup.spec.ts` | should work with noopener and url | 2020-12-16 | `dd0a337c` |
| `PO-010` | `page/page-event-popup.spec.ts` | should work with clicking target=\_blank | 2023-08-21 | `f163fb5a` |
| `PO-011` | `page/page-event-popup.spec.ts` | should work with fake-clicking target=\_blank and rel=noopener | 2020-12-16 | `aff4a4d7` |
| `PO-012` | `page/page-event-popup.spec.ts` | should work with clicking target=\_blank and rel=noopener | 2020-12-16 | `336dc5fd` |
| `PO-013` | `page/page-event-popup.spec.ts` | should report popup opened from iframes | 2025-11-12 | `0586ab00` |
| `PO-014` | `library/popup.spec.ts` | should inherit user agent from browser context @smoke | 2026-02-27 | `0f3aa988` |
| `PO-015` | `library/popup.spec.ts` | should respect routes from browser context | 2023-06-02 | `c23678ba` |
| `PO-016` | `library/popup.spec.ts` | should inherit extra headers from browser context | 2020-08-28 | `f1e1fd34` |
| `PO-017` | `library/popup.spec.ts` | should inherit offline from browser context | 2020-08-03 | `c41a6281` |
| `PO-018` | `library/popup.spec.ts` | should inherit http credentials from browser context | 2020-08-28 | `e1e7e8d6` |
| `PO-019` | `library/popup.spec.ts` | should inherit touch support from browser context | 2026-06-12 | `f4ced88b` |
| `PO-020` | `library/popup.spec.ts` | should inherit viewport size from browser context | 2020-08-03 | `7d0592c8` |
| `PO-021` | `library/popup.spec.ts` | should use viewport size from window features | 2025-03-25 | `86d5ab76` |
| `PO-022` | `library/popup.spec.ts` | should respect routes from browser context when using window.open | 2023-06-02 | `40c9c7bf` |
| `PO-023` | `library/popup.spec.ts` | BrowserContext.addInitScript should apply to an in-process popup | 2020-08-11 | `bf95bafa` |
| `PO-024` | `library/popup.spec.ts` | BrowserContext.addInitScript should apply to a cross-process popup | 2020-08-11 | `dc667c66` |
| `PO-025` | `library/popup.spec.ts` | should expose function from browser context | 2020-08-11 | `291a7c57` |
| `PO-026` | `library/popup.spec.ts` | should not dispatch binding on a closed page | 2025-05-01 | `6e048bce` |
| `PO-027` | `library/popup.spec.ts` | should not throttle rAF in the opener page | 2022-06-06 | `28db6e11` |
| `PO-028` | `library/popup.spec.ts` | should not throw when click closes popup | 2024-10-04 | `847b4a32` |

### PR — Proxy

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PR-001` | `library/proxy.spec.ts` | should throw for bad server value | 2021-10-28 | `bc2d3ef6` |
| `PR-002` | `library/proxy.spec.ts` | should use proxy @smoke | 2026-10-16 | `4f0d500d` |
| `PR-003` | `library/proxy.spec.ts` | should use proxy for second page | 2026-10-16 | `e32511e3` |
| `PR-004` | `library/proxy.spec.ts` | should work with IP:PORT notion | 2026-10-16 | `b3e3d016` |
| `PR-005` | `library/proxy.spec.ts` | should proxy local network requests › {by default, with other bypasses} › {localhost, loopback address, link-local} *(6 copies)* | 2026-06-12 | `bb5a574a` |
| `PR-006` | `library/proxy.spec.ts` | should allow bypassing {localhost, 127.0.0.1} requests *(2 copies)* | 2026-03-11 | `162144c3` |
| `PR-007` | `library/proxy.spec.ts` | should authenticate | 2026-10-16 | `3c31437d` |
| `PR-008` | `library/proxy.spec.ts` | should reconnect with credentials after CONNECT 407 closes the socket | 2026-10-16 | `0d304f8a` |
| `PR-009` | `library/proxy.spec.ts` | should work with authenticate followed by redirect | 2026-10-16 | `db5fad81` |
| `PR-010` | `library/proxy.spec.ts` | should exclude patterns | 2026-06-12 | `9e5ea221` |
| `PR-011` | `library/proxy.spec.ts` | should bypass proxy for {localhost when localhost, 127.0.0.1 when 127.0.0.1} is in bypass list *(2 copies)* | 2026-03-10 | `2138f571` |
| `PR-012` | `library/proxy.spec.ts` | should use socks proxy | 2026-10-16 | `409cc98a` |
| `PR-013` | `library/proxy.spec.ts` | should use socks proxy in second page | 2026-10-16 | `7f4545bd` |
| `PR-014` | `library/proxy.spec.ts` | does launch without a port | 2021-10-28 | `d3fb097e` |
| `PR-015` | `library/proxy.spec.ts` | should use proxy with emulated user agent | 2021-10-28 | `433226bc` |
| `PR-016` | `library/proxy.spec.ts` | should use SOCKS proxy for websocket requests | 2024-09-16 | `dd862a11` |
| `PR-017` | `library/proxy.spec.ts` | should use http proxy for websocket requests | 2025-09-09 | `6907675b` |
| `PR-018` | `library/browsercontext-proxy.spec.ts` | should work when passing the proxy only on the context level | 2026-10-16 | `e8ce1773` |
| `PR-019` | `library/browsercontext-proxy.spec.ts` | should ignore legacy {'per-context', 'http://per-context'} launch proxy *(2 copies)* | 2026-10-16 | `74e5c699` |
| `PR-020` | `library/browsercontext-proxy.spec.ts` | should throw for bad server value | 2021-05-10 | `727c05c5` |
| `PR-021` | `library/browsercontext-proxy.spec.ts` | should use proxy | 2026-10-16 | `4f0e06cb` |
| `PR-022` | `library/browsercontext-proxy.spec.ts` | should send secure cookies to subdomain.localhost | 2025-09-09 | `be271a21` |
| `PR-023` | `library/browsercontext-proxy.spec.ts` | should set cookie for top-level domain | 2025-09-09 | `68136edc` |
| `PR-024` | `library/browsercontext-proxy.spec.ts` | should proxy local network requests › {by default, with other bypasses} › {localhost, loopback address, link-local} *(6 copies)* | 2025-07-01 | `5d637e7c` |
| `PR-025` | `library/browsercontext-proxy.spec.ts` | should use ipv6 proxy | 2026-10-16 | `0a418a34` |
| `PR-026` | `library/browsercontext-proxy.spec.ts` | should use proxy twice | 2026-10-16 | `6dc1bc94` |
| `PR-027` | `library/browsercontext-proxy.spec.ts` | should use proxy for second page | 2026-10-16 | `10bcfedc` |
| `PR-028` | `library/browsercontext-proxy.spec.ts` | should use proxy for https urls | 2026-10-16 | `f5117b4c` |
| `PR-029` | `library/browsercontext-proxy.spec.ts` | should work with IP:PORT notion | 2026-10-16 | `b4ac50d5` |
| `PR-030` | `library/browsercontext-proxy.spec.ts` | should throw for socks5 authentication | 2021-05-10 | `4741021c` |
| `PR-031` | `library/browsercontext-proxy.spec.ts` | should throw for socks4 authentication | 2021-05-10 | `a6ee271a` |
| `PR-032` | `library/browsercontext-proxy.spec.ts` | should authenticate | 2026-10-16 | `89bd8198` |
| `PR-033` | `library/browsercontext-proxy.spec.ts` | should authenticate with empty password | 2026-10-16 | `727224cb` |
| `PR-034` | `library/browsercontext-proxy.spec.ts` | should isolate proxy credentials between contexts | 2026-10-16 | `74fa2c9e` |
| `PR-035` | `library/browsercontext-proxy.spec.ts` | should exclude patterns | 2025-07-01 | `ab3ca4fd` |
| `PR-036` | `library/browsercontext-proxy.spec.ts` | should use socks proxy | 2026-10-16 | `49c297ff` |
| `PR-037` | `library/browsercontext-proxy.spec.ts` | should use socks proxy in second page | 2026-10-16 | `012efd07` |
| `PR-038` | `library/browsercontext-proxy.spec.ts` | does launch without a port | 2021-05-10 | `261442e5` |
| `PR-039` | `library/browsercontext-proxy.spec.ts` | should isolate proxy credentials between contexts on navigation | 2026-10-16 | `48ad4a1d` |
| `PR-040` | `library/proxy-pattern.spec.ts` | socks proxy patter matcher | 2022-12-12 | `90468612` |
| `PR-041` | `library/fetch-proxy.spec.ts` | context request should pick up proxy credentials | 2024-09-30 | `058e2ada` |
| `PR-042` | `library/fetch-proxy.spec.ts` | global request should pick up proxy credentials | 2023-10-17 | `127956bd` |
| `PR-043` | `library/fetch-proxy.spec.ts` | should work with context level proxy | 2023-10-17 | `ccef89f2` |
| `PR-044` | `library/fetch-proxy.spec.ts` | should support proxy.bypass | 2023-10-17 | `759bc277` |
| `PR-045` | `library/fetch-proxy.spec.ts` | should use socks proxy | 2024-05-24 | `7106d5d8` |
| `PR-046` | `library/fetch-proxy.spec.ts` | should send correct ALPN protocol to HTTPS proxy | 2025-10-06 | `90c48c7d` |
| `PR-047` | `library/fetch-proxy.spec.ts` | should apply proxy.bypass to redirect targets | 2026-09-22 | `2e348b84` |

### PS — Parser

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `PS-001` | `library/locator-parser.spec.ts` | should parse getByText, getByLabel, getByPlaceholder, getByAltText and getByTitle | 2026-10-07 | `57a051f9` |
| `PS-002` | `library/locator-parser.spec.ts` | should parse getByTestId | 2026-10-07 | `4ce955db` |
| `PS-003` | `library/locator-parser.spec.ts` | should parse getByTestId with a custom test id attribute | 2026-10-07 | `b2eb3460` |
| `PS-004` | `library/locator-parser.spec.ts` | should parse getByRef | 2026-10-07 | `68b67766` |
| `PS-005` | `library/locator-parser.spec.ts` | should parse getByRole with every role | 2026-10-07 | `dc51e202` |
| `PS-006` | `library/locator-parser.spec.ts` | should parse getByRole options | 2026-10-07 | `c17327ec` |
| `PS-007` | `library/locator-parser.spec.ts` | should parse getByRole name and description | 2026-10-07 | `a75ff00e` |
| `PS-008` | `library/locator-parser.spec.ts` | should parse getByRole options in any order | 2026-10-07 | `0bb8a5ec` |
| `PS-009` | `library/locator-parser.spec.ts` | should parse locator with a selector | 2026-10-07 | `a0832f2f` |
| `PS-010` | `library/locator-parser.spec.ts` | should parse locator and filter options | 2026-10-07 | `f821d09f` |
| `PS-011` | `library/locator-parser.spec.ts` | should parse first, last, nth and visible | 2026-10-07 | `31a7b9db` |
| `PS-012` | `library/locator-parser.spec.ts` | should parse and, or, locator and within with a locator argument | 2026-10-07 | `eef015a2` |
| `PS-013` | `library/locator-parser.spec.ts` | should parse chained refinements | 2026-10-07 | `acec3195` |
| `PS-014` | `library/locator-parser.spec.ts` | should parse frame locators | 2026-10-07 | `0fe94759` |
| `PS-015` | `library/locator-parser.spec.ts` | should parse FrameLocator.locator with a locator argument | 2026-10-07 | `0b347f93` |
| `PS-016` | `library/locator-parser.spec.ts` | should parse owner | 2026-10-07 | `ee0a3d35` |
| `PS-017` | `library/locator-parser.spec.ts` | should parse describe | 2026-10-07 | `1eaf232f` |
| `PS-018` | `library/locator-parser.spec.ts` | should parse deeply nested locators | 2026-10-07 | `26812650` |
| `PS-019` | `library/locator-parser.spec.ts` | should parse generated locators | 2026-10-07 | `cf7394a7` |
| `PS-020` | `library/locator-parser.spec.ts` | should parse javascript string escapes | 2026-10-07 | `af39b0db` |
| `PS-021` | `library/locator-parser.spec.ts` | should parse python string escapes | 2026-10-07 | `3af43039` |
| `PS-022` | `library/locator-parser.spec.ts` | should parse java string escapes | 2026-10-07 | `c128585f` |
| `PS-023` | `library/locator-parser.spec.ts` | should parse csharp string escapes | 2026-10-07 | `731e4414` |
| `PS-024` | `library/locator-parser.spec.ts` | should parse javascript regular expressions | 2026-10-07 | `3ce1a324` |
| `PS-025` | `library/locator-parser.spec.ts` | should parse python regular expressions | 2026-10-07 | `9bd02e3a` |
| `PS-026` | `library/locator-parser.spec.ts` | should parse java regular expressions | 2026-10-07 | `9eced8ef` |
| `PS-027` | `library/locator-parser.spec.ts` | should parse csharp regular expressions | 2026-10-07 | `7062ff23` |
| `PS-028` | `library/locator-parser.spec.ts` | should parse csharp options with an explicit type | 2026-10-07 | `07680a83` |
| `PS-029` | `library/locator-parser.spec.ts` | should parse trailing commas | 2026-10-07 | `cecc0d0f` |
| `PS-030` | `library/locator-parser.spec.ts` | should parse unusual whitespace | 2026-10-07 | `ece09663` |
| `PS-031` | `library/locator-parser.spec.ts` | should return selectors as is | 2026-10-07 | `59e19d78` |
| `PS-032` | `library/locator-parser.spec.ts` | should reject malformed javascript locators | 2026-10-07 | `c3123c2c` |
| `PS-033` | `library/locator-parser.spec.ts` | should reject malformed python locators | 2026-10-07 | `c7f86434` |
| `PS-034` | `library/locator-parser.spec.ts` | should reject malformed java locators | 2026-10-07 | `cfb6d477` |
| `PS-035` | `library/locator-parser.spec.ts` | should reject malformed csharp locators | 2026-10-07 | `389d5404` |
| `PS-036` | `library/locator-parser.spec.ts` | should reject methods that the receiver does not have | 2026-10-07 | `bdd02228` |
| `PS-037` | `library/locator-parser.spec.ts` | should reject arguments of a wrong type or count | 2026-10-07 | `dcd681f8` |
| `PS-038` | `library/component-parser.spec.ts` | should parse | 2021-08-11 | `2c9c4519` |
| `PS-039` | `library/component-parser.spec.ts` | should parse short attributes | 2021-08-11 | `69deb8b9` |
| `PS-040` | `library/component-parser.spec.ts` | should parse all operators | 2021-08-11 | `cb9fc059` |
| `PS-041` | `library/component-parser.spec.ts` | should tolerate spacing | 2021-08-11 | `63dfc91b` |
| `PS-042` | `library/component-parser.spec.ts` | should escape | 2021-08-11 | `c5068681` |
| `PS-043` | `library/component-parser.spec.ts` | should parse int values | 2021-08-11 | `21184a9c` |
| `PS-044` | `library/component-parser.spec.ts` | should parse float values | 2021-08-11 | `330472fd` |
| `PS-045` | `library/component-parser.spec.ts` | should parse bool | 2023-10-05 | `432bea8d` |
| `PS-046` | `library/component-parser.spec.ts` | should parse regex | 2022-04-01 | `32785c3c` |
| `PS-047` | `library/component-parser.spec.ts` | should parse identifiers | 2022-04-01 | `c921dec7` |
| `PS-048` | `library/component-parser.spec.ts` | should parse unquoted string | 2023-10-05 | `3f8b5959` |
| `PS-049` | `library/component-parser.spec.ts` | should throw on malformed selector | 2022-03-23 | `090085b2` |
| `PS-050` | `library/css-parser.spec.ts` | should parse css | 2021-09-22 | `dc29b75e` |
| `PS-051` | `library/css-parser.spec.ts` | should throw on malformed css | 2025-01-15 | `876251c5` |

### QS — Query selector

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `QS-001` | `page/queryselector.spec.ts` | should throw for non-string selector | 2020-08-22 | `3ccc5bd4` |
| `QS-002` | `page/queryselector.spec.ts` | should query existing element with css selector @smoke | 2022-03-10 | `a0804ad8` |
| `QS-003` | `page/queryselector.spec.ts` | should query existing element with text selector | 2020-08-03 | `4c3c6864` |
| `QS-004` | `page/queryselector.spec.ts` | should query existing element with xpath selector | 2020-08-03 | `4808a019` |
| `QS-005` | `page/queryselector.spec.ts` | should return null for non-existing element | 2020-08-03 | `003dc374` |
| `QS-006` | `page/queryselector.spec.ts` | should auto-detect xpath selector | 2020-08-03 | `00d2113f` |
| `QS-007` | `page/queryselector.spec.ts` | should auto-detect xpath selector with starting parenthesis | 2020-08-03 | `4d976640` |
| `QS-008` | `page/queryselector.spec.ts` | should auto-detect xpath selector starting with .. | 2020-08-03 | `056cd0e3` |
| `QS-009` | `page/queryselector.spec.ts` | should auto-detect text selector | 2020-08-03 | `b114bcc2` |
| `QS-010` | `page/queryselector.spec.ts` | should auto-detect css selector | 2020-08-03 | `ae119151` |
| `QS-011` | `page/queryselector.spec.ts` | should support \>\> syntax | 2020-08-03 | `d8f0e952` |
| `QS-012` | `page/queryselector.spec.ts` | should query existing elements | 2020-08-03 | `ec25d352` |
| `QS-013` | `page/queryselector.spec.ts` | should return empty array if nothing is found | 2020-08-03 | `f618a701` |
| `QS-014` | `page/queryselector.spec.ts` | xpath should query existing element | 2020-08-03 | `9055e984` |
| `QS-015` | `page/queryselector.spec.ts` | xpath should return empty array for non-existing element | 2020-08-03 | `ac6553f0` |
| `QS-016` | `page/queryselector.spec.ts` | xpath should return multiple elements | 2020-08-03 | `e94c78ca` |
| `QS-017` | `page/queryselector.spec.ts` | $$ should work with bogus Array.from | 2020-09-14 | `8f981828` |

### RE — Retarget

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `RE-001` | `page/retarget.spec.ts` | element state checks should work as expected for label with zero-sized input | 2022-08-12 | `6a6be42f` |
| `RE-002` | `page/retarget.spec.ts` | should wait for enclosing disabled button | 2023-10-23 | `b8718134` |
| `RE-003` | `page/retarget.spec.ts` | should wait for enclosing button with a disabled fieldset | 2023-10-23 | `7e003275` |
| `RE-004` | `page/retarget.spec.ts` | should wait for enclosing enabled button | 2023-10-23 | `4f945de3` |
| `RE-005` | `page/retarget.spec.ts` | should check the box outside shadow dom label | 2022-08-12 | `50be4e2d` |
| `RE-006` | `page/retarget.spec.ts` | setInputFiles should work with label | 2023-10-23 | `6af121f2` |
| `RE-007` | `page/retarget.spec.ts` | enabled/disabled retargeting | 2025-01-07 | `d36877e3` |
| `RE-008` | `page/retarget.spec.ts` | visible/hidden retargeting | 2023-10-23 | `7cbbba1e` |
| `RE-009` | `page/retarget.spec.ts` | editable retargeting | 2023-10-23 | `04e3b9b6` |
| `RE-010` | `page/retarget.spec.ts` | input value retargeting | 2023-10-23 | `13188b3a` |
| `RE-011` | `page/retarget.spec.ts` | selection retargeting | 2024-04-01 | `e802dca9` |
| `RE-012` | `page/retarget.spec.ts` | select options retargeting | 2023-10-23 | `0f03f018` |
| `RE-013` | `page/retarget.spec.ts` | direct actions retargeting | 2022-08-12 | `8dfc3754` |
| `RE-014` | `page/retarget.spec.ts` | check retargeting | 2022-08-12 | `37b91fcd` |
| `RE-015` | `page/retarget.spec.ts` | should not retarget anchor into parent label | 2024-06-18 | `5b949051` |

### RO — Route

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `RO-001` | `page/page-route.spec.ts` | should intercept @smoke | 2023-06-02 | `a061e61e` |
| `RO-002` | `page/page-route.spec.ts` | should unroute | 2023-06-02 | `09f4c591` |
| `RO-003` | `page/page-route.spec.ts` | should not support ? in glob pattern | 2025-02-28 | `84811c5e` |
| `RO-004` | `page/page-route.spec.ts` | should work when POST is redirected with 302 | 2020-08-04 | `d40b2db4` |
| `RO-005` | `page/page-route.spec.ts` | should work when header manipulation headers with redirect | 2023-06-02 | `f28f5106` |
| `RO-006` | `page/page-route.spec.ts` | should be able to remove headers | 2023-06-02 | `3132339c` |
| `RO-007` | `page/page-route.spec.ts` | should contain referer header | 2023-06-02 | `21a7b1b0` |
| `RO-008` | `page/page-route.spec.ts` | should properly return navigation response when URL has cookies | 2024-06-20 | `c23b5b9f` |
| `RO-009` | `page/page-route.spec.ts` | should not override cookie header | 2025-03-20 | `c07f1301` |
| `RO-010` | `page/page-route.spec.ts` | should show custom HTTP headers | 2023-06-02 | `58c33e16` |
| `RO-011` | `page/page-route.spec.ts` | should work with redirect inside sync XHR | 2023-12-05 | `b0b31eef` |
| `RO-012` | `page/page-route.spec.ts` | should pause intercepted XHR until continue | 2021-05-13 | `c5658a6a` |
| `RO-013` | `page/page-route.spec.ts` | should pause intercepted fetch request until continue | 2020-11-19 | `96a6bc0e` |
| `RO-014` | `page/page-route.spec.ts` | should work with custom referer headers | 2026-09-08 | `425ed183` |
| `RO-015` | `page/page-route.spec.ts` | should be abortable | 2020-08-04 | `a96c8d33` |
| `RO-016` | `page/page-route.spec.ts` | should be abortable with custom error codes | 2024-09-27 | `d6ccf286` |
| `RO-017` | `page/page-route.spec.ts` | should not throw if request was cancelled by the page | 2023-12-15 | `e731baee` |
| `RO-018` | `page/page-route.spec.ts` | should send referer | 2020-08-04 | `87e95721` |
| `RO-019` | `page/page-route.spec.ts` | should fail navigation when aborting main resource | 2025-12-15 | `b1521845` |
| `RO-020` | `page/page-route.spec.ts` | should not work with redirects | 2023-06-02 | `ec28fee7` |
| `RO-021` | `page/page-route.spec.ts` | should chain fallback w/ dynamic URL | 2023-06-02 | `e31c9bf6` |
| `RO-022` | `page/page-route.spec.ts` | should work with redirects for subresources | 2023-06-02 | `8ce699a4` |
| `RO-023` | `page/page-route.spec.ts` | should work with equal requests | 2023-06-02 | `9890175d` |
| `RO-024` | `page/page-route.spec.ts` | should navigate to dataURL and not fire dataURL requests | 2023-06-02 | `a556f294` |
| `RO-025` | `page/page-route.spec.ts` | should be able to fetch dataURL and not fire dataURL requests | 2023-06-02 | `f30deca3` |
| `RO-026` | `page/page-route.spec.ts` | should navigate to URL with hash and and fire requests without hash | 2023-06-02 | `2120e364` |
| `RO-027` | `page/page-route.spec.ts` | should work with encoded server | 2020-08-04 | `a27cbde4` |
| `RO-028` | `page/page-route.spec.ts` | should work with badly encoded server | 2020-08-04 | `e3bb1929` |
| `RO-029` | `page/page-route.spec.ts` | should work with encoded server - 2 | 2025-09-11 | `27ded04e` |
| `RO-030` | `page/page-route.spec.ts` | should not throw "Invalid Interception Id" if the request was cancelled | 2023-06-02 | `3137e275` |
| `RO-031` | `page/page-route.spec.ts` | should intercept main resource during cross-process navigation | 2023-06-02 | `9196da1e` |
| `RO-032` | `page/page-route.spec.ts` | should fulfill with redirect status | 2021-05-13 | `f3bdd320` |
| `RO-033` | `page/page-route.spec.ts` | should not fulfill with redirect status | 2024-05-08 | `c6dc6c4a` |
| `RO-034` | `page/page-route.spec.ts` | should support cors with GET | 2025-10-03 | `1de9f942` |
| `RO-035` | `page/page-route.spec.ts` | should add Access-Control-Allow-Origin by default when fulfill | 2022-03-25 | `614446bc` |
| `RO-036` | `page/page-route.spec.ts` | should allow null origin for about:blank | 2022-04-01 | `c98e9ba4` |
| `RO-037` | `page/page-route.spec.ts` | should respect cors overrides | 2022-06-02 | `b9704664` |
| `RO-038` | `page/page-route.spec.ts` | should not auto-intercept non-preflight OPTIONS without network interception | 2025-06-30 | `904acb58` |
| `RO-039` | `page/page-route.spec.ts` | should not auto-intercept non-preflight OPTIONS with network interception | 2026-02-12 | `f662afbf` |
| `RO-040` | `page/page-route.spec.ts` | should support cors with POST | 2021-04-10 | `acebf2a1` |
| `RO-041` | `page/page-route.spec.ts` | should support cors with credentials | 2021-04-10 | `ccbd2049` |
| `RO-042` | `page/page-route.spec.ts` | should not abort preflighted cross-origin redirect when a route is registered | 2026-10-09 | `843b2327` |
| `RO-043` | `page/page-route.spec.ts` | should reject cors with disallowed credentials | 2020-08-28 | `ffa9745f` |
| `RO-044` | `page/page-route.spec.ts` | should support cors for different methods | 2021-04-10 | `550f1fc9` |
| `RO-045` | `page/page-route.spec.ts` | should support the times parameter with route matching | 2023-06-02 | `5302ef7d` |
| `RO-046` | `page/page-route.spec.ts` | should work if handler with times parameter was removed from another handler | 2023-11-29 | `b5f14a29` |
| `RO-047` | `page/page-route.spec.ts` | should support async handler w/ times | 2023-06-02 | `40b686cc` |
| `RO-048` | `page/page-route.spec.ts` | route abort with times: 1 should not affect second sequential fetch | 2026-09-25 | `7c2cb122` |
| `RO-049` | `page/page-route.spec.ts` | should contain raw request header | 2023-06-02 | `4d9bcb5b` |
| `RO-050` | `page/page-route.spec.ts` | should contain sec-fetch headers in route | 2026-09-10 | `1454acaf` |
| `RO-051` | `page/page-route.spec.ts` | should contain raw response header | 2023-06-02 | `09e4c57b` |
| `RO-052` | `page/page-route.spec.ts` | should contain raw response header after fulfill | 2021-10-06 | `b1c17923` |
| `RO-053` | `page/page-route.spec.ts` | {route.fulfill, route.continue, route.fallback, route.abort} should throw if called twice *(4 copies)* | 2022-06-15 | `9ada9fb8` |
| `RO-054` | `page/page-route.spec.ts` | should intercept when postData is more than 1MB | 2026-05-13 | `7794fbf8` |
| `RO-055` | `page/page-route.spec.ts` | should be able to intercept every navigation to a page controlled by service worker | 2025-04-04 | `dc7f6a1e` |
| `RO-056` | `page/page-route.spec.ts` | should respect URLPattern ignoreCase | 2026-09-24 | `1445e70d` |
| `RO-057` | `page/page-request-continue.spec.ts` | should work | 2020-08-04 | `46b6b43b` |
| `RO-058` | `page/page-request-continue.spec.ts` | should amend HTTP headers | 2025-03-14 | `1fcc0359` |
| `RO-059` | `page/page-request-continue.spec.ts` | should not allow to override unsafe HTTP headers | 2026-01-13 | `b7cdb7fc` |
| `RO-060` | `page/page-request-continue.spec.ts` | should delete header with undefined value | 2023-06-02 | `11858a82` |
| `RO-061` | `page/page-request-continue.spec.ts` | should amend method | 2020-08-04 | `8683f492` |
| `RO-062` | `page/page-request-continue.spec.ts` | should override request url | 2023-06-02 | `4bc03533` |
| `RO-063` | `page/page-request-continue.spec.ts` | should not allow changing protocol when overriding url | 2023-12-05 | `5b54b8d6` |
| `RO-064` | `page/page-request-continue.spec.ts` | should not throw if request was cancelled by the page | 2026-05-06 | `8910380c` |
| `RO-065` | `page/page-request-continue.spec.ts` | should override method along with url | 2023-06-02 | `5f72b03e` |
| `RO-066` | `page/page-request-continue.spec.ts` | should amend method on main request | 2020-08-04 | `7998a03b` |
| `RO-067` | `page/page-request-continue.spec.ts` | post data › should amend post data | 2023-06-02 | `19a3b657` |
| `RO-068` | `page/page-request-continue.spec.ts` | post data › should compute content-length from post data | 2023-06-02 | `f04711bc` |
| `RO-069` | `page/page-request-continue.spec.ts` | post data › should amend method and post data | 2023-06-02 | `c9426dde` |
| `RO-070` | `page/page-request-continue.spec.ts` | post data › should amend utf8 post data | 2023-06-02 | `c92a2ba2` |
| `RO-071` | `page/page-request-continue.spec.ts` | post data › should amend longer post data | 2023-06-02 | `6cdf3a97` |
| `RO-072` | `page/page-request-continue.spec.ts` | post data › should amend binary post data | 2023-06-02 | `4d9ea676` |
| `RO-073` | `page/page-request-continue.spec.ts` | post data › should use content-type from original request | 2023-01-28 | `d063d4b2` |
| `RO-074` | `page/page-request-continue.spec.ts` | should work with Cross-Origin-Opener-Policy | 2025-12-10 | `fd8cae08` |
| `RO-075` | `page/page-request-continue.spec.ts` | should not delete the origin header | 2026-01-13 | `a749885d` |
| `RO-076` | `page/page-request-continue.spec.ts` | should continue preload link requests | 2026-01-13 | `49eee2da` |
| `RO-077` | `page/page-request-continue.spec.ts` | should respect set-cookie in redirect response | 2026-01-13 | `9be0a8ec` |
| `RO-078` | `page/page-request-continue.spec.ts` | continue should not propagate cookie override to redirects | 2025-03-20 | `e166eed0` |
| `RO-079` | `page/page-request-continue.spec.ts` | continue should not override cookie | 2025-03-21 | `09966637` |
| `RO-080` | `page/page-request-continue.spec.ts` | continue with headers should send fresh cookie from the browser cookie store | 2026-06-23 | `789b4c40` |
| `RO-081` | `page/page-request-continue.spec.ts` | continue with headers should send fresh cookie after a redirect | 2026-06-23 | `938181d2` |
| `RO-082` | `page/page-request-continue.spec.ts` | redirect after continue should be able to delete cookie | 2025-03-20 | `9f0d01e4` |
| `RO-083` | `page/page-request-continue.spec.ts` | continue should propagate headers to redirects | 2024-08-09 | `8db32c8d` |
| `RO-084` | `page/page-request-continue.spec.ts` | continue should drop content-length on redirects | 2025-05-27 | `5eda5dd4` |
| `RO-085` | `page/page-request-continue.spec.ts` | redirected requests should report overridden headers | 2024-08-09 | `57782fec` |
| `RO-086` | `page/page-request-continue.spec.ts` | continue should delete headers on redirects | 2024-08-09 | `f4ec425a` |
| `RO-087` | `page/page-request-continue.spec.ts` | propagate headers same origin redirect | 2025-03-20 | `8a94acbb` |
| `RO-088` | `page/page-request-continue.spec.ts` | propagate headers cross origin | 2024-10-07 | `94613609` |
| `RO-089` | `page/page-request-continue.spec.ts` | propagate headers cross origin redirect | 2025-03-20 | `0f3e0eec` |
| `RO-090` | `page/page-request-continue.spec.ts` | propagate headers cross origin redirect after interception | 2025-04-09 | `705c4558` |
| `RO-091` | `page/page-request-continue.spec.ts` | continue should pass on 307 cross-origin redirect | 2026-07-08 | `dfbcc413` |
| `RO-092` | `page/page-request-continue.spec.ts` | should intercept css variable with background url | 2023-06-02 | `58ecf3fc` |
| `RO-093` | `page/page-request-continue.spec.ts` | continue should not change multipart/form-data body | 2024-05-20 | `a7e6eee1` |
| `RO-094` | `page/page-request-continue.spec.ts` | should not forward Host header on cross-origin redirect | 2025-08-05 | `31781a2f` |
| `RO-095` | `page/page-request-continue.spec.ts` | postData should return empty string when overriding body with empty string | 2026-07-22 | `29cce3e1` |
| `RO-096` | `page/page-request-fulfill.spec.ts` | should work | 2023-06-02 | `9c4eccf1` |
| `RO-097` | `page/page-request-fulfill.spec.ts` | should work with buffer as body | 2023-06-02 | `a4a7703f` |
| `RO-098` | `page/page-request-fulfill.spec.ts` | should work with status code 422 | 2023-06-02 | `6cbebfe5` |
| `RO-099` | `page/page-request-fulfill.spec.ts` | should fulfill with unuassigned status codes | 2024-05-17 | `9c76c6ae` |
| `RO-100` | `page/page-request-fulfill.spec.ts` | should not throw if request was cancelled by the page | 2023-12-15 | `aabee3e8` |
| `RO-101` | `page/page-request-fulfill.spec.ts` | should allow mocking binary responses | 2023-06-02 | `b836d8bc` |
| `RO-102` | `page/page-request-fulfill.spec.ts` | should allow mocking svg with charset | 2024-06-20 | `07d3aca5` |
| `RO-103` | `page/page-request-fulfill.spec.ts` | should work with file path | 2023-02-08 | `48242af7` |
| `RO-104` | `page/page-request-fulfill.spec.ts` | should stringify intercepted request response headers | 2023-06-02 | `8b97f1b2` |
| `RO-105` | `page/page-request-fulfill.spec.ts` | should not modify the headers sent to the server | 2023-06-02 | `332c6397` |
| `RO-106` | `page/page-request-fulfill.spec.ts` | should include the origin header | 2023-06-02 | `5ccf93c3` |
| `RO-107` | `page/page-request-fulfill.spec.ts` | should fulfill with global fetch result | 2024-06-20 | `21065037` |
| `RO-108` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch result | 2024-06-20 | `53a0cc3d` |
| `RO-109` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch result and overrides | 2024-06-20 | `fadf3030` |
| `RO-110` | `page/page-request-fulfill.spec.ts` | should fetch original request and fulfill | 2024-06-20 | `758a2e3c` |
| `RO-111` | `page/page-request-fulfill.spec.ts` | should fulfill with multiple set-cookie | 2024-10-07 | `b25aa76b` |
| `RO-112` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch response that has multiple set-cookie | 2023-06-02 | `50c8a2e8` |
| `RO-113` | `page/page-request-fulfill.spec.ts` | headerValue should return set-cookie from intercepted response | 2023-06-02 | `5e0effa8` |
| `RO-114` | `page/page-request-fulfill.spec.ts` | should fulfill with har response | 2022-08-02 | `136a3698` |
| `RO-115` | `page/page-request-fulfill.spec.ts` | should fulfill preload link requests | 2023-06-02 | `097efa54` |
| `RO-116` | `page/page-request-fulfill.spec.ts` | should fulfill json | 2023-06-15 | `0cc3b9be` |
| `RO-117` | `page/page-request-fulfill.spec.ts` | should fulfill with gzip and readback | 2024-06-20 | `b991676f` |
| `RO-118` | `page/page-request-fulfill.spec.ts` | should not go to the network for fulfilled requests body | 2025-08-21 | `e74269db` |
| `RO-119` | `page/page-request-fulfill.spec.ts` | should return body for fulfilled responses | 2025-08-21 | `d71fdf27` |
| `RO-120` | `page/page-request-fallback.spec.ts` | should work | 2022-06-14 | `9e336028` |
| `RO-121` | `page/page-request-fallback.spec.ts` | should fall back | 2023-06-02 | `4863f757` |
| `RO-122` | `page/page-request-fallback.spec.ts` | should fall back async | 2023-06-02 | `e27782a0` |
| `RO-123` | `page/page-request-fallback.spec.ts` | should not chain fulfill | 2023-06-02 | `d583784d` |
| `RO-124` | `page/page-request-fallback.spec.ts` | should not chain abort | 2023-06-02 | `e90eb1d0` |
| `RO-125` | `page/page-request-fallback.spec.ts` | should fall back after exception | 2023-06-02 | `405afd26` |
| `RO-126` | `page/page-request-fallback.spec.ts` | should chain once | 2023-06-02 | `8b7608f6` |
| `RO-127` | `page/page-request-fallback.spec.ts` | should amend HTTP headers | 2023-06-02 | `638d73b9` |
| `RO-128` | `page/page-request-fallback.spec.ts` | should delete header with undefined value | 2023-06-02 | `ff09a267` |
| `RO-129` | `page/page-request-fallback.spec.ts` | should amend method | 2023-06-02 | `c5eef30e` |
| `RO-130` | `page/page-request-fallback.spec.ts` | should override request url | 2023-06-02 | `391ffb44` |
| `RO-131` | `page/page-request-fallback.spec.ts` | post data › should amend post data | 2023-06-02 | `451ebe4d` |
| `RO-132` | `page/page-request-fallback.spec.ts` | post data › should amend binary post data | 2023-06-02 | `a1e06b91` |
| `RO-133` | `page/page-request-fallback.spec.ts` | post data › should amend json post data | 2023-06-02 | `6dbc4c27` |
| `RO-134` | `page/page-request-intercept.spec.ts` | should fulfill intercepted response | 2024-06-20 | `e3dafd43` |
| `RO-135` | `page/page-request-intercept.spec.ts` | should fulfill response with empty body | 2024-06-20 | `a84c6c1a` |
| `RO-136` | `page/page-request-intercept.spec.ts` | should override with defaults when intercepted response not provided | 2024-06-20 | `e28f0a51` |
| `RO-137` | `page/page-request-intercept.spec.ts` | should fulfill with any response | 2024-06-20 | `f51abb22` |
| `RO-138` | `page/page-request-intercept.spec.ts` | should support fulfill after intercept | 2024-06-20 | `ca863e2b` |
| `RO-139` | `page/page-request-intercept.spec.ts` | should give access to the intercepted response | 2024-06-20 | `96208c75` |
| `RO-140` | `page/page-request-intercept.spec.ts` | should give access to the intercepted response body | 2024-06-20 | `835855f3` |
| `RO-141` | `page/page-request-intercept.spec.ts` | should intercept multipart/form-data request body | 2024-06-17 | `4993da1c` |
| `RO-142` | `page/page-request-intercept.spec.ts` | should fulfill intercepted response using alias | 2024-06-20 | `ebb87ef6` |
| `RO-143` | `page/page-request-intercept.spec.ts` | should support timeout option in route.fetch | 2025-06-05 | `8a97e592` |
| `RO-144` | `page/page-request-intercept.spec.ts` | should not follow redirects when maxRedirects is set to 0 in route.fetch | 2024-06-20 | `c659bfaf` |
| `RO-145` | `page/page-request-intercept.spec.ts` | should intercept with url override | 2024-06-20 | `c34f38b6` |
| `RO-146` | `page/page-request-intercept.spec.ts` | should intercept with post data override | 2024-06-20 | `17e56cd8` |
| `RO-147` | `page/page-request-intercept.spec.ts` | request.postData is not null when fetching FormData with a Blob | 2024-09-06 | `6051c2e4` |
| `RO-148` | `page/page-request-intercept.spec.ts` | should abort favicon requests if interception is enabled | 2024-11-18 | `17b73dc3` |
| `RO-149` | `page/page-request-gc.spec.ts` | should work | 2024-09-26 | `e7d9541b` |
| `RO-150` | `page/page-request-gc.spec.ts` | should collect element retained by locator hit-target interceptor after detach | 2026-07-13 | `2c4cc0b4` |
| `RO-151` | `page/interception.spec.ts` | should work with navigation @smoke | 2023-06-02 | `bfbe0002` |
| `RO-152` | `page/interception.spec.ts` | should intercept after a service worker | 2026-07-17 | `212eb9af` |
| `RO-153` | `page/interception.spec.ts` | should work with glob | 2026-07-08 | `face5068` |
| `RO-154` | `page/interception.spec.ts` | should throw on unbalanced glob braces | 2026-05-04 | `18ef580a` |
| `RO-155` | `page/interception.spec.ts` | should throw on page.route with invalid glob | 2026-05-04 | `ec509b5d` |
| `RO-156` | `page/interception.spec.ts` | should intercept by glob | 2025-02-28 | `99f5aab3` |
| `RO-157` | `page/interception.spec.ts` | should intercept network activity from worker | 2024-09-06 | `c8f6f1e0` |
| `RO-158` | `page/interception.spec.ts` | should intercept worker requests when enabled after worker creation | 2024-10-07 | `2fec8a54` |
| `RO-159` | `page/interception.spec.ts` | should intercept network activity from worker 2 | 2024-09-19 | `5e60f8a5` |
| `RO-160` | `page/interception.spec.ts` | should work with regular expression passed from a different context | 2023-06-02 | `e100d0d8` |
| `RO-161` | `page/interception.spec.ts` | should intercept every request matching a global regexp | 2026-06-26 | `48743277` |
| `RO-162` | `page/interception.spec.ts` | should not break remote worker importScripts | 2024-09-06 | `137f0fe5` |
| `RO-163` | `page/interception.spec.ts` | should disable memory cache when intercepting | 2023-12-01 | `25e1642a` |
| `RO-164` | `page/interception.spec.ts` | should intercept blob url requests | 2026-06-12 | `f546e8ce` |
| `RO-165` | `library/browsercontext-route.spec.ts` | should intercept | 2023-10-23 | `f55f02df` |
| `RO-166` | `library/browsercontext-route.spec.ts` | should unroute | 2023-10-23 | `b3385842` |
| `RO-167` | `library/browsercontext-route.spec.ts` | should yield to page.route | 2023-10-23 | `ad89b2c3` |
| `RO-168` | `library/browsercontext-route.spec.ts` | should fall back to context.route | 2023-10-23 | `0cd1f7e5` |
| `RO-169` | `library/browsercontext-route.spec.ts` | should support Set-Cookie header | 2024-05-30 | `0ba3d68c` |
| `RO-170` | `library/browsercontext-route.spec.ts` | should ignore secure Set-Cookie header for insecure requests | 2026-06-12 | `6b68bd87` |
| `RO-171` | `library/browsercontext-route.spec.ts` | should use Set-Cookie header in future requests | 2025-07-03 | `d67b4659` |
| `RO-172` | `library/browsercontext-route.spec.ts` | should work with ignoreHTTPSErrors | 2023-10-23 | `198fa81d` |
| `RO-173` | `library/browsercontext-route.spec.ts` | should support the times parameter with route matching | 2023-10-23 | `3b1f52ed` |
| `RO-174` | `library/browsercontext-route.spec.ts` | should work if handler with times parameter was removed from another handler | 2023-11-29 | `646e2f1d` |
| `RO-175` | `library/browsercontext-route.spec.ts` | should support async handler w/ times | 2023-06-02 | `4b0e616f` |
| `RO-176` | `library/browsercontext-route.spec.ts` | should overwrite post body with empty string | 2023-06-02 | `d9274ebc` |
| `RO-177` | `library/browsercontext-route.spec.ts` | should chain fallback | 2023-10-23 | `4a56ab1c` |
| `RO-178` | `library/browsercontext-route.spec.ts` | should chain fallback w/ dynamic URL | 2023-10-23 | `86eadccb` |
| `RO-179` | `library/browsercontext-route.spec.ts` | should not chain fulfill | 2023-10-23 | `15084f54` |
| `RO-180` | `library/browsercontext-route.spec.ts` | should not chain abort | 2023-06-02 | `37802328` |
| `RO-181` | `library/browsercontext-route.spec.ts` | should chain fallback into page | 2023-10-23 | `d2cc9acd` |
| `RO-182` | `library/browsercontext-route.spec.ts` | should fall back async | 2023-10-23 | `df1323a8` |
| `RO-183` | `library/browsercontext-route.spec.ts` | should bypass disk cache when context interception is enabled | 2026-06-08 | `98289d3e` |
| `RO-184` | `library/browsercontext-route.spec.ts` | should fulfill popup main request using alias | 2026-06-08 | `4b66d5ef` |
| `RO-185` | `library/browsercontext-route.spec.ts` | should respect URLPattern ignoreCase | 2026-09-24 | `b00b8c72` |
| `RO-186` | `library/unroute-behavior.spec.ts` | context.unroute should not wait for pending handlers to complete | 2023-12-15 | `6ad1f4b5` |
| `RO-187` | `library/unroute-behavior.spec.ts` | context.unrouteAll removes all handlers | 2023-12-15 | `912a8c63` |
| `RO-188` | `library/unroute-behavior.spec.ts` | context.unrouteAll should wait for pending handlers to complete | 2023-12-15 | `081e432b` |
| `RO-189` | `library/unroute-behavior.spec.ts` | context.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors | 2023-12-15 | `2b0f01a4` |
| `RO-190` | `library/unroute-behavior.spec.ts` | page.close should not wait for active route handlers on the owning context | 2023-12-15 | `6d5b97e4` |
| `RO-191` | `library/unroute-behavior.spec.ts` | context.close should not wait for active route handlers on the owned pages | 2023-12-15 | `fd6b5eaa` |
| `RO-192` | `library/unroute-behavior.spec.ts` | page.unroute should not wait for pending handlers to complete | 2023-12-15 | `a3ed7872` |
| `RO-193` | `library/unroute-behavior.spec.ts` | page.unrouteAll removes all routes | 2023-12-15 | `64f0942b` |
| `RO-194` | `library/unroute-behavior.spec.ts` | page.unrouteAll should wait for pending handlers to complete | 2023-12-15 | `8a9197dd` |
| `RO-195` | `library/unroute-behavior.spec.ts` | page.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors | 2023-12-15 | `fe414005` |
| `RO-196` | `library/unroute-behavior.spec.ts` | page.close does not wait for active route handlers | 2023-12-15 | `be4e4743` |
| `RO-197` | `library/unroute-behavior.spec.ts` | route.continue should not throw if page has been closed | 2023-12-15 | `f1b59d88` |
| `RO-198` | `library/unroute-behavior.spec.ts` | route.fallback should not throw if page has been closed | 2023-12-15 | `86d74408` |
| `RO-199` | `library/unroute-behavior.spec.ts` | route.fulfill should not throw if page has been closed | 2023-12-15 | `35334350` |
| `RO-200` | `library/unroute-behavior.spec.ts` | should not continue requests in flight (page) | 2025-07-08 | `7e45935e` |
| `RO-201` | `library/unroute-behavior.spec.ts` | should not continue requests in flight (context) | 2025-07-08 | `37f743e1` |

### SC — Screencast

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SC-001` | `library/screencast.spec.ts` | screencast.start delivers frames via onFrame callback | 2026-06-09 | `821f652d` |
| `SC-002` | `library/screencast.spec.ts` | applies backpressure while async onFrame callback is pending | 2026-07-23 | `2635de72` |
| `SC-003` | `library/screencast.spec.ts` | onFrame receives viewport size | 2026-06-09 | `313c5f32` |
| `SC-004` | `library/screencast.spec.ts` | start throws if screencast is already started | 2026-03-30 | `57d031e0` |
| `SC-005` | `library/screencast.spec.ts` | start allows restart with different options after stop | 2026-03-30 | `37e2a4b3` |
| `SC-006` | `library/screencast.spec.ts` | start returns a disposable that stops screencast | 2026-04-09 | `69fed471` |
| `SC-007` | `library/screencast.spec.ts` | start/stop twice without path creates two files in artifactsDir | 2026-04-09 | `13c9f6ca` |
| `SC-008` | `library/screencast.spec.ts` | start should work when recordVideo is set | 2026-07-21 | `98b71783` |
| `SC-009` | `library/screencast.spec.ts` | start should record video with the requested fps | 2026-09-17 | `110bde2b` |
| `SC-010` | `library/screencast.spec.ts` | start should throw on invalid fps | 2026-09-17 | `2929193c` |
| `SC-011` | `library/screencast.spec.ts` | start should fail when another recording is in progress | 2026-03-30 | `c2bba3b1` |
| `SC-012` | `library/screencast.spec.ts` | stop should not fail when no recording is in progress | 2026-03-30 | `cd8a8817` |
| `SC-013` | `library/screencast.spec.ts` | start should finish when page is closed | 2026-04-09 | `9b1e155c` |
| `SC-014` | `library/screencast.spec.ts` | empty video | 2026-08-26 | `01416a93` |
| `SC-015` | `library/screencast.spec.ts` | start dispose stops recording | 2026-04-09 | `7c08dece` |
| `SC-016` | `library/screencast-actions.spec.ts` | should show annotation on click | 2026-09-17 | `7191183d` |
| `SC-017` | `library/screencast-actions.spec.ts` | should render annotation styles | 2026-09-17 | `c5867d13` |
| `SC-018` | `library/screencast-actions.spec.ts` | should position title at {top-left, top, bottom-left, bottom, bottom-right} *(5 copies)* | 2026-03-31 | `3e27fd07` |
| `SC-019` | `library/screencast-actions.spec.ts` | should clear annotation after duration | 2026-09-17 | `80003306` |
| `SC-020` | `library/screencast-actions.spec.ts` | should annotate fill action | 2026-03-31 | `d5892d9e` |
| `SC-021` | `library/screencast-actions.spec.ts` | should stop showing actions after dispose | 2026-03-31 | `85290510` |
| `SC-022` | `library/screencast-actions.spec.ts` | should stop showing actions after hideActions | 2026-03-31 | `9f0c422a` |
| `SC-023` | `library/screencast-actions.spec.ts` | should render an action cursor that animates to the click point | 2026-05-19 | `a105aea9` |
| `SC-024` | `library/screencast-actions.spec.ts` | cursor moves between two pointer actions | 2026-05-19 | `4071f77d` |
| `SC-025` | `library/screencast-actions.spec.ts` | cursor: "none" suppresses the action cursor decoration | 2026-09-17 | `bbc727a8` |
| `SC-026` | `library/screencast-actions.spec.ts` | cursor stays at the last action point until hideActions | 2026-09-17 | `08e5785f` |
| `SC-027` | `library/screencast-actions.spec.ts` | should survive navigation | 2026-03-31 | `03f310cd` |
| `SC-028` | `library/screencast-overlay.spec.ts` | should add and remove overlay | 2026-03-28 | `61c85803` |
| `SC-029` | `library/screencast-overlay.spec.ts` | should add multiple overlays | 2026-03-28 | `a6d829cf` |
| `SC-030` | `library/screencast-overlay.spec.ts` | should hide and show overlays | 2026-03-28 | `59004d8b` |
| `SC-031` | `library/screencast-overlay.spec.ts` | should survive navigation | 2026-03-28 | `0412d2ce` |
| `SC-032` | `library/screencast-overlay.spec.ts` | should remove overlay and not restore after navigation | 2026-03-28 | `ca4a6537` |
| `SC-033` | `library/screencast-overlay.spec.ts` | should sanitize scripts from overlay html | 2026-03-28 | `63b4f4fe` |
| `SC-034` | `library/screencast-overlay.spec.ts` | should strip event handlers from overlay html | 2026-03-28 | `a663097d` |
| `SC-035` | `library/screencast-overlay.spec.ts` | should auto-remove overlay after timeout | 2026-03-28 | `20ff610d` |
| `SC-036` | `library/screencast-overlay.spec.ts` | should allow styles in overlay html | 2026-03-28 | `de9672a7` |
| `SC-037` | `library/screencast-overlay.spec.ts` | should show overlay above {dialog, popover} opened before it *(2 copies)* | 2026-09-09 | `7e54465d` |
| `SC-038` | `library/screencast-overlay.spec.ts` | should keep overlay above {dialog, popover} opened after it *(2 copies)* | 2026-09-09 | `4ecfcabc` |

### SE — Selectors

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SE-001` | `page/selectors-css.spec.ts` | should work with large DOM @smoke | 2022-03-10 | `58e3d374` |
| `SE-002` | `page/selectors-css.spec.ts` | should work for open shadow roots | 2023-10-23 | `e16b4ebd` |
| `SE-003` | `page/selectors-css.spec.ts` | should work with \> combinator and spaces | 2020-08-03 | `3d5552a7` |
| `SE-004` | `page/selectors-css.spec.ts` | should work with comma separated list | 2020-08-03 | `370f3413` |
| `SE-005` | `page/selectors-css.spec.ts` | should keep dom order with comma separated list | 2020-08-03 | `b8b9c628` |
| `SE-006` | `page/selectors-css.spec.ts` | should return multiple captures for the same node | 2021-07-27 | `ccbddf8c` |
| `SE-007` | `page/selectors-css.spec.ts` | should return multiple captures when going up the hierarchy | 2021-07-27 | `21267176` |
| `SE-008` | `page/selectors-css.spec.ts` | should work with comma separated list in various positions | 2020-12-10 | `49c45a70` |
| `SE-009` | `page/selectors-css.spec.ts` | should work with comma inside text | 2020-08-03 | `671a6c80` |
| `SE-010` | `page/selectors-css.spec.ts` | should work with attribute selectors | 2023-10-23 | `290d672a` |
| `SE-011` | `page/selectors-css.spec.ts` | should not match root after \>\> | 2020-09-02 | `246a763e` |
| `SE-012` | `page/selectors-css.spec.ts` | should work with numerical id | 2020-11-13 | `e9a5b971` |
| `SE-013` | `page/selectors-css.spec.ts` | should work with wrong-case id | 2020-12-05 | `27582dd1` |
| `SE-014` | `page/selectors-css.spec.ts` | should work with \* | 2023-10-23 | `d4eae08d` |
| `SE-015` | `page/selectors-css.spec.ts` | should work with :nth-child | 2020-12-01 | `e6894fd5` |
| `SE-016` | `page/selectors-css.spec.ts` | should work with :nth-child(of) notation with nested functions | 2023-11-07 | `714b3061` |
| `SE-017` | `page/selectors-css.spec.ts` | should work with :not | 2020-12-01 | `b494f8b4` |
| `SE-018` | `page/selectors-css.spec.ts` | should work with ~ | 2023-06-13 | `7869ec97` |
| `SE-019` | `page/selectors-css.spec.ts` | should work with + | 2023-06-13 | `e505f06b` |
| `SE-020` | `page/selectors-css.spec.ts` | should work with spaces in :nth-child and :not | 2020-12-18 | `3fae88c2` |
| `SE-021` | `page/selectors-css.spec.ts` | should work with :is | 2020-12-17 | `c83d10bb` |
| `SE-022` | `page/selectors-css.spec.ts` | should work with :has | 2021-01-19 | `2a41599a` |
| `SE-023` | `page/selectors-css.spec.ts` | should work with :scope | 2023-10-23 | `0548920b` |
| `SE-024` | `page/selectors-css.spec.ts` | should work with :scope and class | 2022-10-05 | `95fc405a` |
| `SE-025` | `page/selectors-css.spec.ts` | should absolutize relative selectors | 2023-03-30 | `939c4196` |
| `SE-026` | `page/selectors-css.spec.ts` | css on the handle should be relative | 2023-10-23 | `03417270` |
| `SE-027` | `page/selectors-css.spec.ts` | should use light DOM structure for child combinator with slotted content | 2025-10-10 | `30c74907` |
| `SE-028` | `page/selectors-text.spec.ts` | should work @smoke | 2023-09-11 | `cad3ff77` |
| `SE-029` | `page/selectors-text.spec.ts` | should work with :text | 2021-02-25 | `85f4837b` |
| `SE-030` | `page/selectors-text.spec.ts` | should support empty string | 2021-10-16 | `40e136ff` |
| `SE-031` | `page/selectors-text.spec.ts` | should work across nodes | 2021-03-03 | `abea79df` |
| `SE-032` | `page/selectors-text.spec.ts` | text-is() should ignore comments | 2024-12-13 | `4a3bbdba` |
| `SE-033` | `page/selectors-text.spec.ts` | should work with text nodes in quoted mode | 2021-03-03 | `6377fd6e` |
| `SE-034` | `page/selectors-text.spec.ts` | should clear caches | 2021-02-05 | `0bb3c68b` |
| `SE-035` | `page/selectors-text.spec.ts` | should work with :has-text | 2022-10-04 | `15d7696d` |
| `SE-036` | `page/selectors-text.spec.ts` | should work with large DOM | 2021-02-05 | `71e9ec6a` |
| `SE-037` | `page/selectors-text.spec.ts` | should be case sensitive if quotes are specified | 2022-03-30 | `6ca20810` |
| `SE-038` | `page/selectors-text.spec.ts` | should search for a substring without quotes | 2021-03-03 | `451caa7c` |
| `SE-039` | `page/selectors-text.spec.ts` | should skip head, script and style | 2020-08-03 | `87059fee` |
| `SE-040` | `page/selectors-text.spec.ts` | should match input\[type=button\|submit\|reset\] | 2026-06-26 | `8d1f9cf8` |
| `SE-041` | `page/selectors-text.spec.ts` | should work for open shadow roots | 2020-08-03 | `f6bc83c1` |
| `SE-042` | `page/selectors-text.spec.ts` | should prioritize light dom over shadow dom in the same parent | 2020-08-03 | `74bb127a` |
| `SE-043` | `page/selectors-text.spec.ts` | should waitForSelector with distributed elements | 2020-08-03 | `bb90dfd4` |
| `SE-044` | `page/selectors-text.spec.ts` | should match root after \>\> | 2020-09-02 | `46cdba22` |
| `SE-045` | `page/selectors-text.spec.ts` | should match root after \>\> with \* | 2020-12-17 | `c2d2c6d9` |
| `SE-046` | `page/selectors-text.spec.ts` | should work with leading and trailing spaces | 2022-01-03 | `5d61911d` |
| `SE-047` | `page/selectors-text.spec.ts` | should work with unpaired quotes when not at the start | 2022-03-30 | `f4005a52` |
| `SE-048` | `page/selectors-text.spec.ts` | should work with paired quotes in the middle of selector | 2022-08-27 | `d8f8d4cd` |
| `SE-049` | `page/selectors-text.spec.ts` | hasText and internal:text should match full node text in strict mode | 2022-10-21 | `ffc644c4` |
| `SE-050` | `page/selectors-role.spec.ts` | should detect roles | 2022-09-29 | `fe3a97da` |
| `SE-051` | `page/selectors-role.spec.ts` | should support selected | 2022-09-29 | `9873eae9` |
| `SE-052` | `page/selectors-role.spec.ts` | should support checked | 2022-09-29 | `840a2226` |
| `SE-053` | `page/selectors-role.spec.ts` | should support pressed | 2022-09-29 | `4caac3b1` |
| `SE-054` | `page/selectors-role.spec.ts` | should support expanded | 2022-11-21 | `2a4af439` |
| `SE-055` | `page/selectors-role.spec.ts` | should support disabled | 2025-06-24 | `032f5479` |
| `SE-056` | `page/selectors-role.spec.ts` | should inherit disabled from the ancestor | 2025-04-03 | `2b4dee09` |
| `SE-057` | `page/selectors-role.spec.ts` | should support disabled fieldset | 2025-03-06 | `3fb83a40` |
| `SE-058` | `page/selectors-role.spec.ts` | should support level | 2022-09-29 | `2ec9b9c8` |
| `SE-059` | `page/selectors-role.spec.ts` | should filter hidden, unless explicitly asked for | 2023-02-07 | `b7bdd918` |
| `SE-060` | `page/selectors-role.spec.ts` | should support name | 2022-11-11 | `ac71e2d4` |
| `SE-061` | `page/selectors-role.spec.ts` | should support option name with html whitespace | 2026-04-15 | `54979013` |
| `SE-062` | `page/selectors-role.spec.ts` | errors | 2026-07-15 | `3b0648b1` |
| `SE-063` | `page/selectors-role.spec.ts` | hidden with shadow dom slots | 2023-03-30 | `53f5a1ba` |
| `SE-064` | `page/selectors-role.spec.ts` | should support output accessible name | 2023-10-03 | `ee2fe68b` |
| `SE-065` | `page/selectors-role.spec.ts` | should not match scope by default | 2024-03-01 | `ba5b687d` |
| `SE-066` | `page/selectors-role.spec.ts` | should not match inert elements, unless explicitly asked for | 2026-10-08 | `ed1d2606` |
| `SE-067` | `page/selectors-role.spec.ts` | should not match elements outside of a modal dialog | 2026-10-08 | `8d031152` |
| `SE-068` | `page/selectors-role.spec.ts` | should match the topmost modal dialog | 2026-10-08 | `244574a4` |
| `SE-069` | `page/selectors-role.spec.ts` | should respect PLAYWRIGHT\_SKIP\_INERT\_CHECK | 2026-10-08 | `11a26cf6` |
| `SE-070` | `page/selectors-role.spec.ts` | should respect PLAYWRIGHT\_SKIP\_DIALOG\_CHECK | 2026-10-08 | `f2770dd5` |
| `SE-071` | `page/selectors-get-by.spec.ts` | getByTestId should work | 2022-09-30 | `d77869fc` |
| `SE-072` | `page/selectors-get-by.spec.ts` | getByTestId with custom testId should work | 2022-10-10 | `d9711409` |
| `SE-073` | `page/selectors-get-by.spec.ts` | getByTestId with comma-separated testIdAttributes should match any | 2026-05-14 | `b8829f4e` |
| `SE-074` | `page/selectors-get-by.spec.ts` | getByTestId should escape id | 2022-09-30 | `d524dc1a` |
| `SE-075` | `page/selectors-get-by.spec.ts` | getByTestId should work for regex | 2022-12-13 | `e9d319a1` |
| `SE-076` | `page/selectors-get-by.spec.ts` | getByText should work | 2022-10-06 | `4b93f243` |
| `SE-077` | `page/selectors-get-by.spec.ts` | getByLabel should work | 2022-10-04 | `688fbcc6` |
| `SE-078` | `page/selectors-get-by.spec.ts` | getByLabel should work with nested elements | 2022-10-05 | `a0de94df` |
| `SE-079` | `page/selectors-get-by.spec.ts` | getByLabel should work with multiply-labelled input | 2022-12-14 | `eeb802a5` |
| `SE-080` | `page/selectors-get-by.spec.ts` | getByLabel should work with ancestor label and multiple controls | 2022-12-14 | `305d6939` |
| `SE-081` | `page/selectors-get-by.spec.ts` | getByLabel should work with ancestor label and for | 2022-12-14 | `0ceaf1e3` |
| `SE-082` | `page/selectors-get-by.spec.ts` | getByLabel should work with aria-labelledby | 2022-12-14 | `d16972f1` |
| `SE-083` | `page/selectors-get-by.spec.ts` | getByLabel should prioritize aria-labelledby over native label | 2022-12-14 | `5a0e6a41` |
| `SE-084` | `page/selectors-get-by.spec.ts` | getByLabel should work with aria-label | 2022-12-27 | `2911112f` |
| `SE-085` | `page/selectors-get-by.spec.ts` | getByLabel should ignore empty aria-label | 2023-05-10 | `63ac937b` |
| `SE-086` | `page/selectors-get-by.spec.ts` | getByLabel should prioritize aria-labelledby over aria-label | 2022-12-27 | `b0513422` |
| `SE-087` | `page/selectors-get-by.spec.ts` | getByPlaceholder should work | 2022-10-04 | `90bd8258` |
| `SE-088` | `page/selectors-get-by.spec.ts` | getByAltText should work | 2022-09-30 | `5c120977` |
| `SE-089` | `page/selectors-get-by.spec.ts` | getByTitle should work | 2022-09-30 | `b3cafd20` |
| `SE-090` | `page/selectors-get-by.spec.ts` | getBy escaping | 2023-06-12 | `aa5c9a57` |
| `SE-091` | `page/selectors-get-by.spec.ts` | getByRole escaping | 2023-01-30 | `9698b5c2` |
| `SE-092` | `page/selectors-get-by.spec.ts` | getByRole should accept regexp with v flag | 2026-06-25 | `fa6de8de` |
| `SE-093` | `page/selectors-get-by.spec.ts` | getByRole with description | 2026-04-21 | `08df3896` |
| `SE-094` | `page/selectors-get-by.spec.ts` | getByRole with description via aria-describedby | 2026-04-21 | `66a105e5` |
| `SE-095` | `page/selectors-get-by.spec.ts` | getByRole with description via title fallback | 2026-04-21 | `70835793` |
| `SE-096` | `page/selectors-get-by.spec.ts` | getByRole with description whitespace normalization | 2026-04-21 | `e9d0cccd` |
| `SE-097` | `page/selectors-get-by.spec.ts` | locators should not be affected by global and sticky regex flags | 2026-09-22 | `06ade4b4` |
| `SE-098` | `page/selectors-frame.spec.ts` | should work for iframe @smoke | 2022-10-05 | `24e169d5` |
| `SE-099` | `page/selectors-frame.spec.ts` | should work for iframe (handle) | 2022-10-05 | `749b6ba4` |
| `SE-100` | `page/selectors-frame.spec.ts` | should work for nested iframe | 2022-10-05 | `7efbb7e3` |
| `SE-101` | `page/selectors-frame.spec.ts` | should work for nested iframe (handle) | 2022-10-05 | `ba260738` |
| `SE-102` | `page/selectors-frame.spec.ts` | should work for $ and $$ | 2022-10-05 | `a92cf253` |
| `SE-103` | `page/selectors-frame.spec.ts` | $ should not wait for frame | 2022-10-05 | `e2ec81c0` |
| `SE-104` | `page/selectors-frame.spec.ts` | $$ should not wait for frame | 2022-10-05 | `0346f873` |
| `SE-105` | `page/selectors-frame.spec.ts` | $eval should throw for missing frame | 2023-10-12 | `3f97950a` |
| `SE-106` | `page/selectors-frame.spec.ts` | $$eval should not throw for missing frame | 2026-07-03 | `95a7cf68` |
| `SE-107` | `page/selectors-frame.spec.ts` | should work for $ and $$ (handle) | 2022-10-05 | `dd4adc29` |
| `SE-108` | `page/selectors-frame.spec.ts` | should work for $eval | 2022-10-05 | `371f01ac` |
| `SE-109` | `page/selectors-frame.spec.ts` | should work for $eval (handle) | 2022-10-05 | `e27cb3fa` |
| `SE-110` | `page/selectors-frame.spec.ts` | should work for $$eval | 2022-10-05 | `45ef63eb` |
| `SE-111` | `page/selectors-frame.spec.ts` | should work for $$eval (handle) | 2022-10-05 | `272a1d5f` |
| `SE-112` | `page/selectors-frame.spec.ts` | should not allow dangling enter-frame | 2022-10-05 | `f376e72a` |
| `SE-113` | `page/selectors-frame.spec.ts` | should not allow leading enter-frame | 2022-10-05 | `33999615` |
| `SE-114` | `page/selectors-frame.spec.ts` | should not allow capturing before enter-frame | 2022-10-05 | `9e28c55d` |
| `SE-115` | `page/selectors-frame.spec.ts` | should capture after the enter-frame | 2022-10-05 | `b93a2102` |
| `SE-116` | `page/selectors-frame.spec.ts` | should click in lazy iframe | 2023-06-02 | `4c1be8f0` |
| `SE-117` | `page/selectors-frame.spec.ts` | waitFor should survive frame reattach | 2022-10-05 | `3ca6cfa0` |
| `SE-118` | `page/selectors-frame.spec.ts` | waitForSelector should survive frame reattach (handle) | 2022-10-05 | `7c410394` |
| `SE-119` | `page/selectors-frame.spec.ts` | waitForSelector should survive iframe navigation (handle) | 2023-06-02 | `97c7c34f` |
| `SE-120` | `page/selectors-frame.spec.ts` | click should survive frame reattach | 2022-10-05 | `15022b6e` |
| `SE-121` | `page/selectors-frame.spec.ts` | click should survive iframe navigation | 2023-06-02 | `91dfd25c` |
| `SE-122` | `page/selectors-frame.spec.ts` | click should survive navigation | 2021-11-05 | `75a06fc3` |
| `SE-123` | `page/selectors-frame.spec.ts` | should non work for non-frame | 2022-10-05 | `a53cff3f` |
| `SE-124` | `page/selectors-frame.spec.ts` | should match in a descendant frame | 2026-08-28 | `5dc55e80` |
| `SE-125` | `page/selectors-frame.spec.ts` | should match in a deeply nested frame | 2026-08-28 | `e8345e75` |
| `SE-126` | `page/selectors-frame.spec.ts` | should not match a chain across frames | 2026-08-28 | `f352e561` |
| `SE-127` | `page/selectors-frame.spec.ts` | should match multiple elements | 2026-08-28 | `058ea412` |
| `SE-128` | `page/selectors-frame.spec.ts` | should throw when matching elements in multiple frames | 2026-08-28 | `cf3b6dd5` |
| `SE-129` | `page/selectors-frame.spec.ts` | should not allow any-frame in the middle of a selector | 2026-08-28 | `107f4935` |
| `SE-130` | `page/selectors-frame.spec.ts` | should allow entering frames from any frame | 2026-08-28 | `721d048b` |
| `SE-131` | `page/selectors-frame.spec.ts` | should not allow any-frame after entering a frame | 2026-08-28 | `329d1c27` |
| `SE-132` | `page/selectors-frame.spec.ts` | should not allow dangling enter-frame after any-frame | 2026-08-28 | `71d698d6` |
| `SE-133` | `page/selectors-misc.spec.ts` | should work for open shadow roots | 2020-08-03 | `835aad13` |
| `SE-134` | `page/selectors-misc.spec.ts` | should click on links in shadow dom | 2022-08-02 | `0d108598` |
| `SE-135` | `page/selectors-misc.spec.ts` | should work with :visible | 2022-06-30 | `1f419e17` |
| `SE-136` | `page/selectors-misc.spec.ts` | should work with \>\> visible= | 2022-06-30 | `1b092d0d` |
| `SE-137` | `page/selectors-misc.spec.ts` | should work with \>\> visible=false | 2024-12-16 | `bee7f923` |
| `SE-138` | `page/selectors-misc.spec.ts` | should work with :nth-match | 2021-08-11 | `002fa02c` |
| `SE-139` | `page/selectors-misc.spec.ts` | should work with nth= | 2022-04-27 | `e9699619` |
| `SE-140` | `page/selectors-misc.spec.ts` | should work with strict mode and chaining | 2022-04-27 | `16c2185e` |
| `SE-141` | `page/selectors-misc.spec.ts` | should work with layout selectors | 2022-05-03 | `dc171bf4` |
| `SE-142` | `page/selectors-misc.spec.ts` | should escape the scope with \>\> | 2020-12-18 | `e663b8a9` |
| `SE-143` | `page/selectors-misc.spec.ts` | xpath should be relative | 2021-02-02 | `cbe3638e` |
| `SE-144` | `page/selectors-misc.spec.ts` | should work with pipe in xpath | 2021-11-15 | `f299624d` |
| `SE-145` | `page/selectors-misc.spec.ts` | should print original xpath in error | 2023-07-25 | `9c315f46` |
| `SE-146` | `page/selectors-misc.spec.ts` | data-testid on the handle should be relative | 2021-03-11 | `1e5e3481` |
| `SE-147` | `page/selectors-misc.spec.ts` | should properly determine visibility of display:contents elements | 2022-01-06 | `3384c09a` |
| `SE-148` | `page/selectors-misc.spec.ts` | should work with internal:has= | 2025-01-15 | `d5eb176b` |
| `SE-149` | `page/selectors-misc.spec.ts` | should work with internal:has-not= | 2023-04-05 | `9e43bc66` |
| `SE-150` | `page/selectors-misc.spec.ts` | should work with internal:and= | 2023-05-05 | `7d4d1923` |
| `SE-151` | `page/selectors-misc.spec.ts` | should work with internal:or= | 2023-03-22 | `b07f050e` |
| `SE-152` | `page/selectors-misc.spec.ts` | should work with internal:chain= | 2023-07-14 | `fb30dd75` |
| `SE-153` | `page/selectors-misc.spec.ts` | chaining should work with large DOM @smoke | 2022-04-27 | `8aa970ef` |
| `SE-154` | `page/selectors-register.spec.ts` | textContent should be atomic | 2025-08-07 | `79e97f9f` |
| `SE-155` | `page/selectors-register.spec.ts` | innerText should be atomic | 2025-08-07 | `e09fa251` |
| `SE-156` | `page/selectors-register.spec.ts` | innerHTML should be atomic | 2025-08-07 | `10c27e67` |
| `SE-157` | `page/selectors-register.spec.ts` | getAttribute should be atomic | 2025-08-07 | `b4adff94` |
| `SE-158` | `page/selectors-register.spec.ts` | isVisible should be atomic | 2025-08-07 | `b94a340d` |
| `SE-159` | `page/selectors-register.spec.ts` | should take java-style string | 2025-08-07 | `4abcdd23` |
| `SE-160` | `library/selectors-register.spec.ts` | should work | 2022-09-06 | `9e51cc9d` |
| `SE-161` | `library/selectors-register.spec.ts` | should work when registered on global | 2025-06-03 | `9cc0947f` |
| `SE-162` | `library/selectors-register.spec.ts` | should work with path | 2025-08-07 | `694f26f7` |
| `SE-163` | `library/selectors-register.spec.ts` | should work in main and isolated world | 2025-08-07 | `1e42859c` |
| `SE-164` | `library/selectors-register.spec.ts` | should handle errors | 2021-11-19 | `1db02532` |
| `SE-165` | `library/selectors-register.spec.ts` | should throw "already registered" error when registering | 2025-07-01 | `31bbbb83` |
| `SE-166` | `library/selectors-register.spec.ts` | should not rely on engines working from the root | 2025-08-07 | `52223af7` |
| `SE-167` | `library/selectors-register.spec.ts` | should throw a nice error if the selector returns a bad value | 2025-08-07 | `9c3f48b3` |

### SI — Signals

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SI-001` | `library/signals.spec.ts` | should close the browser when the node process closes | 2025-10-31 | `43d4bbff` |
| `SI-002` | `library/signals.spec.ts` | should remove temp dir on process.exit | 2023-07-24 | `f48fdd22` |
| `SI-003` | `library/signals.spec.ts` | signals › should report browser close signal 2 | 2024-09-27 | `739bbb4a` |
| `SI-004` | `library/signals.spec.ts` | signals › should close the browser on SIGINT | 2022-12-07 | `174b72b1` |
| `SI-005` | `library/signals.spec.ts` | signals › should close the browser on SIGTERM | 2022-12-07 | `25f3705a` |
| `SI-006` | `library/signals.spec.ts` | signals › should close the browser on SIGHUP | 2022-12-07 | `225cd2f5` |
| `SI-007` | `library/signals.spec.ts` | signals › should kill the browser on double SIGINT and remove temp dir | 2023-07-27 | `e7cb0185` |
| `SI-008` | `library/signals.spec.ts` | signals › should kill the browser on SIGINT + SIGTERM | 2023-07-27 | `e25b13b1` |
| `SI-009` | `library/signals.spec.ts` | signals › should kill the browser on SIGTERM + SIGINT | 2023-07-27 | `7308b134` |
| `SI-010` | `library/signals.spec.ts` | signals › should not prevent default SIGTERM handling after browser close | 2024-01-16 | `10a1f32d` |

### SL — Slow motion

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SL-001` | `library/slowmo.spec.ts` | slowMo › Page SlowMo check | 2020-08-28 | `e33655fa` |
| `SL-002` | `library/slowmo.spec.ts` | slowMo › Page SlowMo click | 2020-08-28 | `6d1a0a85` |
| `SL-003` | `library/slowmo.spec.ts` | slowMo › Page SlowMo dblclick | 2020-08-28 | `6aeafcba` |
| `SL-004` | `library/slowmo.spec.ts` | slowMo › Page SlowMo dispatchEvent | 2020-08-28 | `4139831a` |
| `SL-005` | `library/slowmo.spec.ts` | slowMo › Page SlowMo fill | 2020-08-28 | `c5674b03` |
| `SL-006` | `library/slowmo.spec.ts` | slowMo › Page SlowMo focus | 2020-08-28 | `7f122e68` |
| `SL-007` | `library/slowmo.spec.ts` | slowMo › Page SlowMo goto | 2020-08-28 | `3d68d902` |
| `SL-008` | `library/slowmo.spec.ts` | slowMo › Page SlowMo hover | 2020-08-28 | `821c68fd` |
| `SL-009` | `library/slowmo.spec.ts` | slowMo › Page SlowMo press | 2020-08-28 | `087ff952` |
| `SL-010` | `library/slowmo.spec.ts` | slowMo › Page SlowMo reload | 2020-08-28 | `5118bc49` |
| `SL-011` | `library/slowmo.spec.ts` | slowMo › Page SlowMo selectOption | 2020-08-28 | `dc9e1499` |
| `SL-012` | `library/slowmo.spec.ts` | slowMo › Page SlowMo setInputFiles | 2020-08-28 | `4464051e` |
| `SL-013` | `library/slowmo.spec.ts` | slowMo › Page SlowMo type | 2020-08-28 | `a963393e` |
| `SL-014` | `library/slowmo.spec.ts` | slowMo › Page SlowMo uncheck | 2020-08-28 | `6b6f6a8b` |
| `SL-015` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo check | 2020-08-28 | `6f898ec7` |
| `SL-016` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo click | 2020-08-28 | `5fcdf605` |
| `SL-017` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo dblclick | 2020-08-28 | `49c7380c` |
| `SL-018` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo dispatchEvent | 2020-08-28 | `eaf92aba` |
| `SL-019` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo fill | 2020-08-28 | `e9ba188d` |
| `SL-020` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo focus | 2020-08-28 | `317e1ebb` |
| `SL-021` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo goto | 2020-08-28 | `906697bc` |
| `SL-022` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo hover | 2020-08-28 | `f7757028` |
| `SL-023` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo press | 2020-08-28 | `3d4cfe92` |
| `SL-024` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo selectOption | 2020-08-28 | `1f40a8ac` |
| `SL-025` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo setInputFiles | 2020-08-28 | `de688360` |
| `SL-026` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo type | 2020-08-28 | `aec44752` |
| `SL-027` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo uncheck | 2020-08-28 | `b26dbda5` |
| `SL-028` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo check | 2020-08-28 | `8dc5d6a4` |
| `SL-029` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo click | 2020-08-28 | `d6f4c9f5` |
| `SL-030` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo dblclick | 2020-08-28 | `49861b40` |
| `SL-031` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo dispatchEvent | 2020-08-28 | `61069f21` |
| `SL-032` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo fill | 2020-08-28 | `f3a0fe3b` |
| `SL-033` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo focus | 2020-08-28 | `2b89f1da` |
| `SL-034` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo hover | 2020-08-28 | `4dae7d83` |
| `SL-035` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo press | 2020-08-28 | `215d1fcf` |
| `SL-036` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo selectOption | 2020-08-28 | `ed63f9e0` |
| `SL-037` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo setInputFiles | 2020-08-28 | `dbd80542` |
| `SL-038` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo type | 2020-08-28 | `4c8be207` |
| `SL-039` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo uncheck | 2020-08-28 | `8aa897d4` |

### SM — Strict mode

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SM-001` | `page/page-strict.spec.ts` | should fail page.textContent in strict mode | 2022-11-04 | `31fe4218` |
| `SM-002` | `page/page-strict.spec.ts` | should fail page.getAttribute in strict mode | 2021-07-27 | `69d3ebdc` |
| `SM-003` | `page/page-strict.spec.ts` | should fail page.fill in strict mode | 2022-11-10 | `a0c95b4a` |
| `SM-004` | `page/page-strict.spec.ts` | should fail page.$ in strict mode | 2021-07-27 | `dfe6b220` |
| `SM-005` | `page/page-strict.spec.ts` | should fail page.waitForSelector in strict mode | 2021-07-27 | `ea7ca573` |
| `SM-006` | `page/page-strict.spec.ts` | should fail page.dispatchEvent in strict mode | 2022-11-04 | `934c21ad` |
| `SM-007` | `page/page-strict.spec.ts` | should properly format :nth-child() in strict mode message | 2022-04-25 | `a6f54048` |
| `SM-008` | `page/page-strict.spec.ts` | should escape class names | 2022-06-12 | `92dc93fc` |
| `SM-009` | `page/page-strict.spec.ts` | should escape tag names | 2023-08-23 | `71834335` |
| `SM-010` | `page/page-strict.spec.ts` | should keep the engine name for a "text=.." selector in strict mode | 2026-06-26 | `e8203f56` |
| `SM-011` | `library/browsercontext-strict.spec.ts` | should not fail page.textContent in non-strict mode | 2021-08-18 | `dce4dde8` |
| `SM-012` | `library/browsercontext-strict.spec.ts` | strict context mode › should fail page.textContent in strict mode | 2021-08-18 | `d7e6e170` |
| `SM-013` | `library/browsercontext-strict.spec.ts` | strict context mode › should fail page.click in strict mode | 2021-08-19 | `c62578cb` |
| `SM-014` | `library/browsercontext-strict.spec.ts` | strict context mode › should opt out of strict mode | 2021-08-18 | `da32eb5a` |

### SO — Select option

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SO-001` | `page/page-select-option.spec.ts` | should select single option @smoke | 2022-03-10 | `1953f29d` |
| `SO-002` | `page/page-select-option.spec.ts` | should select single option by value | 2020-08-11 | `aab47700` |
| `SO-003` | `page/page-select-option.spec.ts` | should fall back to selecting by label | 2022-12-07 | `c7b265b2` |
| `SO-004` | `page/page-select-option.spec.ts` | should select single option by label | 2020-08-11 | `54e6b482` |
| `SO-005` | `page/page-select-option.spec.ts` | should select single option by label with html whitespace | 2026-04-15 | `e79092d3` |
| `SO-006` | `page/page-select-option.spec.ts` | should select single option by handle | 2020-08-11 | `6a35c2fe` |
| `SO-007` | `page/page-select-option.spec.ts` | should select single option by index | 2020-08-11 | `0c447deb` |
| `SO-008` | `page/page-select-option.spec.ts` | should select single option by multiple attributes | 2020-08-11 | `5ba21eb0` |
| `SO-009` | `page/page-select-option.spec.ts` | should not select single option when some attributes do not match | 2022-06-30 | `b6a97151` |
| `SO-010` | `page/page-select-option.spec.ts` | should select only first option | 2020-08-11 | `8f8dfaf0` |
| `SO-011` | `page/page-select-option.spec.ts` | should not throw when select causes navigation | 2020-08-28 | `3423fe4c` |
| `SO-012` | `page/page-select-option.spec.ts` | should select multiple options | 2020-08-11 | `dc161f19` |
| `SO-013` | `page/page-select-option.spec.ts` | should select multiple options with attributes | 2020-08-11 | `0ac949a6` |
| `SO-014` | `page/page-select-option.spec.ts` | should respect event bubbling | 2020-08-11 | `d260747c` |
| `SO-015` | `page/page-select-option.spec.ts` | should throw when element is not a \<select\> | 2021-09-25 | `24e2e956` |
| `SO-016` | `page/page-select-option.spec.ts` | should return \[\] on no matched values | 2021-01-19 | `e4743bc6` |
| `SO-017` | `page/page-select-option.spec.ts` | should return an array of matched values | 2020-08-11 | `b1cfbb34` |
| `SO-018` | `page/page-select-option.spec.ts` | should return an array of one element when multiple is not set | 2020-08-04 | `0eee2e2f` |
| `SO-019` | `page/page-select-option.spec.ts` | should return \[\] on no values | 2020-08-04 | `a30c9190` |
| `SO-020` | `page/page-select-option.spec.ts` | should not allow null items | 2020-08-28 | `3985a1e9` |
| `SO-021` | `page/page-select-option.spec.ts` | should unselect with null | 2020-08-11 | `912cc62b` |
| `SO-022` | `page/page-select-option.spec.ts` | should deselect all options when passed no values for a multiple select | 2020-08-11 | `b90dbb81` |
| `SO-023` | `page/page-select-option.spec.ts` | should deselect all options when passed no values for a select without multiple | 2020-08-04 | `f7246843` |
| `SO-024` | `page/page-select-option.spec.ts` | should throw if passed wrong types | 2025-07-31 | `4d47c925` |
| `SO-025` | `page/page-select-option.spec.ts` | should work when re-defining top-level Event class | 2020-08-11 | `dc93a833` |
| `SO-026` | `page/page-select-option.spec.ts` | should wait for option to be present | 2023-06-02 | `0ed37f6a` |
| `SO-027` | `page/page-select-option.spec.ts` | should wait for option index to be present | 2023-06-02 | `d529373c` |
| `SO-028` | `page/page-select-option.spec.ts` | should wait for multiple options to be present | 2023-06-02 | `bb984e15` |
| `SO-029` | `page/page-select-option.spec.ts` | input event.composed should be true and cross shadow dom boundary | 2023-12-21 | `f9c568bb` |
| `SO-030` | `page/page-select-option.spec.ts` | should wait for select to be enabled | 2025-06-24 | `34dda187` |
| `SO-031` | `page/page-select-option.spec.ts` | should wait for option to be enabled | 2025-06-24 | `a476f62d` |
| `SO-032` | `page/page-select-option.spec.ts` | should wait for optgroup to be enabled | 2025-06-24 | `93680f21` |
| `SO-033` | `page/page-select-option.spec.ts` | should wait for select to be swapped | 2025-04-14 | `0904ed3f` |

### SQ — Sequence

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SQ-001` | `library/unit/sequence.spec.ts` | should return an empty array when the input is empty | 2024-10-22 | `22732f70` |
| `SQ-002` | `library/unit/sequence.spec.ts` | should handle a single-element array | 2024-10-22 | `c865e5cb` |
| `SQ-003` | `library/unit/sequence.spec.ts` | should handle an array with no repeats | 2024-10-22 | `825dcb7d` |
| `SQ-004` | `library/unit/sequence.spec.ts` | should handle contiguous repeats of single elements | 2024-10-22 | `15b23e8d` |
| `SQ-005` | `library/unit/sequence.spec.ts` | should detect longer repeating substrings | 2024-10-22 | `521c2ef6` |
| `SQ-006` | `library/unit/sequence.spec.ts` | should handle multiple repeating substrings | 2024-10-22 | `6506d783` |
| `SQ-007` | `library/unit/sequence.spec.ts` | should handle complex cases with overlapping repeats | 2024-10-22 | `e6add874` |
| `SQ-008` | `library/unit/sequence.spec.ts` | should handle complex acceptance cases with multiple possible repeats | 2024-10-22 | `08fd4f75` |
| `SQ-009` | `library/unit/sequence.spec.ts` | should handle non-repeating sequences correctly | 2024-10-22 | `d56ceea7` |
| `SQ-010` | `library/unit/sequence.spec.ts` | should handle a case where the entire array is a repeating sequence | 2024-10-22 | `2d80f270` |
| `SQ-011` | `library/unit/sequence.spec.ts` | should correctly identify the maximal repeating substring | 2024-10-22 | `e5a4dddf` |
| `SQ-012` | `library/unit/sequence.spec.ts` | should handle repeats with varying lengths | 2024-10-22 | `377b011e` |
| `SQ-013` | `library/unit/sequence.spec.ts` | should correctly handle a repeat count of one (k adjustment to zero) | 2024-10-22 | `0ac9af49` |
| `SQ-014` | `library/unit/sequence.spec.ts` | should correctly handle repeats at the end of the array | 2024-10-22 | `a55e08e3` |
| `SQ-015` | `library/unit/sequence.spec.ts` | should not overcount repeats when the last potential repeat is incomplete | 2024-10-22 | `3bedc1af` |
| `SQ-016` | `library/unit/sequence.spec.ts` | should handle single repeats correctly when the substring length is greater than one | 2024-10-22 | `263d5968` |

### SS — Screenshot

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `SS-001` | `page/page-screenshot.spec.ts` | page screenshot › should work @smoke | 2022-03-10 | `3b772266` |
| `SS-002` | `page/page-screenshot.spec.ts` | page screenshot › should not capture blinking caret by default | 2022-07-07 | `414d9551` |
| `SS-003` | `page/page-screenshot.spec.ts` | page screenshot › should capture blinking caret if explicitly asked for | 2023-01-28 | `a488fa70` |
| `SS-004` | `page/page-screenshot.spec.ts` | page screenshot › should capture blinking caret in shadow dom | 2022-08-26 | `38014f33` |
| `SS-005` | `page/page-screenshot.spec.ts` | page screenshot › should clip rect | 2020-10-06 | `1a2dac49` |
| `SS-006` | `page/page-screenshot.spec.ts` | page screenshot › should clip rect with fullPage | 2020-10-06 | `c3bf9519` |
| `SS-007` | `page/page-screenshot.spec.ts` | page screenshot › should clip elements to the viewport | 2020-10-06 | `cd0de227` |
| `SS-008` | `page/page-screenshot.spec.ts` | page screenshot › should throw on clip outside the viewport | 2020-09-29 | `329c5124` |
| `SS-009` | `page/page-screenshot.spec.ts` | page screenshot › should throw on a negative clip size | 2026-06-26 | `07888562` |
| `SS-010` | `page/page-screenshot.spec.ts` | page screenshot › should run in parallel | 2020-10-06 | `69d1076f` |
| `SS-011` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots | 2020-10-06 | `1e178b68` |
| `SS-012` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots and mask elements outside of it | 2024-05-14 | `5f961a46` |
| `SS-013` | `page/page-screenshot.spec.ts` | page screenshot › should restore viewport after fullPage screenshot | 2020-09-18 | `403154e6` |
| `SS-014` | `page/page-screenshot.spec.ts` | page screenshot › should allow transparency | 2025-12-15 | `de7f06e2` |
| `SS-015` | `page/page-screenshot.spec.ts` | page screenshot › should render white background on jpeg file | 2022-06-08 | `c9af1e14` |
| `SS-016` | `page/page-screenshot.spec.ts` | page screenshot › should produce a valid webp screenshot | 2026-07-17 | `d5fadaa0` |
| `SS-017` | `page/page-screenshot.spec.ts` | page screenshot › path option should detect webp | 2026-07-17 | `edc0b29a` |
| `SS-018` | `page/page-screenshot.spec.ts` | page screenshot › quality option should work for webp | 2026-07-17 | `0c2c89f1` |
| `SS-019` | `page/page-screenshot.spec.ts` | page screenshot › webp screenshots should be lossless by default | 2026-07-17 | `3e006042` |
| `SS-020` | `page/page-screenshot.spec.ts` | page screenshot › should allow transparency with webp | 2026-07-17 | `b670fda0` |
| `SS-021` | `page/page-screenshot.spec.ts` | page screenshot › quality option should throw for webp when out of range | 2026-07-14 | `58efffb3` |
| `SS-022` | `page/page-screenshot.spec.ts` | page screenshot › should work with odd clip size on Retina displays | 2026-06-12 | `aa8e5621` |
| `SS-023` | `page/page-screenshot.spec.ts` | page screenshot › should work for canvas | 2025-12-09 | `0a157bc7` |
| `SS-024` | `page/page-screenshot.spec.ts` | page screenshot › should capture canvas changes | 2025-12-09 | `8901f2f1` |
| `SS-025` | `page/page-screenshot.spec.ts` | page screenshot › should work for webgl | 2026-06-08 | `0c0c7f92` |
| `SS-026` | `page/page-screenshot.spec.ts` | page screenshot › should work for translateZ | 2020-10-06 | `ddb22206` |
| `SS-027` | `page/page-screenshot.spec.ts` | page screenshot › should work while navigating | 2020-08-28 | `ba40e8f3` |
| `SS-028` | `page/page-screenshot.spec.ts` | page screenshot › should work with iframe in shadow | 2020-10-06 | `89a14f91` |
| `SS-029` | `page/page-screenshot.spec.ts` | page screenshot › path option should work | 2021-04-05 | `fe49aa71` |
| `SS-030` | `page/page-screenshot.spec.ts` | page screenshot › path option should create subdirectories | 2021-04-05 | `e8b4e371` |
| `SS-031` | `page/page-screenshot.spec.ts` | page screenshot › path option should detect jpeg | 2026-10-13 | `d6f7ec8c` |
| `SS-032` | `page/page-screenshot.spec.ts` | page screenshot › path option should throw for unsupported mime type | 2020-09-18 | `c445975e` |
| `SS-033` | `page/page-screenshot.spec.ts` | page screenshot › quality option should throw for png | 2020-12-23 | `6740375a` |
| `SS-034` | `page/page-screenshot.spec.ts` | page screenshot › zero quality option should throw for png | 2020-12-23 | `355c65c7` |
| `SS-035` | `page/page-screenshot.spec.ts` | page screenshot › quality option should work for jpeg | 2026-03-19 | `860b9819` |
| `SS-036` | `page/page-screenshot.spec.ts` | page screenshot › should prefer type over extension | 2021-04-05 | `6ae5b7c6` |
| `SS-037` | `page/page-screenshot.spec.ts` | page screenshot › should not issue resize event | 2021-04-05 | `d3ad00ee` |
| `SS-038` | `page/page-screenshot.spec.ts` | page screenshot › should work with Array deleted | 2021-04-29 | `4280252a` |
| `SS-039` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots during navigation | 2026-06-26 | `13fb0c9b` |
| `SS-040` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work | 2022-02-15 | `4d36c5e9` |
| `SS-041` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work with locator | 2022-02-15 | `35119bb9` |
| `SS-042` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work with elementhandle | 2022-02-15 | `6dddca48` |
| `SS-043` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask multiple elements | 2022-02-15 | `1a276439` |
| `SS-044` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask inside iframe | 2022-02-15 | `1912921f` |
| `SS-045` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask in parallel | 2022-02-15 | `9d486eff` |
| `SS-046` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should remove mask after screenshot | 2022-02-15 | `afdbb7c8` |
| `SS-047` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when subframe has stalled navigation | 2022-03-15 | `ac26ed2d` |
| `SS-048` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when subframe used document.open after a weird url | 2022-03-31 | `a09c8ee7` |
| `SS-049` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when mask color is not pink #F0F | 2023-05-23 | `902cf03f` |
| `SS-050` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should hide elements based on attr | 2023-12-01 | `dc9f263d` |
| `SS-051` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should remove elements based on attr | 2023-12-01 | `d3d1ce38` |
| `SS-052` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture infinite css animation | 2022-03-04 | `ad1926bd` |
| `SS-053` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture pseudo element css animation | 2022-03-04 | `17718324` |
| `SS-054` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture css animations in shadow DOM | 2022-03-10 | `1bee43e3` |
| `SS-055` | `page/page-screenshot.spec.ts` | page screenshot animations › should stop animations that happen right before screenshot | 2022-11-07 | `8ff83ffc` |
| `SS-056` | `page/page-screenshot.spec.ts` | page screenshot animations › should resume infinite animations | 2022-12-30 | `ba852626` |
| `SS-057` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture infinite web animations | 2022-12-30 | `8675b2a3` |
| `SS-058` | `page/page-screenshot.spec.ts` | page screenshot animations › should fire transitionend for finite transitions | 2023-12-04 | `b1feafd2` |
| `SS-059` | `page/page-screenshot.spec.ts` | page screenshot animations › should capture screenshots after layoutchanges in transitionend event | 2025-03-25 | `c3e86b69` |
| `SS-060` | `page/page-screenshot.spec.ts` | page screenshot animations › should not change animation with playbackRate equal to 0 | 2022-03-10 | `94f4a113` |
| `SS-061` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for css transitions | 2022-03-04 | `feab0e4d` |
| `SS-062` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for INfinite css animation | 2022-03-04 | `fdd30539` |
| `SS-063` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for finite css animation | 2023-10-11 | `f9d74723` |
| `SS-064` | `page/page-screenshot.spec.ts` | page screenshot animations › should wait for fonts to load | 2023-12-16 | `76dc4d66` |
| `SS-065` | `page/page-screenshot.spec.ts` | should throw if screenshot size is too large | 2026-05-04 | `e4c56708` |
| `SS-066` | `page/page-screenshot.spec.ts` | page screenshot should capture css transform | 2026-06-12 | `22b24380` |
| `SS-067` | `page/page-screenshot.spec.ts` | should capture css box-shadow | 2026-06-12 | `d4cf6094` |
| `SS-068` | `library/screenshot.spec.ts` | page screenshot › should run in parallel in multiple pages | 2026-02-12 | `4633edf1` |
| `SS-069` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport | 2021-05-06 | `efe20a50` |
| `SS-070` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport and clip | 2026-02-12 | `565447eb` |
| `SS-071` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport and fullPage | 2021-05-06 | `6903f16b` |
| `SS-072` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor | 2022-12-30 | `8e0c57de` |
| `SS-073` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor and clip | 2022-03-10 | `74353036` |
| `SS-074` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor and scale:css | 2022-04-01 | `6a8faf25` |
| `SS-075` | `library/screenshot.spec.ts` | page screenshot › should produce screenshot of correct size with scale:css and null viewport | 2026-02-12 | `8e69ec8c` |
| `SS-076` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor, clip and scale:css | 2022-04-01 | `a42b4d6c` |
| `SS-077` | `library/screenshot.spec.ts` | page screenshot › should throw if screenshot size is too large with device scale factor | 2025-12-15 | `c1d3f781` |
| `SS-078` | `library/screenshot.spec.ts` | page screenshot › should work with large size | 2025-12-09 | `c10fae26` |
| `SS-079` | `library/screenshot.spec.ts` | page screenshot › should handle vh units  | 2021-11-30 | `283e4dc4` |
| `SS-080` | `library/screenshot.spec.ts` | page screenshot › should not hang when event loop is blocked | 2026-07-15 | `26fe4fcd` |
| `SS-081` | `library/screenshot.spec.ts` | element screenshot › element screenshot should work with a mobile viewport | 2025-12-15 | `aa1468e1` |
| `SS-082` | `library/screenshot.spec.ts` | element screenshot › element screenshot should work with device scale factor | 2025-12-15 | `1b6d7013` |
| `SS-083` | `library/screenshot.spec.ts` | element screenshot › should take screenshots when default viewport is null | 2021-05-06 | `7a29faf1` |
| `SS-084` | `library/screenshot.spec.ts` | element screenshot › should take fullPage screenshots when default viewport is null | 2021-05-06 | `264407f7` |
| `SS-085` | `library/screenshot.spec.ts` | element screenshot › should restore default viewport after fullPage screenshot | 2021-05-06 | `58e64b5b` |
| `SS-086` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after page screenshot and exception | 2021-05-06 | `6855c7a3` |
| `SS-087` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after page screenshot and timeout | 2021-05-06 | `3b30b375` |
| `SS-088` | `library/screenshot.spec.ts` | element screenshot › should take element screenshot when default viewport is null and restore back | 2021-05-06 | `310143bd` |
| `SS-089` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after element screenshot and exception | 2021-05-06 | `ec032de0` |
| `SS-090` | `library/screenshot.spec.ts` | element screenshot › element screenshots should handle vh units  | 2021-11-30 | `9f8ffd50` |
| `SS-091` | `library/screenshot.spec.ts` | element screenshot › should work if the main resource hangs | 2023-01-28 | `93368bfb` |
| `SS-092` | `library/screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport with device scale factor | 2022-03-10 | `418c4870` |
| `SS-093` | `library/screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport with device scale factor and scale:css | 2022-04-01 | `da93f432` |
| `SS-094` | `library/screenshot.spec.ts` | element screenshot › page screenshot should capture css transform with device pixels | 2023-08-18 | `adf363c1` |

### ST — Storage

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `ST-001` | `library/browsercontext-storage-state.spec.ts` | should capture local storage | 2024-03-13 | `51298ab0` |
| `ST-002` | `library/browsercontext-storage-state.spec.ts` | should set local storage | 2026-04-01 | `9d6df491` |
| `ST-003` | `library/browsercontext-storage-state.spec.ts` | should report good error if the url is not valid | 2025-07-24 | `2e058d2d` |
| `ST-004` | `library/browsercontext-storage-state.spec.ts` | should round-trip through the file | 2026-04-01 | `ca2811d6` |
| `ST-005` | `library/browsercontext-storage-state.spec.ts` | should round-trip OPFS | 2026-09-01 | `3cd4d402` |
| `ST-006` | `library/browsercontext-storage-state.spec.ts` | should capture cookies | 2021-10-07 | `ba18fc8a` |
| `ST-007` | `library/browsercontext-storage-state.spec.ts` | should not emit events about internal page | 2023-06-02 | `2a28c144` |
| `ST-008` | `library/browsercontext-storage-state.spec.ts` | should not restore localStorage twice | 2022-03-19 | `117fbf18` |
| `ST-009` | `library/browsercontext-storage-state.spec.ts` | should handle missing file | 2022-03-24 | `5469a25f` |
| `ST-010` | `library/browsercontext-storage-state.spec.ts` | should handle malformed file | 2024-10-25 | `ae3d5ef7` |
| `ST-011` | `library/browsercontext-storage-state.spec.ts` | should serialize storageState with lone surrogates | 2024-01-29 | `1d9e9e4f` |
| `ST-012` | `library/browsercontext-storage-state.spec.ts` | should work when service worker is intefering | 2024-06-20 | `aae2caab` |
| `ST-013` | `library/browsercontext-storage-state.spec.ts` | should work when service worker is intefering and the origin is not open | 2026-09-14 | `a6f87532` |
| `ST-014` | `library/browsercontext-storage-state.spec.ts` | should set local storage in third-party context | 2024-09-20 | `c00901e2` |
| `ST-015` | `library/browsercontext-storage-state.spec.ts` | should roundtrip local storage in third-party context | 2024-09-20 | `6c3e879f` |
| `ST-016` | `library/browsercontext-storage-state.spec.ts` | should support IndexedDB | 2026-01-27 | `3fe1a98c` |
| `ST-017` | `library/browsercontext-storage-state.spec.ts` | should roundtrip IndexedDB values and keys with {newContext, setStorageState} *(2 copies)* | 2026-10-15 | `2b48ece8` |
| `ST-018` | `library/browsercontext-storage-state.spec.ts` | should support empty indexedDB | 2025-04-28 | `551e15b5` |
| `ST-019` | `library/browsercontext-storage-state.spec.ts` | should not leave IndexedDB connections open | 2026-08-15 | `c0b1ddda` |
| `ST-020` | `library/browsercontext-storage-state.spec.ts` | should round-trip WebAuthn credentials with storageState | 2026-06-19 | `95526e61` |
| `ST-021` | `library/browsercontext-storage-state.spec.ts` | setStorageState should replace credentials | 2026-06-19 | `9409b0a7` |
| `ST-022` | `library/browsercontext-storage-state.spec.ts` | setStorageState should handle missing file | 2026-01-27 | `d4f639bb` |
| `ST-023` | `page/page-localstorage.spec.ts` | localStorage.items returns empty array on fresh origin | 2026-05-14 | `b37e1cda` |
| `ST-024` | `page/page-localstorage.spec.ts` | localStorage.getItem returns null for missing key | 2026-05-14 | `16ab7aba` |
| `ST-025` | `page/page-localstorage.spec.ts` | localStorage.setItem persists and surfaces in items()/getItem() | 2026-05-14 | `8f7ed10b` |
| `ST-026` | `page/page-localstorage.spec.ts` | localStorage.setItem overwrites existing value | 2026-05-14 | `d0b3e46e` |
| `ST-027` | `page/page-localstorage.spec.ts` | localStorage.removeItem removes a single item | 2026-05-14 | `0ad4f054` |
| `ST-028` | `page/page-localstorage.spec.ts` | localStorage.clear empties storage | 2026-05-14 | `5ba64d99` |
| `ST-029` | `page/page-localstorage.spec.ts` | sessionStorage round-trip | 2026-05-14 | `4b3425d0` |
| `ST-030` | `page/page-localstorage.spec.ts` | localStorage and sessionStorage are independent | 2026-05-14 | `22e6f0b8` |
| `ST-031` | `page/page-localstorage.spec.ts` | storage methods are scoped to the current origin | 2026-06-04 | `f4c10261` |
| `ST-032` | `page/page-cache-storage.spec.ts` | CacheStorage entry should survive page.reload() | 2026-07-16 | `1f76ce83` |

### TA — Tap

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `TA-001` | `library/tap.spec.ts` | should send all of the correct events @smoke | 2023-01-30 | `4b5f8d12` |
| `TA-002` | `library/tap.spec.ts` | trial run should not tap | 2022-03-09 | `3f122fa6` |
| `TA-003` | `library/tap.spec.ts` | should not send mouse events touchstart is canceled | 2021-04-30 | `5d6a733c` |
| `TA-004` | `library/tap.spec.ts` | should not send mouse events when touchend is canceled | 2021-04-30 | `bfbf673a` |
| `TA-005` | `library/tap.spec.ts` | should not wait for a navigation caused by a tap | 2024-07-18 | `9b3d0b7b` |
| `TA-006` | `library/tap.spec.ts` | should work with modifiers | 2021-04-30 | `addb5cd0` |
| `TA-007` | `library/tap.spec.ts` | should send well formed touch points | 2021-04-30 | `ce953af0` |
| `TA-008` | `library/tap.spec.ts` | should wait until an element is visible to tap it | 2021-04-30 | `8f1c698d` |
| `TA-009` | `library/tap.spec.ts` | locators › should send all of the correct events | 2021-08-04 | `3730044a` |
| `TA-010` | `library/locator-dispatchevent-touch.spec.ts` | should support touch points in touch event arguments | 2026-04-28 | `b776387a` |

### TO — Timeout runner

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `TO-001` | `library/unit/timeout-runner.spec.ts` | raceAgainstDeadline should not emit TimeoutNegativeWarning for a passed deadline | 2026-08-26 | `49befc02` |

### TR — Tracing

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `TR-001` | `library/tracing.spec.ts` | should collect trace with resources, but no js | 2026-09-02 | `c95cbb06` |
| `TR-002` | `library/tracing.spec.ts` | should use the correct title for event driven callbacks | 2026-09-02 | `ae025ff4` |
| `TR-003` | `library/tracing.spec.ts` | should not store secrets in context options | 2026-10-08 | `96f9e6f7` |
| `TR-004` | `library/tracing.spec.ts` | should not collect snapshots by default | 2024-09-17 | `46646960` |
| `TR-005` | `library/tracing.spec.ts` | should not collect action screenshots and aria snapshots by default | 2026-08-09 | `bd01e69f` |
| `TR-006` | `library/tracing.spec.ts` | should collect action screenshots | 2026-08-11 | `6f3b1f29` |
| `TR-007` | `library/tracing.spec.ts` | should collect aria snapshots | 2026-08-11 | `c63d183b` |
| `TR-008` | `library/tracing.spec.ts` | can call tracing.group/groupEnd at any time and auto-close | 2025-05-19 | `e23106fa` |
| `TR-009` | `library/tracing.spec.ts` | should not include buffers in the trace | 2026-08-28 | `64a15517` |
| `TR-010` | `library/tracing.spec.ts` | should exclude internal pages | 2026-08-28 | `b441b67c` |
| `TR-011` | `library/tracing.spec.ts` | should record context API request trace independently | 2026-09-02 | `e42ffeb9` |
| `TR-012` | `library/tracing.spec.ts` | should collect two traces | 2026-09-02 | `6e7b1b7c` |
| `TR-013` | `library/tracing.spec.ts` | should respect tracesDir and name | 2026-09-02 | `e1df0566` |
| `TR-014` | `library/tracing.spec.ts` | should not include trace resources from the previous chunks | 2026-08-11 | `4fb2cd67` |
| `TR-015` | `library/tracing.spec.ts` | should overwrite existing file | 2023-05-05 | `9df46657` |
| `TR-016` | `library/tracing.spec.ts` | should collect sources | 2026-08-11 | `af9fe50d` |
| `TR-017` | `library/tracing.spec.ts` | should record network failures | 2026-08-11 | `f695ead6` |
| `TR-018` | `library/tracing.spec.ts` | should recover tracing after a failed stop | 2026-08-28 | `44bcf165` |
| `TR-019` | `library/tracing.spec.ts` | should release the stack session when saving the trace fails | 2026-08-28 | `9d822ee7` |
| `TR-020` | `library/tracing.spec.ts` | should not crash when browser closes mid-trace | 2023-07-27 | `41f5cdc4` |
| `TR-021` | `library/tracing.spec.ts` | should survive browser.close with auto-created traces dir | 2025-02-07 | `18df38c0` |
| `TR-022` | `library/tracing.spec.ts` | should not stall on dialogs | 2021-06-11 | `32ec442f` |
| `TR-023` | `library/tracing.spec.ts` | should produce screencast frames {fit, crop, scale} *(3 copies)* | 2026-08-11 | `ccb64785` |
| `TR-024` | `library/tracing.spec.ts` | should include interrupted actions | 2026-08-27 | `63bd9b0f` |
| `TR-025` | `library/tracing.spec.ts` | should throw when starting with different options | 2023-07-14 | `7804576e` |
| `TR-026` | `library/tracing.spec.ts` | should throw when stopping without start | 2024-09-17 | `1be3ca4e` |
| `TR-027` | `library/tracing.spec.ts` | should not throw when stopping without start but not exporting | 2021-09-01 | `e885a2a4` |
| `TR-028` | `library/tracing.spec.ts` | start should return a disposable that discards the trace | 2026-09-29 | `9987ac08` |
| `TR-029` | `library/tracing.spec.ts` | startChunk should return a disposable that discards the chunk | 2026-09-29 | `d75ae8f3` |
| `TR-030` | `library/tracing.spec.ts` | should work with multiple chunks | 2026-08-27 | `58a3181f` |
| `TR-031` | `library/tracing.spec.ts` | should export trace concurrently to second navigation | 2024-09-17 | `6f3ab16b` |
| `TR-032` | `library/tracing.spec.ts` | should not hang for clicks that open dialogs | 2026-01-30 | `686cde96` |
| `TR-033` | `library/tracing.spec.ts` | should ignore iframes in head | 2026-08-27 | `011cb6ff` |
| `TR-034` | `library/tracing.spec.ts` | should hide internal stack frames | 2025-05-19 | `86fd1ee7` |
| `TR-035` | `library/tracing.spec.ts` | should hide internal stack frames in expect | 2025-05-19 | `a26aa562` |
| `TR-036` | `library/tracing.spec.ts` | should record global request trace | 2026-04-13 | `6959b714` |
| `TR-037` | `library/tracing.spec.ts` | should store global request traces separately | 2026-04-13 | `ef6e5092` |
| `TR-038` | `library/tracing.spec.ts` | should store postData for global request | 2026-08-11 | `c66df470` |
| `TR-039` | `library/tracing.spec.ts` | should not flush console events | 2025-03-25 | `9ce53d71` |
| `TR-040` | `library/tracing.spec.ts` | should flush console events on tracing stop | 2025-03-25 | `6344d93c` |
| `TR-041` | `library/tracing.spec.ts` | should not emit after w/o before | 2026-05-10 | `14a271e5` |
| `TR-042` | `library/tracing.spec.ts` | should save trace while a WebSocket keeps streaming frames | 2026-06-19 | `15bdeedb` |
| `TR-043` | `library/chromium/tracing.spec.ts` | should output a trace | 2026-04-29 | `a15fc6ac` |
| `TR-044` | `library/chromium/tracing.spec.ts` | should create directories as needed | 2021-04-05 | `3519eb96` |
| `TR-045` | `library/chromium/tracing.spec.ts` | should run with custom categories if provided | 2025-07-09 | `c92cdbe8` |
| `TR-046` | `library/chromium/tracing.spec.ts` | should throw if tracing on two pages | 2021-04-05 | `a8a11857` |
| `TR-047` | `library/chromium/tracing.spec.ts` | should return a buffer | 2021-04-05 | `d4b5e441` |
| `TR-048` | `library/chromium/tracing.spec.ts` | should work without options | 2021-04-05 | `59c20049` |
| `TR-049` | `library/chromium/tracing.spec.ts` | should support a buffer without a path | 2025-12-10 | `f35d901f` |

### TV — Trace viewer

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `TV-001` | `library/trace-viewer.spec.ts` | should show empty trace viewer | 2025-10-07 | `74154bae` |
| `TV-002` | `library/trace-viewer.spec.ts` | should open two trace viewers | 2026-04-29 | `46074ada` |
| `TV-003` | `library/trace-viewer.spec.ts` | should open trace viewer on specific host | 2026-06-12 | `0c8b6d54` |
| `TV-004` | `library/trace-viewer.spec.ts` | should show tracing.group in the action list with location | 2026-02-25 | `086a6b5d` |
| `TV-005` | `library/trace-viewer.spec.ts` | should open simple trace viewer | 2026-08-27 | `b1b7ad1d` |
| `TV-006` | `library/trace-viewer.spec.ts` | should filter actions by text | 2026-05-12 | `e0351299` |
| `TV-007` | `library/trace-viewer.spec.ts` | should keep selected action in view after Show all | 2026-05-13 | `2123dfdf` |
| `TV-008` | `library/trace-viewer.spec.ts` | should activate Show all with keyboard | 2026-08-20 | `732d8973` |
| `TV-009` | `library/trace-viewer.spec.ts` | should open uncompressed trace directory | 2026-08-27 | `e09a9890` |
| `TV-010` | `library/trace-viewer.spec.ts` | should show action context on locators and other common actions | 2025-05-23 | `95e8dc35` |
| `TV-011` | `library/trace-viewer.spec.ts` | should complain about newer version of trace in old viewer | 2025-10-07 | `332e9470` |
| `TV-012` | `library/trace-viewer.spec.ts` | should properly synchronize local and remote time | 2025-10-07 | `00f10c95` |
| `TV-013` | `library/trace-viewer.spec.ts` | should contain action info | 2025-10-07 | `51192d92` |
| `TV-014` | `library/trace-viewer.spec.ts` | should render console | 2026-06-19 | `00533d26` |
| `TV-015` | `library/trace-viewer.spec.ts` | should show console source for multiple pages | 2026-06-19 | `2862407c` |
| `TV-016` | `library/trace-viewer.spec.ts` | should highlight console message on timeline on hover | 2026-05-22 | `f9aa04d1` |
| `TV-017` | `library/trace-viewer.spec.ts` | should open console errors on click | 2025-10-07 | `a5f8074e` |
| `TV-018` | `library/trace-viewer.spec.ts` | should open console errors with keyboard | 2026-08-20 | `d62b2cc6` |
| `TV-019` | `library/trace-viewer.spec.ts` | should show params and return value | 2026-10-15 | `88736129` |
| `TV-020` | `library/trace-viewer.spec.ts` | should show null as a param | 2025-10-20 | `1fe7f8d0` |
| `TV-021` | `library/trace-viewer.spec.ts` | should truncate long return values with ellipsis but copy full value | 2026-05-04 | `9cb213e1` |
| `TV-022` | `library/trace-viewer.spec.ts` | should have correct snapshot size | 2026-10-13 | `1b4c7ac6` |
| `TV-023` | `library/trace-viewer.spec.ts` | should have correct stack trace | 2025-10-07 | `184cde23` |
| `TV-024` | `library/trace-viewer.spec.ts` | should have network requests | 2026-06-29 | `6ee8f60b` |
| `TV-025` | `library/trace-viewer.spec.ts` | should attribute network requests to service workers | 2026-08-21 | `1515272a` |
| `TV-026` | `library/trace-viewer.spec.ts` | should highlight network request on timeline on hover | 2026-05-22 | `4580d3a9` |
| `TV-027` | `library/trace-viewer.spec.ts` | should filter network requests by resource type | 2025-05-23 | `3c056280` |
| `TV-028` | `library/trace-viewer.spec.ts` | should filter network requests by multiple resource types | 2026-03-09 | `c2d14901` |
| `TV-029` | `library/trace-viewer.spec.ts` | should show font preview | 2025-12-20 | `d03fd098` |
| `TV-030` | `library/trace-viewer.spec.ts` | should syntax highlight body | 2025-12-20 | `87ff0f13` |
| `TV-031` | `library/trace-viewer.spec.ts` | should filter network requests by url | 2026-09-01 | `0ee880b6` |
| `TV-032` | `library/trace-viewer.spec.ts` | should have network request overrides | 2026-04-03 | `0b68a20b` |
| `TV-033` | `library/trace-viewer.spec.ts` | should show canceled status for requests canceled by navigation | 2026-04-03 | `e15dd21b` |
| `TV-034` | `library/trace-viewer.spec.ts` | should have network request overrides 2 | 2026-06-29 | `aca5dfd1` |
| `TV-035` | `library/trace-viewer.spec.ts` | should filter network requests by websocket type | 2026-06-10 | `4908d526` |
| `TV-036` | `library/trace-viewer.spec.ts` | should show websocket messages | 2026-06-10 | `b0689a0e` |
| `TV-037` | `library/trace-viewer.spec.ts` | should show snapshot URL and copy button | 2025-10-20 | `b897cada` |
| `TV-038` | `library/trace-viewer.spec.ts` | should popup snapshot | 2025-10-09 | `32bfb78f` |
| `TV-039` | `library/trace-viewer.spec.ts` | should capture attribute mutations inside a popup window | 2026-06-11 | `09cfb959` |
| `TV-040` | `library/trace-viewer.spec.ts` | should capture iframe with sandbox attribute | 2025-05-22 | `320e0454` |
| `TV-041` | `library/trace-viewer.spec.ts` | should capture data-url svg iframe | 2025-05-22 | `f01f8f89` |
| `TV-042` | `library/trace-viewer.spec.ts` | should not let style text break out of the style element | 2026-08-27 | `cceb80d4` |
| `TV-043` | `library/trace-viewer.spec.ts` | should contain adopted style sheets | 2025-05-22 | `5072083a` |
| `TV-044` | `library/trace-viewer.spec.ts` | should work with adopted style sheets and replace/replaceSync | 2025-05-22 | `4a7cce67` |
| `TV-045` | `library/trace-viewer.spec.ts` | should work with adopted style sheets and all: unset | 2025-05-22 | `a7694994` |
| `TV-046` | `library/trace-viewer.spec.ts` | empty adopted style sheets should not prevent node refs | 2026-08-28 | `1f45a962` |
| `TV-047` | `library/trace-viewer.spec.ts` | should work with nesting CSS selectors | 2025-05-22 | `dac53bf4` |
| `TV-048` | `library/trace-viewer.spec.ts` | should restore scroll positions | 2025-05-22 | `51cd2d11` |
| `TV-049` | `library/trace-viewer.spec.ts` | should restore control values | 2025-05-22 | `811bd4b8` |
| `TV-050` | `library/trace-viewer.spec.ts` | should work with meta CSP | 2025-05-22 | `e15f7eae` |
| `TV-051` | `library/trace-viewer.spec.ts` | should handle multiple headers | 2025-05-22 | `482995de` |
| `TV-052` | `library/trace-viewer.spec.ts` | should handle src=blob | 2025-05-22 | `7542b5a8` |
| `TV-053` | `library/trace-viewer.spec.ts` | should handle file URIs | 2025-05-22 | `9c888953` |
| `TV-054` | `library/trace-viewer.spec.ts` | should preserve currentSrc | 2025-10-07 | `2901ae69` |
| `TV-055` | `library/trace-viewer.spec.ts` | should register custom elements | 2025-05-22 | `1880b54b` |
| `TV-056` | `library/trace-viewer.spec.ts` | should not treat synthetic shadow root as a shadow root | 2026-09-22 | `b593c6ab` |
| `TV-057` | `library/trace-viewer.spec.ts` | should highlight target elements | 2025-08-15 | `630ba81c` |
| `TV-058` | `library/trace-viewer.spec.ts` | should highlight target element in shadow dom | 2025-05-22 | `3b956ba5` |
| `TV-059` | `library/trace-viewer.spec.ts` | should highlight expect failure | 2025-05-22 | `3907e652` |
| `TV-060` | `library/trace-viewer.spec.ts` | should show action source | 2025-10-07 | `958daabc` |
| `TV-061` | `library/trace-viewer.spec.ts` | should follow redirects | 2025-05-22 | `85b5baa9` |
| `TV-062` | `library/trace-viewer.spec.ts` | should include metainfo | 2025-11-11 | `bc043ffa` |
| `TV-063` | `library/trace-viewer.spec.ts` | should open v6 trace file | 2025-10-07 | `be967a47` |
| `TV-064` | `library/trace-viewer.spec.ts` | should not crash with broken locator | 2023-03-23 | `1e0dbbf1` |
| `TV-065` | `library/trace-viewer.spec.ts` | should serve overridden request | 2025-05-22 | `70a671aa` |
| `TV-066` | `library/trace-viewer.spec.ts` | should display waitForLoadState even if did not wait for it | 2026-10-15 | `8c58aa98` |
| `TV-067` | `library/trace-viewer.spec.ts` | should display language-specific locators | 2026-03-27 | `788daa6f` |
| `TV-068` | `library/trace-viewer.spec.ts` | should pick locator | 2025-05-22 | `ec2b140f` |
| `TV-069` | `library/trace-viewer.spec.ts` | should generate aria snapshot with unaltered urls | 2025-11-24 | `53efdc86` |
| `TV-070` | `library/trace-viewer.spec.ts` | should update highlight when typing locator | 2025-05-22 | `685c477b` |
| `TV-071` | `library/trace-viewer.spec.ts` | should update highlight when typing snapshot | 2025-05-22 | `2a18bf99` |
| `TV-072` | `library/trace-viewer.spec.ts` | should open trace-1.31 | 2025-10-07 | `6e17ecac` |
| `TV-073` | `library/trace-viewer.spec.ts` | should open trace-1.37 | 2025-10-07 | `5bd0bcb3` |
| `TV-074` | `library/trace-viewer.spec.ts` | should prefer later resource request with the same method | 2025-05-22 | `5e22571e` |
| `TV-075` | `library/trace-viewer.spec.ts` | should ignore 304 responses | 2025-05-22 | `45301860` |
| `TV-076` | `library/trace-viewer.spec.ts` | should pick locator in iframe | 2026-04-01 | `ad3edec5` |
| `TV-077` | `library/trace-viewer.spec.ts` | should highlight locator in iframe while typing | 2025-05-22 | `9a135229` |
| `TV-078` | `library/trace-viewer.spec.ts` | should preserve noscript when javascript is disabled | 2025-10-07 | `97aa9846` |
| `TV-079` | `library/trace-viewer.spec.ts` | should remove noscript by default | 2025-10-07 | `65a38e5c` |
| `TV-080` | `library/trace-viewer.spec.ts` | should remove noscript when javaScriptEnabled is set to true | 2025-10-07 | `5d27754a` |
| `TV-081` | `library/trace-viewer.spec.ts` | should open snapshot in new browser context | 2025-10-09 | `3bf58418` |
| `TV-082` | `library/trace-viewer.spec.ts` | should show similar actions from legacy library-only trace | 2025-10-07 | `a3fe1e5a` |
| `TV-083` | `library/trace-viewer.spec.ts` | should show correct request start time | 2025-05-23 | `b389a53f` |
| `TV-084` | `library/trace-viewer.spec.ts` | should not record route actions | 2026-08-27 | `ed581a81` |
| `TV-085` | `library/trace-viewer.spec.ts` | should not record network actions | 2025-08-08 | `d89fd755` |
| `TV-086` | `library/trace-viewer.spec.ts` | should show baseURL in metadata pane | 2025-10-07 | `d21889fa` |
| `TV-087` | `library/trace-viewer.spec.ts` | should not leak recorders | 2025-10-07 | `4fcd1fa3` |
| `TV-088` | `library/trace-viewer.spec.ts` | should serve css without content-type | 2025-05-22 | `3e3c5f55` |
| `TV-089` | `library/trace-viewer.spec.ts` | canvas disabled title | 2025-05-22 | `7d16620c` |
| `TV-090` | `library/trace-viewer.spec.ts` | canvas clipping | 2025-05-22 | `ce86c1d4` |
| `TV-091` | `library/trace-viewer.spec.ts` | canvas clipping in iframe | 2025-05-22 | `a06667af` |
| `TV-092` | `library/trace-viewer.spec.ts` | should show only one pointer with multilevel iframes | 2026-03-22 | `1102eced` |
| `TV-093` | `library/trace-viewer.spec.ts` | should show a popover | 2025-05-22 | `a26b2b46` |
| `TV-094` | `library/trace-viewer.spec.ts` | should show a modal dialog | 2025-05-22 | `fd5a52e1` |
| `TV-095` | `library/trace-viewer.spec.ts` | should open settings dialog | 2025-10-07 | `f5996e67` |
| `TV-096` | `library/trace-viewer.spec.ts` | should toggle theme color | 2025-11-24 | `889fbc47` |
| `TV-097` | `library/trace-viewer.spec.ts` | should reflect system color scheme changes in document theme | 2025-11-24 | `98999c68` |
| `TV-098` | `library/trace-viewer.spec.ts` | should toggle canvas rendering | 2025-05-23 | `45aea4a4` |
| `TV-099` | `library/trace-viewer.spec.ts` | should display aria mode | 2026-08-13 | `45d42a0f` |
| `TV-100` | `library/trace-viewer.spec.ts` | should disable aria setting when there are no aria snapshots | 2026-08-27 | `928180ba` |
| `TV-101` | `library/trace-viewer.spec.ts` | should force aria mode when there are no dom snapshots | 2026-08-27 | `b4039b88` |
| `TV-102` | `library/trace-viewer.spec.ts` | should notify parent when ready to receive messages | 2026-08-28 | `4368a3c6` |
| `TV-103` | `library/trace-viewer.spec.ts` | should render blob trace received from opener | 2026-08-28 | `c7162968` |
| `TV-104` | `library/trace-viewer.spec.ts` | shouldn't render not-blob trace received from message | 2025-10-07 | `697c6ad5` |
| `TV-105` | `library/trace-viewer.spec.ts` | should not trip over complex urls in style tags | 2025-05-22 | `b064875d` |
| `TV-106` | `library/trace-viewer.spec.ts` | should render locator descriptions | 2026-04-01 | `ed7064d7` |
| `TV-107` | `library/trace-viewer.spec.ts` | should load trace from HTTP with progress indicator | 2025-10-07 | `cc579c47` |
| `TV-108` | `library/trace-viewer.spec.ts` | should filter actions | 2026-08-27 | `23df5dab` |
| `TV-109` | `library/trace-viewer.spec.ts` | should handle failed snapshots due to dialog | 2025-09-03 | `69878fbc` |
| `TV-110` | `library/trace-viewer.spec.ts` | should survive service worker restart | 2025-10-14 | `e52eb009` |
| `TV-111` | `library/trace-viewer.spec.ts` | should not navigate on anchor clicks | 2025-12-01 | `aca1889a` |
| `TV-112` | `library/trace-viewer.spec.ts` | should respect CSSOM changes | 2026-01-13 | `706ac68f` |
| `TV-113` | `library/trace-viewer.spec.ts` | should preserve custom doctype | 2025-12-03 | `ac386fd4` |
| `TV-114` | `library/trace-viewer.spec.ts` | should replace meta charset attr that specifies charset | 2025-12-03 | `8cee0ed8` |
| `TV-115` | `library/trace-viewer.spec.ts` | should replace meta content attr that specifies charset | 2025-12-03 | `fbf08933` |
| `TV-116` | `library/trace-viewer.spec.ts` | should drop meta http-equiv refresh during recording | 2026-04-08 | `aac528c3` |
| `TV-117` | `library/trace-viewer.spec.ts` | should neutralize meta http-equiv refresh during rendering | 2026-04-08 | `8d7e6dda` |
| `TV-118` | `library/trace-viewer.spec.ts` | snapshots should be served with a script-src policy | 2026-09-02 | `1551558b` |
| `TV-119` | `library/trace-viewer.spec.ts` | snapshot iframes should be sandboxed | 2026-04-08 | `6af8b7d8` |
| `TV-120` | `library/trace-viewer.spec.ts` | should capture iframe with srcdoc | 2025-12-03 | `484c38a0` |
| `TV-121` | `library/trace-viewer.spec.ts` | should render snapshots from the second chunk | 2026-06-12 | `49b74e12` |
| `TV-122` | `library/trace-viewer.spec.ts` | take trace paths via stdin | 2026-02-10 | `3d418d15` |
| `TV-123` | `library/snapshot-renderer.spec.ts` | snapshot renderer escapes attacker-controlled {callId, snapshotName} in script context *(2 copies)* | 2026-09-02 | `7734db31` |
| `TV-124` | `library/snapshot-renderer.spec.ts` | snapshot renderer nonces the bootstrap script | 2026-09-02 | `0775e46e` |
| `TV-125` | `library/snapshot-renderer.spec.ts` | snapshot renderer strips event handler attributes | 2026-05-07 | `57ed04bc` |
| `TV-126` | `library/snapshot-renderer.spec.ts` | snapshot renderer strips onclick attributes | 2026-05-07 | `04902b15` |
| `TV-127` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes iframe srcdoc | 2026-05-07 | `08ae3314` |
| `TV-128` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes iframe sandbox | 2026-05-07 | `8af79e80` |
| `TV-129` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes object data attribute | 2026-05-10 | `6b4b5d93` |
| `TV-130` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes embed src attribute | 2026-05-10 | `8db1a94c` |
| `TV-131` | `library/snapshot-renderer.spec.ts` | snapshot renderer handles case-insensitive iframe tag names | 2026-05-07 | `ba0baccd` |
| `TV-132` | `library/snapshot-renderer.spec.ts` | snapshot renderer drops unsafe tag names that smuggle attributes | 2026-09-17 | `1326eb10` |
| `TV-133` | `library/snapshot-renderer.spec.ts` | snapshot renderer still renders ordinary custom elements | 2026-09-17 | `aa8c9f06` |
| `TV-134` | `library/snapshot-renderer.spec.ts` | stripAnsiEscapes should not exhibit polynomial backtracking | 2026-05-11 | `d7991962` |
| `TV-135` | `library/snapshot-renderer.spec.ts` | stripAnsiEscapes handles common ANSI sequences after fix | 2026-05-11 | `b4a28693` |

### TZ — Timezone

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `TZ-001` | `library/browsercontext-timezone-id.spec.ts` | should work @smoke | 2026-02-26 | `b0f6e1b4` |
| `TZ-002` | `library/browsercontext-timezone-id.spec.ts` | should throw for invalid timezone IDs when creating pages | 2025-12-15 | `ab5ba25e` |
| `TZ-003` | `library/browsercontext-timezone-id.spec.ts` | should work for multiple pages sharing same process | 2020-08-03 | `dbb8e93e` |
| `TZ-004` | `library/browsercontext-timezone-id.spec.ts` | should not change default timezone in another context | 2020-08-28 | `a6c60ee6` |
| `TZ-005` | `library/browsercontext-timezone-id.spec.ts` | should affect Intl.DateTimeFormat().resolvedOptions().timeZone | 2023-11-01 | `9fb04c9f` |
| `TZ-006` | `library/browsercontext-timezone-id.spec.ts` | should propagate timezone to workers | 2026-07-22 | `7b332ed7` |

### UA — User agent

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `UA-001` | `library/browsercontext-user-agent.spec.ts` | should work | 2020-08-03 | `2ad88a94` |
| `UA-002` | `library/browsercontext-user-agent.spec.ts` | should work for subframes | 2020-09-18 | `35c51ac9` |
| `UA-003` | `library/browsercontext-user-agent.spec.ts` | should emulate device user-agent | 2020-08-26 | `da2823d9` |
| `UA-004` | `library/browsercontext-user-agent.spec.ts` | should make a copy of default options | 2020-08-03 | `87276adb` |
| `UA-005` | `library/browsercontext-user-agent.spec.ts` | custom user agent for download | 2023-06-02 | `0782dcbc` |
| `UA-006` | `library/browsercontext-user-agent.spec.ts` | should work for navigator.userAgentData and sec-ch-ua headers | 2024-01-25 | `715798ba` |

### VI — Video

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `VI-001` | `library/video.spec.ts` | screencast › should not have video by default | 2026-03-30 | `1a07efda` |
| `VI-002` | `library/video.spec.ts` | screencast › should not throw without recordVideo.dir | 2026-03-26 | `9c76506b` |
| `VI-003` | `library/video.spec.ts` | screencast › should capture static page | 2026-04-09 | `74adb52e` |
| `VI-004` | `library/video.spec.ts` | screencast › should pad a short frame to the video size | 2026-07-15 | `67e1751b` |
| `VI-005` | `library/video.spec.ts` | screencast › should continue recording main page after popup closes | 2026-04-09 | `9633b7d8` |
| `VI-006` | `library/video.spec.ts` | screencast › should expose video path | 2021-04-05 | `fa0a59d3` |
| `VI-007` | `library/video.spec.ts` | screencast › should delete video | 2026-04-09 | `2ec8adec` |
| `VI-008` | `library/video.spec.ts` | screencast › should expose video path blank page | 2021-04-05 | `00a9b456` |
| `VI-009` | `library/video.spec.ts` | screencast › should work with weird screen resolution | 2023-04-03 | `8642984a` |
| `VI-010` | `library/video.spec.ts` | screencast › should work with relative path for recordVideo.dir | 2023-09-15 | `a753270d` |
| `VI-011` | `library/video.spec.ts` | screencast › should expose video path blank popup | 2021-04-05 | `98c47b3d` |
| `VI-012` | `library/video.spec.ts` | screencast › should capture navigation | 2026-04-09 | `a4e7175a` |
| `VI-013` | `library/video.spec.ts` | screencast › should capture css transformation | 2026-04-09 | `c8097997` |
| `VI-014` | `library/video.spec.ts` | screencast › should work for popups | 2026-07-07 | `9708d364` |
| `VI-015` | `library/video.spec.ts` | screencast › should scale frames down to the requested size  | 2026-04-09 | `9f0bcc71` |
| `VI-016` | `library/video.spec.ts` | screencast › should use viewport scaled down to fit into 800x800 as default size | 2026-04-09 | `ca76c5a0` |
| `VI-017` | `library/video.spec.ts` | screencast › should be 800x450 by default | 2026-04-09 | `2c7f7774` |
| `VI-018` | `library/video.spec.ts` | screencast › should record video with the requested fps | 2026-09-17 | `18c87cc1` |
| `VI-019` | `library/video.spec.ts` | screencast › should throw on invalid fps | 2026-09-17 | `e4230f31` |
| `VI-020` | `library/video.spec.ts` | screencast › should be 800x600 with null viewport | 2026-07-07 | `154e3867` |
| `VI-021` | `library/video.spec.ts` | screencast › should capture static page in persistent context @smoke | 2026-04-09 | `bb21b2b8` |
| `VI-022` | `library/video.spec.ts` | screencast › should emulate an iphone | 2026-04-09 | `ccefdc67` |
| `VI-023` | `library/video.spec.ts` | screencast › should throw on browser close | 2026-04-09 | `66036ce0` |
| `VI-024` | `library/video.spec.ts` | screencast › should throw if browser dies | 2026-04-09 | `523bc793` |
| `VI-025` | `library/video.spec.ts` | screencast › should wait for video to finish if page was closed | 2026-04-09 | `5151a9a0` |
| `VI-026` | `library/video.spec.ts` | screencast › should close ffmpeg even if there were no frames | 2026-03-27 | `df583c92` |
| `VI-027` | `library/video.spec.ts` | screencast › should not create video for internal pages | 2026-04-09 | `45e64036` |
| `VI-028` | `library/video.spec.ts` | screencast › should capture full viewport | 2026-04-09 | `e1ecf6c8` |
| `VI-029` | `library/video.spec.ts` | screencast › should capture full viewport on hidpi | 2026-04-09 | `acc8d2d0` |
| `VI-030` | `library/video.spec.ts` | screencast › should work with video+trace | 2026-08-11 | `c6bfa16b` |
| `VI-031` | `library/video.spec.ts` | should saveAs video | 2026-04-09 | `4bb4e6f4` |

### VP — Viewport

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `VP-001` | `library/browsercontext-viewport.spec.ts` | should get the proper default viewport size | 2020-09-18 | `b6f328e5` |
| `VP-002` | `library/browsercontext-viewport.spec.ts` | should set the proper viewport size | 2022-06-08 | `6082f9d5` |
| `VP-003` | `library/browsercontext-viewport.spec.ts` | should return correct outerWidth and outerHeight | 2022-05-12 | `c49a63c9` |
| `VP-004` | `library/browsercontext-viewport.spec.ts` | landscape viewport should have width larger than height | 2025-01-30 | `3cf88087` |
| `VP-005` | `library/browsercontext-viewport.spec.ts` | should emulate device width | 2023-05-14 | `b5dbd31e` |
| `VP-006` | `library/browsercontext-viewport.spec.ts` | should emulate device height | 2023-05-14 | `ce8f054b` |
| `VP-007` | `library/browsercontext-viewport.spec.ts` | should emulate availWidth and availHeight | 2020-12-01 | `ea0f0eba` |
| `VP-008` | `library/browsercontext-viewport.spec.ts` | should not have touch by default | 2024-08-19 | `ff8be529` |
| `VP-009` | `library/browsercontext-viewport.spec.ts` | should throw on tap if hasTouch is not enabled | 2023-01-27 | `242f6090` |
| `VP-010` | `library/browsercontext-viewport.spec.ts` | should support touch with null viewport | 2021-04-03 | `291f4354` |
| `VP-011` | `library/browsercontext-viewport.spec.ts` | should keep touch emulation after screenshot beyond viewport | 2026-09-08 | `634487ed` |
| `VP-012` | `library/browsercontext-viewport.spec.ts` | should set both screen and viewport options | 2025-12-15 | `7a28578a` |
| `VP-013` | `library/browsercontext-viewport.spec.ts` | should report null viewportSize when given null viewport | 2021-04-03 | `ffbf73d0` |
| `VP-014` | `library/browsercontext-viewport.spec.ts` | should drag with high dpi | 2026-06-12 | `bb015c90` |
| `VP-015` | `library/browsercontext-viewport.spec.ts` | WebKit Windows headed should have a minimal viewport | 2023-05-14 | `33c2cce3` |
| `VP-016` | `library/browsercontext-viewport.spec.ts` | should be able to get correct orientation angle on non-mobile devices | 2023-06-23 | `56374496` |
| `VP-017` | `library/browsercontext-viewport.spec.ts` | should set window.screen.orientation.type for mobile devices | 2026-06-09 | `eba230c7` |

### WA — Wait for

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `WA-001` | `page/page-wait-for-function.spec.ts` | should timeout | 2020-08-14 | `18ff2e6c` |
| `WA-002` | `page/page-wait-for-function.spec.ts` | should accept a string | 2020-08-14 | `3638288f` |
| `WA-003` | `page/page-wait-for-function.spec.ts` | should work when resolved right before execution context disposal | 2020-08-14 | `066b6610` |
| `WA-004` | `page/page-wait-for-function.spec.ts` | should poll on interval | 2025-03-25 | `f0647ed7` |
| `WA-005` | `page/page-wait-for-function.spec.ts` | should avoid side effects after timeout | 2020-08-14 | `d27b0345` |
| `WA-006` | `page/page-wait-for-function.spec.ts` | should throw on polling:mutation | 2020-09-09 | `7c1f68a5` |
| `WA-007` | `page/page-wait-for-function.spec.ts` | should poll on raf | 2020-08-14 | `701b8492` |
| `WA-008` | `page/page-wait-for-function.spec.ts` | should fail with predicate throwing on first call | 2020-08-14 | `3f1cbae2` |
| `WA-009` | `page/page-wait-for-function.spec.ts` | should fail with predicate throwing sometimes | 2020-08-14 | `17bbb769` |
| `WA-010` | `page/page-wait-for-function.spec.ts` | should fail with ReferenceError on wrong page | 2020-08-14 | `1e93de35` |
| `WA-011` | `page/page-wait-for-function.spec.ts` | should work with strict CSP policy | 2025-08-12 | `a748b3a2` |
| `WA-012` | `page/page-wait-for-function.spec.ts` | should throw on bad polling value | 2020-09-09 | `5632fe5e` |
| `WA-013` | `page/page-wait-for-function.spec.ts` | should throw negative polling interval | 2020-08-14 | `67c0ccfa` |
| `WA-014` | `page/page-wait-for-function.spec.ts` | should return the success value as a JSHandle | 2020-08-03 | `688299ec` |
| `WA-015` | `page/page-wait-for-function.spec.ts` | should return the window as a success value | 2020-08-03 | `955e4463` |
| `WA-016` | `page/page-wait-for-function.spec.ts` | should accept ElementHandle arguments | 2020-08-03 | `e51ba8f5` |
| `WA-017` | `page/page-wait-for-function.spec.ts` | should respect timeout | 2020-08-03 | `dca39143` |
| `WA-018` | `page/page-wait-for-function.spec.ts` | should respect default timeout | 2020-08-03 | `59cf31e3` |
| `WA-019` | `page/page-wait-for-function.spec.ts` | should disable timeout when its set to 0 | 2020-08-28 | `984228ad` |
| `WA-020` | `page/page-wait-for-function.spec.ts` | should survive cross-process navigation | 2020-08-11 | `6dcf8610` |
| `WA-021` | `page/page-wait-for-function.spec.ts` | should survive navigations | 2020-08-11 | `790d0319` |
| `WA-022` | `page/page-wait-for-function.spec.ts` | should work with multiline body | 2020-08-14 | `eaf39516` |
| `WA-023` | `page/page-wait-for-function.spec.ts` | should wait for predicate with arguments | 2020-08-14 | `3cae6976` |
| `WA-024` | `page/page-wait-for-function.spec.ts` | should not be called after finishing successfully | 2020-09-14 | `8d95e5dc` |
| `WA-025` | `page/page-wait-for-function.spec.ts` | should not be called after finishing unsuccessfully | 2020-09-14 | `b98f049c` |
| `WA-026` | `page/page-wait-for-function.spec.ts` | should throw when frame is detached | 2021-11-03 | `00231bab` |
| `WA-027` | `page/page-wait-for-selector-1.spec.ts` | should throw on waitFor | 2023-10-23 | `b7c2cadd` |
| `WA-028` | `page/page-wait-for-selector-1.spec.ts` | should tolerate waitFor=visible | 2020-09-09 | `2adb3438` |
| `WA-029` | `page/page-wait-for-selector-1.spec.ts` | should immediately resolve promise if node exists | 2020-08-25 | `5008e42f` |
| `WA-030` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should immediately resolve if node exists | 2023-10-23 | `ae81e430` |
| `WA-031` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should wait | 2023-10-23 | `20b74060` |
| `WA-032` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should timeout | 2023-10-23 | `211e4944` |
| `WA-033` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should throw on navigation | 2023-10-23 | `bee907e3` |
| `WA-034` | `page/page-wait-for-selector-1.spec.ts` | should work with removed MutationObserver | 2023-10-23 | `c5fdc442` |
| `WA-035` | `page/page-wait-for-selector-1.spec.ts` | should resolve promise when node is added | 2020-08-25 | `231eaaa1` |
| `WA-036` | `page/page-wait-for-selector-1.spec.ts` | should report logs while waiting for visible | 2024-05-31 | `66df6669` |
| `WA-037` | `page/page-wait-for-selector-1.spec.ts` | should report logs while waiting for hidden | 2023-10-23 | `315488f8` |
| `WA-038` | `page/page-wait-for-selector-1.spec.ts` | should report logs when the selector resolves to multiple elements | 2022-12-24 | `a2462f87` |
| `WA-039` | `page/page-wait-for-selector-1.spec.ts` | should resolve promise when node is added in shadow dom | 2024-05-31 | `7fa3aae4` |
| `WA-040` | `page/page-wait-for-selector-1.spec.ts` | should work when node is added through innerHTML | 2023-10-23 | `42ae76f9` |
| `WA-041` | `page/page-wait-for-selector-1.spec.ts` | page.waitForSelector is shortcut for main frame | 2020-09-18 | `3cbdd661` |
| `WA-042` | `page/page-wait-for-selector-1.spec.ts` | should run in specified frame | 2020-09-18 | `b164c96e` |
| `WA-043` | `page/page-wait-for-selector-1.spec.ts` | should throw when frame is detached | 2023-10-23 | `a4dcc139` |
| `WA-044` | `page/page-wait-for-selector-2.spec.ts` | should survive cross-process navigation | 2020-08-03 | `3820687f` |
| `WA-045` | `page/page-wait-for-selector-2.spec.ts` | should wait for visible | 2023-10-23 | `1566c7fc` |
| `WA-046` | `page/page-wait-for-selector-2.spec.ts` | should not consider visible when zero-sized | 2023-10-23 | `5e4fd671` |
| `WA-047` | `page/page-wait-for-selector-2.spec.ts` | should wait for visible recursively | 2023-10-23 | `29f603d6` |
| `WA-048` | `page/page-wait-for-selector-2.spec.ts` | should consider outside of viewport visible | 2022-03-28 | `c3c36c33` |
| `WA-049` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for hidden | 2023-10-23 | `847d6f68` |
| `WA-050` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for display: none | 2023-10-23 | `c54e3d02` |
| `WA-051` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for removal | 2023-10-23 | `6dd59daf` |
| `WA-052` | `page/page-wait-for-selector-2.spec.ts` | should return null if waiting to hide non-existing element | 2020-08-03 | `697a824f` |
| `WA-053` | `page/page-wait-for-selector-2.spec.ts` | should respect timeout | 2023-10-23 | `cd382ed6` |
| `WA-054` | `page/page-wait-for-selector-2.spec.ts` | should have an error message specifically for awaiting an element to be hidden | 2023-10-23 | `d61d77ad` |
| `WA-055` | `page/page-wait-for-selector-2.spec.ts` | should respond to node attribute mutation | 2023-10-23 | `1a458dee` |
| `WA-056` | `page/page-wait-for-selector-2.spec.ts` | should return the element handle | 2020-08-03 | `75493657` |
| `WA-057` | `page/page-wait-for-selector-2.spec.ts` | should have correct stack trace for timeout | 2023-10-23 | `33a03668` |
| `WA-058` | `page/page-wait-for-selector-2.spec.ts` | should throw for unknown state option | 2020-09-09 | `74d7be8a` |
| `WA-059` | `page/page-wait-for-selector-2.spec.ts` | should throw for visibility option | 2020-09-09 | `7432eef9` |
| `WA-060` | `page/page-wait-for-selector-2.spec.ts` | should throw for true state option | 2020-09-09 | `a1a1f4f0` |
| `WA-061` | `page/page-wait-for-selector-2.spec.ts` | should throw for false state option | 2020-09-09 | `622992dd` |
| `WA-062` | `page/page-wait-for-selector-2.spec.ts` | should support \>\> selector syntax | 2023-10-23 | `b019e3df` |
| `WA-063` | `page/page-wait-for-selector-2.spec.ts` | should wait for detached if already detached | 2020-08-03 | `a447d4df` |
| `WA-064` | `page/page-wait-for-selector-2.spec.ts` | should wait for detached | 2020-08-03 | `72cefda3` |
| `WA-065` | `page/page-wait-for-selector-2.spec.ts` | should support some fancy xpath | 2020-08-03 | `54a4dd71` |
| `WA-066` | `page/page-wait-for-selector-2.spec.ts` | should respect timeout xpath | 2023-10-23 | `9cde6c0c` |
| `WA-067` | `page/page-wait-for-selector-2.spec.ts` | should run in specified frame xpath | 2020-09-18 | `bbee56b8` |
| `WA-068` | `page/page-wait-for-selector-2.spec.ts` | should throw when frame is detached xpath | 2023-10-23 | `1a70a6d8` |
| `WA-069` | `page/page-wait-for-selector-2.spec.ts` | should return the element handle xpath | 2020-08-03 | `3fb6eeab` |
| `WA-070` | `page/page-wait-for-selector-2.spec.ts` | should allow you to select an element with single slash xpath | 2020-08-03 | `672604d1` |
| `WA-071` | `page/page-wait-for-selector-2.spec.ts` | should correctly handle hidden shadow host | 2021-03-31 | `1f7d8018` |
| `WA-072` | `page/page-wait-for-selector-2.spec.ts` | should work when navigating before node adoption | 2021-06-03 | `bc923818` |
| `WA-073` | `page/page-wait-for-selector-2.spec.ts` | should fail when navigating while on handle | 2022-12-27 | `f52f81a8` |
| `WA-074` | `page/page-wait-for-selector-2.spec.ts` | should fail if element handle was detached while waiting | 2024-10-04 | `7da4ebe8` |
| `WA-075` | `page/page-wait-for-selector-2.spec.ts` | should succeed if element handle was detached while waiting for hidden | 2026-06-15 | `2e59fb3c` |
| `WA-076` | `page/page-wait-for-selector-2.spec.ts` | should succeed if element handle was detached while waiting for detached | 2026-06-15 | `cb68a4bf` |
| `WA-077` | `page/page-wait-for-load-state.spec.ts` | should pick up ongoing navigation | 2020-08-04 | `b843f3b4` |
| `WA-078` | `page/page-wait-for-load-state.spec.ts` | should respect timeout | 2021-06-28 | `c484805f` |
| `WA-079` | `page/page-wait-for-load-state.spec.ts` | should resolve immediately if loaded | 2020-08-04 | `9ba14f38` |
| `WA-080` | `page/page-wait-for-load-state.spec.ts` | should throw for bad state | 2021-11-02 | `6381d593` |
| `WA-081` | `page/page-wait-for-load-state.spec.ts` | should resolve immediately if load state matches | 2020-08-11 | `f659fdcf` |
| `WA-082` | `page/page-wait-for-load-state.spec.ts` | should work with pages that have loaded before being connected to | 2021-04-02 | `d6b40094` |
| `WA-083` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of empty url popup | 2026-03-16 | `edf64f4d` |
| `WA-084` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of about:blank popup  | 2021-04-02 | `7383daaa` |
| `WA-085` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of about:blank popup with noopener  | 2021-04-02 | `e54d15ff` |
| `WA-086` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of popup with network url  | 2021-04-02 | `68e2bd06` |
| `WA-087` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of popup with network url and noopener  | 2021-04-02 | `3d01e117` |
| `WA-088` | `page/page-wait-for-load-state.spec.ts` | should work with clicking target=\_blank | 2021-04-02 | `986373d5` |
| `WA-089` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of newPage | 2022-07-28 | `c270ae6f` |
| `WA-090` | `page/page-wait-for-load-state.spec.ts` | should resolve after popup load | 2021-03-23 | `9cbfa370` |
| `WA-091` | `page/page-wait-for-load-state.spec.ts` | should work for frame | 2023-06-02 | `bd29f990` |
| `WA-092` | `page/page-wait-for-load-state.spec.ts` | should work with javascript: iframe | 2022-04-26 | `e0147f49` |
| `WA-093` | `page/page-wait-for-load-state.spec.ts` | should work with broken data-url iframe | 2022-04-26 | `bae03e68` |
| `WA-094` | `page/page-wait-for-load-state.spec.ts` | should work with broken blob-url iframe | 2022-04-26 | `43841bf8` |
| `WA-095` | `page/page-wait-for-navigation.spec.ts` | should work | 2020-08-04 | `b98bd1c3` |
| `WA-096` | `page/page-wait-for-navigation.spec.ts` | should respect timeout | 2020-08-04 | `90ddd239` |
| `WA-097` | `page/page-wait-for-navigation.spec.ts` | should work with both domcontentloaded and load | 2020-08-04 | `0ced865c` |
| `WA-098` | `page/page-wait-for-navigation.spec.ts` | should work with commit | 2023-01-11 | `505da278` |
| `WA-099` | `page/page-wait-for-navigation.spec.ts` | should work with clicking on anchor links | 2020-08-04 | `710f3f06` |
| `WA-100` | `page/page-wait-for-navigation.spec.ts` | should work with clicking on links which do not commit navigation | 2025-09-09 | `1fc2fbb2` |
| `WA-101` | `page/page-wait-for-navigation.spec.ts` | should work with history.pushState() | 2020-08-04 | `a69a8165` |
| `WA-102` | `page/page-wait-for-navigation.spec.ts` | should work with history.replaceState() | 2020-08-04 | `4d0cc91b` |
| `WA-103` | `page/page-wait-for-navigation.spec.ts` | should work with DOM history.back()/history.forward() | 2020-08-04 | `823697d6` |
| `WA-104` | `page/page-wait-for-navigation.spec.ts` | should work when subframe issues window.stop() | 2022-11-07 | `241144e3` |
| `WA-105` | `page/page-wait-for-navigation.spec.ts` | should work with url match | 2020-08-04 | `bda11352` |
| `WA-106` | `page/page-wait-for-navigation.spec.ts` | should work with url match for same document navigations | 2020-08-04 | `dfe310e0` |
| `WA-107` | `page/page-wait-for-navigation.spec.ts` | should work for cross-process navigations | 2020-08-04 | `86b3d2e5` |
| `WA-108` | `page/page-wait-for-navigation.spec.ts` | should work on frame | 2020-08-04 | `b9bfa776` |
| `WA-109` | `page/page-wait-for-navigation.spec.ts` | should fail when frame detaches | 2025-03-25 | `b3e58649` |
| `WA-110` | `page/page-wait-for-url.spec.ts` | should work | 2021-03-31 | `ab51adf7` |
| `WA-111` | `page/page-wait-for-url.spec.ts` | should respect timeout | 2021-06-28 | `9a68fcb2` |
| `WA-112` | `page/page-wait-for-url.spec.ts` | should work with both domcontentloaded and load | 2021-03-31 | `0c52988b` |
| `WA-113` | `page/page-wait-for-url.spec.ts` | should work with commit | 2023-01-11 | `255f8683` |
| `WA-114` | `page/page-wait-for-url.spec.ts` | should work with commit and about:blank | 2021-11-02 | `12b5d0c3` |
| `WA-115` | `page/page-wait-for-url.spec.ts` | should work with clicking on anchor links | 2021-03-31 | `9cd59828` |
| `WA-116` | `page/page-wait-for-url.spec.ts` | should work with history.pushState() | 2021-03-31 | `b3085fb9` |
| `WA-117` | `page/page-wait-for-url.spec.ts` | should work with history.replaceState() | 2021-03-31 | `df7a5163` |
| `WA-118` | `page/page-wait-for-url.spec.ts` | should work with DOM history.back()/history.forward() | 2021-03-31 | `8b387e22` |
| `WA-119` | `page/page-wait-for-url.spec.ts` | should work with url match for same document navigations | 2021-03-31 | `74afa9ae` |
| `WA-120` | `page/page-wait-for-url.spec.ts` | should work on frame | 2021-03-31 | `c3bdd646` |
| `WA-121` | `page/page-wait-for-request.spec.ts` | should work | 2023-06-02 | `1b39f84d` |
| `WA-122` | `page/page-wait-for-request.spec.ts` | should work with predicate | 2023-06-02 | `3c22e4c6` |
| `WA-123` | `page/page-wait-for-request.spec.ts` | should respect timeout | 2022-01-06 | `91097650` |
| `WA-124` | `page/page-wait-for-request.spec.ts` | should respect default timeout | 2020-08-04 | `81ae4520` |
| `WA-125` | `page/page-wait-for-request.spec.ts` | should log the url | 2023-11-08 | `03f33ff8` |
| `WA-126` | `page/page-wait-for-request.spec.ts` | should work with no timeout | 2025-03-25 | `4ff35335` |
| `WA-127` | `page/page-wait-for-request.spec.ts` | should work with url match | 2023-06-02 | `cadefaac` |
| `WA-128` | `page/page-wait-for-request.spec.ts` | should work with url match regular expression from a different context | 2023-06-02 | `aa7b30d5` |
| `WA-129` | `page/page-wait-for-response.spec.ts` | should work | 2023-06-02 | `fcce2b57` |
| `WA-130` | `page/page-wait-for-response.spec.ts` | should respect timeout | 2020-08-04 | `eb09f3f0` |
| `WA-131` | `page/page-wait-for-response.spec.ts` | should respect default timeout | 2022-01-06 | `ca6e8729` |
| `WA-132` | `page/page-wait-for-response.spec.ts` | should log the url | 2022-06-30 | `5bdd9585` |
| `WA-133` | `page/page-wait-for-response.spec.ts` | should work with predicate | 2023-06-02 | `624e84a0` |
| `WA-134` | `page/page-wait-for-response.spec.ts` | should work with async predicate | 2023-06-02 | `98449d60` |
| `WA-135` | `page/page-wait-for-response.spec.ts` | sync predicate should be only called once | 2021-05-19 | `0bddfde2` |
| `WA-136` | `page/page-wait-for-response.spec.ts` | should work with no timeout | 2025-03-25 | `537ed744` |

### WM — WebMCP

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `WM-001` | `library/webmcp.spec.ts` | should list tools registered by the page | 2026-09-29 | `03c8ca18` |
| `WM-002` | `library/webmcp.spec.ts` | should report no tools when the page registers none | 2026-09-29 | `1d19abfc` |
| `WM-003` | `library/webmcp.spec.ts` | should call a tool | 2026-09-29 | `40c20661` |
| `WM-004` | `library/webmcp.spec.ts` | should return isError results as is | 2026-09-29 | `d41ea8dd` |
| `WM-005` | `library/webmcp.spec.ts` | should throw when the tool throws | 2026-10-02 | `98982bbc` |
| `WM-006` | `library/webmcp.spec.ts` | should throw for an unknown tool | 2026-09-29 | `e77e8395` |
| `WM-007` | `library/webmcp.spec.ts` | should time out when the tool does not settle | 2026-09-29 | `841f8b88` |
| `WM-008` | `library/webmcp.spec.ts` | should drop tools after navigation | 2026-09-29 | `6afa2323` |
| `WM-009` | `library/webmcp.spec.ts` | should list a tool registered after load | 2026-10-02 | `c0ac652b` |
| `WM-010` | `library/webmcp.spec.ts` | should list tools while a tool is running | 2026-10-02 | `6f4d6313` |
| `WM-011` | `library/webmcp.spec.ts` | should list declarative tools | 2026-09-29 | `56e4c888` |
| `WM-012` | `library/webmcp.spec.ts` | should scope tools to their frame | 2026-09-29 | `53592c2c` |
| `WM-013` | `library/webmcp.spec.ts` | should call same-name tools in their own frame | 2026-09-29 | `970aa0a8` |
| `WM-014` | `library/webmcp.spec.ts` | should list and call tools in cross-origin and nested frames | 2026-10-02 | `5febb88f` |
| `WM-015` | `library/webmcp-disabled.spec.ts` | should throw when the browser was launched without WebMCP | 2026-10-02 | `9483b923` |

### WO — Workers

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `WO-001` | `page/workers.spec.ts` | Page.workers @smoke | 2025-11-21 | `d9d4fccd` |
| `WO-002` | `page/workers.spec.ts` | should emit created and destroyed events | 2026-04-28 | `46c458f0` |
| `WO-003` | `page/workers.spec.ts` | should reject in-flight evaluate and emit close when page closes | 2026-10-08 | `198dde43` |
| `WO-004` | `page/workers.spec.ts` | should report console logs | 2020-11-10 | `4fab517c` |
| `WO-005` | `page/workers.spec.ts` | should have timestamp on worker console messages | 2026-06-15 | `51b7d3a2` |
| `WO-006` | `page/workers.spec.ts` | should not report console logs from workers twice | 2021-04-02 | `182186e8` |
| `WO-007` | `page/workers.spec.ts` | should have JSHandles for console logs | 2021-08-06 | `dd59680c` |
| `WO-008` | `page/workers.spec.ts` | should evaluate | 2025-11-21 | `bf42eb85` |
| `WO-009` | `page/workers.spec.ts` | should report console event on the worker | 2025-11-21 | `92818e25` |
| `WO-010` | `page/workers.spec.ts` | should report console event on the worker when not listening on page or context | 2025-11-21 | `6bf07869` |
| `WO-011` | `page/workers.spec.ts` | should report errors | 2020-08-11 | `11a08467` |
| `WO-012` | `page/workers.spec.ts` | should clear upon navigation | 2020-08-03 | `4c980476` |
| `WO-013` | `page/workers.spec.ts` | should clear upon cross-process navigation | 2020-08-03 | `b4987e97` |
| `WO-014` | `page/workers.spec.ts` | should attribute network activity for worker inside iframe to the iframe | 2026-06-08 | `68b3ffcb` |
| `WO-015` | `page/workers.spec.ts` | should report network activity | 2025-11-21 | `2a9b0844` |
| `WO-016` | `page/workers.spec.ts` | should report network activity on worker creation | 2023-05-12 | `5e6dd52d` |
| `WO-017` | `page/workers.spec.ts` | should report worker script as network request | 2025-04-23 | `c61b4005` |
| `WO-018` | `page/workers.spec.ts` | should report worker script as network request after redirect | 2025-04-23 | `100a117f` |
| `WO-019` | `page/workers.spec.ts` | should dispatch console messages when page has workers | 2022-08-04 | `f563d78d` |
| `WO-020` | `page/workers.spec.ts` | should report and intercept network from nested worker | 2025-11-21 | `8c371acd` |
| `WO-021` | `page/workers.spec.ts` | should support extra http headers | 2025-11-21 | `99670d8c` |
| `WO-022` | `page/workers.spec.ts` | should support offline | 2026-03-31 | `88dc0339` |
| `WO-023` | `page/workers.spec.ts` | should resolve worker script allHeaders in main frame | 2026-06-25 | `b2c04035` |
| `WO-024` | `page/workers.spec.ts` | should resolve worker script allHeaders in iframe | 2026-07-16 | `88253388` |
| `WO-025` | `page/workers.spec.ts` | should resolve worker script allHeaders in nested worker inside iframe | 2026-07-16 | `7d425c07` |
| `WO-026` | `library/shared-worker.spec.ts` | should survive shared worker restart | 2022-11-22 | `7d93e01d` |
| `WO-027` | `library/browsercontext-service-worker-policy.spec.ts` | should allow service workers by default | 2022-06-08 | `8ab5c5c9` |
| `WO-028` | `library/browsercontext-service-worker-policy.spec.ts` | should allow {literal, cache-only, network-fallback, preload-fallback} service worker navigation while offline *(4 copies)* | 2026-10-05 | `404cb574` |
| `WO-029` | `library/browsercontext-service-worker-policy.spec.ts` | block › blocks service worker registration | 2022-06-08 | `c9c32c52` |
| `WO-030` | `library/browsercontext-service-worker-policy.spec.ts` | block › should not throw error on about:blank | 2024-08-26 | `00c95363` |
| `WO-031` | `library/browsercontext-service-worker-policy.spec.ts` | block › should not throw error in opaque sandboxed iframe | 2026-10-05 | `4bb4462c` |

### WS — WebSocket

| ID | File | Title | Modified | Hash |
|---|---|---|---|---|
| `WS-001` | `library/web-socket.spec.ts` | should work @smoke | 2025-07-03 | `d7cd78d8` |
| `WS-002` | `library/web-socket.spec.ts` | should emit close events | 2025-07-03 | `75547389` |
| `WS-003` | `library/web-socket.spec.ts` | should emit frame events | 2025-07-03 | `2ef09c30` |
| `WS-004` | `library/web-socket.spec.ts` | should filter out the close events when the server closes with a message | 2025-07-03 | `32f6613d` |
| `WS-005` | `library/web-socket.spec.ts` | should pass self as argument to close event | 2025-07-03 | `50287877` |
| `WS-006` | `library/web-socket.spec.ts` | should emit binary frame events | 2025-07-03 | `786139bb` |
| `WS-007` | `library/web-socket.spec.ts` | should emit error | 2026-06-01 | `58fb4466` |
| `WS-008` | `library/web-socket.spec.ts` | should not have stray error events | 2025-07-03 | `1bcf20f0` |
| `WS-009` | `library/web-socket.spec.ts` | should reject waitForEvent on socket close | 2025-07-03 | `e61b1901` |
| `WS-010` | `library/web-socket.spec.ts` | should reject waitForEvent on page close | 2025-07-03 | `c0f60c1d` |
| `WS-011` | `library/web-socket.spec.ts` | should not tear down the page when a WebSocket is opened inside a worker | 2026-07-14 | `f2d193ea` |
| `WS-012` | `library/web-socket.spec.ts` | should turn off when offline | 2026-04-07 | `b3dba51f` |
| `WS-013` | `library/web-socket.spec.ts` | should send extra HTTP headers on WebSocket handshake | 2026-08-04 | `09cd72cc` |
| `WS-014` | `library/web-socket.spec.ts` | should send extra HTTP headers on WebSocket handshake from a worker | 2026-09-02 | `7d1bf294` |
| `WS-015` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with text message *(3 copies)* | 2025-06-30 | `ea6ddeaa` |
| `WS-016` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with binaryType=blob *(3 copies)* | 2025-06-30 | `d7ab32c5` |
| `WS-017` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with binaryType=arraybuffer *(3 copies)* | 2025-06-30 | `71b99eba` |
| `WS-018` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work when connection errors out *(3 copies)* | 2025-03-14 | `b7cb08cf` |
| `WS-019` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with error after successful open *(3 copies)* | 2025-03-14 | `e4c60b37` |
| `WS-020` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with client-side close *(3 copies)* | 2025-03-14 | `4aa90fb4` |
| `WS-021` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should pass through the required protocol *(3 copies)* | 2025-03-14 | `db393fda` |
| `WS-022` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with relative WebSocket URL *(3 copies)* | 2025-06-30 | `634bc02f` |
| `WS-023` | `library/route-web-socket.spec.ts` | should work with ws.close | 2025-06-30 | `1af9467c` |
| `WS-024` | `library/route-web-socket.spec.ts` | should observe upstream handshake failure when connectToServer is used | 2026-06-01 | `27016cf6` |
| `WS-025` | `library/route-web-socket.spec.ts` | should observe multiple concurrent routed WebSockets with connectToServer | 2026-06-01 | `dc318423` |
| `WS-026` | `library/route-web-socket.spec.ts` | should pattern match | 2026-03-25 | `b874d058` |
| `WS-027` | `library/route-web-socket.spec.ts` | should work with server | 2025-06-30 | `daa7e2c7` |
| `WS-028` | `library/route-web-socket.spec.ts` | should work without server | 2025-06-30 | `0cb575e0` |
| `WS-029` | `library/route-web-socket.spec.ts` | should route WebSockets in already loaded documents | 2026-10-05 | `3b127d05` |
| `WS-030` | `library/route-web-socket.spec.ts` | should emit close upon frame navigation | 2025-06-30 | `48059034` |
| `WS-031` | `library/route-web-socket.spec.ts` | should emit close upon frame detach | 2025-06-30 | `c90f5eee` |
| `WS-032` | `library/route-web-socket.spec.ts` | should route on context | 2026-03-25 | `33236816` |
| `WS-033` | `library/route-web-socket.spec.ts` | should not throw after page closure | 2025-03-14 | `e8f4bb37` |
| `WS-034` | `library/route-web-socket.spec.ts` | should not throw with empty handler | 2025-03-14 | `d744f2bf` |
| `WS-035` | `library/route-web-socket.spec.ts` | should throw when connecting twice | 2025-03-14 | `d9087545` |
| `WS-036` | `library/route-web-socket.spec.ts` | should work with no trailing slash | 2026-03-25 | `df775ec6` |
| `WS-037` | `library/route-web-socket.spec.ts` | should work with baseURL | 2025-06-30 | `ea0ac691` |
| `WS-038` | `library/route-web-socket.spec.ts` | should work with baseURL regardless of scheme casing | 2026-07-01 | `38bb7db5` |
| `WS-039` | `library/route-web-socket.spec.ts` | should expose protocols to the route handler | 2026-04-23 | `9825c338` |
| `WS-040` | `library/route-web-socket.spec.ts` | should expose protocols on server-side route | 2026-04-23 | `b5466ec7` |
