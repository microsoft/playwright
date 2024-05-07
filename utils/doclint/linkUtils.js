/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** @typedef {'Types'|'ReleaseNotesMd'} OutputType */

// @ts-check
const toKebabCase = require('lodash/kebabCase.js')
const Documentation = require('./documentation');

function createMarkdownLink(languagePath, member, text) {
  const className = toKebabCase(member.clazz.name);
  const memberName = toKebabCase(member.name);
  let hash = null;
  if (member.kind === 'property' || member.kind === 'method')
    hash = `${className}-${memberName}`.toLowerCase();
  else if (member.kind === 'event')
    hash = `${className}-event-${memberName}`.toLowerCase();
  return `[${text}](https://playwright.dev${languagePath}/docs/api/class-${member.clazz.name.toLowerCase()}#${hash})`;
};

/**
 * @param {string} languagePath
 * @param {Documentation.Class} clazz
 * @returns {string}
 */
function createClassMarkdownLink(languagePath, clazz) {
  return `[${clazz.name}](https://playwright.dev${languagePath}/docs/api/class-${clazz.name.toLowerCase()})`;
};

/**
 * @param {string} language 
 * @param {OutputType} outputType
 * @returns {Documentation.Renderer}
 */
function docsLinkRendererForLanguage(language, outputType) {
  const languagePath = languageToRelativeDocsPath(language);
  return ({ clazz, member, param, option }) => {
    if (param)
      return `\`${param}\``;
    if (option)
      return `\`${option}\``;
    if (clazz) {
      if (outputType === 'Types')
        return `{@link ${clazz.name}}`;
      if (outputType === 'ReleaseNotesMd')
        return createClassMarkdownLink(languagePath, clazz);
      throw new Error(`Unexpected output type ${outputType}`);
    }
    if (!member || !member.clazz)
      throw new Error('Internal error');
    const className = member.clazz.varName === 'playwrightAssertions' ? '' : member.clazz.varName + '.';
    if (member.kind === 'method') {
      const args = outputType === 'ReleaseNotesMd' ? '' : renderJSSignature(member.argsArray);
      return createMarkdownLink(languagePath, member, `${formatClassName(className, language)}${member.alias}(${args})`);
    }
    if (member.kind === 'event')
      return createMarkdownLink(languagePath, member, `${className}on('${member.alias.toLowerCase()}')`);
    if (member.kind === 'property')
      return createMarkdownLink(languagePath, member, `${className}${member.alias}`);
    throw new Error('Unknown member kind ' + member.kind);
  }
}

function languageToRelativeDocsPath(language) {
  if (language === 'js')
    return '';
  if (language === 'csharp')
    return '/dotnet';
  if (language === 'python')
    return '/python';
  if (language === 'java')
    return '/java';
  throw new Error('Unexpected language ' + language);
}

function formatClassName(className, language) {
  if (!className.endsWith('Assertions.'))
    return className;
  className = className.substring(0, className.length - 1)
  if (language === 'js')
    return `expect(${assertionArgument(className)}).`;
  else if (language === 'csharp')
    return `Expect(${assertionArgument(className)}).`;
  else if (language === 'python')
    return `expect(${assertionArgument(className)}).`;
  else if (language === 'java')
    return `assertThat(${assertionArgument(className)}).`;
  throw new Error('Unexpected language ' + language);
}

function assertionArgument(className) {
  switch (className.toLowerCase()) {
    case 'locatorassertions': return 'locator';
    case 'pageassertions': return 'page';
    case 'genericassertions': return 'value';
    case 'snapshotassertions': return 'value';
    case 'apiresponseassertions': return 'response';
  }
  throw new Error(`Unexpected assertion class: ${className}`);
}

/**
 * @param {Documentation.Member[]} args
 */
function renderJSSignature(args) {
  const tokens = [];
  let hasOptional = false;
  for (const arg of args) {
    const name = arg.alias;
    const optional = !arg.required;
    if (tokens.length) {
      if (optional && !hasOptional)
        tokens.push(`[, ${name}`);
      else
        tokens.push(`, ${name}`);
    } else {
      if (optional && !hasOptional)
        tokens.push(`[${name}`);
      else
        tokens.push(`${name}`);
    }
    hasOptional = hasOptional || optional;
  }
  if (hasOptional)
    tokens.push(']');
  return tokens.join('');
}

/**
 * @param {string} content
 * @param {string} languagePath
 * @param {string} relativePath
 * @returns {string}
 */
function renderPlaywrightDevLinks(content, languagePath, relativePath) {
  return content.replace(/\[([^\]]+)\]\((\.[^\)]+)\)/g, (match, p1, p2) => {
    return `[${p1}](${new URL(p2.replace('.md', ''), `https://playwright.dev${languagePath}/docs${relativePath}/`).toString()})`;
  });
}

module.exports = {
  docsLinkRendererForLanguage,
  renderPlaywrightDevLinks,
  languageToRelativeDocsPath,
}