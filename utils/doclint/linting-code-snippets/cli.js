#!/usr/bin/env node
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

// @ts-check

const debug = require('debug')
const fs = require('fs');
const path = require('path');
const { parseApi } = require('../api_parser');
const md = require('../../markdown');
const { ESLint } = require('eslint')
const child_process = require('child_process');
const os = require('os');
const actions = require('@actions/core')
const { codeFrameColumns } = require('@babel/code-frame');

/** @typedef {import('../documentation').Type} Type */
/** @typedef {import('../../markdown').MarkdownNode} MarkdownNode */

const PROJECT_DIR = path.join(__dirname, '..', '..', '..');

function getAllMarkdownFiles(dirPath, filePaths = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      filePaths.push(path.join(dirPath, entry.name));
    else if (entry.isDirectory())
      getAllMarkdownFiles(path.join(dirPath, entry.name), filePaths);
  }
  return filePaths;
}

const run = async () => {
  const jsOnly = process.argv.includes('--js-only');
  const lintingServiceFactory = new LintingServiceFactory(jsOnly);
  const documentationRoot = path.join(PROJECT_DIR, 'docs', 'src');
  let documentation = parseApi(path.join(documentationRoot, 'api'));

  /** @type {CodeSnippet[]} */
  const codeSnippets = [];
  for (const filePath of getAllMarkdownFiles(documentationRoot)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    let rootNode = md.parse(data);
    // Renders links.
    documentation.renderLinksInNodes(rootNode);
    documentation.generateSourceCodeComments();
    md.visitAll(rootNode, node => {
      if (node.type !== 'code')
        return;
      const codeLang = node.codeLang.split(' ')[0];
      const code = node.lines.join('\n');
      codeSnippets.push({
        filePath,
        codeLang,
        code,
      })
    });
  }
  await lintingServiceFactory.lintAndReport(codeSnippets);
  if (jsOnly)
    return;
  const { hasErrors } = lintingServiceFactory.reportMetrics();
  if (hasErrors)
    process.exit(1);
}


/** @typedef {{ codeLang: string, code: string, filePath: string }} CodeSnippet */
/** @typedef {{ status: 'ok' | 'updated' | 'error' | 'unsupported', error?: string }} LintResult */

class LintingService {
  /**
   * @param {string} codeLang
   * @returns {boolean}
   */
  supports(codeLang) {
    throw new Error('supports() is not implemented');
  }

  async _writeTempSnippetsFile(snippets) {
    const tempFile = path.join(os.tmpdir(), `snippet-${Date.now()}.json`);
    await fs.promises.writeFile(tempFile, JSON.stringify(snippets, undefined, 2));
    return tempFile;
  }

  /**
   * @param {string} command
   * @param {string[]} args
   * @param {CodeSnippet[]} snippets
   * @param {string} cwd
   * @returns {Promise<LintResult[]>}
   */
  async spawnAsync(command, args, snippets, cwd) {
    const tempFile = await this._writeTempSnippetsFile(snippets);
    return await new Promise((fulfill, reject) => {
      const child = child_process.spawn(command, [...args, tempFile], { cwd });
      let stdout = '';
      child.on('error', reject);
      child.stdout.on('data', data => stdout += data.toString());
      child.stderr.pipe(process.stderr);
      child.on('exit', code => {
        if (code)
          reject(new Error(`${command} exited with code ${code}`));
        else
          fulfill(JSON.parse(stdout));
      });
    });
  }

  /**
   * @param {CodeSnippet[]} snippets
   * @returns {Promise<LintResult[]>}
   */
  async lint(snippets) {
    throw new Error('lint() is not implemented');
  }
}


class JSLintingService extends LintingService {
  _knownBadSnippets = [
    'mount(',
    'render(',
    'vue-router',
    'experimental-ct',
  ];

  async _init() {
    if (this._eslint)
      return this._eslint;

    const { fixupConfigRules } = await import('@eslint/compat');
    const { FlatCompat }  = await import('@eslint/eslintrc');
      // @ts-ignore
    const js = (await import('@eslint/js')).default;

    const compat = new FlatCompat({
      baseDirectory: __dirname,
      // @ts-ignore
      recommendedConfig: js.configs.recommended,
      allConfig: js.configs.all
    });
    const baseConfig = fixupConfigRules(compat.extends('plugin:react/recommended', 'plugin:@typescript-eslint/disable-type-checked'));
    const { baseRules }= await import('../../../eslint.config.mjs');

    this._eslint = new ESLint({
      baseConfig,
      plugins: /** @type {any}*/({
        '@stylistic': (await import('@stylistic/eslint-plugin')).default,
      }),
      ignore: false,
      overrideConfig: {
        files: ['**/*.ts', '**/*.tsx'],
        settings: {
          react: { version: 'detect' },
        },
        languageOptions: {
          // @ts-ignore
          parser: await import('@typescript-eslint/parser'),
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        rules: /** @type {any}*/({
          ...baseRules,
          'notice/notice': 'off',
          '@typescript-eslint/no-unused-vars': 'off',
          'max-len': ['error', { code: 100 }],
          'react/react-in-jsx-scope': 'off',
          'eol-last': 'off',
          '@typescript-eslint/consistent-type-imports': 'off',
        }),
      }
    });
    return this._eslint;
  }

  supports(codeLang) {
    return codeLang === 'js' || codeLang === 'ts';
  }

  /**
   * @param {CodeSnippet} snippet
   * @returns {Promise<LintResult>}
   */
  async _lintSnippet(snippet) {
    const eslint = await this._init();
    if (this._knownBadSnippets.some(s => snippet.code.includes(s)))
      return { status: 'ok' };
    const results = await eslint.lintText(snippet.code, { filePath: path.join(__dirname, 'file.tsx') });
    if (!results || !results.length || !results[0].messages.length)
      return { status: 'ok' };
    const result = results[0];
    const error = result.source ? results[0].messages[0].message + '\n\n' + codeFrameColumns(result.source, { start: result.messages[0] }, { highlightCode: true }) : results[0].messages[0].message;
    return { status: 'error', error };
  }

  /**
   * @param {CodeSnippet[]} snippets
   * @returns {Promise<LintResult[]>}
   */
  async lint(snippets) {
    const result = [];
    for (let i = 0; i < snippets.length; ++i)
      result.push(await this._lintSnippet(snippets[i]));
    return result;
  }
}

class PythonLintingService extends LintingService {
  supports(codeLang) {
    return codeLang === 'python' || codeLang === 'py';
  }

  async lint(snippets) {
    const result = await this.spawnAsync('python', [path.join(__dirname, 'python', 'main.py')], snippets, path.join(__dirname, 'python'))
    return result;
  }
}

class CSharpLintingService extends LintingService {
  supports(codeLang) {
    return codeLang === 'csharp';
  }

  async lint(snippets) {
    return await this.spawnAsync('dotnet', ['run', '--project', path.join(__dirname, 'csharp')], snippets, path.join(__dirname, 'csharp'))
  }
}

class JavaLintingService extends LintingService {
  supports(codeLang) {
    return codeLang === 'java';
  }

  async lint(snippets) {
    return await this.spawnAsync('java', ['-jar', path.join(__dirname, 'java', 'target', 'java-syntax-checker-1.0-SNAPSHOT.jar')], snippets, path.join(__dirname, 'java'))
  }
}

class LintingServiceFactory {
  constructor(jsOnly) {
    /** @type {LintingService[]} */
    this.services = [
      new JSLintingService(),
    ]
    if (!jsOnly) {
      this.services.push(
        new PythonLintingService(),
        new CSharpLintingService(),
        new JavaLintingService(),
      );
    }
    this._metrics = {};
    this._log = debug('linting-service');
  }

  /**
   * @param {CodeSnippet[]} allSnippets
   */
  async lintAndReport(allSnippets) {
    /** @type {Record<string, CodeSnippet[]>} */
    const groupedByLanguage = allSnippets.reduce((acc, snippet) => {
      if (!acc[snippet.codeLang])
        acc[snippet.codeLang] = [];
      acc[snippet.codeLang].push(snippet);
      return acc;
    }, {});
    for (const language in groupedByLanguage) {
      const service = this.services.find(service => service.supports(language));
      if (!service) {
        this._collectMetrics(language, {
          status: 'unsupported',
        });
        continue;
      }
      const languageSnippets = groupedByLanguage[language];
      const results = await service.lint(languageSnippets);
      if (results.length !== languageSnippets.length)
        throw new Error('Linting service returned wrong number of results');

      for (const [{ code, codeLang, filePath }, result] of /** @type {[[CodeSnippet, LintResult]]} */ (results.map((result, index) => [languageSnippets[index], result]))) {
        const { status, error } = result;
        this._collectMetrics(codeLang, result);
        if (status === 'error') {
          console.log(`${codeLang} linting error!`);
          console.log(`ERROR: ${error}`);
          console.log(`File: ${filePath}`);
          console.log(code);
          console.log('-'.repeat(80));
          if (process.env.GITHUB_ACTION)
            actions.warning(`Error: ${error}\nUnable to lint:\n${code}`, {
              title: `${codeLang} linting error`,
              file: filePath,
            });
        }
      }
    }
  }

  /**
   * @returns {{ hasErrors: boolean }}
   */
  reportMetrics() {
    console.log('Metrics:');
    const renderMetric = (metric, name) => {
      if (!metric[name])
        return '';
      return `${name}: ${metric[name]}`;
    }
    let hasErrors = false;
    const languagesOrderedByOk = Object.entries(this._metrics).sort(([langA], [langB]) => {
      return this._metrics[langB].ok - this._metrics[langA].ok
    })
    for (const [language, metrics] of languagesOrderedByOk) {
      if (metrics.error)
        hasErrors = true;
      console.log(`  ${language}: ${['ok', 'updated', 'error', 'unsupported'].map(name => renderMetric(metrics, name)).filter(Boolean).join(', ')}`)
    }
    return { hasErrors }
  }

  /**
   * @param {string} language
   * @param {LintResult} result
   */
  _collectMetrics(language, result) {
    if (!this._metrics[language])
      this._metrics[language] = { ok: 0, updated: 0, error: 0, unsupported: 0 };
    this._metrics[language][result.status]++;
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
