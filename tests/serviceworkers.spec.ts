// Ignore these for now :) This is a scratch pad. Nothing to see here :)

// /**
//  * Copyright (c) Microsoft Corporation.
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  * http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */
// import { pageWithHar } from './har.spec';
// import { browserTest as it, expect } from './config/browserTest';

// it('works out of', () => {

// });

// it('should report service worker requests', async ({ contextFactory, server, browserName }, testInfo) => {
//   it.fail(browserName !== 'chromium');
//   const { context, page, getLog } = await pageWithHar(contextFactory, testInfo);
//   context.route('**', async route => {
//     if (route.request().url() === server.EMPTY_PAGE) {
//       await route.fulfill({
//         body: 'intercepted data'
//       });
//       return;
//     }
//     await route.continue();
//   });

//   server.setRoute('/worker.js', (_req, res) => {
//     res.setHeader('content-type', 'text/javascript');
//     res.write(`
//         addEventListener('message', async event => {
//           console.log('worker got message');
//           const resp = await fetch('${server.EMPTY_PAGE}')
//           event.source.postMessage(await resp.text());
//         });
//       `);
//     res.end();
//   });

//   server.setRoute('/example.html', (_req, res) => {
//     res.write(`
//         <!DOCTYPE html>
//         <html>
//           <head>
//             <title>SW Example</title>
//           </head>
//           <body>
//             <div id="content"></div>
//             <script>
//               if (navigator.serviceWorker) {
//                 navigator.serviceWorker.register('/worker.js');
//                 navigator.serviceWorker.addEventListener('message', event => {
//                   console.log('main got message');
//                   document.getElementById("content").innerText = event.data;
//                 });

//                 navigator.serviceWorker.ready.then(registration => {
//                   registration.active.postMessage("init");
//                 });
//               }
//             </script>
//           </body>
//         </html>
//       `);
//     res.end();
//   });

//   await page.goto(server.PREFIX + '/example.html');
//   await expect(page.locator('#content')).toHaveText('intercepted data');

//   const log = await getLog();

//   expect.soft(log.entries.filter(e => e.request.url.endsWith('worker.js')));
//   expect.soft(log.entries.filter(e => e.request.url === server.EMPTY_PAGE).map(e => ({ content: Buffer.from(e.response.content.text, 'base64').toString() }))).toEqual([{ content: 'intercepted data' }]);
// });

// it.describe('service workers', () => {
//   it('native fetch interception', async ({ page, server }) => {
//     server.setRoute('/worker.js', (_req, res) => {
//       res.setHeader('Content-Type', 'text/javascript');
//       res.write(`
//             let i = 0;
//             self.addEventListener('fetch', event => {
//               if (event.request.method != 'GET') return;
//               if (!event.request.url.endsWith('/payload.txt')) return;

//               event.respondWith(async function () {
//                   const cache = await caches.open('example');
//                   if (cache.match(event.request)) {
//                       i++;
//                       // Don't actually used the cached response
//                       return new Response('count ' + i, { headers: { 'Content-Typye': 'text/plain' }});
//                   }

//                   const resp = await fetch(event.request);
//                   cache.put(event.request, resp.clone());
//                   return resp;
//               }());
//             });
//           `);
//       res.end();
//     });

//     server.setRoute('/example.html', (_req, res) => {
//       res.write(`
//             <!DOCTYPE html>
//             <html>
//               <head>
//                 <title>SW</title>
//               </head>
//               <body>
//                 <div id="count">waiting</div>
//                 <script>
//                   navigator.serviceWorker.register('/worker.js');
//                   navigator.serviceWorker.ready.then(async registration => {
//                     const resp = await fetch('/payload.txt');
//                     document.getElementById('count').innerText = await resp.text();
//                   });
//                 </script>
//               </body>
//             </html>
//           `);
//       res.end();
//     });

//     server.setRoute('/payload.txt', (_req, res) => {
//       res.write('sever payload');
//       res.end();
//     });

//     await page.goto(server.PREFIX + '/example.html');
//     const count = page.locator('id=count');
//     await expect(count).toHaveText('sever payload');
//     await page.reload();
//     await expect(count).toHaveText('count 1');
//   });

//   it('works with with redirects on requests within worker', () => it.fixme(true, 'Expected behavior TBD; I think the browsers will yell if a SW is loaded from a service worker IRL.'));
//   it.describe('works with CORS requests', () => {

//     it('intercepts initial script', async ({ server, page, context, browserName }) => {
//       it.fail(true);
//       it.fail(browserName === 'firefox');
//       context.route('**', async route => {
//         if (route.request().url().endsWith('/worker.js')) {
//           await route.fulfill({
//             status: 200,
//             contentType: 'text/javascript',
//             body: `
//                 addEventListener('message', event => {
//                   console.log('worker got message');
//                   event.source.postMessage("intercepted data from the worker");
//                 });
//               `,
//           });
//           return;
//         }

//         await route.continue();
//       });

//       server.setRoute('/example.html', (_req, res) => {
//         res.write(`
//             <!DOCTYPE html>
//             <html>
//               <head>
//                 <title>SW Example</title>
//               </head>
//               <body>
//                 <div id="content"></div>
//                 <script>
//                   if (navigator.serviceWorker) {
//                     navigator.serviceWorker.register('${server.CROSS_PROCESS_PREFIX + '/worker.js'}');
//                     navigator.serviceWorker.addEventListener('message', event => {
//                       console.log('main got message');
//                       document.getElementById("content").innerText = event.data;
//                     });

//                     navigator.serviceWorker.ready.then(registration => {
//                       registration.active.postMessage("init");
//                     });
//                   }
//                 </script>
//               </body>
//             </html>
//           `);
//         res.end();
//       });

//       await page.goto(server.PREFIX + '/example.html');
//       await expect(page.locator('#content')).toHaveText('intercepted data from the worker');
//     });

//     it('intercepts requests from within worker', async ({ server, page, context, browserName }) => {

//       it.fail(browserName !== 'chromium');

//       context.route('**', async route => {
//         if (route.request().url() === server.EMPTY_PAGE) {
//           await route.fulfill({
//             body: 'intercepted data'
//           });
//           return;
//         }
//         await route.continue();
//       });

//       server.setRoute('/worker.js', (_req, res) => {
//         res.setHeader('content-type', 'text/javascript');
//         res.write(`
//             addEventListener('message', async event => {
//               console.log('worker got message');
//               const resp = await fetch('${server.EMPTY_PAGE}')
//               event.source.postMessage(await resp.text());
//             });
//           `);
//         res.end();
//       });

//       server.setRoute('/example.html', (_req, res) => {
//         res.write(`
//             <!DOCTYPE html>
//             <html>
//               <head>
//                 <title>SW Example</title>
//               </head>
//               <body>
//                 <div id="content"></div>
//                 <script>
//                   if (navigator.serviceWorker) {
//                     navigator.serviceWorker.register('/worker.js');
//                     navigator.serviceWorker.addEventListener('message', event => {
//                       console.log('main got message');
//                       document.getElementById("content").innerText = event.data;
//                     });

//                     navigator.serviceWorker.ready.then(registration => {
//                       registration.active.postMessage("init");
//                     });
//                   }
//                 </script>
//               </body>
//             </html>
//           `);
//         res.end();
//       });

//       await page.goto(server.PREFIX + '/example.html');
//       await expect(page.locator('#content')).toHaveText('intercepted data');
//     });
//   });
//   it('works with WebSockets', () => it.fixme());

//   it('works with preload', () => it.fixme(true, 'https://developer.mozilla.org/en-US/docs/Web/API/NavigationPreloadManager'));
//   it('works with cache API', () => it.fixme(true, 'https://developer.mozilla.org/en-US/docs/Web/API/caches'));

//   it('should report requests in HAR file', () => it.fixme());
// });
