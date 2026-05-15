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

// Capture user-supplied args after `--` and strip them (and the `--` itself)
// from process.argv before commander parses, so they are not interpreted as
// test-filter regexes. The captured slice is exposed via FullConfig.argv.
const dashDashIndex = process.argv.indexOf('--');
export const argv: string[] = dashDashIndex >= 0 ? process.argv.slice(dashDashIndex + 1) : [];
if (dashDashIndex >= 0)
  process.argv.length = dashDashIndex;
