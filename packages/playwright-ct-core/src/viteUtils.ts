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
import { debug } from 'playwright-core/lib/utilsBundle';
import { getUserData } from 'playwright/lib/transform/compilationCache';
import type { PlaywrightTestConfig as BasePlaywrightTestConfig } from 'playwright/types/test';
import type { FullConfig } from 'playwright/types/testReporter';
import type { InlineConfig, Plugin, TransformResult, UserConfig } from 'vite';
import type { ImportInfo } from './tsxTransform';
import { resolveHook } from 'playwright/lib/transform/transform';

const log = debug('pw:vite');

export type CtConfig = BasePlaywrightTestConfig['use'] & {
  ctPort?: number;
  ctTemplateDir?: string;
  ctCacheDir?: string;
  ctViteConfig?: InlineConfig | (() => Promise<InlineConfig>);
};

export type ComponentRegistry = Map<string, ImportInfo>;
export type ComponentDirs = {
  configDir: string;
  outDir: string;
  templateDir: string;
};

export async function resolveDirs(configDir: string, config: FullConfig): Promise<ComponentDirs | null> {
  const use = config.projects[0].use as CtConfig;
  // FIXME: use build plugin to determine html location to resolve this.
  // TemplateDir must be relative, otherwise we can't move the final index.html into its target location post-build.
  // This regressed in https://github.com/microsoft/playwright/pull/26526
  const relativeTemplateDir = use.ctTemplateDir || 'playwright';
  const templateDir = await fs.promises.realpath(path.normalize(path.join(configDir, relativeTemplateDir))).catch(() => undefined);
  if (!templateDir)
    return null;
  const outDir = use.ctCacheDir ? path.resolve(configDir, use.ctCacheDir) : path.resolve(templateDir, '.cache');
  return {
    configDir,
    outDir,
    templateDir
  };
}

export function resolveEndpoint(config: FullConfig) {
  const use = config.projects[0].use as CtConfig;
  const baseURL = new URL(use.baseURL || 'http://localhost');
  return {
    https: baseURL.protocol.startsWith('https:') ? {} : undefined,
    host: baseURL.hostname,
    port: use.ctPort || Number(baseURL.port) || 3100
  };
}

export async function createConfig(dirs: ComponentDirs, config: FullConfig, frameworkPluginFactory: (() => Promise<Plugin>) | undefined, supportJsxInJs: boolean) {
  // We are going to have 3 config files:
  // - the defaults that user config overrides (baseConfig)
  // - the user config (userConfig)
  // - frameworks overrides (frameworkOverrides);

  const endpoint = resolveEndpoint(config);
  const use = config.projects[0].use as CtConfig;

  // Compose base config from the playwright config only.
  const baseConfig: InlineConfig = {
    root: dirs.templateDir,
    configFile: false,
    publicDir: path.join(dirs.configDir, 'public'),
    define: {
      __VUE_PROD_DEVTOOLS__: true,
    },
    css: {
      devSourcemap: true,
    },
    build: {
      outDir: dirs.outDir
    },
    preview: endpoint,
    server: endpoint,
    // Vite preview server will otherwise always return the index.html with 200.
    appType: 'mpa',
  };

  // Vite 5 refuses to support CJS.
  const { mergeConfig } = await import('vite');

  // Apply user config on top of the base config. This could have changed root and build.outDir.
  const userConfig = typeof use.ctViteConfig === 'function' ? await use.ctViteConfig() : (use.ctViteConfig || {});
  const baseAndUserConfig = mergeConfig(baseConfig, userConfig);

  const frameworkOverrides: UserConfig = { plugins: [] };

  // React heuristic. If we see a component in a file with .js extension,
  // consider it a potential JSX-in-JS scenario and enable JSX loader for all
  // .js files.
  if (supportJsxInJs) {
    log('jsx-in-js detected');
    frameworkOverrides.esbuild = {
      loader: 'jsx',
      include: /.*\.jsx?$/,
      exclude: [],
    };
    frameworkOverrides.optimizeDeps = {
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      }
    };
  }

  frameworkOverrides.build = {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      treeshake: false,
      input: {
        index: path.join(dirs.templateDir, 'index.html')
      },
    },
    sourcemap: true,
  };

  // We assume that any non-empty plugin list includes `vite-react` or similar.
  if (frameworkPluginFactory && !baseAndUserConfig.plugins?.length)
    frameworkOverrides.plugins = [await frameworkPluginFactory()];

  return mergeConfig(baseAndUserConfig, frameworkOverrides);
}

export async function populateComponentsFromTests(componentRegistry: ComponentRegistry, componentsByImportingFile?: Map<string, string[]>) {
  const importInfos: Map<string, ImportInfo[]> = await getUserData('playwright-ct-core');
  for (const [file, importList] of importInfos) {
    for (const importInfo of importList)
      componentRegistry.set(importInfo.id, importInfo);
    if (componentsByImportingFile)
      componentsByImportingFile.set(file, importList.map(i => resolveHook(i.filename, i.importSource, true)).filter(Boolean) as string[]);
  }
}

export function hasJSComponents(components: ImportInfo[]): boolean {
  for (const component of components) {
    const importPath = resolveHook(component.filename, component.importSource, true);
    const extname = importPath ? path.extname(importPath) : '';
    if (extname === '.js' || (importPath && !extname && fs.existsSync(importPath + '.js')))
      return true;
  }
  return false;
}

const importReactRE = /(^|\n|;)import\s+(\*\s+as\s+)?React(,|\s+)/;
const compiledReactRE = /(const|var)\s+React\s*=/;

export function transformIndexFile(id: string, content: string, templateDir: string, registerSource: string, importInfos: Map<string, ImportInfo>): TransformResult  | null {
  // Vite React plugin will do this for .jsx files, but not .js files.
  if (id.endsWith('.js') && content.includes('React.createElement') && !content.match(importReactRE) && !content.match(compiledReactRE)) {
    const code = `import React from 'react';\n${content}`;
    return { code, map: { mappings: '' } };
  }

  const indexTs = path.join(templateDir, 'index.ts');
  const indexTsx = path.join(templateDir, 'index.tsx');
  const indexJs = path.join(templateDir, 'index.js');
  const indexJsx = path.join(templateDir, 'index.jsx');
  const idResolved = path.resolve(id);
  if (!idResolved.endsWith(indexTs) && !idResolved.endsWith(indexTsx) && !idResolved.endsWith(indexJs) && !idResolved.endsWith(indexJsx))
    return null;

  const lines = [content, ''];
  lines.push(registerSource);

  for (const value of importInfos.values()) {
    const importPath = resolveHook(value.filename, value.importSource, true) || value.importSource;
    lines.push(`const ${value.id} = () => import('${importPath?.replaceAll(path.sep, '/')}').then((mod) => mod.${value.remoteName || 'default'});`);
  }

  lines.push(`__pwRegistry.initialize({ ${[...importInfos.keys()].join(',\n  ')} });`);
  return {
    code: lines.join('\n'),
    map: { mappings: '' }
  };
}

export function frameworkConfig(config: FullConfig): { registerSourceFile: string, frameworkPluginFactory?: () => Promise<Plugin> } {
  return (config as any)['@playwright/experimental-ct-core'];
}
