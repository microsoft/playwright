/**
 * Copyright (c) 2026 Roo.
 * Based on Playwright trace-viewer (Copyright (c) Microsoft Corporation).
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

import { attachmentURL } from './attachmentsTab';
import type { ActionTraceEventInContext, ResourceEntry, TraceModel } from '@isomorphic/trace/traceModel';
import type { ActionTraceEvent, AfterActionTraceEventAttachment } from '@trace/trace';

export type ApiCallData = {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  duration?: number;
  size?: number;
  request?: {
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    headers?: Record<string, string>;
    body?: unknown;
  };
};

const kHttpMethodPattern = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;

export function isApiCallAction(action: ActionTraceEvent): boolean {
  if (action.class === 'APIRequestContext' && action.method === 'fetch')
    return true;
  const title = action.title ?? '';
  if (title.startsWith('Attach '))
    return false;
  if (kHttpMethodPattern.test(title))
    return true;
  if (hasApiAttachmentPair(action))
    return true;
  return false;
}

function hasApiAttachmentPair(action: ActionTraceEvent): boolean {
  if (action.title?.startsWith('Attach '))
    return false;
  const names = new Set(action.attachments?.map(a => a.name) ?? []);
  return names.has('request.json') || names.has('response.json');
}

const kSensitiveHeaderNames = new Set([
  'authorization',
  'x-access-token',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]);

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers)
    return headers;
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers))
    result[name] = kSensitiveHeaderNames.has(name.toLowerCase()) ? '[REDACTED]' : value;
  return result;
}

function findAttachmentsOnAction(
  action: ActionTraceEvent,
  allActions: ActionTraceEventInContext[],
  name: string,
): AfterActionTraceEventAttachment | undefined {
  const direct = action.attachments?.find(a => a.name === name);
  if (direct)
    return direct;

  for (const child of allActions) {
    if (child.parentId !== action.callId)
      continue;
    if (!child.title?.includes(`"${name}"`))
      continue;
    return child.attachments?.find(a => a.name === name) ?? child.attachments?.[0];
  }
  return undefined;
}

function findAttachment(
  action: ActionTraceEvent,
  allActions: ActionTraceEventInContext[],
  name: string,
): AfterActionTraceEventAttachment | undefined {
  let current: ActionTraceEvent | undefined = action;
  while (current) {
    const attachment = findAttachmentsOnAction(current, allActions, name);
    if (attachment)
      return attachment;
    current = current.parentId ? allActions.find(a => a.callId === current!.parentId) : undefined;
  }
  return undefined;
}

function isNestedFetchUnderHttpStep(action: ActionTraceEvent, allActions: ActionTraceEventInContext[]): boolean {
  if (action.class !== 'APIRequestContext' || action.method !== 'fetch' || !action.parentId)
    return false;
  let current = allActions.find(a => a.callId === action.parentId);
  while (current) {
    if (kHttpMethodPattern.test(current.title ?? '') || hasApiAttachmentPair(current))
      return true;
    current = current.parentId ? allActions.find(a => a.callId === current!.parentId) : undefined;
  }
  return false;
}

/** e.g. "PUT /hospital/tech_shift/deleteShift (internal)" → "PUT /hospital/tech_shift/deleteShift" */
function apiCallSignature(action: ActionTraceEvent): string | undefined {
  const title = action.title ?? '';
  const methodMatch = title.match(kHttpMethodPattern);
  if (!methodMatch)
    return undefined;
  const path = title.slice(methodMatch[0].length).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${methodMatch[1]} ${path}`;
}

function isNestedHttpStepUnderHttpStep(action: ActionTraceEvent, allActions: ActionTraceEventInContext[]): boolean {
  if (!kHttpMethodPattern.test(action.title ?? ''))
    return false;
  const signature = apiCallSignature(action);
  if (!signature)
    return false;
  let current = action.parentId ? allActions.find(a => a.callId === action.parentId) : undefined;
  while (current) {
    if (kHttpMethodPattern.test(current.title ?? '') && apiCallSignature(current) === signature)
      return true;
    current = current.parentId ? allActions.find(a => a.callId === current!.parentId) : undefined;
  }
  return false;
}

function actionDepth(action: ActionTraceEvent, allActions: ActionTraceEventInContext[]): number {
  let depth = 0;
  let current = action.parentId ? allActions.find(a => a.callId === action.parentId) : undefined;
  while (current) {
    depth++;
    current = current.parentId ? allActions.find(a => a.callId === current!.parentId) : undefined;
  }
  return depth;
}

async function loadAttachmentText(model: TraceModel | undefined, attachment: AfterActionTraceEventAttachment | undefined): Promise<string | undefined> {
  if (!model || !attachment)
    return undefined;
  if (!attachment.sha1 && !attachment.path)
    return undefined;
  try {
    const response = await fetch(attachmentURL(model, { ...attachment, callId: '' }));
    return await response.text();
  } catch {
    return undefined;
  }
}

function parseJsonAttachment(text: string | undefined): Record<string, unknown> | undefined {
  if (!text)
    return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function headersArrayToRecord(headers: { name: string, value: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers)
    result[header.name] = header.value;
  return result;
}

function queryStringToRecord(queryString: { name: string, value: string }[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of queryString)
    result[entry.name] = entry.value;
  return result;
}

function findNetworkResource(action: ActionTraceEvent, resources: ResourceEntry[]): ResourceEntry | undefined {
  const url = action.params?.url as string | undefined;
  const endTime = action.endTime || action.startTime;
  const candidates = resources.filter(resource => {
    const time = resource._monotonicTime ?? 0;
    return time >= action.startTime - 50 && time <= endTime + 50;
  });

  if (url) {
    const exact = candidates.find(resource => resource.request.url === url);
    if (exact)
      return exact;
    try {
      const pathname = new URL(url).pathname + new URL(url).search;
      const byPath = candidates.find(resource => {
        try {
          const resourcePath = new URL(resource.request.url).pathname + new URL(resource.request.url).search;
          return resourcePath === pathname || resource.request.url.endsWith(pathname);
        } catch {
          return resource.request.url.includes(pathname);
        }
      });
      if (byPath)
        return byPath;
    } catch {
      const partial = candidates.find(resource => resource.request.url.includes(url));
      if (partial)
        return partial;
    }
  }

  const method = (action.params?.method as string | undefined)?.toUpperCase();
  if (method) {
    const byMethod = candidates.filter(resource => resource.request.method.toUpperCase() === method);
    if (byMethod.length === 1)
      return byMethod[0];
  }

  return candidates.length === 1 ? candidates[0] : undefined;
}

async function loadNetworkBody(model: TraceModel | undefined, sha1: string | undefined): Promise<string | undefined> {
  if (!model || !sha1)
    return undefined;
  try {
    const response = await fetch(model.createRelativeUrl(`sha1/${sha1}`));
    return await response.text();
  } catch {
    return undefined;
  }
}

function dataFromAttachments(
  requestJson: Record<string, unknown> | undefined,
  responseJson: Record<string, unknown> | undefined,
  action: ActionTraceEvent,
): ApiCallData {
  const method = String(requestJson?.method ?? action.params?.method ?? extractMethodFromTitle(action.title) ?? 'GET').toUpperCase();
  const url = String(requestJson?.url ?? action.params?.url ?? action.title ?? '');
  const status = typeof responseJson?.status === 'number' ? responseJson.status : undefined;
  const statusText = typeof responseJson?.statusText === 'string' ? responseJson.statusText : undefined;
  const duration = action.endTime ? action.endTime - action.startTime : undefined;

  return {
    method,
    url,
    status,
    statusText,
    duration,
    request: {
      query: (requestJson?.params as Record<string, unknown> | undefined) ?? undefined,
      headers: redactHeaders(requestJson?.headers as Record<string, string> | undefined),
      body: requestJson?.body,
    },
    response: {
      body: responseJson?.body,
      headers: redactHeaders(responseJson?.headers as Record<string, string> | undefined),
    },
  };
}

function extractMethodFromTitle(title: string | undefined): string | undefined {
  if (!title)
    return undefined;
  const match = title.match(kHttpMethodPattern);
  return match?.[1];
}

function dataFromNetworkResource(resource: ResourceEntry, action: ActionTraceEvent, requestBody?: string, responseBody?: string): ApiCallData {
  const requestContentType = resource.request.headers.find(h => h.name.toLowerCase() === 'content-type')?.value;
  const responseContentType = resource.response.content.mimeType;
  let parsedRequestBody: unknown = requestBody;
  let parsedResponseBody: unknown = responseBody;
  if (requestBody && requestContentType?.includes('json'))
    try { parsedRequestBody = JSON.parse(requestBody); } catch { /* keep text */ }
  if (responseBody && responseContentType.includes('json'))
    try { parsedResponseBody = JSON.parse(responseBody); } catch { /* keep text */ }

  return {
    method: resource.request.method.toUpperCase(),
    url: resource.request.url,
    status: resource.response.status > 0 ? resource.response.status : undefined,
    statusText: resource.response.statusText,
    duration: resource.time,
    size: resource.response.content.size,
    request: {
      query: queryStringToRecord(resource.request.queryString),
      headers: redactHeaders(headersArrayToRecord(resource.request.headers)),
      body: parsedRequestBody,
    },
    response: {
      headers: redactHeaders(headersArrayToRecord(resource.response.headers)),
      body: parsedResponseBody,
    },
  };
}

function dataFromActionParams(action: ActionTraceEvent): ApiCallData {
  const method = String(action.params?.method ?? extractMethodFromTitle(action.title) ?? 'GET').toUpperCase();
  const url = String(action.params?.url ?? '');
  const duration = action.endTime ? action.endTime - action.startTime : undefined;
  const result = action.result as { status?: number, statusText?: string } | undefined;

  return {
    method,
    url,
    status: result?.status,
    statusText: result?.statusText,
    duration,
    request: {
      headers: redactHeaders(action.params?.headers as Record<string, string> | undefined),
      body: action.params?.data ?? action.params?.form ?? action.params?.multipart,
    },
  };
}

export async function resolveApiCallData(
  action: ActionTraceEvent,
  model: TraceModel | undefined,
  allActions: ActionTraceEventInContext[],
): Promise<ApiCallData | undefined> {
  if (!isApiCallAction(action))
    return undefined;

  const requestAttachment = findAttachment(action, allActions, 'request.json');
  const responseAttachment = findAttachment(action, allActions, 'response.json');
  const requestText = await loadAttachmentText(model, requestAttachment);
  const responseText = await loadAttachmentText(model, responseAttachment);
  const requestJson = parseJsonAttachment(requestText);
  const responseJson = parseJsonAttachment(responseText);

  if (requestJson || responseJson) {
    const fromAttachments = dataFromAttachments(requestJson, responseJson, action);
    const resource = model ? findNetworkResource(action, model.resources) : undefined;
    if (resource) {
      const requestBody = await loadNetworkBody(model, resource.request.postData?._sha1);
      const responseBody = await loadNetworkBody(model, resource.response.content._sha1);
      const fromNetwork = dataFromNetworkResource(resource, action, requestBody, responseBody);
      return mergeApiCallData(fromAttachments, fromNetwork);
    }
    return fromAttachments;
  }

  const resource = model ? findNetworkResource(action, model.resources) : undefined;
  if (resource) {
    const requestBody = await loadNetworkBody(model, resource.request.postData?._sha1);
    const responseBody = await loadNetworkBody(model, resource.response.content._sha1);
    return dataFromNetworkResource(resource, action, requestBody, responseBody);
  }

  if (action.class === 'APIRequestContext' && action.method === 'fetch')
    return dataFromActionParams(action);

  if (extractMethodFromTitle(action.title))
    return dataFromActionParams(action);

  return undefined;
}

export function collectApiCallActions(actions: ActionTraceEventInContext[]): ActionTraceEventInContext[] {
  const candidates = actions.filter(action => shouldShowApiCallDetailsUi(action, actions));
  const deduped = new Map<string, ActionTraceEventInContext>();
  for (const action of candidates) {
    const signature = apiCallSignature(action) ?? action.title ?? action.callId;
    const key = `${signature}|${action.startTime}|${action.endTime ?? action.startTime}`;
    const existing = deduped.get(key);
    if (!existing || actionDepth(action, actions) < actionDepth(existing, actions))
      deduped.set(key, action);
  }
  return [...deduped.values()].sort((a, b) => a.startTime - b.startTime);
}

export function shouldShowApiCallDetailsUi(action: ActionTraceEvent, allActions: ActionTraceEventInContext[]): boolean {
  return isApiCallAction(action)
      && !isNestedFetchUnderHttpStep(action, allActions)
      && !isNestedHttpStepUnderHttpStep(action, allActions);
}

function mergeApiCallData(primary: ApiCallData, fallback: ApiCallData): ApiCallData {
  return {
    method: primary.method || fallback.method,
    url: primary.url || fallback.url,
    status: primary.status ?? fallback.status,
    statusText: primary.statusText ?? fallback.statusText,
    duration: primary.duration ?? fallback.duration,
    size: primary.size ?? fallback.size,
    request: {
      query: hasRecordEntries(primary.request?.query) ? primary.request?.query : fallback.request?.query,
      headers: hasRecordEntries(primary.request?.headers) ? primary.request?.headers : fallback.request?.headers,
      body: primary.request?.body !== undefined ? primary.request.body : fallback.request?.body,
    },
    response: {
      headers: hasRecordEntries(primary.response?.headers) ? primary.response?.headers : fallback.response?.headers,
      body: primary.response?.body !== undefined ? primary.response.body : fallback.response?.body,
    },
  };
}

function hasRecordEntries(record?: Record<string, unknown>): boolean {
  return !!record && Object.keys(record).length > 0;
}
