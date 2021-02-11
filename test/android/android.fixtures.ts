/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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

import type { Android, AndroidDevice } from '../..';
import { folio as baseFolio } from '../fixtures';

const fixtures = baseFolio.extend<{
    device: AndroidDevice
  }, {
    android: Android,
  }>();

fixtures.device.init(async ({ playwright }, runTest) => {
  const [device] = await playwright._android.devices();
  await device.shell('am force-stop org.chromium.webview_shell');
  await device.shell('am force-stop com.android.chrome');
  device.setDefaultTimeout(120000);
  await runTest(device);
  await device.close();
});

export const folio = fixtures.build();
