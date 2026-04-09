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

import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';
import { builtInReporters, config as commonConfig, configLoader } from '../common';
import { showHTMLReport } from '../reporters/html';
import { createMergedReport } from '../reporters/merge';

import type { ReporterDescription } from '../../types/test';

export async function showReport(report: string | undefined, host: string, port: number) {
  await showHTMLReport(report, host, port);
}

export async function mergeReports(reportDir: string | undefined, opts: { [key: string]: any }) {
  const configFile = opts.config;
  const config = configFile ? await configLoader.loadConfigFromFile(configFile) : await configLoader.loadEmptyConfigForMergeReports();

  const dir = path.resolve(process.cwd(), reportDir || '');
  const dirStat = await fs.promises.stat(dir).catch(e => null);
  if (!dirStat)
    throw new Error('Directory does not exist: ' + dir);
  if (!dirStat.isDirectory())
    throw new Error(`"${dir}" is not a directory`);
  let reporterDescriptions: ReporterDescription[] | undefined = resolveReporterOption(opts.reporter);
  if (!reporterDescriptions && configFile)
    reporterDescriptions = config.config.reporter;
  if (!reporterDescriptions)
    reporterDescriptions = [[commonConfig.defaultReporter]];
  const rootDirOverride = configFile ? config.config.rootDir : undefined;
  await createMergedReport(config, dir, reporterDescriptions!, rootDirOverride);
  gracefullyProcessExitDoNotHang(0);
}

function resolveReporterOption(reporter?: string): ReporterDescription[] | undefined {
  if (!reporter || !reporter.length)
    return undefined;
  return reporter.split(',').map((r: string) => [resolveReporter(r)]);
}

function resolveReporter(id: string) {
  if (builtInReporters.includes(id as any))
    return id;
  const localPath = path.resolve(process.cwd(), id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [process.cwd()] });
}
