"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startProfiling = startProfiling;
exports.stopProfiling = stopProfiling;
var fs = _interopRequireWildcard(require("fs"));
var path = _interopRequireWildcard(require("path"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

const profileDir = process.env.PWTEST_PROFILE_DIR || '';
let session;
async function startProfiling() {
  if (!profileDir) return;
  session = new (require('inspector').Session)();
  session.connect();
  await new Promise(f => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', f);
    });
  });
}
async function stopProfiling(profileName) {
  if (!profileDir) return;
  await new Promise(f => session.post('Profiler.stop', (err, {
    profile
  }) => {
    if (!err) {
      fs.mkdirSync(profileDir, {
        recursive: true
      });
      fs.writeFileSync(path.join(profileDir, profileName + '.json'), JSON.stringify(profile));
    }
    f();
  }));
}