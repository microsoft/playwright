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

import { getMetainfo } from './protocolMetainfo';
import { asLocatorDescription } from './locatorGenerators';

import type { Language } from './locatorGenerators';

export type CallMetainfo = {
  type: string;
  method: string;
  params?: Record<string, any>;
  // Pre-rendered overrides, take precedence over the protocol templates.
  title?: string;
  subtitle?: string;
};

export function formatProtocolParam(params: Record<string, any> | undefined, alternatives: string, sdkLanguage?: Language, baseURL?: string): string | undefined {
  return _formatProtocolParam(params, alternatives, sdkLanguage, baseURL)?.replaceAll('\n', '\\n');
}

function _formatProtocolParam(params: Record<string, any> | undefined, alternatives: string, sdkLanguage?: Language, baseURL?: string): string | undefined {
  if (!params)
    return undefined;

  for (const name of alternatives.split('|')) {
    if (name === 'url') {
      try {
        const urlObject = new URL(params[name]);
        if (urlObject.protocol === 'data:')
          return urlObject.protocol;
        if (['about:', 'chrome:', 'edge:'].includes(urlObject.protocol))
          return params[name];
        if (baseURL !== undefined && !isSameOrigin(urlObject, baseURL))
          return params[name];
        return urlObject.pathname + urlObject.search;
      } catch (error) {
        if (params[name] !== undefined)
          return params[name];
      }
    }
    if (name === 'timeNumber' && params[name] !== undefined) {
      // eslint-disable-next-line no-restricted-globals
      return new Date(params[name]).toString();
    }

    const value = deepParam(params, name);
    if (value === undefined)
      continue;
    if (name === 'selector' || name.endsWith('.selector'))
      return asLocatorDescription(sdkLanguage ?? 'javascript', value);
    return value;
  }
}

function isSameOrigin(url: URL, baseURL: string): boolean {
  try {
    return new URL(baseURL).origin === url.origin;
  } catch {
    return true;
  }
}

function deepParam(params: Record<string, any>, name: string): string | undefined {
  const tokens = name.split('.');
  let current = params;
  for (const token of tokens) {
    if (typeof current !== 'object' || current === null)
      return undefined;
    current = current[token];
  }
  if (current === undefined)
    return undefined;
  return String(current);
}

export function renderTitleForCall(metadata: CallMetainfo, sdkLanguage?: Language, baseURL?: string): string {
  const titleFormat = metadata.title ?? getMetainfo(metadata)?.title ?? metadata.method;
  return titleFormat.replace(/\{([^}]+)\}/g, (fullMatch, p1) => {
    return formatProtocolParam(metadata.params, p1, sdkLanguage, baseURL) ?? fullMatch;
  });
}

export function renderSubtitleForCall(metadata: CallMetainfo, sdkLanguage?: Language, baseURL?: string): string | undefined {
  const subtitleFormat = metadata.subtitle ?? getMetainfo(metadata)?.subtitle;
  if (subtitleFormat === undefined)
    return undefined;
  let allParamsResolved = true;
  const subtitle = subtitleFormat.replace(/\{([^}]+)\}/g, (fullMatch, p1) => {
    const param = formatProtocolParam(metadata.params, p1, sdkLanguage, baseURL);
    if (param === undefined)
      allParamsResolved = false;
    return param ?? fullMatch;
  });
  return allParamsResolved ? subtitle : undefined;
}

export function renderFullTitleForCall(metadata: CallMetainfo, sdkLanguage?: Language, baseURL?: string): string {
  const title = renderTitleForCall(metadata, sdkLanguage, baseURL);
  const subtitle = renderSubtitleForCall(metadata, sdkLanguage, baseURL);
  return subtitle ? `${title} ${subtitle}` : title;
}

export type ActionGroup = 'configuration' | 'route' | 'getter';

export function getActionGroup(metadata: { type: string, method: string }) {
  return getMetainfo(metadata)?.group as undefined | ActionGroup;
}

const kMaxParamLength = 200;

// Curated per-call parameters, defined by the "renderParams" lists in protocol.yml. Only the
// arguments that say what the call actually did are reported, and only when they are
// bounded in size: page content, evaluated expressions, request bodies and the like are
// never reported, and neither are options that repeat their default on every call.
export function renderParamsForCall(metadata: CallMetainfo, sdkLanguage?: Language): Record<string, any> | undefined {
  if (!metadata.params)
    return undefined;
  const result: Record<string, any> = {};
  const locator = renderLocator(metadata.params.selector, sdkLanguage);
  if (locator !== undefined)
    result.locator = locator;
  for (const entry of getMetainfo(metadata)?.renderParams ?? []) {
    const { key, value } = renderParamEntry(metadata.params, entry, sdkLanguage);
    if (value !== undefined)
      result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

// Each entry is "[key=]path[:selector]": a dotted path into the call params, reported
// under the last path segment unless an explicit key is given, with selector values
// rendered as locators.
function renderParamEntry(params: Record<string, any>, entry: string, sdkLanguage?: Language): { key: string, value: any } {
  const [spec, format] = entry.split(':');
  const eqIndex = spec.indexOf('=');
  const path = eqIndex === -1 ? spec : spec.slice(eqIndex + 1);
  const key = eqIndex === -1 ? path.split('.').pop()! : spec.slice(0, eqIndex);
  let value: any = params;
  for (const token of path.split('.')) {
    if (typeof value !== 'object' || value === null) {
      value = undefined;
      break;
    }
    value = value[token];
  }
  if (value === undefined)
    return { key, value };
  if (format === 'selector')
    return { key, value: renderLocator(value, sdkLanguage) };
  if (typeof value === 'string')
    return { key, value: truncateParam(value) };
  return { key, value };
}

function renderLocator(selector: any, sdkLanguage?: Language): string | undefined {
  if (typeof selector !== 'string')
    return undefined;
  return truncateParam(asLocatorDescription(sdkLanguage ?? 'javascript', selector));
}

export function truncateParam(value: string): string {
  return value.length > kMaxParamLength ? value.substring(0, kMaxParamLength) + '…' : value;
}
