/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {runCommands} = require('.');
const Source = require('../Source');
const { fixtures } = require('@playwright/test-runner');
const { describe, it, expect } = fixtures;

describe('runCommands', function() {
  const OPTIONS_REL = {
    libversion: '1.3.0',
    chromiumVersion: '80.0.4004.0',
    firefoxVersion: '73.0b3',
  };
  const OPTIONS_DEV = {
    libversion: '1.3.0-post',
    chromiumVersion: '<CRVERSION>',
    firefoxVersion: '<FFVERSION>',
  };
  it('should throw for unknown command', function() {
    const source = new Source('doc.md', `
      <!-- gen:unknown-command -->something<!-- gen:stop -->
    `);
    const messages = runCommands([source], OPTIONS_REL);
    expect(source.hasUpdatedText()).toBe(false);
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe('error');
    expect(messages[0].text).toContain('Unknown command');
  });
  describe('gen:version', function() {
    it('should work', function() {
      const source = new Source('doc.md', `
        Playwright <!-- gen:version -->XXX<!-- gen:stop -->
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`
        Playwright <!-- gen:version -->v1.3.0<!-- gen:stop -->
      `);
    });
    it('should work for pre-release versions', function() {
      const source = new Source('doc.md', `
        Playwright <!-- gen:version -->XXX<!-- gen:stop -->
      `);
      const messages = runCommands([source], OPTIONS_DEV);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`
        Playwright <!-- gen:version -->Tip-Of-Tree<!-- gen:stop -->
      `);
    });
    it('should tolerate different writing', function() {
      const source = new Source('doc.md', `Playwright v<!--   gEn:version -->WHAT
<!--     GEN:stop   -->`);
      runCommands([source], OPTIONS_REL);
      expect(source.text()).toBe(`Playwright v<!--   gEn:version -->v1.3.0<!--     GEN:stop   -->`);
    });
    it('should not tolerate missing gen:stop', function() {
      const source = new Source('doc.md', `<!--GEN:version-->`);
      const messages = runCommands([source], OPTIONS_REL);
      expect(source.hasUpdatedText()).toBe(false);
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('error');
      expect(messages[0].text).toContain(`Failed to find 'gen:stop'`);
    });
  });
  describe('gen:toc', function() {
    it('should work', () => {
      const source = new Source('doc.md', `<!-- gen:toc -->XXX<!-- gen:stop -->
        ### class: page
        #### page.$
        #### page.$$`);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`<!-- gen:toc -->
- [class: page](#class-page)
  * [page.$](#page)
  * [page.$$](#page-1)
<!-- gen:stop -->
        ### class: page
        #### page.$
        #### page.$$`);
    });
    it('should work with code blocks', () => {
      const source = new Source('doc.md', `<!-- gen:toc -->XXX<!-- gen:stop -->
        ### class: page

        \`\`\`bash
        # yo comment
        \`\`\`
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`<!-- gen:toc -->
- [class: page](#class-page)
<!-- gen:stop -->
        ### class: page

        \`\`\`bash
        # yo comment
        \`\`\`
      `);
    });
    it('should work with links in titles', () => {
      const source = new Source('doc.md', `<!-- gen:toc -->XXX<!-- gen:stop -->
        ### some [link](#foobar) here
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`<!-- gen:toc -->
- [some link here](#some-link-here)
<!-- gen:stop -->
        ### some [link](#foobar) here
      `);
    });
    it('should be able to create sub-table-of-contents', () => {
      const source = new Source('doc.md', `
        ## First
        <!-- gen:toc -->XXX<!-- gen:stop -->
        ### first.1
        ### first.2
        #### first.2.1
        ## Second
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`
        ## First
        <!-- gen:toc -->
- [first.1](#first1)
- [first.2](#first2)
  * [first.2.1](#first21)
<!-- gen:stop -->
        ### first.1
        ### first.2
        #### first.2.1
        ## Second
      `);
    });
  });
  it('should work with multiple commands', function() {
    const source = new Source('doc.md', `
      <!-- gen:version -->xxx<!-- gen:stop -->
      <!-- gen:version -->zzz<!-- gen:stop -->
    `);
    const messages = runCommands([source], OPTIONS_REL);
    expect(messages.length).toBe(0);
    expect(source.hasUpdatedText()).toBe(true);
    expect(source.text()).toBe(`
      <!-- gen:version -->v1.3.0<!-- gen:stop -->
      <!-- gen:version -->v1.3.0<!-- gen:stop -->
    `);
  });
  describe('gen:chromium-version', function() {
    it('should work', function() {
      const source = new Source('doc.md', `
        Playwright <!-- gen:chromium-version -->XXX<!-- gen:stop -->
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`
        Playwright <!-- gen:chromium-version -->80.0.4004.0<!-- gen:stop -->
      `);
    });
  });
  describe('gen:firefox-version', function() {
    it('should work', function() {
      const source = new Source('doc.md', `
        Playwright <!-- gen:firefox-version -->XXX<!-- gen:stop -->
      `);
      const messages = runCommands([source], OPTIONS_REL);
      expect(messages.length).toBe(0);
      expect(source.hasUpdatedText()).toBe(true);
      expect(source.text()).toBe(`
        Playwright <!-- gen:firefox-version -->73.0b3<!-- gen:stop -->
      `);
    });
  });
});

