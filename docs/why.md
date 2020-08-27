# Key differentiators

This guide covers key differentiators for Playwright to help you decide on the right tool for your automated tests.

<!-- GEN:toc-top-level -->
- [Browsers and platforms to test on](#browsers-and-platforms-to-test-on)
- [Speed and reliability](#speed-and-reliability)
- [Automation capabilities](#automation-capabilities)
- [Authoring and debugging experience](#authoring-and-debugging-experience)
- [Deploy tests to CI](#deploy-tests-to-ci)
<!-- GEN:stop -->

## Support for all browsers
* Support for all modern browser engines: Chromium, Firefox and WebKit
  * Chromium is used in Google Chrome and Microsoft Edge
  * WebKit is used in Apple Safari
  * Cross-platform WebKit builds: Test Safari rendering on Windows or Linux environments
* **Mobile testing** with device emulation
  * Playwright can test responsive web apps with [emulation](emulation.md).
* Headless and headful execution

## Fast and reliable execution
* Timeout-free automation
  * Event-driven architecture that listens to browser events
  * No polling for browser state
* Auto-wait APIs for additional reliability
* Selectors that are easier to maintain
  * (Not tied to DOM structure, like xpath)

## Superior automation capabilities
* Unconstrained automation, with no trade-offs
  * Out-of-process automation driver that is not constrained by JS-in-page scope
* Multiple page emulation 
* Lean test isolation with browser contexts
* Network interception
  * Context wide request interception 
* Newer web features
  * Components/Shadow DOM
* Chrome OOPIFs

## Integrations with your tools
* Built-in support for **TypeScript**
* One-command installation
* VS Code debugger integration
* First-party Docker image and GitHub Actions to use CI as test runtime
* Language bindings for Python and C#
