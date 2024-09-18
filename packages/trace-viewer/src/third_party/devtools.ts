// Copyright 2014 The Chromium Authors. All rights reserved.
// Modifications copyright (c) Microsoft Corporation.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 * Copyright (C) 2008, 2009 Anthony Ricaud <rik@webkit.org>
 * Copyright (C) 2011 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import type { Entry } from '@trace/har';

// The following function is derived from Chromium's source code
// https://github.com/ChromeDevTools/devtools-frontend/blob/83cbe41b4107e188a1f66fdf6ea3a9cca42587c6/front_end/panels/network/NetworkLogView.ts#L2363
export async function generateCurlCommand(resource: Entry): Promise<string> {
  const platform = navigator.platform.includes('Win') ? 'win' : 'unix';
  let command: string[] = [];
  // Most of these headers are derived from the URL and are automatically added by cURL.
  // The |Accept-Encoding| header is ignored to prevent decompression errors. crbug.com/1015321
  const ignoredHeaders =
    new Set<string>(['accept-encoding', 'host', 'method', 'path', 'scheme', 'version', 'authority', 'protocol']);

  function escapeStringWin(str: string): string {
    /* Always escape the " characters so that we can use caret escaping.

   Because cmd.exe parser and MS Crt arguments parsers use some of the
   same escape characters, they can interact with each other in
   horrible ways, the order of operations is critical.

   Replace \ with \\ first because it is an escape character for certain
   conditions in both parsers.

   Replace all " with \" to ensure the first parser does not remove it.

   Then escape all characters we are not sure about with ^ to ensure it
   gets to MS Crt parser safely.

   The % character is special because MS Crt parser will try and look for
   ENV variables and fill them in its place. We cannot escape them with %
   and cannot escape them with ^ (because it's cmd.exe's escape not MS Crt
   parser); So we can get cmd.exe parser to escape the character after it,
   if it is followed by a valid beginning character of an ENV variable.
   This ensures we do not try and double escape another ^ if it was placed
   by the previous replace.

   Lastly we replace new lines with ^ and TWO new lines because the first
   new line is there to enact the escape command the second is the character
   to escape (in this case new line).
  */
    const encapsChars = '^"';
    return encapsChars +
      str.replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/[^a-zA-Z0-9\s_\-:=+~'\/.',?;()*`]/g, '^$&')
          .replace(/%(?=[a-zA-Z0-9_])/g, '%^')
          .replace(/\r?\n/g, '^\n\n') +
      encapsChars;
  }

  function escapeStringPosix(str: string): string {
    function escapeCharacter(x: string): string {
      const code = x.charCodeAt(0);
      let hexString = code.toString(16);
      // Zero pad to four digits to comply with ANSI-C Quoting:
      // http://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
      while (hexString.length < 4)
        hexString = '0' + hexString;


      return '\\u' + hexString;
    }

    if (/[\0-\x1F\x7F-\x9F!]|\'/.test(str)) {
      // Use ANSI-C quoting syntax.
      return '$\'' +
        str.replace(/\\/g, '\\\\')
            .replace(/\'/g, '\\\'')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/[\0-\x1F\x7F-\x9F!]/g, escapeCharacter) +
        '\'';
    }
    // Use single quote syntax.
    return '\'' + str + '\'';
  }

  // cURL command expected to run on the same platform that DevTools run
  // (it may be different from the inspected page platform).
  const escapeString = platform === 'win' ? escapeStringWin : escapeStringPosix;

  command.push(escapeString(resource.request.url).replace(/[[{}\]]/g, '\\$&'));

  let inferredMethod = 'GET';
  const data = [];
  const formData = await fetchRequestPostData(resource);
  if (formData) {
    // Note that formData is not necessarily urlencoded because it might for example
    // come from a fetch request made with an explicitly unencoded body.
    data.push('--data-raw ' + escapeString(formData));
    ignoredHeaders.add('content-length');
    inferredMethod = 'POST';
  }

  if (resource.request.method !== inferredMethod)
    command.push('-X ' + escapeString(resource.request.method));


  const requestHeaders = resource.request.headers;
  for (let i = 0; i < requestHeaders.length; i++) {
    const header = requestHeaders[i];
    const name = header.name.replace(/^:/, '');  // Translate SPDY v3 headers to HTTP headers.
    if (ignoredHeaders.has(name.toLowerCase()))
      continue;

    if (header.value.trim()) {
      command.push('-H ' + escapeString(name + ': ' + header.value));
    } else {
      // A header passed with -H with no value or only whitespace as its
      // value tells curl to not set the header at all. To post an empty
      // header, you have to terminate it with a semicolon.
      command.push('-H ' + escapeString(name + ';'));
    }
  }
  command = command.concat(data);

  return 'curl ' + command.join(command.length >= 3 ? (platform === 'win' ? ' ^\n  ' : ' \\\n  ') : ' ');
}

const enum FetchStyle {
  BROWSER = 0,
  NODE_JS = 1,
}

export async function generateFetchCall(resource: Entry, style: FetchStyle = FetchStyle.BROWSER): Promise<string> {
  const ignoredHeaders = new Set<string>([
    // Internal headers
    'method',
    'path',
    'scheme',
    'version',

    // Unsafe headers
    // Keep this list synchronized with src/net/http/http_util.cc
    'accept-charset',
    'accept-encoding',
    'access-control-request-headers',
    'access-control-request-method',
    'connection',
    'content-length',
    'cookie',
    'cookie2',
    'date',
    'dnt',
    'expect',
    'host',
    'keep-alive',
    'origin',
    'referer',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'via',
    // TODO(phistuck) - remove this once crbug.com/571722 is fixed.
    'user-agent',
  ]);

  const credentialHeaders = new Set<string>(['cookie', 'authorization']);

  const url = JSON.stringify(resource.request.url);

  const requestHeaders = resource.request.headers;
  const headerData: Headers = requestHeaders.reduce((result, header) => {
    const name = header.name;

    if (!ignoredHeaders.has(name.toLowerCase()) && !name.includes(':'))
      result.append(name, header.value);


    return result;
  }, new Headers());

  const headers: HeadersInit = {};
  for (const headerArray of headerData)
    headers[headerArray[0]] = headerArray[1];


  const credentials = resource.request.cookies.length ||
          requestHeaders.some(({ name }) => credentialHeaders.has(name.toLowerCase())) ?
    'include' :
    'omit';

  const referrerHeader = requestHeaders.find(({ name }) => name.toLowerCase() === 'referer');

  const referrer = referrerHeader ? referrerHeader.value : void 0;

  const requestBody = await fetchRequestPostData(resource);

  const fetchOptions: RequestInit = {
    headers: Object.keys(headers).length ? headers : void 0,
    referrer,
    body: requestBody,
    method: resource.request.method,
    mode: 'cors',
  };

  if (style === FetchStyle.NODE_JS) {
    const cookieHeader = requestHeaders.find(header => header.name.toLowerCase() === 'cookie');
    const extraHeaders: HeadersInit = {};
    // According to https://www.npmjs.com/package/node-fetch#class-request the
    // following properties are not implemented in Node.js.
    delete fetchOptions.mode;
    if (cookieHeader)
      extraHeaders['cookie'] = cookieHeader.value;

    if (referrer) {
      delete fetchOptions.referrer;
      extraHeaders['Referer'] = referrer;
    }
    if (Object.keys(extraHeaders).length) {
      fetchOptions.headers = {
        ...headers,
        ...extraHeaders,
      };
    }
  } else {
    fetchOptions.credentials = credentials;
  }

  const options = JSON.stringify(fetchOptions, null, 2);
  return `fetch(${url}, ${options});`;
}

async function fetchRequestPostData(resource: Entry) {
  return resource.request.postData?._sha1 ? await fetch(`sha1/${resource.request.postData._sha1}`).then(r => r.text()) : resource.request.postData?.text;
}