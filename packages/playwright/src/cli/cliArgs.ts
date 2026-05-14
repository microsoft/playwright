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

// Custom command-line arguments: anything after `--` on the command line is
// captured here verbatim and surfaced as FullConfig.cliArgs. We strip these
// from the argv passed to commander so that built-in flag validation is
// unaffected and so that post-`--` items are not interpreted as test filters.
const _dashDashIndex = process.argv.indexOf('--');
export const cliArgs: string[] = _dashDashIndex >= 0 ? process.argv.slice(_dashDashIndex + 1) : [];
export const argvForCommander: string[] = _dashDashIndex >= 0 ? process.argv.slice(0, _dashDashIndex) : process.argv;
