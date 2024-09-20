/**
 * Copyright (c) 2014-present Matt Zabriskie
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import { contextTest as it, expect } from '../config/browserTest';
import util from 'util';
import zlib from 'zlib';

const gzip = util.promisify(zlib.gzip);
const deflate = util.promisify(zlib.deflate);
const brotliCompress = util.promisify(zlib.brotliCompress);

it.skip(({ mode }) => mode !== 'default');

it.describe('algorithms', () => {
  const responseBody = 'str';

  for (const [type, zipped] of Object.entries({
    gzip: gzip(responseBody),
    deflate: deflate(responseBody),
    br: brotliCompress(responseBody)
  })) {
    it.describe(`${type} decompression`, () => {
      it(`should support decompression`, async ({ context, server }) => {
        server.setRoute('/compressed', async (req, res) => {
          res.setHeader('Content-Encoding', type);
          res.end(await zipped);
        });

        const response = await context.request.get(server.PREFIX + '/compressed');
        expect(await response.text()).toEqual(responseBody);
      });

      it(`should not fail if response content-length header is missing (${type})`, async ({ context, server }) => {
        server.setRoute('/compressed', async (req, res) => {
          res.setHeader('Content-Encoding', type);
          res.removeHeader('Content-Length');
          res.end(await zipped);
        });

        const response = await context.request.get(server.PREFIX + '/compressed');
        expect(await response.text()).toEqual(responseBody);
      });

      it('should not fail with chunked responses (without Content-Length header)', async ({ context, server }) => {
        server.setRoute('/compressed', async (req, res) => {
          res.setHeader('Content-Encoding', type);
          res.setHeader('Transfer-Encoding', 'chunked');
          res.removeHeader('Content-Length');
          res.write(await zipped);
          res.end();
        });

        const response = await context.request.get(server.PREFIX + '/compressed');
        expect(await response.text()).toEqual(responseBody);
      });

      it('should not fail with an empty response without content-length header (Z_BUF_ERROR)', async ({ context, server }) => {
        server.setRoute('/compressed', async (req, res) => {
          res.setHeader('Content-Encoding', type);
          res.removeHeader('Content-Length');
          res.end();
        });

        const response = await context.request.get(server.PREFIX + '/compressed');
        expect(await response.text()).toEqual('');
      });

      it('should not fail with an empty response with content-length header (Z_BUF_ERROR)', async ({ context, server }) => {
        server.setRoute('/compressed', async (req, res) => {
          res.setHeader('Content-Encoding', type);
          res.end();
        });

        await context.request.get(server.PREFIX + '/compressed');
      });
    });
  }
});
