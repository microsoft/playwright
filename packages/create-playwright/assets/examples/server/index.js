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
// @ts-check
const path = require('path');
const http = require('http');
const fs = require('fs');

const port = 4345;

class Server {
  constructor() {
    this._server = http.createServer(this._handle.bind(this));
  }
  /**
   * 
   * @param {import('http').IncomingMessage} req 
   * @param {import('http').ServerResponse} res 
   */
  _handle(req, res) {
    switch (req.url) {
      case '/cookies':
        res.setHeader('Set-Cookie', 'this-is=Playwright');
        res.end('Cookies set!');
        break;

      case '/cookies/protected':
        /** @type{Record<string, string>} */
        const cookies = (req.headers.cookie || '').split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          return {
            ...acc,
            [name]: value,
          };
        }, {});
        if (cookies.product === 'Playwright') {
          res.end('Access granted!');
        } else {
          res.writeHead(403);
          res.end('Access denied!');
        }
        break;

      case '/api/v1/file-upload':
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          const lines = Buffer.concat(chunks).toString().split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') {
              res.end(lines.slice(0, i - 1).join('\n'))
              return;
            }
          }
        })
        break;

      default:
        const localFilePath = path.join(__dirname, 'assets', req.url === '/' ? 'index.html' : req.url);
        function shouldServe() {
          try {
            const result = fs.statSync(localFilePath)
            if (result.isDirectory())
              return false;
            return true
          } catch (error) {
            return false;
          }
        }
        if (!shouldServe()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const extension2ContentType = {
          '.html': 'text/html',
          '.json': 'application/json',
        }
        const contentType = extension2ContentType[path.extname(localFilePath)];
        if (contentType)
          res.setHeader('Content-Type', contentType);
        const content = fs.readFileSync(localFilePath);
        res.end(content);
        break;
    }
  }
  /**
   * @param {number} port 
   */
  async listen(port) {
    await new Promise(resolve => this._server.listen(port, () => resolve));
  }
}

(async () => {
  console.log(`Listening on http://127.0.0.1:${port}`);
  await new Server().listen(port);
})()
