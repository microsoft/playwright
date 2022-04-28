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

import type { PlaywrightTestConfig, TestPlugin } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import { parse, traverse, types as t } from '../babelBundle';
import type { ComponentInfo } from '../tsxTransform';
import { collectComponentUsages, componentInfo } from '../tsxTransform';

let viteDevServer: ViteDevServer;

export function createPlugin(
  registerFunction: string,
  frameworkPluginFactory: () => Plugin,
  options: {
    port?: number,
    config?: InlineConfig
  } = {}): TestPlugin {
  const viteConfig = options.config || {};
  const port = options.port || 3100;
  let configDir: string;
  return {
    name: () => 'playwright-vite-plugin',

    configure: async (config: PlaywrightTestConfig, configDirectory: string) => {
      configDir = configDirectory;
      const url = `http://localhost:${port}/playwright/index.html`;
      if (!config.use)
        config.use = {};
      config.use!.baseURL = url;
    },

    setup: async suite => {
      viteConfig.root = viteConfig.root || configDir;
      viteConfig.plugins = viteConfig.plugins || [
        frameworkPluginFactory()
      ];
      const files = new Set<string>();
      for (const project of suite.suites) {
        for (const file of project.suites)
          files.add(file.location!.file);
      }
      viteConfig.plugins.push(vitePlugin(registerFunction, [...files]));
      viteConfig.configFile = viteConfig.configFile || false;
      viteConfig.server = viteConfig.server || {};
      viteConfig.server.port = port;
      const { createServer } = require('vite');
      viteDevServer = await createServer(viteConfig);
      await viteDevServer.listen(port);
    },

    teardown: async () => {
      await viteDevServer.close();
    },
  };
}

const imports: Map<string, ComponentInfo> = new Map();

function vitePlugin(registerFunction: string, files: string[]): Plugin {
  return {
    name: 'playwright:component-index',

    configResolved: async config => {

      for (const file of files) {
        const text = await fs.promises.readFile(file, 'utf-8');
        const ast = parse(text, { errorRecovery: true, plugins: ['typescript', 'jsx'], sourceType: 'module' });
        const components = collectComponentUsages(ast);

        traverse(ast, {
          enter: p => {
            if (t.isImportDeclaration(p.node)) {
              const importNode = p.node;
              if (!t.isStringLiteral(importNode.source))
                return;

              for (const specifier of importNode.specifiers) {
                if (!components.names.has(specifier.local.name))
                  continue;
                if (t.isImportNamespaceSpecifier(specifier))
                  continue;
                const info = componentInfo(specifier, importNode.source.value, file);
                imports.set(info.fullName, info);
              }
            }
          }
        });
      }
    },

    transform: async (content, id) => {
      if (!id.endsWith('playwright/index.ts') && !id.endsWith('playwright/index.tsx') && !id.endsWith('playwright/index.js'))
        return;

      const folder = path.dirname(id);
      const lines = [content, ''];
      lines.push(`import register from '${registerFunction}';`);

      for (const [alias, value] of imports) {
        const importPath = value.isModuleOrAlias ? value.importPath : './' + path.relative(folder, value.importPath).replace(/\\/g, '/');
        if (value.importedName)
          lines.push(`import { ${value.importedName} as ${alias} } from '${importPath}';`);
        else
          lines.push(`import ${alias} from '${importPath}';`);
      }

      lines.push(`register({ ${[...imports.keys()].join(',\n  ')} });`);
      return lines.join('\n');
    },
  };
}
