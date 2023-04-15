/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/


import { vsprintf } from 'printj';

export function formatString(msg: string | undefined): string | undefined {
  if (!msg) return msg;
  const match = /(\%.)(?!.*\1)/.exec(msg);
  if (match) {
    const idx = match.index + 2;
    const substitution_section = msg.substring(0, idx).trim();
    const substitution = msg.substring(idx).trim();
    const substitution_matches = msg.match(/\%./g);
    if (substitution_matches) {
      const count = substitution_matches.length;
      const substitution_split = substitution.split(' ');
      const valid = count === substitution_split.length;
      if (valid) msg = vsprintf(substitution_section, substitution_split);
    }
  }
  return msg;
}