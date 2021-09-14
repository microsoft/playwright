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

import { executeCommands, createFiles, determinePackageManager, executeTemplate, determineRootDir, Command } from './utils';

export type PromptOptions = {
  testDir: string,
  installGitHubActions: boolean,
  language: 'JavaScript' | 'TypeScript'
};

class Generator {
  packageManager: 'npm' | 'yarn';
  constructor(private readonly rootDir: string) {
    if (!fs.existsSync(rootDir))
      fs.mkdirSync(rootDir);
    this.packageManager = determinePackageManager(this.rootDir);
  }

  async run() {
    this._printIntro();
    const questions = await this._askQuestions();
    const { files, commands } = await this._identifyChanges(questions);
    executeCommands(this.rootDir, commands);
    await createFiles(this.rootDir, files);
    await this._patchPackageJSON();
    this._printOutro();
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
        initial: 'e2e'
      },
      {
        type: 'confirm',
        name: 'installGitHubActions',
        message: 'Add a GitHub Actions workflow?',
        initial: true,
      },
    ]);
  }

  private async _identifyChanges(options: PromptOptions) {
    const commands: Command[] = [];
    const files = new Map<string, string>();
    const fileExtension = options.language === 'JavaScript' ? 'js' : 'ts';

    files.set(`playwright.config.${fileExtension}`, executeTemplate(this._readAsset(`playwright.config.${fileExtension}`), {
      testDir: options.testDir,
    }));

    if (options.installGitHubActions) {
      const githubActionsScript = executeTemplate(this._readAsset('github-actions.yml'), {
        installDepsCommand: this.packageManager === 'npm' ? 'npm ci' : 'yarn',
        runTestsCommand: commandToRunTests(this.packageManager),
      });
      files.set('.github/workflows/playwright.yml', githubActionsScript);
    }

    files.set(path.join(options.testDir, `example.spec.${fileExtension}`), this._readAsset(`example.spec.${fileExtension}`));

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
      command: 'npx playwright install --with-deps',
    });

    let gitIgnore = '';
    if (fs.existsSync(path.join(this.rootDir, '.gitignore')))
      gitIgnore = fs.readFileSync(path.join(this.rootDir, '.gitignore'), 'utf-8').trimEnd() + '\n';
    gitIgnore += 'test-results/\n';
    files.set('.gitignore', gitIgnore);

    return { files, commands };
  }

  private _readAsset(asset: string): string {
    const assetsDir = path.join(__dirname, '..', 'assets');
    return fs.readFileSync(path.join(assetsDir, asset), 'utf-8');
  }

  private async _patchPackageJSON() {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
    if (!packageJSON.scripts)
      packageJSON.scripts = {};
    packageJSON.scripts['playwright-tests'] = `playwright test`;

    const files = new Map<string, string>();
    files.set('package.json', JSON.stringify(packageJSON, null, 2));
    await createFiles(this.rootDir, files, true);
  }

  private _printOutro() {
    console.log(colors.green('✔'), colors.bold('Successfully initialized your Playwright Test project!'));
    const pathToNavigate = path.relative(process.cwd(), this.rootDir);
    const prefix = pathToNavigate !== '' ? `- cd ${pathToNavigate}\n` : '';
    console.log(colors.bold('🎭 Try it out with:\n') + colors.greenBright(prefix + '- ' + commandToRunTests(this.packageManager)));
    console.log('Visit https://playwright.dev/docs/intro for more information');
  }
}

export function commandToRunTests(packageManager: 'npm' | 'yarn') {
  if (packageManager === 'yarn')
    return 'yarn playwright-tests';
  return 'npm run playwright-tests';
}

(async () => {
  const rootDir = determineRootDir();
  const generator = new Generator(rootDir);
  await generator.run();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
