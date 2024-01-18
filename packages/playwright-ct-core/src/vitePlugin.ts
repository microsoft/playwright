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

import type { Suite } from 'playwright/types/testReporter';
import type { PlaywrightTestConfig as BasePlaywrightTestConfig, FullConfig } from 'playwright/test';
import type http from 'http';
import type { InlineConfig, Plugin, ResolveFn, ResolvedConfig, UserConfig } from 'vite';
import type { TestRunnerPlugin } from '../../playwright/src/plugins';
import type { AddressInfo } from 'net';
import type { PluginContext } from 'rollup';
import { debug } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import { stoppable } from 'playwright/lib/utilsBundle';
import { assert, calculateSha1 } from 'playwright-core/lib/utils';
import { getPlaywrightVersion } from 'playwright-core/lib/utils';
import { getUserData, internalDependenciesForTestFile, setExternalDependencies } from 'playwright/lib/transform/compilationCache';
import { source as injectedSource } from './generated/indexSource';
import type { ImportInfo } from './tsxTransform';

const log = debug('pw:vite');

let stoppableServer: any;
const playwrightVersion = getPlaywrightVersion();

type CtConfig = BasePlaywrightTestConfig['use'] & {
  ctPort?: number;
  ctTemplateDir?: string;
  ctCacheDir?: string;
  ctViteConfig?: InlineConfig | (() => Promise<InlineConfig>);
};

const importReactRE = /(^|\n|;)import\s+(\*\s+as\s+)?React(,|\s+)/;
const compiledReactRE = /(const|var)\s+React\s*=/;

export function createPlugin(
  registerSourceFile: string,
  frameworkPluginFactory?: () => Promise<Plugin>): TestRunnerPlugin {
  let configDir: string;
  let config: FullConfig;
  return {
    name: 'playwright-vite-plugin',

    setup: async (configObject: FullConfig, configDirectory: string) => {
      config = configObject;
      configDir = configDirectory;
    },

    begin: async (suite: Suite) => {
      // We are going to have 3 config files:
      // - the defaults that user config overrides (baseConfig)
      // - the user config (userConfig)
      // - frameworks overrides (frameworkOverrides);

      const use = config.projects[0].use as CtConfig;
      const baseURL = new URL(use.baseURL || 'http://localhost');
      const relativeTemplateDir = use.ctTemplateDir || 'playwright';

      // FIXME: use build plugin to determine html location to resolve this.
      // TemplateDir must be relative, otherwise we can't move the final index.html into its target location post-build.
      // This regressed in https://github.com/microsoft/playwright/pull/26526
      const templateDir = path.join(configDir, relativeTemplateDir);

      // Compose base config from the playwright config only.
      const baseConfig: InlineConfig = {
        root: configDir,
        configFile: false,
        define: {
          __VUE_PROD_DEVTOOLS__: true,
        },
        css: {
          devSourcemap: true,
        },
        build: {
          outDir: use.ctCacheDir ? path.resolve(configDir, use.ctCacheDir) : path.resolve(templateDir, '.cache')
        },
        preview: {
          https: baseURL.protocol.startsWith('https:') ? {} : undefined,
          host: baseURL.hostname,
          port: use.ctPort || Number(baseURL.port) || 3100
        },
        // Vite preview server will otherwise always return the index.html with 200.
        appType: 'mpa',
      };

      // Vite 5 refuses to support CJS.
      const { version: viteVersion, build, preview, mergeConfig } = await import('vite');

      // Apply user config on top of the base config. This could have changed root and build.outDir.
      const userConfig = typeof use.ctViteConfig === 'function' ? await use.ctViteConfig() : (use.ctViteConfig || {});
      const baseAndUserConfig = mergeConfig(baseConfig, userConfig);
      const buildInfoFile = path.join(baseAndUserConfig.build.outDir, 'metainfo.json');

      let buildExists = false;
      let buildInfo: BuildInfo;

      const registerSource = injectedSource + '\n' + await fs.promises.readFile(registerSourceFile, 'utf-8');
      const registerSourceHash = calculateSha1(registerSource);

      try {
        buildInfo = JSON.parse(await fs.promises.readFile(buildInfoFile, 'utf-8')) as BuildInfo;
        assert(buildInfo.version === playwrightVersion);
        assert(buildInfo.viteVersion === viteVersion);
        assert(buildInfo.registerSourceHash === registerSourceHash);
        buildExists = true;
      } catch (e) {
        buildInfo = {
          version: playwrightVersion,
          viteVersion,
          registerSourceHash,
          components: [],
          sources: {},
          deps: {},
        };
      }
      log('build exists:', buildExists);

      const componentRegistry: ComponentRegistry = new Map();
      const componentsByImportingFile = new Map<string, string[]>();
      // 1. Populate component registry based on tests' component imports.
      await populateComponentsFromTests(componentRegistry, componentsByImportingFile);

      // 2. Check if the set of required components has changed.
      const hasNewComponents = await checkNewComponents(buildInfo, componentRegistry);
      log('has new components:', hasNewComponents);

      // 3. Check component sources.
      const sourcesDirty = !buildExists || hasNewComponents || await checkSources(buildInfo);
      log('sourcesDirty:', sourcesDirty);

      // 4. Update component info.
      buildInfo.components = [...componentRegistry.values()];

      const frameworkOverrides: UserConfig = { plugins: [] };

      // React heuristic. If we see a component in a file with .js extension,
      // consider it a potential JSX-in-JS scenario and enable JSX loader for all
      // .js files.
      if (hasJSComponents(buildInfo.components)) {
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

      // We assume that any non-empty plugin list includes `vite-react` or similar.
      if (frameworkPluginFactory && !baseAndUserConfig.plugins?.length)
        frameworkOverrides.plugins = [await frameworkPluginFactory()];

      // But only add out own plugin when we actually build / transform.
      const depsCollector = new Map<string, string[]>();
      if (sourcesDirty)
        frameworkOverrides.plugins!.push(vitePlugin(registerSource, templateDir, buildInfo, componentRegistry, depsCollector));

      frameworkOverrides.build = {
        target: 'esnext',
        minify: false,
        rollupOptions: {
          treeshake: false,
          input: {
            index: path.join(templateDir, 'index.html')
          },
        },
        sourcemap: true,
      };

      const finalConfig = mergeConfig(baseAndUserConfig, frameworkOverrides);

      if (sourcesDirty) {
        log('build');
        await build(finalConfig);
        await fs.promises.rename(`${finalConfig.build.outDir}/${relativeTemplateDir}/index.html`, `${finalConfig.build.outDir}/index.html`);
        buildInfo.deps = Object.fromEntries(depsCollector.entries());
      }

      if (hasNewComponents || sourcesDirty) {
        log('write manifest');
        await fs.promises.writeFile(buildInfoFile, JSON.stringify(buildInfo, undefined, 2));
      }

      for (const projectSuite of suite.suites) {
        for (const fileSuite of projectSuite.suites) {
          // For every test file...
          const testFile = fileSuite.location!.file;
          const deps = new Set<string>();
          // Collect its JS dependencies (helpers).
          for (const file of [testFile, ...(internalDependenciesForTestFile(testFile) || [])]) {
            // For each helper, get all the imported components.
            for (const componentFile of componentsByImportingFile.get(file) || []) {
              // For each component, get all the dependencies.
              for (const d of depsCollector.get(componentFile) || [])
                deps.add(d);
            }
          }
          // Now we have test file => all components along with dependencies.
          setExternalDependencies(testFile, [...deps]);
        }
      }

      const previewServer = await preview(finalConfig);
      stoppableServer = stoppable(previewServer.httpServer as http.Server, 0);
      const isAddressInfo = (x: any): x is AddressInfo => x?.address;
      const address = previewServer.httpServer.address();
      if (isAddressInfo(address)) {
        const protocol = finalConfig.preview.https ? 'https:' : 'http:';
        process.env.PLAYWRIGHT_TEST_BASE_URL = `${protocol}//${finalConfig.preview.host}:${address.port}`;
      }
    },

    end: async () => {
      if (stoppableServer)
        await new Promise(f => stoppableServer.stop(f));
    },
  };
}

type BuildInfo = {
  version: string,
  viteVersion: string,
  registerSourceHash: string,
  sources: {
    [key: string]: {
      timestamp: number;
    }
  };
  components: ImportInfo[];
  deps: {
    [key: string]: string[];
  }
};

type ComponentRegistry = Map<string, ImportInfo>;

async function checkSources(buildInfo: BuildInfo): Promise<boolean> {
  for (const [source, sourceInfo] of Object.entries(buildInfo.sources)) {
    try {
      const timestamp = (await fs.promises.stat(source)).mtimeMs;
      if (sourceInfo.timestamp !== timestamp) {
        log('source has changed:', source);
        return true;
      }
    } catch (e) {
      log('check source failed:', e);
      return true;
    }
  }
  return false;
}

async function populateComponentsFromTests(componentRegistry: ComponentRegistry, componentsByImportingFile: Map<string, string[]>) {
  const importInfos: Map<string, ImportInfo[]> = await getUserData('playwright-ct-core');
  for (const [file, importList] of importInfos) {
    for (const importInfo of importList)
      componentRegistry.set(importInfo.id, importInfo);
    componentsByImportingFile.set(file, importList.filter(i => !i.isModuleOrAlias).map(i => i.importPath));
  }
}

async function checkNewComponents(buildInfo: BuildInfo, componentRegistry: ComponentRegistry): Promise<boolean> {
  const newComponents = [...componentRegistry.keys()];
  const oldComponents = new Map(buildInfo.components.map(c => [c.id, c]));

  let hasNewComponents = false;
  for (const c of newComponents) {
    if (!oldComponents.has(c)) {
      hasNewComponents = true;
      break;
    }
  }
  for (const c of oldComponents.values())
    componentRegistry.set(c.id, c);

  return hasNewComponents;
}

function vitePlugin(registerSource: string, templateDir: string, buildInfo: BuildInfo, importInfos: Map<string, ImportInfo>, depsCollector: Map<string, string[]>): Plugin {
  buildInfo.sources = {};
  let moduleResolver: ResolveFn;
  return {
    name: 'playwright:component-index',

    configResolved(config: ResolvedConfig) {
      moduleResolver = config.createResolver();
    },

    async transform(this: PluginContext, content, id) {
      const queryIndex = id.indexOf('?');
      const file = queryIndex !== -1 ? id.substring(0, queryIndex) : id;
      if (!buildInfo.sources[file]) {
        try {
          const timestamp = (await fs.promises.stat(file)).mtimeMs;
          buildInfo.sources[file] = { timestamp };
        } catch {
          // Silent if can't read the file.
        }
      }

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
        return;

      const folder = path.dirname(id);
      const lines = [content, ''];
      lines.push(registerSource);

      for (const value of importInfos.values()) {
        const importPath = value.isModuleOrAlias ? value.importPath : './' + path.relative(folder, value.importPath).replace(/\\/g, '/');
        lines.push(`const ${value.id} = () => import('${importPath}').then((mod) => mod.${value.remoteName || 'default'});`);
      }

      lines.push(`__pwRegistry.initialize({ ${[...importInfos.keys()].join(',\n  ')} });`);
      return {
        code: lines.join('\n'),
        map: { mappings: '' }
      };
    },

    async writeBundle(this: PluginContext) {
      for (const importInfo of importInfos.values()) {
        const deps = new Set<string>();
        const id = await moduleResolver(importInfo.importPath);
        if (!id)
          continue;
        collectViteModuleDependencies(this, id, deps);
        depsCollector.set(importInfo.importPath, [...deps]);
      }
    },
  };
}

function collectViteModuleDependencies(context: PluginContext, id: string, deps: Set<string>) {
  if (!path.isAbsolute(id))
    return;
  const normalizedId = path.normalize(id);
  if (deps.has(normalizedId))
    return;
  deps.add(normalizedId);
  const module = context.getModuleInfo(id);
  for (const importedId of module?.importedIds || [])
    collectViteModuleDependencies(context, importedId, deps);
  for (const importedId of module?.dynamicallyImportedIds || [])
    collectViteModuleDependencies(context, importedId, deps);
}

function hasJSComponents(components: ImportInfo[]): boolean {
  for (const component of components) {
    const extname = path.extname(component.importPath);
    if (extname === '.js' || !extname && fs.existsSync(component.importPath + '.js'))
      return true;
  }
  return false;
}
