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
import path from 'path';
import fs from 'fs';

import { prompt } from 'enquirer';
import colors from 'ansi-colors';

import { executeCommands, createFiles, determinePackageManager, executeTemplate, Command, languagetoFileExtension, readDirRecursively } from './utils';

export type PromptOptions = {
  testDir: string,
  installGitHubActions: boolean,
  language: 'JavaScript' | 'TypeScript'
  addExamples: boolean,
  installPlaywrightDependencies: boolean,
};

const assetsDir = path.join(__dirname, '..', 'assets');
const PACKAGE_JSON_TEST_SCRIPT_CMD = 'test:e2e';

export class Generator {
  packageManager: 'npm' | 'yarn';
  constructor(private readonly rootDir: string) {
    if (!fs.existsSync(rootDir))
      fs.mkdirSync(rootDir);
    this.packageManager = determinePackageManager(this.rootDir);
  }

  async run() {
    this._printIntro();
    const answers = await this._askQuestions();
    const { files, commands } = await this._identifyChanges(answers);
    executeCommands(this.rootDir, commands);
    await createFiles(this.rootDir, files);
    this._patchGitIgnore();
    await this._patchPackageJSON(answers);
    this._printOutro(answers);
  }

  private _printIntro() {
    console.log(colors.yellow(`Getting started with writing ${colors.bold('end-to-end')} tests with ${colors.bold('Playwright')}:`));
    console.log(`Initializing project in '${path.relative(process.cwd(), this.rootDir) || '.'}'`);
  }

  private async _askQuestions() {
    if (process.env.TEST_OPTIONS)
      return JSON.parse(process.env.TEST_OPTIONS);
    return await prompt<PromptOptions>([
      {
        type: 'select',
        name: 'language',
        message: 'Do you want to use TypeScript or JavaScript?',
        choices: [
          { name: 'TypeScript' },
          { name: 'JavaScript' },
        ],
      },
      {
        type: 'text',
        name: 'testDir',
        message: 'Where to put your end-to-end tests?',
        initial: fs.existsSync(path.join(this.rootDir, 'tests')) ? 'e2e' : 'tests',
      },
      {
        type: 'confirm',
        name: 'installGitHubActions',
        message: 'Add a GitHub Actions workflow?',
        initial: true,
      },
      {
        type: 'confirm',
        name: 'installPlaywrightDependencies',
        message: 'Install Playwright operating system dependencies (requires sudo / root)?',
        initial: true,
      },
      // Avoid installing dependencies on Windows (vast majority does not run create-playwright on Windows)
      // Avoid installing dependencies on Mac (there are no dependencies)
      ...(process.platform === 'linux' ? [{
        type: 'confirm',
        name: 'addExamples',
        message: 'Add common examples which demonstrate Playwright\'s capabilities?',
        initial: true,
      }] : []),
    ]);
  }

  private async _identifyChanges(answers: PromptOptions) {
    const commands: Command[] = [];
    const files = new Map<string, string>();
    const fileExtension = languagetoFileExtension(answers.language);

    files.set(`playwright.config.${fileExtension}`, executeTemplate(this._readAsset(`playwright.config.${fileExtension}`), {
      testDir: answers.testDir,
    }));

    if (answers.installGitHubActions) {
      const githubActionsScript = executeTemplate(this._readAsset('github-actions.yml'), {
        installDepsCommand: this.packageManager === 'npm' ? 'npm ci' : 'yarn',
        runTestsCommand: commandToRunTests(this.packageManager),
      });
      files.set('.github/workflows/playwright.yml', githubActionsScript);
    }

    files.set(path.join(answers.testDir, `example.spec.${fileExtension}`), this._readAsset(`example.spec.${fileExtension}`));

    if (answers.addExamples)
      await this._collectExamples(answers, files);

    if (!fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      commands.push({
        name: `Initializing ${this.packageManager === 'yarn' ? 'Yarn' : 'NPM'} project`,
        command: this.packageManager === 'yarn' ? 'yarn init -y' : 'npm init -y',
      });
    }

    commands.push({
      name: 'Installing Playwright Test',
      command: this.packageManager === 'yarn' ? 'yarn add --dev @playwright/test' : 'npm install --save-dev @playwright/test',
    });

    commands.push({
      name: 'Downloading browsers',
      command: 'npx playwright install' + (answers.installPlaywrightDependencies ? ' --with-deps' : ''),
    });

    return { files, commands };
  }

  private _patchGitIgnore() {
    const gitIgnorePath = path.join(this.rootDir, '.gitignore');
    let gitIgnore = '';
    if (fs.existsSync(gitIgnorePath))
      gitIgnore = fs.readFileSync(gitIgnorePath, 'utf-8').trimEnd() + '\n';
    if (!gitIgnore.includes('node_modules'))
      gitIgnore += 'node_modules/\n';
    gitIgnore += 'test-results/\n';
    gitIgnore += 'playwright-report/\n';
    fs.writeFileSync(gitIgnorePath, gitIgnore);
  }

  private _readAsset(asset: string): string {
    return fs.readFileSync(path.isAbsolute(asset) ? asset : path.join(assetsDir, asset), 'utf-8');
  }

  private async _collectExamples(answers: PromptOptions, files: Map<string, string>) {
    const outDir = answers.testDir + '-examples';
    const examplesDir = path.join(assetsDir, 'examples');

    for (const example of await readDirRecursively(examplesDir)) {
      const relativePath = path.relative(examplesDir, example);
      files.set(path.join(outDir, relativePath), this._readAsset(example));
    }
  }

  private async _patchPackageJSON(answers: PromptOptions) {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
    if (!packageJSON.scripts)
      packageJSON.scripts = {};
    if (packageJSON.scripts['test']?.includes('no test specified'))
      delete packageJSON.scripts['test'];
    if (answers.addExamples)
      packageJSON.scripts['test:e2e-examples'] = `playwright test --config ${path.join(answers.testDir + '-examples', 'playwright.config.ts')}`;
    packageJSON.scripts[PACKAGE_JSON_TEST_SCRIPT_CMD] = `playwright test`;

    const files = new Map<string, string>();
    files.set('package.json', JSON.stringify(packageJSON, null, 2) + '\n'); // NPM keeps a trailing new-line
    await createFiles(this.rootDir, files, true);
  }

  private _printOutro(answers: PromptOptions) {
    console.log(colors.green('✔ Success!') + ' ' + colors.bold(`Created a Playwright Test project at ${this.rootDir}`));
    const pathToNavigate = path.relative(process.cwd(), this.rootDir);
    const prefix = pathToNavigate !== '' ? `  cd ${pathToNavigate}\n` : '';
    const exampleSpecPath = `${answers.testDir}${path.sep}example.spec.${languagetoFileExtension(answers.language)}`;
    console.log(`Inside that directory, you can run several commands:

  ${colors.cyan(commandToRunTests(this.packageManager))}
    Runs the end-to-end tests.

  ${colors.cyan(commandToRunTests(this.packageManager, '--project="Desktop Chrome"'))}
    Runs the tests only on Desktop Chrome.

  ${colors.cyan(commandToRunTests(this.packageManager, exampleSpecPath))}
    Runs the tests of a specific file.

  ${colors.cyan(`${commandToRunTests(this.packageManager, '--debug')}`)}
    Runs the tests in debug mode.

We suggest that you begin by typing:

${colors.cyan(prefix + '  ' + commandToRunTests(this.packageManager))}

And check out the following files:
  - ./${pathToNavigate ? pathToNavigate + '/' : ''}${exampleSpecPath} - Example end-to-end test
  - ./${pathToNavigate ? pathToNavigate + '/' : ''}playwright.config.${languagetoFileExtension(answers.language)} - Playwright Test configuration

Visit https://playwright.dev/docs/intro for more information. ✨

Happy hacking! 🎭`);
  }
}

export function commandToRunTests(packageManager: 'npm' | 'yarn', args?: string) {
  if (packageManager === 'yarn')
    return `yarn ${PACKAGE_JSON_TEST_SCRIPT_CMD}${args ? (' ' + args) : ''}`;
  return `npm run ${PACKAGE_JSON_TEST_SCRIPT_CMD}${args ? (' -- ' + args) : ''}`;
}

