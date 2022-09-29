---
id: architecture
title: Architecture
---

Ever wonder how `await page.locator('text=Login').click()` works? This document intends to explain a bit about how Playwright works under the hood in case you've been curious! However, Playwright's approach to ergonomic, easy-to-use APIs along with excellent docs and guides means reading this particular document is totally optional. Most of the time, you don't have to think about how Playwright works at all—it just works and provides an near-native feeling API regardless of the programming language you're using!

## Components

<img width="1369" alt="Playwright Architecture" src="https://user-images.githubusercontent.com/11915034/193140470-ff79a9e4-6e03-443d-9a90-2ae7097b9cbf.png" />

Playwright is composed of roughly 3 components:

1. _Userland Library+Client_: Code closest to you (an end-user). You write library code like [`method: BrowserContext.newPage`], [`method: Page.title`], or [`method: Locator.click`] that can almost appear as it never leaves the language of your choice, but in reality there is some lightweight state and object (e.g. Page) implementation in the _Client_, and then the core implementation is left to the layers below. 
1. _Playwright Core Driver_: A universal Node.js layer that sends and receives a custom JSON Playwright Protocol with the _Userland Library+Client_ (e.g. roughly `{ "method": "click", "params": { "selector": "text=Get Started", "strict": true } }`) to (1) carry out the actions or (2) update the _Userland Library+Client_ of new events and objects to mirror (like a Page or Network Request). The   _Playwright Core Driver_ layer is also responsible for taking the abstract Playwright commands and carrying out any Third-Party browser-specific tasks to complete the commands. In practice, this means the _Playwright Core Driver_ then goes on to communicate with each of the major browser over their own debug protocols.
1. _Third-Party Browsers_

TODO