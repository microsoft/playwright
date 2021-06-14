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

import { TestInfo, test as base } from '../config/test-runner';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ReportFormat } from '../../src/test/reporters/json';
import rimraf from 'rimraf';
import { promisify } from 'util';

const removeFolderAsync = promisify(rimraf);

type RunResult = {
  exitCode: number,
  output: string,
  passed: number,
  failed: number,
  flaky: number,
  skipped: number,
  report: ReportFormat,
  results: any[],
};

type TSCResult = {
  output: string;
  exitCode: number;
};

type Files = { [key: string]: string | Buffer };
type Params = { [key: string]: string | number | boolean | string[] };
type Env = { [key: string]: string | number | boolean | undefined };

async function writeFiles(testInfo: TestInfo, files: Files) {
  const baseDir = testInfo.outputPath();

  const internalPath = JSON.stringify(path.join(__dirname, 'entry'));
  const headerJS = `
    const pwt = require(${internalPath});
  `;
  const headerTS = `
    import * as pwt from ${internalPath};
  `;

  const hasConfig = Object.keys(files).some(name => name.includes('.config.'));
  if (!hasConfig) {
    files = {
      ...files,
      'playwright.config.ts': `
        module.exports = { projects: [ {} ] };
      `,
    };
  }

  await Promise.all(Object.keys(files).map(async name => {
    const fullName = path.join(baseDir, name);
    await fs.promises.mkdir(path.dirname(fullName), { recursive: true });
    const isTypeScriptSourceFile = name.endsWith('ts') && !name.endsWith('d.ts');
    const header = isTypeScriptSourceFile ? headerTS : headerJS;
    if (/(spec|test)\.(js|ts)$/.test(name)) {
      const fileHeader = header + 'const { expect } = pwt;\n';
      await fs.promises.writeFile(fullName, fileHeader + files[name]);
    } else if (/\.(js|ts)$/.test(name) && !name.endsWith('d.ts')) {
      await fs.promises.writeFile(fullName, header + files[name]);
    } else {
      await fs.promises.writeFile(fullName, files[name]);
    }
  }));

  return baseDir;
}

async function runTSC(baseDir: string): Promise<TSCResult> {
  const tscProcess = spawn('npx', ['tsc', '-p', baseDir], {
    cwd: baseDir,
    shell: true,
  });
  let output = '';
  tscProcess.stderr.on('data', chunk => {
    output += String(chunk);
    if (process.env.PW_RUNNER_DEBUG)
      process.stderr.write(String(chunk));
  });
  tscProcess.stdout.on('data', chunk => {
    output += String(chunk);
    if (process.env.PW_RUNNER_DEBUG)
      process.stdout.write(String(chunk));
  });
  const status = await new Promise<number>(x => tscProcess.on('close', x));
  return {
    exitCode: status,
    output,
  };
}

async function runPlaywrightTest(baseDir: string, params: any, env: Env): Promise<RunResult> {
  const paramList = [];
  let additionalArgs = '';
  for (const key of Object.keys(params)) {
    if (key === 'args') {
      additionalArgs = params[key];
      continue;
    }
    for (const value of Array.isArray(params[key]) ? params[key] : [params[key]]) {
      const k = key.startsWith('-') ? key : '--' + key;
      paramList.push(params[key] === true ? `${k}` : `${k}=${value}`);
    }
  }
  const outputDir = path.join(baseDir, 'test-results');
  const reportFile = path.join(outputDir, 'report.json');
  const args = [path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'), 'test'];
  args.push(
      '--output=' + outputDir,
      '--reporter=dot,json',
      '--workers=2',
      ...paramList
  );
  if (additionalArgs)
    args.push(...additionalArgs);
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-test-cache-'));
  const testProcess = spawn('node', args, {
    env: {
      ...process.env,
      ...env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
      PWTEST_CACHE_DIR: cacheDir,
      PWTEST_CLI_ALLOW_TEST_COMMAND: '1',
    },
    cwd: baseDir
  });
  let output = '';
  testProcess.stderr.on('data', chunk => {
    output += String(chunk);
    if (process.env.PW_RUNNER_DEBUG)
      process.stderr.write(String(chunk));
  });
  testProcess.stdout.on('data', chunk => {
    output += String(chunk);
    if (process.env.PW_RUNNER_DEBUG)
      process.stdout.write(String(chunk));
  });
  const status = await new Promise<number>(x => testProcess.on('close', x));
  await removeFolderAsync(cacheDir);

  const outputString = output.toString();
  const summary = (re: RegExp) => {
    let result = 0;
    let match = re.exec(outputString);
    while (match) {
      result += (+match[1]);
      match = re.exec(outputString);
    }
    return result;
  };
  const passed = summary(/(\d+) passed/g);
  const failed = summary(/(\d+) failed/g);
  const flaky = summary(/(\d+) flaky/g);
  const skipped = summary(/(\d+) skipped/g);
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportFile).toString());
  } catch (e) {
    output += '\n' + e.toString();
  }

  const results = [];
  function visitSuites(suites?: ReportFormat['suites']) {
    if (!suites)
      return;
    for (const suite of suites) {
      for (const spec of suite.specs) {
        for (const test of spec.tests)
          results.push(...test.results);
      }
      visitSuites(suite.suites);
    }
  }
  if (report)
    visitSuites(report.suites);

  return {
    exitCode: status,
    output,
    passed,
    failed,
    flaky,
    skipped,
    report,
    results,
  };
}

type Fixtures = {
  writeFiles: (files: Files) => Promise<string>;
  runInlineTest: (files: Files, params?: Params, env?: Env) => Promise<RunResult>;
  runTSC: (files: Files) => Promise<TSCResult>;
};

export const test = base.extend<Fixtures>({
  writeFiles: async ({}, use, testInfo) => {
    await use(files => writeFiles(testInfo, files));
  },

  runInlineTest: async ({}, use, testInfo: TestInfo) => {
    let runResult: RunResult | undefined;
    await use(async (files: Files, params: Params = {}, env: Env = {}) => {
      const baseDir = await writeFiles(testInfo, files);
      runResult = await runPlaywrightTest(baseDir, params, env);
      return runResult;
    });
    if (testInfo.status !== testInfo.expectedStatus && runResult)
      console.log(runResult.output);
  },

  runTSC: async ({}, use, testInfo) => {
    let tscResult: TSCResult | undefined;
    await use(async files => {
      const baseDir = await writeFiles(testInfo, { 'tsconfig.json': JSON.stringify(TSCONFIG), ...files });
      tscResult = await runTSC(baseDir);
      return tscResult;
    });
    if (testInfo.status !== testInfo.expectedStatus && tscResult)
      console.log(tscResult.output);
  },
});

const TSCONFIG = {
  'compilerOptions': {
    'target': 'ESNext',
    'moduleResolution': 'node',
    'module': 'commonjs',
    'strict': true,
    'esModuleInterop': true,
    'allowSyntheticDefaultImports': true,
    'rootDir': '.',
    'lib': ['esnext', 'dom', 'DOM.Iterable']
  },
  'exclude': [
    'node_modules'
  ]
};

export { expect } from '../config/test-runner';

const asciiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAscii(str: string): string {
  return str.replace(asciiRegex, '');
}
