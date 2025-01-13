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

export function yamlEscapeKeyIfNeeded(str: string): string {
  if (!yamlStringNeedsQuotes(str))
    return str;
  return `'` + str.replace(/'/g, `''`) + `'`;
}

export function yamlEscapeValueIfNeeded(str: string): string {
  if (!yamlStringNeedsQuotes(str))
    return str;
  return '"' + str.replace(/[\\"\x00-\x1f\x7f-\x9f]/g, c => {
    switch (c) {
      case '\\':
        return '\\\\';
      case '"':
        return '\\"';
      case '\b':
        return '\\b';
      case '\f':
        return '\\f';
      case '\n':
        return '\\n';
      case '\r':
        return '\\r';
      case '\t':
        return '\\t';
      default:
        const code = c.charCodeAt(0);
        return '\\x' + code.toString(16).padStart(2, '0');
    }
  }) + '"';
}

function yamlStringNeedsQuotes(str: string): boolean {
  if (str.length === 0)
    return true;

  // Strings with leading or trailing whitespace need quotes
  if (/^\s|\s$/.test(str))
    return true;

  // Strings containing control characters need quotes
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(str))
    return true;

  // Strings starting with '-' need quotes
  if (/^-/.test(str))
    return true;

  // Strings containing ':' or '\n' followed by a space or at the end need quotes
  if (/[\n:](\s|$)/.test(str))
    return true;

  // Strings containing '#' preceded by a space need quotes (comment indicator)
  if (/\s#/.test(str))
    return true;

  // Strings that contain line breaks need quotes
  if (/[\n\r]/.test(str))
    return true;

  // Strings starting with indicator characters or quotes need quotes
  if (/^[&*\],?!>|@"'#%]/.test(str))
    return true;

  // Strings containing special characters that could cause ambiguity
  if (/[{}`]/.test(str))
    return true;

  // YAML array starts with [
  if (/^\[/.test(str))
    return true;

  // Non-string types recognized by YAML
  if (!isNaN(Number(str)) || ['y', 'n', 'yes', 'no', 'true', 'false', 'on', 'off', 'null'].includes(str.toLowerCase()))
    return true;

  return false;
}
