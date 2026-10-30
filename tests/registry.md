# Test registry

Every test in `tests/page` and `tests/library`, with its identifier. The identifier is
the first token of the test title. The test titles are the source of truth: this file is
made from them, and `npm run lint-tests` fails when this file does not match them.

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

To add a test, give it the next free number of its subsystem. Do not use the number of a
removed test again. When you move a test to another file, keep its identifier. To add a
subsystem, add a row to the Subsystems table. Then update this file:

    PWTEST_UPDATE_REGISTRY=1 npm run test -- --list --reporter=./tests/config/registryReporter.ts

## Subsystems

| Code | Subsystem | Files |
|---|---|---|
| `AN` | Android WebViews | `library/unit/android-webviews` |
| `AR` | Aria snapshot | `page/{page-aria-snapshot, page-aria-snapshot-ai, page-aria-snapshot-json, to-match-aria-snapshot}`<br>`library/role-utils` |
| `AT` | Add script and style tags | `page/{page-add-script-tag, page-add-style-tag}` |
| `AU` | Authentication | `library/{browsercontext-credentials, browsercontext-webauthn}` |
| `AW` | Auto-waiting | `page/{page-autowaiting-basic, page-autowaiting-no-hang}` |
| `BC` | BrowserContext | `library/{browsercontext-basic, browsercontext-events, browsercontext-pages, browsercontext-page-event, browsercontext-reuse}` |
| `BP` | Browsers path | `library/browsers-path` |
| `BR` | Browser | `library/{browser, browser-server}` |
| `BT` | BrowserType | `library/{browsertype-basic, browsertype-launch, launcher, browsertype-launch-server, browsertype-connect, browsertype-launch-selenium}` |
| `BU` | Before unload | `library/beforeunload` |
| `CA` | Capabilities | `library/{capabilities, modernizr}` |
| `CC` | Client certificates | `library/client-certificates` |
| `CD` | CDP | `library/chromium/{connect-over-cdp, session}` |
| `CF` | Code frame | `library/unit/code-frame` |
| `CG` | Codegen | `library/inspector/{cli-codegen-1, cli-codegen-2, cli-codegen-3, cli-codegen-aria, cli-codegen-pick-locator, cli-codegen-javascript, cli-codegen-test, cli-codegen-python, cli-codegen-python-async, cli-codegen-pytest, cli-codegen-java, cli-codegen-csharp}`<br>`library/unit/codegen` |
| `CH` | Check | `page/page-check` |
| `CK` | Clock | `library/{page-clock, page-clock.frozen}`<br>`library/unit/clock` |
| `CL` | Click | `page/{page-click, page-click-scroll, page-click-react, page-click-during-navigation, page-click-timeout-1, page-click-timeout-2, page-click-timeout-3, page-click-timeout-4}` |
| `CM` | Console messages | `page/page-event-console` |
| `CN` | Channels | `library/channels` |
| `CO` | Cookies | `library/{browsercontext-cookies, browsercontext-add-cookies, browsercontext-clearcookies, browsercontext-cookies-third-party}` |
| `CR` | Chromium | `library/chromium/{chromium, launcher, extensions, bfcache, connect-to-worker, disable-web-security}` |
| `CS` | CSP | `library/browsercontext-csp` |
| `CV` | Coverage | `library/chromium/{js-coverage, css-coverage}`<br>`library/coverage` |
| `DB` | Debug | `library/{debugger, debug-controller}` |
| `DC` | Default (persistent) context | `library/{defaultbrowsercontext-1, defaultbrowsercontext-2}` |
| `DD` | Drag and drop | `page/{page-drag, page-drop}` |
| `DE` | Dispatch event | `page/page-dispatchevent` |
| `DI` | Dialog | `page/page-dialog` |
| `DO` | Download | `library/{download, downloads-path}` |
| `DV` | Device | `library/{browsercontext-device, browsercontext-dsf, browsercontext-viewport-mobile}` |
| `EE` | Event emitter | `page/page-listeners`<br>`library/events/{add-listeners, check-listener-leaks, events-list, listener-count, listeners-side-effects, listeners, max-listeners, method-names, modify-in-emit, num-args, once, prepend, remove-all-listeners-wait, remove-all-listeners, remove-listeners, set-max-listeners-side-effects, special-event-names, subclass, symbols}` |
| `EF` | Expose function | `page/page-expose-function`<br>`library/browsercontext-expose-function` |
| `EH` | ElementHandle | `page/{elementhandle-bounding-box, elementhandle-click, elementhandle-content-frame, elementhandle-convenience, elementhandle-eval-on-selector, elementhandle-misc, elementhandle-owner-frame, elementhandle-press, elementhandle-query-selector, elementhandle-screenshot, elementhandle-scroll-into-view, elementhandle-select-text, elementhandle-type, elementhandle-wait-for-element-state}` |
| `EM` | Emulation | `page/page-emulate-media`<br>`library/{emulation-focus, emulation-coop}` |
| `ER` | Page errors and crashes | `page/page-event-pageerror`<br>`library/page-event-crash` |
| `ES` | Eval on selector | `page/{eval-on-selector, eval-on-selector-all}` |
| `EV` | Evaluate | `page/{page-evaluate, page-evaluate-handle, page-evaluate-callback, page-evaluate-no-stall}` |
| `EX` | Expect | `page/{expect-boolean, expect-builtins, expect-matcher-result, expect-misc, expect-timeout, expect-to-have-accessible, expect-to-have-text, expect-to-have-value, expect-with-snapshot, matchers.misc}` |
| `FA` | Favicon | `library/favicon` |
| `FC` | File chooser | `page/page-filechooser` |
| `FE` | Fetch | `library/{global-fetch, global-fetch-cookie, browsercontext-fetch, browsercontext-fetch-algorithms, browsercontext-fetch-happy-eyeballs}` |
| `FF` | Firefox | `library/firefox/launcher`<br>`page/firefox-network-response` |
| `FI` | Fill | `page/page-fill` |
| `FO` | Focus | `page/page-focus` |
| `FR` | Frame | `page/{frame-evaluate, frame-frame-element, frame-goto, frame-hierarchy}` |
| `GE` | Geolocation | `library/geolocation` |
| `GN` | Locator and selector generator | `library/{locator-generator, selector-generator}` |
| `HA` | HAR | `library/{har, browsercontext-har, har-websocket}` |
| `HE` | Headful | `library/headful` |
| `HS` | HTTP server | `library/unit/http-server` |
| `HT` | Hit target | `library/hit-target` |
| `IF` | Input files | `page/page-set-input-files` |
| `IN` | Inspector | `library/inspector/{pause, recorder-api, console-api, title}` |
| `IS` | Init script | `page/{page-add-init-script, page-add-init-script-callback}`<br>`library/browsercontext-add-init-script` |
| `JH` | JSHandle | `page/{jshandle-as-element, jshandle-evaluate, jshandle-json-value, jshandle-properties, jshandle-to-string}` |
| `JS` | JSON schema | `library/unit/json-schema` |
| `KB` | Keyboard | `page/page-keyboard` |
| `LC` | Locale | `library/browsercontext-locale` |
| `LE` | Leaks | `page/page-leaks`<br>`library/heap` |
| `LG` | Logger | `library/logger` |
| `LH` | Locator handler | `page/page-add-locator-handler` |
| `LO` | Locator | `page/{locator-any-frame, locator-click, locator-convenience, locator-element-handle, locator-evaluate, locator-frame, locator-highlight, locator-is-visible, locator-list, locator-misc-1, locator-misc-2, locator-query, locator-wait-for-function}`<br>`library/locator-highlight` |
| `MC` | Multiple clients | `library/multiclient` |
| `MO` | Mouse | `page/{page-mouse, wheel}` |
| `NA` | Navigation | `page/{page-goto, page-navigation, page-history, page-event-load}`<br>`library/browsercontext-base-url` |
| `NE` | Network | `page/{page-network-request, page-network-response, page-network-sizes, page-network-idle, page-event-network, page-event-request, network-post-data, page-set-extra-http-headers}`<br>`library/{browsercontext-set-extra-http-headers, browsercontext-network-event, network-timeout, resource-timing, ignorehttpserrors}` |
| `OO` | OOPIF | `library/chromium/oopif` |
| `PA` | Page | `page/{page-basic, page-set-content, page-transition}`<br>`library/page-close` |
| `PC` | Playwright client | `library/playwright-client` |
| `PD` | PDF | `library/pdf` |
| `PE` | Permissions | `library/permissions` |
| `PO` | Popup | `page/page-event-popup`<br>`library/popup` |
| `PR` | Proxy | `library/{proxy, browsercontext-proxy, proxy-pattern, fetch-proxy}` |
| `PS` | Parser | `library/{locator-parser, component-parser, css-parser}` |
| `QS` | Query selector | `page/queryselector` |
| `RE` | Retarget | `page/retarget` |
| `RO` | Route | `page/{page-route, page-request-continue, page-request-fulfill, page-request-fallback, page-request-intercept, page-request-gc, interception}`<br>`library/{browsercontext-route, unroute-behavior}` |
| `SC` | Screencast | `library/{screencast, screencast-actions, screencast-overlay}` |
| `SE` | Selectors | `page/{selectors-css, selectors-text, selectors-role, selectors-get-by, selectors-frame, selectors-misc, selectors-register}`<br>`library/selectors-register` |
| `SI` | Signals | `library/signals` |
| `SL` | Slow motion | `library/slowmo` |
| `SM` | Strict mode | `page/page-strict`<br>`library/browsercontext-strict` |
| `SO` | Select option | `page/page-select-option` |
| `SQ` | Sequence | `library/unit/sequence` |
| `SS` | Screenshot | `page/page-screenshot`<br>`library/screenshot` |
| `ST` | Storage | `library/browsercontext-storage-state`<br>`page/{page-localstorage, page-cache-storage}` |
| `TA` | Tap | `library/{tap, locator-dispatchevent-touch}` |
| `TO` | Timeout runner | `library/unit/timeout-runner` |
| `TR` | Tracing | `library/tracing`<br>`library/chromium/tracing` |
| `TV` | Trace viewer | `library/{trace-viewer, snapshot-renderer}` |
| `TZ` | Timezone | `library/browsercontext-timezone-id` |
| `UA` | User agent | `library/browsercontext-user-agent` |
| `VI` | Video | `library/video` |
| `VP` | Viewport | `library/browsercontext-viewport` |
| `WA` | Wait for | `page/{page-wait-for-function, page-wait-for-selector-1, page-wait-for-selector-2, page-wait-for-load-state, page-wait-for-navigation, page-wait-for-url, page-wait-for-request, page-wait-for-response}` |
| `WM` | WebMCP | `library/{webmcp, webmcp-disabled}` |
| `WO` | Workers | `page/workers`<br>`library/{shared-worker, browsercontext-service-worker-policy}` |
| `WS` | WebSocket | `library/{web-socket, route-web-socket}` |

## Tests

### AN — Android WebViews

| ID | File | Title |
|---|---|---|
| `AN-001` | `library/unit/android-webviews.spec.ts` | should attribute a webview socket to the process that owns it |

### AR — Aria snapshot

| ID | File | Title |
|---|---|---|
| `AR-001` | `page/page-aria-snapshot.spec.ts` | should snapshot |
| `AR-002` | `page/page-aria-snapshot.spec.ts` | should snapshot list |
| `AR-003` | `page/page-aria-snapshot.spec.ts` | should snapshot list with accessible name |
| `AR-004` | `page/page-aria-snapshot.spec.ts` | should quote names that look like regexes |
| `AR-005` | `page/page-aria-snapshot.spec.ts` | should snapshot complex |
| `AR-006` | `page/page-aria-snapshot.spec.ts` | should allow text nodes |
| `AR-007` | `page/page-aria-snapshot.spec.ts` | should snapshot details visibility |
| `AR-008` | `page/page-aria-snapshot.spec.ts` | should not snapshot text directly inside closed details |
| `AR-009` | `page/page-aria-snapshot.spec.ts` | should not snapshot text that is not assigned to a slot |
| `AR-010` | `page/page-aria-snapshot.spec.ts` | should snapshot integration |
| `AR-011` | `page/page-aria-snapshot.spec.ts` | should support multiline text |
| `AR-012` | `page/page-aria-snapshot.spec.ts` | should concatenate span text |
| `AR-013` | `page/page-aria-snapshot.spec.ts` | should concatenate span text 2 |
| `AR-014` | `page/page-aria-snapshot.spec.ts` | should concatenate div text with spaces |
| `AR-015` | `page/page-aria-snapshot.spec.ts` | should include pseudo in text |
| `AR-016` | `page/page-aria-snapshot.spec.ts` | should not include hidden pseudo in text |
| `AR-017` | `page/page-aria-snapshot.spec.ts` | should include new line for block pseudo |
| `AR-018` | `page/page-aria-snapshot.spec.ts` | should work with slots |
| `AR-019` | `page/page-aria-snapshot.spec.ts` | should snapshot inner text |
| `AR-020` | `page/page-aria-snapshot.spec.ts` | should include pseudo codepoints |
| `AR-021` | `page/page-aria-snapshot.spec.ts` | check aria-hidden text |
| `AR-022` | `page/page-aria-snapshot.spec.ts` | should ignore presentation and none roles |
| `AR-023` | `page/page-aria-snapshot.spec.ts` | should treat input value as text in templates, but not for checkbox/radio/file |
| `AR-024` | `page/page-aria-snapshot.spec.ts` | should not use on as checkbox value |
| `AR-025` | `page/page-aria-snapshot.spec.ts` | should respect aria-owns |
| `AR-026` | `page/page-aria-snapshot.spec.ts` | should be ok with circular ownership |
| `AR-027` | `page/page-aria-snapshot.spec.ts` | should escape yaml text in text nodes |
| `AR-028` | `page/page-aria-snapshot.spec.ts` | should normalize whitespace |
| `AR-029` | `page/page-aria-snapshot.spec.ts` | should handle long strings |
| `AR-030` | `page/page-aria-snapshot.spec.ts` | should escape special yaml characters |
| `AR-031` | `page/page-aria-snapshot.spec.ts` | should escape special yaml values |
| `AR-032` | `page/page-aria-snapshot.spec.ts` | should not report textarea textContent |
| `AR-033` | `page/page-aria-snapshot.spec.ts` | should not show visible children of hidden elements |
| `AR-034` | `page/page-aria-snapshot.spec.ts` | should not show unhidden children of aria-hidden elements |
| `AR-035` | `page/page-aria-snapshot.spec.ts` | should snapshot placeholder when different from the name |
| `AR-036` | `page/page-aria-snapshot.spec.ts` | match values both against regex and string |
| `AR-037` | `page/page-aria-snapshot.spec.ts` | auto-waits the locator and does not include iframes |
| `AR-038` | `page/page-aria-snapshot.spec.ts` | should limit depth |
| `AR-039` | `page/page-aria-snapshot.spec.ts` | should snapshot a locator inside an iframe |
| `AR-040` | `page/page-aria-snapshot.spec.ts` | should include frames on frameset pages |
| `AR-041` | `page/page-aria-snapshot.spec.ts` | should snapshot a locator inside a frameset frame |
| `AR-042` | `page/page-aria-snapshot.spec.ts` | should snapshot with box from page |
| `AR-043` | `page/page-aria-snapshot.spec.ts` | should snapshot with box from locator |
| `AR-044` | `page/page-aria-snapshot.spec.ts` | should not include box when option is omitted |
| `AR-045` | `page/page-aria-snapshot.spec.ts` | should not include hidden iframes |
| `AR-046` | `page/page-aria-snapshot.spec.ts` | should not include inert elements |
| `AR-047` | `page/page-aria-snapshot.spec.ts` | should only include the modal dialog content |
| `AR-048` | `page/page-aria-snapshot-ai.spec.ts` | should generate refs |
| `AR-049` | `page/page-aria-snapshot-ai.spec.ts` | should list iframes |
| `AR-050` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot a locator inside an iframe |
| `AR-051` | `page/page-aria-snapshot-ai.spec.ts` | should limit depth across iframe boundary |
| `AR-052` | `page/page-aria-snapshot-ai.spec.ts` | should stitch all frame snapshots |
| `AR-053` | `page/page-aria-snapshot-ai.spec.ts` | should re-number refs across navigations but not same-document navigations |
| `AR-054` | `page/page-aria-snapshot-ai.spec.ts` | should persist iframe references |
| `AR-055` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for elements with pointer-events:none |
| `AR-056` | `page/page-aria-snapshot-ai.spec.ts` | emit generic roles for nodes w/o roles |
| `AR-057` | `page/page-aria-snapshot-ai.spec.ts` | should collapse generic nodes |
| `AR-058` | `page/page-aria-snapshot-ai.spec.ts` | should include cursor pointer hint |
| `AR-059` | `page/page-aria-snapshot-ai.spec.ts` | should not nest cursor pointer hints |
| `AR-060` | `page/page-aria-snapshot-ai.spec.ts` | should omit names that just repeat printed descendant nodes |
| `AR-061` | `page/page-aria-snapshot-ai.spec.ts` | should omit redundant name when a contributing wrapper is collapsed |
| `AR-062` | `page/page-aria-snapshot-ai.spec.ts` | should omit redundant name when a contributor is a skipped leaf generic |
| `AR-063` | `page/page-aria-snapshot-ai.spec.ts` | should keep the name when the contributing wrapper collapses into repeating text |
| `AR-064` | `page/page-aria-snapshot-ai.spec.ts` | should keep names not derived from printed nodes |
| `AR-065` | `page/page-aria-snapshot-ai.spec.ts` | should omit images without an accessible name |
| `AR-066` | `page/page-aria-snapshot-ai.spec.ts` | should omit a nameless image nested inside a link |
| `AR-067` | `page/page-aria-snapshot-ai.spec.ts` | should keep icon-only clickable elements |
| `AR-068` | `page/page-aria-snapshot-ai.spec.ts` | should omit leaf generic whose text is already in an ancestor name |
| `AR-069` | `page/page-aria-snapshot-ai.spec.ts` | should omit name-repeating generic behind a wrapper |
| `AR-070` | `page/page-aria-snapshot-ai.spec.ts` | should resolve refs of distilled-away nodes |
| `AR-071` | `page/page-aria-snapshot-ai.spec.ts` | should not distill snapshots outside of ai mode |
| `AR-072` | `page/page-aria-snapshot-ai.spec.ts` | should truncate data url in link |
| `AR-073` | `page/page-aria-snapshot-ai.spec.ts` | should gracefully fallback when child frame cant be captured |
| `AR-074` | `page/page-aria-snapshot-ai.spec.ts` | should auto-wait for navigation |
| `AR-075` | `page/page-aria-snapshot-ai.spec.ts` | should auto-wait for blocking CSS |
| `AR-076` | `page/page-aria-snapshot-ai.spec.ts` | should show visible children of hidden elements |
| `AR-077` | `page/page-aria-snapshot-ai.spec.ts` | should include active element information |
| `AR-078` | `page/page-aria-snapshot-ai.spec.ts` | should update active element on focus |
| `AR-079` | `page/page-aria-snapshot-ai.spec.ts` | should mark iframe as active when it contains focused element |
| `AR-080` | `page/page-aria-snapshot-ai.spec.ts` | return empty snapshot when iframe is not loaded |
| `AR-081` | `page/page-aria-snapshot-ai.spec.ts` | should support many properties on iframes |
| `AR-082` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot frameset pages |
| `AR-083` | `page/page-aria-snapshot-ai.spec.ts` | should snapshot a locator inside a frameset frame |
| `AR-084` | `page/page-aria-snapshot-ai.spec.ts` | should stitch iframes inside a frameset frame |
| `AR-085` | `page/page-aria-snapshot-ai.spec.ts` | should stitch nested frameset documents |
| `AR-086` | `page/page-aria-snapshot-ai.spec.ts` | should collapse inline generic nodes |
| `AR-087` | `page/page-aria-snapshot-ai.spec.ts` | should inline single leaf generic child into parent generic |
| `AR-088` | `page/page-aria-snapshot-ai.spec.ts` | should inline a deeply nested generic |
| `AR-089` | `page/page-aria-snapshot-ai.spec.ts` | should not remove generic nodes with title |
| `AR-090` | `page/page-aria-snapshot-ai.spec.ts` | should limit depth |
| `AR-091` | `page/page-aria-snapshot-ai.spec.ts` | should annotate aria-hidden elements |
| `AR-092` | `page/page-aria-snapshot-ai.spec.ts` | should only annotate the top element in a hidden subtree |
| `AR-093` | `page/page-aria-snapshot-ai.spec.ts` | should not include hidden iframes |
| `AR-094` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for inert elements |
| `AR-095` | `page/page-aria-snapshot-ai.spec.ts` | should not generate refs for elements outside of a modal dialog |
| `AR-096` | `page/page-aria-snapshot-json.spec.ts` | should snapshot roles, names and text |
| `AR-097` | `page/page-aria-snapshot-json.spec.ts` | should snapshot flags as properties |
| `AR-098` | `page/page-aria-snapshot-json.spec.ts` | should snapshot link url and textbox value |
| `AR-099` | `page/page-aria-snapshot-json.spec.ts` | should snapshot text fragments in children |
| `AR-100` | `page/page-aria-snapshot-json.spec.ts` | should snapshot top-level text fragments as text nodes |
| `AR-101` | `page/page-aria-snapshot-json.spec.ts` | should generate refs in ai mode |
| `AR-102` | `page/page-aria-snapshot-json.spec.ts` | should mark clickable elements with cursor in ai mode |
| `AR-103` | `page/page-aria-snapshot-json.spec.ts` | should snapshot iframes in ai mode |
| `AR-104` | `page/page-aria-snapshot-json.spec.ts` | should limit depth |
| `AR-105` | `page/page-aria-snapshot-json.spec.ts` | should include boxes when requested |
| `AR-106` | `page/page-aria-snapshot-json.spec.ts` | should snapshot a locator |
| `AR-107` | `page/to-match-aria-snapshot.spec.ts` | should match page |
| `AR-108` | `page/to-match-aria-snapshot.spec.ts` | should match page complex |
| `AR-109` | `page/to-match-aria-snapshot.spec.ts` | should match page with not |
| `AR-110` | `page/to-match-aria-snapshot.spec.ts` | should fail page with timeout |
| `AR-111` | `page/to-match-aria-snapshot.spec.ts` | should match |
| `AR-112` | `page/to-match-aria-snapshot.spec.ts` | should match in list |
| `AR-113` | `page/to-match-aria-snapshot.spec.ts` | should match list with accessible name |
| `AR-114` | `page/to-match-aria-snapshot.spec.ts` | should match deep item |
| `AR-115` | `page/to-match-aria-snapshot.spec.ts` | should match complex |
| `AR-116` | `page/to-match-aria-snapshot.spec.ts` | should match regex |
| `AR-117` | `page/to-match-aria-snapshot.spec.ts` | should allow text nodes |
| `AR-118` | `page/to-match-aria-snapshot.spec.ts` | details visibility |
| `AR-119` | `page/to-match-aria-snapshot.spec.ts` | checked attribute |
| `AR-120` | `page/to-match-aria-snapshot.spec.ts` | disabled attribute |
| `AR-121` | `page/to-match-aria-snapshot.spec.ts` | expanded attribute |
| `AR-122` | `page/to-match-aria-snapshot.spec.ts` | level attribute |
| `AR-123` | `page/to-match-aria-snapshot.spec.ts` | pressed attribute |
| `AR-124` | `page/to-match-aria-snapshot.spec.ts` | selected attribute |
| `AR-125` | `page/to-match-aria-snapshot.spec.ts` | integration test |
| `AR-126` | `page/to-match-aria-snapshot.spec.ts` | integration test 2 |
| `AR-127` | `page/to-match-aria-snapshot.spec.ts` | expected formatter |
| `AR-128` | `page/to-match-aria-snapshot.spec.ts` | should unpack escaped names |
| `AR-129` | `page/to-match-aria-snapshot.spec.ts` | should report error in YAML |
| `AR-130` | `page/to-match-aria-snapshot.spec.ts` | should report error in YAML keys |
| `AR-131` | `page/to-match-aria-snapshot.spec.ts` | call log should contain actual snapshot |
| `AR-132` | `page/to-match-aria-snapshot.spec.ts` | should parse attributes |
| `AR-133` | `page/to-match-aria-snapshot.spec.ts` | should not unshift actual template text |
| `AR-134` | `page/to-match-aria-snapshot.spec.ts` | should not match what is not matched |
| `AR-135` | `page/to-match-aria-snapshot.spec.ts` | should match url |
| `AR-136` | `page/to-match-aria-snapshot.spec.ts` | should detect unexpected children: equal |
| `AR-137` | `page/to-match-aria-snapshot.spec.ts` | should detect unexpected children: deep-equal |
| `AR-138` | `page/to-match-aria-snapshot.spec.ts` | should allow restoring contain mode inside deep-equal |
| `AR-139` | `page/to-match-aria-snapshot.spec.ts` | top-level deep-equal |
| `AR-140` | `page/to-match-aria-snapshot.spec.ts` | generated snapshot includes text children when name is longer than text |
| `AR-141` | `page/to-match-aria-snapshot.spec.ts` | treat bad regex as a string |
| `AR-142` | `page/to-match-aria-snapshot.spec.ts` | invalid attribute |
| `AR-143` | `library/role-utils.spec.ts` | wpt accname {#0, #1, #2, #3} *(4 copies)* |
| `AR-144` | `library/role-utils.spec.ts` | wpt accname non-manual |
| `AR-145` | `library/role-utils.spec.ts` | axe-core implicit-role |
| `AR-146` | `library/role-utils.spec.ts` | axe-core accessible-text |
| `AR-147` | `library/role-utils.spec.ts` | accessible name with slots |
| `AR-148` | `library/role-utils.spec.ts` | accessible name with closed details |
| `AR-149` | `library/role-utils.spec.ts` | accessible name nested treeitem |
| `AR-150` | `library/role-utils.spec.ts` | svg title |
| `AR-151` | `library/role-utils.spec.ts` | native controls |
| `AR-152` | `library/role-utils.spec.ts` | input type=search maps to searchbox unless list points at a datalist |
| `AR-153` | `library/role-utils.spec.ts` | meter and progress get their name from an associated label |
| `AR-154` | `library/role-utils.spec.ts` | native controls labelled-by |
| `AR-155` | `library/role-utils.spec.ts` | display:contents should be visible when contents are visible |
| `AR-156` | `library/role-utils.spec.ts` | should remove soft hyphens and zero-width spaces |
| `AR-157` | `library/role-utils.spec.ts` | label/labelled-by aria-hidden with descendants |
| `AR-158` | `library/role-utils.spec.ts` | own aria-label concatenated with aria-labelledby |
| `AR-159` | `library/role-utils.spec.ts` | control embedded in a label |
| `AR-160` | `library/role-utils.spec.ts` | control embedded in a target element |
| `AR-161` | `library/role-utils.spec.ts` | searchbox embedded control should contribute its value |
| `AR-162` | `library/role-utils.spec.ts` | svg role=presentation |
| `AR-163` | `library/role-utils.spec.ts` | should work with form and tricky input names |
| `AR-164` | `library/role-utils.spec.ts` | should ignore stylesheet from hidden aria-labelledby subtree |
| `AR-165` | `library/role-utils.spec.ts` | should not include hidden pseudo into accessible name |
| `AR-166` | `library/role-utils.spec.ts` | should resolve pseudo content from attr |
| `AR-167` | `library/role-utils.spec.ts` | should resolve pseudo content alternative text |
| `AR-168` | `library/role-utils.spec.ts` | should resolve css content property for an element |
| `AR-169` | `library/role-utils.spec.ts` | should ignore invalid aria-labelledby |
| `AR-170` | `library/role-utils.spec.ts` | should support search element |

### AT — Add script and style tags

| ID | File | Title |
|---|---|---|
| `AT-001` | `page/page-add-script-tag.spec.ts` | should throw an error if no options are provided |
| `AT-002` | `page/page-add-script-tag.spec.ts` | should work with a url |
| `AT-003` | `page/page-add-script-tag.spec.ts` | should work with a url and type=module |
| `AT-004` | `page/page-add-script-tag.spec.ts` | should work with a path and type=module |
| `AT-005` | `page/page-add-script-tag.spec.ts` | should work with a content and type=module |
| `AT-006` | `page/page-add-script-tag.spec.ts` | should throw an error if loading from url fail |
| `AT-007` | `page/page-add-script-tag.spec.ts` | should work with a path |
| `AT-008` | `page/page-add-script-tag.spec.ts` | should include sourceURL when path is provided |
| `AT-009` | `page/page-add-script-tag.spec.ts` | should work with content |
| `AT-010` | `page/page-add-script-tag.spec.ts` | should throw when added with content to the CSP page |
| `AT-011` | `page/page-add-script-tag.spec.ts` | should throw when added with URL to the CSP page |
| `AT-012` | `page/page-add-script-tag.spec.ts` | should throw a nice error when the request fails |
| `AT-013` | `page/page-add-style-tag.spec.ts` | should throw an error if no options are provided |
| `AT-014` | `page/page-add-style-tag.spec.ts` | should work with a url @smoke |
| `AT-015` | `page/page-add-style-tag.spec.ts` | should throw an error if loading from url fail |
| `AT-016` | `page/page-add-style-tag.spec.ts` | should work with a path |
| `AT-017` | `page/page-add-style-tag.spec.ts` | should include sourceURL when path is provided |
| `AT-018` | `page/page-add-style-tag.spec.ts` | should work with content |
| `AT-019` | `page/page-add-style-tag.spec.ts` | should throw when added with content to the CSP page |
| `AT-020` | `page/page-add-style-tag.spec.ts` | should throw when added with URL to the CSP page |

### AU — Authentication

| ID | File | Title |
|---|---|---|
| `AU-001` | `library/browsercontext-credentials.spec.ts` | should fail without credentials |
| `AU-002` | `library/browsercontext-credentials.spec.ts` | should work with setHTTPCredentials |
| `AU-003` | `library/browsercontext-credentials.spec.ts` | should work with setHTTPCredentials and multiple credentials |
| `AU-004` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials @smoke |
| `AU-005` | `library/browsercontext-credentials.spec.ts` | should fail with wrong credentials |
| `AU-006` | `library/browsercontext-credentials.spec.ts` | should return resource body |
| `AU-007` | `library/browsercontext-credentials.spec.ts` | should work with a single credential in an array |
| `AU-008` | `library/browsercontext-credentials.spec.ts` | should work with multiple credentials for different origins |
| `AU-009` | `library/browsercontext-credentials.spec.ts` | should fall back to credentials without origin |
| `AU-010` | `library/browsercontext-credentials.spec.ts` | should use the first matching credential |
| `AU-011` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials and matching origin |
| `AU-012` | `library/browsercontext-credentials.spec.ts` | should work with correct credentials and matching origin case insensitive |
| `AU-013` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching scheme |
| `AU-014` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching hostname |
| `AU-015` | `library/browsercontext-credentials.spec.ts` | should fail with correct credentials and mismatching port |
| `AU-016` | `library/browsercontext-credentials.spec.ts` | should not override Authorization header set by the page |
| `AU-017` | `library/browsercontext-webauthn.spec.ts` | should not intercept navigator.credentials without install() |
| `AU-018` | `library/browsercontext-webauthn.spec.ts` | should seed a known credential and authenticate |
| `AU-019` | `library/browsercontext-webauthn.spec.ts` | should capture a page-created credential and reuse it in another context |
| `AU-020` | `library/browsercontext-webauthn.spec.ts` | should reuse a page-created credential via the storageState option |
| `AU-021` | `library/browsercontext-webauthn.spec.ts` | should seed and report signCount |
| `AU-022` | `library/browsercontext-webauthn.spec.ts` | should reject invalid signCount |
| `AU-023` | `library/browsercontext-webauthn.spec.ts` | should preserve signCount via the storageState option |
| `AU-024` | `library/browsercontext-webauthn.spec.ts` | should serialize credentials with toJSON |

### AW — Auto-waiting

| ID | File | Title |
|---|---|---|
| `AW-001` | `page/page-autowaiting-basic.spec.ts` | should await navigation when clicking anchor |
| `AW-002` | `page/page-autowaiting-basic.spec.ts` | should not stall on JS navigation link |
| `AW-003` | `page/page-autowaiting-basic.spec.ts` | should await cross-process navigation when clicking anchor |
| `AW-004` | `page/page-autowaiting-basic.spec.ts` | should await form-get on click |
| `AW-005` | `page/page-autowaiting-basic.spec.ts` | should await form-post on click |
| `AW-006` | `page/page-autowaiting-basic.spec.ts` | should work with noWaitAfter: true |
| `AW-007` | `page/page-autowaiting-basic.spec.ts` | should work with dblclick without noWaitAfter when navigation is stalled |
| `AW-008` | `page/page-autowaiting-basic.spec.ts` | should work with waitForLoadState(load) |
| `AW-009` | `page/page-autowaiting-basic.spec.ts` | should work with goto following click |
| `AW-010` | `page/page-autowaiting-basic.spec.ts` | should report navigation in the log when clicking anchor |
| `AW-011` | `page/page-autowaiting-basic.spec.ts` | should report and collapse log in action |
| `AW-012` | `page/page-autowaiting-basic.spec.ts` | should report and collapse log in expect |
| `AW-013` | `page/page-autowaiting-no-hang.spec.ts` | clicking on links which do not commit navigation |
| `AW-014` | `page/page-autowaiting-no-hang.spec.ts` | calling window.stop async |
| `AW-015` | `page/page-autowaiting-no-hang.spec.ts` | calling window.stop sync |
| `AW-016` | `page/page-autowaiting-no-hang.spec.ts` | assigning location to about:blank |
| `AW-017` | `page/page-autowaiting-no-hang.spec.ts` | assigning location to about:blank after non-about:blank |
| `AW-018` | `page/page-autowaiting-no-hang.spec.ts` | calling window.open and window.close |
| `AW-019` | `page/page-autowaiting-no-hang.spec.ts` | opening a popup |
| `AW-020` | `page/page-autowaiting-no-hang.spec.ts` | clicking in the middle of navigation that aborts |
| `AW-021` | `page/page-autowaiting-no-hang.spec.ts` | clicking in the middle of navigation that commits |
| `AW-022` | `page/page-autowaiting-no-hang.spec.ts` | clicking a link intercepted by the Navigation API same-document |
| `AW-023` | `page/page-autowaiting-no-hang.spec.ts` | goBack in the middle of navigation that commits |

### BC — BrowserContext

| ID | File | Title |
|---|---|---|
| `BC-001` | `library/browsercontext-basic.spec.ts` | should create new context @smoke |
| `BC-002` | `library/browsercontext-basic.spec.ts` | should be able to click across browser contexts |
| `BC-003` | `library/browsercontext-basic.spec.ts` | should be able to hover across browser contexts in parallel |
| `BC-004` | `library/browsercontext-basic.spec.ts` | window.open should use parent tab context |
| `BC-005` | `library/browsercontext-basic.spec.ts` | should isolate localStorage and cookies @smoke |
| `BC-006` | `library/browsercontext-basic.spec.ts` | should propagate default viewport to the page |
| `BC-007` | `library/browsercontext-basic.spec.ts` | should make a copy of default viewport |
| `BC-008` | `library/browsercontext-basic.spec.ts` | should respect deviceScaleFactor |
| `BC-009` | `library/browsercontext-basic.spec.ts` | should not allow deviceScaleFactor with null viewport |
| `BC-010` | `library/browsercontext-basic.spec.ts` | should not allow isMobile with null viewport |
| `BC-011` | `library/browsercontext-basic.spec.ts` | close() should work for empty context |
| `BC-012` | `library/browsercontext-basic.spec.ts` | close() should abort waitForEvent |
| `BC-013` | `library/browsercontext-basic.spec.ts` | close() should be callable twice |
| `BC-014` | `library/browsercontext-basic.spec.ts` | should pass self to close event |
| `BC-015` | `library/browsercontext-basic.spec.ts` | should not report frameless pages on error |
| `BC-016` | `library/browsercontext-basic.spec.ts` | should return all of the pages |
| `BC-017` | `library/browsercontext-basic.spec.ts` | should close all belonging pages once closing context |
| `BC-018` | `library/browsercontext-basic.spec.ts` | should disable javascript |
| `BC-019` | `library/browsercontext-basic.spec.ts` | should be able to navigate after disabling javascript |
| `BC-020` | `library/browsercontext-basic.spec.ts` | should not hang on promises after disabling javascript |
| `BC-021` | `library/browsercontext-basic.spec.ts` | setContent should work after disabling javascript |
| `BC-022` | `library/browsercontext-basic.spec.ts` | should retry click after disabling javascript |
| `BC-023` | `library/browsercontext-basic.spec.ts` | should work with offline option |
| `BC-024` | `library/browsercontext-basic.spec.ts` | fetch with keepalive should throw when offline |
| `BC-025` | `library/browsercontext-basic.spec.ts` | should emulate navigator.onLine |
| `BC-026` | `library/browsercontext-basic.spec.ts` | should emulate navigator.onLine across navigations |
| `BC-027` | `library/browsercontext-basic.spec.ts` | should emulate offline event |
| `BC-028` | `library/browsercontext-basic.spec.ts` | should emulate media in popup |
| `BC-029` | `library/browsercontext-basic.spec.ts` | should emulate media in cross-process iframe |
| `BC-030` | `library/browsercontext-basic.spec.ts` | default user agent |
| `BC-031` | `library/browsercontext-basic.spec.ts` | should create two pages in parallel in various contexts |
| `BC-032` | `library/browsercontext-events.spec.ts` | console event should work @smoke |
| `BC-033` | `library/browsercontext-events.spec.ts` | console event should work with element handles |
| `BC-034` | `library/browsercontext-events.spec.ts` | console event should work in popup |
| `BC-035` | `library/browsercontext-events.spec.ts` | console event should work in popup 2 |
| `BC-036` | `library/browsercontext-events.spec.ts` | console event should work in immediately closed popup |
| `BC-037` | `library/browsercontext-events.spec.ts` | dialog event should work @smoke |
| `BC-038` | `library/browsercontext-events.spec.ts` | dialogclosed event should work |
| `BC-039` | `library/browsercontext-events.spec.ts` | dialog event should work in popup |
| `BC-040` | `library/browsercontext-events.spec.ts` | dialog event should work in popup 2 |
| `BC-041` | `library/browsercontext-events.spec.ts` | dialog event should work in immediately closed popup |
| `BC-042` | `library/browsercontext-events.spec.ts` | dialog event should work with inline script tag |
| `BC-043` | `library/browsercontext-events.spec.ts` | weberror event should work |
| `BC-044` | `library/browsercontext-events.spec.ts` | weberror event should include location |
| `BC-045` | `library/browsercontext-events.spec.ts` | pageload event should work @smoke |
| `BC-046` | `library/browsercontext-events.spec.ts` | framenavigated event should work @smoke |
| `BC-047` | `library/browsercontext-events.spec.ts` | pageclose event should work @smoke |
| `BC-048` | `library/browsercontext-events.spec.ts` | frameattached event should work @smoke |
| `BC-049` | `library/browsercontext-events.spec.ts` | framedetached event should work @smoke |
| `BC-050` | `library/browsercontext-events.spec.ts` | download event should work @smoke |
| `BC-051` | `library/browsercontext-pages.spec.ts` | should not be visible in context.pages |
| `BC-052` | `library/browsercontext-pages.spec.ts` | page.context should return the correct instance |
| `BC-053` | `library/browsercontext-pages.spec.ts` | frame.focus should work multiple times |
| `BC-054` | `library/browsercontext-pages.spec.ts` | should click with disabled javascript |
| `BC-055` | `library/browsercontext-pages.spec.ts` | should not hang with touch-enabled viewports |
| `BC-056` | `library/browsercontext-pages.spec.ts` | should click the button with deviceScaleFactor set |
| `BC-057` | `library/browsercontext-pages.spec.ts` | should click the button with offset with page scale |
| `BC-058` | `library/browsercontext-pages.spec.ts` | should return bounding box with page scale |
| `BC-059` | `library/browsercontext-pages.spec.ts` | should not leak listeners during navigation of 20 pages |
| `BC-060` | `library/browsercontext-pages.spec.ts` | should close page while a reload is committing |
| `BC-061` | `library/browsercontext-pages.spec.ts` | should keep selection in multiple pages |
| `BC-062` | `library/browsercontext-page-event.spec.ts` | should have url |
| `BC-063` | `library/browsercontext-page-event.spec.ts` | should have url after domcontentloaded |
| `BC-064` | `library/browsercontext-page-event.spec.ts` | should have about:blank url with domcontentloaded |
| `BC-065` | `library/browsercontext-page-event.spec.ts` | should have about:blank for empty url with domcontentloaded |
| `BC-066` | `library/browsercontext-page-event.spec.ts` | should report when a new page is created and closed |
| `BC-067` | `library/browsercontext-page-event.spec.ts` | should report initialized pages |
| `BC-068` | `library/browsercontext-page-event.spec.ts` | should not crash while redirecting of original request was missed |
| `BC-069` | `library/browsercontext-page-event.spec.ts` | should have an opener |
| `BC-070` | `library/browsercontext-page-event.spec.ts` | should fire page lifecycle events |
| `BC-071` | `library/browsercontext-page-event.spec.ts` | should work with Shift-clicking |
| `BC-072` | `library/browsercontext-page-event.spec.ts` | should work with Ctrl-clicking |
| `BC-073` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should re-add binding after reset *(2 copies)* |
| `BC-074` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset serviceworker *(2 copies)* |
| `BC-075` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset serviceworker that hangs in importScripts *(2 copies)* |
| `BC-076` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should not cache resources *(2 copies)* |
| `BC-077` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should ignore binding from beforeunload *(2 copies)* |
| `BC-078` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset mouse position *(2 copies)* |
| `BC-079` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should reset tracing *(2 copies)* |
| `BC-080` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should work with clock emulation *(2 copies)* |
| `BC-081` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should continue issuing events after closing the reused page *(2 copies)* |
| `BC-082` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should work with routeWebSocket *(2 copies)* |
| `BC-083` | `library/browsercontext-reuse.spec.ts` | reuse {launch, connect} › should update viewport and media *(2 copies)* |

### BP — Browsers path

| ID | File | Title |
|---|---|---|
| `BP-001` | `library/browsers-path.spec.ts` | should import on an unsupported platform when PLAYWRIGHT\_BROWSERS\_PATH=0 |
| `BP-002` | `library/browsers-path.spec.ts` | should import on an unsupported platform with an explicit PLAYWRIGHT\_BROWSERS\_PATH |

### BR — Browser

| ID | File | Title |
|---|---|---|
| `BR-001` | `library/browser.spec.ts` | should return browserType |
| `BR-002` | `library/browser.spec.ts` | should create new page @smoke |
| `BR-003` | `library/browser.spec.ts` | should throw upon second create new page |
| `BR-004` | `library/browser.spec.ts` | version should work |
| `BR-005` | `library/browser.spec.ts` | should dispatch page.on(close) upon browser.close and reject evaluate |
| `BR-006` | `library/browser.spec.ts` | should fire context event on newContext |
| `BR-007` | `library/browser.spec.ts` | newContext should not leave a context upon failure |
| `BR-008` | `library/browser-server.spec.ts` | should start and stop pipe server |
| `BR-009` | `library/browser-server.spec.ts` | should write descriptor on start and remove on stop |
| `BR-010` | `library/browser-server.spec.ts` | should start ws server with host/port and produce well-formed endpoint |

### BT — BrowserType

| ID | File | Title |
|---|---|---|
| `BT-001` | `library/browsertype-basic.spec.ts` | browserType.executablePath should work |
| `BT-002` | `library/browsertype-basic.spec.ts` | browserType.name should work |
| `BT-003` | `library/browsertype-basic.spec.ts` | should throw when trying to connect with not-chromium |
| `BT-004` | `library/browsertype-launch.spec.ts` | should reject all promises when browser is closed |
| `BT-005` | `library/browsertype-launch.spec.ts` | should throw if userDataDir option is passed |
| `BT-006` | `library/browsertype-launch.spec.ts` | should throw if userDataDir is passed as an argument |
| `BT-007` | `library/browsertype-launch.spec.ts` | should throw if port option is passed |
| `BT-008` | `library/browsertype-launch.spec.ts` | should throw if port option is passed for persistent context |
| `BT-009` | `library/browsertype-launch.spec.ts` | should throw if page argument is passed |
| `BT-010` | `library/browsertype-launch.spec.ts` | should reject if launched browser fails immediately |
| `BT-011` | `library/browsertype-launch.spec.ts` | should reject if executable path is invalid |
| `BT-012` | `library/browsertype-launch.spec.ts` | should handle timeout |
| `BT-013` | `library/browsertype-launch.spec.ts` | should handle exception and report launch log |
| `BT-014` | `library/browsertype-launch.spec.ts` | should accept objects as options |
| `BT-015` | `library/browsertype-launch.spec.ts` | should fire close event for all contexts |
| `BT-016` | `library/browsertype-launch.spec.ts` | should be callable twice |
| `BT-017` | `library/browsertype-launch.spec.ts` | should allow await using |
| `BT-018` | `library/launcher.spec.ts` | should have an errors object |
| `BT-019` | `library/launcher.spec.ts` | should have a devices object |
| `BT-020` | `library/launcher.spec.ts` | should kill browser process on timeout after close |
| `BT-021` | `library/launcher.spec.ts` | should throw a friendly error if its headed and there is no xserver on linux running |
| `BT-022` | `library/browsertype-launch-server.spec.ts` | launch server › should work |
| `BT-023` | `library/browsertype-launch-server.spec.ts` | launch server › should validate options |
| `BT-024` | `library/browsertype-launch-server.spec.ts` | launch server › should work with host |
| `BT-025` | `library/browsertype-launch-server.spec.ts` | launch server › should work with port |
| `BT-026` | `library/browsertype-launch-server.spec.ts` | launch server › should work with wsPath |
| `BT-027` | `library/browsertype-launch-server.spec.ts` | launch server › should work when wsPath is missing leading slash |
| `BT-028` | `library/browsertype-launch-server.spec.ts` | launch server › should default to random wsPath |
| `BT-029` | `library/browsertype-launch-server.spec.ts` | launch server › should provide an error when ws endpoint is incorrect |
| `BT-030` | `library/browsertype-launch-server.spec.ts` | launch server › should fire "close" event during kill |
| `BT-031` | `library/browsertype-launch-server.spec.ts` | launch server › should return child\_process instance |
| `BT-032` | `library/browsertype-launch-server.spec.ts` | launch server › should fire close event |
| `BT-033` | `library/browsertype-launch-server.spec.ts` | launch server › should log protocol |
| `BT-034` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should connect over wss *(2 copies)* |
| `BT-035` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print HTTP error *(2 copies)* |
| `BT-036` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print ws error *(2 copies)* |
| `BT-037` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should print custom ws close error *(2 copies)* |
| `BT-038` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to reconnect to a browser *(2 copies)* |
| `BT-039` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should not crash on malformed json frame *(2 copies)* |
| `BT-040` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to visit ipv6 *(2 copies)* |
| `BT-041` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should ignore page.pause when headed *(2 copies)* |
| `BT-042` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to visit ipv6 through localhost *(2 copies)* |
| `BT-043` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect two browsers at the same time *(2 copies)* |
| `BT-044` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should timeout in socket while connecting *(2 copies)* |
| `BT-045` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should timeout in connect while connecting *(2 copies)* |
| `BT-046` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send extra headers with connect request *(2 copies)* |
| `BT-047` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send extra headers with connect request in object form *(2 copies)* |
| `BT-048` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should send default User-Agent and X-Playwright-Browser headers with connect request *(2 copies)* |
| `BT-049` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should support slowmo option *(2 copies)* |
| `BT-050` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › disconnected event should be emitted when browser is closed or server is closed *(2 copies)* |
| `BT-051` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › disconnected event should have browser as argument *(2 copies)* |
| `BT-052` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should handle exceptions during connect *(2 copies)* |
| `BT-053` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should set the browser connected state *(2 copies)* |
| `BT-054` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should throw when used after isConnected returns false *(2 copies)* |
| `BT-055` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should throw when calling waitForNavigation after disconnect *(2 copies)* |
| `BT-056` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject navigation when browser closes *(2 copies)* |
| `BT-057` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForSelector when browser closes *(2 copies)* |
| `BT-058` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should emit close events on pages and contexts *(2 copies)* |
| `BT-059` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should terminate network waiters *(2 copies)* |
| `BT-060` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForEvent before browser.close finishes *(2 copies)* |
| `BT-061` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should reject waitForEvent before browser.onDisconnect fires *(2 copies)* |
| `BT-062` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should respect selectors *(2 copies)* |
| `BT-063` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should not throw on close after disconnect *(2 copies)* |
| `BT-064` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should saveAs videos from remote browser *(2 copies)* |
| `BT-065` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save videos to artifactsDir *(2 copies)* |
| `BT-066` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should name video file after page guid when connecting to remote browser with artifactsDir *(2 copies)* |
| `BT-067` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect 20 times to a single server without warnings *(2 copies)* |
| `BT-068` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save download *(2 copies)* |
| `BT-069` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should error when saving download after deletion *(2 copies)* |
| `BT-070` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should properly disconnect when connection closes from the client side *(2 copies)* |
| `BT-071` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should be able to connect when the wsEndpoint is passed as an option *(2 copies)* |
| `BT-072` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should save har *(2 copies)* |
| `BT-073` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should filter launch options *(2 copies)* |
| `BT-074` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should record trace with sources *(2 copies)* |
| `BT-075` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should fulfill with global fetch result *(2 copies)* |
| `BT-076` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should upload large file *(2 copies)* |
| `BT-077` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should upload a folder *(2 copies)* |
| `BT-078` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › setInputFiles should preserve lastModified timestamp *(2 copies)* |
| `BT-079` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › should connect over http *(2 copies)* |
| `BT-080` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should forward non-forwarded requests *(2 copies)* |
| `BT-081` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy localhost requests @smoke *(2 copies)* |
| `BT-082` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy ipv6 localhost requests @smoke *(2 copies)* |
| `BT-083` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy requests from fetch api *(2 copies)* |
| `BT-084` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy requests from fetch api over ipv6 *(2 copies)* |
| `BT-085` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy local.playwright requests *(2 copies)* |
| `BT-086` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should lead to the error page for forwarded requests when the connection is refused *(2 copies)* |
| `BT-087` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should proxy based on the pattern *(2 copies)* |
| `BT-088` | `library/browsertype-connect.spec.ts` | {launchServer, run-server} › socks proxy › should check proxy pattern on the client *(2 copies)* |
| `BT-089` | `library/browsertype-connect.spec.ts` | launchServer only › should work with cluster |
| `BT-090` | `library/browsertype-connect.spec.ts` | launchServer only › should properly disconnect when connection closes from the server side |
| `BT-091` | `library/browsertype-connect.spec.ts` | launchServer only › should be able to reconnect to a browser 12 times without warnings |
| `BT-092` | `library/browsertype-connect.spec.ts` | launchServer only › cannot launch another browser |
| `BT-093` | `library/browsertype-connect.spec.ts` | should refuse connecting when versions do not match |
| `BT-094` | `library/browsertype-connect.spec.ts` | should filter local paths from unsafe launch options |
| `BT-095` | `library/browsertype-connect.spec.ts` | should timeout after redirect when connecting over http |
| `BT-096` | `library/browsertype-connect.spec.ts` | should not retain closed browsers in launch mode |
| `BT-097` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone chromium |
| `BT-098` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 hub + node chromium |
| `BT-099` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 standalone chromium |
| `BT-100` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 hub + node chromium |
| `BT-101` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 4.8.3 standalone chromium broken driver |
| `BT-102` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone non-chromium |
| `BT-103` | `library/browsertype-launch-selenium.spec.ts` | selenium grid 3.141.59 standalone chromium through run-driver |

### BU — Before unload

| ID | File | Title |
|---|---|---|
| `BU-001` | `library/beforeunload.spec.ts` | should close browser with beforeunload page |
| `BU-002` | `library/beforeunload.spec.ts` | should close browsercontext with beforeunload page |
| `BU-003` | `library/beforeunload.spec.ts` | should be able to navigate away from page with beforeunload |
| `BU-004` | `library/beforeunload.spec.ts` | should close page with beforeunload listener |
| `BU-005` | `library/beforeunload.spec.ts` | should run beforeunload if asked for @smoke |
| `BU-006` | `library/beforeunload.spec.ts` | should access page after beforeunload |
| `BU-007` | `library/beforeunload.spec.ts` | should not stall on evaluate when dismissing beforeunload |
| `BU-008` | `library/beforeunload.spec.ts` | should not stall on click when dismissing beforeunload |
| `BU-009` | `library/beforeunload.spec.ts` | should support dismissing the dialog multiple times |
| `BU-010` | `library/beforeunload.spec.ts` | should support closing the page after a previous dismiss |
| `BU-011` | `library/beforeunload.spec.ts` | should support closing the page via a subsequent onbeforeunload dialog |
| `BU-012` | `library/beforeunload.spec.ts` | does not get stalled by beforeUnload |

### CA — Capabilities

| ID | File | Title |
|---|---|---|
| `CA-001` | `library/capabilities.spec.ts` | SharedArrayBuffer should work @smoke |
| `CA-002` | `library/capabilities.spec.ts` | Web Assembly should work @smoke |
| `CA-003` | `library/capabilities.spec.ts` | WebSocket should work @smoke |
| `CA-004` | `library/capabilities.spec.ts` | should respect CSP @smoke |
| `CA-005` | `library/capabilities.spec.ts` | should play video @smoke |
| `CA-006` | `library/capabilities.spec.ts` | should play webm video @smoke |
| `CA-007` | `library/capabilities.spec.ts` | should play audio @smoke |
| `CA-008` | `library/capabilities.spec.ts` | should support webgl @smoke |
| `CA-009` | `library/capabilities.spec.ts` | should support webgl 2 @smoke |
| `CA-010` | `library/capabilities.spec.ts` | should not crash on page with mp4 @smoke |
| `CA-011` | `library/capabilities.spec.ts` | should not crash on showDirectoryPicker |
| `CA-012` | `library/capabilities.spec.ts` | should not crash on storage.getDirectory() |
| `CA-013` | `library/capabilities.spec.ts` | navigator.clipboard should be present |
| `CA-014` | `library/capabilities.spec.ts` | should set CloseEvent.wasClean to false when the server terminates a WebSocket connection |
| `CA-015` | `library/capabilities.spec.ts` | serviceWorker should intercept document request |
| `CA-016` | `library/capabilities.spec.ts` | webkit should define window.safari |
| `CA-017` | `library/capabilities.spec.ts` | make sure that XMLHttpRequest upload events are emitted correctly |
| `CA-018` | `library/capabilities.spec.ts` | loading in HTMLImageElement.prototype |
| `CA-019` | `library/capabilities.spec.ts` | window.GestureEvent in WebKit |
| `CA-020` | `library/capabilities.spec.ts` | requestFullscreen |
| `CA-021` | `library/capabilities.spec.ts` | should send no Content-Length header for GET requests with a Content-Type |
| `CA-022` | `library/capabilities.spec.ts` | Intl.ListFormat should work |
| `CA-023` | `library/capabilities.spec.ts` | service worker should cover the iframe |
| `CA-024` | `library/capabilities.spec.ts` | service worker should register in an iframe |
| `CA-025` | `library/capabilities.spec.ts` | should be able to render avif images |
| `CA-026` | `library/capabilities.spec.ts` | should not crash when clicking a label with a \<input type="file"/\> |
| `CA-027` | `library/capabilities.spec.ts` | should not crash when clicking a color input |
| `CA-028` | `library/capabilities.spec.ts` | should not auto play audio |
| `CA-029` | `library/capabilities.spec.ts` | should not crash on feature detection for PublicKeyCredential |
| `CA-030` | `library/modernizr.spec.ts` | Safari Desktop |
| `CA-031` | `library/modernizr.spec.ts` | Mobile Safari |

### CC — Client certificates

| ID | File | Title |
|---|---|---|
| `CC-001` | `library/client-certificates.spec.ts` | fetch › validate input |
| `CC-002` | `library/client-certificates.spec.ts` | fetch › should fail with no client certificates provided |
| `CC-003` | `library/client-certificates.spec.ts` | fetch › should keep supporting http |
| `CC-004` | `library/client-certificates.spec.ts` | fetch › should throw with untrusted client certs |
| `CC-005` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates |
| `CC-006` | `library/client-certificates.spec.ts` | fetch › should not leak client certificate to cross-origin redirect target |
| `CC-007` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates in pfx format |
| `CC-008` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates and when a http proxy is used |
| `CC-009` | `library/client-certificates.spec.ts` | fetch › pass with trusted client certificates and when a socks proxy is used |
| `CC-010` | `library/client-certificates.spec.ts` | fetch › should throw a http error if the pfx passphrase is incorect |
| `CC-011` | `library/client-certificates.spec.ts` | fetch › should fail with matching certificates in legacy pfx format |
| `CC-012` | `library/client-certificates.spec.ts` | fetch › should work in the browser with request interception |
| `CC-013` | `library/client-certificates.spec.ts` | browser › validate input |
| `CC-014` | `library/client-certificates.spec.ts` | browser › should keep supporting http |
| `CC-015` | `library/client-certificates.spec.ts` | browser › should pass through to non-matching origin with self-signed cert |
| `CC-016` | `library/client-certificates.spec.ts` | browser › should not intercept TLS for origins without a client certificate |
| `CC-017` | `library/client-certificates.spec.ts` | browser › should fail with no client certificates |
| `CC-018` | `library/client-certificates.spec.ts` | browser › should fail with self-signed client certificates |
| `CC-019` | `library/client-certificates.spec.ts` | browser › should complete browser TLS handshake when server rejects client certificate after it |
| `CC-020` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates |
| `CC-021` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates when passing as content |
| `CC-022` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used |
| `CC-023` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used from env |
| `CC-024` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a http proxy is used from config but env is there |
| `CC-025` | `library/client-certificates.spec.ts` | browser › should respect launch proxy and proxy bypass |
| `CC-026` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and when a socks proxy is used |
| `CC-027` | `library/client-certificates.spec.ts` | browser › should not hang on tls errors during TLS 1.2 handshake |
| `CC-028` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates in pfx format |
| `CC-029` | `library/client-certificates.spec.ts` | browser › should handle TLS renegotiation with client certificates |
| `CC-030` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates in pfx format when passing as content |
| `CC-031` | `library/client-certificates.spec.ts` | browser › should fail with matching certificates in legacy pfx format |
| `CC-032` | `library/client-certificates.spec.ts` | browser › should throw a http error if the pfx passphrase is incorect |
| `CC-033` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates on context APIRequestContext instance |
| `CC-034` | `library/client-certificates.spec.ts` | browser › should pass with matching certificates and trailing slash |
| `CC-035` | `library/client-certificates.spec.ts` | browser › should have ignoreHTTPSErrors=false by default |
| `CC-036` | `library/client-certificates.spec.ts` | browser › support http2 |
| `CC-037` | `library/client-certificates.spec.ts` | browser › support http2 if the browser only supports http1.1 |
| `CC-038` | `library/client-certificates.spec.ts` | browser › should return target connection errors when using http2 |
| `CC-039` | `library/client-certificates.spec.ts` | browser › should handle rejected certificate in handshake with HTTP/2 |
| `CC-040` | `library/client-certificates.spec.ts` | browser › persistentContext › validate input |
| `CC-041` | `library/client-certificates.spec.ts` | browser › persistentContext › should pass with matching certificates |

### CD — CDP

| ID | File | Title |
|---|---|---|
| `CD-001` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session |
| `CD-002` | `library/chromium/connect-over-cdp.spec.ts` | should connect when an existing page has no renderer |
| `CD-003` | `library/chromium/connect-over-cdp.spec.ts` | should connect when the opener of an existing page has no renderer |
| `CD-004` | `library/chromium/connect-over-cdp.spec.ts` | should connect when an existing page has been discarded |
| `CD-005` | `library/chromium/connect-over-cdp.spec.ts` | should cleanup artifacts dir after connectOverCDP disconnects due to ws close |
| `CD-006` | `library/chromium/connect-over-cdp.spec.ts` | should reject pending CDPSession calls when the browser is killed |
| `CD-007` | `library/chromium/connect-over-cdp.spec.ts` | should write traces to provided artifactsDir on connectOverCDP |
| `CD-008` | `library/chromium/connect-over-cdp.spec.ts` | should connectOverCDP and manage downloads in default context |
| `CD-009` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session twice |
| `CD-010` | `library/chromium/connect-over-cdp.spec.ts` | should connect to existing page with iframe and navigate |
| `CD-011` | `library/chromium/connect-over-cdp.spec.ts` | should connect to existing service workers |
| `CD-012` | `library/chromium/connect-over-cdp.spec.ts` | should connect over a ws endpoint |
| `CD-013` | `library/chromium/connect-over-cdp.spec.ts` | should send extra headers with connect request |
| `CD-014` | `library/chromium/connect-over-cdp.spec.ts` | should keep URL parameters when adding json/version |
| `CD-015` | `library/chromium/connect-over-cdp.spec.ts` | should append /json/version with a slash if there isnt one |
| `CD-016` | `library/chromium/connect-over-cdp.spec.ts` | should send default User-Agent header with connect request |
| `CD-017` | `library/chromium/connect-over-cdp.spec.ts` | should report all pages in an existing browser |
| `CD-018` | `library/chromium/connect-over-cdp.spec.ts` | should connect via https |
| `CD-019` | `library/chromium/connect-over-cdp.spec.ts` | should return valid browser from context.browser() |
| `CD-020` | `library/chromium/connect-over-cdp.spec.ts` | should report an expected error when the endpointURL returns a non-expected status code |
| `CD-021` | `library/chromium/connect-over-cdp.spec.ts` | should report an expected error when the endpoint URL JSON webSocketDebuggerUrl is undefined |
| `CD-022` | `library/chromium/connect-over-cdp.spec.ts` | should connect to an existing cdp session when passed as a first argument |
| `CD-023` | `library/chromium/connect-over-cdp.spec.ts` | should use proxy with connectOverCDP |
| `CD-024` | `library/chromium/connect-over-cdp.spec.ts` | should use env proxy with connectOverCDP discovery request |
| `CD-025` | `library/chromium/connect-over-cdp.spec.ts` | should send target Host header when using env HTTP proxy with connectOverCDP |
| `CD-026` | `library/chromium/connect-over-cdp.spec.ts` | should be able to connect via localhost |
| `CD-027` | `library/chromium/connect-over-cdp.spec.ts` | emulate media should not be affected by second connectOverCDP with noDefaults |
| `CD-028` | `library/chromium/connect-over-cdp.spec.ts` | should allow tracing over cdp session |
| `CD-029` | `library/chromium/connect-over-cdp.spec.ts` | setInputFiles should preserve lastModified timestamp |
| `CD-030` | `library/chromium/connect-over-cdp.spec.ts` | setInputFiles should use local path when isLocal is set |
| `CD-031` | `library/chromium/connect-over-cdp.spec.ts` | should print custom ws close error |
| `CD-032` | `library/chromium/connect-over-cdp.spec.ts` | should not reuse utility worlds between two clients |
| `CD-033` | `library/chromium/connect-over-cdp.spec.ts` | should get title and URL of existing page |
| `CD-034` | `library/chromium/connect-over-cdp.spec.ts` | should skip default overrides with noDefaults |
| `CD-035` | `library/chromium/connect-over-cdp.spec.ts` | noDefaults should not affect new contexts |
| `CD-036` | `library/chromium/connect-over-cdp.spec.ts` | should connect over CDP using a ConnectionTransport |
| `CD-037` | `library/chromium/session.spec.ts` | should work |
| `CD-038` | `library/chromium/session.spec.ts` | should respect timeout and signal options |
| `CD-039` | `library/chromium/session.spec.ts` | should send events |
| `CD-040` | `library/chromium/session.spec.ts` | should only accept a page or frame |
| `CD-041` | `library/chromium/session.spec.ts` | should enable and disable domains independently |
| `CD-042` | `library/chromium/session.spec.ts` | should be able to detach session |
| `CD-043` | `library/chromium/session.spec.ts` | should throw nice errors |
| `CD-044` | `library/chromium/session.spec.ts` | should work with main frame |
| `CD-045` | `library/chromium/session.spec.ts` | should throw if target is part of main |
| `CD-046` | `library/chromium/session.spec.ts` | should not break page.close() |
| `CD-047` | `library/chromium/session.spec.ts` | should detach when page closes |
| `CD-048` | `library/chromium/session.spec.ts` | should reject protocol calls when page closes |
| `CD-049` | `library/chromium/session.spec.ts` | should emit event for each CDP event |
| `CD-050` | `library/chromium/session.spec.ts` | should emit close event when session is detached |
| `CD-051` | `library/chromium/session.spec.ts` | should emit close event when page closes |
| `CD-052` | `library/chromium/session.spec.ts` | should work with newBrowserCDPSession |
| `CD-053` | `library/chromium/connect-over-cdp.spec.ts` | should connect when another client inspects a terminated shared worker |

### CF — Code frame

| ID | File | Title |
|---|---|---|
| `CF-001` | `library/unit/code-frame.spec.ts` | should mark the column |
| `CF-002` | `library/unit/code-frame.spec.ts` | should mark the line without a column |
| `CF-003` | `library/unit/code-frame.spec.ts` | should respect linesAbove and linesBelow |
| `CF-004` | `library/unit/code-frame.spec.ts` | should clip to the source lines |
| `CF-005` | `library/unit/code-frame.spec.ts` | should pad line numbers to the widest one |
| `CF-006` | `library/unit/code-frame.spec.ts` | should print the message after the marker |
| `CF-007` | `library/unit/code-frame.spec.ts` | should print the message above the frame without a column |
| `CF-008` | `library/unit/code-frame.spec.ts` | should keep tabs before the marker |
| `CF-009` | `library/unit/code-frame.spec.ts` | should not add a space after the gutter for empty lines |
| `CF-010` | `library/unit/code-frame.spec.ts` | should split lines on all line terminators |
| `CF-011` | `library/unit/code-frame.spec.ts` | should highlight code |
| `CF-012` | `library/unit/code-frame.spec.ts` | should highlight multi-line tokens on each line |
| `CF-013` | `library/unit/code-frame.spec.ts` | should highlight keywords used as property names as identifiers |

### CG — Codegen

| ID | File | Title |
|---|---|---|
| `CG-001` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click |
| `CG-002` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should double click |
| `CG-003` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click twice |
| `CG-004` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should type after clicking twice |
| `CG-005` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should ignore programmatic events |
| `CG-006` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click after same-document navigation |
| `CG-007` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should make a positioned click on a canvas |
| `CG-008` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should work with TrustedTypes |
| `CG-009` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not target selector preview by text regexp |
| `CG-010` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill |
| `CG-011` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill japanese text |
| `CG-012` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill textarea |
| `CG-013` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill textarea with new lines at the end |
| `CG-014` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill \[contentEditable\] |
| `CG-015` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should fill \[contentEditable\] with initial text |
| `CG-016` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should press |
| `CG-017` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should update selected element after pressing Tab |
| `CG-018` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record ArrowDown |
| `CG-019` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should emit single keyup on ArrowDown |
| `CG-020` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not record a click on Enter press |
| `CG-021` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check |
| `CG-022` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check a radio button |
| `CG-023` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check with keyboard |
| `CG-024` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should check with keyboard after hover |
| `CG-025` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should uncheck |
| `CG-026` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should select |
| `CG-027` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should select with size attribute |
| `CG-028` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should await popup |
| `CG-029` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should attribute navigation to click |
| `CG-030` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should attribute navigation to press/fill |
| `CG-031` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should ignore AltGraph |
| `CG-032` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should middle click |
| `CG-033` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record slider |
| `CG-034` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should click button with nested div |
| `CG-035` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record omnibox navigations after performAction |
| `CG-036` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should record omnibox navigations after recordAction |
| `CG-037` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should not throw csp directive violation errors |
| `CG-038` | `library/inspector/cli-codegen-1.spec.ts` | cli codegen › should clear when recording is disabled |
| `CG-039` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain open page |
| `CG-040` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain second page |
| `CG-041` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should contain close page |
| `CG-042` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should not lead to an error if html gets clicked |
| `CG-043` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload a single file |
| `CG-044` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload multiple files |
| `CG-045` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should clear files |
| `CG-046` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should upload a file via hidden input triggered by button |
| `CG-047` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should download files |
| `CG-048` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should handle dialogs |
| `CG-049` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should handle history.postData |
| `CG-050` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should record open in a new tab with url |
| `CG-051` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should not clash pages |
| `CG-052` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › click should emit events in order |
| `CG-053` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should reset hover model on action when element detaches |
| `CG-054` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should update active model on action |
| `CG-055` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should check input with chaining id |
| `CG-056` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should record navigations after identical pushState |
| `CG-057` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should fill tricky characters |
| `CG-058` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should --test-id-attribute |
| `CG-059` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should generate getByTestId for any of the configured testIdAttributes |
| `CG-060` | `library/inspector/cli-codegen-2.spec.ts` | cli codegen › should auto-generate toBeVisible |
| `CG-061` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should click locator.first |
| `CG-062` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should click locator.nth |
| `CG-063` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (1) |
| `CG-064` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (2) |
| `CG-065` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (3) |
| `CG-066` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators (4) |
| `CG-067` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with special characters in name attribute |
| `CG-068` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with title attribute |
| `CG-069` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with name attribute |
| `CG-070` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with id attribute |
| `CG-071` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate frame locators with testId |
| `CG-072` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate role locators undef frame locators |
| `CG-073` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByTestId |
| `CG-074` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByPlaceholder |
| `CG-075` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByAltText |
| `CG-076` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByLabel |
| `CG-077` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate getByLabel without regex |
| `CG-078` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should pass through pointer events |
| `CG-079` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should consume contextmenu events, despite a custom context menu |
| `CG-080` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate click action from dialog |
| `CG-081` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate double click action from dialog |
| `CG-082` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should generate hover action |
| `CG-083` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value |
| `CG-084` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value on disabled input |
| `CG-085` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert value on disabled select |
| `CG-086` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should assert visibility |
| `CG-087` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should keep toolbar visible even if webpage erases content in hydration |
| `CG-088` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should display inline svg icons on text assertion dialog inside iframe |
| `CG-089` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should keep dialog open when clicking inside |
| `CG-090` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when top layer popover is open |
| `CG-091` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when top layer popover inside shadow DOM is open |
| `CG-092` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when manual popover with fullscreen backdrop is open |
| `CG-093` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen › should record when fullscreen element is open |
| `CG-094` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen with frameLocator() › should prepend the frame selector to disambiguate |
| `CG-095` | `library/inspector/cli-codegen-3.spec.ts` | cli codegen with frameLocator() › should not use frameLocator() when it saves a single frameLocator(selector) |
| `CG-096` | `library/inspector/cli-codegen-aria.spec.ts` | should generate aria snapshot |
| `CG-097` | `library/inspector/cli-codegen-aria.spec.ts` | should generate regex in aria snapshot |
| `CG-098` | `library/inspector/cli-codegen-aria.spec.ts` | should generate regex for uuid in aria snapshot |
| `CG-099` | `library/inspector/cli-codegen-aria.spec.ts` | should inspect aria snapshot |
| `CG-100` | `library/inspector/cli-codegen-aria.spec.ts` | should update aria snapshot highlight |
| `CG-101` | `library/inspector/cli-codegen-aria.spec.ts` | should show aria snapshot error |
| `CG-102` | `library/inspector/cli-codegen-aria.spec.ts` | should generate valid javascript with multiline snapshot assertion |
| `CG-103` | `library/inspector/cli-codegen-pick-locator.spec.ts` | should inspect locator |
| `CG-104` | `library/inspector/cli-codegen-pick-locator.spec.ts` | should update locator highlight |
| `CG-105` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct imports and context options |
| `CG-106` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options for custom settings |
| `CG-107` | `library/inspector/cli-codegen-javascript.spec.ts` | should work with --http-credentials |
| `CG-108` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options when using a device |
| `CG-109` | `library/inspector/cli-codegen-javascript.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-110` | `library/inspector/cli-codegen-javascript.spec.ts` | should save the codegen output to a file if specified |
| `CG-111` | `library/inspector/cli-codegen-javascript.spec.ts` | should print load/save storageState |
| `CG-112` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct imports and context options |
| `CG-113` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options for custom settings |
| `CG-114` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options when using a device |
| `CG-115` | `library/inspector/cli-codegen-test.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-116` | `library/inspector/cli-codegen-test.spec.ts` | should print load storageState |
| `CG-117` | `library/inspector/cli-codegen-test.spec.ts` | should not generate recordHAR with --save-har |
| `CG-118` | `library/inspector/cli-codegen-test.spec.ts` | should generate routeFromHAR with --save-har |
| `CG-119` | `library/inspector/cli-codegen-test.spec.ts` | should generate routeFromHAR with --save-har and --save-har-glob |
| `CG-120` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct imports and context options |
| `CG-121` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options for custom settings |
| `CG-122` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options when using a device |
| `CG-123` | `library/inspector/cli-codegen-python.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-124` | `library/inspector/cli-codegen-python.spec.ts` | should save the codegen output to a file if specified |
| `CG-125` | `library/inspector/cli-codegen-python.spec.ts` | should print load/save storage\_state |
| `CG-126` | `library/inspector/cli-codegen-python.spec.ts` | should work with --save-har |
| `CG-127` | `library/inspector/cli-codegen-python.spec.ts` | should work with --save-har and --save-har-glob |
| `CG-128` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct imports and context options |
| `CG-129` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options for custom settings |
| `CG-130` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options when using a device |
| `CG-131` | `library/inspector/cli-codegen-python-async.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-132` | `library/inspector/cli-codegen-python-async.spec.ts` | should save the codegen output to a file if specified |
| `CG-133` | `library/inspector/cli-codegen-python-async.spec.ts` | should print load/save storage\_state |
| `CG-134` | `library/inspector/cli-codegen-python-async.spec.ts` | should work with --save-har |
| `CG-135` | `library/inspector/cli-codegen-python-async.spec.ts` | should work with --save-har and --save-har-glob |
| `CG-136` | `library/inspector/cli-codegen-pytest.spec.ts` | should print the correct imports and context options |
| `CG-137` | `library/inspector/cli-codegen-pytest.spec.ts` | should print the correct context options when using a device and lang |
| `CG-138` | `library/inspector/cli-codegen-pytest.spec.ts` | should save the codegen output to a file if specified |
| `CG-139` | `library/inspector/cli-codegen-pytest.spec.ts` | should work with --save-har |
| `CG-140` | `library/inspector/cli-codegen-pytest.spec.ts` | should work with --save-har and --save-har-glob |
| `CG-141` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct imports and context options |
| `CG-142` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options for custom settings |
| `CG-143` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options when using a device |
| `CG-144` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-145` | `library/inspector/cli-codegen-java.spec.ts` | should print load/save storage\_state |
| `CG-146` | `library/inspector/cli-codegen-java.spec.ts` | should work with --save-har and --save-har-glob as java-library |
| `CG-147` | `library/inspector/cli-codegen-java.spec.ts` | should work with --save-har and --save-har-glob as java-junit |
| `CG-148` | `library/inspector/cli-codegen-java.spec.ts` | should print the correct imports in junit |
| `CG-149` | `library/inspector/cli-codegen-java.spec.ts` | should print a valid basic program in junit |
| `CG-150` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct imports and context options |
| `CG-151` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options for custom settings |
| `CG-152` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options when using a device |
| `CG-153` | `library/inspector/cli-codegen-csharp.spec.ts` | should print the correct context options when using a device and additional options |
| `CG-154` | `library/inspector/cli-codegen-csharp.spec.ts` | should print load/save storageState |
| `CG-155` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har |
| `CG-156` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har and --save-har-glob |
| `CG-157` | `library/inspector/cli-codegen-csharp.spec.ts` | should not print context options method override in {nunit, mstest, xunit} if no options were passed *(3 copies)* |
| `CG-158` | `library/inspector/cli-codegen-csharp.spec.ts` | should print context options method override in {nunit, mstest, xunit} if options were passed *(3 copies)* |
| `CG-159` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har in {nunit, mstest, xunit} *(3 copies)* |
| `CG-160` | `library/inspector/cli-codegen-csharp.spec.ts` | should work with --save-har and --save-har-glob in {nunit, mstest, xunit} *(3 copies)* |
| `CG-161` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in mstest |
| `CG-162` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in nunit |
| `CG-163` | `library/inspector/cli-codegen-csharp.spec.ts` | should print a valid basic program in xunit |
| `CG-164` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall |
| `CG-165` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with POST method and no body |
| `CG-166` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with PUT method and JSON body |
| `CG-167` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with PATCH method and form data |
| `CG-168` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with DELETE method and custom header |
| `CG-169` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with HEAD method |
| `CG-170` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with complex query parameters |
| `CG-171` | `library/unit/codegen.spec.ts` | javascript › generatePlaywrightRequestCall with multiple headers |
| `CG-172` | `library/unit/codegen.spec.ts` | javascript › escape sequences |
| `CG-173` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall |
| `CG-174` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with POST method and no body |
| `CG-175` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with PUT method and JSON body |
| `CG-176` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with PATCH method and form data |
| `CG-177` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with DELETE method and custom header |
| `CG-178` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with HEAD method |
| `CG-179` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with complex query parameters |
| `CG-180` | `library/unit/codegen.spec.ts` | python › generatePlaywrightRequestCall with multiple headers |
| `CG-181` | `library/unit/codegen.spec.ts` | python › escape sequences |
| `CG-182` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall |
| `CG-183` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall with POST method and no body |
| `CG-184` | `library/unit/codegen.spec.ts` | csharp › generatePlaywrightRequestCall with PUT method and JSON body |
| `CG-185` | `library/unit/codegen.spec.ts` | csharp › escape sequences |
| `CG-186` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall |
| `CG-187` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with POST method and no body |
| `CG-188` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with PUT method and JSON body |
| `CG-189` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with PATCH method and form data |
| `CG-190` | `library/unit/codegen.spec.ts` | java › generatePlaywrightRequestCall with DELETE method and custom header |
| `CG-191` | `library/unit/codegen.spec.ts` | java › escape sequences |

### CH — Check

| ID | File | Title |
|---|---|---|
| `CH-001` | `page/page-check.spec.ts` | should check the box @smoke |
| `CH-002` | `page/page-check.spec.ts` | should not check the checked box |
| `CH-003` | `page/page-check.spec.ts` | should uncheck the box |
| `CH-004` | `page/page-check.spec.ts` | should not uncheck the unchecked box |
| `CH-005` | `page/page-check.spec.ts` | should check radio |
| `CH-006` | `page/page-check.spec.ts` | should check radio by aria role |
| `CH-007` | `page/page-check.spec.ts` | should uncheck radio by aria role |
| `CH-008` | `page/page-check.spec.ts` | should check the box by aria role |
| `CH-009` | `page/page-check.spec.ts` | should uncheck the box by aria role |
| `CH-010` | `page/page-check.spec.ts` | should throw when not a checkbox |
| `CH-011` | `page/page-check.spec.ts` | should throw when not a checkbox 2 |
| `CH-012` | `page/page-check.spec.ts` | should check the box inside a button |
| `CH-013` | `page/page-check.spec.ts` | should check the label with position |
| `CH-014` | `page/page-check.spec.ts` | trial run should not check |
| `CH-015` | `page/page-check.spec.ts` | trial run should not uncheck |
| `CH-016` | `page/page-check.spec.ts` | should check the box using setChecked |
| `CH-017` | `page/page-check.spec.ts` | should throw when trying to uncheck radio button |

### CK — Clock

| ID | File | Title |
|---|---|---|
| `CK-001` | `library/page-clock.spec.ts` | runFor › triggers immediately without specified delay |
| `CK-002` | `library/page-clock.spec.ts` | runFor › does not trigger without sufficient delay |
| `CK-003` | `library/page-clock.spec.ts` | runFor › triggers after sufficient delay |
| `CK-004` | `library/page-clock.spec.ts` | runFor › triggers simultaneous timers |
| `CK-005` | `library/page-clock.spec.ts` | runFor › triggers multiple simultaneous timers |
| `CK-006` | `library/page-clock.spec.ts` | runFor › waits after setTimeout was called |
| `CK-007` | `library/page-clock.spec.ts` | runFor › triggers event when some throw |
| `CK-008` | `library/page-clock.spec.ts` | runFor › creates updated Date while ticking |
| `CK-009` | `library/page-clock.spec.ts` | runFor › passes 8 seconds |
| `CK-010` | `library/page-clock.spec.ts` | runFor › passes 1 minute |
| `CK-011` | `library/page-clock.spec.ts` | runFor › passes 2 hours, 34 minutes and 10 seconds |
| `CK-012` | `library/page-clock.spec.ts` | runFor › throws for invalid format |
| `CK-013` | `library/page-clock.spec.ts` | runFor › returns the current now value |
| `CK-014` | `library/page-clock.spec.ts` | fastForward › ignores timers which wouldn't be run |
| `CK-015` | `library/page-clock.spec.ts` | fastForward › pushes back execution time for skipped timers |
| `CK-016` | `library/page-clock.spec.ts` | fastForward › supports string time arguments |
| `CK-017` | `library/page-clock.spec.ts` | stubTimers › sets initial timestamp |
| `CK-018` | `library/page-clock.spec.ts` | stubTimers › should throw for invalid date |
| `CK-019` | `library/page-clock.spec.ts` | stubTimers › replaces global setTimeout |
| `CK-020` | `library/page-clock.spec.ts` | stubTimers › global fake setTimeout should return id |
| `CK-021` | `library/page-clock.spec.ts` | stubTimers › replaces global clearTimeout |
| `CK-022` | `library/page-clock.spec.ts` | stubTimers › replaces global setInterval |
| `CK-023` | `library/page-clock.spec.ts` | stubTimers › replaces global clearInterval |
| `CK-024` | `library/page-clock.spec.ts` | stubTimers › replaces global performance.now |
| `CK-025` | `library/page-clock.spec.ts` | stubTimers › fakes Date constructor |
| `CK-026` | `library/page-clock.spec.ts` | stubTimers › replaces global performance.timeOrigin |
| `CK-027` | `library/page-clock.spec.ts` | popup › should tick after popup |
| `CK-028` | `library/page-clock.spec.ts` | popup › should tick before popup |
| `CK-029` | `library/page-clock.spec.ts` | popup › should run time before popup |
| `CK-030` | `library/page-clock.spec.ts` | popup › should not run time before popup on pause |
| `CK-031` | `library/page-clock.spec.ts` | setFixedTime › does not fake methods |
| `CK-032` | `library/page-clock.spec.ts` | setFixedTime › allows setting time multiple times |
| `CK-033` | `library/page-clock.spec.ts` | setFixedTime › fixed time is not affected by clock manipulation |
| `CK-034` | `library/page-clock.spec.ts` | setFixedTime › allows installing fake timers after settings time |
| `CK-035` | `library/page-clock.spec.ts` | while running › should progress time |
| `CK-036` | `library/page-clock.spec.ts` | while running › should runFor |
| `CK-037` | `library/page-clock.spec.ts` | while running › should fastForward |
| `CK-038` | `library/page-clock.spec.ts` | while running › should pause |
| `CK-039` | `library/page-clock.spec.ts` | while running › should reject an invalid target time with an active requestAnimationFrame loop |
| `CK-040` | `library/page-clock.spec.ts` | while running › should pause and fastForward |
| `CK-041` | `library/page-clock.spec.ts` | while running › should set system time on pause |
| `CK-042` | `library/page-clock.spec.ts` | while on pause › fastForward should not run nested immediate |
| `CK-043` | `library/page-clock.spec.ts` | while on pause › runFor should not run nested immediate |
| `CK-044` | `library/page-clock.spec.ts` | while on pause › runFor should not run nested immediate from microtask |
| `CK-045` | `library/page-clock.spec.ts` | while on pause › should stay paused on the next page when an init script reads the time |
| `CK-046` | `library/page-clock.spec.ts` | while on pause › should not advance performance.now() before the first clock call on a new page |
| `CK-047` | `library/page-clock.spec.ts` | Date.now › check Date.now is an integer |
| `CK-048` | `library/page-clock.spec.ts` | Date.now › check Date.now is an integer (2) |
| `CK-049` | `library/page-clock.spec.ts` | Temporal.Now › should follow fixed time |
| `CK-050` | `library/page-clock.spec.ts` | Temporal.Now › should advance with the clock |
| `CK-051` | `library/page-clock.spec.ts` | Temporal.Now › should use the system time zone by default |
| `CK-052` | `library/page-clock.spec.ts` | Temporal.Now › should keep the rest of Temporal intact |
| `CK-053` | `library/page-clock.spec.ts` | AbortSignal.timeout |
| `CK-054` | `library/page-clock.spec.ts` | correctly increments Date.now()/performance.now() during blocking execution |
| `CK-055` | `library/page-clock.frozen.spec.ts` | clock should be frozen |
| `CK-056` | `library/page-clock.frozen.spec.ts` | clock should be realtime |
| `CK-057` | `library/unit/clock.spec.ts` | setTimeout › throws if no arguments |
| `CK-058` | `library/unit/clock.spec.ts` | setTimeout › does not throw if \|undefined\| or \|null\| is passed as a callback |
| `CK-059` | `library/unit/clock.spec.ts` | setTimeout › returns numeric id or object with numeric id |
| `CK-060` | `library/unit/clock.spec.ts` | setTimeout › returns unique id |
| `CK-061` | `library/unit/clock.spec.ts` | setTimeout › starts id from a large number |
| `CK-062` | `library/unit/clock.spec.ts` | setTimeout › sets timers on instance |
| `CK-063` | `library/unit/clock.spec.ts` | setTimeout › parses numeric string times |
| `CK-064` | `library/unit/clock.spec.ts` | setTimeout › parses no-numeric string times |
| `CK-065` | `library/unit/clock.spec.ts` | setTimeout › passes setTimeout parameters |
| `CK-066` | `library/unit/clock.spec.ts` | setTimeout › calls correct timeout on recursive tick |
| `CK-067` | `library/unit/clock.spec.ts` | setTimeout › does not depend on this |
| `CK-068` | `library/unit/clock.spec.ts` | setTimeout › is not influenced by forward system clock changes |
| `CK-069` | `library/unit/clock.spec.ts` | setTimeout › is not influenced by backward system clock changes |
| `CK-070` | `library/unit/clock.spec.ts` | setTimeout › use of eval when not in node › evals non-function callbacks |
| `CK-071` | `library/unit/clock.spec.ts` | setTimeout › use of eval when not in node › only evals on global scope |
| `CK-072` | `library/unit/clock.spec.ts` | runFor › triggers immediately without specified delay |
| `CK-073` | `library/unit/clock.spec.ts` | runFor › does not trigger without sufficient delay |
| `CK-074` | `library/unit/clock.spec.ts` | runFor › triggers after sufficient delay |
| `CK-075` | `library/unit/clock.spec.ts` | runFor › triggers simultaneous timers |
| `CK-076` | `library/unit/clock.spec.ts` | runFor › triggers multiple simultaneous timers |
| `CK-077` | `library/unit/clock.spec.ts` | runFor › triggers multiple simultaneous timers with zero callAt |
| `CK-078` | `library/unit/clock.spec.ts` | runFor › waits after setTimeout was called |
| `CK-079` | `library/unit/clock.spec.ts` | runFor › mini integration test |
| `CK-080` | `library/unit/clock.spec.ts` | runFor › triggers even when some throw |
| `CK-081` | `library/unit/clock.spec.ts` | runFor › calls function with global object or null (strict mode) as this |
| `CK-082` | `library/unit/clock.spec.ts` | runFor › triggers in the order scheduled |
| `CK-083` | `library/unit/clock.spec.ts` | runFor › creates updated Date while ticking |
| `CK-084` | `library/unit/clock.spec.ts` | runFor › fires timer in intervals of 13 |
| `CK-085` | `library/unit/clock.spec.ts` | runFor › fires timer in intervals of "13" |
| `CK-086` | `library/unit/clock.spec.ts` | runFor › fires timers in correct order |
| `CK-087` | `library/unit/clock.spec.ts` | runFor › triggers timeouts and intervals in the order scheduled |
| `CK-088` | `library/unit/clock.spec.ts` | runFor › does not fire canceled intervals |
| `CK-089` | `library/unit/clock.spec.ts` | runFor › throws for negative minutes |
| `CK-090` | `library/unit/clock.spec.ts` | runFor › fires nested setTimeout calls properly |
| `CK-091` | `library/unit/clock.spec.ts` | runFor › does not silently catch errors |
| `CK-092` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes |
| `CK-093` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes 2 |
| `CK-094` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes when an error is thrown |
| `CK-095` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes when an error is thrown 2 |
| `CK-096` | `library/unit/clock.spec.ts` | runFor › throws on negative ticks |
| `CK-097` | `library/unit/clock.spec.ts` | runFor › creates updated Date while ticking promises |
| `CK-098` | `library/unit/clock.spec.ts` | runFor › fires promise timers in correct order |
| `CK-099` | `library/unit/clock.spec.ts` | runFor › does not fire intervals canceled in a promise |
| `CK-100` | `library/unit/clock.spec.ts` | runFor › fires nested setTimeout calls in user-created promises properly |
| `CK-101` | `library/unit/clock.spec.ts` | runFor › is not influenced by forward system clock changes in promises |
| `CK-102` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises |
| `CK-103` | `library/unit/clock.spec.ts` | runFor › should settle chained user-created promises |
| `CK-104` | `library/unit/clock.spec.ts` | runFor › should settle multiple user-created promises |
| `CK-105` | `library/unit/clock.spec.ts` | runFor › should settle nested user-created promises |
| `CK-106` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises even if some throw |
| `CK-107` | `library/unit/clock.spec.ts` | runFor › should settle user-created promises before calling more timeouts |
| `CK-108` | `library/unit/clock.spec.ts` | runFor › should settle local promises before calling timeouts |
| `CK-109` | `library/unit/clock.spec.ts` | runFor › should settle local nested promises before calling timeouts |
| `CK-110` | `library/unit/clock.spec.ts` | runFor › does not rewind back in time |
| `CK-111` | `library/unit/clock.spec.ts` | clearTimeout › removes timeout |
| `CK-112` | `library/unit/clock.spec.ts` | clearTimeout › removes interval |
| `CK-113` | `library/unit/clock.spec.ts` | clearTimeout › removes interval with undefined interval |
| `CK-114` | `library/unit/clock.spec.ts` | clearTimeout › ignores null argument |
| `CK-115` | `library/unit/clock.spec.ts` | setInterval › throws if no arguments |
| `CK-116` | `library/unit/clock.spec.ts` | setInterval › does not throw if \|undefined\| or \|null\| is passed as a callback |
| `CK-117` | `library/unit/clock.spec.ts` | setInterval › returns numeric id or object with numeric id |
| `CK-118` | `library/unit/clock.spec.ts` | setInterval › returns unique id |
| `CK-119` | `library/unit/clock.spec.ts` | setInterval › schedules recurring timeout |
| `CK-120` | `library/unit/clock.spec.ts` | setInterval › is not influenced by forward system clock changes |
| `CK-121` | `library/unit/clock.spec.ts` | setInterval › is not influenced by backward system clock changes |
| `CK-122` | `library/unit/clock.spec.ts` | setInterval › does not schedule recurring timeout when cleared |
| `CK-123` | `library/unit/clock.spec.ts` | setInterval › passes setTimeout parameters |
| `CK-124` | `library/unit/clock.spec.ts` | clearInterval › removes interval |
| `CK-125` | `library/unit/clock.spec.ts` | clearInterval › removes interval with undefined interval |
| `CK-126` | `library/unit/clock.spec.ts` | clearInterval › removes timeout |
| `CK-127` | `library/unit/clock.spec.ts` | clearInterval › ignores null argument |
| `CK-128` | `library/unit/clock.spec.ts` | date › provides date constructor |
| `CK-129` | `library/unit/clock.spec.ts` | date › creates real Date objects |
| `CK-130` | `library/unit/clock.spec.ts` | date › returns date as string when called as function |
| `CK-131` | `library/unit/clock.spec.ts` | date › creates Date objects representing clock time |
| `CK-132` | `library/unit/clock.spec.ts` | date › returns date as string representing clock time |
| `CK-133` | `library/unit/clock.spec.ts` | date › listens to ticking clock |
| `CK-134` | `library/unit/clock.spec.ts` | date › listens to system clock changes |
| `CK-135` | `library/unit/clock.spec.ts` | date › creates regular date when passing timestamp |
| `CK-136` | `library/unit/clock.spec.ts` | date › creates regular date when passing a date as string |
| `CK-137` | `library/unit/clock.spec.ts` | date › creates regular date when passing a date as RFC 2822 string |
| `CK-138` | `library/unit/clock.spec.ts` | date › creates regular date when passing year, month |
| `CK-139` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d |
| `CK-140` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h |
| `CK-141` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m |
| `CK-142` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m, s |
| `CK-143` | `library/unit/clock.spec.ts` | date › creates regular date when passing y, m, d, h, m, s, ms |
| `CK-144` | `library/unit/clock.spec.ts` | date › returns date as string when calling with arguments |
| `CK-145` | `library/unit/clock.spec.ts` | date › returns date as string when calling with timestamp |
| `CK-146` | `library/unit/clock.spec.ts` | date › mirrors native Date.prototype |
| `CK-147` | `library/unit/clock.spec.ts` | date › supports now method if present |
| `CK-148` | `library/unit/clock.spec.ts` | date › returns clock.now() |
| `CK-149` | `library/unit/clock.spec.ts` | date › mirrors parse method |
| `CK-150` | `library/unit/clock.spec.ts` | date › mirrors UTC method |
| `CK-151` | `library/unit/clock.spec.ts` | date › mirrors toUTCString method |
| `CK-152` | `library/unit/clock.spec.ts` | stubTimers › returns clock object |
| `CK-153` | `library/unit/clock.spec.ts` | stubTimers › takes an object parameter |
| `CK-154` | `library/unit/clock.spec.ts` | stubTimers › sets initial timestamp |
| `CK-155` | `library/unit/clock.spec.ts` | stubTimers › replaces global setTimeout |
| `CK-156` | `library/unit/clock.spec.ts` | stubTimers › global fake setTimeout should return id |
| `CK-157` | `library/unit/clock.spec.ts` | stubTimers › replaces global clearTimeout |
| `CK-158` | `library/unit/clock.spec.ts` | stubTimers › replaces global setInterval |
| `CK-159` | `library/unit/clock.spec.ts` | stubTimers › replaces global clearInterval |
| `CK-160` | `library/unit/clock.spec.ts` | stubTimers › replaces global performance.now |
| `CK-161` | `library/unit/clock.spec.ts` | stubTimers › replace Event.prototype.timeStamp |
| `CK-162` | `library/unit/clock.spec.ts` | stubTimers › uninstalls global performance.now |
| `CK-163` | `library/unit/clock.spec.ts` | stubTimers › should let performance.mark still be callable after install() (#136) |
| `CK-164` | `library/unit/clock.spec.ts` | stubTimers › should not alter the global performance properties and methods |
| `CK-165` | `library/unit/clock.spec.ts` | stubTimers › should replace the getEntries, getEntriesByX methods with noops that return \[\] |
| `CK-166` | `library/unit/clock.spec.ts` | stubTimers › should return PerformanceEntry-like objects from performance.mark and performance.measure |
| `CK-167` | `library/unit/clock.spec.ts` | stubTimers › restores global property on uninstall if it was inherited onto the global object |
| `CK-168` | `library/unit/clock.spec.ts` | stubTimers › fakes Date constructor |
| `CK-169` | `library/unit/clock.spec.ts` | stubTimers › fake Date constructor should mirror Date's properties |
| `CK-170` | `library/unit/clock.spec.ts` | stubTimers › mirrors custom Date properties |
| `CK-171` | `library/unit/clock.spec.ts` | stubTimers › uninstalls Date constructor |
| `CK-172` | `library/unit/clock.spec.ts` | stubTimers › fakes provided methods |
| `CK-173` | `library/unit/clock.spec.ts` | stubTimers › resets faked methods |
| `CK-174` | `library/unit/clock.spec.ts` | stubTimers › does not fake methods not provided |
| `CK-175` | `library/unit/clock.spec.ts` | requestAnimationFrame › throws if no arguments |
| `CK-176` | `library/unit/clock.spec.ts` | requestAnimationFrame › returns numeric id or object with numeric id |
| `CK-177` | `library/unit/clock.spec.ts` | requestAnimationFrame › returns unique id |
| `CK-178` | `library/unit/clock.spec.ts` | requestAnimationFrame › should run every 16ms |
| `CK-179` | `library/unit/clock.spec.ts` | requestAnimationFrame › should be called with performance.now() when available |
| `CK-180` | `library/unit/clock.spec.ts` | requestAnimationFrame › should be called with performance.now() even when performance unavailable |
| `CK-181` | `library/unit/clock.spec.ts` | requestAnimationFrame › should call callback once |
| `CK-182` | `library/unit/clock.spec.ts` | requestAnimationFrame › should schedule two callbacks before the next frame at the same time |
| `CK-183` | `library/unit/clock.spec.ts` | requestAnimationFrame › should properly schedule callback for 3rd frame |
| `CK-184` | `library/unit/clock.spec.ts` | requestAnimationFrame › should schedule for next frame if on current frame |
| `CK-185` | `library/unit/clock.spec.ts` | cancelAnimationFrame › removes animation frame |
| `CK-186` | `library/unit/clock.spec.ts` | cancelAnimationFrame › does not remove timeout |
| `CK-187` | `library/unit/clock.spec.ts` | cancelAnimationFrame › does not remove interval |
| `CK-188` | `library/unit/clock.spec.ts` | cancelAnimationFrame › ignores null argument |
| `CK-189` | `library/unit/clock.spec.ts` | fastForward › ignores timers which wouldn't be run |
| `CK-190` | `library/unit/clock.spec.ts` | fastForward › pushes back execution time for skipped timers |
| `CK-191` | `library/unit/clock.spec.ts` | fastForward › handles multiple pending timers and types |
| `CK-192` | `library/unit/clock.spec.ts` | fastForward › does not rewind back in time |
| `CK-193` | `library/unit/clock.spec.ts` | fastForward › error does not break the clock |
| `CK-194` | `library/unit/clock.spec.ts` | fastForward › error does not pause forever |
| `CK-195` | `library/unit/clock.spec.ts` | pauseAt › pause at target time |
| `CK-196` | `library/unit/clock.spec.ts` | pauseAt › fire target timers |
| `CK-197` | `library/unit/clock.spec.ts` | pauseAt › returns consumed clicks |
| `CK-198` | `library/unit/clock.spec.ts` | performance.now() › should start at 0 |
| `CK-199` | `library/unit/clock.spec.ts` | performance.now() › should run along with clock.tick |
| `CK-200` | `library/unit/clock.spec.ts` | performance.now() › should listen to multiple ticks in performance.now |
| `CK-201` | `library/unit/clock.spec.ts` | performance.now() › should run with ticks with timers set |
| `CK-202` | `library/unit/clock.spec.ts` | requestIdleCallback › throws if no arguments |
| `CK-203` | `library/unit/clock.spec.ts` | requestIdleCallback › returns numeric id |
| `CK-204` | `library/unit/clock.spec.ts` | requestIdleCallback › returns unique id |
| `CK-205` | `library/unit/clock.spec.ts` | requestIdleCallback › runs after all timers |
| `CK-206` | `library/unit/clock.spec.ts` | requestIdleCallback › runs no later than timeout option even if there are any timers |
| `CK-207` | `library/unit/clock.spec.ts` | requestIdleCallback › doesn't runs if there are any timers and no timeout option |
| `CK-208` | `library/unit/clock.spec.ts` | cancelIdleCallback › removes idle callback |
| `CK-209` | `library/unit/clock.spec.ts` | Intl API › Executes formatRange like normal |
| `CK-210` | `library/unit/clock.spec.ts` | Intl API › Executes formatRangeToParts like normal |
| `CK-211` | `library/unit/clock.spec.ts` | Intl API › Executes resolvedOptions like normal |
| `CK-212` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns true when passed a timestamp argument that is first of the month |
| `CK-213` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns false when passed a timestamp argument that is not first of the month |
| `CK-214` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns true when passed no timestamp and system time is first of the month |
| `CK-215` | `library/unit/clock.spec.ts` | Intl API › formatToParts via isFirstOfMonth -\> Returns false when passed no timestamp and system time is not first of the month |
| `CK-216` | `library/unit/clock.spec.ts` | Intl API › Executes supportedLocalesOf like normal |
| `CK-217` | `library/unit/clock.spec.ts` | Intl API › Creates a RelativeTimeFormat like normal |
| `CK-218` | `library/unit/clock.spec.ts` | works with slow setTimeout in busy embedder |
| `CK-219` | `library/unit/clock.spec.ts` | works with slow setTimeout in busy embedder when not paused |

### CL — Click

| ID | File | Title |
|---|---|---|
| `CL-001` | `page/page-click.spec.ts` | should click the button @smoke |
| `CL-002` | `page/page-click.spec.ts` | should click button inside frameset |
| `CL-003` | `page/page-click.spec.ts` | should issue clicks in parallel in page and popup |
| `CL-004` | `page/page-click.spec.ts` | should click svg |
| `CL-005` | `page/page-click.spec.ts` | should click the button if window.Node is removed |
| `CL-006` | `page/page-click.spec.ts` | should click on a span with an inline element inside |
| `CL-007` | `page/page-click.spec.ts` | should click the aligned 1x1 div |
| `CL-008` | `page/page-click.spec.ts` | should click the half-aligned 1x1 div |
| `CL-009` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v1 |
| `CL-010` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v2 |
| `CL-011` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v3 |
| `CL-012` | `page/page-click.spec.ts` | should click the unaligned 1x1 div v4 |
| `CL-013` | `page/page-click.spec.ts` | should click the button after navigation  |
| `CL-014` | `page/page-click.spec.ts` | should click the button after a cross origin navigation  |
| `CL-015` | `page/page-click.spec.ts` | should click when one of inline box children is outside of viewport |
| `CL-016` | `page/page-click.spec.ts` | should select the text by triple clicking |
| `CL-017` | `page/page-click.spec.ts` | should click offscreen buttons |
| `CL-018` | `page/page-click.spec.ts` | should waitFor visible when already visible |
| `CL-019` | `page/page-click.spec.ts` | should not wait with force |
| `CL-020` | `page/page-click.spec.ts` | should waitFor display:none to be gone |
| `CL-021` | `page/page-click.spec.ts` | should waitFor visibility:hidden to be gone |
| `CL-022` | `page/page-click.spec.ts` | should waitFor visible when parent is hidden |
| `CL-023` | `page/page-click.spec.ts` | should click wrapped links |
| `CL-024` | `page/page-click.spec.ts` | should click on checkbox input and toggle |
| `CL-025` | `page/page-click.spec.ts` | should click on checkbox label and toggle |
| `CL-026` | `page/page-click.spec.ts` | should scroll and click the button |
| `CL-027` | `page/page-click.spec.ts` | should scroll and click the button with smooth scroll behavior |
| `CL-028` | `page/page-click.spec.ts` | should double click the button |
| `CL-029` | `page/page-click.spec.ts` | should click a partially obscured button |
| `CL-030` | `page/page-click.spec.ts` | should click a rotated button |
| `CL-031` | `page/page-click.spec.ts` | should fire contextmenu event on right click |
| `CL-032` | `page/page-click.spec.ts` | should click links which cause navigation |
| `CL-033` | `page/page-click.spec.ts` | should not wait for navigation after clicking a link answered with 204 |
| `CL-034` | `page/page-click.spec.ts` | should click the button inside an iframe |
| `CL-035` | `page/page-click.spec.ts` | should click the button with fixed position inside an iframe |
| `CL-036` | `page/page-click.spec.ts` | should click the button behind sticky header |
| `CL-037` | `page/page-click.spec.ts` | should click the button behind position:absolute header |
| `CL-038` | `page/page-click.spec.ts` | should click the button with px border with offset |
| `CL-039` | `page/page-click.spec.ts` | should click the button with em border with offset |
| `CL-040` | `page/page-click.spec.ts` | should click a very large button with offset |
| `CL-041` | `page/page-click.spec.ts` | should click a button in scrolling container with offset |
| `CL-042` | `page/page-click.spec.ts` | should wait for stable position |
| `CL-043` | `page/page-click.spec.ts` | should wait for becoming hit target |
| `CL-044` | `page/page-click.spec.ts` | should wait for becoming hit target with trial run |
| `CL-045` | `page/page-click.spec.ts` | trial run should work with short timeout |
| `CL-046` | `page/page-click.spec.ts` | trial run should not click |
| `CL-047` | `page/page-click.spec.ts` | trial run should not double click |
| `CL-048` | `page/page-click.spec.ts` | should fail when obscured and not waiting for hit target |
| `CL-049` | `page/page-click.spec.ts` | should wait for button to be enabled |
| `CL-050` | `page/page-click.spec.ts` | should wait for element to become non-inert |
| `CL-051` | `page/page-click.spec.ts` | should wait for modal dialog to close |
| `CL-052` | `page/page-click.spec.ts` | should wait for input to be enabled |
| `CL-053` | `page/page-click.spec.ts` | should wait for select to be enabled |
| `CL-054` | `page/page-click.spec.ts` | should click disabled div |
| `CL-055` | `page/page-click.spec.ts` | should wait for BUTTON to be clickable when it has pointer-events:none |
| `CL-056` | `page/page-click.spec.ts` | should wait for LABEL to be clickable when it has pointer-events:none |
| `CL-057` | `page/page-click.spec.ts` | should update modifiers correctly |
| `CL-058` | `page/page-click.spec.ts` | should click an offscreen element when scroll-behavior is smooth |
| `CL-059` | `page/page-click.spec.ts` | should report nice error when element is detached and force-clicked |
| `CL-060` | `page/page-click.spec.ts` | should fail when element detaches after animation |
| `CL-061` | `page/page-click.spec.ts` | should retry when element detaches after animation |
| `CL-062` | `page/page-click.spec.ts` | should retry when element is animating from outside the viewport |
| `CL-063` | `page/page-click.spec.ts` | should fail when element is animating from outside the viewport with force |
| `CL-064` | `page/page-click.spec.ts` | should dispatch microtasks in order |
| `CL-065` | `page/page-click.spec.ts` | should click the button when window.innerWidth is corrupted |
| `CL-066` | `page/page-click.spec.ts` | should click zero-sized input by label |
| `CL-067` | `page/page-click.spec.ts` | should not throw protocol error when navigating during the click |
| `CL-068` | `page/page-click.spec.ts` | should retry when navigating during the click |
| `CL-069` | `page/page-click.spec.ts` | should not hang when frame is detached |
| `CL-070` | `page/page-click.spec.ts` | should climb dom for inner label with pointer-events:none |
| `CL-071` | `page/page-click.spec.ts` | should climb up to \[role=button\] |
| `CL-072` | `page/page-click.spec.ts` | should climb up to a anchor |
| `CL-073` | `page/page-click.spec.ts` | should climb up to a \[role=link\] |
| `CL-074` | `page/page-click.spec.ts` | should click in an iframe with border |
| `CL-075` | `page/page-click.spec.ts` | should click in an iframe with border 2 |
| `CL-076` | `page/page-click.spec.ts` | should not retain removed iframe after clicking inside it |
| `CL-077` | `page/page-click.spec.ts` | should click in a transformed iframe |
| `CL-078` | `page/page-click.spec.ts` | should click a button that is overlaid by a permission popup |
| `CL-079` | `page/page-click.spec.ts` | should click in a transformed iframe with force |
| `CL-080` | `page/page-click.spec.ts` | should click in a nested transformed iframe |
| `CL-081` | `page/page-click.spec.ts` | ensure events are dispatched in the individual tasks |
| `CL-082` | `page/page-click.spec.ts` | should click if opened select covers the button |
| `CL-083` | `page/page-click.spec.ts` | should fire contextmenu event on right click in correct order |
| `CL-084` | `page/page-click.spec.ts` | should click after a right click |
| `CL-085` | `page/page-click.spec.ts` | should set PointerEvent.pressure on pointerdown |
| `CL-086` | `page/page-click.spec.ts` | should set PointerEvent.pressure on pointermove |
| `CL-087` | `page/page-click.spec.ts` | should click into shadow root with slotted div |
| `CL-088` | `page/page-click.spec.ts` | should click shadow root button |
| `CL-089` | `page/page-click.spec.ts` | should click with tweened mouse movement |
| `CL-090` | `page/page-click.spec.ts` | should abort via signal |
| `CL-091` | `page/page-click.spec.ts` | should throw an Error when aborted in-flight with a string reason |
| `CL-092` | `page/page-click.spec.ts` | should abort via already-aborted signal |
| `CL-093` | `page/page-click.spec.ts` | should throw an Error when aborted via an already-aborted signal with a string reason |
| `CL-094` | `page/page-click-scroll.spec.ts` | should not hit scroll bar |
| `CL-095` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents |
| `CL-096` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents with a child |
| `CL-097` | `page/page-click-scroll.spec.ts` | should scroll into view display:contents with position |
| `CL-098` | `page/page-click-scroll.spec.ts` | should not crash when force-clicking hidden input |
| `CL-099` | `page/page-click-scroll.spec.ts` | should scroll into view span element |
| `CL-100` | `page/page-click-scroll.spec.ts` | should scroll into view element in iframe |
| `CL-101` | `page/page-click-scroll.spec.ts` | should not scroll the page when scroll is "none" |
| `CL-102` | `page/page-click-scroll.spec.ts` | should click in-viewport element when scroll is "none" |
| `CL-103` | `page/page-click-scroll.spec.ts` | should not scroll nested container when scroll is "none" |
| `CL-104` | `page/page-click-scroll.spec.ts` | should not scroll on hover when scroll is "none" |
| `CL-105` | `page/page-click-scroll.spec.ts` | should scroll instantly on retry when scroll-behavior is smooth |
| `CL-106` | `page/page-click-react.spec.ts` | should timeout when click opens alert |
| `CL-107` | `page/page-click-react.spec.ts` | should not retarget when element changes on hover |
| `CL-108` | `page/page-click-react.spec.ts` | should not retarget when element is recycled on hover |
| `CL-109` | `page/page-click-during-navigation.spec.ts` | should not fail with internal error upon navigation |
| `CL-110` | `page/page-click-timeout-1.spec.ts` | should avoid side effects after timeout |
| `CL-111` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for button to be enabled |
| `CL-112` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for inert element to become non-inert |
| `CL-113` | `page/page-click-timeout-1.spec.ts` | should timeout waiting for element outside of a modal dialog |
| `CL-114` | `page/page-click-timeout-2.spec.ts` | should timeout waiting for display:none to be gone |
| `CL-115` | `page/page-click-timeout-2.spec.ts` | should timeout waiting for visibility:hidden to be gone |
| `CL-116` | `page/page-click-timeout-3.spec.ts` | should fail when element jumps during hit testing |
| `CL-117` | `page/page-click-timeout-3.spec.ts` | should timeout waiting for hit target |
| `CL-118` | `page/page-click-timeout-3.spec.ts` | should still click when force but hit target is obscured |
| `CL-119` | `page/page-click-timeout-3.spec.ts` | should report wrong hit target subtree |
| `CL-120` | `page/page-click-timeout-4.spec.ts` | should timeout waiting for stable position |
| `CL-121` | `page/page-click-timeout-4.spec.ts` | should click for the second time after first timeout |
| `CL-122` | `page/page-click-timeout-4.spec.ts` | should fail to click the button behind a large header after scrolling around |

### CM — Console messages

| ID | File | Title |
|---|---|---|
| `CM-001` | `page/page-event-console.spec.ts` | should work @smoke |
| `CM-002` | `page/page-event-console.spec.ts` | should emit same log twice |
| `CM-003` | `page/page-event-console.spec.ts` | should use text() for inspection |
| `CM-004` | `page/page-event-console.spec.ts` | should work for different console API calls |
| `CM-005` | `page/page-event-console.spec.ts` | should format the message correctly with time/timeLog/timeEnd |
| `CM-006` | `page/page-event-console.spec.ts` | should not fail for window object |
| `CM-007` | `page/page-event-console.spec.ts` | should not fail for object that can't be coerced to a primitive |
| `CM-008` | `page/page-event-console.spec.ts` | should trigger correct Log |
| `CM-009` | `page/page-event-console.spec.ts` | should have location for console API calls |
| `CM-010` | `page/page-event-console.spec.ts` | should not throw when there are console messages in detached iframes |
| `CM-011` | `page/page-event-console.spec.ts` | should use object previews for arrays and objects |
| `CM-012` | `page/page-event-console.spec.ts` | should use object previews for errors |
| `CM-013` | `page/page-event-console.spec.ts` | do not update console count on unhandled rejections |
| `CM-014` | `page/page-event-console.spec.ts` | should have timestamp |
| `CM-015` | `page/page-event-console.spec.ts` | should have increasing timestamps |
| `CM-016` | `page/page-event-console.spec.ts` | should have timestamp in consoleMessages |
| `CM-017` | `page/page-event-console.spec.ts` | consoleMessages should work |
| `CM-018` | `page/page-event-console.spec.ts` | clearConsoleMessages should work |
| `CM-019` | `page/page-event-console.spec.ts` | consoleMessages since-navigation filter should work |
| `CM-020` | `page/page-event-console.spec.ts` | pageErrors since-navigation filter should work |

### CN — Channels

| ID | File | Title |
|---|---|---|
| `CN-001` | `library/channels.spec.ts` | should scope context handles |
| `CN-002` | `library/channels.spec.ts` | should scope CDPSession handles |
| `CN-003` | `library/channels.spec.ts` | should scope browser handles |
| `CN-004` | `library/channels.spec.ts` | should not generate dispatchers for subresources w/o listeners |
| `CN-005` | `library/channels.spec.ts` | should work with the domain module |
| `CN-006` | `library/channels.spec.ts` | exposeFunction should not leak |

### CO — Cookies

| ID | File | Title |
|---|---|---|
| `CO-001` | `library/browsercontext-cookies.spec.ts` | should return no cookies in pristine browser context |
| `CO-002` | `library/browsercontext-cookies.spec.ts` | should get a cookie @smoke |
| `CO-003` | `library/browsercontext-cookies.spec.ts` | should get a non-session cookie |
| `CO-004` | `library/browsercontext-cookies.spec.ts` | should allow adding cookies with \>400 days expiration |
| `CO-005` | `library/browsercontext-cookies.spec.ts` | should properly report httpOnly cookie |
| `CO-006` | `library/browsercontext-cookies.spec.ts` | should properly report "Strict" sameSite cookie |
| `CO-007` | `library/browsercontext-cookies.spec.ts` | should properly report "Lax" sameSite cookie |
| `CO-008` | `library/browsercontext-cookies.spec.ts` | should get multiple cookies |
| `CO-009` | `library/browsercontext-cookies.spec.ts` | should get cookies from multiple urls |
| `CO-010` | `library/browsercontext-cookies.spec.ts` | should work with subdomain cookie |
| `CO-011` | `library/browsercontext-cookies.spec.ts` | should only return cookies that apply to the url |
| `CO-012` | `library/browsercontext-cookies.spec.ts` | should return cookies with empty value |
| `CO-013` | `library/browsercontext-cookies.spec.ts` | should return secure cookies based on HTTP(S) protocol |
| `CO-014` | `library/browsercontext-cookies.spec.ts` | should return secure cookies for http {127.0.0.1, \[::1\]} *(2 copies)* |
| `CO-015` | `library/browsercontext-cookies.spec.ts` | should add cookies with an expiration |
| `CO-016` | `library/browsercontext-cookies.spec.ts` | should support requestStorageAccess |
| `CO-017` | `library/browsercontext-cookies.spec.ts` | should parse cookie with large Max-Age correctly |
| `CO-018` | `library/browsercontext-cookies.spec.ts` | iframe should inherit cookies from parent |
| `CO-019` | `library/browsercontext-add-cookies.spec.ts` | should work @smoke |
| `CO-020` | `library/browsercontext-add-cookies.spec.ts` | should work with expires=-1 |
| `CO-021` | `library/browsercontext-add-cookies.spec.ts` | should add cookies with empty value |
| `CO-022` | `library/browsercontext-add-cookies.spec.ts` | should set cookies with SameSite attribute and no secure attribute |
| `CO-023` | `library/browsercontext-add-cookies.spec.ts` | should roundtrip cookie |
| `CO-024` | `library/browsercontext-add-cookies.spec.ts` | should send cookie header |
| `CO-025` | `library/browsercontext-add-cookies.spec.ts` | should isolate cookies in browser contexts |
| `CO-026` | `library/browsercontext-add-cookies.spec.ts` | should isolate session cookies |
| `CO-027` | `library/browsercontext-add-cookies.spec.ts` | should isolate persistent cookies |
| `CO-028` | `library/browsercontext-add-cookies.spec.ts` | should isolate send cookie header |
| `CO-029` | `library/browsercontext-add-cookies.spec.ts` | should isolate cookies between launches |
| `CO-030` | `library/browsercontext-add-cookies.spec.ts` | should set multiple cookies |
| `CO-031` | `library/browsercontext-add-cookies.spec.ts` | should have \|expires\| set to \|-1\| for session cookies |
| `CO-032` | `library/browsercontext-add-cookies.spec.ts` | should set cookie with reasonable defaults |
| `CO-033` | `library/browsercontext-add-cookies.spec.ts` | should set a cookie with a path |
| `CO-034` | `library/browsercontext-add-cookies.spec.ts` | should not set a cookie with blank page URL |
| `CO-035` | `library/browsercontext-add-cookies.spec.ts` | should not set a cookie on a data URL page |
| `CO-036` | `library/browsercontext-add-cookies.spec.ts` | should default to setting secure cookie for HTTPS websites |
| `CO-037` | `library/browsercontext-add-cookies.spec.ts` | should be able to set unsecure cookie for HTTP website |
| `CO-038` | `library/browsercontext-add-cookies.spec.ts` | should set a cookie on a different domain |
| `CO-039` | `library/browsercontext-add-cookies.spec.ts` | should set cookies for a frame |
| `CO-040` | `library/browsercontext-add-cookies.spec.ts` | should allow unnamed cookies |
| `CO-041` | `library/browsercontext-add-cookies.spec.ts` | should set secure cookies on secure WebSocket |
| `CO-042` | `library/browsercontext-clearcookies.spec.ts` | should clear cookies |
| `CO-043` | `library/browsercontext-clearcookies.spec.ts` | should isolate cookies when clearing |
| `CO-044` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name |
| `CO-045` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name regex |
| `CO-046` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by domain |
| `CO-047` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by path |
| `CO-048` | `library/browsercontext-clearcookies.spec.ts` | should remove cookies by name and domain |
| `CO-049` | `library/browsercontext-clearcookies.spec.ts` | should not transiently delete non-matching cookies when filtering |
| `CO-050` | `library/browsercontext-clearcookies.spec.ts` | should remove partitioned cookies by name |
| `CO-051` | `library/browsercontext-clearcookies.spec.ts` | should remove nameless cookies by empty name |
| `CO-052` | `library/browsercontext-cookies-third-party.spec.ts` | third party non-partitioned cookies |
| `CO-053` | `library/browsercontext-cookies-third-party.spec.ts` | save/load third party non-partitioned cookies |
| `CO-054` | `library/browsercontext-cookies-third-party.spec.ts` | third party 'Partitioned;' cookies |
| `CO-055` | `library/browsercontext-cookies-third-party.spec.ts` | save/load third party 'Partitioned;' cookies |
| `CO-056` | `library/browsercontext-cookies-third-party.spec.ts` | add 'Partitioned;' cookie via API |
| `CO-057` | `library/browsercontext-cookies-third-party.spec.ts` | same origin third party 'Partitioned;' cookie with different origin intermediate iframe |
| `CO-058` | `library/browsercontext-cookies-third-party.spec.ts` | top level 'Partitioned;' cookie and same origin iframe |
| `CO-059` | `library/browsercontext-cookies-third-party.spec.ts` | should be able to send third party cookies via an iframe |
| `CO-060` | `library/browsercontext-cookies-third-party.spec.ts` | should(not) block third party cookies - persistent context |
| `CO-061` | `library/browsercontext-cookies-third-party.spec.ts` | should(not) block third party cookies - ephemeral context |
| `CO-062` | `library/browsercontext-cookies-third-party.spec.ts` | should not block third party SameSite=None cookies |

### CR — Chromium

| ID | File | Title |
|---|---|---|
| `CR-001` | `library/chromium/chromium.spec.ts` | should create a worker from a service worker |
| `CR-002` | `library/chromium/chromium.spec.ts` | should create a worker from service worker with noop routing |
| `CR-003` | `library/chromium/chromium.spec.ts` | should emit new service worker on update |
| `CR-004` | `library/chromium/chromium.spec.ts` | http credentials › httpCredentials |
| `CR-005` | `library/chromium/chromium.spec.ts` | serviceWorkers() should return current workers |
| `CR-006` | `library/chromium/chromium.spec.ts` | should not create a worker from a shared worker |
| `CR-008` | `library/chromium/chromium.spec.ts` | should close service worker together with the context |
| `CR-009` | `library/chromium/chromium.spec.ts` | should pass args with spaces |
| `CR-010` | `library/chromium/chromium.spec.ts` | serviceWorker(), and fromServiceWorker() work |
| `CR-011` | `library/chromium/chromium.spec.ts` | should intercept service worker requests (main and within) |
| `CR-012` | `library/chromium/chromium.spec.ts` | should report failure (due to content-type) of main service worker request |
| `CR-013` | `library/chromium/chromium.spec.ts` | should report failure (due to redirect) of main service worker request |
| `CR-014` | `library/chromium/chromium.spec.ts` | should intercept service worker importScripts |
| `CR-015` | `library/chromium/chromium.spec.ts` | should report intercepted service worker requests in HAR |
| `CR-016` | `library/chromium/chromium.spec.ts` | should intercept only serviceworker request, not page |
| `CR-017` | `library/chromium/chromium.spec.ts` | should produce network events, routing, and annotations for Service Worker |
| `CR-018` | `library/chromium/chromium.spec.ts` | should produce network events, routing, and annotations for Service Worker (advanced) |
| `CR-019` | `library/chromium/chromium.spec.ts` | should intercept service worker update requests |
| `CR-020` | `library/chromium/chromium.spec.ts` | setOffline |
| `CR-021` | `library/chromium/chromium.spec.ts` | setExtraHTTPHeaders |
| `CR-022` | `library/chromium/chromium.spec.ts` | should throw when connecting twice to an already running persistent context (--remote-debugging-port) |
| `CR-023` | `library/chromium/chromium.spec.ts` | should throw when connecting twice to an already running persistent context (--remote-debugging-pipe) |
| `CR-024` | `library/chromium/chromium.spec.ts` | PLAYWRIGHT\_DISABLE\_SERVICE\_WORKER\_NETWORK |
| `CR-025` | `library/chromium/chromium.spec.ts` | should emit console messages from service worker |
| `CR-026` | `library/chromium/chromium.spec.ts` | should capture console.log from ServiceWorker start |
| `CR-027` | `library/chromium/chromium.spec.ts` | WebUI navigation › should refuse WebUI pages that crash the browser in an isolated context |
| `CR-028` | `library/chromium/chromium.spec.ts` | WebUI navigation › should refuse WebUI pages that crash Edge in an isolated context |
| `CR-029` | `library/chromium/chromium.spec.ts` | WebUI navigation › should navigate to WebUI pages that work in an isolated context |
| `CR-030` | `library/chromium/chromium.spec.ts` | WebUI navigation › should navigate to any WebUI page in a persistent context |
| `CR-031` | `library/chromium/chromium.spec.ts` | should fire dialogclosed event when dialog is closed out of band |
| `CR-032` | `library/chromium/chromium.spec.ts` | should not leak service worker session after context close |
| `CR-033` | `library/chromium/launcher.spec.ts` | should throw with remote-debugging-pipe argument |
| `CR-034` | `library/chromium/launcher.spec.ts` | should not throw with remote-debugging-port argument |
| `CR-035` | `library/chromium/launcher.spec.ts` | should not create pages automatically |
| `CR-036` | `library/chromium/extensions.spec.ts` | MV3 › should support service worker stop and restart lifecycle |
| `CR-037` | `library/chromium/extensions.spec.ts` | MV3 › should give access to the service worker |
| `CR-038` | `library/chromium/extensions.spec.ts` | MV3 › should give access to the service worker when recording video |
| `CR-039` | `library/chromium/extensions.spec.ts` | MV3 › should support request/response events in the service worker |
| `CR-040` | `library/chromium/extensions.spec.ts` | MV3 › should report console messages from content script |
| `CR-041` | `library/chromium/extensions.spec.ts` | MV3 › should use custom userAgent in service worker fetch requests |
| `CR-042` | `library/chromium/bfcache.spec.ts` | bindings should work after restoring from bfcache |
| `CR-043` | `library/chromium/connect-to-worker.spec.ts` | should connect, evaluate, receive console and disconnect |
| `CR-044` | `library/chromium/connect-to-worker.spec.ts` | should receive close when node process exits |
| `CR-045` | `library/chromium/disable-web-security.spec.ts` | test utility world in popup w/ --disable-web-security |
| `CR-046` | `library/chromium/disable-web-security.spec.ts` | test init script w/ --disable-web-security |

### CS — CSP

| ID | File | Title |
|---|---|---|
| `CS-001` | `library/browsercontext-csp.spec.ts` | should bypass CSP meta tag @smoke |
| `CS-002` | `library/browsercontext-csp.spec.ts` | should bypass CSP header |
| `CS-003` | `library/browsercontext-csp.spec.ts` | should bypass after cross-process navigation |
| `CS-004` | `library/browsercontext-csp.spec.ts` | should bypass CSP in iframes as well |
| `CS-005` | `library/browsercontext-csp.spec.ts` | should not crash on javascript: navigation |

### CV — Coverage

| ID | File | Title |
|---|---|---|
| `CV-001` | `library/chromium/js-coverage.spec.ts` | should work |
| `CV-002` | `library/chromium/js-coverage.spec.ts` | should report sourceURLs |
| `CV-003` | `library/chromium/js-coverage.spec.ts` | should ignore eval() scripts by default |
| `CV-004` | `library/chromium/js-coverage.spec.ts` | shouldn't ignore eval() scripts if reportAnonymousScripts is true |
| `CV-005` | `library/chromium/js-coverage.spec.ts` | should report multiple scripts |
| `CV-006` | `library/chromium/js-coverage.spec.ts` | should NOT report scripts across navigations when enabled |
| `CV-007` | `library/chromium/js-coverage.spec.ts` | should not hang when there is a debugger statement |
| `CV-008` | `library/chromium/css-coverage.spec.ts` | should work |
| `CV-009` | `library/chromium/css-coverage.spec.ts` | should report sourceURLs |
| `CV-010` | `library/chromium/css-coverage.spec.ts` | should report multiple stylesheets |
| `CV-011` | `library/chromium/css-coverage.spec.ts` | should report stylesheets that have no coverage |
| `CV-012` | `library/chromium/css-coverage.spec.ts` | should work with media queries |
| `CV-013` | `library/chromium/css-coverage.spec.ts` | should work with complicated usecases |
| `CV-014` | `library/chromium/css-coverage.spec.ts` | should ignore injected stylesheets |
| `CV-015` | `library/chromium/css-coverage.spec.ts` | should report stylesheets across navigations |
| `CV-016` | `library/chromium/css-coverage.spec.ts` | should NOT report scripts across navigations |
| `CV-017` | `library/chromium/css-coverage.spec.ts` | should work with a recently loaded stylesheet |
| `CV-018` | `library/coverage.spec.ts` | should collect istanbul coverage into the trace |
| `CV-019` | `library/coverage.spec.ts` | should collect coverage per trace chunk |
| `CV-020` | `library/coverage.spec.ts` | should report maps once and counters incrementally |
| `CV-021` | `library/coverage.spec.ts` | should accumulate counters across pulls and keep never hit files |
| `CV-022` | `library/coverage.spec.ts` | should collect coverage of a page closed by in-page script |
| `CV-023` | `library/coverage.spec.ts` | should not double count a stash picked up twice |
| `CV-024` | `library/coverage.spec.ts` | should discard stashes of other sessions |
| `CV-025` | `library/coverage.spec.ts` | should collect coverage of an origin left without a page |
| `CV-026` | `library/coverage.spec.ts` | should pull counters as the actions go |
| `CV-027` | `library/coverage.spec.ts` | should not collect coverage without the option |
| `CV-028` | `library/coverage.spec.ts` | should count only the hits after start |
| `CV-029` | `library/coverage.spec.ts` | should stop collecting when tracing stops |
| `CV-030` | `library/coverage.spec.ts` | should surface a failure to stash the coverage |

### DB — Debug

| ID | File | Title |
|---|---|---|
| `DB-001` | `library/debugger.spec.ts` | should pause at next and resume |
| `DB-002` | `library/debugger.spec.ts` | should pause at pause call |
| `DB-003` | `library/debugger.spec.ts` | should run to location |
| `DB-004` | `library/debugger.spec.ts` | should stream api calls via \_enable |
| `DB-005` | `library/debugger.spec.ts` | should report error status for failed api calls |
| `DB-006` | `library/debugger.spec.ts` | should not stream internal api calls |
| `DB-007` | `library/debugger.spec.ts` | should not pause at internal api calls |
| `DB-008` | `library/debugger.spec.ts` | should expose the action point while paused on an input action |
| `DB-009` | `library/debugger.spec.ts` | should replay ongoing calls when enabled late |
| `DB-010` | `library/debugger.spec.ts` | should keep pause working when api calls are enabled |
| `DB-011` | `library/debug-controller.spec.ts` | should pick element |
| `DB-012` | `library/debug-controller.spec.ts` | should report pages |
| `DB-013` | `library/debug-controller.spec.ts` | should reset for reuse |
| `DB-014` | `library/debug-controller.spec.ts` | should highlight all |
| `DB-015` | `library/debug-controller.spec.ts` | should record |
| `DB-016` | `library/debug-controller.spec.ts` | should record expect signal |
| `DB-017` | `library/debug-controller.spec.ts` | should record custom data-testid |
| `DB-018` | `library/debug-controller.spec.ts` | should not leak actions from the previous recording session |
| `DB-019` | `library/debug-controller.spec.ts` | should reset routes before reuse |
| `DB-020` | `library/debug-controller.spec.ts` | should highlight inside iframe |
| `DB-021` | `library/debug-controller.spec.ts` | should highlight aria template |
| `DB-022` | `library/debug-controller.spec.ts` | should report error in aria template |

### DC — Default (persistent) context

| ID | File | Title |
|---|---|---|
| `DC-001` | `library/defaultbrowsercontext-1.spec.ts` | context.cookies() should work @smoke |
| `DC-002` | `library/defaultbrowsercontext-1.spec.ts` | context.addCookies() should work |
| `DC-003` | `library/defaultbrowsercontext-1.spec.ts` | context.clearCookies() should work |
| `DC-004` | `library/defaultbrowsercontext-1.spec.ts` | should support viewport option |
| `DC-005` | `library/defaultbrowsercontext-1.spec.ts` | should support deviceScaleFactor option |
| `DC-006` | `library/defaultbrowsercontext-1.spec.ts` | should support userAgent option |
| `DC-007` | `library/defaultbrowsercontext-1.spec.ts` | should support bypassCSP option |
| `DC-008` | `library/defaultbrowsercontext-1.spec.ts` | should support javascriptEnabled option |
| `DC-009` | `library/defaultbrowsercontext-1.spec.ts` | should support httpCredentials option |
| `DC-010` | `library/defaultbrowsercontext-1.spec.ts` | should support offline option |
| `DC-011` | `library/defaultbrowsercontext-1.spec.ts` | should support acceptDownloads option |
| `DC-012` | `library/defaultbrowsercontext-2.spec.ts` | should support hasTouch option |
| `DC-013` | `library/defaultbrowsercontext-2.spec.ts` | should work in persistent context |
| `DC-014` | `library/defaultbrowsercontext-2.spec.ts` | should support colorScheme option |
| `DC-015` | `library/defaultbrowsercontext-2.spec.ts` | should support reducedMotion option |
| `DC-016` | `library/defaultbrowsercontext-2.spec.ts` | should support forcedColors option |
| `DC-017` | `library/defaultbrowsercontext-2.spec.ts` | should support contrast option |
| `DC-018` | `library/defaultbrowsercontext-2.spec.ts` | should support timezoneId option |
| `DC-019` | `library/defaultbrowsercontext-2.spec.ts` | should support locale option |
| `DC-020` | `library/defaultbrowsercontext-2.spec.ts` | should support geolocation and permissions options |
| `DC-021` | `library/defaultbrowsercontext-2.spec.ts` | should support ignoreHTTPSErrors option |
| `DC-022` | `library/defaultbrowsercontext-2.spec.ts` | should support extraHTTPHeaders option |
| `DC-023` | `library/defaultbrowsercontext-2.spec.ts` | should accept userDataDir |
| `DC-024` | `library/defaultbrowsercontext-2.spec.ts` | should accept relative userDataDir |
| `DC-025` | `library/defaultbrowsercontext-2.spec.ts` | should restore state from userDataDir |
| `DC-026` | `library/defaultbrowsercontext-2.spec.ts` | should create userDataDir if it does not exist |
| `DC-027` | `library/defaultbrowsercontext-2.spec.ts` | should goto about:blank on relaunched persistent context |
| `DC-028` | `library/defaultbrowsercontext-2.spec.ts` | should have default URL when launching browser |
| `DC-029` | `library/defaultbrowsercontext-2.spec.ts` | should throw if page argument is passed |
| `DC-030` | `library/defaultbrowsercontext-2.spec.ts` | should have passed URL when launching with ignoreDefaultArgs: true |
| `DC-031` | `library/defaultbrowsercontext-2.spec.ts` | should handle timeout |
| `DC-032` | `library/defaultbrowsercontext-2.spec.ts` | should handle exception |
| `DC-033` | `library/defaultbrowsercontext-2.spec.ts` | should fire close event for a persistent context |
| `DC-034` | `library/defaultbrowsercontext-2.spec.ts` | coverage should work |
| `DC-035` | `library/defaultbrowsercontext-2.spec.ts` | should respect selectors |
| `DC-036` | `library/defaultbrowsercontext-2.spec.ts` | should connect to a browser with the default page |
| `DC-037` | `library/defaultbrowsercontext-2.spec.ts` | should support har option |
| `DC-038` | `library/defaultbrowsercontext-2.spec.ts` | user agent is up to date |
| `DC-039` | `library/defaultbrowsercontext-2.spec.ts` | dialog.accept should work |
| `DC-040` | `library/defaultbrowsercontext-2.spec.ts` | CacheStorage entry should survive page.reload() |
| `DC-041` | `library/defaultbrowsercontext-2.spec.ts` | exposes browser |
| `DC-042` | `library/defaultbrowsercontext-2.spec.ts` | should support storage.getDirectory() |

### DD — Drag and drop

| ID | File | Title |
|---|---|---|
| `DD-001` | `page/page-drag.spec.ts` | Drag and drop › should work @smoke |
| `DD-002` | `page/page-drag.spec.ts` | Drag and drop › should send the right events |
| `DD-003` | `page/page-drag.spec.ts` | Drag and drop › should not send dragover on the first mousemove |
| `DD-004` | `page/page-drag.spec.ts` | Drag and drop › should work inside iframe |
| `DD-005` | `page/page-drag.spec.ts` | Drag and drop › should cancel on escape |
| `DD-006` | `page/page-drag.spec.ts` | Drag and drop › iframe › should drag into an iframe |
| `DD-007` | `page/page-drag.spec.ts` | Drag and drop › iframe › should drag out of an iframe |
| `DD-008` | `page/page-drag.spec.ts` | Drag and drop › should respect the drop effect |
| `DD-009` | `page/page-drag.spec.ts` | Drag and drop › should work if the drag is canceled |
| `DD-010` | `page/page-drag.spec.ts` | Drag and drop › should work if the drag event is captured but not canceled |
| `DD-011` | `page/page-drag.spec.ts` | Drag and drop › should be able to drag the mouse in a frame |
| `DD-012` | `page/page-drag.spec.ts` | Drag and drop › should work if a frame is stalled |
| `DD-013` | `page/page-drag.spec.ts` | Drag and drop › should work with the helper method |
| `DD-014` | `page/page-drag.spec.ts` | Drag and drop › should {dragAndDrop, dragTo} with tweened mouse movement *(2 copies)* |
| `DD-015` | `page/page-drag.spec.ts` | Drag and drop › should allow specifying the position |
| `DD-016` | `page/page-drag.spec.ts` | Drag and drop › should work with locators |
| `DD-017` | `page/page-drag.spec.ts` | should work if not doing a drag |
| `DD-018` | `page/page-drag.spec.ts` | should report event.buttons |
| `DD-019` | `page/page-drag.spec.ts` | should handle custom dataTransfer |
| `DD-020` | `page/page-drag.spec.ts` | what happens when dragging element is destroyed |
| `DD-021` | `page/page-drop.spec.ts` | should drop a file payload |
| `DD-022` | `page/page-drop.spec.ts` | should drop multiple file payloads |
| `DD-023` | `page/page-drop.spec.ts` | should drop a file by local path |
| `DD-024` | `page/page-drop.spec.ts` | should drop clipboard-like data |
| `DD-025` | `page/page-drop.spec.ts` | should drop files and data together |
| `DD-026` | `page/page-drop.spec.ts` | should throw when target does not accept drop |
| `DD-027` | `page/page-drop.spec.ts` | should throw when neither files nor data provided |
| `DD-028` | `page/page-drag.spec.ts` | Drag and drop › should report the default drop effect from effectAllowed |

### DE — Dispatch event

| ID | File | Title |
|---|---|---|
| `DE-001` | `page/page-dispatchevent.spec.ts` | should dispatch click event @smoke |
| `DE-002` | `page/page-dispatchevent.spec.ts` | should dispatch click event properties |
| `DE-003` | `page/page-dispatchevent.spec.ts` | should dispatch click svg |
| `DE-004` | `page/page-dispatchevent.spec.ts` | should dispatch click on a span with an inline element inside |
| `DE-005` | `page/page-dispatchevent.spec.ts` | should dispatch click after navigation  |
| `DE-006` | `page/page-dispatchevent.spec.ts` | should dispatch click after a cross origin navigation  |
| `DE-007` | `page/page-dispatchevent.spec.ts` | should not fail when element is blocked on hover |
| `DE-008` | `page/page-dispatchevent.spec.ts` | should dispatch click when node is added in shadow dom |
| `DE-009` | `page/page-dispatchevent.spec.ts` | should be atomic |
| `DE-010` | `page/page-dispatchevent.spec.ts` | should dispatch drag drop events |
| `DE-011` | `page/page-dispatchevent.spec.ts` | should dispatch drag drop events via ElementHandles |
| `DE-012` | `page/page-dispatchevent.spec.ts` | should dispatch click event via ElementHandles |
| `DE-013` | `page/page-dispatchevent.spec.ts` | should dispatch wheel event |
| `DE-014` | `page/page-dispatchevent.spec.ts` | should dispatch device orientation event |
| `DE-015` | `page/page-dispatchevent.spec.ts` | should dispatch absolute device orientation event |
| `DE-016` | `page/page-dispatchevent.spec.ts` | should dispatch device motion event |
| `DE-017` | `page/page-dispatchevent.spec.ts` | should throw if argument is from different frame |

### DI — Dialog

| ID | File | Title |
|---|---|---|
| `DI-001` | `page/page-dialog.spec.ts` | should fire |
| `DI-002` | `page/page-dialog.spec.ts` | should fire dialogclosed when dialog is accepted |
| `DI-003` | `page/page-dialog.spec.ts` | should fire dialogclosed when dialog is dismissed |
| `DI-004` | `page/page-dialog.spec.ts` | should fire dialogclosed for auto-dismissed dialogs |
| `DI-005` | `page/page-dialog.spec.ts` | should allow accepting prompts @smoke |
| `DI-006` | `page/page-dialog.spec.ts` | should dismiss the prompt |
| `DI-007` | `page/page-dialog.spec.ts` | should accept the confirm prompt |
| `DI-008` | `page/page-dialog.spec.ts` | should dismiss the confirm prompt |
| `DI-009` | `page/page-dialog.spec.ts` | should be able to close context with open alert |
| `DI-010` | `page/page-dialog.spec.ts` | should handle multiple alerts |
| `DI-011` | `page/page-dialog.spec.ts` | should handle multiple confirms |
| `DI-012` | `page/page-dialog.spec.ts` | should auto-dismiss the prompt without listeners |
| `DI-013` | `page/page-dialog.spec.ts` | should auto-dismiss the alert without listeners |

### DO — Download

| ID | File | Title |
|---|---|---|
| `DO-001` | `library/download.spec.ts` | download event › should report download when navigation turns into download @smoke |
| `DO-002` | `library/download.spec.ts` | download event › should work with Cross-Origin-Opener-Policy |
| `DO-003` | `library/download.spec.ts` | download event › should report downloads with acceptDownloads: false |
| `DO-004` | `library/download.spec.ts` | download event › should report downloads with acceptDownloads: true |
| `DO-005` | `library/download.spec.ts` | download event › should report proper download url when download is from download attribute |
| `DO-006` | `library/download.spec.ts` | download event › should report downloads for download attribute |
| `DO-007` | `library/download.spec.ts` | download event › should save to user-specified path without updating original path |
| `DO-008` | `library/download.spec.ts` | download event › should save to two different paths with multiple saveAs calls |
| `DO-009` | `library/download.spec.ts` | download event › should save to overwritten filepath |
| `DO-010` | `library/download.spec.ts` | download event › should create subdirectories when saving to non-existent user-specified path |
| `DO-011` | `library/download.spec.ts` | download event › should error when saving with downloads disabled |
| `DO-012` | `library/download.spec.ts` | download event › should error when saving after deletion |
| `DO-013` | `library/download.spec.ts` | download event › should report non-navigation downloads |
| `DO-014` | `library/download.spec.ts` | download event › should report download path within page.on('download', …) handler for Files |
| `DO-015` | `library/download.spec.ts` | download event › should report download path within page.on('download', …) handler for Blobs |
| `DO-016` | `library/download.spec.ts` | download event › should report alt-click downloads |
| `DO-017` | `library/download.spec.ts` | download event › should report new window downloads |
| `DO-018` | `library/download.spec.ts` | download event › should delete file |
| `DO-019` | `library/download.spec.ts` | download event › should expose stream |
| `DO-020` | `library/download.spec.ts` | download event › should delete downloads on context destruction |
| `DO-021` | `library/download.spec.ts` | download event › should delete downloads on browser gone |
| `DO-022` | `library/download.spec.ts` | download event › should save downloads to artifactsDir |
| `DO-023` | `library/download.spec.ts` | download event › should close the context without awaiting the failed download |
| `DO-024` | `library/download.spec.ts` | download event › should close the context without awaiting the download |
| `DO-025` | `library/download.spec.ts` | download event › should throw if browser dies |
| `DO-026` | `library/download.spec.ts` | download event › should download large binary.zip |
| `DO-027` | `library/download.spec.ts` | download event › should be able to cancel pending downloads |
| `DO-028` | `library/download.spec.ts` | download event › should not fail explicitly to cancel a download even if that is already finished |
| `DO-029` | `library/download.spec.ts` | download event › should report downloads with interception |
| `DO-030` | `library/download.spec.ts` | download event › should emit download event from nested iframes |
| `DO-031` | `library/download.spec.ts` | should be able to download a PDF file |
| `DO-032` | `library/download.spec.ts` | should be able to download a inline PDF file via response interception |
| `DO-033` | `library/download.spec.ts` | should be able to download a inline PDF file via navigation |
| `DO-034` | `library/download.spec.ts` | should save to user-specified path |
| `DO-035` | `library/download.spec.ts` | should download even if there is no "attachment" value |
| `DO-036` | `library/download.spec.ts` | should convert navigation to a resource with unsupported mime type into download |
| `DO-037` | `library/download.spec.ts` | should download links with data url |
| `DO-038` | `library/download.spec.ts` | should download successfully when routing |
| `DO-039` | `library/downloads-path.spec.ts` | downloads path › should keep downloadsPath folder |
| `DO-040` | `library/downloads-path.spec.ts` | downloads path › should delete downloads when context closes |
| `DO-041` | `library/downloads-path.spec.ts` | downloads path › should report downloads in downloadsPath folder |
| `DO-042` | `library/downloads-path.spec.ts` | downloads path › should report downloads in downloadsPath folder with a relative path |
| `DO-043` | `library/downloads-path.spec.ts` | downloads path › should accept downloads in persistent context |
| `DO-044` | `library/downloads-path.spec.ts` | downloads path › should delete downloads when persistent context closes |

### DV — Device

| ID | File | Title |
|---|---|---|
| `DV-001` | `library/browsercontext-device.spec.ts` | device › should work @smoke |
| `DV-002` | `library/browsercontext-device.spec.ts` | device › should support clicking |
| `DV-003` | `library/browsercontext-device.spec.ts` | device › should scroll to click |
| `DV-004` | `library/browsercontext-device.spec.ts` | device › should scroll twice when emulated |
| `DV-005` | `library/browsercontext-device.spec.ts` | device › should reset scroll top after a navigation |
| `DV-006` | `library/browsercontext-device.spec.ts` | device › should scroll to a precise position with mobile scale |
| `DV-007` | `library/browsercontext-device.spec.ts` | device › should emulate viewport and screen size |
| `DV-008` | `library/browsercontext-device.spec.ts` | device › should emulate viewport without screen size |
| `DV-009` | `library/browsercontext-dsf.spec.ts` | should fetch lodpi assets @smoke |
| `DV-010` | `library/browsercontext-dsf.spec.ts` | should fetch hidpi assets |
| `DV-011` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support mobile emulation |
| `DV-012` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support touch emulation |
| `DV-013` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should be detectable |
| `DV-014` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should detect touch when applying viewport with touches |
| `DV-015` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support landscape emulation |
| `DV-016` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should support window.orientation emulation |
| `DV-017` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should preserve window.orientation override after navigation |
| `DV-018` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should preserve screen.orientation.type override after navigation |
| `DV-019` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should fire orientationchange event |
| `DV-020` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › default mobile viewports to 980 width |
| `DV-021` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › respect meta viewport tag |
| `DV-022` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should emulate the hover media feature |
| `DV-023` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › mouse should work with mobile viewports and cross process navigations |
| `DV-024` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should scroll when emulating a mobile viewport |
| `DV-025` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › should scroll mobile page with background-attachment: fixed |
| `DV-026` | `library/browsercontext-viewport-mobile.spec.ts` | mobile viewport › view scale should reset after navigation |

### EE — Event emitter

| ID | File | Title |
|---|---|---|
| `EE-001` | `page/page-listeners.spec.ts` | should not throw with ignoreErrors |
| `EE-002` | `page/page-listeners.spec.ts` | should wait |
| `EE-003` | `page/page-listeners.spec.ts` | wait should throw |
| `EE-004` | `library/events/add-listeners.spec.ts` | EventEmitter tests › should work |
| `EE-005` | `library/events/add-listeners.spec.ts` | EventEmitter tests › set max listeners test |
| `EE-006` | `library/events/add-listeners.spec.ts` | EventEmitter tests › Listener order |
| `EE-007` | `library/events/add-listeners.spec.ts` | EventEmitter tests › listener type check |
| `EE-008` | `library/events/check-listener-leaks.spec.ts` | defaultMaxListeners |
| `EE-009` | `library/events/check-listener-leaks.spec.ts` | process-wide |
| `EE-010` | `library/events/check-listener-leaks.spec.ts` | \_maxListeners still has precedence over defaultMaxListeners |
| `EE-011` | `library/events/events-list.spec.ts` | EventEmitter › should maintain event names correctly |
| `EE-012` | `library/events/listener-count.spec.ts` | Listener count test |
| `EE-013` | `library/events/listeners-side-effects.spec.ts` | listeners empty check |
| `EE-014` | `library/events/listeners.spec.ts` | EventEmitter listeners with one listener |
| `EE-015` | `library/events/listeners.spec.ts` | Array copy modification does not modify orig |
| `EE-016` | `library/events/listeners.spec.ts` | Modify array copy after multiple adds |
| `EE-017` | `library/events/listeners.spec.ts` | listeners and once |
| `EE-018` | `library/events/listeners.spec.ts` | listeners with conflicting types |
| `EE-019` | `library/events/listeners.spec.ts` | EventEmitter with no members |
| `EE-020` | `library/events/listeners.spec.ts` | listeners on prototype |
| `EE-021` | `library/events/listeners.spec.ts` | raw listeners |
| `EE-022` | `library/events/listeners.spec.ts` | raw listeners order |
| `EE-023` | `library/events/max-listeners.spec.ts` | emit maxListeners on e |
| `EE-024` | `library/events/method-names.spec.ts` | EventEmitter prototype test |
| `EE-025` | `library/events/modify-in-emit.spec.ts` | add and remove listeners |
| `EE-026` | `library/events/modify-in-emit.spec.ts` | removing callbacks in emit |
| `EE-027` | `library/events/num-args.spec.ts` | should work |
| `EE-028` | `library/events/once.spec.ts` | should work |
| `EE-029` | `library/events/once.spec.ts` | once() has different code paths based on the number of arguments being emitted |
| `EE-030` | `library/events/prepend.spec.ts` | EventEmitter functionality |
| `EE-031` | `library/events/prepend.spec.ts` | Verify that the listener must be a function |
| `EE-032` | `library/events/remove-all-listeners-wait.spec.ts` | should not throw with ignoreErrors |
| `EE-033` | `library/events/remove-all-listeners-wait.spec.ts` | should wait |
| `EE-034` | `library/events/remove-all-listeners-wait.spec.ts` | should wait all |
| `EE-035` | `library/events/remove-all-listeners-wait.spec.ts` | wait should throw |
| `EE-036` | `library/events/remove-all-listeners.spec.ts` | listeners |
| `EE-037` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners removes all listeners |
| `EE-038` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners with no event type |
| `EE-039` | `library/events/remove-all-listeners.spec.ts` | listener count after removeAllListeners |
| `EE-040` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners returns EventEmitter |
| `EE-041` | `library/events/remove-all-listeners.spec.ts` | removeAllListeners on undefined \_events |
| `EE-042` | `library/events/remove-listeners.spec.ts` | First test |
| `EE-043` | `library/events/remove-listeners.spec.ts` | Second test |
| `EE-044` | `library/events/remove-listeners.spec.ts` | Third test |
| `EE-045` | `library/events/remove-listeners.spec.ts` | Fourth test |
| `EE-046` | `library/events/remove-listeners.spec.ts` | Fifth test |
| `EE-047` | `library/events/remove-listeners.spec.ts` | Sixth test |
| `EE-048` | `library/events/remove-listeners.spec.ts` | Seventh test |
| `EE-049` | `library/events/remove-listeners.spec.ts` | Eighth test |
| `EE-050` | `library/events/remove-listeners.spec.ts` | Ninth test |
| `EE-051` | `library/events/remove-listeners.spec.ts` | Tenth test |
| `EE-052` | `library/events/set-max-listeners-side-effects.spec.ts` | set max listeners test |
| `EE-053` | `library/events/special-event-names.spec.ts` | should support special event names |
| `EE-054` | `library/events/subclass.spec.ts` | myee instance |
| `EE-055` | `library/events/subclass.spec.ts` | MyEE2 instance |
| `EE-056` | `library/events/symbols.spec.ts` | should support symbols |

### EF — Expose function

| ID | File | Title |
|---|---|---|
| `EF-001` | `page/page-expose-function.spec.ts` | exposeBinding should work @smoke |
| `EF-002` | `page/page-expose-function.spec.ts` | should work |
| `EF-003` | `page/page-expose-function.spec.ts` | should dispose |
| `EF-004` | `page/page-expose-function.spec.ts` | should work with handles and complex objects |
| `EF-005` | `page/page-expose-function.spec.ts` | should throw exception in page context |
| `EF-006` | `page/page-expose-function.spec.ts` | should support throwing "null" |
| `EF-007` | `page/page-expose-function.spec.ts` | should be callable from-inside addInitScript |
| `EF-008` | `page/page-expose-function.spec.ts` | should survive navigation |
| `EF-009` | `page/page-expose-function.spec.ts` | should await returned promise |
| `EF-010` | `page/page-expose-function.spec.ts` | should work on frames |
| `EF-011` | `page/page-expose-function.spec.ts` | should work on frames before navigation |
| `EF-012` | `page/page-expose-function.spec.ts` | should work after cross origin navigation |
| `EF-013` | `page/page-expose-function.spec.ts` | should work with complex objects |
| `EF-014` | `page/page-expose-function.spec.ts` | should throw for duplicate registrations |
| `EF-015` | `page/page-expose-function.spec.ts` | should work with setContent |
| `EF-016` | `page/page-expose-function.spec.ts` | should alias Window, Document and Node |
| `EF-017` | `page/page-expose-function.spec.ts` | should serialize cycles |
| `EF-018` | `page/page-expose-function.spec.ts` | should work with overridden console object |
| `EF-019` | `page/page-expose-function.spec.ts` | should work with busted Array.prototype.map/push |
| `EF-020` | `page/page-expose-function.spec.ts` | should fail with busted Array.prototype.toJSON |
| `EF-021` | `page/page-expose-function.spec.ts` | exposeBinding should work in parallel |
| `EF-022` | `library/browsercontext-expose-function.spec.ts` | expose binding should work |
| `EF-023` | `library/browsercontext-expose-function.spec.ts` | should work |
| `EF-024` | `library/browsercontext-expose-function.spec.ts` | should dispose |
| `EF-025` | `library/browsercontext-expose-function.spec.ts` | should throw for duplicate registrations |
| `EF-026` | `library/browsercontext-expose-function.spec.ts` | should be callable from-inside addInitScript |
| `EF-027` | `library/browsercontext-expose-function.spec.ts` | should work with CSP |
| `EF-028` | `library/browsercontext-expose-function.spec.ts` | should call binding from pagehide handler when navigating away |

### EH — ElementHandle

| ID | File | Title |
|---|---|---|
| `EH-001` | `page/elementhandle-bounding-box.spec.ts` | should work |
| `EH-002` | `page/elementhandle-bounding-box.spec.ts` | should handle nested frames |
| `EH-003` | `page/elementhandle-bounding-box.spec.ts` | should get frame box |
| `EH-004` | `page/elementhandle-bounding-box.spec.ts` | should handle scroll offset and click |
| `EH-005` | `page/elementhandle-bounding-box.spec.ts` | should return null for invisible elements |
| `EH-006` | `page/elementhandle-bounding-box.spec.ts` | should get bounding box of element inside a cross-origin iframe |
| `EH-007` | `page/elementhandle-bounding-box.spec.ts` | should force a layout |
| `EH-008` | `page/elementhandle-bounding-box.spec.ts` | should work with SVG nodes |
| `EH-009` | `page/elementhandle-bounding-box.spec.ts` | should work when inline box child is outside of viewport |
| `EH-010` | `page/elementhandle-click.spec.ts` | should work @smoke |
| `EH-011` | `page/elementhandle-click.spec.ts` | should work with Node removed |
| `EH-012` | `page/elementhandle-click.spec.ts` | should work for Shadow DOM v1 |
| `EH-013` | `page/elementhandle-click.spec.ts` | should work for TextNodes |
| `EH-014` | `page/elementhandle-click.spec.ts` | should throw for detached nodes |
| `EH-015` | `page/elementhandle-click.spec.ts` | should throw for hidden nodes with force |
| `EH-016` | `page/elementhandle-click.spec.ts` | should throw for recursively hidden nodes with force |
| `EH-017` | `page/elementhandle-click.spec.ts` | should throw for \<br\> elements with force |
| `EH-018` | `page/elementhandle-click.spec.ts` | should double click the button |
| `EH-019` | `page/elementhandle-content-frame.spec.ts` | should work |
| `EH-020` | `page/elementhandle-content-frame.spec.ts` | should work for cross-process iframes |
| `EH-021` | `page/elementhandle-content-frame.spec.ts` | should work for cross-frame evaluations |
| `EH-022` | `page/elementhandle-content-frame.spec.ts` | should return null for non-iframes |
| `EH-023` | `page/elementhandle-content-frame.spec.ts` | should return null for document.documentElement |
| `EH-024` | `page/elementhandle-convenience.spec.ts` | should have a nice preview |
| `EH-025` | `page/elementhandle-convenience.spec.ts` | should have a nice preview for non-ascii attributes/children |
| `EH-026` | `page/elementhandle-convenience.spec.ts` | getAttribute should work |
| `EH-027` | `page/elementhandle-convenience.spec.ts` | inputValue should work |
| `EH-028` | `page/elementhandle-convenience.spec.ts` | innerHTML should work |
| `EH-029` | `page/elementhandle-convenience.spec.ts` | innerText should work |
| `EH-030` | `page/elementhandle-convenience.spec.ts` | innerText should throw |
| `EH-031` | `page/elementhandle-convenience.spec.ts` | textContent should work |
| `EH-032` | `page/elementhandle-convenience.spec.ts` | textContent should work on ShadowRoot |
| `EH-033` | `page/elementhandle-convenience.spec.ts` | isVisible and isHidden should work |
| `EH-034` | `page/elementhandle-convenience.spec.ts` | isVisible should not throw when the DOM element is not connected |
| `EH-035` | `page/elementhandle-convenience.spec.ts` | isEnabled and isDisabled should work |
| `EH-036` | `page/elementhandle-convenience.spec.ts` | isEnabled and isDisabled should work with \<select/\> option/optgroup correctly |
| `EH-037` | `page/elementhandle-convenience.spec.ts` | isEditable should work |
| `EH-038` | `page/elementhandle-convenience.spec.ts` | isChecked should work |
| `EH-039` | `page/elementhandle-eval-on-selector.spec.ts` | should work |
| `EH-040` | `page/elementhandle-eval-on-selector.spec.ts` | should retrieve content from subtree |
| `EH-041` | `page/elementhandle-eval-on-selector.spec.ts` | should throw in case of missing selector |
| `EH-042` | `page/elementhandle-eval-on-selector.spec.ts` | should work for all |
| `EH-043` | `page/elementhandle-eval-on-selector.spec.ts` | should retrieve content from subtree for all |
| `EH-044` | `page/elementhandle-eval-on-selector.spec.ts` | should not throw in case of missing selector for all |
| `EH-045` | `page/elementhandle-misc.spec.ts` | should hover |
| `EH-046` | `page/elementhandle-misc.spec.ts` | should hover when Node is removed |
| `EH-047` | `page/elementhandle-misc.spec.ts` | should fill input |
| `EH-048` | `page/elementhandle-misc.spec.ts` | should fill input when Node is removed |
| `EH-049` | `page/elementhandle-misc.spec.ts` | should check the box |
| `EH-050` | `page/elementhandle-misc.spec.ts` | should check the box using setChecked |
| `EH-051` | `page/elementhandle-misc.spec.ts` | should uncheck the box |
| `EH-052` | `page/elementhandle-misc.spec.ts` | should select single option |
| `EH-053` | `page/elementhandle-misc.spec.ts` | should focus a button |
| `EH-054` | `page/elementhandle-misc.spec.ts` | should allow disposing twice |
| `EH-055` | `page/elementhandle-owner-frame.spec.ts` | should work |
| `EH-056` | `page/elementhandle-owner-frame.spec.ts` | should work for cross-process iframes |
| `EH-057` | `page/elementhandle-owner-frame.spec.ts` | should work for document |
| `EH-058` | `page/elementhandle-owner-frame.spec.ts` | should work for iframe elements |
| `EH-059` | `page/elementhandle-owner-frame.spec.ts` | should work for cross-frame evaluations |
| `EH-060` | `page/elementhandle-owner-frame.spec.ts` | should work for detached elements |
| `EH-061` | `page/elementhandle-owner-frame.spec.ts` | should work for adopted elements |
| `EH-062` | `page/elementhandle-press.spec.ts` | should work |
| `EH-063` | `page/elementhandle-press.spec.ts` | should not select existing value |
| `EH-064` | `page/elementhandle-press.spec.ts` | should reset selection when not focused |
| `EH-065` | `page/elementhandle-press.spec.ts` | should not modify selection when focused |
| `EH-066` | `page/elementhandle-press.spec.ts` | should work with number input |
| `EH-067` | `page/elementhandle-query-selector.spec.ts` | should query existing element |
| `EH-068` | `page/elementhandle-query-selector.spec.ts` | should return null for non-existing element |
| `EH-069` | `page/elementhandle-query-selector.spec.ts` | should work for adopted elements |
| `EH-070` | `page/elementhandle-query-selector.spec.ts` | should query existing elements |
| `EH-071` | `page/elementhandle-query-selector.spec.ts` | should return empty array for non-existing elements |
| `EH-072` | `page/elementhandle-query-selector.spec.ts` | xpath should query existing element |
| `EH-073` | `page/elementhandle-query-selector.spec.ts` | xpath should return null for non-existing element |
| `EH-074` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work |
| `EH-075` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work with webp |
| `EH-076` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work when main world busts JSON.stringify |
| `EH-077` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should take into account padding and border |
| `EH-078` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport in parallel |
| `EH-079` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport |
| `EH-080` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should scroll element into view |
| `EH-081` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should scroll 15000px into view |
| `EH-082` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work with a rotated element |
| `EH-083` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should fail to screenshot a detached element |
| `EH-084` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should timeout waiting for visible |
| `EH-085` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should wait for visible |
| `EH-086` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work for an element with fractional dimensions |
| `EH-087` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should work for an element with an offset |
| `EH-088` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should wait for element to stop moving |
| `EH-089` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should take screenshot of disabled button |
| `EH-090` | `page/elementhandle-screenshot.spec.ts` | element screenshot › path option should create subdirectories |
| `EH-091` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should prefer type over extension |
| `EH-092` | `page/elementhandle-screenshot.spec.ts` | element screenshot › should not issue resize event |
| `EH-093` | `page/elementhandle-scroll-into-view.spec.ts` | should work @smoke |
| `EH-094` | `page/elementhandle-scroll-into-view.spec.ts` | should throw for detached element |
| `EH-095` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for display:none to become visible |
| `EH-096` | `page/elementhandle-scroll-into-view.spec.ts` | should scroll display:contents into view |
| `EH-097` | `page/elementhandle-scroll-into-view.spec.ts` | should work for visibility:hidden element |
| `EH-098` | `page/elementhandle-scroll-into-view.spec.ts` | should work for zero-sized element |
| `EH-099` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for nested display:none to become visible |
| `EH-100` | `page/elementhandle-scroll-into-view.spec.ts` | should wait for element to stop moving |
| `EH-101` | `page/elementhandle-scroll-into-view.spec.ts` | should timeout waiting for visible |
| `EH-102` | `page/elementhandle-select-text.spec.ts` | should select textarea |
| `EH-103` | `page/elementhandle-select-text.spec.ts` | should select input |
| `EH-104` | `page/elementhandle-select-text.spec.ts` | should select plain div |
| `EH-105` | `page/elementhandle-select-text.spec.ts` | should timeout waiting for invisible element |
| `EH-106` | `page/elementhandle-select-text.spec.ts` | should wait for visible |
| `EH-107` | `page/elementhandle-type.spec.ts` | should work |
| `EH-108` | `page/elementhandle-type.spec.ts` | should not select existing value |
| `EH-109` | `page/elementhandle-type.spec.ts` | should reset selection when not focused |
| `EH-110` | `page/elementhandle-type.spec.ts` | should not modify selection when focused |
| `EH-111` | `page/elementhandle-type.spec.ts` | should work with number input |
| `EH-112` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for visible |
| `EH-113` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for already visible |
| `EH-114` | `page/elementhandle-wait-for-element-state.spec.ts` | should timeout waiting for visible |
| `EH-115` | `page/elementhandle-wait-for-element-state.spec.ts` | should throw waiting for visible when detached |
| `EH-116` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for hidden |
| `EH-117` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for already hidden |
| `EH-118` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for hidden when detached |
| `EH-119` | `page/elementhandle-wait-for-element-state.spec.ts` | should throw waiting for enabled when detached |
| `EH-120` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for aria enabled button |
| `EH-121` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for button with an aria-disabled parent |
| `EH-122` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for stable position |
| `EH-123` | `page/elementhandle-wait-for-element-state.spec.ts` | should wait for editable input |
| `EH-124` | `page/elementhandle-scroll-into-view.spec.ts` | should scroll nested display:contents into view |

### EM — Emulation

| ID | File | Title |
|---|---|---|
| `EM-001` | `page/page-emulate-media.spec.ts` | should emulate type @smoke |
| `EM-002` | `page/page-emulate-media.spec.ts` | should throw in case of bad media argument |
| `EM-003` | `page/page-emulate-media.spec.ts` | should emulate colorScheme should work @smoke |
| `EM-004` | `page/page-emulate-media.spec.ts` | should default to light |
| `EM-005` | `page/page-emulate-media.spec.ts` | should throw in case of bad colorScheme argument |
| `EM-006` | `page/page-emulate-media.spec.ts` | should work during navigation |
| `EM-007` | `page/page-emulate-media.spec.ts` | should change the actual colors in css |
| `EM-008` | `page/page-emulate-media.spec.ts` | should emulate reduced motion |
| `EM-009` | `page/page-emulate-media.spec.ts` | should keep reduced motion and color emulation after reload |
| `EM-010` | `page/page-emulate-media.spec.ts` | should emulate forcedColors  |
| `EM-011` | `page/page-emulate-media.spec.ts` | should emulate contrast  |
| `EM-012` | `page/page-emulate-media.spec.ts` | should report hover and fine pointer for desktop |
| `EM-013` | `library/emulation-focus.spec.ts` | should think that it is focused by default |
| `EM-014` | `library/emulation-focus.spec.ts` | should think that all pages are focused @smoke |
| `EM-015` | `library/emulation-focus.spec.ts` | should focus popups by default |
| `EM-016` | `library/emulation-focus.spec.ts` | should provide target for keyboard events |
| `EM-017` | `library/emulation-focus.spec.ts` | should not affect mouse event target page |
| `EM-018` | `library/emulation-focus.spec.ts` | should change document.activeElement |
| `EM-019` | `library/emulation-focus.spec.ts` | should not affect screenshots |
| `EM-020` | `library/emulation-focus.spec.ts` | should change focused iframe |
| `EM-021` | `library/emulation-focus.spec.ts` | should focus with more than one page/context |
| `EM-022` | `library/emulation-focus.spec.ts` | should not fire blur events when interacting with more than one page/context |
| `EM-023` | `library/emulation-focus.spec.ts` | should not blur iframe when interacting with another page/context |
| `EM-024` | `library/emulation-focus.spec.ts` | should trigger hover state concurrently |
| `EM-025` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve context options |
| `EM-026` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve page.emulateMedia |
| `EM-027` | `library/emulation-coop.spec.ts` | emulation with COOP › should preserve mobile emulation |

### ER — Page errors and crashes

| ID | File | Title |
|---|---|---|
| `ER-001` | `page/page-event-pageerror.spec.ts` | should fire |
| `ER-002` | `page/page-event-pageerror.spec.ts` | should not receive console message for pageError |
| `ER-003` | `page/page-event-pageerror.spec.ts` | should contain sourceURL |
| `ER-004` | `page/page-event-pageerror.spec.ts` | should contain the Error.name property |
| `ER-005` | `page/page-event-pageerror.spec.ts` | should support an empty Error.name property |
| `ER-006` | `page/page-event-pageerror.spec.ts` | should handle odd values |
| `ER-007` | `page/page-event-pageerror.spec.ts` | should handle object |
| `ER-008` | `page/page-event-pageerror.spec.ts` | should handle window |
| `ER-009` | `page/page-event-pageerror.spec.ts` | should remove a listener of a non-existing event handler |
| `ER-010` | `page/page-event-pageerror.spec.ts` | should emit error from unhandled rejects |
| `ER-011` | `page/page-event-pageerror.spec.ts` | pageErrors should work |
| `ER-012` | `page/page-event-pageerror.spec.ts` | clearPageErrors should work |
| `ER-013` | `page/page-event-pageerror.spec.ts` | should fire illegal character error |
| `ER-014` | `library/page-event-crash.spec.ts` | should emit crash event when page crashes |
| `ER-015` | `library/page-event-crash.spec.ts` | should throw on any action after page crashes |
| `ER-016` | `library/page-event-crash.spec.ts` | expect should not hang when page crashed |
| `ER-017` | `library/page-event-crash.spec.ts` | should cancel waitForEvent when page crashes |
| `ER-018` | `library/page-event-crash.spec.ts` | should cancel navigation when page crashes |
| `ER-019` | `library/page-event-crash.spec.ts` | should be able to close context when page crashes |
| `ER-020` | `library/page-event-crash.spec.ts` | should be able to close page after crash |
| `ER-021` | `library/page-event-crash.spec.ts` | should reject in-flight worker.evaluate when page crashes |

### ES — Eval on selector

| ID | File | Title |
|---|---|---|
| `ES-001` | `page/eval-on-selector.spec.ts` | should work with css selector |
| `ES-002` | `page/eval-on-selector.spec.ts` | should work with id selector |
| `ES-003` | `page/eval-on-selector.spec.ts` | should work with data-test selector |
| `ES-004` | `page/eval-on-selector.spec.ts` | should work with data-testid selector |
| `ES-005` | `page/eval-on-selector.spec.ts` | should work with data-test-id selector |
| `ES-006` | `page/eval-on-selector.spec.ts` | should work with text selector in quotes |
| `ES-007` | `page/eval-on-selector.spec.ts` | should work with xpath selector |
| `ES-008` | `page/eval-on-selector.spec.ts` | should work with text selector |
| `ES-009` | `page/eval-on-selector.spec.ts` | should auto-detect css selector |
| `ES-010` | `page/eval-on-selector.spec.ts` | should auto-detect css selector with attributes |
| `ES-011` | `page/eval-on-selector.spec.ts` | should auto-detect nested selectors |
| `ES-012` | `page/eval-on-selector.spec.ts` | should accept arguments |
| `ES-013` | `page/eval-on-selector.spec.ts` | should accept ElementHandles as arguments |
| `ES-014` | `page/eval-on-selector.spec.ts` | should throw error if no element is found |
| `ES-015` | `page/eval-on-selector.spec.ts` | should support \>\> syntax |
| `ES-016` | `page/eval-on-selector.spec.ts` | should support \>\> syntax with different engines |
| `ES-017` | `page/eval-on-selector.spec.ts` | should support spaces with \>\> syntax |
| `ES-018` | `page/eval-on-selector.spec.ts` | should not stop at first failure with \>\> syntax |
| `ES-019` | `page/eval-on-selector.spec.ts` | should support \* capture |
| `ES-020` | `page/eval-on-selector.spec.ts` | should throw on multiple \* captures |
| `ES-021` | `page/eval-on-selector.spec.ts` | should throw on malformed \* capture |
| `ES-022` | `page/eval-on-selector.spec.ts` | should work with spaces in css attributes |
| `ES-023` | `page/eval-on-selector.spec.ts` | should work with quotes in css attributes |
| `ES-024` | `page/eval-on-selector.spec.ts` | should work with spaces in css attributes when missing |
| `ES-025` | `page/eval-on-selector.spec.ts` | should work with quotes in css attributes when missing |
| `ES-026` | `page/eval-on-selector.spec.ts` | should return complex values |
| `ES-027` | `page/eval-on-selector-all.spec.ts` | should work with css selector |
| `ES-028` | `page/eval-on-selector-all.spec.ts` | should work with text selector |
| `ES-029` | `page/eval-on-selector-all.spec.ts` | should work with xpath selector |
| `ES-030` | `page/eval-on-selector-all.spec.ts` | should auto-detect css selector |
| `ES-031` | `page/eval-on-selector-all.spec.ts` | should support \>\> syntax |
| `ES-032` | `page/eval-on-selector-all.spec.ts` | should support \* capture |
| `ES-033` | `page/eval-on-selector-all.spec.ts` | should support \* capture when multiple paths match |
| `ES-034` | `page/eval-on-selector-all.spec.ts` | should return complex values |
| `ES-035` | `page/eval-on-selector-all.spec.ts` | should work with bogus Array.from |

### EV — Evaluate

| ID | File | Title |
|---|---|---|
| `EV-001` | `page/page-evaluate.spec.ts` | should work @smoke |
| `EV-002` | `page/page-evaluate.spec.ts` | should transfer NaN |
| `EV-003` | `page/page-evaluate.spec.ts` | should transfer -0 |
| `EV-004` | `page/page-evaluate.spec.ts` | should transfer Infinity |
| `EV-005` | `page/page-evaluate.spec.ts` | should transfer -Infinity |
| `EV-006` | `page/page-evaluate.spec.ts` | should roundtrip unserializable values |
| `EV-007` | `page/page-evaluate.spec.ts` | should roundtrip promise to value |
| `EV-008` | `page/page-evaluate.spec.ts` | should roundtrip promise to unserializable values |
| `EV-009` | `page/page-evaluate.spec.ts` | should transfer arrays |
| `EV-010` | `page/page-evaluate.spec.ts` | should transfer arrays as arrays, not objects |
| `EV-011` | `page/page-evaluate.spec.ts` | should transfer typed arrays |
| `EV-012` | `page/page-evaluate.spec.ts` | should transfer bigint |
| `EV-013` | `page/page-evaluate.spec.ts` | should transfer maps as empty objects |
| `EV-014` | `page/page-evaluate.spec.ts` | should transfer sets as empty objects |
| `EV-015` | `page/page-evaluate.spec.ts` | should modify global environment |
| `EV-016` | `page/page-evaluate.spec.ts` | should evaluate in the page context |
| `EV-017` | `page/page-evaluate.spec.ts` | should return undefined for objects with symbols |
| `EV-018` | `page/page-evaluate.spec.ts` | should work with function shorthands |
| `EV-019` | `page/page-evaluate.spec.ts` | should work with unicode chars |
| `EV-020` | `page/page-evaluate.spec.ts` | should work with large strings |
| `EV-021` | `page/page-evaluate.spec.ts` | should work with large unicode strings |
| `EV-022` | `page/page-evaluate.spec.ts` | should throw when evaluation triggers reload |
| `EV-023` | `page/page-evaluate.spec.ts` | should await promise |
| `EV-024` | `page/page-evaluate.spec.ts` | should work right after framenavigated |
| `EV-025` | `page/page-evaluate.spec.ts` | should work right after a cross-origin navigation |
| `EV-026` | `page/page-evaluate.spec.ts` | should work from-inside an exposed function |
| `EV-027` | `page/page-evaluate.spec.ts` | should reject promise with exception |
| `EV-028` | `page/page-evaluate.spec.ts` | should support thrown strings as error messages |
| `EV-029` | `page/page-evaluate.spec.ts` | should support thrown numbers as error messages |
| `EV-030` | `page/page-evaluate.spec.ts` | should reject when a falsy value is thrown |
| `EV-031` | `page/page-evaluate.spec.ts` | should include a non-error rejection value in the error message |
| `EV-032` | `page/page-evaluate.spec.ts` | should return complex objects |
| `EV-033` | `page/page-evaluate.spec.ts` | should return NaN |
| `EV-034` | `page/page-evaluate.spec.ts` | should return -0 |
| `EV-035` | `page/page-evaluate.spec.ts` | should return Infinity |
| `EV-036` | `page/page-evaluate.spec.ts` | should return -Infinity |
| `EV-037` | `page/page-evaluate.spec.ts` | should work with overwritten Promise |
| `EV-038` | `page/page-evaluate.spec.ts` | should throw when passed more than one parameter |
| `EV-039` | `page/page-evaluate.spec.ts` | should accept "undefined" as one of multiple parameters |
| `EV-040` | `page/page-evaluate.spec.ts` | should properly serialize undefined arguments |
| `EV-041` | `page/page-evaluate.spec.ts` | should properly serialize undefined fields |
| `EV-042` | `page/page-evaluate.spec.ts` | should return undefined properties |
| `EV-043` | `page/page-evaluate.spec.ts` | should properly serialize null arguments |
| `EV-044` | `page/page-evaluate.spec.ts` | should properly serialize null fields |
| `EV-045` | `page/page-evaluate.spec.ts` | should properly serialize PerformanceMeasure object |
| `EV-046` | `page/page-evaluate.spec.ts` | should properly serialize window.performance object |
| `EV-047` | `page/page-evaluate.spec.ts` | should return undefined for non-serializable objects |
| `EV-048` | `page/page-evaluate.spec.ts` | should throw for too deep reference chain |
| `EV-049` | `page/page-evaluate.spec.ts` | should throw for too deep reference chain 2 |
| `EV-050` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable shallow function |
| `EV-051` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable object one deep function |
| `EV-052` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable object nested function |
| `EV-053` | `page/page-evaluate.spec.ts` | should throw usable message for unserializable array nested function |
| `EV-054` | `page/page-evaluate.spec.ts` | should alias Window, Document and Node |
| `EV-055` | `page/page-evaluate.spec.ts` | should work for circular object |
| `EV-056` | `page/page-evaluate.spec.ts` | should be able to throw a tricky error |
| `EV-057` | `page/page-evaluate.spec.ts` | should accept a string |
| `EV-058` | `page/page-evaluate.spec.ts` | should accept a string with semi colons |
| `EV-059` | `page/page-evaluate.spec.ts` | should accept a string with comments |
| `EV-060` | `page/page-evaluate.spec.ts` | should accept element handle as an argument |
| `EV-061` | `page/page-evaluate.spec.ts` | should throw if underlying element was disposed |
| `EV-062` | `page/page-evaluate.spec.ts` | should simulate a user gesture |
| `EV-063` | `page/page-evaluate.spec.ts` | should throw a nice error after a navigation |
| `EV-064` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a navigation |
| `EV-065` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a synchronous navigation and returns an object |
| `EV-066` | `page/page-evaluate.spec.ts` | should not throw an error when evaluation does a synchronous navigation and returns undefined |
| `EV-067` | `page/page-evaluate.spec.ts` | should transfer 100Mb of data from page to node.js |
| `EV-068` | `page/page-evaluate.spec.ts` | should throw error with detailed information on exception inside promise  |
| `EV-069` | `page/page-evaluate.spec.ts` | should work even when JSON is set to null |
| `EV-070` | `page/page-evaluate.spec.ts` | should await promise from popup |
| `EV-071` | `page/page-evaluate.spec.ts` | should work with new Function() and CSP |
| `EV-072` | `page/page-evaluate.spec.ts` | should work with non-strict expressions |
| `EV-073` | `page/page-evaluate.spec.ts` | should respect use strict expression |
| `EV-074` | `page/page-evaluate.spec.ts` | should not leak utility script |
| `EV-075` | `page/page-evaluate.spec.ts` | should not leak handles |
| `EV-076` | `page/page-evaluate.spec.ts` | should work with CSP |
| `EV-077` | `page/page-evaluate.spec.ts` | should evaluate exception with a function on the stack |
| `EV-078` | `page/page-evaluate.spec.ts` | should evaluate exception |
| `EV-079` | `page/page-evaluate.spec.ts` | should pass exception argument |
| `EV-080` | `page/page-evaluate.spec.ts` | should evaluate date |
| `EV-081` | `page/page-evaluate.spec.ts` | should roundtrip date |
| `EV-082` | `page/page-evaluate.spec.ts` | should roundtrip regex |
| `EV-083` | `page/page-evaluate.spec.ts` | should jsonValue() date |
| `EV-084` | `page/page-evaluate.spec.ts` | should evaluate url |
| `EV-085` | `page/page-evaluate.spec.ts` | should roundtrip url |
| `EV-086` | `page/page-evaluate.spec.ts` | should jsonValue() url |
| `EV-087` | `page/page-evaluate.spec.ts` | should not use toJSON when evaluating |
| `EV-088` | `page/page-evaluate.spec.ts` | should not use Array.prototype.toJSON when evaluating |
| `EV-089` | `page/page-evaluate.spec.ts` | should not add a toJSON property to newly created Arrays after evaluation |
| `EV-090` | `page/page-evaluate.spec.ts` | should not use toJSON in jsonValue |
| `EV-091` | `page/page-evaluate.spec.ts` | should ignore buggy toJSON |
| `EV-092` | `page/page-evaluate.spec.ts` | should not expose the injected script export |
| `EV-093` | `page/page-evaluate.spec.ts` | should throw when frame is detached |
| `EV-094` | `page/page-evaluate.spec.ts` | should work with overridden Object.defineProperty |
| `EV-095` | `page/page-evaluate.spec.ts` | should work with busted Array.prototype.map/push |
| `EV-096` | `page/page-evaluate.spec.ts` | should work with overridden globalThis.Window/Document/Node |
| `EV-097` | `page/page-evaluate.spec.ts` | should work with overridden URL/Date/RegExp |
| `EV-098` | `page/page-evaluate.spec.ts` | should work with Array.from/map |
| `EV-099` | `page/page-evaluate.spec.ts` | should work with a using declaration |
| `EV-100` | `page/page-evaluate.spec.ts` | should ignore dangerous object keys |
| `EV-101` | `page/page-evaluate-handle.spec.ts` | should work |
| `EV-102` | `page/page-evaluate-handle.spec.ts` | should accept object handle as an argument |
| `EV-103` | `page/page-evaluate-handle.spec.ts` | should accept object handle to primitive types |
| `EV-104` | `page/page-evaluate-handle.spec.ts` | should accept nested handle |
| `EV-105` | `page/page-evaluate-handle.spec.ts` | should accept nested window handle |
| `EV-106` | `page/page-evaluate-handle.spec.ts` | should accept multiple nested handles |
| `EV-107` | `page/page-evaluate-handle.spec.ts` | should accept same handle multiple times |
| `EV-108` | `page/page-evaluate-handle.spec.ts` | should accept same nested object multiple times |
| `EV-109` | `page/page-evaluate-handle.spec.ts` | should accept object handle to unserializable value |
| `EV-110` | `page/page-evaluate-handle.spec.ts` | should pass configurable args |
| `EV-111` | `page/page-evaluate-handle.spec.ts` | should work with primitives |
| `EV-112` | `page/page-evaluate-callback.spec.ts` | should throw without the exposeFunctions option |
| `EV-113` | `page/page-evaluate-callback.spec.ts` | should call a function passed as an argument |
| `EV-114` | `page/page-evaluate-callback.spec.ts` | should accept a function as the whole argument |
| `EV-115` | `page/page-evaluate-callback.spec.ts` | should pass arguments to the callback |
| `EV-116` | `page/page-evaluate-callback.spec.ts` | should return the callback result to the page |
| `EV-117` | `page/page-evaluate-callback.spec.ts` | should support handle as a callback result |
| `EV-118` | `page/page-evaluate-callback.spec.ts` | should support nested handles in the callback result |
| `EV-119` | `page/page-evaluate-callback.spec.ts` | should await an async callback result |
| `EV-120` | `page/page-evaluate-callback.spec.ts` | should propagate callback errors to the page |
| `EV-121` | `page/page-evaluate-callback.spec.ts` | should work with a fire-and-forget setTimeout callback |
| `EV-122` | `page/page-evaluate-callback.spec.ts` | should support multiple callbacks |
| `EV-123` | `page/page-evaluate-callback.spec.ts` | should work with evaluateHandle |
| `EV-124` | `page/page-evaluate-callback.spec.ts` | should work in a child frame |
| `EV-125` | `page/page-evaluate-callback.spec.ts` | should route callbacks back to the calling frame |
| `EV-126` | `page/page-evaluate-callback.spec.ts` | should work with jsHandle.evaluate |
| `EV-127` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluate |
| `EV-128` | `page/page-evaluate-callback.spec.ts` | should return the callback result with locator.evaluate |
| `EV-129` | `page/page-evaluate-callback.spec.ts` | should propagate callback errors with locator.evaluate |
| `EV-130` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluateHandle |
| `EV-131` | `page/page-evaluate-callback.spec.ts` | should work with locator.evaluate inside an iframe |
| `EV-132` | `page/page-evaluate-callback.spec.ts` | should survive a navigation and keep working |
| `EV-133` | `page/page-evaluate-callback.spec.ts` | should not register the callback on the global object |
| `EV-134` | `page/page-evaluate-callback.spec.ts` | should scope the page-side callback to the execution context |
| `EV-135` | `page/page-evaluate-no-stall.spec.ts` | should work |
| `EV-136` | `page/page-evaluate-no-stall.spec.ts` | should throw while pending navigation |
| `EV-137` | `page/page-evaluate-no-stall.spec.ts` | should throw when no main execution context |

### EX — Expect

| ID | File | Title |
|---|---|---|
| `EX-001` | `page/expect-boolean.spec.ts` | toBeChecked › default |
| `EX-002` | `page/expect-boolean.spec.ts` | toBeChecked › with checked:true |
| `EX-003` | `page/expect-boolean.spec.ts` | toBeChecked › with checked:false |
| `EX-004` | `page/expect-boolean.spec.ts` | toBeChecked › with indeterminate:true |
| `EX-005` | `page/expect-boolean.spec.ts` | toBeChecked › with indeterminate:true and checked |
| `EX-006` | `page/expect-boolean.spec.ts` | toBeChecked › fail |
| `EX-007` | `page/expect-boolean.spec.ts` | toBeChecked › with not |
| `EX-008` | `page/expect-boolean.spec.ts` | toBeChecked › with not and checked:false |
| `EX-009` | `page/expect-boolean.spec.ts` | toBeChecked › fail with not |
| `EX-010` | `page/expect-boolean.spec.ts` | toBeChecked › fail with checked:false |
| `EX-011` | `page/expect-boolean.spec.ts` | toBeChecked › fail with indeterminate: true |
| `EX-012` | `page/expect-boolean.spec.ts` | toBeChecked › fail missing |
| `EX-013` | `page/expect-boolean.spec.ts` | toBeChecked › with role |
| `EX-014` | `page/expect-boolean.spec.ts` | toBeChecked › friendly log |
| `EX-015` | `page/expect-boolean.spec.ts` | toBeChecked › with impossible timeout |
| `EX-016` | `page/expect-boolean.spec.ts` | toBeChecked › with impossible timeout .not |
| `EX-017` | `page/expect-boolean.spec.ts` | toBeEditable › default |
| `EX-018` | `page/expect-boolean.spec.ts` | toBeEditable › with not |
| `EX-019` | `page/expect-boolean.spec.ts` | toBeEditable › with editable:true |
| `EX-020` | `page/expect-boolean.spec.ts` | toBeEditable › with editable:false |
| `EX-021` | `page/expect-boolean.spec.ts` | toBeEditable › with not and editable:false |
| `EX-022` | `page/expect-boolean.spec.ts` | toBeEditable › throws |
| `EX-023` | `page/expect-boolean.spec.ts` | toBeEnabled › default |
| `EX-024` | `page/expect-boolean.spec.ts` | toBeEnabled › with enabled:true |
| `EX-025` | `page/expect-boolean.spec.ts` | toBeEnabled › with enabled:false |
| `EX-026` | `page/expect-boolean.spec.ts` | toBeEnabled › failed |
| `EX-027` | `page/expect-boolean.spec.ts` | toBeEnabled › eventually |
| `EX-028` | `page/expect-boolean.spec.ts` | toBeEnabled › eventually with not |
| `EX-029` | `page/expect-boolean.spec.ts` | toBeEnabled › with not and enabled:false |
| `EX-030` | `page/expect-boolean.spec.ts` | toBeEnabled › toBeDisabled |
| `EX-031` | `page/expect-boolean.spec.ts` | toBeEmpty input |
| `EX-032` | `page/expect-boolean.spec.ts` | not.toBeEmpty |
| `EX-033` | `page/expect-boolean.spec.ts` | toBeEmpty div |
| `EX-034` | `page/expect-boolean.spec.ts` | toBeDisabled with value |
| `EX-035` | `page/expect-boolean.spec.ts` | toBeChecked with value |
| `EX-036` | `page/expect-boolean.spec.ts` | toBeHidden with value |
| `EX-037` | `page/expect-boolean.spec.ts` | not.toBeDisabled div |
| `EX-038` | `page/expect-boolean.spec.ts` | toBeVisible › default |
| `EX-039` | `page/expect-boolean.spec.ts` | toBeVisible › with not |
| `EX-040` | `page/expect-boolean.spec.ts` | toBeVisible › with visible:true |
| `EX-041` | `page/expect-boolean.spec.ts` | toBeVisible › with visible:false |
| `EX-042` | `page/expect-boolean.spec.ts` | toBeVisible › with not and visible:false |
| `EX-043` | `page/expect-boolean.spec.ts` | toBeVisible › eventually |
| `EX-044` | `page/expect-boolean.spec.ts` | toBeVisible › eventually with not |
| `EX-045` | `page/expect-boolean.spec.ts` | toBeVisible › fail |
| `EX-046` | `page/expect-boolean.spec.ts` | toBeVisible › fail with not |
| `EX-047` | `page/expect-boolean.spec.ts` | toBeVisible › with impossible timeout |
| `EX-048` | `page/expect-boolean.spec.ts` | toBeVisible › with impossible timeout .not |
| `EX-049` | `page/expect-boolean.spec.ts` | toBeVisible › with frameLocator |
| `EX-050` | `page/expect-boolean.spec.ts` | toBeVisible › with frameLocator 2 |
| `EX-051` | `page/expect-boolean.spec.ts` | toBeVisible › over navigation |
| `EX-052` | `page/expect-boolean.spec.ts` | toBeHidden › default |
| `EX-053` | `page/expect-boolean.spec.ts` | toBeHidden › when nothing matches |
| `EX-054` | `page/expect-boolean.spec.ts` | toBeHidden › with not |
| `EX-055` | `page/expect-boolean.spec.ts` | toBeHidden › eventually with not |
| `EX-056` | `page/expect-boolean.spec.ts` | toBeHidden › eventually |
| `EX-057` | `page/expect-boolean.spec.ts` | toBeHidden › fail |
| `EX-058` | `page/expect-boolean.spec.ts` | toBeHidden › fail with not |
| `EX-059` | `page/expect-boolean.spec.ts` | toBeHidden › fail with not when nothing matching |
| `EX-060` | `page/expect-boolean.spec.ts` | toBeHidden › with impossible timeout .not |
| `EX-061` | `page/expect-boolean.spec.ts` | toBeHidden › with impossible timeout |
| `EX-062` | `page/expect-boolean.spec.ts` | toBeFocused |
| `EX-063` | `page/expect-boolean.spec.ts` | toBeFocused with shadow elements |
| `EX-064` | `page/expect-boolean.spec.ts` | should print unknown engine error |
| `EX-065` | `page/expect-boolean.spec.ts` | should print selector syntax error |
| `EX-066` | `page/expect-boolean.spec.ts` | toBeOK |
| `EX-067` | `page/expect-boolean.spec.ts` | not.toBeOK |
| `EX-068` | `page/expect-boolean.spec.ts` | toBeOK fail with invalid argument |
| `EX-069` | `page/expect-boolean.spec.ts` | toBeOK fail with promise |
| `EX-070` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › text content type |
| `EX-071` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › no content type |
| `EX-072` | `page/expect-boolean.spec.ts` | toBeOK should print response with text content type when fails › image content type |
| `EX-073` | `page/expect-boolean.spec.ts` | toBeAttached › default |
| `EX-074` | `page/expect-boolean.spec.ts` | toBeAttached › with hidden element |
| `EX-075` | `page/expect-boolean.spec.ts` | toBeAttached › with not |
| `EX-076` | `page/expect-boolean.spec.ts` | toBeAttached › with attached:true |
| `EX-077` | `page/expect-boolean.spec.ts` | toBeAttached › with attached:false |
| `EX-078` | `page/expect-boolean.spec.ts` | toBeAttached › with not and attached:false |
| `EX-079` | `page/expect-boolean.spec.ts` | toBeAttached › eventually |
| `EX-080` | `page/expect-boolean.spec.ts` | toBeAttached › eventually with not |
| `EX-081` | `page/expect-boolean.spec.ts` | toBeAttached › fail |
| `EX-082` | `page/expect-boolean.spec.ts` | toBeAttached › fail with not |
| `EX-083` | `page/expect-boolean.spec.ts` | toBeAttached › with impossible timeout |
| `EX-084` | `page/expect-boolean.spec.ts` | toBeAttached › with impossible timeout .not |
| `EX-085` | `page/expect-boolean.spec.ts` | toBeAttached › with frameLocator |
| `EX-086` | `page/expect-boolean.spec.ts` | toBeAttached › over navigation |
| `EX-087` | `page/expect-builtins.spec.ts` | .toBe() › does not throw |
| `EX-088` | `page/expect-builtins.spec.ts` | .toBe() › fails for: {1 and 2 #0, true and false #1, {} and {} #2, {"a":1} and {"a":1} #3, {"a":1} and {"a":5} #4, {"b":2} and {"b":2} #5, "2020-02-20T00:00:00.000Z" and "2020-02-20T00:00:00.000Z" #6, {} and {} #7, \["abc"\] and \["cde"\] #8, \[\] and \[\] #9, null and undefined #10, 0 and 0 #11} *(12 copies)* |
| `EX-089` | `page/expect-builtins.spec.ts` | .toBe() › fails for {'false', '1', '"a"', 'undefined', 'null', '{}', '\[\]'} with '.not' *(7 copies)* |
| `EX-090` | `page/expect-builtins.spec.ts` | .toBe() › does not crash on circular references |
| `EX-091` | `page/expect-builtins.spec.ts` | .toBe() › matcherResult property contains matcher name, expected and actual values |
| `EX-092` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not ignore keys with undefined values |
| `EX-093` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not ignore keys with undefined values inside an array |
| `EX-094` | `page/expect-builtins.spec.ts` | .toStrictEqual() › passes when comparing same type |
| `EX-095` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not pass for different types |
| `EX-096` | `page/expect-builtins.spec.ts` | .toStrictEqual() › passes for matching buffers |
| `EX-097` | `page/expect-builtins.spec.ts` | .toStrictEqual() › does not pass when ArrayBuffers are not equal |
| `EX-098` | `page/expect-builtins.spec.ts` | .toEqual() › {pass: false} expect().toEqual() {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16} *(17 copies)* |
| `EX-099` | `page/expect-builtins.spec.ts` | .toEqual() › {pass: true} expect().toEqual() {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17} *(18 copies)* |
| `EX-100` | `page/expect-builtins.spec.ts` | .toEqual() › assertion error matcherResult property contains matcher name, expected and actual values |
| `EX-101` | `page/expect-builtins.spec.ts` | .toEqual() › symbol based keys in arrays are processed correctly |
| `EX-102` | `page/expect-builtins.spec.ts` | .toEqual() › non-enumerable members should be skipped during equal |
| `EX-103` | `page/expect-builtins.spec.ts` | .toEqual() › objectContaining sample can be used multiple times |
| `EX-104` | `page/expect-builtins.spec.ts` | .toEqual() › cyclic object equality › properties with the same circularity are equal |
| `EX-105` | `page/expect-builtins.spec.ts` | .toEqual() › cyclic object equality › properties with different circularity are not equal |
| `EX-106` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › passing instanceof {#0, #1, #2, #3, #4} *(5 copies)* |
| `EX-107` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › failing instanceof {#0, #1, #2, #3} *(4 copies)* |
| `EX-108` | `page/expect-builtins.spec.ts` | .toBeInstanceOf() › throws if constructor is not a function |
| `EX-109` | `page/expect-builtins.spec.ts` | .toBeTruthy(), .toBeFalsy() › {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} is truthy *(9 copies)* |
| `EX-110` | `page/expect-builtins.spec.ts` | .toBeTruthy(), .toBeFalsy() › {'false', 'null', 'NaN', '0', '', 'undefined'} is falsy *(6 copies)* |
| `EX-111` | `page/expect-builtins.spec.ts` | .toBeNaN() › {pass: true} |
| `EX-112` | `page/expect-builtins.spec.ts` | .toBeNaN() › throws |
| `EX-113` | `page/expect-builtins.spec.ts` | .toBeNull() › fails for {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} *(9 copies)* |
| `EX-114` | `page/expect-builtins.spec.ts` | .toBeNull() › fails for null with .not |
| `EX-115` | `page/expect-builtins.spec.ts` | .toBeNull() › pass for null |
| `EX-116` | `page/expect-builtins.spec.ts` | .toBeDefined(), .toBeUndefined() › {'\[object Object\]', '', 'true', '1', 'a', '0.5', '\[object Map\]', '() =\> {}', 'Infinity'} is defined *(9 copies)* |
| `EX-117` | `page/expect-builtins.spec.ts` | .toBeDefined(), .toBeUndefined() › undefined is undefined |
| `EX-118` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › comparing {1 and 2, -Infinity and Infinity, 5e-324 and 1.7976931348623157e+308, 0.1 and 0.2} *(4 copies)* |
| `EX-119` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › can compare BigInt to Numbers |
| `EX-120` | `page/expect-builtins.spec.ts` | .toBeGreaterThan(), .toBeLessThan(), .toBeGreaterThanOrEqual(), .toBeLessThanOrEqual() › equal numbers: {\[1, 1\], \[5e-324, 5e-324\], \[Infinity, Infinity\], \[-Infinity, -Infinity\]} *(4 copies)* |
| `EX-121` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › iterable |
| `EX-122` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › contains {#0, #1, #2, #3, #4, #5, #6, #7} *(8 copies)* |
| `EX-123` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › does not contain {#0, #1, #2, #3} *(4 copies)* |
| `EX-124` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › error cases |
| `EX-125` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › contains a value equal {#0, #1, #2, #3, #4} *(5 copies)* |
| `EX-126` | `page/expect-builtins.spec.ts` | .toContain(), .toContainEqual() › error cases for toContainEqual |
| `EX-127` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: true} {expect(0).toBeCloseTo(0), expect(0).toBeCloseTo(0.001), expect(1.23).toBeCloseTo(1.229), expect(1.23).toBeCloseTo(1.226), expect(1.23).toBeCloseTo(1.234), expect(Infinity).toBeCloseTo(Infinity), expect(-Infinity).toBeCloseTo(-Infinity)} *(7 copies)* |
| `EX-128` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: false} {expect(0).toBeCloseTo(0.01), expect(1).toBeCloseTo(1.23), expect(Infinity).toBeCloseTo(-Infinity), expect(Infinity).toBeCloseTo(1.23), expect(-Infinity).toBeCloseTo(-1.23)} *(5 copies)* |
| `EX-129` | `page/expect-builtins.spec.ts` | .toBeCloseTo › {pass: true} {expect(0).toBeCloseTo(0.1, 0), expect(0).toBeCloseTo(0.0001, 3), expect(0).toBeCloseTo(0.000004, 5), expect(2.0000002).toBeCloseTo(2, 5)} *(4 copies)* |
| `EX-130` | `page/expect-builtins.spec.ts` | .toMatch() › {pass: true} {expect(foo).toMatch(foo), expect(Foo bar).toMatch(/^foo/i)} *(2 copies)* |
| `EX-131` | `page/expect-builtins.spec.ts` | .toMatch() › throws: \[bar, {foo\], /foo/\]} *(2 copies)* |
| `EX-132` | `page/expect-builtins.spec.ts` | .toMatch() › throws if non String actual value passed {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* |
| `EX-133` | `page/expect-builtins.spec.ts` | .toMatch() › throws if non String/RegExp expected value passed {#0, #1, #2, #3, #4, #5} *(6 copies)* |
| `EX-134` | `page/expect-builtins.spec.ts` | .toMatch() › escapes strings properly |
| `EX-135` | `page/expect-builtins.spec.ts` | .toMatch() › does not maintain RegExp state between calls |
| `EX-136` | `page/expect-builtins.spec.ts` | .toHaveLength › {pass: true} {toHaveLength(2) #0, toHaveLength(0) #1, toHaveLength(2) #2, toHaveLength(3) #3, toHaveLength(0) #4, toHaveLength(0) #5} *(6 copies)* |
| `EX-137` | `page/expect-builtins.spec.ts` | .toHaveLength › {pass: false} {toHaveLength(3) #0, toHaveLength(1) #1, toHaveLength(99) #2, toHaveLength(66) #3, toHaveLength(1) #4} *(5 copies)* |
| `EX-138` | `page/expect-builtins.spec.ts` | .toHaveLength › error cases |
| `EX-139` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: true} toHaveProperty with value {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9} *(10 copies)* |
| `EX-140` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: false} toHaveProperty with value {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* |
| `EX-141` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: true} toHaveProperty without value {#0, #1, #2, #3, #4} *(5 copies)* |
| `EX-142` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {pass: false} toHaveProperty without value {#0, #1, #2} *(3 copies)* |
| `EX-143` | `page/expect-builtins.spec.ts` | .toHaveProperty() › {error} toHaveProperty {#0, #1, #2, #3, #4} *(5 copies)* |
| `EX-144` | `page/expect-builtins.spec.ts` | .toMatchObject() › {pass: true} toMatchObject {#0, #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11} *(12 copies)* |
| `EX-145` | `page/expect-builtins.spec.ts` | .toMatchObject() › {pass: false} toMatchObject {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* |
| `EX-146` | `page/expect-builtins.spec.ts` | .toMatchObject() › throws toMatchObject {#0, #1, #2, #3, #4, #5, #6} *(7 copies)* |
| `EX-147` | `page/expect-builtins.spec.ts` | .toMatchObject() › does not match properties up in the prototype chain |
| `EX-148` | `page/expect-builtins.spec.ts` | .toThrow() › to throw or not to throw |
| `EX-149` | `page/expect-builtins.spec.ts` | .toThrow() › substring passes |
| `EX-150` | `page/expect-builtins.spec.ts` | .toThrow() › substring fails when did not throw |
| `EX-151` | `page/expect-builtins.spec.ts` | .toThrow() › substring fails when message did not match |
| `EX-152` | `page/expect-builtins.spec.ts` | .toThrow() › regexp passes |
| `EX-153` | `page/expect-builtins.spec.ts` | .toThrow() › regexp fails when did not throw |
| `EX-154` | `page/expect-builtins.spec.ts` | .toThrow() › error class passes |
| `EX-155` | `page/expect-builtins.spec.ts` | .toThrow() › object with message passes |
| `EX-156` | `page/expect-builtins.spec.ts` | .toThrow() › properly escapes strings when matching against errors |
| `EX-157` | `page/expect-builtins.spec.ts` | .toThrow() › error message and cause properties |
| `EX-158` | `page/expect-builtins.spec.ts` | asymmetric matchers › Any matches primitives |
| `EX-159` | `page/expect-builtins.spec.ts` | asymmetric matchers › Any throws when called with empty constructor |
| `EX-160` | `page/expect-builtins.spec.ts` | asymmetric matchers › Anything matches any type |
| `EX-161` | `page/expect-builtins.spec.ts` | asymmetric matchers › Anything does not match null and undefined |
| `EX-162` | `page/expect-builtins.spec.ts` | asymmetric matchers › ArrayContaining matches |
| `EX-163` | `page/expect-builtins.spec.ts` | asymmetric matchers › ArrayContaining does not match |
| `EX-164` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining matches |
| `EX-165` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining does not match |
| `EX-166` | `page/expect-builtins.spec.ts` | asymmetric matchers › ObjectContaining throws for non-objects |
| `EX-167` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringContaining matches string against string |
| `EX-168` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringMatching matches string against regexp |
| `EX-169` | `page/expect-builtins.spec.ts` | asymmetric matchers › StringMatching matches string against string |
| `EX-170` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo matches |
| `EX-171` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo does not match |
| `EX-172` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo with precision |
| `EX-173` | `page/expect-builtins.spec.ts` | asymmetric matchers › closeTo throws if expected is not number |
| `EX-174` | `page/expect-builtins.spec.ts` | asymmetric matchers › arrayOf matches |
| `EX-175` | `page/expect-builtins.spec.ts` | asymmetric matchers › arrayOf does not match |
| `EX-176` | `page/expect-matcher-result.spec.ts` | toMatchText-based assertions should have matcher result |
| `EX-177` | `page/expect-matcher-result.spec.ts` | toBeTruthy-based assertions should have matcher result |
| `EX-178` | `page/expect-matcher-result.spec.ts` | toEqual-based assertions should have matcher result |
| `EX-179` | `page/expect-matcher-result.spec.ts` | toBeChecked({ checked }) should have expected |
| `EX-180` | `page/expect-matcher-result.spec.ts` | toHaveScreenshot should populate matcherResult |
| `EX-181` | `page/expect-misc.spec.ts` | toHaveCount › toHaveCount pass |
| `EX-182` | `page/expect-misc.spec.ts` | toHaveCount › pass zero |
| `EX-183` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass zero |
| `EX-184` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass non-zero |
| `EX-185` | `page/expect-misc.spec.ts` | toHaveCount › eventually pass not non-zero |
| `EX-186` | `page/expect-misc.spec.ts` | toHaveCount › fail zero |
| `EX-187` | `page/expect-misc.spec.ts` | toHaveCount › fail zero 2 |
| `EX-188` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass |
| `EX-189` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail |
| `EX-190` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass string |
| `EX-191` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail string |
| `EX-192` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass number |
| `EX-193` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail number |
| `EX-194` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass boolean |
| `EX-195` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail boolean |
| `EX-196` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass boolean 2 |
| `EX-197` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail boolean 2 |
| `EX-198` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass undefined |
| `EX-199` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass null |
| `EX-200` | `page/expect-misc.spec.ts` | toHaveJSProperty › pass nested |
| `EX-201` | `page/expect-misc.spec.ts` | toHaveJSProperty › fail nested |
| `EX-202` | `page/expect-misc.spec.ts` | toHaveClass › pass |
| `EX-203` | `page/expect-misc.spec.ts` | toHaveClass › pass with SVGs |
| `EX-204` | `page/expect-misc.spec.ts` | toHaveClass › fail |
| `EX-205` | `page/expect-misc.spec.ts` | toHaveClass › pass with array |
| `EX-206` | `page/expect-misc.spec.ts` | toHaveClass › fail with array |
| `EX-207` | `page/expect-misc.spec.ts` | toContainClass › pass |
| `EX-208` | `page/expect-misc.spec.ts` | toContainClass › pass with SVGs |
| `EX-209` | `page/expect-misc.spec.ts` | toContainClass › fail |
| `EX-210` | `page/expect-misc.spec.ts` | toContainClass › pass with array |
| `EX-211` | `page/expect-misc.spec.ts` | toContainClass › fail with array |
| `EX-212` | `page/expect-misc.spec.ts` | toHaveTitle › pass |
| `EX-213` | `page/expect-misc.spec.ts` | toHaveTitle › fail |
| `EX-214` | `page/expect-misc.spec.ts` | toHaveURL › pass |
| `EX-215` | `page/expect-misc.spec.ts` | toHaveURL › fail string |
| `EX-216` | `page/expect-misc.spec.ts` | toHaveURL › fail with invalid argument |
| `EX-217` | `page/expect-misc.spec.ts` | toHaveURL › fail with positive predicate |
| `EX-218` | `page/expect-misc.spec.ts` | toHaveURL › fail with negative predicate |
| `EX-219` | `page/expect-misc.spec.ts` | toHaveURL › resolve predicate on initial call |
| `EX-220` | `page/expect-misc.spec.ts` | toHaveURL › resolve predicate after retries |
| `EX-221` | `page/expect-misc.spec.ts` | toHaveURL › support ignoreCase |
| `EX-222` | `page/expect-misc.spec.ts` | toHaveURL › support URLPattern |
| `EX-223` | `page/expect-misc.spec.ts` | toHaveAttribute › pass |
| `EX-224` | `page/expect-misc.spec.ts` | toHaveAttribute › should not match missing attribute |
| `EX-225` | `page/expect-misc.spec.ts` | toHaveAttribute › should match boolean attribute |
| `EX-226` | `page/expect-misc.spec.ts` | toHaveAttribute › should match attribute without value |
| `EX-227` | `page/expect-misc.spec.ts` | toHaveAttribute › should support boolean attribute with options |
| `EX-228` | `page/expect-misc.spec.ts` | toHaveAttribute › support ignoreCase |
| `EX-229` | `page/expect-misc.spec.ts` | toHaveCSS › pass |
| `EX-230` | `page/expect-misc.spec.ts` | toHaveCSS › should support pseudo element |
| `EX-231` | `page/expect-misc.spec.ts` | toHaveCSS › custom css properties |
| `EX-232` | `page/expect-misc.spec.ts` | toHaveId › pass |
| `EX-233` | `page/expect-misc.spec.ts` | toBeInViewport › should work |
| `EX-234` | `page/expect-misc.spec.ts` | toBeInViewport › should respect ratio option |
| `EX-235` | `page/expect-misc.spec.ts` | toBeInViewport › should have good stack |
| `EX-236` | `page/expect-misc.spec.ts` | toBeInViewport › should report intersection even if fully covered by other element |
| `EX-237` | `page/expect-misc.spec.ts` | toHaveCount should not produce logs twice |
| `EX-238` | `page/expect-misc.spec.ts` | toHaveText should not produce logs twice |
| `EX-239` | `page/expect-misc.spec.ts` | toHaveText that does not match should not produce logs twice |
| `EX-240` | `page/expect-misc.spec.ts` | strict mode violation error format |
| `EX-241` | `page/expect-misc.spec.ts` | invalid selector error format |
| `EX-242` | `page/expect-misc.spec.ts` | should report expect error details when page closes during expect |
| `EX-243` | `page/expect-misc.spec.ts` | should report page close reason when page closes during expect |
| `EX-244` | `page/expect-timeout.spec.ts` | should print element not found |
| `EX-245` | `page/expect-timeout.spec.ts` | should print timed out error message when value does not match |
| `EX-246` | `page/expect-timeout.spec.ts` | should print timed out error message with impossible timeout |
| `EX-247` | `page/expect-timeout.spec.ts` | should print timed out error message when value does not match with impossible timeout |
| `EX-248` | `page/expect-timeout.spec.ts` | should have timeout error name |
| `EX-249` | `page/expect-timeout.spec.ts` | should not throw when navigating during one-shot check |
| `EX-250` | `page/expect-timeout.spec.ts` | should not throw when navigating during first locator handler check |
| `EX-251` | `page/expect-timeout.spec.ts` | should timeout during first locator handler check |
| `EX-252` | `page/expect-timeout.spec.ts` | should not miss element that appears between retries before the deadline |
| `EX-253` | `page/expect-timeout.spec.ts` | should fail like a timeout when the signal is aborted mid-assertion |
| `EX-254` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveText is aborted mid-assertion |
| `EX-255` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveCount is aborted mid-assertion |
| `EX-256` | `page/expect-timeout.spec.ts` | should fail like a timeout when toMatchAriaSnapshot is aborted mid-assertion |
| `EX-257` | `page/expect-timeout.spec.ts` | should fail like a timeout when toHaveURL is aborted mid-assertion |
| `EX-258` | `page/expect-timeout.spec.ts` | should fail the assertion when the signal is already aborted |
| `EX-259` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleName |
| `EX-260` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleDescription |
| `EX-261` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage |
| `EX-262` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle multiple aria-errormessage references |
| `EX-263` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › no aria-invalid attribute |
| `EX-264` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › aria-invalid="false" |
| `EX-265` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in false › aria-invalid="" (empty string) |
| `EX-266` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in true › aria-invalid="true" |
| `EX-267` | `page/expect-to-have-accessible.spec.ts` | toHaveAccessibleErrorMessage should handle aria-invalid attribute › evaluated in true › aria-invalid="foo" (unrecognized value) |
| `EX-268` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is false and aria-invalid is true |
| `EX-269` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is true and aria-invalid is true |
| `EX-270` | `page/expect-to-have-accessible.spec.ts` | should show error message when validity is false and aria-invalid is false |
| `EX-271` | `page/expect-to-have-accessible.spec.ts` | should not show error message when validity is true and aria-invalid is false |
| `EX-272` | `page/expect-to-have-accessible.spec.ts` | should show error message for all roles |
| `EX-273` | `page/expect-to-have-accessible.spec.ts` | toHaveRole |
| `EX-274` | `page/expect-to-have-text.spec.ts` | toHaveText with regex › pass |
| `EX-275` | `page/expect-to-have-text.spec.ts` | toHaveText with regex › fail |
| `EX-276` | `page/expect-to-have-text.spec.ts` | toContainText with regex › pass |
| `EX-277` | `page/expect-to-have-text.spec.ts` | toContainText with regex › fail |
| `EX-278` | `page/expect-to-have-text.spec.ts` | toContainText with string › pass |
| `EX-279` | `page/expect-to-have-text.spec.ts` | toContainText with string › fail |
| `EX-280` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass |
| `EX-281` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass contain |
| `EX-282` | `page/expect-to-have-text.spec.ts` | toHaveText with text › fail |
| `EX-283` | `page/expect-to-have-text.spec.ts` | toHaveText with text › pass eventually |
| `EX-284` | `page/expect-to-have-text.spec.ts` | toHaveText with text › with userInnerText |
| `EX-285` | `page/expect-to-have-text.spec.ts` | toHaveText with text › in shadow dom |
| `EX-286` | `page/expect-to-have-text.spec.ts` | toHaveText with text › fail with impossible timeout |
| `EX-287` | `page/expect-to-have-text.spec.ts` | toHaveText with text › do not show "element(s) not found" when the real failure is a string mismatch |
| `EX-288` | `page/expect-to-have-text.spec.ts` | not.toHaveText › pass |
| `EX-289` | `page/expect-to-have-text.spec.ts` | not.toHaveText › fail |
| `EX-290` | `page/expect-to-have-text.spec.ts` | not.toHaveText › should work when selector does not match |
| `EX-291` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass |
| `EX-292` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass lazy |
| `EX-293` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass empty |
| `EX-294` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass not empty |
| `EX-295` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass on empty |
| `EX-296` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail on not+empty |
| `EX-297` | `page/expect-to-have-text.spec.ts` | toHaveText with array › pass eventually empty |
| `EX-298` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail |
| `EX-299` | `page/expect-to-have-text.spec.ts` | toHaveText with array › fail on repeating array matchers |
| `EX-300` | `page/expect-to-have-text.spec.ts` | toContainText with array › pass |
| `EX-301` | `page/expect-to-have-text.spec.ts` | toContainText with array › fail |
| `EX-302` | `page/expect-to-have-value.spec.ts` | should work |
| `EX-303` | `page/expect-to-have-value.spec.ts` | should work with label |
| `EX-304` | `page/expect-to-have-value.spec.ts` | should work with regex |
| `EX-305` | `page/expect-to-have-value.spec.ts` | should support failure |
| `EX-306` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › works with text |
| `EX-307` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › follows labels |
| `EX-308` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › exact match with text failure |
| `EX-309` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › works with regex |
| `EX-310` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when items not selected |
| `EX-311` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when multiple not specified |
| `EX-312` | `page/expect-to-have-value.spec.ts` | toHaveValues with multi-select › fails when not a select element |
| `EX-313` | `page/expect-with-snapshot.spec.ts` | containment matchers print full element subtree › toHaveText failure includes full element subtree |
| `EX-314` | `page/expect-with-snapshot.spec.ts` | containment matchers print full element subtree › toContainText failure includes full element subtree |
| `EX-315` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toBeChecked failure prints just the input |
| `EX-316` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveAttribute failure clips descendant subtree |
| `EX-317` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveRole failure prints just the element line |
| `EX-318` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveValue failure prints the input element |
| `EX-319` | `page/expect-with-snapshot.spec.ts` | property matchers print only the element line › toHaveCSS failure prints the element line |
| `EX-320` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toBeVisible on hidden element prints full page snapshot |
| `EX-321` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toBeVisible on missing element prints full page snapshot |
| `EX-322` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toHaveText on missing element prints full page snapshot |
| `EX-323` | `page/expect-with-snapshot.spec.ts` | hidden or missing elements print full page snapshot › toHaveTitle failure prints full page snapshot |
| `EX-324` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toHaveCount failure has no aria snapshot |
| `EX-325` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toHaveText with array has no aria snapshot |
| `EX-326` | `page/expect-with-snapshot.spec.ts` | matchers that should not include an aria snapshot › toMatchAriaSnapshot failure has no extra aria snapshot |
| `EX-327` | `page/matchers.misc.spec.ts` | should outlive frame navigation |
| `EX-328` | `page/matchers.misc.spec.ts` | should print no-locator-resolved error when locator matcher did not resolve to any element |

### FA — Favicon

| ID | File | Title |
|---|---|---|
| `FA-001` | `library/favicon.spec.ts` | should load svg favicon with prefer-color-scheme |

### FC — File chooser

| ID | File | Title |
|---|---|---|
| `FC-001` | `page/page-filechooser.spec.ts` | should upload multiple large files |
| `FC-002` | `page/page-filechooser.spec.ts` | should emit event once |
| `FC-003` | `page/page-filechooser.spec.ts` | should emit event via prepend |
| `FC-004` | `page/page-filechooser.spec.ts` | should emit event for iframe |
| `FC-005` | `page/page-filechooser.spec.ts` | should emit event on/off |
| `FC-006` | `page/page-filechooser.spec.ts` | should emit event addListener/removeListener |
| `FC-007` | `page/page-filechooser.spec.ts` | should work when file input is attached to DOM |
| `FC-008` | `page/page-filechooser.spec.ts` | should work when file input is not attached to DOM |
| `FC-009` | `page/page-filechooser.spec.ts` | should not throw when filechooser belongs to iframe |
| `FC-010` | `page/page-filechooser.spec.ts` | should not throw when frame is detached immediately |
| `FC-011` | `page/page-filechooser.spec.ts` | should respect timeout |
| `FC-012` | `page/page-filechooser.spec.ts` | should respect default timeout when there is no custom timeout |
| `FC-013` | `page/page-filechooser.spec.ts` | should prioritize exact timeout over default timeout |
| `FC-014` | `page/page-filechooser.spec.ts` | should work with no timeout |
| `FC-015` | `page/page-filechooser.spec.ts` | should abort with signal |
| `FC-016` | `page/page-filechooser.spec.ts` | should return the same file chooser when there are many watchdogs simultaneously |
| `FC-017` | `page/page-filechooser.spec.ts` | should accept single file |
| `FC-018` | `page/page-filechooser.spec.ts` | should not trim big uploaded files |
| `FC-019` | `page/page-filechooser.spec.ts` | should be able to read selected file |
| `FC-020` | `page/page-filechooser.spec.ts` | should be able to reset selected files with empty file list |
| `FC-021` | `page/page-filechooser.spec.ts` | should work for single file pick |
| `FC-022` | `page/page-filechooser.spec.ts` | should work for "multiple" |
| `FC-023` | `page/page-filechooser.spec.ts` | should work for "webkitdirectory" |
| `FC-024` | `page/page-filechooser.spec.ts` | should emit event after navigation |
| `FC-025` | `page/page-filechooser.spec.ts` | should trigger listener added before navigation |
| `FC-026` | `page/page-filechooser.spec.ts` | user activation › should not open file chooser without user activation |
| `FC-027` | `page/page-filechooser.spec.ts` | user activation › should open file chooser with user activation |
| `FC-028` | `page/page-filechooser.spec.ts` | user activation › should consume user activation when opening file chooser |

### FE — Fetch

| ID | File | Title |
|---|---|---|
| `FE-001` | `library/global-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should work @smoke *(7 copies)* |
| `FE-002` | `library/global-fetch.spec.ts` | should dispose global request |
| `FE-003` | `library/global-fetch.spec.ts` | should support global userAgent option |
| `FE-004` | `library/global-fetch.spec.ts` | should support global timeout option |
| `FE-005` | `library/global-fetch.spec.ts` | should propagate extra http headers with redirects |
| `FE-006` | `library/global-fetch.spec.ts` | should preserve authorization on same-origin redirect but strip on cross-origin |
| `FE-007` | `library/global-fetch.spec.ts` | should support global httpCredentials option |
| `FE-008` | `library/global-fetch.spec.ts` | should return error with wrong credentials |
| `FE-009` | `library/global-fetch.spec.ts` | should work with correct credentials and matching origin |
| `FE-010` | `library/global-fetch.spec.ts` | should work with correct credentials and matching origin case insensitive |
| `FE-011` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching scheme |
| `FE-012` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching hostname |
| `FE-013` | `library/global-fetch.spec.ts` | should return error with correct credentials and mismatching port |
| `FE-014` | `library/global-fetch.spec.ts` | should support WWW-Authenticate: Basic |
| `FE-015` | `library/global-fetch.spec.ts` | should support HTTPCredentials.send |
| `FE-016` | `library/global-fetch.spec.ts` | should support multiple httpCredentials |
| `FE-017` | `library/global-fetch.spec.ts` | should support HTTPCredentials.send with multiple httpCredentials |
| `FE-018` | `library/global-fetch.spec.ts` | should support global ignoreHTTPSErrors option |
| `FE-019` | `library/global-fetch.spec.ts` | should propagate ignoreHTTPSErrors on redirects |
| `FE-020` | `library/global-fetch.spec.ts` | should return server address from response |
| `FE-021` | `library/global-fetch.spec.ts` | should return security details from response |
| `FE-022` | `library/global-fetch.spec.ts` | should return security details for a resumed TLS session |
| `FE-023` | `library/global-fetch.spec.ts` | should return null security details for http response |
| `FE-024` | `library/global-fetch.spec.ts` | should return security details for certificate with multiple CN attributes |
| `FE-025` | `library/global-fetch.spec.ts` | should resolve url relative to global baseURL option |
| `FE-026` | `library/global-fetch.spec.ts` | should fallback to given URL if baseURL is bogus |
| `FE-027` | `library/global-fetch.spec.ts` | should set playwright as user-agent |
| `FE-028` | `library/global-fetch.spec.ts` | should be able to construct with context options |
| `FE-029` | `library/global-fetch.spec.ts` | should return empty body |
| `FE-030` | `library/global-fetch.spec.ts` | should abort requests when context is disposed |
| `FE-031` | `library/global-fetch.spec.ts` | should abort redirected requests when context is disposed |
| `FE-032` | `library/global-fetch.spec.ts` | should remove content-length from redirected post requests |
| `FE-033` | `library/global-fetch.spec.ts` | should json stringify {object, array, string, string (falsey), bool, bool (false), number, number (falsey), null, literal string undefined} body when content-type is application/json *(10 copies)* |
| `FE-034` | `library/global-fetch.spec.ts` | should not double stringify {object, array, string, string (falsey), bool, bool (false), number, number (falsey), null, literal string undefined} body when content-type is application/json *(10 copies)* |
| `FE-035` | `library/global-fetch.spec.ts` | should accept already serialized data as Buffer when content-type is application/json |
| `FE-036` | `library/global-fetch.spec.ts` | should have nice toString |
| `FE-037` | `library/global-fetch.spec.ts` | should not fail on empty body with encoding |
| `FE-038` | `library/global-fetch.spec.ts` | should return body for failing requests |
| `FE-039` | `library/global-fetch.spec.ts` | should throw an error when maxRedirects is exceeded |
| `FE-040` | `library/global-fetch.spec.ts` | should not follow redirects when maxRedirects is set to 0 |
| `FE-041` | `library/global-fetch.spec.ts` | should throw an error when maxRedirects is less than 0 |
| `FE-042` | `library/global-fetch.spec.ts` | should not follow redirects when maxRedirects is set to 0 in newContext |
| `FE-043` | `library/global-fetch.spec.ts` | should follow redirects up to maxRedirects limit set in newContext |
| `FE-044` | `library/global-fetch.spec.ts` | should use maxRedirects from fetch when provided, overriding newContext |
| `FE-045` | `library/global-fetch.spec.ts` | should keep headers capitalization |
| `FE-046` | `library/global-fetch.spec.ts` | should serialize post data on the client |
| `FE-047` | `library/global-fetch.spec.ts` | should throw after dispose |
| `FE-048` | `library/global-fetch.spec.ts` | should retry ECONNRESET |
| `FE-049` | `library/global-fetch.spec.ts` | should expose node error code on network errors |
| `FE-050` | `library/global-fetch.spec.ts` | should append node error code to the message |
| `FE-051` | `library/global-fetch.spec.ts` | should not crash when server refuses body before reading it |
| `FE-052` | `library/global-fetch.spec.ts` | should throw when failOnStatusCode is set to true inside APIRequest context options |
| `FE-053` | `library/global-fetch.spec.ts` | should not throw when failOnStatusCode is set to false inside APIRequest context options |
| `FE-054` | `library/global-fetch-cookie.spec.ts` | should store cookie from Set-Cookie header |
| `FE-055` | `library/global-fetch-cookie.spec.ts` | addCookies should add cookies to the cookie jar |
| `FE-056` | `library/global-fetch-cookie.spec.ts` | addCookies should validate cookies |
| `FE-057` | `library/global-fetch-cookie.spec.ts` | cookies should return cookies filtered by urls |
| `FE-058` | `library/global-fetch-cookie.spec.ts` | cookies should only return cookies that apply to the url |
| `FE-059` | `library/global-fetch-cookie.spec.ts` | should only send cookies that apply to the url |
| `FE-060` | `library/global-fetch-cookie.spec.ts` | cookies should include cookies from Set-Cookie header |
| `FE-061` | `library/global-fetch-cookie.spec.ts` | clearCookies should remove all cookies |
| `FE-062` | `library/global-fetch-cookie.spec.ts` | clearCookies should filter by name, domain and path |
| `FE-063` | `library/global-fetch-cookie.spec.ts` | clearCookies should remove nameless cookies by empty name |
| `FE-064` | `library/global-fetch-cookie.spec.ts` | should send nameless cookies as value only |
| `FE-065` | `library/global-fetch-cookie.spec.ts` | should store Set-Cookie without equals sign as nameless cookie |
| `FE-066` | `library/global-fetch-cookie.spec.ts` | should filter outgoing cookies by path |
| `FE-067` | `library/global-fetch-cookie.spec.ts` | should filter outgoing cookies by domain |
| `FE-068` | `library/global-fetch-cookie.spec.ts` | should do case-insensitive match of cookie domain |
| `FE-069` | `library/global-fetch-cookie.spec.ts` | should do case-insensitive match of request domain |
| `FE-070` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over https |
| `FE-071` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for localhost |
| `FE-072` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for subdomains of localhost |
| `FE-073` | `library/global-fetch-cookie.spec.ts` | should send secure cookie over http for {127.0.0.1, \[::1\]} *(2 copies)* |
| `FE-074` | `library/global-fetch-cookie.spec.ts` | should send not expired cookies |
| `FE-075` | `library/global-fetch-cookie.spec.ts` | should remove expired cookies |
| `FE-076` | `library/global-fetch-cookie.spec.ts` | should remove cookie with negative max-age |
| `FE-077` | `library/global-fetch-cookie.spec.ts` | should prefer max-age over expires regardless of the order |
| `FE-078` | `library/global-fetch-cookie.spec.ts` | should ignore max-age that is not a number |
| `FE-079` | `library/global-fetch-cookie.spec.ts` | should remove cookie with expires far in the past |
| `FE-080` | `library/global-fetch-cookie.spec.ts` | should store cookie from Set-Cookie header even if it contains equal signs |
| `FE-081` | `library/global-fetch-cookie.spec.ts` | should override cookie from Set-Cookie header |
| `FE-082` | `library/global-fetch-cookie.spec.ts` | should override cookie from Set-Cookie header even if it expired |
| `FE-083` | `library/global-fetch-cookie.spec.ts` | should export cookies to storage state |
| `FE-084` | `library/global-fetch-cookie.spec.ts` | should preserve origin storage on import/export of storage state |
| `FE-085` | `library/global-fetch-cookie.spec.ts` | should send cookies from storage state |
| `FE-086` | `library/global-fetch-cookie.spec.ts` | storage state should round-trip through file |
| `FE-087` | `library/global-fetch-cookie.spec.ts` | should work with empty storage state |
| `FE-088` | `library/browsercontext-fetch.spec.ts` | get should work @smoke |
| `FE-089` | `library/browsercontext-fetch.spec.ts` | fetch should work |
| `FE-090` | `library/browsercontext-fetch.spec.ts` | should return timing |
| `FE-091` | `library/browsercontext-fetch.spec.ts` | should return timing for https |
| `FE-092` | `library/browsercontext-fetch.spec.ts` | should throw on network error |
| `FE-093` | `library/browsercontext-fetch.spec.ts` | should throw on network error after redirect |
| `FE-094` | `library/browsercontext-fetch.spec.ts` | should throw on network error when sending body |
| `FE-095` | `library/browsercontext-fetch.spec.ts` | should throw on network error when sending body after redirect |
| `FE-096` | `library/browsercontext-fetch.spec.ts` | should add session cookies to request |
| `FE-097` | `library/browsercontext-fetch.spec.ts` | should filter cookies by domain |
| `FE-098` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as object *(7 copies)* |
| `FE-099` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as URLSearchParams *(7 copies)* |
| `FE-100` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support params passed as string *(7 copies)* |
| `FE-101` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should append string and URLSearchParams params to the URL query *(7 copies)* |
| `FE-102` | `library/browsercontext-fetch.spec.ts` | {fetch, delete, get, head, patch, post, put} should support failOnStatusCode *(7 copies)* |
| `FE-103` | `library/browsercontext-fetch.spec.ts` | {fetchshould, deleteshould, getshould, headshould, patchshould, postshould, putshould} support ignoreHTTPSErrors option *(7 copies)* |
| `FE-104` | `library/browsercontext-fetch.spec.ts` | should not add context cookie if cookie header passed as a parameter |
| `FE-105` | `library/browsercontext-fetch.spec.ts` | should follow redirects |
| `FE-106` | `library/browsercontext-fetch.spec.ts` | should follow redirects correctly when Location header contains UTF-8 characters |
| `FE-107` | `library/browsercontext-fetch.spec.ts` | should add cookies from Set-Cookie header |
| `FE-108` | `library/browsercontext-fetch.spec.ts` | page.request.addCookies should add cookies to the browser context |
| `FE-109` | `library/browsercontext-fetch.spec.ts` | page.request.cookies should return browser context cookies |
| `FE-110` | `library/browsercontext-fetch.spec.ts` | page.request.clearCookies should clear browser context cookies |
| `FE-111` | `library/browsercontext-fetch.spec.ts` | should preserve cookie order from Set-Cookie header |
| `FE-112` | `library/browsercontext-fetch.spec.ts` | should support cookie with empty value |
| `FE-113` | `library/browsercontext-fetch.spec.ts` | should not lose body while handling Set-Cookie header |
| `FE-114` | `library/browsercontext-fetch.spec.ts` | should remove cookie with negative max-age |
| `FE-115` | `library/browsercontext-fetch.spec.ts` | should remove cookie with expires far in the past |
| `FE-116` | `library/browsercontext-fetch.spec.ts` | should handle cookies on redirects |
| `FE-117` | `library/browsercontext-fetch.spec.ts` | should return raw headers |
| `FE-118` | `library/browsercontext-fetch.spec.ts` | should work with http credentials |
| `FE-119` | `library/browsercontext-fetch.spec.ts` | should work with setHTTPCredentials |
| `FE-120` | `library/browsercontext-fetch.spec.ts` | should return error with wrong credentials |
| `FE-121` | `library/browsercontext-fetch.spec.ts` | should support multiple httpCredentials |
| `FE-122` | `library/browsercontext-fetch.spec.ts` | should support HTTPCredentials.send for newContext |
| `FE-123` | `library/browsercontext-fetch.spec.ts` | should support HTTPCredentials.send for browser.newPage |
| `FE-124` | `library/browsercontext-fetch.spec.ts` | delete should support post data |
| `FE-125` | `library/browsercontext-fetch.spec.ts` | get should support post data |
| `FE-126` | `library/browsercontext-fetch.spec.ts` | head should support post data |
| `FE-127` | `library/browsercontext-fetch.spec.ts` | patch should support post data |
| `FE-128` | `library/browsercontext-fetch.spec.ts` | post should support post data |
| `FE-129` | `library/browsercontext-fetch.spec.ts` | put should support post data |
| `FE-130` | `library/browsercontext-fetch.spec.ts` | should add default headers |
| `FE-131` | `library/browsercontext-fetch.spec.ts` | should send content-length |
| `FE-132` | `library/browsercontext-fetch.spec.ts` | should add default headers to redirects |
| `FE-133` | `library/browsercontext-fetch.spec.ts` | should allow to override default headers |
| `FE-134` | `library/browsercontext-fetch.spec.ts` | should propagate custom headers with redirects |
| `FE-135` | `library/browsercontext-fetch.spec.ts` | should propagate extra http headers with redirects |
| `FE-136` | `library/browsercontext-fetch.spec.ts` | should throw on invalid header value |
| `FE-137` | `library/browsercontext-fetch.spec.ts` | should throw on non-http(s) protocol |
| `FE-138` | `library/browsercontext-fetch.spec.ts` | should support https |
| `FE-139` | `library/browsercontext-fetch.spec.ts` | should inherit ignoreHTTPSErrors from context |
| `FE-140` | `library/browsercontext-fetch.spec.ts` | should resolve url relative to baseURL |
| `FE-141` | `library/browsercontext-fetch.spec.ts` | should support gzip compression |
| `FE-142` | `library/browsercontext-fetch.spec.ts` | should support case-insensitive content-encoding |
| `FE-143` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted gzip body |
| `FE-144` | `library/browsercontext-fetch.spec.ts` | should support brotli compression |
| `FE-145` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted brotli body |
| `FE-146` | `library/browsercontext-fetch.spec.ts` | should support deflate compression |
| `FE-147` | `library/browsercontext-fetch.spec.ts` | should throw informative error on corrupted deflate body |
| `FE-148` | `library/browsercontext-fetch.spec.ts` | should support timeout option |
| `FE-149` | `library/browsercontext-fetch.spec.ts` | should support a timeout of 0 |
| `FE-150` | `library/browsercontext-fetch.spec.ts` | should respect timeout after redirects |
| `FE-151` | `library/browsercontext-fetch.spec.ts` | should not hang on a brotli encoded Range request |
| `FE-152` | `library/browsercontext-fetch.spec.ts` | should dispose |
| `FE-153` | `library/browsercontext-fetch.spec.ts` | should dispose when context closes |
| `FE-154` | `library/browsercontext-fetch.spec.ts` | should override request parameters |
| `FE-155` | `library/browsercontext-fetch.spec.ts` | should support application/x-www-form-urlencoded |
| `FE-156` | `library/browsercontext-fetch.spec.ts` | should support application/x-www-form-urlencoded with param lists |
| `FE-157` | `library/browsercontext-fetch.spec.ts` | should encode to application/json by default |
| `FE-158` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data |
| `FE-159` | `library/browsercontext-fetch.spec.ts` | should escape quotes and newlines in multipart field and file names |
| `FE-160` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data with ReadStream values |
| `FE-161` | `library/browsercontext-fetch.spec.ts` | should support multipart/form-data and keep the order |
| `FE-162` | `library/browsercontext-fetch.spec.ts` | should support repeating names in multipart/form-data |
| `FE-163` | `library/browsercontext-fetch.spec.ts` | should serialize data to json regardless of content-type |
| `FE-164` | `library/browsercontext-fetch.spec.ts` | should throw nice error on unsupported data type |
| `FE-165` | `library/browsercontext-fetch.spec.ts` | context request should export same storage state as context |
| `FE-166` | `library/browsercontext-fetch.spec.ts` | should send secure cookie over http for localhost |
| `FE-167` | `library/browsercontext-fetch.spec.ts` | should accept bool and numeric params and filter out undefined |
| `FE-168` | `library/browsercontext-fetch.spec.ts` | should abort requests when browser context closes |
| `FE-169` | `library/browsercontext-fetch.spec.ts` | should work with connectOverCDP |
| `FE-170` | `library/browsercontext-fetch.spec.ts` | should support SameSite cookie attribute over https |
| `FE-171` | `library/browsercontext-fetch.spec.ts` | should set domain=localhost cookie |
| `FE-172` | `library/browsercontext-fetch.spec.ts` | fetch should not throw on long set-cookie value |
| `FE-173` | `library/browsercontext-fetch.spec.ts` | should support set-cookie with SameSite and without Secure attribute over HTTP |
| `FE-174` | `library/browsercontext-fetch.spec.ts` | should update host header on redirect |
| `FE-175` | `library/browsercontext-fetch.spec.ts` | should not work after dispose |
| `FE-176` | `library/browsercontext-fetch.spec.ts` | should not work after context dispose |
| `FE-177` | `library/browsercontext-fetch.spec.ts` | should retry on ECONNRESET |
| `FE-178` | `library/browsercontext-fetch.spec.ts` | should retry ECONNRESET on compressed response |
| `FE-179` | `library/browsercontext-fetch.spec.ts` | should retry ECONNRESET mid-stream during gzip decompression |
| `FE-180` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should support decompression *(3 copies)* |
| `FE-181` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail if response content-length header is missing {(gzip), (deflate), (br)} *(3 copies)* |
| `FE-182` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with chunked responses (without Content-Length header) *(3 copies)* |
| `FE-183` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with an empty response without content-length header (Z\_BUF\_ERROR) *(3 copies)* |
| `FE-184` | `library/browsercontext-fetch-algorithms.spec.ts` | algorithms › {gzip, deflate, br} decompression › should not fail with an empty response with content-length header (Z\_BUF\_ERROR) *(3 copies)* |
| `FE-185` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | get should work |
| `FE-186` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | get should work on request fixture |
| `FE-187` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | https post should work with ignoreHTTPSErrors option |
| `FE-188` | `library/browsercontext-fetch-happy-eyeballs.spec.ts` | should work with ip6 and port as the host |

### FF — Firefox

| ID | File | Title |
|---|---|---|
| `FF-001` | `library/firefox/launcher.spec.ts` | should pass firefox user preferences |
| `FF-002` | `library/firefox/launcher.spec.ts` | should pass firefox user preferences in persistent |
| `FF-003` | `library/firefox/launcher.spec.ts` | should support custom firefox policies |
| `FF-004` | `library/firefox/launcher.spec.ts` | should resize viewport with fractional device scale factor |
| `FF-005` | `page/firefox-network-response.spec.ts` | should preserve original response header fields for {200, 302} responses *(2 copies)* |
| `FF-006` | `page/firefox-network-response.spec.ts` | should preserve synthesized response header fields |
| `FF-007` | `page/firefox-network-response.spec.ts` | should report current effective fields after cache revalidation |
| `FF-008` | `page/firefox-network-response.spec.ts` | should report a standalone 304 response without waiting for a cache merge |

### FI — Fill

| ID | File | Title |
|---|---|---|
| `FI-001` | `page/page-fill.spec.ts` | should fill textarea @smoke |
| `FI-002` | `page/page-fill.spec.ts` | should fill input |
| `FI-003` | `page/page-fill.spec.ts` | should throw on unsupported inputs |
| `FI-004` | `page/page-fill.spec.ts` | should fill different input types |
| `FI-005` | `page/page-fill.spec.ts` | should fill range input |
| `FI-006` | `page/page-fill.spec.ts` | should fill color input |
| `FI-007` | `page/page-fill.spec.ts` | should fill color input case insensitive |
| `FI-008` | `page/page-fill.spec.ts` | should fill date input after clicking |
| `FI-009` | `page/page-fill.spec.ts` | input event.composed should be true and cross shadow dom boundary - {color, date, time, datetime-local, month, range, week} *(7 copies)* |
| `FI-010` | `page/page-fill.spec.ts` | should fill time input |
| `FI-011` | `page/page-fill.spec.ts` | should fill month input |
| `FI-012` | `page/page-fill.spec.ts` | should fill week input |
| `FI-013` | `page/page-fill.spec.ts` | should fill datetime-local input |
| `FI-014` | `page/page-fill.spec.ts` | should fill contenteditable |
| `FI-015` | `page/page-fill.spec.ts` | should fill contenteditable with new lines |
| `FI-016` | `page/page-fill.spec.ts` | should not double-fill in contenteditable with beforeinput handler in Firefox |
| `FI-017` | `page/page-fill.spec.ts` | should fill elements with existing value and selection |
| `FI-018` | `page/page-fill.spec.ts` | should throw nice error without injected script stack when element is not an \<input\> |
| `FI-019` | `page/page-fill.spec.ts` | should throw if passed a non-string value |
| `FI-020` | `page/page-fill.spec.ts` | should retry on disabled element |
| `FI-021` | `page/page-fill.spec.ts` | should retry on readonly element |
| `FI-022` | `page/page-fill.spec.ts` | should retry on invisible element |
| `FI-023` | `page/page-fill.spec.ts` | should be able to fill the body |
| `FI-024` | `page/page-fill.spec.ts` | should fill fixed position input |
| `FI-025` | `page/page-fill.spec.ts` | should be able to fill when focus is in the wrong frame |
| `FI-026` | `page/page-fill.spec.ts` | should be able to fill the input\[type=number\] |
| `FI-027` | `page/page-fill.spec.ts` | should be able to fill exponent into the input\[type=number\] |
| `FI-028` | `page/page-fill.spec.ts` | should be able to fill input\[type=number\] with empty string |
| `FI-029` | `page/page-fill.spec.ts` | should not be able to fill text into the input\[type=number\] |
| `FI-030` | `page/page-fill.spec.ts` | should be able to clear using fill() |
| `FI-031` | `page/page-fill.spec.ts` | should not throw when fill causes navigation |
| `FI-032` | `page/page-fill.spec.ts` | fill back to back |
| `FI-033` | `page/page-fill.spec.ts` | should fill contenteditable with focus handler that collapses selection |
| `FI-034` | `page/page-fill.spec.ts` | should retry on inert element |
| `FI-035` | `page/page-fill.spec.ts` | should retry on element outside of a modal dialog |
| `FI-036` | `page/page-fill.spec.ts` | should fail with a nice error on inert element |

### FO — Focus

| ID | File | Title |
|---|---|---|
| `FO-001` | `page/page-focus.spec.ts` | should work @smoke |
| `FO-002` | `page/page-focus.spec.ts` | should emit focus event |
| `FO-003` | `page/page-focus.spec.ts` | should emit blur event |
| `FO-004` | `page/page-focus.spec.ts` | should traverse focus |
| `FO-005` | `page/page-focus.spec.ts` | should traverse focus in all directions |
| `FO-006` | `page/page-focus.spec.ts` | should traverse only form elements |
| `FO-007` | `page/page-focus.spec.ts` | clicking checkbox should activate it |
| `FO-008` | `page/page-focus.spec.ts` | tab should cycle between single input and browser |
| `FO-009` | `page/page-focus.spec.ts` | tab should cycle between document elements and browser |
| `FO-010` | `page/page-focus.spec.ts` | keeps focus on element when attempting to focus a non-focusable element |
| `FO-011` | `page/page-focus.spec.ts` | should move focus from an iframe to its parent |
| `FO-012` | `page/page-focus.spec.ts` | should tab from an iframe to its parent |
| `FO-013` | `page/page-focus.spec.ts` | should move focus from the parent into its iframe |

### FR — Frame

| ID | File | Title |
|---|---|---|
| `FR-001` | `page/frame-evaluate.spec.ts` | should have different execution contexts |
| `FR-002` | `page/frame-evaluate.spec.ts` | should have correct execution contexts @smoke |
| `FR-003` | `page/frame-evaluate.spec.ts` | should dispose context on navigation |
| `FR-004` | `page/frame-evaluate.spec.ts` | should dispose context on cross-origin navigation |
| `FR-005` | `page/frame-evaluate.spec.ts` | should execute after cross-site navigation |
| `FR-006` | `page/frame-evaluate.spec.ts` | should not allow cross-frame js handles |
| `FR-007` | `page/frame-evaluate.spec.ts` | should allow cross-frame element handles |
| `FR-008` | `page/frame-evaluate.spec.ts` | should not allow cross-frame element handles when frames do not script each other |
| `FR-009` | `page/frame-evaluate.spec.ts` | should throw for detached frames |
| `FR-010` | `page/frame-evaluate.spec.ts` | should be isolated between frames |
| `FR-011` | `page/frame-evaluate.spec.ts` | should work in iframes that failed initial navigation |
| `FR-012` | `page/frame-evaluate.spec.ts` | should work in iframes that interrupted initial javascript url navigation |
| `FR-013` | `page/frame-evaluate.spec.ts` | evaluateHandle should work |
| `FR-014` | `page/frame-frame-element.spec.ts` | should work @smoke |
| `FR-015` | `page/frame-frame-element.spec.ts` | should work with contentFrame |
| `FR-016` | `page/frame-frame-element.spec.ts` | should work with frameset |
| `FR-017` | `page/frame-frame-element.spec.ts` | should throw when detached |
| `FR-018` | `page/frame-frame-element.spec.ts` | should work inside closed shadow root |
| `FR-019` | `page/frame-frame-element.spec.ts` | should work inside declarative shadow root |
| `FR-020` | `page/frame-goto.spec.ts` | should navigate subframes @smoke |
| `FR-021` | `page/frame-goto.spec.ts` | should reject when frame detaches |
| `FR-022` | `page/frame-goto.spec.ts` | should continue after client redirect |
| `FR-023` | `page/frame-goto.spec.ts` | should return matching responses |
| `FR-024` | `page/frame-hierarchy.spec.ts` | should handle nested frames @smoke |
| `FR-025` | `page/frame-hierarchy.spec.ts` | should send events when frames are manipulated dynamically |
| `FR-026` | `page/frame-hierarchy.spec.ts` | should send "framenavigated" when navigating on anchor URLs |
| `FR-027` | `page/frame-hierarchy.spec.ts` | should persist mainFrame on cross-process navigation |
| `FR-028` | `page/frame-hierarchy.spec.ts` | should not send attach/detach events for main frame |
| `FR-029` | `page/frame-hierarchy.spec.ts` | should detach child frames on navigation |
| `FR-030` | `page/frame-hierarchy.spec.ts` | should support framesets |
| `FR-031` | `page/frame-hierarchy.spec.ts` | should report frame from-inside shadow DOM |
| `FR-032` | `page/frame-hierarchy.spec.ts` | should report frame.name() |
| `FR-033` | `page/frame-hierarchy.spec.ts` | should report frame.parent() |
| `FR-034` | `page/frame-hierarchy.spec.ts` | should report different frame instance when frame re-attaches |
| `FR-035` | `page/frame-hierarchy.spec.ts` | should refuse to display x-frame-options:deny iframe |
| `FR-036` | `page/frame-hierarchy.spec.ts` | should return frame.page() |

### GE — Geolocation

| ID | File | Title |
|---|---|---|
| `GE-001` | `library/geolocation.spec.ts` | should work @smoke |
| `GE-002` | `library/geolocation.spec.ts` | should throw when invalid longitude |
| `GE-003` | `library/geolocation.spec.ts` | should isolate contexts |
| `GE-004` | `library/geolocation.spec.ts` | should throw with missing latitude |
| `GE-005` | `library/geolocation.spec.ts` | should not modify passed default options object |
| `GE-006` | `library/geolocation.spec.ts` | should throw with missing longitude in default options |
| `GE-007` | `library/geolocation.spec.ts` | should use context options |
| `GE-008` | `library/geolocation.spec.ts` | watchPosition should be notified |
| `GE-009` | `library/geolocation.spec.ts` | should use context options for popup |

### GN — Locator and selector generator

| ID | File | Title |
|---|---|---|
| `GN-001` | `library/locator-generator.spec.ts` | reverse engineer locators |
| `GN-002` | `library/locator-generator.spec.ts` | reverse engineer getByRole |
| `GN-003` | `library/locator-generator.spec.ts` | refuses to translate internal:role with conflicting name/description exactness |
| `GN-004` | `library/locator-generator.spec.ts` | reverse engineer internal:role with regex and string name/description |
| `GN-005` | `library/locator-generator.spec.ts` | reverse engineer ignore-case locators |
| `GN-006` | `library/locator-generator.spec.ts` | reverse engineer ordered locators |
| `GN-007` | `library/locator-generator.spec.ts` | reverse engineer locators with regex |
| `GN-008` | `library/locator-generator.spec.ts` | reverse engineer hasText |
| `GN-009` | `library/locator-generator.spec.ts` | reverse engineer hasNotText |
| `GN-010` | `library/locator-generator.spec.ts` | reverse engineer visible |
| `GN-011` | `library/locator-generator.spec.ts` | reverse engineer has |
| `GN-012` | `library/locator-generator.spec.ts` | reverse engineer hasNot |
| `GN-013` | `library/locator-generator.spec.ts` | reverse engineer has + hasText |
| `GN-014` | `library/locator-generator.spec.ts` | reverse engineer frameLocator |
| `GN-015` | `library/locator-generator.spec.ts` | reverse engineer frameLocator without a selector |
| `GN-016` | `library/locator-generator.spec.ts` | generate multiple locators |
| `GN-017` | `library/locator-generator.spec.ts` | reverse engineer internal:has-text locators |
| `GN-018` | `library/locator-generator.spec.ts` | asLocator internal:and |
| `GN-019` | `library/locator-generator.spec.ts` | asLocator internal:or |
| `GN-020` | `library/locator-generator.spec.ts` | asLocator internal:chain |
| `GN-021` | `library/locator-generator.spec.ts` | reverse engineer nested locators |
| `GN-022` | `library/locator-generator.spec.ts` | asLocator xpath |
| `GN-023` | `library/locator-generator.spec.ts` | reverse engineer regex flags |
| `GN-024` | `library/locator-generator.spec.ts` | should not oom in locator parser |
| `GN-025` | `library/locator-generator.spec.ts` | asLocatorDescription invalid input |
| `GN-026` | `library/locator-generator.spec.ts` | resolveSelector returns locatorCode for sdkLanguage |
| `GN-027` | `library/locator-generator.spec.ts` | asLocatorDescription via LocalUtils |
| `GN-028` | `library/selector-generator.spec.ts` | selector generator › should prefer button over inner span |
| `GN-029` | `library/selector-generator.spec.ts` | selector generator › should prefer role=button over inner span |
| `GN-030` | `library/selector-generator.spec.ts` | selector generator › should not prefer zero-sized button over inner span |
| `GN-031` | `library/selector-generator.spec.ts` | selector generator › should generate text and normalize whitespace |
| `GN-032` | `library/selector-generator.spec.ts` | selector generator › should not escape spaces inside named attr selectors |
| `GN-033` | `library/selector-generator.spec.ts` | selector generator › should generate text for \<input type=button\> |
| `GN-034` | `library/selector-generator.spec.ts` | selector generator › should trim text |
| `GN-035` | `library/selector-generator.spec.ts` | selector generator › should try to improve role name |
| `GN-036` | `library/selector-generator.spec.ts` | selector generator › should use description when name is not unique |
| `GN-037` | `library/selector-generator.spec.ts` | selector generator › should not use description when name is unique |
| `GN-038` | `library/selector-generator.spec.ts` | selector generator › should use description from aria-describedby |
| `GN-039` | `library/selector-generator.spec.ts` | selector generator › should fall back to nth when name and description are both not unique |
| `GN-040` | `library/selector-generator.spec.ts` | selector generator › should use consistent exactness for name and description |
| `GN-041` | `library/selector-generator.spec.ts` | selector generator › should use description when role has no name |
| `GN-042` | `library/selector-generator.spec.ts` | selector generator › should try to improve text |
| `GN-043` | `library/selector-generator.spec.ts` | selector generator › should try to improve text by shortening |
| `GN-044` | `library/selector-generator.spec.ts` | selector generator › should try to improve label text by shortening |
| `GN-045` | `library/selector-generator.spec.ts` | selector generator › should not improve guid text |
| `GN-046` | `library/selector-generator.spec.ts` | selector generator › should not escape text with \>\> |
| `GN-047` | `library/selector-generator.spec.ts` | selector generator › should escape text with quote |
| `GN-048` | `library/selector-generator.spec.ts` | selector generator › should escape text with slash |
| `GN-049` | `library/selector-generator.spec.ts` | selector generator › should not use text for select |
| `GN-050` | `library/selector-generator.spec.ts` | selector generator › should use ordinal for identical nodes |
| `GN-051` | `library/selector-generator.spec.ts` | selector generator › should prefer data-testid |
| `GN-052` | `library/selector-generator.spec.ts` | selector generator › should use data-testid in strict errors |
| `GN-053` | `library/selector-generator.spec.ts` | selector generator › should handle first non-unique data-testid |
| `GN-054` | `library/selector-generator.spec.ts` | selector generator › should handle second non-unique data-testid |
| `GN-055` | `library/selector-generator.spec.ts` | selector generator › should use readable id |
| `GN-056` | `library/selector-generator.spec.ts` | selector generator › should not use generated id |
| `GN-057` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text |
| `GN-058` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text with regexp |
| `GN-059` | `library/selector-generator.spec.ts` | selector generator › should use internal:has-text with regexp with a quote |
| `GN-060` | `library/selector-generator.spec.ts` | selector generator › should chain text after parent |
| `GN-061` | `library/selector-generator.spec.ts` | selector generator › should use parent text |
| `GN-062` | `library/selector-generator.spec.ts` | selector generator › should separate selectors by \>\> |
| `GN-063` | `library/selector-generator.spec.ts` | selector generator › should trim long text |
| `GN-064` | `library/selector-generator.spec.ts` | selector generator › should use nested ordinals |
| `GN-065` | `library/selector-generator.spec.ts` | selector generator › should prefer class to ordinal |
| `GN-066` | `library/selector-generator.spec.ts` | selector generator › should properly join child selectors under nested ordinals |
| `GN-067` | `library/selector-generator.spec.ts` | selector generator › should not use input\[value\] |
| `GN-068` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › role |
| `GN-069` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › placeholder |
| `GN-070` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › name |
| `GN-071` | `library/selector-generator.spec.ts` | selector generator › should prioritize attributes correctly › type |
| `GN-072` | `library/selector-generator.spec.ts` | selector generator › should find text in shadow dom |
| `GN-073` | `library/selector-generator.spec.ts` | selector generator › should match in shadow dom |
| `GN-074` | `library/selector-generator.spec.ts` | selector generator › should match in deep shadow dom |
| `GN-075` | `library/selector-generator.spec.ts` | selector generator › should work in dynamic iframes without navigation |
| `GN-076` | `library/selector-generator.spec.ts` | selector generator › should use the name attributes for elements that can have it |
| `GN-077` | `library/selector-generator.spec.ts` | selector generator › should work with tricky attributes |
| `GN-078` | `library/selector-generator.spec.ts` | selector generator › should work without CSS.escape |
| `GN-079` | `library/selector-generator.spec.ts` | selector generator › should not over-escape for CSS syntax |
| `GN-080` | `library/selector-generator.spec.ts` | selector generator › should ignore empty aria-label for candidate consideration |
| `GN-081` | `library/selector-generator.spec.ts` | selector generator › should accept valid aria-label for candidate consideration |
| `GN-082` | `library/selector-generator.spec.ts` | selector generator › should generate title selector |
| `GN-083` | `library/selector-generator.spec.ts` | selector generator › should ignore empty role for candidate consideration |
| `GN-084` | `library/selector-generator.spec.ts` | selector generator › should not accept invalid role for candidate consideration |
| `GN-085` | `library/selector-generator.spec.ts` | selector generator › should ignore empty data-test-id for candidate consideration |
| `GN-086` | `library/selector-generator.spec.ts` | selector generator › should accept valid data-test-id for candidate consideration |
| `GN-087` | `library/selector-generator.spec.ts` | selector generator › should generate label selector |
| `GN-088` | `library/selector-generator.spec.ts` | selector generator › should prefer role other input\[type\] |
| `GN-089` | `library/selector-generator.spec.ts` | selector generator › should generate exact text when necessary |
| `GN-090` | `library/selector-generator.spec.ts` | selector generator › should generate exact title when necessary |
| `GN-091` | `library/selector-generator.spec.ts` | selector generator › should generate exact placeholder when necessary |
| `GN-092` | `library/selector-generator.spec.ts` | selector generator › should generate exact role when necessary |
| `GN-093` | `library/selector-generator.spec.ts` | selector generator › should generate exact label when necessary |
| `GN-094` | `library/selector-generator.spec.ts` | selector generator › should generate relative selector |
| `GN-095` | `library/selector-generator.spec.ts` | selector generator › should generate noText: no text engine |
| `GN-096` | `library/selector-generator.spec.ts` | selector generator › should generate noText: no name from content |
| `GN-097` | `library/selector-generator.spec.ts` | selector generator › should generate noText: name from aria-label |
| `GN-098` | `library/selector-generator.spec.ts` | selector generator › should generate noText: name from external aria-labelledby |
| `GN-099` | `library/selector-generator.spec.ts` | selector generator › should generate noText: ignore aria-labelledby pointing inside the element |
| `GN-100` | `library/selector-generator.spec.ts` | selector generator › should generate noText: contenteditable heading |
| `GN-101` | `library/selector-generator.spec.ts` | selector generator › should generate noText: description from external aria-describedby |
| `GN-102` | `library/selector-generator.spec.ts` | selector generator › should generate noText: ignore aria-describedby pointing inside the element |
| `GN-103` | `library/selector-generator.spec.ts` | selector generator › should prefer role with hasText to css with hasText |
| `GN-104` | `library/selector-generator.spec.ts` | selector generator › should not use icon fonts aria name |
| `GN-105` | `library/selector-generator.spec.ts` | selector generator › should not throw for slotted element when host shadow root has a twin |

### HA — HAR

| ID | File | Title |
|---|---|---|
| `HA-001` | `library/har.spec.ts` | should have version and creator |
| `HA-002` | `library/har.spec.ts` | should have browser |
| `HA-003` | `library/har.spec.ts` | should have pages |
| `HA-004` | `library/har.spec.ts` | should have pages in persistent context |
| `HA-005` | `library/har.spec.ts` | should include request |
| `HA-006` | `library/har.spec.ts` | should populate entry startedDateTime from the browser |
| `HA-007` | `library/har.spec.ts` | should include response |
| `HA-008` | `library/har.spec.ts` | should include redirectURL |
| `HA-009` | `library/har.spec.ts` | should include query params |
| `HA-010` | `library/har.spec.ts` | should include postData |
| `HA-011` | `library/har.spec.ts` | should include binary postData |
| `HA-012` | `library/har.spec.ts` | should include form params |
| `HA-013` | `library/har.spec.ts` | should include cookies |
| `HA-014` | `library/har.spec.ts` | should include set-cookies |
| `HA-015` | `library/har.spec.ts` | should include set-cookies without equals sign as nameless |
| `HA-016` | `library/har.spec.ts` | should include set-cookies with lowercase attributes |
| `HA-017` | `library/har.spec.ts` | should skip invalid Expires |
| `HA-018` | `library/har.spec.ts` | should include set-cookies with comma |
| `HA-019` | `library/har.spec.ts` | should include secure set-cookies |
| `HA-020` | `library/har.spec.ts` | should record request overrides |
| `HA-021` | `library/har.spec.ts` | should include content @smoke |
| `HA-022` | `library/har.spec.ts` | should use attach mode for zip extension |
| `HA-023` | `library/har.spec.ts` | should omit content |
| `HA-024` | `library/har.spec.ts` | should omit content legacy |
| `HA-025` | `library/har.spec.ts` | should attach content |
| `HA-026` | `library/har.spec.ts` | should filter by glob |
| `HA-027` | `library/har.spec.ts` | should filter by regexp |
| `HA-028` | `library/har.spec.ts` | should include sizes |
| `HA-029` | `library/har.spec.ts` | should work with gzip compression |
| `HA-030` | `library/har.spec.ts` | should calculate time |
| `HA-031` | `library/har.spec.ts` | should return receive time |
| `HA-032` | `library/har.spec.ts` | should report the correct \_transferSize with PNG files |
| `HA-033` | `library/har.spec.ts` | should have -1 \_transferSize when its a failed request |
| `HA-034` | `library/har.spec.ts` | should record failed request headers |
| `HA-035` | `library/har.spec.ts` | should record failed request overrides |
| `HA-036` | `library/har.spec.ts` | should report the correct request body size |
| `HA-037` | `library/har.spec.ts` | should report the correct request body size when the bodySize is 0 |
| `HA-038` | `library/har.spec.ts` | should report the correct response body size when the bodySize is 0 |
| `HA-039` | `library/har.spec.ts` | should have popup requests |
| `HA-040` | `library/har.spec.ts` | should not contain internal pages |
| `HA-041` | `library/har.spec.ts` | should have connection details |
| `HA-042` | `library/har.spec.ts` | should have security details |
| `HA-043` | `library/har.spec.ts` | should have connection details for redirects |
| `HA-044` | `library/har.spec.ts` | should have connection details for failed requests |
| `HA-045` | `library/har.spec.ts` | should return server address directly from response |
| `HA-046` | `library/har.spec.ts` | should return security details directly from response |
| `HA-047` | `library/har.spec.ts` | should contain http2 for http2 requests |
| `HA-048` | `library/har.spec.ts` | should filter favicon and favicon redirects |
| `HA-049` | `library/har.spec.ts` | should have different hars for concurrent contexts |
| `HA-050` | `library/har.spec.ts` | should exclude API request |
| `HA-051` | `library/har.spec.ts` | should correctly record API request cookies with equals sign in value |
| `HA-052` | `library/har.spec.ts` | should record nameless API request cookies |
| `HA-053` | `library/har.spec.ts` | should respect minimal mode for API Requests |
| `HA-054` | `library/har.spec.ts` | should include redirects from API request |
| `HA-055` | `library/har.spec.ts` | should not hang on resources served from cache |
| `HA-056` | `library/har.spec.ts` | should not hang on slow chunked response |
| `HA-057` | `library/har.spec.ts` | should close the context when saving the har fails |
| `HA-058` | `library/har.spec.ts` | should support HAR larger than 512MB |
| `HA-059` | `library/har.spec.ts` | should record resource type |
| `HA-060` | `library/har.spec.ts` | tracing.startHar › should record a HAR with options |
| `HA-061` | `library/har.spec.ts` | tracing.startHar › should record a HAR for a context APIRequestContext |
| `HA-062` | `library/har.spec.ts` | tracing.startHar › should include pages |
| `HA-063` | `library/har.spec.ts` | tracing.startHar › should record a zipped HAR for APIRequestContext |
| `HA-064` | `library/har.spec.ts` | tracing.startHar › should record correct cookie expires for APIRequestContext |
| `HA-065` | `library/har.spec.ts` | tracing.startHar › should record mixed-case request content-type for APIRequestContext |
| `HA-066` | `library/har.spec.ts` | tracing.startHar › should record a HAR with resourcesDir |
| `HA-067` | `library/har.spec.ts` | tracing.startHar › should reject resourcesDir together with a .zip har file |
| `HA-068` | `library/browsercontext-har.spec.ts` | should context.routeFromHAR, matching the method and following redirects |
| `HA-069` | `library/browsercontext-har.spec.ts` | should page.routeFromHAR, matching the method and following redirects |
| `HA-070` | `library/browsercontext-har.spec.ts` | fallback:continue should continue when not found in har |
| `HA-071` | `library/browsercontext-har.spec.ts` | by default should abort requests not found in har |
| `HA-072` | `library/browsercontext-har.spec.ts` | fallback:continue should continue requests on bad har |
| `HA-073` | `library/browsercontext-har.spec.ts` | should only handle requests matching url filter |
| `HA-074` | `library/browsercontext-har.spec.ts` | should only context.routeFromHAR requests matching url filter |
| `HA-075` | `library/browsercontext-har.spec.ts` | should only page.routeFromHAR requests matching url filter |
| `HA-076` | `library/browsercontext-har.spec.ts` | should apply overrides before routing from har |
| `HA-077` | `library/browsercontext-har.spec.ts` | should support regex filter |
| `HA-078` | `library/browsercontext-har.spec.ts` | newPage should fulfill from har, matching the method and following redirects |
| `HA-079` | `library/browsercontext-har.spec.ts` | should change document URL after redirected navigation |
| `HA-080` | `library/browsercontext-har.spec.ts` | should change document URL after redirected navigation on click |
| `HA-081` | `library/browsercontext-har.spec.ts` | should goBack to redirected navigation |
| `HA-082` | `library/browsercontext-har.spec.ts` | should goForward to redirected navigation |
| `HA-083` | `library/browsercontext-har.spec.ts` | should reload redirected navigation |
| `HA-084` | `library/browsercontext-har.spec.ts` | should fulfill from har with content in a file |
| `HA-085` | `library/browsercontext-har.spec.ts` | should round-trip har.zip |
| `HA-086` | `library/browsercontext-har.spec.ts` | should produce extracted zip |
| `HA-087` | `library/browsercontext-har.spec.ts` | should round-trip extracted har.zip |
| `HA-088` | `library/browsercontext-har.spec.ts` | should round-trip har with postData |
| `HA-089` | `library/browsercontext-har.spec.ts` | should record overridden requests to har |
| `HA-090` | `library/browsercontext-har.spec.ts` | should disambiguate by header |
| `HA-091` | `library/browsercontext-har.spec.ts` | should update har.zip for context |
| `HA-092` | `library/browsercontext-har.spec.ts` | should ignore boundary when matching multipart/form-data body |
| `HA-093` | `library/browsercontext-har.spec.ts` | should record single set-cookie headers |
| `HA-094` | `library/browsercontext-har.spec.ts` | should record multiple set-cookie headers |
| `HA-095` | `library/browsercontext-har.spec.ts` | should update har.zip for page |
| `HA-096` | `library/browsercontext-har.spec.ts` | should update har.zip for page with different options |
| `HA-097` | `library/browsercontext-har.spec.ts` | should update extracted har.zip for page |
| `HA-098` | `library/browsercontext-har.spec.ts` | page.unrouteAll should stop page.routeFromHAR |
| `HA-099` | `library/browsercontext-har.spec.ts` | context.unrouteAll should stop context.routeFromHAR |
| `HA-100` | `library/browsercontext-har.spec.ts` | should ignore aborted requests |
| `HA-101` | `library/har-websocket.spec.ts` | should only have one websocket entry |
| `HA-102` | `library/har-websocket.spec.ts` | should include websocket handshake headers and status |
| `HA-103` | `library/har-websocket.spec.ts` | should embed websocket messages |
| `HA-104` | `library/har-websocket.spec.ts` | should attach websocket messages |
| `HA-105` | `library/har-websocket.spec.ts` | should attach websocket messages for a still open websocket after stopping |
| `HA-106` | `library/har-websocket.spec.ts` | should omit websocket messages |
| `HA-107` | `library/har-websocket.spec.ts` | should record websocket connection failure |
| `HA-108` | `library/har-websocket.spec.ts` | should record websocket handshake failure |
| `HA-109` | `library/har-websocket.spec.ts` | should still capture websocket when route passes messages through |
| `HA-110` | `library/har-websocket.spec.ts` | should still allow routeWebSocket to fully mock the connection when capturing HAR |
| `HA-111` | `library/har-websocket.spec.ts` | should still allow routeWebSocket to modify messages when capturing HAR |
| `HA-112` | `library/har-websocket.spec.ts` | should respect PLAYWRIGHT\_HAR\_NO\_WEBSOCKET\_FRAMES |
| `HA-113` | `library/har.spec.ts` | should store binary content with a textual mime type as base64 |
| `HA-114` | `library/browsercontext-har.spec.ts` | should reject a malformed har.zip |

### HE — Headful

| ID | File | Title |
|---|---|---|
| `HE-001` | `library/headful.spec.ts` | should have default url when launching browser @smoke |
| `HE-002` | `library/headful.spec.ts` | should close browser with beforeunload page |
| `HE-003` | `library/headful.spec.ts` | should close browsercontext with pending beforeunload dialog |
| `HE-004` | `library/headful.spec.ts` | should not crash when creating second context |
| `HE-005` | `library/headful.spec.ts` | should click when viewport size is larger than screen |
| `HE-006` | `library/headful.spec.ts` | should dispatch click events to oversized viewports |
| `HE-007` | `library/headful.spec.ts` | should click background tab |
| `HE-008` | `library/headful.spec.ts` | should close browser after context menu was triggered |
| `HE-009` | `library/headful.spec.ts` | should(not) block third party cookies |
| `HE-010` | `library/headful.spec.ts` | should not block third party SameSite=None cookies |
| `HE-011` | `library/headful.spec.ts` | should not override viewport size when passed null |
| `HE-012` | `library/headful.spec.ts` | Page.bringToFront should work |
| `HE-013` | `library/headful.spec.ts` | should click in OOPIF |
| `HE-014` | `library/headful.spec.ts` | should click bottom row w/ infobar in OOPIF |
| `HE-015` | `library/headful.spec.ts` | headless and headful should use same default fonts |
| `HE-016` | `library/headful.spec.ts` | should have the same hyphen rendering on headless and headed |

### HS — HTTP server

| ID | File | Title |
|---|---|---|
| `HS-001` | `library/unit/http-server.spec.ts` | should not serve files through a symlink that leaves the folder |
| `HS-002` | `library/unit/http-server.spec.ts` | should close upgrade requests to unknown paths |

### HT — Hit target

| ID | File | Title |
|---|---|---|
| `HT-001` | `library/hit-target.spec.ts` | should block all events when hit target is wrong |
| `HT-002` | `library/hit-target.spec.ts` | should block click when mousedown fails |
| `HT-003` | `library/hit-target.spec.ts` | should click when element detaches in mousedown |
| `HT-004` | `library/hit-target.spec.ts` | should block all events when hit target is wrong and element detaches |
| `HT-005` | `library/hit-target.spec.ts` | should not block programmatic events |
| `HT-006` | `library/hit-target.spec.ts` | should click the button again after document.write |
| `HT-007` | `library/hit-target.spec.ts` | should work with mui select |
| `HT-008` | `library/hit-target.spec.ts` | should work with drag and drop that moves the element under cursor |
| `HT-009` | `library/hit-target.spec.ts` | should work with block inside inline |
| `HT-010` | `library/hit-target.spec.ts` | should work with block-block-block inside inline-inline |
| `HT-011` | `library/hit-target.spec.ts` | should work with block inside inline in shadow dom |
| `HT-012` | `library/hit-target.spec.ts` | should not click iframe overlaying the target |
| `HT-013` | `library/hit-target.spec.ts` | should not click an element overlaying iframe with the target |
| `HT-014` | `library/hit-target.spec.ts` | should click into frame inside closed shadow root |
| `HT-015` | `library/hit-target.spec.ts` | should click an element inside closed shadow root |
| `HT-016` | `library/hit-target.spec.ts` | should detect overlay from another shadow root |
| `HT-017` | `library/hit-target.spec.ts` | should detect overlaid element in a transformed iframe |
| `HT-018` | `library/hit-target.spec.ts` | should click in iframe with padding |
| `HT-019` | `library/hit-target.spec.ts` | should click in iframe with padding 2 |
| `HT-020` | `library/hit-target.spec.ts` | should click in custom element |
| `HT-021` | `library/hit-target.spec.ts` | should click in nested custom elements |
| `HT-022` | `library/hit-target.spec.ts` | should click an element inside nested closed shadow roots |

### IF — Input files

| ID | File | Title |
|---|---|---|
| `IF-001` | `page/page-set-input-files.spec.ts` | should upload the file |
| `IF-002` | `page/page-set-input-files.spec.ts` | should upload a folder |
| `IF-003` | `page/page-set-input-files.spec.ts` | should upload a folder via label |
| `IF-004` | `page/page-set-input-files.spec.ts` | should upload a folder and throw for multiple directories |
| `IF-005` | `page/page-set-input-files.spec.ts` | should throw if a directory and files are passed |
| `IF-006` | `page/page-set-input-files.spec.ts` | should throw when uploading a folder in a normal file upload input |
| `IF-007` | `page/page-set-input-files.spec.ts` | should throw when uploading a file in a directory upload input |
| `IF-008` | `page/page-set-input-files.spec.ts` | should upload a file after popup |
| `IF-009` | `page/page-set-input-files.spec.ts` | should upload large file |
| `IF-010` | `page/page-set-input-files.spec.ts` | should throw an error if the file does not exist |
| `IF-011` | `page/page-set-input-files.spec.ts` | should upload large file with relative path |
| `IF-012` | `page/page-set-input-files.spec.ts` | should upload the file with spaces in name |
| `IF-013` | `page/page-set-input-files.spec.ts` | should work @smoke |
| `IF-014` | `page/page-set-input-files.spec.ts` | should set from memory |
| `IF-015` | `page/page-set-input-files.spec.ts` | should work with CSP |
| `IF-016` | `page/page-set-input-files.spec.ts` | should detect mime type |
| `IF-017` | `page/page-set-input-files.spec.ts` | should not trim big uploaded files |
| `IF-018` | `page/page-set-input-files.spec.ts` | should emit input and change events |
| `IF-019` | `page/page-set-input-files.spec.ts` | input event.composed should be true and cross shadow dom boundary |
| `IF-020` | `page/page-set-input-files.spec.ts` | input should trigger events when files changed second time |
| `IF-021` | `page/page-set-input-files.spec.ts` | should preserve lastModified timestamp |
| `IF-022` | `page/page-set-input-files.spec.ts` | should store an uploaded file in IndexedDB |

### IN — Inspector

| ID | File | Title |
|---|---|---|
| `IN-001` | `library/inspector/pause.spec.ts` | should resume when closing inspector |
| `IN-002` | `library/inspector/pause.spec.ts` | should not reset timeouts |
| `IN-003` | `library/inspector/pause.spec.ts` | should collapse log entries to a single line |
| `IN-004` | `library/inspector/pause.spec.ts` | pause › should pause and resume the script |
| `IN-005` | `library/inspector/pause.spec.ts` | pause › should pause and resume the script with keyboard shortcut |
| `IN-006` | `library/inspector/pause.spec.ts` | pause › should resume from console |
| `IN-007` | `library/inspector/pause.spec.ts` | pause › should pause after a navigation |
| `IN-008` | `library/inspector/pause.spec.ts` | pause › should show source |
| `IN-009` | `library/inspector/pause.spec.ts` | pause › should pause on next pause |
| `IN-010` | `library/inspector/pause.spec.ts` | pause › should step |
| `IN-011` | `library/inspector/pause.spec.ts` | pause › should disable timeout on paused actions |
| `IN-012` | `library/inspector/pause.spec.ts` | pause › should step with keyboard shortcut |
| `IN-013` | `library/inspector/pause.spec.ts` | pause › should highlight pointer, only in main frame |
| `IN-014` | `library/inspector/pause.spec.ts` | pause › should skip input when resuming |
| `IN-015` | `library/inspector/pause.spec.ts` | pause › should populate log |
| `IN-016` | `library/inspector/pause.spec.ts` | pause › should hide internal calls |
| `IN-017` | `library/inspector/pause.spec.ts` | pause › should show expect.toHaveText |
| `IN-018` | `library/inspector/pause.spec.ts` | pause › should highlight waitForEvent |
| `IN-019` | `library/inspector/pause.spec.ts` | pause › should populate log with waitForEvent |
| `IN-020` | `library/inspector/pause.spec.ts` | pause › should populate log with error |
| `IN-021` | `library/inspector/pause.spec.ts` | pause › should populate log with expect failure |
| `IN-022` | `library/inspector/pause.spec.ts` | pause › should populate log with error in waitForEvent |
| `IN-023` | `library/inspector/pause.spec.ts` | pause › should pause on page close |
| `IN-024` | `library/inspector/pause.spec.ts` | pause › should pause on context close |
| `IN-025` | `library/inspector/pause.spec.ts` | pause › should highlight on explore |
| `IN-026` | `library/inspector/pause.spec.ts` | pause › should highlight on explore (csharp) |
| `IN-027` | `library/inspector/pause.spec.ts` | pause › should not prevent key events |
| `IN-028` | `library/inspector/pause.spec.ts` | pause › should highlight locators with custom testId |
| `IN-029` | `library/inspector/pause.spec.ts` | pause › should record from debugger |
| `IN-030` | `library/inspector/recorder-api.spec.ts` | context should implement the internal api used by the tools |
| `IN-031` | `library/inspector/recorder-api.spec.ts` | should click |
| `IN-032` | `library/inspector/recorder-api.spec.ts` | should double click |
| `IN-033` | `library/inspector/recorder-api.spec.ts` | should right click |
| `IN-034` | `library/inspector/recorder-api.spec.ts` | should send updated code with the signal |
| `IN-035` | `library/inspector/recorder-api.spec.ts` | should not amend the last action with a signal from another page |
| `IN-036` | `library/inspector/recorder-api.spec.ts` | should type |
| `IN-037` | `library/inspector/recorder-api.spec.ts` | should stop recording |
| `IN-038` | `library/inspector/recorder-api.spec.ts` | should record again after stop |
| `IN-039` | `library/inspector/recorder-api.spec.ts` | should not start recording while the recorder is shown |
| `IN-040` | `library/inspector/recorder-api.spec.ts` | should not show the recorder while recording |
| `IN-041` | `library/inspector/recorder-api.spec.ts` | should not start recording twice |
| `IN-042` | `library/inspector/recorder-api.spec.ts` | page.pickLocator should return locator for picked element |
| `IN-043` | `library/inspector/recorder-api.spec.ts` | page.cancelPickLocator should cancel ongoing pickLocator |
| `IN-044` | `library/inspector/recorder-api.spec.ts` | closing page should cancel ongoing pickLocator |
| `IN-045` | `library/inspector/recorder-api.spec.ts` | page2.pickLocator() should cancel page1.pickLocator() |
| `IN-046` | `library/inspector/console-api.spec.ts` | should support playwright.$, playwright.$$ |
| `IN-047` | `library/inspector/console-api.spec.ts` | should support playwright.selector |
| `IN-048` | `library/inspector/console-api.spec.ts` | should support playwright.locator.value |
| `IN-049` | `library/inspector/console-api.spec.ts` | should support playwright.locator.values |
| `IN-050` | `library/inspector/console-api.spec.ts` | should support playwright.locator({ has }) |
| `IN-051` | `library/inspector/console-api.spec.ts` | should support playwright.locator({ hasNot }) |
| `IN-052` | `library/inspector/console-api.spec.ts` | should support locator.and() |
| `IN-053` | `library/inspector/console-api.spec.ts` | should support locator.or() |
| `IN-054` | `library/inspector/console-api.spec.ts` | should support playwright.getBy\* |
| `IN-055` | `library/inspector/console-api.spec.ts` | expected properties on playwright object |
| `IN-056` | `library/inspector/title.spec.ts` | should reflect formatted URL of the page |
| `IN-057` | `library/inspector/title.spec.ts` | should update primary page URL when original primary closes |
| `IN-058` | `library/inspector/title.spec.ts` | should render primary language |

### IS — Init script

| ID | File | Title |
|---|---|---|
| `IS-001` | `page/page-add-init-script.spec.ts` | should evaluate before anything else on the page |
| `IS-002` | `page/page-add-init-script.spec.ts` | should work with a path |
| `IS-003` | `page/page-add-init-script.spec.ts` | should work with content @smoke |
| `IS-004` | `page/page-add-init-script.spec.ts` | should throw without path and content |
| `IS-005` | `page/page-add-init-script.spec.ts` | should work with trailing comments |
| `IS-006` | `page/page-add-init-script.spec.ts` | should support multiple scripts |
| `IS-007` | `page/page-add-init-script.spec.ts` | should work with CSP |
| `IS-008` | `page/page-add-init-script.spec.ts` | should work after a cross origin navigation |
| `IS-009` | `page/page-add-init-script.spec.ts` | should remove init script after dispose |
| `IS-010` | `page/page-add-init-script.spec.ts` | should remove one of multiple init scripts after dispose |
| `IS-011` | `page/page-add-init-script.spec.ts` | init script should run only once in iframe |
| `IS-012` | `page/page-add-init-script-callback.spec.ts` | should drop functions without the exposeFunctions option |
| `IS-013` | `page/page-add-init-script-callback.spec.ts` | should throw when the script is not a function |
| `IS-014` | `page/page-add-init-script-callback.spec.ts` | should call a function passed as an argument |
| `IS-015` | `page/page-add-init-script-callback.spec.ts` | should accept a function as the whole argument |
| `IS-016` | `page/page-add-init-script-callback.spec.ts` | should pass arguments to the callback |
| `IS-017` | `page/page-add-init-script-callback.spec.ts` | should return the callback result to the page |
| `IS-018` | `page/page-add-init-script-callback.spec.ts` | should propagate callback errors to the page |
| `IS-019` | `page/page-add-init-script-callback.spec.ts` | should support multiple callbacks |
| `IS-020` | `page/page-add-init-script-callback.spec.ts` | should survive a navigation and keep working |
| `IS-021` | `page/page-add-init-script-callback.spec.ts` | should work in a child frame |
| `IS-022` | `page/page-add-init-script-callback.spec.ts` | should not register the callback on the global object |
| `IS-023` | `page/page-add-init-script-callback.spec.ts` | should remove exposed functions after dispose |
| `IS-024` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts @smoke |
| `IS-025` | `library/browsercontext-add-init-script.spec.ts` | should work without navigation, after all bindings |
| `IS-026` | `library/browsercontext-add-init-script.spec.ts` | should work without navigation in popup |
| `IS-027` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts with a path |
| `IS-028` | `library/browsercontext-add-init-script.spec.ts` | should work with browser context scripts for already created pages |
| `IS-029` | `library/browsercontext-add-init-script.spec.ts` | should remove context init script after dispose |
| `IS-030` | `library/browsercontext-add-init-script.spec.ts` | should remove context init script and keep working in new pages |
| `IS-031` | `library/browsercontext-add-init-script.spec.ts` | should expose functions passed as arguments |
| `IS-032` | `library/browsercontext-add-init-script.spec.ts` | should expose functions that survive navigation |
| `IS-033` | `library/browsercontext-add-init-script.spec.ts` | should expose functions in popups |
| `IS-034` | `library/browsercontext-add-init-script.spec.ts` | should remove exposed functions after dispose |
| `IS-035` | `library/browsercontext-add-init-script.spec.ts` | init script should run only once in popup |

### JH — JSHandle

| ID | File | Title |
|---|---|---|
| `JH-001` | `page/jshandle-as-element.spec.ts` | should work @smoke |
| `JH-002` | `page/jshandle-as-element.spec.ts` | should return null for non-elements |
| `JH-003` | `page/jshandle-as-element.spec.ts` | should return ElementHandle for TextNodes |
| `JH-004` | `page/jshandle-as-element.spec.ts` | should work with nullified Node |
| `JH-005` | `page/jshandle-evaluate.spec.ts` | should work with function @smoke |
| `JH-006` | `page/jshandle-evaluate.spec.ts` | should work with expression |
| `JH-007` | `page/jshandle-json-value.spec.ts` | should work @smoke |
| `JH-008` | `page/jshandle-json-value.spec.ts` | should work with dates |
| `JH-009` | `page/jshandle-json-value.spec.ts` | should handle circular objects |
| `JH-010` | `page/jshandle-properties.spec.ts` | should work @smoke |
| `JH-011` | `page/jshandle-properties.spec.ts` | should work with undefined, null, and empty |
| `JH-012` | `page/jshandle-properties.spec.ts` | should work with unserializable values |
| `JH-013` | `page/jshandle-properties.spec.ts` | getProperties should work |
| `JH-014` | `page/jshandle-properties.spec.ts` | getProperties should return empty map for non-objects |
| `JH-015` | `page/jshandle-properties.spec.ts` | getProperties should return properties inhertied from super class |
| `JH-016` | `page/jshandle-properties.spec.ts` | getProperties should return own enumerable properties only |
| `JH-017` | `page/jshandle-properties.spec.ts` | getProperties should work with elements |
| `JH-018` | `page/jshandle-to-string.spec.ts` | should work for primitives |
| `JH-019` | `page/jshandle-to-string.spec.ts` | should work for complicated objects |
| `JH-020` | `page/jshandle-to-string.spec.ts` | should beautifully render sparse arrays |
| `JH-021` | `page/jshandle-to-string.spec.ts` | should work for promises |
| `JH-022` | `page/jshandle-to-string.spec.ts` | should work with different subtypes @smoke |
| `JH-023` | `page/jshandle-to-string.spec.ts` | should work with previewable subtypes |

### JS — JSON schema

| ID | File | Title |
|---|---|---|
| `JS-001` | `library/unit/json-schema.spec.ts` | should validate string type |
| `JS-002` | `library/unit/json-schema.spec.ts` | should validate string pattern |
| `JS-003` | `library/unit/json-schema.spec.ts` | should validate array type |
| `JS-004` | `library/unit/json-schema.spec.ts` | should validate array items |
| `JS-005` | `library/unit/json-schema.spec.ts` | should validate object type |
| `JS-006` | `library/unit/json-schema.spec.ts` | should validate required properties |
| `JS-007` | `library/unit/json-schema.spec.ts` | should validate optional properties |
| `JS-008` | `library/unit/json-schema.spec.ts` | should validate oneOf |
| `JS-009` | `library/unit/json-schema.spec.ts` | should validate nested objects |
| `JS-010` | `library/unit/json-schema.spec.ts` | should validate test details schema |

### KB — Keyboard

| ID | File | Title |
|---|---|---|
| `KB-001` | `page/page-keyboard.spec.ts` | should type into a textarea @smoke |
| `KB-002` | `page/page-keyboard.spec.ts` | should move with the arrow keys |
| `KB-003` | `page/page-keyboard.spec.ts` | should send a character with ElementHandle.press |
| `KB-004` | `page/page-keyboard.spec.ts` | should send a character with insertText |
| `KB-005` | `page/page-keyboard.spec.ts` | should not type text with Alt modifier |
| `KB-006` | `page/page-keyboard.spec.ts` | insertText should only emit input event |
| `KB-007` | `page/page-keyboard.spec.ts` | should emit keydown, keypress, textInput and input when typing a character |
| `KB-008` | `page/page-keyboard.spec.ts` | should dispatch key events in separate tasks |
| `KB-009` | `page/page-keyboard.spec.ts` | should report shiftKey |
| `KB-010` | `page/page-keyboard.spec.ts` | should report multiple modifiers |
| `KB-011` | `page/page-keyboard.spec.ts` | should send proper codes while typing |
| `KB-012` | `page/page-keyboard.spec.ts` | should send proper codes while typing with shift |
| `KB-013` | `page/page-keyboard.spec.ts` | should not type canceled events |
| `KB-014` | `page/page-keyboard.spec.ts` | should press plus |
| `KB-015` | `page/page-keyboard.spec.ts` | should press shift plus |
| `KB-016` | `page/page-keyboard.spec.ts` | should support plus-separated modifiers |
| `KB-017` | `page/page-keyboard.spec.ts` | should support multiple plus-separated modifiers |
| `KB-018` | `page/page-keyboard.spec.ts` | should shift raw codes |
| `KB-019` | `page/page-keyboard.spec.ts` | should specify repeat property |
| `KB-020` | `page/page-keyboard.spec.ts` | should type all kinds of characters |
| `KB-021` | `page/page-keyboard.spec.ts` | should specify location |
| `KB-022` | `page/page-keyboard.spec.ts` | should specify numpad location on keyup |
| `KB-023` | `page/page-keyboard.spec.ts` | should press NumpadDecimal as Delete |
| `KB-024` | `page/page-keyboard.spec.ts` | should type numpad digits with Shift |
| `KB-025` | `page/page-keyboard.spec.ts` | should press Enter |
| `KB-026` | `page/page-keyboard.spec.ts` | should press audio and media control keys |
| `KB-027` | `page/page-keyboard.spec.ts` | should throw on unknown keys |
| `KB-028` | `page/page-keyboard.spec.ts` | should type emoji |
| `KB-029` | `page/page-keyboard.spec.ts` | should type emoji into an iframe |
| `KB-030` | `page/page-keyboard.spec.ts` | should handle selectAll |
| `KB-031` | `page/page-keyboard.spec.ts` | pressing Meta should not result in any text insertion on any platform |
| `KB-032` | `page/page-keyboard.spec.ts` | should be able to prevent selectAll |
| `KB-033` | `page/page-keyboard.spec.ts` | should support MacOS shortcuts |
| `KB-034` | `page/page-keyboard.spec.ts` | should press the meta key |
| `KB-035` | `page/page-keyboard.spec.ts` | should work with keyboard events with empty.html |
| `KB-036` | `page/page-keyboard.spec.ts` | should work after a cross origin navigation |
| `KB-037` | `page/page-keyboard.spec.ts` | should expose keyIdentifier in webkit |
| `KB-038` | `page/page-keyboard.spec.ts` | should scroll with PageDown |
| `KB-039` | `page/page-keyboard.spec.ts` | should move around the selection in a contenteditable |
| `KB-040` | `page/page-keyboard.spec.ts` | should move to the start of the document |
| `KB-041` | `page/page-keyboard.spec.ts` | should dispatch a click event on a button when Space gets pressed |
| `KB-042` | `page/page-keyboard.spec.ts` | should dispatch a click event on a button when Enter gets pressed |
| `KB-043` | `page/page-keyboard.spec.ts` | should support simple copy-pasting |
| `KB-044` | `page/page-keyboard.spec.ts` | should support simple cut-pasting |
| `KB-045` | `page/page-keyboard.spec.ts` | should support undo-redo |
| `KB-046` | `page/page-keyboard.spec.ts` | should type repeatedly in contenteditable in shadow dom |
| `KB-047` | `page/page-keyboard.spec.ts` | should type repeatedly in contenteditable in shadow dom with nested elements |
| `KB-048` | `page/page-keyboard.spec.ts` | should type repeatedly in input in shadow dom |
| `KB-049` | `page/page-keyboard.spec.ts` | type to non-focusable element should maintain old focus |
| `KB-050` | `page/page-keyboard.spec.ts` | should dispatch insertText after context menu was opened |
| `KB-051` | `page/page-keyboard.spec.ts` | should type after context menu was opened |
| `KB-052` | `page/page-keyboard.spec.ts` | should have correct Keydown/Keyup order when pressing Escape key |
| `KB-053` | `page/page-keyboard.spec.ts` | should close dialog on Escape key press in contenteditable |

### LC — Locale

| ID | File | Title |
|---|---|---|
| `LC-001` | `library/browsercontext-locale.spec.ts` | should affect accept-language header @smoke |
| `LC-002` | `library/browsercontext-locale.spec.ts` | should affect navigator.language |
| `LC-003` | `library/browsercontext-locale.spec.ts` | should format number |
| `LC-004` | `library/browsercontext-locale.spec.ts` | should format date |
| `LC-005` | `library/browsercontext-locale.spec.ts` | should format number in popups |
| `LC-006` | `library/browsercontext-locale.spec.ts` | should affect navigator.language in popups |
| `LC-007` | `library/browsercontext-locale.spec.ts` | should work for multiple pages sharing same process |
| `LC-008` | `library/browsercontext-locale.spec.ts` | should be isolated between contexts |
| `LC-009` | `library/browsercontext-locale.spec.ts` | should not change default locale in another context |
| `LC-010` | `library/browsercontext-locale.spec.ts` | should propagate locale to workers |
| `LC-011` | `library/browsercontext-locale.spec.ts` | should affect Intl.DateTimeFormat().resolvedOptions().locale |
| `LC-012` | `library/browsercontext-locale.spec.ts` | should send user Accept-Language header |
| `LC-013` | `library/browsercontext-locale.spec.ts` | should send Accept-Language header on WebSocket handshake |
| `LC-014` | `library/browsercontext-locale.spec.ts` | should send Accept-Language header on WebSocket handshake from a worker |

### LE — Leaks

| ID | File | Title |
|---|---|---|
| `LE-001` | `page/page-leaks.spec.ts` | click should not leak |
| `LE-002` | `page/page-leaks.spec.ts` | fill should not leak |
| `LE-003` | `page/page-leaks.spec.ts` | expect should not leak |
| `LE-004` | `page/page-leaks.spec.ts` | waitFor should not leak |
| `LE-005` | `library/heap.spec.ts` | test {#0, #1, #2} to request page and context *(3 copies)* |
| `LE-006` | `library/heap.spec.ts` | test to request page and context |
| `LE-007` | `library/heap.spec.ts` | should not leak fixtures w/ page |
| `LE-008` | `library/heap.spec.ts` | should not leak fixtures w/o page |
| `LE-009` | `library/heap.spec.ts` | should not leak server-side objects |
| `LE-010` | `library/heap.spec.ts` | should not leak dispatchers after closing page |
| `LE-011` | `library/heap.spec.ts` | should not leak workers |
| `LE-012` | `library/heap.spec.ts` | should collect stale handles |
| `LE-013` | `library/heap.spec.ts` | should collect frames |
| `LE-014` | `library/heap.spec.ts` | cycle handles |

### LG — Logger

| ID | File | Title |
|---|---|---|
| `LG-001` | `library/logger.spec.ts` | should log @smoke |
| `LG-002` | `library/logger.spec.ts` | should log context-level |

### LH — Locator handler

| ID | File | Title |
|---|---|---|
| `LH-001` | `page/page-add-locator-handler.spec.ts` | should work |
| `LH-002` | `page/page-add-locator-handler.spec.ts` | should work with a custom check |
| `LH-003` | `page/page-add-locator-handler.spec.ts` | should work with locator.hover() |
| `LH-004` | `page/page-add-locator-handler.spec.ts` | should not work with force:true |
| `LH-005` | `page/page-add-locator-handler.spec.ts` | should throw when handler times out |
| `LH-006` | `page/page-add-locator-handler.spec.ts` | should work with toBeVisible |
| `LH-007` | `page/page-add-locator-handler.spec.ts` | should work with locator.waitFor |
| `LH-008` | `page/page-add-locator-handler.spec.ts` | should work with toHaveScreenshot |
| `LH-009` | `page/page-add-locator-handler.spec.ts` | should work when owner frame detaches |
| `LH-010` | `page/page-add-locator-handler.spec.ts` | should work with times: option |
| `LH-011` | `page/page-add-locator-handler.spec.ts` | should wait for hidden by default |
| `LH-012` | `page/page-add-locator-handler.spec.ts` | should wait for hidden by default 2 |
| `LH-013` | `page/page-add-locator-handler.spec.ts` | should work with noWaitAfter |
| `LH-014` | `page/page-add-locator-handler.spec.ts` | should removeLocatorHandler |

### LO — Locator

| ID | File | Title |
|---|---|---|
| `LO-001` | `page/locator-any-frame.spec.ts` | should click a button inside an iframe |
| `LO-002` | `page/locator-any-frame.spec.ts` | should click a button in the main frame |
| `LO-003` | `page/locator-any-frame.spec.ts` | should fail click when elements match in multiple frames |
| `LO-004` | `page/locator-any-frame.spec.ts` | should fail click upon strict mode violation inside a single frame |
| `LO-005` | `page/locator-any-frame.spec.ts` | should time out on click when there are no matches |
| `LO-006` | `page/locator-any-frame.spec.ts` | should count elements in a single frame |
| `LO-007` | `page/locator-any-frame.spec.ts` | should fail count when elements match in multiple frames |
| `LO-008` | `page/locator-any-frame.spec.ts` | should support toHaveCount |
| `LO-009` | `page/locator-any-frame.spec.ts` | should wait for a frame to appear with toHaveCount |
| `LO-010` | `page/locator-any-frame.spec.ts` | should fail toHaveCount when elements match in multiple frames |
| `LO-011` | `page/locator-any-frame.spec.ts` | should support toHaveText |
| `LO-012` | `page/locator-any-frame.spec.ts` | should support toHaveText with an array |
| `LO-013` | `page/locator-any-frame.spec.ts` | should fail toHaveText when elements match in multiple frames |
| `LO-014` | `page/locator-any-frame.spec.ts` | should fail toHaveText with an array when elements match in multiple frames |
| `LO-015` | `page/locator-any-frame.spec.ts` | should fail toHaveText upon strict mode violation inside a single frame |
| `LO-016` | `page/locator-any-frame.spec.ts` | should support evaluate |
| `LO-017` | `page/locator-any-frame.spec.ts` | should fail evaluate when elements match in multiple frames |
| `LO-018` | `page/locator-any-frame.spec.ts` | should time out on evaluate when there are no matches |
| `LO-019` | `page/locator-any-frame.spec.ts` | should support evaluateAll |
| `LO-020` | `page/locator-any-frame.spec.ts` | should fail evaluateAll when elements match in multiple frames |
| `LO-021` | `page/locator-any-frame.spec.ts` | should support hasText filter |
| `LO-022` | `page/locator-any-frame.spec.ts` | should support first/last/nth |
| `LO-023` | `page/locator-any-frame.spec.ts` | should support nth in the middle of the chain |
| `LO-024` | `page/locator-any-frame.spec.ts` | should support composite locators |
| `LO-025` | `page/locator-any-frame.spec.ts` | should support capture |
| `LO-026` | `page/locator-any-frame.spec.ts` | should find a frame inside the scope |
| `LO-027` | `page/locator-any-frame.spec.ts` | should find a nested frame inside the scope |
| `LO-028` | `page/locator-any-frame.spec.ts` | should find a frame inside the scope while another iframe is stalled |
| `LO-029` | `page/locator-any-frame.spec.ts` | should respect the scope without a frame inside the scope |
| `LO-030` | `page/locator-any-frame.spec.ts` | should not match a chain across a frame boundary |
| `LO-031` | `page/locator-any-frame.spec.ts` | should only search frames inside the starting frame |
| `LO-032` | `page/locator-any-frame.spec.ts` | should enter a frame found in a nested frame |
| `LO-033` | `page/locator-any-frame.spec.ts` | should click inside an entered frame |
| `LO-034` | `page/locator-any-frame.spec.ts` | should not search nested frames after entering a frame |
| `LO-035` | `page/locator-any-frame.spec.ts` | should support two frameLocators |
| `LO-036` | `page/locator-any-frame.spec.ts` | should support locator before frameLocator |
| `LO-037` | `page/locator-any-frame.spec.ts` | should support owner of a frameLocator |
| `LO-038` | `page/locator-any-frame.spec.ts` | should wait for the frame to enter to appear |
| `LO-039` | `page/locator-any-frame.spec.ts` | should fail when the frame to enter matches in multiple frames |
| `LO-040` | `page/locator-any-frame.spec.ts` | should support contentFrame |
| `LO-041` | `page/locator-any-frame.spec.ts` | should render frameLocator() in the locator description |
| `LO-042` | `page/locator-any-frame.spec.ts` | should not allow frameLocator() inside a composite locator |
| `LO-043` | `page/locator-any-frame.spec.ts` | should support a composite locator under frameLocator() |
| `LO-044` | `page/locator-any-frame.spec.ts` | should support a composite locator under frameLocator() and a frame locator |
| `LO-045` | `page/locator-any-frame.spec.ts` | should not allow first/last/nth on frameLocator() |
| `LO-046` | `page/locator-any-frame.spec.ts` | should not allow owner on frameLocator() |
| `LO-047` | `page/locator-any-frame.spec.ts` | should resolve aria-ref selectors |
| `LO-048` | `page/locator-any-frame.spec.ts` | should click while another iframe is stalled |
| `LO-049` | `page/locator-any-frame.spec.ts` | should support toBeVisible while another iframe is stalled |
| `LO-050` | `page/locator-any-frame.spec.ts` | should support toHaveCount while another iframe is stalled |
| `LO-051` | `page/locator-any-frame.spec.ts` | should treat elements inside hidden iframe as hidden |
| `LO-052` | `page/locator-click.spec.ts` | should work @smoke |
| `LO-053` | `page/locator-click.spec.ts` | should work with Node removed |
| `LO-054` | `page/locator-click.spec.ts` | should double click the button |
| `LO-055` | `page/locator-click.spec.ts` | should click if the target element is removed in pointerup event |
| `LO-056` | `page/locator-click.spec.ts` | should click if the target element is removed in pointerdown event |
| `LO-057` | `page/locator-convenience.spec.ts` | should have a nice preview |
| `LO-058` | `page/locator-convenience.spec.ts` | getAttribute should work |
| `LO-059` | `page/locator-convenience.spec.ts` | inputValue should work |
| `LO-060` | `page/locator-convenience.spec.ts` | innerHTML should work |
| `LO-061` | `page/locator-convenience.spec.ts` | innerText should work |
| `LO-062` | `page/locator-convenience.spec.ts` | innerText should throw |
| `LO-063` | `page/locator-convenience.spec.ts` | innerText should produce log |
| `LO-064` | `page/locator-convenience.spec.ts` | textContent should work |
| `LO-065` | `page/locator-convenience.spec.ts` | isEnabled and isDisabled should work |
| `LO-066` | `page/locator-convenience.spec.ts` | isEditable should work |
| `LO-067` | `page/locator-convenience.spec.ts` | isChecked should work |
| `LO-068` | `page/locator-convenience.spec.ts` | isChecked should work for indeterminate input |
| `LO-069` | `page/locator-convenience.spec.ts` | allTextContents should work |
| `LO-070` | `page/locator-convenience.spec.ts` | allInnerTexts should work |
| `LO-071` | `page/locator-convenience.spec.ts` | should return page |
| `LO-072` | `page/locator-convenience.spec.ts` | description should return null for locator without description |
| `LO-073` | `page/locator-convenience.spec.ts` | description should return description for locator with simple description |
| `LO-074` | `page/locator-convenience.spec.ts` | description should return description with special characters |
| `LO-075` | `page/locator-convenience.spec.ts` | description should return description for chained locators |
| `LO-076` | `page/locator-convenience.spec.ts` | description should return description for locator with multiple describe calls |
| `LO-077` | `page/locator-convenience.spec.ts` | toString() returns formatted locator |
| `LO-078` | `page/locator-convenience.spec.ts` | toString() prefers description |
| `LO-079` | `page/locator-element-handle.spec.ts` | should query existing element @smoke |
| `LO-080` | `page/locator-element-handle.spec.ts` | should query existing elements |
| `LO-081` | `page/locator-element-handle.spec.ts` | should return empty array for non-existing elements |
| `LO-082` | `page/locator-element-handle.spec.ts` | xpath should query existing element |
| `LO-083` | `page/locator-element-handle.spec.ts` | xpath should return null for non-existing element |
| `LO-084` | `page/locator-evaluate.spec.ts` | should work @smoke |
| `LO-085` | `page/locator-evaluate.spec.ts` | should retrieve content from subtree |
| `LO-086` | `page/locator-evaluate.spec.ts` | should work for all |
| `LO-087` | `page/locator-evaluate.spec.ts` | should retrieve content from subtree for all |
| `LO-088` | `page/locator-evaluate.spec.ts` | should not throw in case of missing selector for all |
| `LO-089` | `page/locator-frame.spec.ts` | should work for iframe @smoke |
| `LO-090` | `page/locator-frame.spec.ts` | should work for nested iframe |
| `LO-091` | `page/locator-frame.spec.ts` | should work for $ and $$ |
| `LO-092` | `page/locator-frame.spec.ts` | should wait for frame |
| `LO-093` | `page/locator-frame.spec.ts` | should wait for frame 2 |
| `LO-094` | `page/locator-frame.spec.ts` | should wait for frame to go |
| `LO-095` | `page/locator-frame.spec.ts` | should not wait for frame |
| `LO-096` | `page/locator-frame.spec.ts` | should not wait for frame 2 |
| `LO-097` | `page/locator-frame.spec.ts` | should not wait for frame 3 |
| `LO-098` | `page/locator-frame.spec.ts` | should click in lazy iframe |
| `LO-099` | `page/locator-frame.spec.ts` | waitFor should survive frame reattach |
| `LO-100` | `page/locator-frame.spec.ts` | click should survive frame reattach |
| `LO-101` | `page/locator-frame.spec.ts` | click should survive iframe navigation |
| `LO-102` | `page/locator-frame.spec.ts` | should non work for non-frame |
| `LO-103` | `page/locator-frame.spec.ts` | locator.frameLocator should work for iframe |
| `LO-104` | `page/locator-frame.spec.ts` | locator.frameLocator should throw on ambiguity |
| `LO-105` | `page/locator-frame.spec.ts` | locator.frameLocator should not throw on first/last/nth |
| `LO-106` | `page/locator-frame.spec.ts` | getBy coverage |
| `LO-107` | `page/locator-frame.spec.ts` | wait for hidden should succeed when frame is not in dom |
| `LO-108` | `page/locator-frame.spec.ts` | should work with COEP/COOP/CORP isolated iframe |
| `LO-109` | `page/locator-frame.spec.ts` | locator.contentFrame should work |
| `LO-110` | `page/locator-frame.spec.ts` | frameLocator.owner should work |
| `LO-111` | `page/locator-frame.spec.ts` | should treat elements inside hidden iframe as hidden |
| `LO-112` | `page/locator-frame.spec.ts` | should wait for hidden iframe to become visible |
| `LO-113` | `page/locator-frame.spec.ts` | should treat elements inside hidden cross-origin iframe as hidden |
| `LO-114` | `page/locator-highlight.spec.ts` | should highlight locator |
| `LO-115` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work |
| `LO-116` | `page/locator-is-visible.spec.ts` | isVisible should be true for opacity:0 |
| `LO-117` | `page/locator-is-visible.spec.ts` | isVisible should be true for element outside view |
| `LO-118` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with details |
| `LO-119` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with nested details |
| `LO-120` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with unslotted content |
| `LO-121` | `page/locator-is-visible.spec.ts` | isVisible and isHidden should work with list box options |
| `LO-122` | `page/locator-is-visible.spec.ts` | isVisible inside a button |
| `LO-123` | `page/locator-is-visible.spec.ts` | isVisible inside a role=button |
| `LO-124` | `page/locator-is-visible.spec.ts` | isVisible during navigation should not throw |
| `LO-125` | `page/locator-is-visible.spec.ts` | isVisible with invalid selector should throw |
| `LO-126` | `page/locator-list.spec.ts` | locator.all should work |
| `LO-127` | `page/locator-misc-1.spec.ts` | should hover @smoke |
| `LO-128` | `page/locator-misc-1.spec.ts` | should hover when Node is removed |
| `LO-129` | `page/locator-misc-1.spec.ts` | should fill input |
| `LO-130` | `page/locator-misc-1.spec.ts` | should fill input when Node is removed |
| `LO-131` | `page/locator-misc-1.spec.ts` | should clear input |
| `LO-132` | `page/locator-misc-1.spec.ts` | should check the box |
| `LO-133` | `page/locator-misc-1.spec.ts` | should check the box using setChecked |
| `LO-134` | `page/locator-misc-1.spec.ts` | should uncheck the box |
| `LO-135` | `page/locator-misc-1.spec.ts` | should select single option |
| `LO-136` | `page/locator-misc-1.spec.ts` | should focus and blur a button |
| `LO-137` | `page/locator-misc-1.spec.ts` | focus should respect strictness |
| `LO-138` | `page/locator-misc-1.spec.ts` | should dispatch click event via ElementHandles |
| `LO-139` | `page/locator-misc-1.spec.ts` | should upload the file |
| `LO-140` | `page/locator-misc-2.spec.ts` | should press @smoke |
| `LO-141` | `page/locator-misc-2.spec.ts` | should scroll into view |
| `LO-142` | `page/locator-misc-2.spec.ts` | should scroll zero-sized element into view |
| `LO-143` | `page/locator-misc-2.spec.ts` | should select textarea |
| `LO-144` | `page/locator-misc-2.spec.ts` | should type |
| `LO-145` | `page/locator-misc-2.spec.ts` | should pressSequentially |
| `LO-146` | `page/locator-misc-2.spec.ts` | should take screenshot |
| `LO-147` | `page/locator-misc-2.spec.ts` | should return bounding box |
| `LO-148` | `page/locator-misc-2.spec.ts` | should waitFor |
| `LO-149` | `page/locator-misc-2.spec.ts` | should waitFor hidden |
| `LO-150` | `page/locator-misc-2.spec.ts` | should combine visible with other selectors |
| `LO-151` | `page/locator-misc-2.spec.ts` | should support filter(visible) |
| `LO-152` | `page/locator-misc-2.spec.ts` | should support visible() |
| `LO-153` | `page/locator-misc-2.spec.ts` | locator.count should work with deleted Map in main world |
| `LO-154` | `page/locator-misc-2.spec.ts` | Locator.locator() and FrameLocator.locator() should accept locator |
| `LO-155` | `page/locator-misc-2.spec.ts` | should fill programmatically enabled textarea |
| `LO-156` | `page/locator-misc-2.spec.ts` | press should throw on unknown keys |
| `LO-157` | `page/locator-query.spec.ts` | should respect first() and last() @smoke |
| `LO-158` | `page/locator-query.spec.ts` | should respect nth() |
| `LO-159` | `page/locator-query.spec.ts` | should throw on capture w/ nth() |
| `LO-160` | `page/locator-query.spec.ts` | should throw on due to strictness |
| `LO-161` | `page/locator-query.spec.ts` | should throw on due to strictness 2 |
| `LO-162` | `page/locator-query.spec.ts` | should filter by text |
| `LO-163` | `page/locator-query.spec.ts` | should filter by text 2 |
| `LO-164` | `page/locator-query.spec.ts` | should filter by regex |
| `LO-165` | `page/locator-query.spec.ts` | should filter by text with quotes |
| `LO-166` | `page/locator-query.spec.ts` | should filter by regex with quotes |
| `LO-167` | `page/locator-query.spec.ts` | should filter by regex with a single quote |
| `LO-168` | `page/locator-query.spec.ts` | should filter by regex and regexp flags |
| `LO-169` | `page/locator-query.spec.ts` | should filter by case-insensitive regex in a child |
| `LO-170` | `page/locator-query.spec.ts` | should filter by case-insensitive regex in multiple children |
| `LO-171` | `page/locator-query.spec.ts` | should filter by regex with special symbols |
| `LO-172` | `page/locator-query.spec.ts` | should support has:locator |
| `LO-173` | `page/locator-query.spec.ts` | should support locator.filter |
| `LO-174` | `page/locator-query.spec.ts` | should support locator.and |
| `LO-175` | `page/locator-query.spec.ts` | should support locator.or |
| `LO-176` | `page/locator-query.spec.ts` | should support locator.locator with and/or |
| `LO-177` | `page/locator-query.spec.ts` | should support locator.within |
| `LO-178` | `page/locator-query.spec.ts` | should allow some, but not all nested frameLocators |
| `LO-179` | `page/locator-query.spec.ts` | should keep the capture when removing a common frame prefix |
| `LO-180` | `page/locator-query.spec.ts` | should enforce same frame for has/leftOf/rightOf/above/below/near |
| `LO-181` | `page/locator-query.spec.ts` | alias methods coverage |
| `LO-182` | `page/locator-query.spec.ts` | count() should not throw during navigation |
| `LO-183` | `page/locator-wait-for-function.spec.ts` | should wait for an attribute to appear |
| `LO-184` | `page/locator-wait-for-function.spec.ts` | should return immediately when already truthy |
| `LO-185` | `page/locator-wait-for-function.spec.ts` | should accept ElementHandle arguments |
| `LO-186` | `page/locator-wait-for-function.spec.ts` | should accept string expression |
| `LO-187` | `page/locator-wait-for-function.spec.ts` | should resolve a promise returned by the predicate |
| `LO-188` | `page/locator-wait-for-function.spec.ts` | should wait for element to appear and survive rerender |
| `LO-189` | `page/locator-wait-for-function.spec.ts` | should throw when predicate throws |
| `LO-190` | `page/locator-wait-for-function.spec.ts` | should throw on strict mode violation |
| `LO-191` | `page/locator-wait-for-function.spec.ts` | should abort via signal |
| `LO-192` | `page/locator-wait-for-function.spec.ts` | should abort via already-aborted signal |
| `LO-193` | `library/locator-highlight.spec.ts` | highlight should accept a CSS string style |
| `LO-194` | `library/locator-highlight.spec.ts` | highlight should accept an object style (JS only) |
| `LO-195` | `library/locator-highlight.spec.ts` | hideHighlight removes a styled highlight |
| `LO-196` | `library/locator-highlight.spec.ts` | highlight should survive navigation |
| `LO-197` | `library/locator-highlight.spec.ts` | Page.hideHighlight clears all locator highlights |
| `LO-198` | `library/locator-highlight.spec.ts` | highlight should work with a custom selector engine that runs in the main world |
| `LO-199` | `library/locator-highlight.spec.ts` | highlight should resolve relative to the frame of the locator |

### MC — Multiple clients

| ID | File | Title |
|---|---|---|
| `MC-001` | `library/multiclient.spec.ts` | should connect two clients |
| `MC-002` | `library/multiclient.spec.ts` | should fire context event on remote newContext |
| `MC-003` | `library/multiclient.spec.ts` | should have separate default timeouts |
| `MC-004` | `library/multiclient.spec.ts` | should receive viewport size changes |
| `MC-005` | `library/multiclient.spec.ts` | should not allow parallel js coverage and cleanup upon disconnect |
| `MC-006` | `library/multiclient.spec.ts` | should not allow parallel css coverage |
| `MC-007` | `library/multiclient.spec.ts` | should unpause clock |
| `MC-008` | `library/multiclient.spec.ts` | last emulateMedia wins |
| `MC-009` | `library/multiclient.spec.ts` | should chain routes |
| `MC-010` | `library/multiclient.spec.ts` | should chain routes with changed url |
| `MC-011` | `library/multiclient.spec.ts` | should remove exposed bindings upon disconnect |
| `MC-012` | `library/multiclient.spec.ts` | should unroute websockets |
| `MC-013` | `library/multiclient.spec.ts` | should remove init scripts upon disconnect |
| `MC-014` | `library/multiclient.spec.ts` | should remove locator handlers upon disconnect |
| `MC-015` | `library/multiclient.spec.ts` | should launch persistent |
| `MC-016` | `library/multiclient.spec.ts` | should avoid side effects upon disconnect |
| `MC-017` | `library/multiclient.spec.ts` | screencast should deliver cached last frame to a new client |
| `MC-018` | `library/multiclient.spec.ts` | should stop tracing upon disconnect |
| `MC-019` | `library/multiclient.spec.ts` | should not deliver an action buffered before the second recording started |
| `MC-020` | `library/multiclient.spec.ts` | should run locator handlers after reconnecting with a pending callback |

### MO — Mouse

| ID | File | Title |
|---|---|---|
| `MO-001` | `page/page-mouse.spec.ts` | should click the document @smoke |
| `MO-002` | `page/page-mouse.spec.ts` | should dblclick the div |
| `MO-003` | `page/page-mouse.spec.ts` | down and up should generate click |
| `MO-004` | `page/page-mouse.spec.ts` | should pointerdown the div with a custom button |
| `MO-005` | `page/page-mouse.spec.ts` | should report correct buttons property |
| `MO-006` | `page/page-mouse.spec.ts` | should report correct pointerType property |
| `MO-007` | `page/page-mouse.spec.ts` | should select the text with mouse |
| `MO-008` | `page/page-mouse.spec.ts` | should trigger hover state |
| `MO-009` | `page/page-mouse.spec.ts` | should trigger hover state on disabled button |
| `MO-010` | `page/page-mouse.spec.ts` | should trigger hover state with removed window.Node |
| `MO-011` | `page/page-mouse.spec.ts` | should set modifier keys on click |
| `MO-012` | `page/page-mouse.spec.ts` | should tween mouse movement |
| `MO-013` | `page/page-mouse.spec.ts` | should always round down |
| `MO-014` | `page/page-mouse.spec.ts` | should not crash on mouse drag with any button |
| `MO-015` | `page/page-mouse.spec.ts` | should dispatch mouse move after context menu was opened |
| `MO-016` | `page/page-mouse.spec.ts` | should track hover across iframe boundaries |
| `MO-017` | `page/wheel.spec.ts` | should dispatch wheel events @smoke |
| `MO-018` | `page/wheel.spec.ts` | should dispatch wheel events after popup was opened @smoke |
| `MO-019` | `page/wheel.spec.ts` | should dispatch wheel event on svg element |
| `MO-020` | `page/wheel.spec.ts` | should scroll when nobody is listening |
| `MO-021` | `page/wheel.spec.ts` | should set the modifiers |
| `MO-022` | `page/wheel.spec.ts` | should scroll horizontally |
| `MO-023` | `page/wheel.spec.ts` | should work when the event is canceled |

### NA — Navigation

| ID | File | Title |
|---|---|---|
| `NA-001` | `page/page-goto.spec.ts` | should work @smoke |
| `NA-002` | `page/page-goto.spec.ts` | should work with file URL |
| `NA-003` | `page/page-goto.spec.ts` | should navigate from file URL to about:blank |
| `NA-004` | `page/page-goto.spec.ts` | should work with file URL with subframes |
| `NA-005` | `page/page-goto.spec.ts` | should use http for no protocol |
| `NA-006` | `page/page-goto.spec.ts` | should work cross-process |
| `NA-007` | `page/page-goto.spec.ts` | should work with cross-process that fails before committing |
| `NA-008` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy |
| `NA-009` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy and {history, Cross-Origin-Embedder-Policy and history} state *(2 copies)* |
| `NA-010` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy and interception |
| `NA-011` | `page/page-goto.spec.ts` | should work with Cross-Origin-Opener-Policy after redirect |
| `NA-012` | `page/page-goto.spec.ts` | should capture iframe navigation request |
| `NA-013` | `page/page-goto.spec.ts` | should capture cross-process iframe navigation request |
| `NA-014` | `page/page-goto.spec.ts` | should work with anchor navigation |
| `NA-015` | `page/page-goto.spec.ts` | should work with redirects |
| `NA-016` | `page/page-goto.spec.ts` | should navigate to about:blank |
| `NA-017` | `page/page-goto.spec.ts` | should return response when page changes its URL after load |
| `NA-018` | `page/page-goto.spec.ts` | should work with subframes return 204 |
| `NA-019` | `page/page-goto.spec.ts` | should work with subframes return 204 with domcontentloaded |
| `NA-020` | `page/page-goto.spec.ts` | should fail when server returns 204 |
| `NA-021` | `page/page-goto.spec.ts` | should navigate to empty page with domcontentloaded |
| `NA-022` | `page/page-goto.spec.ts` | should work when page calls history API in beforeunload |
| `NA-023` | `page/page-goto.spec.ts` | should fail when navigating to bad url |
| `NA-024` | `page/page-goto.spec.ts` | should fail when navigating to bad SSL |
| `NA-025` | `page/page-goto.spec.ts` | should fail when navigating to bad SSL after redirects |
| `NA-026` | `page/page-goto.spec.ts` | should not crash when navigating to bad SSL after a cross origin navigation |
| `NA-027` | `page/page-goto.spec.ts` | should not throw if networkidle0 is passed as an option |
| `NA-028` | `page/page-goto.spec.ts` | should throw if networkidle2 is passed as an option |
| `NA-029` | `page/page-goto.spec.ts` | should fail when main resources failed to load |
| `NA-030` | `page/page-goto.spec.ts` | should fail when exceeding maximum navigation timeout |
| `NA-031` | `page/page-goto.spec.ts` | should fail when exceeding default maximum navigation timeout |
| `NA-032` | `page/page-goto.spec.ts` | should fail when exceeding browser context navigation timeout |
| `NA-033` | `page/page-goto.spec.ts` | should fail when exceeding default maximum timeout |
| `NA-034` | `page/page-goto.spec.ts` | should fail when exceeding browser context timeout |
| `NA-035` | `page/page-goto.spec.ts` | should prioritize default navigation timeout over default timeout |
| `NA-036` | `page/page-goto.spec.ts` | should disable timeout when its set to 0 |
| `NA-037` | `page/page-goto.spec.ts` | should fail when replaced by another navigation |
| `NA-038` | `page/page-goto.spec.ts` | js redirect overrides url bar navigation  |
| `NA-039` | `page/page-goto.spec.ts` | should succeed on url bar navigation when there is pending navigation |
| `NA-040` | `page/page-goto.spec.ts` | should work when navigating to valid url |
| `NA-041` | `page/page-goto.spec.ts` | should work when navigating to data url |
| `NA-042` | `page/page-goto.spec.ts` | should work when navigating to 404 |
| `NA-043` | `page/page-goto.spec.ts` | should return last response in redirect chain |
| `NA-044` | `page/page-goto.spec.ts` | should not leak listeners during navigation |
| `NA-045` | `page/page-goto.spec.ts` | should not leak listeners during bad navigation |
| `NA-046` | `page/page-goto.spec.ts` | should not leak listeners during 20 waitForNavigation |
| `NA-047` | `page/page-goto.spec.ts` | should navigate to dataURL and not fire dataURL requests |
| `NA-048` | `page/page-goto.spec.ts` | should navigate to URL with hash and fire requests without hash |
| `NA-049` | `page/page-goto.spec.ts` | should work with self requesting page |
| `NA-050` | `page/page-goto.spec.ts` | should fail when navigating and show the url at the error message |
| `NA-051` | `page/page-goto.spec.ts` | should be able to navigate to a page controlled by service worker |
| `NA-052` | `page/page-goto.spec.ts` | should send referer |
| `NA-053` | `page/page-goto.spec.ts` | should send referer of cross-origin URL |
| `NA-054` | `page/page-goto.spec.ts` | should reject referer option when setExtraHTTPHeaders provides referer |
| `NA-055` | `page/page-goto.spec.ts` | should override referrer-policy |
| `NA-056` | `page/page-goto.spec.ts` | should fail when canceled by another navigation |
| `NA-057` | `page/page-goto.spec.ts` | should work with lazy loading iframes |
| `NA-058` | `page/page-goto.spec.ts` | should report raw buffer for main resource |
| `NA-059` | `page/page-goto.spec.ts` | should not throw unhandled rejections on invalid url |
| `NA-060` | `page/page-goto.spec.ts` | should not crash when RTCPeerConnection is used |
| `NA-061` | `page/page-goto.spec.ts` | should properly wait for load |
| `NA-062` | `page/page-goto.spec.ts` | should not resolve goto upon window.stop() |
| `NA-063` | `page/page-goto.spec.ts` | should return from goto if new navigation is started |
| `NA-064` | `page/page-goto.spec.ts` | should return when navigation is committed if commit is specified |
| `NA-065` | `page/page-goto.spec.ts` | should wait for load when iframe attaches and detaches |
| `NA-066` | `page/page-goto.spec.ts` | should return url with basic auth info |
| `NA-067` | `page/page-navigation.spec.ts` | should work with \_blank target |
| `NA-068` | `page/page-navigation.spec.ts` | should work with cross-process \_blank target |
| `NA-069` | `page/page-navigation.spec.ts` | should work with \_blank target in form |
| `NA-070` | `page/page-navigation.spec.ts` | should not throw TargetClosedException on cross-origin redirect after click |
| `NA-071` | `page/page-history.spec.ts` | page.goBack should work @smoke |
| `NA-072` | `page/page-history.spec.ts` | page.goBack should work with HistoryAPI |
| `NA-073` | `page/page-history.spec.ts` | page.goBack should work for file urls |
| `NA-074` | `page/page-history.spec.ts` | goBack/goForward should work with bfcache-able pages |
| `NA-075` | `page/page-history.spec.ts` | page.reload should work |
| `NA-076` | `page/page-history.spec.ts` | page.reload should work with data url |
| `NA-077` | `page/page-history.spec.ts` | page.reload during renderer-initiated navigation |
| `NA-078` | `page/page-history.spec.ts` | page.reload should not resolve with same-document navigation |
| `NA-079` | `page/page-history.spec.ts` | page.reload should work with same origin redirect |
| `NA-080` | `page/page-history.spec.ts` | page.reload should work with cross-origin redirect |
| `NA-081` | `page/page-history.spec.ts` | page.reload should work on a page with a hash |
| `NA-082` | `page/page-history.spec.ts` | page.reload should work on a page with a hash at the end |
| `NA-083` | `page/page-history.spec.ts` | page.goBack during renderer-initiated navigation |
| `NA-084` | `page/page-history.spec.ts` | page.goForward during renderer-initiated navigation |
| `NA-085` | `page/page-history.spec.ts` | regression test for issue 20791 |
| `NA-086` | `page/page-history.spec.ts` | should reload proper page |
| `NA-087` | `page/page-event-load.spec.ts` | should fire once |
| `NA-088` | `page/page-event-load.spec.ts` | should fire once with iframe navigation |
| `NA-089` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browser.newContext is passed to page.goto @smoke |
| `NA-090` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browser.newPage is passed to page.goto |
| `NA-091` | `library/browsercontext-base-url.spec.ts` | should construct a new URL when a baseURL in browserType.launchPersistentContext is passed to page.goto |
| `NA-092` | `library/browsercontext-base-url.spec.ts` | should construct the URLs correctly when a baseURL without a trailing slash in browser.newPage is passed to page.goto |
| `NA-093` | `library/browsercontext-base-url.spec.ts` | should construct the URLs correctly when a baseURL with a trailing slash in browser.newPage is passed to page.goto |
| `NA-094` | `library/browsercontext-base-url.spec.ts` | should not construct a new URL when valid URLs are passed |
| `NA-095` | `library/browsercontext-base-url.spec.ts` | should be able to match a URL relative to its given URL with urlMatcher |
| `NA-096` | `library/browsercontext-base-url.spec.ts` | should not construct a new URL with baseURL when a glob was used |

### NE — Network

| ID | File | Title |
|---|---|---|
| `NE-001` | `page/page-network-request.spec.ts` | should work for main frame navigation request |
| `NE-002` | `page/page-network-request.spec.ts` | should work for subframe navigation request |
| `NE-003` | `page/page-network-request.spec.ts` | should work for fetch requests @smoke |
| `NE-004` | `page/page-network-request.spec.ts` | should work for a redirect |
| `NE-005` | `page/page-network-request.spec.ts` | should not work for a redirect and interception |
| `NE-006` | `page/page-network-request.spec.ts` | should return headers |
| `NE-007` | `page/page-network-request.spec.ts` | should get the same headers as the server |
| `NE-008` | `page/page-network-request.spec.ts` | should not return allHeaders() until they are available |
| `NE-009` | `page/page-network-request.spec.ts` | should get the same headers as the server CORS |
| `NE-010` | `page/page-network-request.spec.ts` | should not get preflight CORS requests when intercepting |
| `NE-011` | `page/page-network-request.spec.ts` | should return postData |
| `NE-012` | `page/page-network-request.spec.ts` | should work with binary post data |
| `NE-013` | `page/page-network-request.spec.ts` | should work with binary post data and interception |
| `NE-014` | `page/page-network-request.spec.ts` | should override post data content type |
| `NE-015` | `page/page-network-request.spec.ts` | should get \|undefined\| with postData() when there is no post data |
| `NE-016` | `page/page-network-request.spec.ts` | should parse the json post data |
| `NE-017` | `page/page-network-request.spec.ts` | should parse the data if content-type is application/x-www-form-urlencoded |
| `NE-018` | `page/page-network-request.spec.ts` | should parse the data if content-type is application/x-www-form-urlencoded; charset=UTF-8 |
| `NE-019` | `page/page-network-request.spec.ts` | should get \|undefined\| with postDataJSON() when there is no post data |
| `NE-020` | `page/page-network-request.spec.ts` | should return multipart/form-data |
| `NE-021` | `page/page-network-request.spec.ts` | should return event source |
| `NE-022` | `page/page-network-request.spec.ts` | should return navigation bit |
| `NE-023` | `page/page-network-request.spec.ts` | should return navigation bit when navigating to image |
| `NE-024` | `page/page-network-request.spec.ts` | should report raw headers |
| `NE-025` | `page/page-network-request.spec.ts` | should report raw response headers in redirects |
| `NE-026` | `page/page-network-request.spec.ts` | should report all cookies in one header |
| `NE-027` | `page/page-network-request.spec.ts` | should not allow to access frame on popup main request |
| `NE-028` | `page/page-network-request.spec.ts` | page.reload return 304 status code |
| `NE-029` | `page/page-network-request.spec.ts` | should handle mixed-content blocked requests |
| `NE-030` | `page/page-network-response.spec.ts` | should work @smoke |
| `NE-031` | `page/page-network-response.spec.ts` | should return multiple header value |
| `NE-032` | `page/page-network-response.spec.ts` | should return text |
| `NE-033` | `page/page-network-response.spec.ts` | should return uncompressed text |
| `NE-034` | `page/page-network-response.spec.ts` | should return uncompressed text for brotli encoding |
| `NE-035` | `page/page-network-response.spec.ts` | should return text for identity encoding |
| `NE-036` | `page/page-network-response.spec.ts` | should throw when requesting body of redirected response |
| `NE-037` | `page/page-network-response.spec.ts` | should wait until response completes |
| `NE-038` | `page/page-network-response.spec.ts` | should return json |
| `NE-039` | `page/page-network-response.spec.ts` | should return body |
| `NE-040` | `page/page-network-response.spec.ts` | should return body with compression |
| `NE-041` | `page/page-network-response.spec.ts` | should return non-utf8 body even when content-type says utf8 |
| `NE-042` | `page/page-network-response.spec.ts` | should return status text |
| `NE-043` | `page/page-network-response.spec.ts` | should report all headers |
| `NE-044` | `page/page-network-response.spec.ts` | should report multiple set-cookie headers |
| `NE-045` | `page/page-network-response.spec.ts` | should behave the same way for headers and allHeaders |
| `NE-046` | `page/page-network-response.spec.ts` | should provide a Response with a file URL |
| `NE-047` | `page/page-network-response.spec.ts` | should return set-cookie header after route.fulfill |
| `NE-048` | `page/page-network-response.spec.ts` | should return headers after route.fulfill |
| `NE-049` | `page/page-network-response.spec.ts` | should report if request was fromServiceWorker |
| `NE-050` | `page/page-network-response.spec.ts` | should return body for prefetch script |
| `NE-051` | `page/page-network-response.spec.ts` | should return body for image with evicted body |
| `NE-052` | `page/page-network-response.spec.ts` | should bypass disk cache when page interception is enabled |
| `NE-053` | `page/page-network-response.spec.ts` | request.existingResponse should return null before response is received |
| `NE-054` | `page/page-network-response.spec.ts` | request.existingResponse should return the response after it is received |
| `NE-055` | `page/page-network-response.spec.ts` | should return http version |
| `NE-056` | `page/page-network-response.spec.ts` | Response.formData() should parse multipart/form-data in page context |
| `NE-057` | `page/page-network-response.spec.ts` | should give a readable error when response.body() races with navigation |
| `NE-058` | `page/page-network-sizes.spec.ts` | should set bodySize and headersSize |
| `NE-059` | `page/page-network-sizes.spec.ts` | should set bodySize to 0 if there was no body |
| `NE-060` | `page/page-network-sizes.spec.ts` | should set bodySize, headersSize, and transferSize |
| `NE-061` | `page/page-network-sizes.spec.ts` | should set bodySize to 0 when there was no response body |
| `NE-062` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize |
| `NE-063` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize for chunked request |
| `NE-064` | `page/page-network-sizes.spec.ts` | should have the correct responseBodySize with gzip compression |
| `NE-065` | `page/page-network-sizes.spec.ts` | should handle redirects |
| `NE-066` | `page/page-network-sizes.spec.ts` | should throw for failed requests |
| `NE-067` | `page/page-network-sizes.spec.ts` | should work with {200, 401, 404, 500} status code *(4 copies)* |
| `NE-068` | `page/page-network-sizes.spec.ts` | should have correct responseBodySize for 404 with content |
| `NE-069` | `page/page-network-sizes.spec.ts` | should return sizes without hanging |
| `NE-070` | `page/page-network-idle.spec.ts` | should navigate to empty page with networkidle |
| `NE-071` | `page/page-network-idle.spec.ts` | should wait for networkidle to succeed navigation |
| `NE-072` | `page/page-network-idle.spec.ts` | should wait for networkidle to succeed navigation with request from previous navigation |
| `NE-073` | `page/page-network-idle.spec.ts` | should wait for networkidle in waitForNavigation |
| `NE-074` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent |
| `NE-075` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent with request from previous navigation |
| `NE-076` | `page/page-network-idle.spec.ts` | should wait for networkidle when navigating iframe |
| `NE-077` | `page/page-network-idle.spec.ts` | should wait for networkidle in setContent from the child frame |
| `NE-078` | `page/page-network-idle.spec.ts` | should wait for networkidle from the child frame |
| `NE-079` | `page/page-network-idle.spec.ts` | should wait for networkidle from the popup |
| `NE-080` | `page/page-network-idle.spec.ts` | should wait for networkidle when iframe attaches and detaches |
| `NE-081` | `page/page-network-idle.spec.ts` | should work after repeated navigations in the same page |
| `NE-082` | `page/page-network-idle.spec.ts` | should not wait for an open EventSource connection |
| `NE-083` | `page/page-network-idle.spec.ts` | should not wait for an open EventSource connection in setContent |
| `NE-084` | `page/page-event-network.spec.ts` | Page.Events.Request @smoke |
| `NE-085` | `page/page-event-network.spec.ts` | Page.Events.Response @smoke |
| `NE-086` | `page/page-event-network.spec.ts` | Page.Events.RequestFailed @smoke |
| `NE-087` | `page/page-event-network.spec.ts` | Page.Events.RequestFinished @smoke |
| `NE-088` | `page/page-event-network.spec.ts` | should fire events in proper order |
| `NE-089` | `page/page-event-network.spec.ts` | should support redirects |
| `NE-090` | `page/page-event-network.spec.ts` | should resolve responses after a cross-process navigation |
| `NE-091` | `page/page-event-request.spec.ts` | should fire for navigation requests |
| `NE-092` | `page/page-event-request.spec.ts` | should fire for iframes |
| `NE-093` | `page/page-event-request.spec.ts` | should fire for fetches |
| `NE-094` | `page/page-event-request.spec.ts` | should fire for fetches with keepalive: true |
| `NE-095` | `page/page-event-request.spec.ts` | should report requests and responses handled by service worker |
| `NE-096` | `page/page-event-request.spec.ts` | should report requests and responses handled by service worker with routing |
| `NE-097` | `page/page-event-request.spec.ts` | should report navigation requests and responses handled by service worker |
| `NE-098` | `page/page-event-request.spec.ts` | should report navigation requests and responses handled by service worker with routing |
| `NE-099` | `page/page-event-request.spec.ts` | should return response body when Cross-Origin-Opener-Policy is set |
| `NE-100` | `page/page-event-request.spec.ts` | should fire requestfailed when intercepting race |
| `NE-101` | `page/page-event-request.spec.ts` | main resource xhr should have type xhr |
| `NE-102` | `page/page-event-request.spec.ts` | should finish 204 request |
| `NE-103` | `page/page-event-request.spec.ts` | should fail 204 navigation request |
| `NE-104` | `page/page-event-request.spec.ts` | \<picture\> resource should have type image |
| `NE-105` | `page/page-event-request.spec.ts` | should not expose preflight OPTIONS request |
| `NE-106` | `page/page-event-request.spec.ts` | should not expose preflight OPTIONS request with network interception |
| `NE-107` | `page/page-event-request.spec.ts` | should return last requests |
| `NE-108` | `page/network-post-data.spec.ts` | should return correct postData buffer for utf-8 body |
| `NE-109` | `page/network-post-data.spec.ts` | should return post data w/o content-type @smoke |
| `NE-110` | `page/network-post-data.spec.ts` | should throw on invalid JSON in post data |
| `NE-111` | `page/network-post-data.spec.ts` | should return post data for PUT requests |
| `NE-112` | `page/network-post-data.spec.ts` | should get post data for file/blob |
| `NE-113` | `page/network-post-data.spec.ts` | should get post data for navigator.sendBeacon api calls |
| `NE-114` | `page/page-set-extra-http-headers.spec.ts` | should work @smoke |
| `NE-115` | `page/page-set-extra-http-headers.spec.ts` | should work with redirects |
| `NE-116` | `page/page-set-extra-http-headers.spec.ts` | should work with extra headers from browser context |
| `NE-117` | `page/page-set-extra-http-headers.spec.ts` | should throw for non-string header values |
| `NE-118` | `page/page-set-extra-http-headers.spec.ts` | should not duplicate referer header |
| `NE-119` | `library/browsercontext-set-extra-http-headers.spec.ts` | should override extra headers from browser context |
| `NE-120` | `library/browsercontext-set-extra-http-headers.spec.ts` | should throw for non-string header values |
| `NE-121` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.Request |
| `NE-122` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.Response |
| `NE-123` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.RequestFailed |
| `NE-124` | `library/browsercontext-network-event.spec.ts` | BrowserContext.Events.RequestFinished |
| `NE-125` | `library/browsercontext-network-event.spec.ts` | should fire events in proper order |
| `NE-126` | `library/browsercontext-network-event.spec.ts` | should not fire events for favicon or favicon redirects |
| `NE-127` | `library/browsercontext-network-event.spec.ts` | should reject response.finished if context closes |
| `NE-128` | `library/network-timeout.spec.ts` | httpRequest should honor socketTimeout while connecting |
| `NE-129` | `library/network-timeout.spec.ts` | httpRequest should honor socketTimeout for stalled responses |
| `NE-130` | `library/network-timeout.spec.ts` | httpRequest should honor ipv4first result order |
| `NE-131` | `library/resource-timing.spec.ts` | should work @smoke |
| `NE-132` | `library/resource-timing.spec.ts` | should work for subresource |
| `NE-133` | `library/resource-timing.spec.ts` | should work for SSL |
| `NE-134` | `library/resource-timing.spec.ts` | should work for redirect |
| `NE-135` | `library/resource-timing.spec.ts` | should work when serving from memory cache |
| `NE-136` | `library/ignorehttpserrors.spec.ts` | should work @smoke |
| `NE-137` | `library/ignorehttpserrors.spec.ts` | should isolate contexts |
| `NE-138` | `library/ignorehttpserrors.spec.ts` | should isolated contexts that share network process |
| `NE-139` | `library/ignorehttpserrors.spec.ts` | should work with mixed content |
| `NE-140` | `library/ignorehttpserrors.spec.ts` | should work with WebSocket |
| `NE-141` | `library/ignorehttpserrors.spec.ts` | should fail with WebSocket if not ignored |
| `NE-142` | `library/ignorehttpserrors.spec.ts` | serviceWorker should intercept document request |
| `NE-143` | `page/page-event-network.spec.ts` | should resolve responses after a same-process navigation |

### OO — OOPIF

| ID | File | Title |
|---|---|---|
| `OO-001` | `library/chromium/oopif.spec.ts` | should report oopif frames |
| `OO-002` | `library/chromium/oopif.spec.ts` | should handle oopif detach |
| `OO-003` | `library/chromium/oopif.spec.ts` | should remove workers of a detached oopif |
| `OO-004` | `library/chromium/oopif.spec.ts` | should not hang in unrouteAll when oopif worker is gone |
| `OO-005` | `library/chromium/oopif.spec.ts` | should handle remote -\> local -\> remote transitions |
| `OO-006` | `library/chromium/oopif.spec.ts` | should get the proper viewport |
| `OO-007` | `library/chromium/oopif.spec.ts` | should expose function |
| `OO-008` | `library/chromium/oopif.spec.ts` | should emulate media |
| `OO-009` | `library/chromium/oopif.spec.ts` | should emulate offline |
| `OO-010` | `library/chromium/oopif.spec.ts` | should support context options |
| `OO-011` | `library/chromium/oopif.spec.ts` | should respect route |
| `OO-012` | `library/chromium/oopif.spec.ts` | should take screenshot |
| `OO-013` | `library/chromium/oopif.spec.ts` | should load oopif iframes with subresources and route |
| `OO-014` | `library/chromium/oopif.spec.ts` | should report main requests |
| `OO-015` | `library/chromium/oopif.spec.ts` | should support exposeFunction |
| `OO-016` | `library/chromium/oopif.spec.ts` | should support addInitScript |
| `OO-017` | `library/chromium/oopif.spec.ts` | should click a button when it overlays oopif |
| `OO-018` | `library/chromium/oopif.spec.ts` | should report google.com frame with headed |
| `OO-019` | `library/chromium/oopif.spec.ts` | ElementHandle.boundingBox() should work |
| `OO-020` | `library/chromium/oopif.spec.ts` | should click |
| `OO-021` | `library/chromium/oopif.spec.ts` | contentFrame should work |
| `OO-022` | `library/chromium/oopif.spec.ts` | should allow cdp sessions on oopifs |
| `OO-023` | `library/chromium/oopif.spec.ts` | should emit filechooser event for iframe |
| `OO-024` | `library/chromium/oopif.spec.ts` | should be able to click in iframe |
| `OO-025` | `library/chromium/oopif.spec.ts` | should not throw on exposeFunction when oopif detaches |
| `OO-026` | `library/chromium/oopif.spec.ts` | should intercept response body from oopif |
| `OO-027` | `library/chromium/oopif.spec.ts` | should navigate a local frame to oopif with frame.goto |
| `OO-028` | `library/chromium/oopif.spec.ts` | should allow to re-connect to OOPIFs with CDP when iframes were there already |
| `OO-029` | `library/chromium/oopif.spec.ts` | should report the whole frame tree when connecting over CDP to nested OOPIFs |

### PA — Page

| ID | File | Title |
|---|---|---|
| `PA-001` | `page/page-basic.spec.ts` | should fire load when expected |
| `PA-002` | `page/page-basic.spec.ts` | async stacks should work |
| `PA-003` | `page/page-basic.spec.ts` | should provide access to the opener page |
| `PA-004` | `page/page-basic.spec.ts` | should fire domcontentloaded when expected |
| `PA-005` | `page/page-basic.spec.ts` | should pass self as argument to domcontentloaded event |
| `PA-006` | `page/page-basic.spec.ts` | should pass self as argument to load event |
| `PA-007` | `page/page-basic.spec.ts` | page.url should work |
| `PA-008` | `page/page-basic.spec.ts` | page.url should include hashes |
| `PA-009` | `page/page-basic.spec.ts` | page.title should return the page title |
| `PA-010` | `page/page-basic.spec.ts` | page.title should not throw during navigation |
| `PA-011` | `page/page-basic.spec.ts` | page.close should work with window.close |
| `PA-012` | `page/page-basic.spec.ts` | page.frame should respect name |
| `PA-013` | `page/page-basic.spec.ts` | page.frame should respect url |
| `PA-014` | `page/page-basic.spec.ts` | should have sane user agent |
| `PA-015` | `page/page-basic.spec.ts` | page.press should work |
| `PA-016` | `page/page-basic.spec.ts` | page.press should work for Enter |
| `PA-017` | `page/page-basic.spec.ts` | frame.press should work |
| `PA-018` | `page/page-basic.spec.ts` | has navigator.webdriver set to true |
| `PA-019` | `page/page-basic.spec.ts` | should iterate over page properties |
| `PA-020` | `page/page-set-content.spec.ts` | should work @smoke |
| `PA-021` | `page/page-set-content.spec.ts` | should work with domcontentloaded |
| `PA-022` | `page/page-set-content.spec.ts` | should work with commit |
| `PA-023` | `page/page-set-content.spec.ts` | should work with doctype |
| `PA-024` | `page/page-set-content.spec.ts` | should work with HTML 4 doctype |
| `PA-025` | `page/page-set-content.spec.ts` | should include shadow roots |
| `PA-026` | `page/page-set-content.spec.ts` | should respect timeout |
| `PA-027` | `page/page-set-content.spec.ts` | should respect default navigation timeout |
| `PA-028` | `page/page-set-content.spec.ts` | should await resources to load |
| `PA-029` | `page/page-set-content.spec.ts` | should work fast enough |
| `PA-030` | `page/page-set-content.spec.ts` | should work with tricky content |
| `PA-031` | `page/page-set-content.spec.ts` | should work with accents |
| `PA-032` | `page/page-set-content.spec.ts` | should work with emojis |
| `PA-033` | `page/page-set-content.spec.ts` | should work with newline |
| `PA-034` | `page/page-set-content.spec.ts` | content() should throw nice error during navigation |
| `PA-035` | `page/page-set-content.spec.ts` | should return empty content there is no iframe src |
| `PA-036` | `page/page-set-content.spec.ts` | should handle timeout properly |
| `PA-037` | `page/page-set-content.spec.ts` | should handle timeout properly 2 |
| `PA-038` | `page/page-transition.spec.ts` | should not crash when filter transition completes |
| `PA-039` | `library/page-close.spec.ts` | should close page with active dialog |
| `PA-040` | `library/page-close.spec.ts` | expect should not print timed out error message when page closes |
| `PA-041` | `library/page-close.spec.ts` | addLocatorHandler should throw when page closes |
| `PA-042` | `library/page-close.spec.ts` | should reject all promises when page is closed |
| `PA-043` | `library/page-close.spec.ts` | should set the page close state |
| `PA-044` | `library/page-close.spec.ts` | should pass page to close event |
| `PA-045` | `library/page-close.spec.ts` | should terminate network waiters |
| `PA-046` | `library/page-close.spec.ts` | should be callable twice |
| `PA-047` | `library/page-close.spec.ts` | should return null if parent page has been closed |
| `PA-048` | `library/page-close.spec.ts` | should fail with error upon disconnect |
| `PA-049` | `library/page-close.spec.ts` | page.close should work with window.close |
| `PA-050` | `library/page-close.spec.ts` | should not throw UnhandledPromiseRejection when page closes |
| `PA-051` | `library/page-close.spec.ts` | interrupt request.response() and request.allHeaders() on page.close |
| `PA-052` | `library/page-close.spec.ts` | should not treat navigations as new popups |
| `PA-053` | `library/page-close.spec.ts` | should not result in unhandled rejection |
| `PA-054` | `library/page-close.spec.ts` | should reject response.finished if page closes |
| `PA-055` | `library/page-close.spec.ts` | should not throw when continuing while page is closing |
| `PA-056` | `library/page-close.spec.ts` | should not throw when continuing after page is closed |

### PC — Playwright client

| ID | File | Title |
|---|---|---|
| `PC-001` | `library/playwright-client.spec.ts` | should connect from a page and drive the same browser |

### PD — PDF

| ID | File | Title |
|---|---|---|
| `PD-001` | `library/pdf.spec.ts` | should be able to save file |
| `PD-002` | `library/pdf.spec.ts` | should be able to generate outline |

### PE — Permissions

| ID | File | Title |
|---|---|---|
| `PE-001` | `library/permissions.spec.ts` | permissions › should be prompt by default |
| `PE-002` | `library/permissions.spec.ts` | permissions › should deny permission when not listed |
| `PE-003` | `library/permissions.spec.ts` | permissions › should fail when bad permission is given |
| `PE-004` | `library/permissions.spec.ts` | permissions › should grant geolocation permission when origin is listed |
| `PE-005` | `library/permissions.spec.ts` | permissions › should prompt for geolocation permission when origin is not listed |
| `PE-006` | `library/permissions.spec.ts` | permissions › should grant notifications permission when listed |
| `PE-007` | `library/permissions.spec.ts` | permissions › should accumulate when adding |
| `PE-008` | `library/permissions.spec.ts` | permissions › should clear permissions |
| `PE-009` | `library/permissions.spec.ts` | permissions › should grant permission when listed for all domains |
| `PE-010` | `library/permissions.spec.ts` | permissions › should grant permission when creating context |
| `PE-011` | `library/permissions.spec.ts` | permissions › should reset permissions |
| `PE-012` | `library/permissions.spec.ts` | permissions › should trigger permission onchange |
| `PE-013` | `library/permissions.spec.ts` | permissions › should isolate permissions between browser contexts |
| `PE-014` | `library/permissions.spec.ts` | should support clipboard read |
| `PE-015` | `library/permissions.spec.ts` | should isolate the headless clipboard from the operating system |
| `PE-016` | `library/permissions.spec.ts` | storage access |
| `PE-017` | `library/permissions.spec.ts` | should be able to use the local-fonts API |
| `PE-018` | `library/permissions.spec.ts` | local network request is allowed from public origin |
| `PE-019` | `library/permissions.spec.ts` | can request screen-wake-lock |
| `PE-020` | `library/permissions.spec.ts` | camera and microphone › should capture when camera and microphone are granted |
| `PE-021` | `library/permissions.spec.ts` | camera and microphone › should reject when no permission is granted |
| `PE-022` | `library/permissions.spec.ts` | camera and microphone › should gate audio and video independently |
| `PE-023` | `library/permissions.spec.ts` | camera and microphone › should stop capturing after permissions are cleared |

### PO — Popup

| ID | File | Title |
|---|---|---|
| `PO-001` | `page/page-event-popup.spec.ts` | should work @smoke |
| `PO-002` | `page/page-event-popup.spec.ts` | should work with window features |
| `PO-003` | `page/page-event-popup.spec.ts` | should emit for immediately closed popups |
| `PO-004` | `page/page-event-popup.spec.ts` | should emit for immediately closed popups 2 |
| `PO-005` | `page/page-event-popup.spec.ts` | should be able to capture alert |
| `PO-006` | `page/page-event-popup.spec.ts` | should work with empty url |
| `PO-007` | `page/page-event-popup.spec.ts` | should work with noopener and no url |
| `PO-008` | `page/page-event-popup.spec.ts` | should work with noopener and about:blank |
| `PO-009` | `page/page-event-popup.spec.ts` | should work with noopener and url |
| `PO-010` | `page/page-event-popup.spec.ts` | should work with clicking target=\_blank |
| `PO-011` | `page/page-event-popup.spec.ts` | should work with fake-clicking target=\_blank and rel=noopener |
| `PO-012` | `page/page-event-popup.spec.ts` | should work with clicking target=\_blank and rel=noopener |
| `PO-013` | `page/page-event-popup.spec.ts` | should report popup opened from iframes |
| `PO-014` | `library/popup.spec.ts` | should inherit user agent from browser context @smoke |
| `PO-015` | `library/popup.spec.ts` | should respect routes from browser context |
| `PO-016` | `library/popup.spec.ts` | should inherit extra headers from browser context |
| `PO-017` | `library/popup.spec.ts` | should inherit offline from browser context |
| `PO-018` | `library/popup.spec.ts` | should inherit http credentials from browser context |
| `PO-019` | `library/popup.spec.ts` | should inherit touch support from browser context |
| `PO-020` | `library/popup.spec.ts` | should inherit viewport size from browser context |
| `PO-021` | `library/popup.spec.ts` | should use viewport size from window features |
| `PO-022` | `library/popup.spec.ts` | should respect routes from browser context when using window.open |
| `PO-023` | `library/popup.spec.ts` | BrowserContext.addInitScript should apply to an in-process popup |
| `PO-024` | `library/popup.spec.ts` | BrowserContext.addInitScript should apply to a cross-process popup |
| `PO-025` | `library/popup.spec.ts` | should expose function from browser context |
| `PO-026` | `library/popup.spec.ts` | should not dispatch binding on a closed page |
| `PO-027` | `library/popup.spec.ts` | should not throttle rAF in the opener page |
| `PO-028` | `library/popup.spec.ts` | should not throw when click closes popup |
| `PO-029` | `library/popup.spec.ts` | should load subresources of an about:blank popup when the opener has routes |

### PR — Proxy

| ID | File | Title |
|---|---|---|
| `PR-001` | `library/proxy.spec.ts` | should throw for bad server value |
| `PR-002` | `library/proxy.spec.ts` | should use proxy @smoke |
| `PR-003` | `library/proxy.spec.ts` | should use proxy for second page |
| `PR-004` | `library/proxy.spec.ts` | should work with IP:PORT notion |
| `PR-005` | `library/proxy.spec.ts` | should proxy local network requests › {by default, with other bypasses} › {localhost, loopback address, link-local} *(6 copies)* |
| `PR-006` | `library/proxy.spec.ts` | should allow bypassing {localhost, 127.0.0.1} requests *(2 copies)* |
| `PR-007` | `library/proxy.spec.ts` | should authenticate |
| `PR-008` | `library/proxy.spec.ts` | should reconnect with credentials after CONNECT 407 closes the socket |
| `PR-009` | `library/proxy.spec.ts` | should work with authenticate followed by redirect |
| `PR-010` | `library/proxy.spec.ts` | should exclude patterns |
| `PR-011` | `library/proxy.spec.ts` | should bypass proxy for {localhost when localhost, 127.0.0.1 when 127.0.0.1} is in bypass list *(2 copies)* |
| `PR-012` | `library/proxy.spec.ts` | should use socks proxy |
| `PR-013` | `library/proxy.spec.ts` | should use socks proxy in second page |
| `PR-014` | `library/proxy.spec.ts` | does launch without a port |
| `PR-015` | `library/proxy.spec.ts` | should use proxy with emulated user agent |
| `PR-016` | `library/proxy.spec.ts` | should use SOCKS proxy for websocket requests |
| `PR-017` | `library/proxy.spec.ts` | should use http proxy for websocket requests |
| `PR-018` | `library/browsercontext-proxy.spec.ts` | should work when passing the proxy only on the context level |
| `PR-019` | `library/browsercontext-proxy.spec.ts` | should ignore legacy {'per-context', 'http://per-context'} launch proxy *(2 copies)* |
| `PR-020` | `library/browsercontext-proxy.spec.ts` | should throw for bad server value |
| `PR-021` | `library/browsercontext-proxy.spec.ts` | should use proxy |
| `PR-022` | `library/browsercontext-proxy.spec.ts` | should send secure cookies to subdomain.localhost |
| `PR-023` | `library/browsercontext-proxy.spec.ts` | should set cookie for top-level domain |
| `PR-024` | `library/browsercontext-proxy.spec.ts` | should proxy local network requests › {by default, with other bypasses} › {localhost, loopback address, link-local} *(6 copies)* |
| `PR-025` | `library/browsercontext-proxy.spec.ts` | should use ipv6 proxy |
| `PR-026` | `library/browsercontext-proxy.spec.ts` | should use proxy twice |
| `PR-027` | `library/browsercontext-proxy.spec.ts` | should use proxy for second page |
| `PR-028` | `library/browsercontext-proxy.spec.ts` | should use proxy for https urls |
| `PR-029` | `library/browsercontext-proxy.spec.ts` | should work with IP:PORT notion |
| `PR-030` | `library/browsercontext-proxy.spec.ts` | should throw for socks5 authentication |
| `PR-031` | `library/browsercontext-proxy.spec.ts` | should throw for socks4 authentication |
| `PR-032` | `library/browsercontext-proxy.spec.ts` | should authenticate |
| `PR-033` | `library/browsercontext-proxy.spec.ts` | should authenticate with empty password |
| `PR-034` | `library/browsercontext-proxy.spec.ts` | should isolate proxy credentials between contexts |
| `PR-035` | `library/browsercontext-proxy.spec.ts` | should exclude patterns |
| `PR-036` | `library/browsercontext-proxy.spec.ts` | should use socks proxy |
| `PR-037` | `library/browsercontext-proxy.spec.ts` | should use socks proxy in second page |
| `PR-038` | `library/browsercontext-proxy.spec.ts` | does launch without a port |
| `PR-039` | `library/browsercontext-proxy.spec.ts` | should isolate proxy credentials between contexts on navigation |
| `PR-040` | `library/proxy-pattern.spec.ts` | socks proxy patter matcher |
| `PR-041` | `library/fetch-proxy.spec.ts` | context request should pick up proxy credentials |
| `PR-042` | `library/fetch-proxy.spec.ts` | global request should pick up proxy credentials |
| `PR-043` | `library/fetch-proxy.spec.ts` | should work with context level proxy |
| `PR-044` | `library/fetch-proxy.spec.ts` | should support proxy.bypass |
| `PR-045` | `library/fetch-proxy.spec.ts` | should use socks proxy |
| `PR-046` | `library/fetch-proxy.spec.ts` | should send correct ALPN protocol to HTTPS proxy |
| `PR-047` | `library/fetch-proxy.spec.ts` | should apply proxy.bypass to redirect targets |

### PS — Parser

| ID | File | Title |
|---|---|---|
| `PS-001` | `library/locator-parser.spec.ts` | should parse getByText, getByLabel, getByPlaceholder, getByAltText and getByTitle |
| `PS-002` | `library/locator-parser.spec.ts` | should parse getByTestId |
| `PS-003` | `library/locator-parser.spec.ts` | should parse getByTestId with a custom test id attribute |
| `PS-004` | `library/locator-parser.spec.ts` | should parse getByRef |
| `PS-005` | `library/locator-parser.spec.ts` | should parse getByRole with every role |
| `PS-006` | `library/locator-parser.spec.ts` | should parse getByRole options |
| `PS-007` | `library/locator-parser.spec.ts` | should parse getByRole name and description |
| `PS-008` | `library/locator-parser.spec.ts` | should parse getByRole options in any order |
| `PS-009` | `library/locator-parser.spec.ts` | should parse locator with a selector |
| `PS-010` | `library/locator-parser.spec.ts` | should parse locator and filter options |
| `PS-011` | `library/locator-parser.spec.ts` | should parse first, last, nth and visible |
| `PS-012` | `library/locator-parser.spec.ts` | should parse and, or, locator and within with a locator argument |
| `PS-013` | `library/locator-parser.spec.ts` | should parse chained refinements |
| `PS-014` | `library/locator-parser.spec.ts` | should parse frame locators |
| `PS-015` | `library/locator-parser.spec.ts` | should parse FrameLocator.locator with a locator argument |
| `PS-016` | `library/locator-parser.spec.ts` | should parse owner |
| `PS-017` | `library/locator-parser.spec.ts` | should parse describe |
| `PS-018` | `library/locator-parser.spec.ts` | should parse deeply nested locators |
| `PS-019` | `library/locator-parser.spec.ts` | should parse generated locators |
| `PS-020` | `library/locator-parser.spec.ts` | should parse javascript string escapes |
| `PS-021` | `library/locator-parser.spec.ts` | should parse python string escapes |
| `PS-022` | `library/locator-parser.spec.ts` | should parse java string escapes |
| `PS-023` | `library/locator-parser.spec.ts` | should parse csharp string escapes |
| `PS-024` | `library/locator-parser.spec.ts` | should parse javascript regular expressions |
| `PS-025` | `library/locator-parser.spec.ts` | should parse python regular expressions |
| `PS-026` | `library/locator-parser.spec.ts` | should parse java regular expressions |
| `PS-027` | `library/locator-parser.spec.ts` | should parse csharp regular expressions |
| `PS-028` | `library/locator-parser.spec.ts` | should parse csharp options with an explicit type |
| `PS-029` | `library/locator-parser.spec.ts` | should parse trailing commas |
| `PS-030` | `library/locator-parser.spec.ts` | should parse unusual whitespace |
| `PS-031` | `library/locator-parser.spec.ts` | should return selectors as is |
| `PS-032` | `library/locator-parser.spec.ts` | should reject malformed javascript locators |
| `PS-033` | `library/locator-parser.spec.ts` | should reject malformed python locators |
| `PS-034` | `library/locator-parser.spec.ts` | should reject malformed java locators |
| `PS-035` | `library/locator-parser.spec.ts` | should reject malformed csharp locators |
| `PS-036` | `library/locator-parser.spec.ts` | should reject methods that the receiver does not have |
| `PS-037` | `library/locator-parser.spec.ts` | should reject arguments of a wrong type or count |
| `PS-038` | `library/component-parser.spec.ts` | should parse |
| `PS-039` | `library/component-parser.spec.ts` | should parse short attributes |
| `PS-040` | `library/component-parser.spec.ts` | should parse all operators |
| `PS-041` | `library/component-parser.spec.ts` | should tolerate spacing |
| `PS-042` | `library/component-parser.spec.ts` | should escape |
| `PS-043` | `library/component-parser.spec.ts` | should parse int values |
| `PS-044` | `library/component-parser.spec.ts` | should parse float values |
| `PS-045` | `library/component-parser.spec.ts` | should parse bool |
| `PS-046` | `library/component-parser.spec.ts` | should parse regex |
| `PS-047` | `library/component-parser.spec.ts` | should parse identifiers |
| `PS-048` | `library/component-parser.spec.ts` | should parse unquoted string |
| `PS-049` | `library/component-parser.spec.ts` | should throw on malformed selector |
| `PS-050` | `library/css-parser.spec.ts` | should parse css |
| `PS-051` | `library/css-parser.spec.ts` | should throw on malformed css |

### QS — Query selector

| ID | File | Title |
|---|---|---|
| `QS-001` | `page/queryselector.spec.ts` | should throw for non-string selector |
| `QS-002` | `page/queryselector.spec.ts` | should query existing element with css selector @smoke |
| `QS-003` | `page/queryselector.spec.ts` | should query existing element with text selector |
| `QS-004` | `page/queryselector.spec.ts` | should query existing element with xpath selector |
| `QS-005` | `page/queryselector.spec.ts` | should return null for non-existing element |
| `QS-006` | `page/queryselector.spec.ts` | should auto-detect xpath selector |
| `QS-007` | `page/queryselector.spec.ts` | should auto-detect xpath selector with starting parenthesis |
| `QS-008` | `page/queryselector.spec.ts` | should auto-detect xpath selector starting with .. |
| `QS-009` | `page/queryselector.spec.ts` | should auto-detect text selector |
| `QS-010` | `page/queryselector.spec.ts` | should auto-detect css selector |
| `QS-011` | `page/queryselector.spec.ts` | should support \>\> syntax |
| `QS-012` | `page/queryselector.spec.ts` | should query existing elements |
| `QS-013` | `page/queryselector.spec.ts` | should return empty array if nothing is found |
| `QS-014` | `page/queryselector.spec.ts` | xpath should query existing element |
| `QS-015` | `page/queryselector.spec.ts` | xpath should return empty array for non-existing element |
| `QS-016` | `page/queryselector.spec.ts` | xpath should return multiple elements |
| `QS-017` | `page/queryselector.spec.ts` | $$ should work with bogus Array.from |

### RE — Retarget

| ID | File | Title |
|---|---|---|
| `RE-001` | `page/retarget.spec.ts` | element state checks should work as expected for label with zero-sized input |
| `RE-002` | `page/retarget.spec.ts` | should wait for enclosing disabled button |
| `RE-003` | `page/retarget.spec.ts` | should wait for enclosing button with a disabled fieldset |
| `RE-004` | `page/retarget.spec.ts` | should wait for enclosing enabled button |
| `RE-005` | `page/retarget.spec.ts` | should check the box outside shadow dom label |
| `RE-006` | `page/retarget.spec.ts` | setInputFiles should work with label |
| `RE-007` | `page/retarget.spec.ts` | enabled/disabled retargeting |
| `RE-008` | `page/retarget.spec.ts` | visible/hidden retargeting |
| `RE-009` | `page/retarget.spec.ts` | editable retargeting |
| `RE-010` | `page/retarget.spec.ts` | input value retargeting |
| `RE-011` | `page/retarget.spec.ts` | selection retargeting |
| `RE-012` | `page/retarget.spec.ts` | select options retargeting |
| `RE-013` | `page/retarget.spec.ts` | direct actions retargeting |
| `RE-014` | `page/retarget.spec.ts` | check retargeting |
| `RE-015` | `page/retarget.spec.ts` | should not retarget anchor into parent label |

### RO — Route

| ID | File | Title |
|---|---|---|
| `RO-001` | `page/page-route.spec.ts` | should intercept @smoke |
| `RO-002` | `page/page-route.spec.ts` | should unroute |
| `RO-003` | `page/page-route.spec.ts` | should not support ? in glob pattern |
| `RO-004` | `page/page-route.spec.ts` | should work when POST is redirected with 302 |
| `RO-005` | `page/page-route.spec.ts` | should work when header manipulation headers with redirect |
| `RO-006` | `page/page-route.spec.ts` | should be able to remove headers |
| `RO-007` | `page/page-route.spec.ts` | should contain referer header |
| `RO-008` | `page/page-route.spec.ts` | should properly return navigation response when URL has cookies |
| `RO-009` | `page/page-route.spec.ts` | should not override cookie header |
| `RO-010` | `page/page-route.spec.ts` | should show custom HTTP headers |
| `RO-011` | `page/page-route.spec.ts` | should work with redirect inside sync XHR |
| `RO-012` | `page/page-route.spec.ts` | should pause intercepted XHR until continue |
| `RO-013` | `page/page-route.spec.ts` | should pause intercepted fetch request until continue |
| `RO-014` | `page/page-route.spec.ts` | should work with custom referer headers |
| `RO-015` | `page/page-route.spec.ts` | should be abortable |
| `RO-016` | `page/page-route.spec.ts` | should be abortable with custom error codes |
| `RO-017` | `page/page-route.spec.ts` | should not throw if request was cancelled by the page |
| `RO-018` | `page/page-route.spec.ts` | should send referer |
| `RO-019` | `page/page-route.spec.ts` | should fail navigation when aborting main resource |
| `RO-020` | `page/page-route.spec.ts` | should not work with redirects |
| `RO-021` | `page/page-route.spec.ts` | should chain fallback w/ dynamic URL |
| `RO-022` | `page/page-route.spec.ts` | should work with redirects for subresources |
| `RO-023` | `page/page-route.spec.ts` | should work with equal requests |
| `RO-024` | `page/page-route.spec.ts` | should navigate to dataURL and not fire dataURL requests |
| `RO-025` | `page/page-route.spec.ts` | should be able to fetch dataURL and not fire dataURL requests |
| `RO-026` | `page/page-route.spec.ts` | should navigate to URL with hash and and fire requests without hash |
| `RO-027` | `page/page-route.spec.ts` | should work with encoded server |
| `RO-028` | `page/page-route.spec.ts` | should work with badly encoded server |
| `RO-029` | `page/page-route.spec.ts` | should work with encoded server - 2 |
| `RO-030` | `page/page-route.spec.ts` | should not throw "Invalid Interception Id" if the request was cancelled |
| `RO-031` | `page/page-route.spec.ts` | should intercept main resource during cross-process navigation |
| `RO-032` | `page/page-route.spec.ts` | should fulfill with redirect status |
| `RO-033` | `page/page-route.spec.ts` | should not fulfill with redirect status |
| `RO-034` | `page/page-route.spec.ts` | should support cors with GET |
| `RO-035` | `page/page-route.spec.ts` | should add Access-Control-Allow-Origin by default when fulfill |
| `RO-036` | `page/page-route.spec.ts` | should allow null origin for about:blank |
| `RO-037` | `page/page-route.spec.ts` | should respect cors overrides |
| `RO-038` | `page/page-route.spec.ts` | should not auto-intercept non-preflight OPTIONS without network interception |
| `RO-039` | `page/page-route.spec.ts` | should not auto-intercept non-preflight OPTIONS with network interception |
| `RO-040` | `page/page-route.spec.ts` | should support cors with POST |
| `RO-041` | `page/page-route.spec.ts` | should support cors with credentials |
| `RO-042` | `page/page-route.spec.ts` | should not abort preflighted cross-origin redirect when a route is registered |
| `RO-043` | `page/page-route.spec.ts` | should reject cors with disallowed credentials |
| `RO-044` | `page/page-route.spec.ts` | should support cors for different methods |
| `RO-045` | `page/page-route.spec.ts` | should support the times parameter with route matching |
| `RO-046` | `page/page-route.spec.ts` | should work if handler with times parameter was removed from another handler |
| `RO-047` | `page/page-route.spec.ts` | should support async handler w/ times |
| `RO-048` | `page/page-route.spec.ts` | route abort with times: 1 should not affect second sequential fetch |
| `RO-049` | `page/page-route.spec.ts` | should contain raw request header |
| `RO-050` | `page/page-route.spec.ts` | should contain sec-fetch headers in route |
| `RO-051` | `page/page-route.spec.ts` | should contain raw response header |
| `RO-052` | `page/page-route.spec.ts` | should contain raw response header after fulfill |
| `RO-053` | `page/page-route.spec.ts` | {route.fulfill, route.continue, route.fallback, route.abort} should throw if called twice *(4 copies)* |
| `RO-054` | `page/page-route.spec.ts` | should intercept when postData is more than 1MB |
| `RO-055` | `page/page-route.spec.ts` | should be able to intercept every navigation to a page controlled by service worker |
| `RO-056` | `page/page-route.spec.ts` | should respect URLPattern ignoreCase |
| `RO-057` | `page/page-request-continue.spec.ts` | should work |
| `RO-058` | `page/page-request-continue.spec.ts` | should amend HTTP headers |
| `RO-059` | `page/page-request-continue.spec.ts` | should not allow to override unsafe HTTP headers |
| `RO-060` | `page/page-request-continue.spec.ts` | should delete header with undefined value |
| `RO-061` | `page/page-request-continue.spec.ts` | should amend method |
| `RO-062` | `page/page-request-continue.spec.ts` | should override request url |
| `RO-063` | `page/page-request-continue.spec.ts` | should not allow changing protocol when overriding url |
| `RO-064` | `page/page-request-continue.spec.ts` | should not throw if request was cancelled by the page |
| `RO-065` | `page/page-request-continue.spec.ts` | should override method along with url |
| `RO-066` | `page/page-request-continue.spec.ts` | should amend method on main request |
| `RO-067` | `page/page-request-continue.spec.ts` | post data › should amend post data |
| `RO-068` | `page/page-request-continue.spec.ts` | post data › should compute content-length from post data |
| `RO-069` | `page/page-request-continue.spec.ts` | post data › should amend method and post data |
| `RO-070` | `page/page-request-continue.spec.ts` | post data › should amend utf8 post data |
| `RO-071` | `page/page-request-continue.spec.ts` | post data › should amend longer post data |
| `RO-072` | `page/page-request-continue.spec.ts` | post data › should amend binary post data |
| `RO-073` | `page/page-request-continue.spec.ts` | post data › should use content-type from original request |
| `RO-074` | `page/page-request-continue.spec.ts` | should work with Cross-Origin-Opener-Policy |
| `RO-075` | `page/page-request-continue.spec.ts` | should not delete the origin header |
| `RO-076` | `page/page-request-continue.spec.ts` | should continue preload link requests |
| `RO-077` | `page/page-request-continue.spec.ts` | should respect set-cookie in redirect response |
| `RO-078` | `page/page-request-continue.spec.ts` | continue should not propagate cookie override to redirects |
| `RO-079` | `page/page-request-continue.spec.ts` | continue should not override cookie |
| `RO-080` | `page/page-request-continue.spec.ts` | continue with headers should send fresh cookie from the browser cookie store |
| `RO-081` | `page/page-request-continue.spec.ts` | continue with headers should send fresh cookie after a redirect |
| `RO-082` | `page/page-request-continue.spec.ts` | redirect after continue should be able to delete cookie |
| `RO-083` | `page/page-request-continue.spec.ts` | continue should propagate headers to redirects |
| `RO-084` | `page/page-request-continue.spec.ts` | continue should drop content-length on redirects |
| `RO-085` | `page/page-request-continue.spec.ts` | redirected requests should report overridden headers |
| `RO-086` | `page/page-request-continue.spec.ts` | continue should delete headers on redirects |
| `RO-087` | `page/page-request-continue.spec.ts` | propagate headers same origin redirect |
| `RO-088` | `page/page-request-continue.spec.ts` | propagate headers cross origin |
| `RO-089` | `page/page-request-continue.spec.ts` | propagate headers cross origin redirect |
| `RO-090` | `page/page-request-continue.spec.ts` | propagate headers cross origin redirect after interception |
| `RO-091` | `page/page-request-continue.spec.ts` | continue should pass on 307 cross-origin redirect |
| `RO-092` | `page/page-request-continue.spec.ts` | should intercept css variable with background url |
| `RO-093` | `page/page-request-continue.spec.ts` | continue should not change multipart/form-data body |
| `RO-094` | `page/page-request-continue.spec.ts` | should not forward Host header on cross-origin redirect |
| `RO-095` | `page/page-request-continue.spec.ts` | postData should return empty string when overriding body with empty string |
| `RO-096` | `page/page-request-fulfill.spec.ts` | should work |
| `RO-097` | `page/page-request-fulfill.spec.ts` | should work with buffer as body |
| `RO-098` | `page/page-request-fulfill.spec.ts` | should work with status code 422 |
| `RO-099` | `page/page-request-fulfill.spec.ts` | should fulfill with unuassigned status codes |
| `RO-100` | `page/page-request-fulfill.spec.ts` | should not throw if request was cancelled by the page |
| `RO-101` | `page/page-request-fulfill.spec.ts` | should allow mocking binary responses |
| `RO-102` | `page/page-request-fulfill.spec.ts` | should allow mocking svg with charset |
| `RO-103` | `page/page-request-fulfill.spec.ts` | should work with file path |
| `RO-104` | `page/page-request-fulfill.spec.ts` | should stringify intercepted request response headers |
| `RO-105` | `page/page-request-fulfill.spec.ts` | should not modify the headers sent to the server |
| `RO-106` | `page/page-request-fulfill.spec.ts` | should include the origin header |
| `RO-107` | `page/page-request-fulfill.spec.ts` | should fulfill with global fetch result |
| `RO-108` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch result |
| `RO-109` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch result and overrides |
| `RO-110` | `page/page-request-fulfill.spec.ts` | should fetch original request and fulfill |
| `RO-111` | `page/page-request-fulfill.spec.ts` | should fulfill with multiple set-cookie |
| `RO-112` | `page/page-request-fulfill.spec.ts` | should fulfill with fetch response that has multiple set-cookie |
| `RO-113` | `page/page-request-fulfill.spec.ts` | headerValue should return set-cookie from intercepted response |
| `RO-114` | `page/page-request-fulfill.spec.ts` | should fulfill with har response |
| `RO-115` | `page/page-request-fulfill.spec.ts` | should fulfill preload link requests |
| `RO-116` | `page/page-request-fulfill.spec.ts` | should fulfill json |
| `RO-117` | `page/page-request-fulfill.spec.ts` | should fulfill with gzip and readback |
| `RO-118` | `page/page-request-fulfill.spec.ts` | should not go to the network for fulfilled requests body |
| `RO-119` | `page/page-request-fulfill.spec.ts` | should return body for fulfilled responses |
| `RO-120` | `page/page-request-fallback.spec.ts` | should work |
| `RO-121` | `page/page-request-fallback.spec.ts` | should fall back |
| `RO-122` | `page/page-request-fallback.spec.ts` | should fall back async |
| `RO-123` | `page/page-request-fallback.spec.ts` | should not chain fulfill |
| `RO-124` | `page/page-request-fallback.spec.ts` | should not chain abort |
| `RO-125` | `page/page-request-fallback.spec.ts` | should fall back after exception |
| `RO-126` | `page/page-request-fallback.spec.ts` | should chain once |
| `RO-127` | `page/page-request-fallback.spec.ts` | should amend HTTP headers |
| `RO-128` | `page/page-request-fallback.spec.ts` | should delete header with undefined value |
| `RO-129` | `page/page-request-fallback.spec.ts` | should amend method |
| `RO-130` | `page/page-request-fallback.spec.ts` | should override request url |
| `RO-131` | `page/page-request-fallback.spec.ts` | post data › should amend post data |
| `RO-132` | `page/page-request-fallback.spec.ts` | post data › should amend binary post data |
| `RO-133` | `page/page-request-fallback.spec.ts` | post data › should amend json post data |
| `RO-134` | `page/page-request-intercept.spec.ts` | should fulfill intercepted response |
| `RO-135` | `page/page-request-intercept.spec.ts` | should fulfill response with empty body |
| `RO-136` | `page/page-request-intercept.spec.ts` | should override with defaults when intercepted response not provided |
| `RO-137` | `page/page-request-intercept.spec.ts` | should fulfill with any response |
| `RO-138` | `page/page-request-intercept.spec.ts` | should support fulfill after intercept |
| `RO-139` | `page/page-request-intercept.spec.ts` | should give access to the intercepted response |
| `RO-140` | `page/page-request-intercept.spec.ts` | should give access to the intercepted response body |
| `RO-141` | `page/page-request-intercept.spec.ts` | should intercept multipart/form-data request body |
| `RO-142` | `page/page-request-intercept.spec.ts` | should fulfill intercepted response using alias |
| `RO-143` | `page/page-request-intercept.spec.ts` | should support timeout option in route.fetch |
| `RO-144` | `page/page-request-intercept.spec.ts` | should not follow redirects when maxRedirects is set to 0 in route.fetch |
| `RO-145` | `page/page-request-intercept.spec.ts` | should intercept with url override |
| `RO-146` | `page/page-request-intercept.spec.ts` | should intercept with post data override |
| `RO-147` | `page/page-request-intercept.spec.ts` | request.postData is not null when fetching FormData with a Blob |
| `RO-148` | `page/page-request-intercept.spec.ts` | should abort favicon requests if interception is enabled |
| `RO-149` | `page/page-request-gc.spec.ts` | should work |
| `RO-150` | `page/page-request-gc.spec.ts` | should collect element retained by locator hit-target interceptor after detach |
| `RO-151` | `page/interception.spec.ts` | should work with navigation @smoke |
| `RO-152` | `page/interception.spec.ts` | should intercept after a service worker |
| `RO-153` | `page/interception.spec.ts` | should work with glob |
| `RO-154` | `page/interception.spec.ts` | should throw on unbalanced glob braces |
| `RO-155` | `page/interception.spec.ts` | should throw on page.route with invalid glob |
| `RO-156` | `page/interception.spec.ts` | should intercept by glob |
| `RO-157` | `page/interception.spec.ts` | should intercept network activity from worker |
| `RO-158` | `page/interception.spec.ts` | should intercept worker requests when enabled after worker creation |
| `RO-159` | `page/interception.spec.ts` | should intercept network activity from worker 2 |
| `RO-160` | `page/interception.spec.ts` | should work with regular expression passed from a different context |
| `RO-161` | `page/interception.spec.ts` | should intercept every request matching a global regexp |
| `RO-162` | `page/interception.spec.ts` | should not break remote worker importScripts |
| `RO-163` | `page/interception.spec.ts` | should disable memory cache when intercepting |
| `RO-164` | `page/interception.spec.ts` | should intercept blob url requests |
| `RO-165` | `library/browsercontext-route.spec.ts` | should intercept |
| `RO-166` | `library/browsercontext-route.spec.ts` | should unroute |
| `RO-167` | `library/browsercontext-route.spec.ts` | should yield to page.route |
| `RO-168` | `library/browsercontext-route.spec.ts` | should fall back to context.route |
| `RO-169` | `library/browsercontext-route.spec.ts` | should support Set-Cookie header |
| `RO-170` | `library/browsercontext-route.spec.ts` | should ignore secure Set-Cookie header for insecure requests |
| `RO-171` | `library/browsercontext-route.spec.ts` | should use Set-Cookie header in future requests |
| `RO-172` | `library/browsercontext-route.spec.ts` | should work with ignoreHTTPSErrors |
| `RO-173` | `library/browsercontext-route.spec.ts` | should support the times parameter with route matching |
| `RO-174` | `library/browsercontext-route.spec.ts` | should work if handler with times parameter was removed from another handler |
| `RO-175` | `library/browsercontext-route.spec.ts` | should support async handler w/ times |
| `RO-176` | `library/browsercontext-route.spec.ts` | should overwrite post body with empty string |
| `RO-177` | `library/browsercontext-route.spec.ts` | should chain fallback |
| `RO-178` | `library/browsercontext-route.spec.ts` | should chain fallback w/ dynamic URL |
| `RO-179` | `library/browsercontext-route.spec.ts` | should not chain fulfill |
| `RO-180` | `library/browsercontext-route.spec.ts` | should not chain abort |
| `RO-181` | `library/browsercontext-route.spec.ts` | should chain fallback into page |
| `RO-182` | `library/browsercontext-route.spec.ts` | should fall back async |
| `RO-183` | `library/browsercontext-route.spec.ts` | should bypass disk cache when context interception is enabled |
| `RO-184` | `library/browsercontext-route.spec.ts` | should fulfill popup main request using alias |
| `RO-185` | `library/browsercontext-route.spec.ts` | should respect URLPattern ignoreCase |
| `RO-186` | `library/unroute-behavior.spec.ts` | context.unroute should not wait for pending handlers to complete |
| `RO-187` | `library/unroute-behavior.spec.ts` | context.unrouteAll removes all handlers |
| `RO-188` | `library/unroute-behavior.spec.ts` | context.unrouteAll should wait for pending handlers to complete |
| `RO-189` | `library/unroute-behavior.spec.ts` | context.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors |
| `RO-190` | `library/unroute-behavior.spec.ts` | page.close should not wait for active route handlers on the owning context |
| `RO-191` | `library/unroute-behavior.spec.ts` | context.close should not wait for active route handlers on the owned pages |
| `RO-192` | `library/unroute-behavior.spec.ts` | page.unroute should not wait for pending handlers to complete |
| `RO-193` | `library/unroute-behavior.spec.ts` | page.unrouteAll removes all routes |
| `RO-194` | `library/unroute-behavior.spec.ts` | page.unrouteAll should wait for pending handlers to complete |
| `RO-195` | `library/unroute-behavior.spec.ts` | page.unrouteAll should not wait for pending handlers to complete if behavior is ignoreErrors |
| `RO-196` | `library/unroute-behavior.spec.ts` | page.close does not wait for active route handlers |
| `RO-197` | `library/unroute-behavior.spec.ts` | route.continue should not throw if page has been closed |
| `RO-198` | `library/unroute-behavior.spec.ts` | route.fallback should not throw if page has been closed |
| `RO-199` | `library/unroute-behavior.spec.ts` | route.fulfill should not throw if page has been closed |
| `RO-200` | `library/unroute-behavior.spec.ts` | should not continue requests in flight (page) |
| `RO-201` | `library/unroute-behavior.spec.ts` | should not continue requests in flight (context) |
| `RO-202` | `page/page-route.spec.ts` | should continue a request reported while interception was disabled |

### SC — Screencast

| ID | File | Title |
|---|---|---|
| `SC-001` | `library/screencast.spec.ts` | screencast.start delivers frames via onFrame callback |
| `SC-002` | `library/screencast.spec.ts` | applies backpressure while async onFrame callback is pending |
| `SC-003` | `library/screencast.spec.ts` | onFrame receives viewport size |
| `SC-004` | `library/screencast.spec.ts` | start throws if screencast is already started |
| `SC-005` | `library/screencast.spec.ts` | start allows restart with different options after stop |
| `SC-006` | `library/screencast.spec.ts` | start returns a disposable that stops screencast |
| `SC-007` | `library/screencast.spec.ts` | start/stop twice without path creates two files in artifactsDir |
| `SC-008` | `library/screencast.spec.ts` | start should work when recordVideo is set |
| `SC-009` | `library/screencast.spec.ts` | start should record video with the requested fps |
| `SC-010` | `library/screencast.spec.ts` | start should throw on invalid fps |
| `SC-011` | `library/screencast.spec.ts` | start should fail when another recording is in progress |
| `SC-012` | `library/screencast.spec.ts` | stop should not fail when no recording is in progress |
| `SC-013` | `library/screencast.spec.ts` | start should finish when page is closed |
| `SC-014` | `library/screencast.spec.ts` | empty video |
| `SC-015` | `library/screencast.spec.ts` | start dispose stops recording |
| `SC-016` | `library/screencast-actions.spec.ts` | should show annotation on click |
| `SC-017` | `library/screencast-actions.spec.ts` | should render annotation styles |
| `SC-018` | `library/screencast-actions.spec.ts` | should position title at {top-left, top, bottom-left, bottom, bottom-right} *(5 copies)* |
| `SC-019` | `library/screencast-actions.spec.ts` | should clear annotation after duration |
| `SC-020` | `library/screencast-actions.spec.ts` | should annotate fill action |
| `SC-021` | `library/screencast-actions.spec.ts` | should stop showing actions after dispose |
| `SC-022` | `library/screencast-actions.spec.ts` | should stop showing actions after hideActions |
| `SC-023` | `library/screencast-actions.spec.ts` | should render an action cursor that animates to the click point |
| `SC-024` | `library/screencast-actions.spec.ts` | cursor moves between two pointer actions |
| `SC-025` | `library/screencast-actions.spec.ts` | cursor: "none" suppresses the action cursor decoration |
| `SC-026` | `library/screencast-actions.spec.ts` | cursor stays at the last action point until hideActions |
| `SC-027` | `library/screencast-actions.spec.ts` | should survive navigation |
| `SC-028` | `library/screencast-overlay.spec.ts` | should add and remove overlay |
| `SC-029` | `library/screencast-overlay.spec.ts` | should add multiple overlays |
| `SC-030` | `library/screencast-overlay.spec.ts` | should hide and show overlays |
| `SC-031` | `library/screencast-overlay.spec.ts` | should survive navigation |
| `SC-032` | `library/screencast-overlay.spec.ts` | should remove overlay and not restore after navigation |
| `SC-033` | `library/screencast-overlay.spec.ts` | should sanitize scripts from overlay html |
| `SC-034` | `library/screencast-overlay.spec.ts` | should strip event handlers from overlay html |
| `SC-035` | `library/screencast-overlay.spec.ts` | should auto-remove overlay after timeout |
| `SC-036` | `library/screencast-overlay.spec.ts` | should allow styles in overlay html |
| `SC-037` | `library/screencast-overlay.spec.ts` | should show overlay above {dialog, popover} opened before it *(2 copies)* |
| `SC-038` | `library/screencast-overlay.spec.ts` | should keep overlay above {dialog, popover} opened after it *(2 copies)* |

### SE — Selectors

| ID | File | Title |
|---|---|---|
| `SE-001` | `page/selectors-css.spec.ts` | should work with large DOM @smoke |
| `SE-002` | `page/selectors-css.spec.ts` | should work for open shadow roots |
| `SE-003` | `page/selectors-css.spec.ts` | should work with \> combinator and spaces |
| `SE-004` | `page/selectors-css.spec.ts` | should work with comma separated list |
| `SE-005` | `page/selectors-css.spec.ts` | should keep dom order with comma separated list |
| `SE-006` | `page/selectors-css.spec.ts` | should return multiple captures for the same node |
| `SE-007` | `page/selectors-css.spec.ts` | should return multiple captures when going up the hierarchy |
| `SE-008` | `page/selectors-css.spec.ts` | should work with comma separated list in various positions |
| `SE-009` | `page/selectors-css.spec.ts` | should work with comma inside text |
| `SE-010` | `page/selectors-css.spec.ts` | should work with attribute selectors |
| `SE-011` | `page/selectors-css.spec.ts` | should not match root after \>\> |
| `SE-012` | `page/selectors-css.spec.ts` | should work with numerical id |
| `SE-013` | `page/selectors-css.spec.ts` | should work with wrong-case id |
| `SE-014` | `page/selectors-css.spec.ts` | should work with \* |
| `SE-015` | `page/selectors-css.spec.ts` | should work with :nth-child |
| `SE-016` | `page/selectors-css.spec.ts` | should work with :nth-child(of) notation with nested functions |
| `SE-017` | `page/selectors-css.spec.ts` | should work with :not |
| `SE-018` | `page/selectors-css.spec.ts` | should work with ~ |
| `SE-019` | `page/selectors-css.spec.ts` | should work with + |
| `SE-020` | `page/selectors-css.spec.ts` | should work with spaces in :nth-child and :not |
| `SE-021` | `page/selectors-css.spec.ts` | should work with :is |
| `SE-022` | `page/selectors-css.spec.ts` | should work with :has |
| `SE-023` | `page/selectors-css.spec.ts` | should work with :scope |
| `SE-024` | `page/selectors-css.spec.ts` | should work with :scope and class |
| `SE-025` | `page/selectors-css.spec.ts` | should absolutize relative selectors |
| `SE-026` | `page/selectors-css.spec.ts` | css on the handle should be relative |
| `SE-027` | `page/selectors-css.spec.ts` | should use light DOM structure for child combinator with slotted content |
| `SE-028` | `page/selectors-text.spec.ts` | should work @smoke |
| `SE-029` | `page/selectors-text.spec.ts` | should work with :text |
| `SE-030` | `page/selectors-text.spec.ts` | should support empty string |
| `SE-031` | `page/selectors-text.spec.ts` | should work across nodes |
| `SE-032` | `page/selectors-text.spec.ts` | text-is() should ignore comments |
| `SE-033` | `page/selectors-text.spec.ts` | should work with text nodes in quoted mode |
| `SE-034` | `page/selectors-text.spec.ts` | should clear caches |
| `SE-035` | `page/selectors-text.spec.ts` | should work with :has-text |
| `SE-036` | `page/selectors-text.spec.ts` | should work with large DOM |
| `SE-037` | `page/selectors-text.spec.ts` | should be case sensitive if quotes are specified |
| `SE-038` | `page/selectors-text.spec.ts` | should search for a substring without quotes |
| `SE-039` | `page/selectors-text.spec.ts` | should skip head, script and style |
| `SE-040` | `page/selectors-text.spec.ts` | should match input\[type=button\|submit\|reset\] |
| `SE-041` | `page/selectors-text.spec.ts` | should work for open shadow roots |
| `SE-042` | `page/selectors-text.spec.ts` | should prioritize light dom over shadow dom in the same parent |
| `SE-043` | `page/selectors-text.spec.ts` | should waitForSelector with distributed elements |
| `SE-044` | `page/selectors-text.spec.ts` | should match root after \>\> |
| `SE-045` | `page/selectors-text.spec.ts` | should match root after \>\> with \* |
| `SE-046` | `page/selectors-text.spec.ts` | should work with leading and trailing spaces |
| `SE-047` | `page/selectors-text.spec.ts` | should work with unpaired quotes when not at the start |
| `SE-048` | `page/selectors-text.spec.ts` | should work with paired quotes in the middle of selector |
| `SE-049` | `page/selectors-text.spec.ts` | hasText and internal:text should match full node text in strict mode |
| `SE-050` | `page/selectors-role.spec.ts` | should detect roles |
| `SE-051` | `page/selectors-role.spec.ts` | should support selected |
| `SE-052` | `page/selectors-role.spec.ts` | should support checked |
| `SE-053` | `page/selectors-role.spec.ts` | should support pressed |
| `SE-054` | `page/selectors-role.spec.ts` | should support expanded |
| `SE-055` | `page/selectors-role.spec.ts` | should support disabled |
| `SE-056` | `page/selectors-role.spec.ts` | should inherit disabled from the ancestor |
| `SE-057` | `page/selectors-role.spec.ts` | should support disabled fieldset |
| `SE-058` | `page/selectors-role.spec.ts` | should support level |
| `SE-059` | `page/selectors-role.spec.ts` | should filter hidden, unless explicitly asked for |
| `SE-060` | `page/selectors-role.spec.ts` | should support name |
| `SE-061` | `page/selectors-role.spec.ts` | should support option name with html whitespace |
| `SE-062` | `page/selectors-role.spec.ts` | errors |
| `SE-063` | `page/selectors-role.spec.ts` | hidden with shadow dom slots |
| `SE-064` | `page/selectors-role.spec.ts` | should support output accessible name |
| `SE-065` | `page/selectors-role.spec.ts` | should not match scope by default |
| `SE-066` | `page/selectors-role.spec.ts` | should not match inert elements, unless explicitly asked for |
| `SE-067` | `page/selectors-role.spec.ts` | should not match elements outside of a modal dialog |
| `SE-068` | `page/selectors-role.spec.ts` | should match the topmost modal dialog |
| `SE-069` | `page/selectors-role.spec.ts` | should respect PLAYWRIGHT\_SKIP\_INERT\_CHECK |
| `SE-070` | `page/selectors-role.spec.ts` | should respect PLAYWRIGHT\_SKIP\_DIALOG\_CHECK |
| `SE-071` | `page/selectors-get-by.spec.ts` | getByTestId should work |
| `SE-072` | `page/selectors-get-by.spec.ts` | getByTestId with custom testId should work |
| `SE-073` | `page/selectors-get-by.spec.ts` | getByTestId with comma-separated testIdAttributes should match any |
| `SE-074` | `page/selectors-get-by.spec.ts` | getByTestId should escape id |
| `SE-075` | `page/selectors-get-by.spec.ts` | getByTestId should work for regex |
| `SE-076` | `page/selectors-get-by.spec.ts` | getByText should work |
| `SE-077` | `page/selectors-get-by.spec.ts` | getByLabel should work |
| `SE-078` | `page/selectors-get-by.spec.ts` | getByLabel should work with nested elements |
| `SE-079` | `page/selectors-get-by.spec.ts` | getByLabel should work with multiply-labelled input |
| `SE-080` | `page/selectors-get-by.spec.ts` | getByLabel should work with ancestor label and multiple controls |
| `SE-081` | `page/selectors-get-by.spec.ts` | getByLabel should work with ancestor label and for |
| `SE-082` | `page/selectors-get-by.spec.ts` | getByLabel should work with aria-labelledby |
| `SE-083` | `page/selectors-get-by.spec.ts` | getByLabel should prioritize aria-labelledby over native label |
| `SE-084` | `page/selectors-get-by.spec.ts` | getByLabel should work with aria-label |
| `SE-085` | `page/selectors-get-by.spec.ts` | getByLabel should ignore empty aria-label |
| `SE-086` | `page/selectors-get-by.spec.ts` | getByLabel should prioritize aria-labelledby over aria-label |
| `SE-087` | `page/selectors-get-by.spec.ts` | getByPlaceholder should work |
| `SE-088` | `page/selectors-get-by.spec.ts` | getByAltText should work |
| `SE-089` | `page/selectors-get-by.spec.ts` | getByTitle should work |
| `SE-090` | `page/selectors-get-by.spec.ts` | getBy escaping |
| `SE-091` | `page/selectors-get-by.spec.ts` | getByRole escaping |
| `SE-092` | `page/selectors-get-by.spec.ts` | getByRole should accept regexp with v flag |
| `SE-093` | `page/selectors-get-by.spec.ts` | getByRole with description |
| `SE-094` | `page/selectors-get-by.spec.ts` | getByRole with description via aria-describedby |
| `SE-095` | `page/selectors-get-by.spec.ts` | getByRole with description via title fallback |
| `SE-096` | `page/selectors-get-by.spec.ts` | getByRole with description whitespace normalization |
| `SE-097` | `page/selectors-get-by.spec.ts` | locators should not be affected by global and sticky regex flags |
| `SE-098` | `page/selectors-frame.spec.ts` | should work for iframe @smoke |
| `SE-099` | `page/selectors-frame.spec.ts` | should work for iframe (handle) |
| `SE-100` | `page/selectors-frame.spec.ts` | should work for nested iframe |
| `SE-101` | `page/selectors-frame.spec.ts` | should work for nested iframe (handle) |
| `SE-102` | `page/selectors-frame.spec.ts` | should work for $ and $$ |
| `SE-103` | `page/selectors-frame.spec.ts` | $ should not wait for frame |
| `SE-104` | `page/selectors-frame.spec.ts` | $$ should not wait for frame |
| `SE-105` | `page/selectors-frame.spec.ts` | $eval should throw for missing frame |
| `SE-106` | `page/selectors-frame.spec.ts` | $$eval should not throw for missing frame |
| `SE-107` | `page/selectors-frame.spec.ts` | should work for $ and $$ (handle) |
| `SE-108` | `page/selectors-frame.spec.ts` | should work for $eval |
| `SE-109` | `page/selectors-frame.spec.ts` | should work for $eval (handle) |
| `SE-110` | `page/selectors-frame.spec.ts` | should work for $$eval |
| `SE-111` | `page/selectors-frame.spec.ts` | should work for $$eval (handle) |
| `SE-112` | `page/selectors-frame.spec.ts` | should not allow dangling enter-frame |
| `SE-113` | `page/selectors-frame.spec.ts` | should not allow leading enter-frame |
| `SE-114` | `page/selectors-frame.spec.ts` | should not allow capturing before enter-frame |
| `SE-115` | `page/selectors-frame.spec.ts` | should capture after the enter-frame |
| `SE-116` | `page/selectors-frame.spec.ts` | should click in lazy iframe |
| `SE-117` | `page/selectors-frame.spec.ts` | waitFor should survive frame reattach |
| `SE-118` | `page/selectors-frame.spec.ts` | waitForSelector should survive frame reattach (handle) |
| `SE-119` | `page/selectors-frame.spec.ts` | waitForSelector should survive iframe navigation (handle) |
| `SE-120` | `page/selectors-frame.spec.ts` | click should survive frame reattach |
| `SE-121` | `page/selectors-frame.spec.ts` | click should survive iframe navigation |
| `SE-122` | `page/selectors-frame.spec.ts` | click should survive navigation |
| `SE-123` | `page/selectors-frame.spec.ts` | should non work for non-frame |
| `SE-124` | `page/selectors-frame.spec.ts` | should match in a descendant frame |
| `SE-125` | `page/selectors-frame.spec.ts` | should match in a deeply nested frame |
| `SE-126` | `page/selectors-frame.spec.ts` | should not match a chain across frames |
| `SE-127` | `page/selectors-frame.spec.ts` | should match multiple elements |
| `SE-128` | `page/selectors-frame.spec.ts` | should throw when matching elements in multiple frames |
| `SE-129` | `page/selectors-frame.spec.ts` | should not allow any-frame in the middle of a selector |
| `SE-130` | `page/selectors-frame.spec.ts` | should allow entering frames from any frame |
| `SE-131` | `page/selectors-frame.spec.ts` | should not allow any-frame after entering a frame |
| `SE-132` | `page/selectors-frame.spec.ts` | should not allow dangling enter-frame after any-frame |
| `SE-133` | `page/selectors-misc.spec.ts` | should work for open shadow roots |
| `SE-134` | `page/selectors-misc.spec.ts` | should click on links in shadow dom |
| `SE-135` | `page/selectors-misc.spec.ts` | should work with :visible |
| `SE-136` | `page/selectors-misc.spec.ts` | should work with \>\> visible= |
| `SE-137` | `page/selectors-misc.spec.ts` | should work with \>\> visible=false |
| `SE-138` | `page/selectors-misc.spec.ts` | should work with :nth-match |
| `SE-139` | `page/selectors-misc.spec.ts` | should work with nth= |
| `SE-140` | `page/selectors-misc.spec.ts` | should work with strict mode and chaining |
| `SE-141` | `page/selectors-misc.spec.ts` | should work with layout selectors |
| `SE-142` | `page/selectors-misc.spec.ts` | should escape the scope with \>\> |
| `SE-143` | `page/selectors-misc.spec.ts` | xpath should be relative |
| `SE-144` | `page/selectors-misc.spec.ts` | should work with pipe in xpath |
| `SE-145` | `page/selectors-misc.spec.ts` | should print original xpath in error |
| `SE-146` | `page/selectors-misc.spec.ts` | data-testid on the handle should be relative |
| `SE-147` | `page/selectors-misc.spec.ts` | should properly determine visibility of display:contents elements |
| `SE-148` | `page/selectors-misc.spec.ts` | should work with internal:has= |
| `SE-149` | `page/selectors-misc.spec.ts` | should work with internal:has-not= |
| `SE-150` | `page/selectors-misc.spec.ts` | should work with internal:and= |
| `SE-151` | `page/selectors-misc.spec.ts` | should work with internal:or= |
| `SE-152` | `page/selectors-misc.spec.ts` | should work with internal:chain= |
| `SE-153` | `page/selectors-misc.spec.ts` | chaining should work with large DOM @smoke |
| `SE-154` | `page/selectors-register.spec.ts` | textContent should be atomic |
| `SE-155` | `page/selectors-register.spec.ts` | innerText should be atomic |
| `SE-156` | `page/selectors-register.spec.ts` | innerHTML should be atomic |
| `SE-157` | `page/selectors-register.spec.ts` | getAttribute should be atomic |
| `SE-158` | `page/selectors-register.spec.ts` | isVisible should be atomic |
| `SE-159` | `page/selectors-register.spec.ts` | should take java-style string |
| `SE-160` | `library/selectors-register.spec.ts` | should work |
| `SE-161` | `library/selectors-register.spec.ts` | should work when registered on global |
| `SE-162` | `library/selectors-register.spec.ts` | should work with path |
| `SE-163` | `library/selectors-register.spec.ts` | should work in main and isolated world |
| `SE-164` | `library/selectors-register.spec.ts` | should handle errors |
| `SE-165` | `library/selectors-register.spec.ts` | should throw "already registered" error when registering |
| `SE-166` | `library/selectors-register.spec.ts` | should not rely on engines working from the root |
| `SE-167` | `library/selectors-register.spec.ts` | should throw a nice error if the selector returns a bad value |

### SI — Signals

| ID | File | Title |
|---|---|---|
| `SI-001` | `library/signals.spec.ts` | should close the browser when the node process closes |
| `SI-002` | `library/signals.spec.ts` | should remove temp dir on process.exit |
| `SI-003` | `library/signals.spec.ts` | signals › should report browser close signal 2 |
| `SI-004` | `library/signals.spec.ts` | signals › should close the browser on SIGINT |
| `SI-005` | `library/signals.spec.ts` | signals › should close the browser on SIGTERM |
| `SI-006` | `library/signals.spec.ts` | signals › should close the browser on SIGHUP |
| `SI-007` | `library/signals.spec.ts` | signals › should kill the browser on double SIGINT and remove temp dir |
| `SI-008` | `library/signals.spec.ts` | signals › should kill the browser on SIGINT + SIGTERM |
| `SI-009` | `library/signals.spec.ts` | signals › should kill the browser on SIGTERM + SIGINT |
| `SI-010` | `library/signals.spec.ts` | signals › should not prevent default SIGTERM handling after browser close |

### SL — Slow motion

| ID | File | Title |
|---|---|---|
| `SL-001` | `library/slowmo.spec.ts` | slowMo › Page SlowMo check |
| `SL-002` | `library/slowmo.spec.ts` | slowMo › Page SlowMo click |
| `SL-003` | `library/slowmo.spec.ts` | slowMo › Page SlowMo dblclick |
| `SL-004` | `library/slowmo.spec.ts` | slowMo › Page SlowMo dispatchEvent |
| `SL-005` | `library/slowmo.spec.ts` | slowMo › Page SlowMo fill |
| `SL-006` | `library/slowmo.spec.ts` | slowMo › Page SlowMo focus |
| `SL-007` | `library/slowmo.spec.ts` | slowMo › Page SlowMo goto |
| `SL-008` | `library/slowmo.spec.ts` | slowMo › Page SlowMo hover |
| `SL-009` | `library/slowmo.spec.ts` | slowMo › Page SlowMo press |
| `SL-010` | `library/slowmo.spec.ts` | slowMo › Page SlowMo reload |
| `SL-011` | `library/slowmo.spec.ts` | slowMo › Page SlowMo selectOption |
| `SL-012` | `library/slowmo.spec.ts` | slowMo › Page SlowMo setInputFiles |
| `SL-013` | `library/slowmo.spec.ts` | slowMo › Page SlowMo type |
| `SL-014` | `library/slowmo.spec.ts` | slowMo › Page SlowMo uncheck |
| `SL-015` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo check |
| `SL-016` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo click |
| `SL-017` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo dblclick |
| `SL-018` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo dispatchEvent |
| `SL-019` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo fill |
| `SL-020` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo focus |
| `SL-021` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo goto |
| `SL-022` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo hover |
| `SL-023` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo press |
| `SL-024` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo selectOption |
| `SL-025` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo setInputFiles |
| `SL-026` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo type |
| `SL-027` | `library/slowmo.spec.ts` | slowMo › Frame SlowMo uncheck |
| `SL-028` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo check |
| `SL-029` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo click |
| `SL-030` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo dblclick |
| `SL-031` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo dispatchEvent |
| `SL-032` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo fill |
| `SL-033` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo focus |
| `SL-034` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo hover |
| `SL-035` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo press |
| `SL-036` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo selectOption |
| `SL-037` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo setInputFiles |
| `SL-038` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo type |
| `SL-039` | `library/slowmo.spec.ts` | slowMo › ElementHandle SlowMo uncheck |

### SM — Strict mode

| ID | File | Title |
|---|---|---|
| `SM-001` | `page/page-strict.spec.ts` | should fail page.textContent in strict mode |
| `SM-002` | `page/page-strict.spec.ts` | should fail page.getAttribute in strict mode |
| `SM-003` | `page/page-strict.spec.ts` | should fail page.fill in strict mode |
| `SM-004` | `page/page-strict.spec.ts` | should fail page.$ in strict mode |
| `SM-005` | `page/page-strict.spec.ts` | should fail page.waitForSelector in strict mode |
| `SM-006` | `page/page-strict.spec.ts` | should fail page.dispatchEvent in strict mode |
| `SM-007` | `page/page-strict.spec.ts` | should properly format :nth-child() in strict mode message |
| `SM-008` | `page/page-strict.spec.ts` | should escape class names |
| `SM-009` | `page/page-strict.spec.ts` | should escape tag names |
| `SM-010` | `page/page-strict.spec.ts` | should keep the engine name for a "text=.." selector in strict mode |
| `SM-011` | `library/browsercontext-strict.spec.ts` | should not fail page.textContent in non-strict mode |
| `SM-012` | `library/browsercontext-strict.spec.ts` | strict context mode › should fail page.textContent in strict mode |
| `SM-013` | `library/browsercontext-strict.spec.ts` | strict context mode › should fail page.click in strict mode |
| `SM-014` | `library/browsercontext-strict.spec.ts` | strict context mode › should opt out of strict mode |

### SO — Select option

| ID | File | Title |
|---|---|---|
| `SO-001` | `page/page-select-option.spec.ts` | should select single option @smoke |
| `SO-002` | `page/page-select-option.spec.ts` | should select single option by value |
| `SO-003` | `page/page-select-option.spec.ts` | should fall back to selecting by label |
| `SO-004` | `page/page-select-option.spec.ts` | should select single option by label |
| `SO-005` | `page/page-select-option.spec.ts` | should select single option by label with html whitespace |
| `SO-006` | `page/page-select-option.spec.ts` | should select single option by handle |
| `SO-007` | `page/page-select-option.spec.ts` | should select single option by index |
| `SO-008` | `page/page-select-option.spec.ts` | should select single option by multiple attributes |
| `SO-009` | `page/page-select-option.spec.ts` | should not select single option when some attributes do not match |
| `SO-010` | `page/page-select-option.spec.ts` | should select only first option |
| `SO-011` | `page/page-select-option.spec.ts` | should not throw when select causes navigation |
| `SO-012` | `page/page-select-option.spec.ts` | should select multiple options |
| `SO-013` | `page/page-select-option.spec.ts` | should select multiple options with attributes |
| `SO-014` | `page/page-select-option.spec.ts` | should respect event bubbling |
| `SO-015` | `page/page-select-option.spec.ts` | should throw when element is not a \<select\> |
| `SO-016` | `page/page-select-option.spec.ts` | should return \[\] on no matched values |
| `SO-017` | `page/page-select-option.spec.ts` | should return an array of matched values |
| `SO-018` | `page/page-select-option.spec.ts` | should return an array of one element when multiple is not set |
| `SO-019` | `page/page-select-option.spec.ts` | should return \[\] on no values |
| `SO-020` | `page/page-select-option.spec.ts` | should not allow null items |
| `SO-021` | `page/page-select-option.spec.ts` | should unselect with null |
| `SO-022` | `page/page-select-option.spec.ts` | should deselect all options when passed no values for a multiple select |
| `SO-023` | `page/page-select-option.spec.ts` | should deselect all options when passed no values for a select without multiple |
| `SO-024` | `page/page-select-option.spec.ts` | should throw if passed wrong types |
| `SO-025` | `page/page-select-option.spec.ts` | should work when re-defining top-level Event class |
| `SO-026` | `page/page-select-option.spec.ts` | should wait for option to be present |
| `SO-027` | `page/page-select-option.spec.ts` | should wait for option index to be present |
| `SO-028` | `page/page-select-option.spec.ts` | should wait for multiple options to be present |
| `SO-029` | `page/page-select-option.spec.ts` | input event.composed should be true and cross shadow dom boundary |
| `SO-030` | `page/page-select-option.spec.ts` | should wait for select to be enabled |
| `SO-031` | `page/page-select-option.spec.ts` | should wait for option to be enabled |
| `SO-032` | `page/page-select-option.spec.ts` | should wait for optgroup to be enabled |
| `SO-033` | `page/page-select-option.spec.ts` | should wait for select to be swapped |

### SQ — Sequence

| ID | File | Title |
|---|---|---|
| `SQ-001` | `library/unit/sequence.spec.ts` | should return an empty array when the input is empty |
| `SQ-002` | `library/unit/sequence.spec.ts` | should handle a single-element array |
| `SQ-003` | `library/unit/sequence.spec.ts` | should handle an array with no repeats |
| `SQ-004` | `library/unit/sequence.spec.ts` | should handle contiguous repeats of single elements |
| `SQ-005` | `library/unit/sequence.spec.ts` | should detect longer repeating substrings |
| `SQ-006` | `library/unit/sequence.spec.ts` | should handle multiple repeating substrings |
| `SQ-007` | `library/unit/sequence.spec.ts` | should handle complex cases with overlapping repeats |
| `SQ-008` | `library/unit/sequence.spec.ts` | should handle complex acceptance cases with multiple possible repeats |
| `SQ-009` | `library/unit/sequence.spec.ts` | should handle non-repeating sequences correctly |
| `SQ-010` | `library/unit/sequence.spec.ts` | should handle a case where the entire array is a repeating sequence |
| `SQ-011` | `library/unit/sequence.spec.ts` | should correctly identify the maximal repeating substring |
| `SQ-012` | `library/unit/sequence.spec.ts` | should handle repeats with varying lengths |
| `SQ-013` | `library/unit/sequence.spec.ts` | should correctly handle a repeat count of one (k adjustment to zero) |
| `SQ-014` | `library/unit/sequence.spec.ts` | should correctly handle repeats at the end of the array |
| `SQ-015` | `library/unit/sequence.spec.ts` | should not overcount repeats when the last potential repeat is incomplete |
| `SQ-016` | `library/unit/sequence.spec.ts` | should handle single repeats correctly when the substring length is greater than one |

### SS — Screenshot

| ID | File | Title |
|---|---|---|
| `SS-001` | `page/page-screenshot.spec.ts` | page screenshot › should work @smoke |
| `SS-002` | `page/page-screenshot.spec.ts` | page screenshot › should not capture blinking caret by default |
| `SS-003` | `page/page-screenshot.spec.ts` | page screenshot › should capture blinking caret if explicitly asked for |
| `SS-004` | `page/page-screenshot.spec.ts` | page screenshot › should capture blinking caret in shadow dom |
| `SS-005` | `page/page-screenshot.spec.ts` | page screenshot › should clip rect |
| `SS-006` | `page/page-screenshot.spec.ts` | page screenshot › should clip rect with fullPage |
| `SS-007` | `page/page-screenshot.spec.ts` | page screenshot › should clip elements to the viewport |
| `SS-008` | `page/page-screenshot.spec.ts` | page screenshot › should throw on clip outside the viewport |
| `SS-009` | `page/page-screenshot.spec.ts` | page screenshot › should throw on a negative clip size |
| `SS-010` | `page/page-screenshot.spec.ts` | page screenshot › should run in parallel |
| `SS-011` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots |
| `SS-012` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots and mask elements outside of it |
| `SS-013` | `page/page-screenshot.spec.ts` | page screenshot › should restore viewport after fullPage screenshot |
| `SS-014` | `page/page-screenshot.spec.ts` | page screenshot › should allow transparency |
| `SS-015` | `page/page-screenshot.spec.ts` | page screenshot › should render white background on jpeg file |
| `SS-016` | `page/page-screenshot.spec.ts` | page screenshot › should produce a valid webp screenshot |
| `SS-017` | `page/page-screenshot.spec.ts` | page screenshot › path option should detect webp |
| `SS-018` | `page/page-screenshot.spec.ts` | page screenshot › quality option should work for webp |
| `SS-019` | `page/page-screenshot.spec.ts` | page screenshot › webp screenshots should be lossless by default |
| `SS-020` | `page/page-screenshot.spec.ts` | page screenshot › should allow transparency with webp |
| `SS-021` | `page/page-screenshot.spec.ts` | page screenshot › quality option should throw for webp when out of range |
| `SS-022` | `page/page-screenshot.spec.ts` | page screenshot › should work with odd clip size on Retina displays |
| `SS-023` | `page/page-screenshot.spec.ts` | page screenshot › should work for canvas |
| `SS-024` | `page/page-screenshot.spec.ts` | page screenshot › should capture canvas changes |
| `SS-025` | `page/page-screenshot.spec.ts` | page screenshot › should work for webgl |
| `SS-026` | `page/page-screenshot.spec.ts` | page screenshot › should work for translateZ |
| `SS-027` | `page/page-screenshot.spec.ts` | page screenshot › should work while navigating |
| `SS-028` | `page/page-screenshot.spec.ts` | page screenshot › should work with iframe in shadow |
| `SS-029` | `page/page-screenshot.spec.ts` | page screenshot › path option should work |
| `SS-030` | `page/page-screenshot.spec.ts` | page screenshot › path option should create subdirectories |
| `SS-031` | `page/page-screenshot.spec.ts` | page screenshot › path option should detect jpeg |
| `SS-032` | `page/page-screenshot.spec.ts` | page screenshot › path option should throw for unsupported mime type |
| `SS-033` | `page/page-screenshot.spec.ts` | page screenshot › quality option should throw for png |
| `SS-034` | `page/page-screenshot.spec.ts` | page screenshot › zero quality option should throw for png |
| `SS-035` | `page/page-screenshot.spec.ts` | page screenshot › quality option should work for jpeg |
| `SS-036` | `page/page-screenshot.spec.ts` | page screenshot › should prefer type over extension |
| `SS-037` | `page/page-screenshot.spec.ts` | page screenshot › should not issue resize event |
| `SS-038` | `page/page-screenshot.spec.ts` | page screenshot › should work with Array deleted |
| `SS-039` | `page/page-screenshot.spec.ts` | page screenshot › should take fullPage screenshots during navigation |
| `SS-040` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work |
| `SS-041` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work with locator |
| `SS-042` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work with elementhandle |
| `SS-043` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask multiple elements |
| `SS-044` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask inside iframe |
| `SS-045` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should mask in parallel |
| `SS-046` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should remove mask after screenshot |
| `SS-047` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when subframe has stalled navigation |
| `SS-048` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when subframe used document.open after a weird url |
| `SS-049` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should work when mask color is not pink #F0F |
| `SS-050` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should hide elements based on attr |
| `SS-051` | `page/page-screenshot.spec.ts` | page screenshot › mask option › should remove elements based on attr |
| `SS-052` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture infinite css animation |
| `SS-053` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture pseudo element css animation |
| `SS-054` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture css animations in shadow DOM |
| `SS-055` | `page/page-screenshot.spec.ts` | page screenshot animations › should stop animations that happen right before screenshot |
| `SS-056` | `page/page-screenshot.spec.ts` | page screenshot animations › should resume infinite animations |
| `SS-057` | `page/page-screenshot.spec.ts` | page screenshot animations › should not capture infinite web animations |
| `SS-058` | `page/page-screenshot.spec.ts` | page screenshot animations › should fire transitionend for finite transitions |
| `SS-059` | `page/page-screenshot.spec.ts` | page screenshot animations › should capture screenshots after layoutchanges in transitionend event |
| `SS-060` | `page/page-screenshot.spec.ts` | page screenshot animations › should not change animation with playbackRate equal to 0 |
| `SS-061` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for css transitions |
| `SS-062` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for INfinite css animation |
| `SS-063` | `page/page-screenshot.spec.ts` | page screenshot animations › should trigger particular events for finite css animation |
| `SS-064` | `page/page-screenshot.spec.ts` | page screenshot animations › should wait for fonts to load |
| `SS-065` | `page/page-screenshot.spec.ts` | should throw if screenshot size is too large |
| `SS-066` | `page/page-screenshot.spec.ts` | page screenshot should capture css transform |
| `SS-067` | `page/page-screenshot.spec.ts` | should capture css box-shadow |
| `SS-068` | `library/screenshot.spec.ts` | page screenshot › should run in parallel in multiple pages |
| `SS-069` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport |
| `SS-070` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport and clip |
| `SS-071` | `library/screenshot.spec.ts` | page screenshot › should work with a mobile viewport and fullPage |
| `SS-072` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor |
| `SS-073` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor and clip |
| `SS-074` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor and scale:css |
| `SS-075` | `library/screenshot.spec.ts` | page screenshot › should produce screenshot of correct size with scale:css and null viewport |
| `SS-076` | `library/screenshot.spec.ts` | page screenshot › should work with device scale factor, clip and scale:css |
| `SS-077` | `library/screenshot.spec.ts` | page screenshot › should throw if screenshot size is too large with device scale factor |
| `SS-078` | `library/screenshot.spec.ts` | page screenshot › should work with large size |
| `SS-079` | `library/screenshot.spec.ts` | page screenshot › should handle vh units  |
| `SS-080` | `library/screenshot.spec.ts` | page screenshot › should not hang when event loop is blocked |
| `SS-081` | `library/screenshot.spec.ts` | element screenshot › element screenshot should work with a mobile viewport |
| `SS-082` | `library/screenshot.spec.ts` | element screenshot › element screenshot should work with device scale factor |
| `SS-083` | `library/screenshot.spec.ts` | element screenshot › should take screenshots when default viewport is null |
| `SS-084` | `library/screenshot.spec.ts` | element screenshot › should take fullPage screenshots when default viewport is null |
| `SS-085` | `library/screenshot.spec.ts` | element screenshot › should restore default viewport after fullPage screenshot |
| `SS-086` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after page screenshot and exception |
| `SS-087` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after page screenshot and timeout |
| `SS-088` | `library/screenshot.spec.ts` | element screenshot › should take element screenshot when default viewport is null and restore back |
| `SS-089` | `library/screenshot.spec.ts` | element screenshot › should restore viewport after element screenshot and exception |
| `SS-090` | `library/screenshot.spec.ts` | element screenshot › element screenshots should handle vh units  |
| `SS-091` | `library/screenshot.spec.ts` | element screenshot › should work if the main resource hangs |
| `SS-092` | `library/screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport with device scale factor |
| `SS-093` | `library/screenshot.spec.ts` | element screenshot › should capture full element when larger than viewport with device scale factor and scale:css |
| `SS-094` | `library/screenshot.spec.ts` | element screenshot › page screenshot should capture css transform with device pixels |
| `SS-095` | `page/page-screenshot.spec.ts` | page screenshot › should capture webgl canvas after its drawing buffer is resized |
| `SS-096` | `page/page-screenshot.spec.ts` | page screenshot › should not wait for unused font face with failed local() source |

### ST — Storage

| ID | File | Title |
|---|---|---|
| `ST-001` | `library/browsercontext-storage-state.spec.ts` | should capture local storage |
| `ST-002` | `library/browsercontext-storage-state.spec.ts` | should set local storage |
| `ST-003` | `library/browsercontext-storage-state.spec.ts` | should report good error if the url is not valid |
| `ST-004` | `library/browsercontext-storage-state.spec.ts` | should round-trip through the file |
| `ST-005` | `library/browsercontext-storage-state.spec.ts` | should round-trip OPFS |
| `ST-006` | `library/browsercontext-storage-state.spec.ts` | should capture cookies |
| `ST-007` | `library/browsercontext-storage-state.spec.ts` | should not emit events about internal page |
| `ST-008` | `library/browsercontext-storage-state.spec.ts` | should not restore localStorage twice |
| `ST-009` | `library/browsercontext-storage-state.spec.ts` | should handle missing file |
| `ST-010` | `library/browsercontext-storage-state.spec.ts` | should handle malformed file |
| `ST-011` | `library/browsercontext-storage-state.spec.ts` | should serialize storageState with lone surrogates |
| `ST-012` | `library/browsercontext-storage-state.spec.ts` | should work when service worker is intefering |
| `ST-013` | `library/browsercontext-storage-state.spec.ts` | should work when service worker is intefering and the origin is not open |
| `ST-014` | `library/browsercontext-storage-state.spec.ts` | should set local storage in third-party context |
| `ST-015` | `library/browsercontext-storage-state.spec.ts` | should roundtrip local storage in third-party context |
| `ST-016` | `library/browsercontext-storage-state.spec.ts` | should support IndexedDB |
| `ST-017` | `library/browsercontext-storage-state.spec.ts` | should roundtrip IndexedDB values and keys with {newContext, setStorageState} *(2 copies)* |
| `ST-018` | `library/browsercontext-storage-state.spec.ts` | should support empty indexedDB |
| `ST-019` | `library/browsercontext-storage-state.spec.ts` | should not leave IndexedDB connections open |
| `ST-020` | `library/browsercontext-storage-state.spec.ts` | should round-trip WebAuthn credentials with storageState |
| `ST-021` | `library/browsercontext-storage-state.spec.ts` | setStorageState should replace credentials |
| `ST-022` | `library/browsercontext-storage-state.spec.ts` | setStorageState should handle missing file |
| `ST-023` | `page/page-localstorage.spec.ts` | localStorage.items returns empty array on fresh origin |
| `ST-024` | `page/page-localstorage.spec.ts` | localStorage.getItem returns null for missing key |
| `ST-025` | `page/page-localstorage.spec.ts` | localStorage.setItem persists and surfaces in items()/getItem() |
| `ST-026` | `page/page-localstorage.spec.ts` | localStorage.setItem overwrites existing value |
| `ST-027` | `page/page-localstorage.spec.ts` | localStorage.removeItem removes a single item |
| `ST-028` | `page/page-localstorage.spec.ts` | localStorage.clear empties storage |
| `ST-029` | `page/page-localstorage.spec.ts` | sessionStorage round-trip |
| `ST-030` | `page/page-localstorage.spec.ts` | localStorage and sessionStorage are independent |
| `ST-031` | `page/page-localstorage.spec.ts` | storage methods are scoped to the current origin |
| `ST-032` | `page/page-cache-storage.spec.ts` | CacheStorage entry should survive page.reload() |

### TA — Tap

| ID | File | Title |
|---|---|---|
| `TA-001` | `library/tap.spec.ts` | should send all of the correct events @smoke |
| `TA-002` | `library/tap.spec.ts` | trial run should not tap |
| `TA-003` | `library/tap.spec.ts` | should not send mouse events touchstart is canceled |
| `TA-004` | `library/tap.spec.ts` | should not send mouse events when touchend is canceled |
| `TA-005` | `library/tap.spec.ts` | should not wait for a navigation caused by a tap |
| `TA-006` | `library/tap.spec.ts` | should work with modifiers |
| `TA-007` | `library/tap.spec.ts` | should send well formed touch points |
| `TA-008` | `library/tap.spec.ts` | should wait until an element is visible to tap it |
| `TA-009` | `library/tap.spec.ts` | locators › should send all of the correct events |
| `TA-010` | `library/locator-dispatchevent-touch.spec.ts` | should support touch points in touch event arguments |

### TO — Timeout runner

| ID | File | Title |
|---|---|---|
| `TO-001` | `library/unit/timeout-runner.spec.ts` | raceAgainstDeadline should not emit TimeoutNegativeWarning for a passed deadline |

### TR — Tracing

| ID | File | Title |
|---|---|---|
| `TR-001` | `library/tracing.spec.ts` | should collect trace with resources, but no js |
| `TR-002` | `library/tracing.spec.ts` | should use the correct title for event driven callbacks |
| `TR-003` | `library/tracing.spec.ts` | should not store secrets in context options |
| `TR-004` | `library/tracing.spec.ts` | should not collect snapshots by default |
| `TR-005` | `library/tracing.spec.ts` | should not collect action screenshots and aria snapshots by default |
| `TR-006` | `library/tracing.spec.ts` | should collect action screenshots |
| `TR-007` | `library/tracing.spec.ts` | should collect aria snapshots |
| `TR-008` | `library/tracing.spec.ts` | can call tracing.group/groupEnd at any time and auto-close |
| `TR-009` | `library/tracing.spec.ts` | should not include buffers in the trace |
| `TR-010` | `library/tracing.spec.ts` | should exclude internal pages |
| `TR-011` | `library/tracing.spec.ts` | should record context API request trace independently |
| `TR-012` | `library/tracing.spec.ts` | should collect two traces |
| `TR-013` | `library/tracing.spec.ts` | should respect tracesDir and name |
| `TR-014` | `library/tracing.spec.ts` | should not include trace resources from the previous chunks |
| `TR-015` | `library/tracing.spec.ts` | should overwrite existing file |
| `TR-016` | `library/tracing.spec.ts` | should collect sources |
| `TR-017` | `library/tracing.spec.ts` | should record network failures |
| `TR-018` | `library/tracing.spec.ts` | should recover tracing after a failed stop |
| `TR-019` | `library/tracing.spec.ts` | should release the stack session when saving the trace fails |
| `TR-020` | `library/tracing.spec.ts` | should not crash when browser closes mid-trace |
| `TR-021` | `library/tracing.spec.ts` | should survive browser.close with auto-created traces dir |
| `TR-022` | `library/tracing.spec.ts` | should not stall on dialogs |
| `TR-023` | `library/tracing.spec.ts` | should produce screencast frames {fit, crop, scale} *(3 copies)* |
| `TR-024` | `library/tracing.spec.ts` | should include interrupted actions |
| `TR-025` | `library/tracing.spec.ts` | should throw when starting with different options |
| `TR-026` | `library/tracing.spec.ts` | should throw when stopping without start |
| `TR-027` | `library/tracing.spec.ts` | should not throw when stopping without start but not exporting |
| `TR-028` | `library/tracing.spec.ts` | start should return a disposable that discards the trace |
| `TR-029` | `library/tracing.spec.ts` | startChunk should return a disposable that discards the chunk |
| `TR-030` | `library/tracing.spec.ts` | should work with multiple chunks |
| `TR-031` | `library/tracing.spec.ts` | should export trace concurrently to second navigation |
| `TR-032` | `library/tracing.spec.ts` | should not hang for clicks that open dialogs |
| `TR-033` | `library/tracing.spec.ts` | should ignore iframes in head |
| `TR-034` | `library/tracing.spec.ts` | should hide internal stack frames |
| `TR-035` | `library/tracing.spec.ts` | should hide internal stack frames in expect |
| `TR-036` | `library/tracing.spec.ts` | should record global request trace |
| `TR-037` | `library/tracing.spec.ts` | should store global request traces separately |
| `TR-038` | `library/tracing.spec.ts` | should store postData for global request |
| `TR-039` | `library/tracing.spec.ts` | should not flush console events |
| `TR-040` | `library/tracing.spec.ts` | should flush console events on tracing stop |
| `TR-041` | `library/tracing.spec.ts` | should not emit after w/o before |
| `TR-042` | `library/tracing.spec.ts` | should save trace while a WebSocket keeps streaming frames |
| `TR-043` | `library/chromium/tracing.spec.ts` | should output a trace |
| `TR-044` | `library/chromium/tracing.spec.ts` | should create directories as needed |
| `TR-045` | `library/chromium/tracing.spec.ts` | should run with custom categories if provided |
| `TR-046` | `library/chromium/tracing.spec.ts` | should throw if tracing on two pages |
| `TR-047` | `library/chromium/tracing.spec.ts` | should return a buffer |
| `TR-048` | `library/chromium/tracing.spec.ts` | should work without options |
| `TR-049` | `library/chromium/tracing.spec.ts` | should support a buffer without a path |

### TV — Trace viewer

| ID | File | Title |
|---|---|---|
| `TV-001` | `library/trace-viewer.spec.ts` | should show empty trace viewer |
| `TV-002` | `library/trace-viewer.spec.ts` | should open two trace viewers |
| `TV-003` | `library/trace-viewer.spec.ts` | should open trace viewer on specific host |
| `TV-004` | `library/trace-viewer.spec.ts` | should show tracing.group in the action list with location |
| `TV-005` | `library/trace-viewer.spec.ts` | should open simple trace viewer |
| `TV-006` | `library/trace-viewer.spec.ts` | should filter actions by text |
| `TV-007` | `library/trace-viewer.spec.ts` | should keep selected action in view after Show all |
| `TV-008` | `library/trace-viewer.spec.ts` | should activate Show all with keyboard |
| `TV-009` | `library/trace-viewer.spec.ts` | should open uncompressed trace directory |
| `TV-010` | `library/trace-viewer.spec.ts` | should show action context on locators and other common actions |
| `TV-011` | `library/trace-viewer.spec.ts` | should complain about newer version of trace in old viewer |
| `TV-012` | `library/trace-viewer.spec.ts` | should properly synchronize local and remote time |
| `TV-013` | `library/trace-viewer.spec.ts` | should contain action info |
| `TV-014` | `library/trace-viewer.spec.ts` | should render console |
| `TV-015` | `library/trace-viewer.spec.ts` | should show console source for multiple pages |
| `TV-016` | `library/trace-viewer.spec.ts` | should highlight console message on timeline on hover |
| `TV-017` | `library/trace-viewer.spec.ts` | should open console errors on click |
| `TV-018` | `library/trace-viewer.spec.ts` | should open console errors with keyboard |
| `TV-019` | `library/trace-viewer.spec.ts` | should show params and return value |
| `TV-020` | `library/trace-viewer.spec.ts` | should show null as a param |
| `TV-021` | `library/trace-viewer.spec.ts` | should truncate long return values with ellipsis but copy full value |
| `TV-022` | `library/trace-viewer.spec.ts` | should have correct snapshot size |
| `TV-023` | `library/trace-viewer.spec.ts` | should have correct stack trace |
| `TV-024` | `library/trace-viewer.spec.ts` | should have network requests |
| `TV-025` | `library/trace-viewer.spec.ts` | should attribute network requests to service workers |
| `TV-026` | `library/trace-viewer.spec.ts` | should highlight network request on timeline on hover |
| `TV-027` | `library/trace-viewer.spec.ts` | should filter network requests by resource type |
| `TV-028` | `library/trace-viewer.spec.ts` | should filter network requests by multiple resource types |
| `TV-029` | `library/trace-viewer.spec.ts` | should show font preview |
| `TV-030` | `library/trace-viewer.spec.ts` | should syntax highlight body |
| `TV-031` | `library/trace-viewer.spec.ts` | should filter network requests by url |
| `TV-032` | `library/trace-viewer.spec.ts` | should have network request overrides |
| `TV-033` | `library/trace-viewer.spec.ts` | should show canceled status for requests canceled by navigation |
| `TV-034` | `library/trace-viewer.spec.ts` | should have network request overrides 2 |
| `TV-035` | `library/trace-viewer.spec.ts` | should filter network requests by websocket type |
| `TV-036` | `library/trace-viewer.spec.ts` | should show websocket messages |
| `TV-037` | `library/trace-viewer.spec.ts` | should show snapshot URL and copy button |
| `TV-038` | `library/trace-viewer.spec.ts` | should popup snapshot |
| `TV-039` | `library/trace-viewer.spec.ts` | should capture attribute mutations inside a popup window |
| `TV-040` | `library/trace-viewer.spec.ts` | should capture iframe with sandbox attribute |
| `TV-041` | `library/trace-viewer.spec.ts` | should capture data-url svg iframe |
| `TV-042` | `library/trace-viewer.spec.ts` | should not let style text break out of the style element |
| `TV-043` | `library/trace-viewer.spec.ts` | should contain adopted style sheets |
| `TV-044` | `library/trace-viewer.spec.ts` | should work with adopted style sheets and replace/replaceSync |
| `TV-045` | `library/trace-viewer.spec.ts` | should work with adopted style sheets and all: unset |
| `TV-046` | `library/trace-viewer.spec.ts` | empty adopted style sheets should not prevent node refs |
| `TV-047` | `library/trace-viewer.spec.ts` | should work with nesting CSS selectors |
| `TV-048` | `library/trace-viewer.spec.ts` | should restore scroll positions |
| `TV-049` | `library/trace-viewer.spec.ts` | should restore control values |
| `TV-050` | `library/trace-viewer.spec.ts` | should work with meta CSP |
| `TV-051` | `library/trace-viewer.spec.ts` | should handle multiple headers |
| `TV-052` | `library/trace-viewer.spec.ts` | should handle src=blob |
| `TV-053` | `library/trace-viewer.spec.ts` | should handle file URIs |
| `TV-054` | `library/trace-viewer.spec.ts` | should preserve currentSrc |
| `TV-055` | `library/trace-viewer.spec.ts` | should register custom elements |
| `TV-056` | `library/trace-viewer.spec.ts` | should not treat synthetic shadow root as a shadow root |
| `TV-057` | `library/trace-viewer.spec.ts` | should highlight target elements |
| `TV-058` | `library/trace-viewer.spec.ts` | should highlight target element in shadow dom |
| `TV-059` | `library/trace-viewer.spec.ts` | should highlight expect failure |
| `TV-060` | `library/trace-viewer.spec.ts` | should show action source |
| `TV-061` | `library/trace-viewer.spec.ts` | should follow redirects |
| `TV-062` | `library/trace-viewer.spec.ts` | should include metainfo |
| `TV-063` | `library/trace-viewer.spec.ts` | should open v6 trace file |
| `TV-064` | `library/trace-viewer.spec.ts` | should not crash with broken locator |
| `TV-065` | `library/trace-viewer.spec.ts` | should serve overridden request |
| `TV-066` | `library/trace-viewer.spec.ts` | should display waitForLoadState even if did not wait for it |
| `TV-067` | `library/trace-viewer.spec.ts` | should display language-specific locators |
| `TV-068` | `library/trace-viewer.spec.ts` | should pick locator |
| `TV-069` | `library/trace-viewer.spec.ts` | should generate aria snapshot with unaltered urls |
| `TV-070` | `library/trace-viewer.spec.ts` | should update highlight when typing locator |
| `TV-071` | `library/trace-viewer.spec.ts` | should update highlight when typing snapshot |
| `TV-072` | `library/trace-viewer.spec.ts` | should open trace-1.31 |
| `TV-073` | `library/trace-viewer.spec.ts` | should open trace-1.37 |
| `TV-074` | `library/trace-viewer.spec.ts` | should prefer later resource request with the same method |
| `TV-075` | `library/trace-viewer.spec.ts` | should ignore 304 responses |
| `TV-076` | `library/trace-viewer.spec.ts` | should pick locator in iframe |
| `TV-077` | `library/trace-viewer.spec.ts` | should highlight locator in iframe while typing |
| `TV-078` | `library/trace-viewer.spec.ts` | should preserve noscript when javascript is disabled |
| `TV-079` | `library/trace-viewer.spec.ts` | should remove noscript by default |
| `TV-080` | `library/trace-viewer.spec.ts` | should remove noscript when javaScriptEnabled is set to true |
| `TV-081` | `library/trace-viewer.spec.ts` | should open snapshot in new browser context |
| `TV-082` | `library/trace-viewer.spec.ts` | should show similar actions from legacy library-only trace |
| `TV-083` | `library/trace-viewer.spec.ts` | should show correct request start time |
| `TV-084` | `library/trace-viewer.spec.ts` | should not record route actions |
| `TV-085` | `library/trace-viewer.spec.ts` | should not record network actions |
| `TV-086` | `library/trace-viewer.spec.ts` | should show baseURL in metadata pane |
| `TV-087` | `library/trace-viewer.spec.ts` | should not leak recorders |
| `TV-088` | `library/trace-viewer.spec.ts` | should serve css without content-type |
| `TV-089` | `library/trace-viewer.spec.ts` | canvas disabled title |
| `TV-090` | `library/trace-viewer.spec.ts` | canvas clipping |
| `TV-091` | `library/trace-viewer.spec.ts` | canvas clipping in iframe |
| `TV-092` | `library/trace-viewer.spec.ts` | should show only one pointer with multilevel iframes |
| `TV-093` | `library/trace-viewer.spec.ts` | should show a popover |
| `TV-094` | `library/trace-viewer.spec.ts` | should show a modal dialog |
| `TV-095` | `library/trace-viewer.spec.ts` | should open settings dialog |
| `TV-096` | `library/trace-viewer.spec.ts` | should toggle theme color |
| `TV-097` | `library/trace-viewer.spec.ts` | should reflect system color scheme changes in document theme |
| `TV-098` | `library/trace-viewer.spec.ts` | should toggle canvas rendering |
| `TV-099` | `library/trace-viewer.spec.ts` | should display aria mode |
| `TV-100` | `library/trace-viewer.spec.ts` | should disable aria setting when there are no aria snapshots |
| `TV-101` | `library/trace-viewer.spec.ts` | should force aria mode when there are no dom snapshots |
| `TV-102` | `library/trace-viewer.spec.ts` | should notify parent when ready to receive messages |
| `TV-103` | `library/trace-viewer.spec.ts` | should render blob trace received from opener |
| `TV-104` | `library/trace-viewer.spec.ts` | shouldn't render not-blob trace received from message |
| `TV-105` | `library/trace-viewer.spec.ts` | should not trip over complex urls in style tags |
| `TV-106` | `library/trace-viewer.spec.ts` | should render locator descriptions |
| `TV-107` | `library/trace-viewer.spec.ts` | should load trace from HTTP with progress indicator |
| `TV-108` | `library/trace-viewer.spec.ts` | should filter actions |
| `TV-109` | `library/trace-viewer.spec.ts` | should handle failed snapshots due to dialog |
| `TV-110` | `library/trace-viewer.spec.ts` | should survive service worker restart |
| `TV-111` | `library/trace-viewer.spec.ts` | should not navigate on anchor clicks |
| `TV-112` | `library/trace-viewer.spec.ts` | should respect CSSOM changes |
| `TV-113` | `library/trace-viewer.spec.ts` | should preserve custom doctype |
| `TV-114` | `library/trace-viewer.spec.ts` | should replace meta charset attr that specifies charset |
| `TV-115` | `library/trace-viewer.spec.ts` | should replace meta content attr that specifies charset |
| `TV-116` | `library/trace-viewer.spec.ts` | should drop meta http-equiv refresh during recording |
| `TV-117` | `library/trace-viewer.spec.ts` | should neutralize meta http-equiv refresh during rendering |
| `TV-118` | `library/trace-viewer.spec.ts` | snapshots should be served with a script-src policy |
| `TV-119` | `library/trace-viewer.spec.ts` | snapshot iframes should be sandboxed |
| `TV-120` | `library/trace-viewer.spec.ts` | should capture iframe with srcdoc |
| `TV-121` | `library/trace-viewer.spec.ts` | should render snapshots from the second chunk |
| `TV-122` | `library/trace-viewer.spec.ts` | take trace paths via stdin |
| `TV-123` | `library/snapshot-renderer.spec.ts` | snapshot renderer escapes attacker-controlled {callId, snapshotName} in script context *(2 copies)* |
| `TV-124` | `library/snapshot-renderer.spec.ts` | snapshot renderer nonces the bootstrap script |
| `TV-125` | `library/snapshot-renderer.spec.ts` | snapshot renderer strips event handler attributes |
| `TV-126` | `library/snapshot-renderer.spec.ts` | snapshot renderer strips onclick attributes |
| `TV-127` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes iframe srcdoc |
| `TV-128` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes iframe sandbox |
| `TV-129` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes object data attribute |
| `TV-130` | `library/snapshot-renderer.spec.ts` | snapshot renderer neutralizes embed src attribute |
| `TV-131` | `library/snapshot-renderer.spec.ts` | snapshot renderer handles case-insensitive iframe tag names |
| `TV-132` | `library/snapshot-renderer.spec.ts` | snapshot renderer drops unsafe tag names that smuggle attributes |
| `TV-133` | `library/snapshot-renderer.spec.ts` | snapshot renderer still renders ordinary custom elements |
| `TV-134` | `library/snapshot-renderer.spec.ts` | stripAnsiEscapes should not exhibit polynomial backtracking |
| `TV-135` | `library/snapshot-renderer.spec.ts` | stripAnsiEscapes handles common ANSI sequences after fix |
| `TV-136` | `library/snapshot-renderer.spec.ts` | snapshot renderer selects the nearest out-of-order screencast frame |

### TZ — Timezone

| ID | File | Title |
|---|---|---|
| `TZ-001` | `library/browsercontext-timezone-id.spec.ts` | should work @smoke |
| `TZ-002` | `library/browsercontext-timezone-id.spec.ts` | should throw for invalid timezone IDs when creating pages |
| `TZ-003` | `library/browsercontext-timezone-id.spec.ts` | should work for multiple pages sharing same process |
| `TZ-004` | `library/browsercontext-timezone-id.spec.ts` | should not change default timezone in another context |
| `TZ-005` | `library/browsercontext-timezone-id.spec.ts` | should affect Intl.DateTimeFormat().resolvedOptions().timeZone |
| `TZ-006` | `library/browsercontext-timezone-id.spec.ts` | should propagate timezone to workers |

### UA — User agent

| ID | File | Title |
|---|---|---|
| `UA-001` | `library/browsercontext-user-agent.spec.ts` | should work |
| `UA-002` | `library/browsercontext-user-agent.spec.ts` | should work for subframes |
| `UA-003` | `library/browsercontext-user-agent.spec.ts` | should emulate device user-agent |
| `UA-004` | `library/browsercontext-user-agent.spec.ts` | should make a copy of default options |
| `UA-005` | `library/browsercontext-user-agent.spec.ts` | custom user agent for download |
| `UA-006` | `library/browsercontext-user-agent.spec.ts` | should work for navigator.userAgentData and sec-ch-ua headers |
| `UA-007` | `library/browsercontext-user-agent.spec.ts` | should preserve custom user agent in route.fetch |

### VI — Video

| ID | File | Title |
|---|---|---|
| `VI-001` | `library/video.spec.ts` | screencast › should not have video by default |
| `VI-002` | `library/video.spec.ts` | screencast › should not throw without recordVideo.dir |
| `VI-003` | `library/video.spec.ts` | screencast › should capture static page |
| `VI-004` | `library/video.spec.ts` | screencast › should pad a short frame to the video size |
| `VI-005` | `library/video.spec.ts` | screencast › should continue recording main page after popup closes |
| `VI-006` | `library/video.spec.ts` | screencast › should expose video path |
| `VI-007` | `library/video.spec.ts` | screencast › should delete video |
| `VI-008` | `library/video.spec.ts` | screencast › should expose video path blank page |
| `VI-009` | `library/video.spec.ts` | screencast › should work with weird screen resolution |
| `VI-010` | `library/video.spec.ts` | screencast › should work with relative path for recordVideo.dir |
| `VI-011` | `library/video.spec.ts` | screencast › should expose video path blank popup |
| `VI-012` | `library/video.spec.ts` | screencast › should capture navigation |
| `VI-013` | `library/video.spec.ts` | screencast › should capture css transformation |
| `VI-014` | `library/video.spec.ts` | screencast › should work for popups |
| `VI-015` | `library/video.spec.ts` | screencast › should scale frames down to the requested size  |
| `VI-016` | `library/video.spec.ts` | screencast › should use viewport scaled down to fit into 800x800 as default size |
| `VI-017` | `library/video.spec.ts` | screencast › should be 800x450 by default |
| `VI-018` | `library/video.spec.ts` | screencast › should record video with the requested fps |
| `VI-019` | `library/video.spec.ts` | screencast › should throw on invalid fps |
| `VI-020` | `library/video.spec.ts` | screencast › should be 800x600 with null viewport |
| `VI-021` | `library/video.spec.ts` | screencast › should capture static page in persistent context @smoke |
| `VI-022` | `library/video.spec.ts` | screencast › should emulate an iphone |
| `VI-023` | `library/video.spec.ts` | screencast › should throw on browser close |
| `VI-024` | `library/video.spec.ts` | screencast › should throw if browser dies |
| `VI-025` | `library/video.spec.ts` | screencast › should wait for video to finish if page was closed |
| `VI-026` | `library/video.spec.ts` | screencast › should close ffmpeg even if there were no frames |
| `VI-027` | `library/video.spec.ts` | screencast › should not create video for internal pages |
| `VI-028` | `library/video.spec.ts` | screencast › should capture full viewport |
| `VI-029` | `library/video.spec.ts` | screencast › should capture full viewport on hidpi |
| `VI-030` | `library/video.spec.ts` | screencast › should work with video+trace |
| `VI-031` | `library/video.spec.ts` | should saveAs video |

### VP — Viewport

| ID | File | Title |
|---|---|---|
| `VP-001` | `library/browsercontext-viewport.spec.ts` | should get the proper default viewport size |
| `VP-002` | `library/browsercontext-viewport.spec.ts` | should set the proper viewport size |
| `VP-003` | `library/browsercontext-viewport.spec.ts` | should return correct outerWidth and outerHeight |
| `VP-004` | `library/browsercontext-viewport.spec.ts` | landscape viewport should have width larger than height |
| `VP-005` | `library/browsercontext-viewport.spec.ts` | should emulate device width |
| `VP-006` | `library/browsercontext-viewport.spec.ts` | should emulate device height |
| `VP-007` | `library/browsercontext-viewport.spec.ts` | should emulate availWidth and availHeight |
| `VP-008` | `library/browsercontext-viewport.spec.ts` | should not have touch by default |
| `VP-009` | `library/browsercontext-viewport.spec.ts` | should throw on tap if hasTouch is not enabled |
| `VP-010` | `library/browsercontext-viewport.spec.ts` | should support touch with null viewport |
| `VP-011` | `library/browsercontext-viewport.spec.ts` | should keep touch emulation after screenshot beyond viewport |
| `VP-012` | `library/browsercontext-viewport.spec.ts` | should set both screen and viewport options |
| `VP-013` | `library/browsercontext-viewport.spec.ts` | should report null viewportSize when given null viewport |
| `VP-014` | `library/browsercontext-viewport.spec.ts` | should drag with high dpi |
| `VP-015` | `library/browsercontext-viewport.spec.ts` | WebKit Windows headed should have a minimal viewport |
| `VP-016` | `library/browsercontext-viewport.spec.ts` | should be able to get correct orientation angle on non-mobile devices |
| `VP-017` | `library/browsercontext-viewport.spec.ts` | should set window.screen.orientation.type for mobile devices |

### WA — Wait for

| ID | File | Title |
|---|---|---|
| `WA-001` | `page/page-wait-for-function.spec.ts` | should timeout |
| `WA-002` | `page/page-wait-for-function.spec.ts` | should accept a string |
| `WA-003` | `page/page-wait-for-function.spec.ts` | should work when resolved right before execution context disposal |
| `WA-004` | `page/page-wait-for-function.spec.ts` | should poll on interval |
| `WA-005` | `page/page-wait-for-function.spec.ts` | should avoid side effects after timeout |
| `WA-006` | `page/page-wait-for-function.spec.ts` | should throw on polling:mutation |
| `WA-007` | `page/page-wait-for-function.spec.ts` | should poll on raf |
| `WA-008` | `page/page-wait-for-function.spec.ts` | should fail with predicate throwing on first call |
| `WA-009` | `page/page-wait-for-function.spec.ts` | should fail with predicate throwing sometimes |
| `WA-010` | `page/page-wait-for-function.spec.ts` | should fail with ReferenceError on wrong page |
| `WA-011` | `page/page-wait-for-function.spec.ts` | should work with strict CSP policy |
| `WA-012` | `page/page-wait-for-function.spec.ts` | should throw on bad polling value |
| `WA-013` | `page/page-wait-for-function.spec.ts` | should throw negative polling interval |
| `WA-014` | `page/page-wait-for-function.spec.ts` | should return the success value as a JSHandle |
| `WA-015` | `page/page-wait-for-function.spec.ts` | should return the window as a success value |
| `WA-016` | `page/page-wait-for-function.spec.ts` | should accept ElementHandle arguments |
| `WA-017` | `page/page-wait-for-function.spec.ts` | should respect timeout |
| `WA-018` | `page/page-wait-for-function.spec.ts` | should respect default timeout |
| `WA-019` | `page/page-wait-for-function.spec.ts` | should disable timeout when its set to 0 |
| `WA-020` | `page/page-wait-for-function.spec.ts` | should survive cross-process navigation |
| `WA-021` | `page/page-wait-for-function.spec.ts` | should survive navigations |
| `WA-022` | `page/page-wait-for-function.spec.ts` | should work with multiline body |
| `WA-023` | `page/page-wait-for-function.spec.ts` | should wait for predicate with arguments |
| `WA-024` | `page/page-wait-for-function.spec.ts` | should not be called after finishing successfully |
| `WA-025` | `page/page-wait-for-function.spec.ts` | should not be called after finishing unsuccessfully |
| `WA-026` | `page/page-wait-for-function.spec.ts` | should throw when frame is detached |
| `WA-027` | `page/page-wait-for-selector-1.spec.ts` | should throw on waitFor |
| `WA-028` | `page/page-wait-for-selector-1.spec.ts` | should tolerate waitFor=visible |
| `WA-029` | `page/page-wait-for-selector-1.spec.ts` | should immediately resolve promise if node exists |
| `WA-030` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should immediately resolve if node exists |
| `WA-031` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should wait |
| `WA-032` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should timeout |
| `WA-033` | `page/page-wait-for-selector-1.spec.ts` | elementHandle.waitForSelector should throw on navigation |
| `WA-034` | `page/page-wait-for-selector-1.spec.ts` | should work with removed MutationObserver |
| `WA-035` | `page/page-wait-for-selector-1.spec.ts` | should resolve promise when node is added |
| `WA-036` | `page/page-wait-for-selector-1.spec.ts` | should report logs while waiting for visible |
| `WA-037` | `page/page-wait-for-selector-1.spec.ts` | should report logs while waiting for hidden |
| `WA-038` | `page/page-wait-for-selector-1.spec.ts` | should report logs when the selector resolves to multiple elements |
| `WA-039` | `page/page-wait-for-selector-1.spec.ts` | should resolve promise when node is added in shadow dom |
| `WA-040` | `page/page-wait-for-selector-1.spec.ts` | should work when node is added through innerHTML |
| `WA-041` | `page/page-wait-for-selector-1.spec.ts` | page.waitForSelector is shortcut for main frame |
| `WA-042` | `page/page-wait-for-selector-1.spec.ts` | should run in specified frame |
| `WA-043` | `page/page-wait-for-selector-1.spec.ts` | should throw when frame is detached |
| `WA-044` | `page/page-wait-for-selector-2.spec.ts` | should survive cross-process navigation |
| `WA-045` | `page/page-wait-for-selector-2.spec.ts` | should wait for visible |
| `WA-046` | `page/page-wait-for-selector-2.spec.ts` | should not consider visible when zero-sized |
| `WA-047` | `page/page-wait-for-selector-2.spec.ts` | should wait for visible recursively |
| `WA-048` | `page/page-wait-for-selector-2.spec.ts` | should consider outside of viewport visible |
| `WA-049` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for hidden |
| `WA-050` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for display: none |
| `WA-051` | `page/page-wait-for-selector-2.spec.ts` | hidden should wait for removal |
| `WA-052` | `page/page-wait-for-selector-2.spec.ts` | should return null if waiting to hide non-existing element |
| `WA-053` | `page/page-wait-for-selector-2.spec.ts` | should respect timeout |
| `WA-054` | `page/page-wait-for-selector-2.spec.ts` | should have an error message specifically for awaiting an element to be hidden |
| `WA-055` | `page/page-wait-for-selector-2.spec.ts` | should respond to node attribute mutation |
| `WA-056` | `page/page-wait-for-selector-2.spec.ts` | should return the element handle |
| `WA-057` | `page/page-wait-for-selector-2.spec.ts` | should have correct stack trace for timeout |
| `WA-058` | `page/page-wait-for-selector-2.spec.ts` | should throw for unknown state option |
| `WA-059` | `page/page-wait-for-selector-2.spec.ts` | should throw for visibility option |
| `WA-060` | `page/page-wait-for-selector-2.spec.ts` | should throw for true state option |
| `WA-061` | `page/page-wait-for-selector-2.spec.ts` | should throw for false state option |
| `WA-062` | `page/page-wait-for-selector-2.spec.ts` | should support \>\> selector syntax |
| `WA-063` | `page/page-wait-for-selector-2.spec.ts` | should wait for detached if already detached |
| `WA-064` | `page/page-wait-for-selector-2.spec.ts` | should wait for detached |
| `WA-065` | `page/page-wait-for-selector-2.spec.ts` | should support some fancy xpath |
| `WA-066` | `page/page-wait-for-selector-2.spec.ts` | should respect timeout xpath |
| `WA-067` | `page/page-wait-for-selector-2.spec.ts` | should run in specified frame xpath |
| `WA-068` | `page/page-wait-for-selector-2.spec.ts` | should throw when frame is detached xpath |
| `WA-069` | `page/page-wait-for-selector-2.spec.ts` | should return the element handle xpath |
| `WA-070` | `page/page-wait-for-selector-2.spec.ts` | should allow you to select an element with single slash xpath |
| `WA-071` | `page/page-wait-for-selector-2.spec.ts` | should correctly handle hidden shadow host |
| `WA-072` | `page/page-wait-for-selector-2.spec.ts` | should work when navigating before node adoption |
| `WA-073` | `page/page-wait-for-selector-2.spec.ts` | should fail when navigating while on handle |
| `WA-074` | `page/page-wait-for-selector-2.spec.ts` | should fail if element handle was detached while waiting |
| `WA-075` | `page/page-wait-for-selector-2.spec.ts` | should succeed if element handle was detached while waiting for hidden |
| `WA-076` | `page/page-wait-for-selector-2.spec.ts` | should succeed if element handle was detached while waiting for detached |
| `WA-077` | `page/page-wait-for-load-state.spec.ts` | should pick up ongoing navigation |
| `WA-078` | `page/page-wait-for-load-state.spec.ts` | should respect timeout |
| `WA-079` | `page/page-wait-for-load-state.spec.ts` | should resolve immediately if loaded |
| `WA-080` | `page/page-wait-for-load-state.spec.ts` | should throw for bad state |
| `WA-081` | `page/page-wait-for-load-state.spec.ts` | should resolve immediately if load state matches |
| `WA-082` | `page/page-wait-for-load-state.spec.ts` | should work with pages that have loaded before being connected to |
| `WA-083` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of empty url popup |
| `WA-084` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of about:blank popup  |
| `WA-085` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of about:blank popup with noopener  |
| `WA-086` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of popup with network url  |
| `WA-087` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of popup with network url and noopener  |
| `WA-088` | `page/page-wait-for-load-state.spec.ts` | should work with clicking target=\_blank |
| `WA-089` | `page/page-wait-for-load-state.spec.ts` | should wait for load state of newPage |
| `WA-090` | `page/page-wait-for-load-state.spec.ts` | should resolve after popup load |
| `WA-091` | `page/page-wait-for-load-state.spec.ts` | should work for frame |
| `WA-092` | `page/page-wait-for-load-state.spec.ts` | should work with javascript: iframe |
| `WA-093` | `page/page-wait-for-load-state.spec.ts` | should work with broken data-url iframe |
| `WA-094` | `page/page-wait-for-load-state.spec.ts` | should work with broken blob-url iframe |
| `WA-095` | `page/page-wait-for-navigation.spec.ts` | should work |
| `WA-096` | `page/page-wait-for-navigation.spec.ts` | should respect timeout |
| `WA-097` | `page/page-wait-for-navigation.spec.ts` | should work with both domcontentloaded and load |
| `WA-098` | `page/page-wait-for-navigation.spec.ts` | should work with commit |
| `WA-099` | `page/page-wait-for-navigation.spec.ts` | should work with clicking on anchor links |
| `WA-100` | `page/page-wait-for-navigation.spec.ts` | should work with clicking on links which do not commit navigation |
| `WA-101` | `page/page-wait-for-navigation.spec.ts` | should work with history.pushState() |
| `WA-102` | `page/page-wait-for-navigation.spec.ts` | should work with history.replaceState() |
| `WA-103` | `page/page-wait-for-navigation.spec.ts` | should work with DOM history.back()/history.forward() |
| `WA-104` | `page/page-wait-for-navigation.spec.ts` | should work when subframe issues window.stop() |
| `WA-105` | `page/page-wait-for-navigation.spec.ts` | should work with url match |
| `WA-106` | `page/page-wait-for-navigation.spec.ts` | should work with url match for same document navigations |
| `WA-107` | `page/page-wait-for-navigation.spec.ts` | should work for cross-process navigations |
| `WA-108` | `page/page-wait-for-navigation.spec.ts` | should work on frame |
| `WA-109` | `page/page-wait-for-navigation.spec.ts` | should fail when frame detaches |
| `WA-110` | `page/page-wait-for-url.spec.ts` | should work |
| `WA-111` | `page/page-wait-for-url.spec.ts` | should respect timeout |
| `WA-112` | `page/page-wait-for-url.spec.ts` | should work with both domcontentloaded and load |
| `WA-113` | `page/page-wait-for-url.spec.ts` | should work with commit |
| `WA-114` | `page/page-wait-for-url.spec.ts` | should work with commit and about:blank |
| `WA-115` | `page/page-wait-for-url.spec.ts` | should work with clicking on anchor links |
| `WA-116` | `page/page-wait-for-url.spec.ts` | should work with history.pushState() |
| `WA-117` | `page/page-wait-for-url.spec.ts` | should work with history.replaceState() |
| `WA-118` | `page/page-wait-for-url.spec.ts` | should work with DOM history.back()/history.forward() |
| `WA-119` | `page/page-wait-for-url.spec.ts` | should work with url match for same document navigations |
| `WA-120` | `page/page-wait-for-url.spec.ts` | should work on frame |
| `WA-121` | `page/page-wait-for-request.spec.ts` | should work |
| `WA-122` | `page/page-wait-for-request.spec.ts` | should work with predicate |
| `WA-123` | `page/page-wait-for-request.spec.ts` | should respect timeout |
| `WA-124` | `page/page-wait-for-request.spec.ts` | should respect default timeout |
| `WA-125` | `page/page-wait-for-request.spec.ts` | should log the url |
| `WA-126` | `page/page-wait-for-request.spec.ts` | should work with no timeout |
| `WA-127` | `page/page-wait-for-request.spec.ts` | should work with url match |
| `WA-128` | `page/page-wait-for-request.spec.ts` | should work with url match regular expression from a different context |
| `WA-129` | `page/page-wait-for-response.spec.ts` | should work |
| `WA-130` | `page/page-wait-for-response.spec.ts` | should respect timeout |
| `WA-131` | `page/page-wait-for-response.spec.ts` | should respect default timeout |
| `WA-132` | `page/page-wait-for-response.spec.ts` | should log the url |
| `WA-133` | `page/page-wait-for-response.spec.ts` | should work with predicate |
| `WA-134` | `page/page-wait-for-response.spec.ts` | should work with async predicate |
| `WA-135` | `page/page-wait-for-response.spec.ts` | sync predicate should be only called once |
| `WA-136` | `page/page-wait-for-response.spec.ts` | should work with no timeout |

### WM — WebMCP

| ID | File | Title |
|---|---|---|
| `WM-001` | `library/webmcp.spec.ts` | should list tools registered by the page |
| `WM-002` | `library/webmcp.spec.ts` | should report no tools when the page registers none |
| `WM-003` | `library/webmcp.spec.ts` | should call a tool |
| `WM-004` | `library/webmcp.spec.ts` | should return isError results as is |
| `WM-005` | `library/webmcp.spec.ts` | should throw when the tool throws |
| `WM-006` | `library/webmcp.spec.ts` | should throw for an unknown tool |
| `WM-007` | `library/webmcp.spec.ts` | should time out when the tool does not settle |
| `WM-008` | `library/webmcp.spec.ts` | should drop tools after navigation |
| `WM-009` | `library/webmcp.spec.ts` | should list a tool registered after load |
| `WM-010` | `library/webmcp.spec.ts` | should list tools while a tool is running |
| `WM-011` | `library/webmcp.spec.ts` | should list declarative tools |
| `WM-012` | `library/webmcp.spec.ts` | should scope tools to their frame |
| `WM-013` | `library/webmcp.spec.ts` | should call same-name tools in their own frame |
| `WM-014` | `library/webmcp.spec.ts` | should list and call tools in cross-origin and nested frames |
| `WM-015` | `library/webmcp-disabled.spec.ts` | should throw when the browser was launched without WebMCP |

### WO — Workers

| ID | File | Title |
|---|---|---|
| `WO-001` | `page/workers.spec.ts` | Page.workers @smoke |
| `WO-002` | `page/workers.spec.ts` | should emit created and destroyed events |
| `WO-003` | `page/workers.spec.ts` | should reject in-flight evaluate and emit close when page closes |
| `WO-004` | `page/workers.spec.ts` | should report console logs |
| `WO-005` | `page/workers.spec.ts` | should have timestamp on worker console messages |
| `WO-006` | `page/workers.spec.ts` | should not report console logs from workers twice |
| `WO-007` | `page/workers.spec.ts` | should have JSHandles for console logs |
| `WO-008` | `page/workers.spec.ts` | should evaluate |
| `WO-009` | `page/workers.spec.ts` | should report console event on the worker |
| `WO-010` | `page/workers.spec.ts` | should report console event on the worker when not listening on page or context |
| `WO-011` | `page/workers.spec.ts` | should report errors |
| `WO-012` | `page/workers.spec.ts` | should clear upon navigation |
| `WO-013` | `page/workers.spec.ts` | should clear upon cross-process navigation |
| `WO-014` | `page/workers.spec.ts` | should attribute network activity for worker inside iframe to the iframe |
| `WO-015` | `page/workers.spec.ts` | should report network activity |
| `WO-016` | `page/workers.spec.ts` | should report network activity on worker creation |
| `WO-017` | `page/workers.spec.ts` | should report worker script as network request |
| `WO-018` | `page/workers.spec.ts` | should report worker script as network request after redirect |
| `WO-019` | `page/workers.spec.ts` | should dispatch console messages when page has workers |
| `WO-020` | `page/workers.spec.ts` | should report and intercept network from nested worker |
| `WO-021` | `page/workers.spec.ts` | should support extra http headers |
| `WO-022` | `page/workers.spec.ts` | should support offline |
| `WO-023` | `page/workers.spec.ts` | should resolve worker script allHeaders in main frame |
| `WO-024` | `page/workers.spec.ts` | should resolve worker script allHeaders in iframe |
| `WO-025` | `page/workers.spec.ts` | should resolve worker script allHeaders in nested worker inside iframe |
| `WO-026` | `library/shared-worker.spec.ts` | should survive shared worker restart |
| `WO-027` | `library/browsercontext-service-worker-policy.spec.ts` | should allow service workers by default |
| `WO-028` | `library/browsercontext-service-worker-policy.spec.ts` | should allow {literal, cache-only, network-fallback, preload-fallback} service worker navigation while offline *(4 copies)* |
| `WO-029` | `library/browsercontext-service-worker-policy.spec.ts` | block › blocks service worker registration |
| `WO-030` | `library/browsercontext-service-worker-policy.spec.ts` | block › should not throw error on about:blank |
| `WO-031` | `library/browsercontext-service-worker-policy.spec.ts` | block › should not throw error in opaque sandboxed iframe |

### WS — WebSocket

| ID | File | Title |
|---|---|---|
| `WS-001` | `library/web-socket.spec.ts` | should work @smoke |
| `WS-002` | `library/web-socket.spec.ts` | should emit close events |
| `WS-003` | `library/web-socket.spec.ts` | should emit frame events |
| `WS-004` | `library/web-socket.spec.ts` | should filter out the close events when the server closes with a message |
| `WS-005` | `library/web-socket.spec.ts` | should pass self as argument to close event |
| `WS-006` | `library/web-socket.spec.ts` | should emit binary frame events |
| `WS-007` | `library/web-socket.spec.ts` | should emit error |
| `WS-008` | `library/web-socket.spec.ts` | should not have stray error events |
| `WS-009` | `library/web-socket.spec.ts` | should reject waitForEvent on socket close |
| `WS-010` | `library/web-socket.spec.ts` | should reject waitForEvent on page close |
| `WS-011` | `library/web-socket.spec.ts` | should not tear down the page when a WebSocket is opened inside a worker |
| `WS-012` | `library/web-socket.spec.ts` | should turn off when offline |
| `WS-013` | `library/web-socket.spec.ts` | should send extra HTTP headers on WebSocket handshake |
| `WS-014` | `library/web-socket.spec.ts` | should send extra HTTP headers on WebSocket handshake from a worker |
| `WS-015` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with text message *(3 copies)* |
| `WS-016` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with binaryType=blob *(3 copies)* |
| `WS-017` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with binaryType=arraybuffer *(3 copies)* |
| `WS-018` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work when connection errors out *(3 copies)* |
| `WS-019` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with error after successful open *(3 copies)* |
| `WS-020` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with client-side close *(3 copies)* |
| `WS-021` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should pass through the required protocol *(3 copies)* |
| `WS-022` | `library/route-web-socket.spec.ts` | {no-mock, no-match, pass-through} › should work with relative WebSocket URL *(3 copies)* |
| `WS-023` | `library/route-web-socket.spec.ts` | should work with ws.close |
| `WS-024` | `library/route-web-socket.spec.ts` | should observe upstream handshake failure when connectToServer is used |
| `WS-025` | `library/route-web-socket.spec.ts` | should observe multiple concurrent routed WebSockets with connectToServer |
| `WS-026` | `library/route-web-socket.spec.ts` | should pattern match |
| `WS-027` | `library/route-web-socket.spec.ts` | should work with server |
| `WS-028` | `library/route-web-socket.spec.ts` | should work without server |
| `WS-029` | `library/route-web-socket.spec.ts` | should route WebSockets in already loaded documents |
| `WS-030` | `library/route-web-socket.spec.ts` | should emit close upon frame navigation |
| `WS-031` | `library/route-web-socket.spec.ts` | should emit close upon frame detach |
| `WS-032` | `library/route-web-socket.spec.ts` | should route on context |
| `WS-033` | `library/route-web-socket.spec.ts` | should not throw after page closure |
| `WS-034` | `library/route-web-socket.spec.ts` | should not throw with empty handler |
| `WS-035` | `library/route-web-socket.spec.ts` | should throw when connecting twice |
| `WS-036` | `library/route-web-socket.spec.ts` | should work with no trailing slash |
| `WS-037` | `library/route-web-socket.spec.ts` | should work with baseURL |
| `WS-038` | `library/route-web-socket.spec.ts` | should work with baseURL regardless of scheme casing |
| `WS-039` | `library/route-web-socket.spec.ts` | should expose protocols to the route handler |
| `WS-040` | `library/route-web-socket.spec.ts` | should expose protocols on server-side route |
