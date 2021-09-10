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
import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import colors from 'ansi-colors';
import JSON5 from 'json5';

const assetsDir = path.join(__dirname, '..', 'assets');

type BrowserType = 'chromium' | 'firefox' | 'webkit';

type PrompOptions = {
  testDir: string,
  installGitHubActions: string,
  browsers: BrowserType[]
};

async function main() {
  const rootDir = determineRootDir();
  console.log(colors.yellow(`Getting started with writing ${colors.bold('end-to-end')} tests with ${colors.bold('Playwright')}:`));
  console.log(`Initializing project in '${path.relative(process.cwd(), rootDir) || '.'}'`);
  const options = await prompt<PrompOptions>([
    {
      type: 'text',
      name: 'testDir',
      message: 'Where to put your end-to-end tests?',
      initial: 'e2e'
    },
    {
      type: 'confirm',
      name: 'installGitHubActions',
      message: 'Add GitHub Actions workflow?',
      initial: true,
    },
    {
      type: 'multiselect',
      name: 'browsers',
      message: 'Select which browsers you want to test against',
      choices: [
        { name: 'chromium', hint: 'Chromium' },
        { name: 'firefox', hint: 'Firefox' },
        { name: 'webkit', hint: 'Safari' },
      ],
      // @ts-ignore
      initial: ['chromium', 'firefox', 'webkit']
    },
  ]);

  const commands: string[] = [];
  const files = new Map<string, string>();

  if (!fs.existsSync(rootDir))
    fs.mkdirSync(rootDir);

  const configPath = path.join(rootDir, 'playwright.config.ts');
  files.set(configPath, buildPlaywrightConfig(options.browsers));

  const packageManager = determinePackageManager(rootDir);

  if (options.installGitHubActions) {
    let githubActionsScript = fs.readFileSync(path.join(assetsDir, 'github-actions.yml'), 'utf-8');
    if (packageManager === 'yarn') {
      githubActionsScript = githubActionsScript.replace(/npm ci/g, 'yarn');
      githubActionsScript = githubActionsScript.replace(/npm run/g, 'yarn');
    }
    githubActionsScript = githubActionsScript.replace(/<RUN_TESTS>/g, commandToRunTests());
    files.set(path.join(rootDir, '.github/workflows/playwright.yml'), githubActionsScript);
  }

  const exampleTest = fs.readFileSync(path.join(assetsDir, 'example.spec.ts'), 'utf-8');
  files.set(path.join(rootDir, options.testDir, 'example.spec.ts'), exampleTest);

  if (!fs.existsSync(path.join(rootDir, 'package.json')))
    commands.push(packageManager === 'yarn' ? 'yarn init -y' : 'npm init -y');

  if (packageManager === 'yarn')
    commands.push('yarn add --dev @playwright/test');
  else
    commands.push('npm install --save-dev @playwright/test');

  commands.push('npx playwright install --with-deps');

  for (const command of commands) {
    console.log('Running:', command);
    execSync(command, {
      stdio: 'inherit',
      cwd: rootDir,
    });
  }
  for (const [filePath, value] of files) {
    if (fs.existsSync(filePath)) {
      const { override } = await prompt<{ override: boolean }>({
        type: 'confirm',
        name: 'override',
        message: `${filePath} as it already exists. Should it override?`,
        initial: false
      });
      if (!override)
        continue;
    }
    console.log(colors.gray(`Writing ${path.relative(process.cwd(), filePath)}.`));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value, 'utf-8');
  }

  const packageJSONPath = path.join(rootDir, 'package.json');
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));
  if (!packageJSON.scripts)
    packageJSON.scripts = {};
  packageJSON.scripts['playwright-tests'] = `npx playwright test`;
  fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON, null, 2), 'utf-8');

  console.log(colors.green('✔'), colors.bold('Successfully initialized your Playwright Test project!'));
  const pathToNavigate = path.relative(process.cwd(), rootDir);
  const prefix = pathToNavigate !== '' ? `- cd ${pathToNavigate}\n` : '';
  console.log(colors.bold('🎭 Try it out with:\n') + colors.greenBright(prefix + '- ' + commandToRunTests()));
  console.log('For more information see on: https://playwright.dev/docs/intro');

  function commandToRunTests() {
    if (packageManager === 'yarn')
      return 'yarn playwright-tests';
    return 'npm run playwright-tests';
  }
}

function determineRootDir() {
  const givenPath = process.argv[2];
  if (givenPath)
    return path.isAbsolute(givenPath) ? process.argv[2] : path.join(process.cwd(), process.argv[2]);

  return process.cwd();
}

function buildPlaywrightConfig(browsers: BrowserType[]) {
  const browser2DisplayName: Record<BrowserType, string> = {
    'chromium': 'Chromium',
    'firefox': 'Firefox',
    'webkit': 'Safari'
  };
  const projects = browsers.map(browserName => ({
    name: browser2DisplayName[browserName],
    use: {
      browserName
    }
  }));
  return `import { PlaywrightTestConfig } from '@playwright/test';

// More information: https://playwright.dev/docs/test-configuration

const config: PlaywrightTestConfig = {
  projects: ${JSON5.stringify(projects, null, 2).split('\n').map((line, index) => (index >= 1 ? '  ' : '') + line).join('\n')},
};

export default config;
  `;
}

function determinePackageManager(rootDir: string): 'yarn' | 'npm' {
  if (fs.existsSync(path.join(rootDir, 'yarn.lock')))
    return 'yarn';
  if (process.env.npm_config_user_agent)
    return process.env.npm_config_user_agent.includes('yarn') ? 'yarn' : 'npm';
  return 'npm';
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
