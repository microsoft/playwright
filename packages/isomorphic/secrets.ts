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


export type Secrets = Record<string, string>;

type SecretEntry = { name: string, value: string };

// Longer values go first, so that a secret that contains another secret
// is replaced as a whole.
function secretEntries(secrets: Secrets | undefined): SecretEntry[] {
  if (!secrets)
    return [];
  return Object.entries(secrets)
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value.length - a.value.length);
}

export function secretPlaceholder(name: string): string {
  return `<secret>${name}</secret>`;
}

export function redactSecrets(text: string, secrets: Secrets | undefined): string {
  for (const { name, value } of secretEntries(secrets))
    text = text.replaceAll(value, secretPlaceholder(name));
  return text;
}

// Replaces secrets in a string produced by JSON.stringify(), where the secret
// value may have been escaped.
export function redactSecretsInJSON(json: string, secrets: Secrets | undefined): string {
  for (const { name, value } of secretEntries(secrets)) {
    const escapedValue = JSON.stringify(value).slice(1, -1);
    const escapedPlaceholder = JSON.stringify(secretPlaceholder(name)).slice(1, -1);
    json = json.replaceAll(escapedValue, escapedPlaceholder);
  }
  return json;
}

// Replaces secret bytes in a buffer, without decoding it. The buffer may be
// binary or not a valid utf-8 string. The same buffer is returned when
// nothing was replaced.
export function redactSecretsInBuffer(buffer: Buffer, secrets: Secrets | undefined): Buffer {
  for (const { name, value } of secretEntries(secrets)) {
    const needle = Buffer.from(value, 'utf8');
    let index = buffer.indexOf(needle);
    if (index === -1)
      continue;
    const replacement = Buffer.from(secretPlaceholder(name), 'utf8');
    const chunks: Buffer[] = [];
    let start = 0;
    while (index !== -1) {
      chunks.push(buffer.subarray(start, index), replacement);
      start = index + needle.length;
      index = buffer.indexOf(needle, start);
    }
    chunks.push(buffer.subarray(start));
    buffer = Buffer.concat(chunks);
  }
  return buffer;
}
