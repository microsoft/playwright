# Why choose Playwright?

This guide lists the things to consider while deciding on a test automation tool and 

<!-- GEN:toc-top-level -->
- [Browsers and platforms to test on](#browsers-and-platforms-to-test-on)
- [Speed and reliability](#speed-and-reliability)
- [Automation capabilities](#automation-capabilities)
- [Authoring and debugging experience](#authoring-and-debugging-experience)
- [Deploy tests to CI](#deploy-tests-to-ci)
<!-- GEN:stop -->

## Supported browsers
* Support for Chromium, Firefox and WebKit
  * This covers all modern browser engines, including Apple Safari via WebKit
  * Playwright WebKit can run across all platforms: macOS, Windows, Linux
* Device emulation for mobile tests

## Speed and reliability
* Timeout-free automation
  * Event-driven architecture that listens to browser events
  * No polling for browser state
* Auto-wait APIs for additional reliability
* Selectors that are easier to maintain
  * (Not tied to DOM structure, like xpath)

## Automation capabilities
* Unconstrained automation, with no trade-offs
  * Out-of-process automation driver that is not constrained by JS-in-page scope
* Lean test isolation with browser contexts
* Network interception
* Newer web features
  * Components

## Authoring and debugging experience
* TypeScript support
* VS Code debugger integration
* Language bindings for Python and C#

## Deploy tests to CI
* First-party Docker image and GitHub Actions to use CI as test runtime
