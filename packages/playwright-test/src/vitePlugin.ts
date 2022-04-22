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

import fs from 'fs';
import path from 'path';
import { glob } from 'playwright-core/lib/utilsBundle';
import { parse, types as t, traverse } from './babelBundle';
import type { Plugin } from 'vite';
import { componentInfo, collectComponentUsages } from './tsxTransform';
import type { ComponentInfo } from './tsxTransform';

const imports: Map<string, ComponentInfo> = new Map();
let configDir: string;

export function createVitePlugin(registerFunction: string) {
  return (options?: { include: string, imports?: string[] }) => {
    return vitePlugin({ ...(options || {}), registerFunction });
  };
}

function vitePlugin(options: { include?: string, imports?: string[], registerFunction: string }): Plugin {
  return {
    name: 'playwright-gallery',

    configResolved: async config => {
      configDir = path.dirname(config.configFile || '');
      const files = await new Promise<string[]>((f, r) => {
        glob(options.include || config.root + '/**/*.{test,spec}.[tj]s{x,}', {}, function(err, files) {
          if (err)
            r(err);
          else
            f(files);
        });
      });

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

    transform: async (_, id) => {
      if (!id.includes('playwright.app.ts') && !id.includes('playwright.app.js'))
        return;

      const folder = path.dirname(id);
      const lines = [];
      lines.push(`import register from '${options.registerFunction}';`);

      for (const [alias, value] of imports) {
        const importPath = value.isModuleOrAlias ? value.importPath : './' + path.relative(folder, value.importPath).replace(/\\/g, '/');
        if (value.importedName)
          lines.push(`import { ${value.importedName} as ${alias} } from '${importPath}';`);
        else
          lines.push(`import ${alias} from '${importPath}';`);
      }

      for (const i of options.imports || []) {
        const importPath = configDir && i.startsWith('.') ? './' + path.relative(folder, path.resolve(configDir, i)).replace(/\\/g, '/') : i;
        lines.push(`import '${importPath}';`);
      }

      lines.push(`register({ ${[...imports.keys()].join(',\n  ')} });`);
      return lines.join('\n');
    },
  };
}
