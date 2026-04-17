/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

// Returns the directory the dashboard should drop screenshots and recordings
// into when running in "app" mode. We use ~/Downloads, which is the physical
// on-disk path on macOS and Windows (both display a localized name via
// Finder/Explorer) and on English-locale Linux. Non-English Linux locales
// localize the directory (~/Téléchargements, ~/下载, ...) via XDG's
// user-dirs.dirs; we don't parse that file and fall back to a tmpdir subdir
// there. If that becomes a pain point, read ~/.config/user-dirs.dirs.
export function resolveDashboardDownloadsDir(): string {
  const override = process.env.PLAYWRIGHT_DASHBOARD_DOWNLOADS_DIR_FOR_TEST;
  if (override) {
    fs.mkdirSync(override, { recursive: true });
    return override;
  }
  const primary = path.join(os.homedir(), 'Downloads');
  if (fs.existsSync(primary))
    return primary;
  const fallback = path.join(os.tmpdir(), 'playwright-dashboard-downloads');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
