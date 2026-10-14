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

export type Secrets = { name?: string, value: string }[];

// Longer values go first, so that a secret that contains another secret is replaced as a whole.
export function normalizeSecrets(secrets: Secrets | undefined): Secrets {
  if (!secrets)
    return [];
  return secrets
      .filter(secret => typeof secret?.value === 'string' && secret.value.length > 0)
      .sort((a, b) => b.value.length - a.value.length);
}

export function secretsKey(secrets: Secrets | undefined): string {
  return JSON.stringify(normalizeSecrets(secrets).map(secret => JSON.stringify([secret.name ?? null, secret.value])).sort());
}

export function secretPlaceholder(name: string | undefined): string {
  return name ? `<secret>${name}</secret>` : `<secret/>`;
}

export function redactSecrets(text: string, secrets: Secrets): string {
  for (const { name, value } of secrets)
    text = text.replaceAll(value, secretPlaceholder(name));
  return text;
}

export function redactSecretsInJSON(json: string, secrets: Secrets): string {
  for (const { name, value } of secrets) {
    const escapedValue = JSON.stringify(value).slice(1, -1);
    const escapedPlaceholder = JSON.stringify(secretPlaceholder(name)).slice(1, -1);
    json = json.replaceAll(escapedValue, escapedPlaceholder);
  }
  return json;
}

// The buffer is not decoded, because it may not be a valid utf-8 string.
export function redactSecretsInBuffer(buffer: Buffer, secrets: Secrets): Buffer {
  for (const { name, value } of secrets) {
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
