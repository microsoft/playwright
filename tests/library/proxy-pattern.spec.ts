/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { parsePattern } from '../../packages/playwright-core/lib/common/socksProxy';
import { playwrightTest as test, expect } from '../config/browserTest';

test('socks proxy patter matcher', async ({}) => {
  const m1 = parsePattern('*');
  expect.soft(m1('example.com', 80)).toBe(true);
  expect.soft(m1('some.long.example.com', 80)).toBe(true);
  expect.soft(m1('localhost', 3000)).toBe(true);
  expect.soft(m1('foo.localhost', 3000)).toBe(true);
  expect.soft(m1('127.0.0.1', 9222)).toBe(true);
  expect.soft(m1('123.123.123.123', 9222)).toBe(true);
  expect.soft(m1('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(true);
  expect.soft(m1('[::1]', 5000)).toBe(true);

  const m2 = parsePattern('<loopback>');
  expect.soft(m2('example.com', 80)).toBe(false);
  expect.soft(m2('some.long.example.com', 80)).toBe(false);
  expect.soft(m2('localhost', 3000)).toBe(true);
  expect.soft(m2('foo.localhost', 3000)).toBe(true);
  expect.soft(m2('127.0.0.1', 9222)).toBe(true);
  expect.soft(m2('123.123.123.123', 9222)).toBe(false);
  expect.soft(m2('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m2('[::1]', 5000)).toBe(true);

  const m3 = parsePattern('<loopback>:3000');
  expect.soft(m3('example.com', 80)).toBe(false);
  expect.soft(m3('some.long.example.com', 80)).toBe(false);
  expect.soft(m3('localhost', 3000)).toBe(true);
  expect.soft(m3('foo.localhost', 3000)).toBe(true);
  expect.soft(m3('127.0.0.1', 9222)).toBe(false);
  expect.soft(m3('123.123.123.123', 9222)).toBe(false);
  expect.soft(m3('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m3('[::1]', 5000)).toBe(false);

  const m4 = parsePattern('.com:80');
  expect.soft(m4('example.com', 80)).toBe(true);
  expect.soft(m4('some.long.example.com', 80)).toBe(true);
  expect.soft(m4('localhost', 3000)).toBe(false);
  expect.soft(m4('foo.localhost', 3000)).toBe(false);
  expect.soft(m4('127.0.0.1', 9222)).toBe(false);
  expect.soft(m4('123.123.123.123', 9222)).toBe(false);
  expect.soft(m4('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m4('[::1]', 5000)).toBe(false);

  const m5 = parsePattern('example.com');
  expect.soft(m5('example.com', 80)).toBe(true);
  expect.soft(m5('some.long.example.com', 80)).toBe(false);
  expect.soft(m5('localhost', 3000)).toBe(false);
  expect.soft(m5('foo.localhost', 3000)).toBe(false);
  expect.soft(m5('127.0.0.1', 9222)).toBe(false);
  expect.soft(m5('123.123.123.123', 9222)).toBe(false);
  expect.soft(m5('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m5('[::1]', 5000)).toBe(false);

  const m6 = parsePattern('*.com');
  expect.soft(m6('example.com', 80)).toBe(true);
  expect.soft(m6('some.long.example.com', 80)).toBe(true);
  expect.soft(m6('localhost', 3000)).toBe(false);
  expect.soft(m6('foo.localhost', 3000)).toBe(false);
  expect.soft(m6('127.0.0.1', 9222)).toBe(false);
  expect.soft(m6('123.123.123.123', 9222)).toBe(false);
  expect.soft(m6('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m6('[::1]', 5000)).toBe(false);

  const m7 = parsePattern('123.123.123.123:9222');
  expect.soft(m7('example.com', 80)).toBe(false);
  expect.soft(m7('some.long.example.com', 80)).toBe(false);
  expect.soft(m7('localhost', 3000)).toBe(false);
  expect.soft(m7('foo.localhost', 3000)).toBe(false);
  expect.soft(m7('127.0.0.1', 9222)).toBe(false);
  expect.soft(m7('123.123.123.123', 9222)).toBe(true);
  expect.soft(m7('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m7('[::1]', 5000)).toBe(false);

  const m8 = parsePattern('example.com:80,localhost,*:9222');
  expect.soft(m8('example.com', 80)).toBe(true);
  expect.soft(m8('some.long.example.com', 80)).toBe(false);
  expect.soft(m8('localhost', 3000)).toBe(true);
  expect.soft(m8('foo.localhost', 3000)).toBe(false);
  expect.soft(m8('127.0.0.1', 9222)).toBe(true);
  expect.soft(m8('123.123.123.123', 9222)).toBe(true);
  expect.soft(m8('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m8('[::1]', 5000)).toBe(false);

  const m9 = parsePattern('127.*.*.1');
  expect.soft(m9('example.com', 80)).toBe(false);
  expect.soft(m9('some.long.example.com', 80)).toBe(false);
  expect.soft(m9('localhost', 3000)).toBe(false);
  expect.soft(m9('foo.localhost', 3000)).toBe(false);
  expect.soft(m9('127.0.0.1', 9222)).toBe(false);
  expect.soft(m9('123.123.123.123', 9222)).toBe(false);
  expect.soft(m9('[2001:db8:3333:4444:CCCC:DDDD:EEEE:FFFF]', 8080)).toBe(false);
  expect.soft(m9('[::1]', 5000)).toBe(false);

  const m10 = parsePattern('foo?/bar.*.com');
  expect.soft(m10('foo?/bar.X.com', 80)).toBe(true);
  expect.soft(m10('foo?/bar.Y.com', 80)).toBe(true);
  expect.soft(m10('foo?/bar.com', 80)).toBe(false);
  expect.soft(m10('fo/bar.X.com', 80)).toBe(false);
  expect.soft(m10('fo?/bar.X.com', 80)).toBe(false);
});
