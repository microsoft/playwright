# Playwright
[![npm version](https://img.shields.io/npm/v/playwright.svg?style=flat)](https://www.npmjs.com/package/playwright) <!-- GEN:chromium-version-badge-if-release -->[![Chromium version](https://img.shields.io/badge/chromium-82.0.4057.0-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)<!-- GEN:stop --> <!-- GEN:firefox-version-badge-if-release -->[![Firefox version](https://img.shields.io/badge/firefox-73.0b13-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)<!-- GEN:stop --> [![WebKit version](https://img.shields.io/badge/webkit-13.0.4-blue.svg?logo=safari)](https://webkit.org/) [![Join Slack](https://img.shields.io/badge/join-slack-infomational)](https://join.slack.com/t/playwright/shared_invite/enQtOTEyMTUxMzgxMjIwLThjMDUxZmIyNTRiMTJjNjIyMzdmZDA3MTQxZWUwZTFjZjQwNGYxZGM5MzRmNzZlMWI5ZWUyOTkzMjE5Njg1NDg)

###### [API](https://github.com/microsoft/playwright/blob/v0.11.1/docs/api.md) | [Changelog](https://github.com/microsoft/playwright/releases) | [FAQ](#faq) | [Contributing](#contributing)


Playwright is a Node library to automate the [Chromium](https://www.chromium.org/Home), [WebKit](https://webkit.org/) and [Firefox](https://www.mozilla.org/en-US/firefox/new/) browsers with a single API. It enables **cross-browser** web automation that is **ever-green**, **capable**, **reliable** and **fast**.

|          | ver | Linux | macOS | Win |
|   ---:   | :---: | :---: | :---:  | :---: |
| Chromium| <!-- GEN:chromium-version-if-release-->82.0.4057.0<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| WebKit | 13.0.4 | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Firefox | <!-- GEN:firefox-version-if-release -->73.0b13<!-- GEN:stop --> | :white_check_mark: | :white_check_mark: | :white_check_mark: |
- Headless is supported for all the browsers on all platforms.


Our primary goal with Playwright is to improve automated UI testing by eliminating flakiness, improving the speed of execution and offering insights into the browser operation.

### Installation

```
npm i playwright
```

This installs Playwright along with its dependencies and the browser binaries. Browser binaries are about 50-100MB each, so expect the installation network traffic to be substantial.

### Usage

Playwright can be used to create a browser instance, open pages, and then manipulate them. See [API docs](https://github.com/microsoft/playwright/blob/master/docs/api.md) for a comprehensive list.

### Examples

#### Page screenshot

This code snippet navigates to whatsmyuseragent.org in Chromium, Firefox and WebKit, and saves 3 screenshots.

```js
const playwright = require('playwright');

(async () => {
  for (const browserType of ['chromium', 'firefox', 'webkit']) {
    const browser = await playwright[browserType].launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://whatsmyuseragent.org/');
    await page.screenshot({ path: `example-${browserType}.png` });
    await browser.close();
  }
})();
```

#### Mobile and geolocation

This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.

```js
const { webkit, devices } = require('playwright');
const iPhone11 = devices['iPhone 11 Pro'];

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone11.viewport,
    userAgent: iPhone11.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });
  const page = await context.newPage();
  await page.goto('https://maps.google.com');
  await page.click('text="Your location"');
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
  await browser.close();
})();
```

#### Evaluate in browser context

This code snippet navigates to example.com in Firefox, and executes a script in the page context.

```js
const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.example.com/');
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    }
  })
  console.log(dimensions);

  await browser.close();
})();
```

#### Intercept network requests

This code snippet sets up request routing for a WebKit page to log all network requests.

```js
const { webkit } = require('playwright');

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log and continue all network requests
  page.route('**', route => {
    console.log(route.request().url());
    route.continue();
  });

  await page.goto('http://todomvc.com');
  await browser.close();
})();
```

## Contributing

Check out our [contributing guide](https://github.com/microsoft/playwright/blob/master/CONTRIBUTING.md).

## FAQ

### Q: Can I use a single API to automate different browsers?

Yes, you can. See [Browser](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-browser) in the API reference for the common set of APIs across Chromium, Firefox and WebKit. A small set of features are specific to browsers, for example see [ChromiumBrowser](https://github.com/microsoft/playwright/blob/master/docs/api.md#class-chromiumbrowser).

### Q: How does Playwright relate to [Puppeteer](https://github.com/puppeteer/puppeteer)?

Puppeteer is a Node library which provides a high-level API to control Chrome or Chromium over the DevTools Protocol. Puppeteer project is active and is maintained by Google.

We are the same team that originally built Puppeteer at Google, but has since then moved on. Puppeteer proved that there is a lot of interest in the new generation of ever-green, capable and reliable automation drivers. With Playwright, we'd like to take it one step further and offer the same functionality for **all** the popular rendering engines. We'd like to see Playwright vendor-neutral and shared governed.

With Playwright, we are making the APIs more testing-friendly as well. We are taking the lessons learned from Puppeteer and incorporate them into the API, for example, user agent / device emulation is set up consistently on the `BrowserContext` level to enable multi-page scenarios, `click` waits for the element to be available and visible by default, there is a way to wait for network and other events, etc.

Playwright also aims at being cloud-native. Rather than a single page, `BrowserContext` abstraction is now central to the library operation. `BrowserContext`s are isolated, they can be either created locally or provided as a service.

All the changes and improvements above would require breaking changes to the Puppeteer API, so we chose to start with a clean slate instead. Due to the similarity of the concepts and the APIs, migration between the two should be a mechanical task.

### Q: What about the [WebDriver](https://www.w3.org/TR/webdriver/)?

We recognize WebDriver as a universal standard for the web automation and testing. At the same time we were excited to see Puppeteer affect the WebDriver agenda, steer it towards the bi-directional communication channel, etc. We hope that Playwright can take it further and pioneer support for numerous PWA features across the browsers as they emerge:

- [*capabilities*] With Playwright, we aim at providing a more capable driver, including support for [mobile viewports](https://developer.mozilla.org/en-US/docs/Mozilla/Mobile/Viewport_meta_tag), [touch](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events), [web](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) & [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [csp](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [cookie policies](https://web.dev/samesite-cookies-explained/), [permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility), etc.

- [*ergonomics*] We continue the trend set with Puppeteer and provide ergonomically-sound APIs for frames, workers, handles, etc.

- [*reliability*] With Playwright, we encourage `setTimeout`-free automation. The notion of the wall time is incompatible with the operation in the cloud / CI. It is a major source of flakiness and pain and we would like to provide an alternative. With that, Playwright aims at providing sufficient amount of events based on the browser instrumentation to make it possible.

### Q: What browser versions does Playwright use?

Playwright **does not patch the rendering engines**. It either uses stock versions of the browsers (Chromium) or extends remote debugging protocols of the respective browsers (WebKit, Firefox) for better automation. There are no changes to the actual rendering engines, network stacks, etc. Our browsers are as pure as they can be.

- *Chromium*: Playwright uses upstream versions of Chromium. When we need changes in the browser, they go into the browser directly and then we roll our dependency to that version of Chromium. As of today, we update Chromium as needed or at least once a month. We plan to synchronize our npm release cycle with the Chromium stable channel cadence.

- *WebKit*: Playwright extends `WebKit`'s remote debugging protocol to expose additional capabilities to the driver. There are no other changes to the rendering engine, it is pure `WebCore` in `WebKit2` engine. We strip debugging features from the WebKit's `Minibrowser` embedder and make it work headlessly. We use `WebKit2` in a modern process isolation mode, enable mobile viewport, touch and geolocation on non-iOS platforms to be as close to WebKit on non-iOS as one can be.

  We continuously upload our patches to WebKit for upstream review and would like to switch to the upstream-first mode of operation once we land most critical changes. Before new extensions to the remote debugging hit upstream they can be found in the `browser_patches/webkit` folder.

- *Firefox*: Playwright makes a number of modifications to Firefox's debugging channel as well. Same as above, no changes to the rendering engine itself. Those are adding support for content script debugging, workers, CSP, emulation, network interception, etc. etc.

  Similarly to WebKit, we'd like to offer all of those for review upstream, for now they can be found in the `browser_patches/firefox` folder.

### Q: Does Playwright support new Microsoft Edge?

The new Microsoft Edge browser is based on Chromium, so Playwright supports it.

### Q: Is Playwright ready?

Playwright is ready for your feedback. It respects [semver](https://semver.org/), so please expect some API breakages as we release 1.0. All we can promise is that those breakages are going to be based on your feedback with the sole purpose of making our APIs better.

Playwright is being actively developed as we get to the feature parity across Chromium, Firefox and WebKit. Progress on each browser can be tracked on the [Is Playwright Ready?](https://aslushnikov.github.io/isplaywrightready/) page, which shows currently failing tests per browser.

## Resources

* [Get started with examples](docs/examples/README.md)
* [API documentation](docs/api.md)
* [Getting started on CI](docs/ci.md)
* [Community showcase](docs/showcase.md)


                                Apache License
                           Version 2.0, January 2004
                        https://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2020 Rolando Gopez Lacuata.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       https://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

