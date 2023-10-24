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

export type UITestStatus = 'none' | 'running' | 'scheduled' | 'passed' | 'failed' | 'skipped';

export function testStatusIcon(status: UITestStatus): string {
  if (status === 'scheduled')
    return 'codicon-clock';
  if (status === 'running')
    return 'codicon-loading';
  if (status === 'failed')
    return 'codicon-error';
  if (status === 'passed')
    return 'codicon-check';
  if (status === 'skipped')
    return 'codicon-circle-slash';
  return 'codicon-circle-outline';
}

export function testStatusText(status: UITestStatus): string {
  if (status === 'scheduled')
    return 'Pending';
  if (status === 'running')
    return 'Running';
  if (status === 'failed')
    return 'Failed';
  if (status === 'passed')
    return 'Passed';
  if (status === 'skipped')
    return 'Skipped';
  return 'Did not run';
}
