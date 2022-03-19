/**
 * Copyright (c) Microsoft Corporation.
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

import path from "path";
import { electronTest as test, expect } from "./electronTest";

test("should support multi-window electron app with requestSingleInstanceLock", async ({
  playwright,
}) => {
  const firstApp = await playwright._electron.launch({
    args: [path.join(__dirname, "electron-multi-window-app.js")],
  });
  expect(firstApp.windows()).toHaveLength(1);
  const firstWindow = firstApp.windows()[0];
  await expect(firstWindow).toHaveTitle("Window 1");
  console.log("before second launch");
  try {
    await playwright._electron.launch({
      args: [path.join(__dirname, "electron-multi-window-app.js")],
    });
  } catch (error) {
    if (error.message !== "electron.launch: canceled") {
      throw error;
    }
  }
  console.log("after second launch");
  await firstApp.waitForEvent("window");
  expect(firstApp.windows()).toHaveLength(2);
  const secondWindow = firstApp.windows()[1];
  console.log("after second launch");
  await expect(secondWindow).toHaveTitle("Window 2");
  console.log("done");
  await firstApp.close();
});
