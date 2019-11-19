#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const util = require('util');
const fs = require('fs');
const path = require('path');
const playwright = require('..');
const DEVICES_URL = 'https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/master/front_end/emulated_devices/module.json';

const template = `/**
 * Copyright 2017 Google Inc. All rights reserved.
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

module.exports = %s;
for (const device of module.exports)
  module.exports[device.name] = device;
`;

const help = `Usage:  node ${path.basename(__filename)} [-u <from>] <outputPath>
  -u, --url    The URL to load devices descriptor from. If not set,
               devices will be fetched from the tip-of-tree of DevTools
               frontend.

  -h, --help   Show this help message

Fetch Chrome DevTools front-end emulation devices from given URL, convert them to playwright
devices and save to the <outputPath>.
`;

const argv = require('minimist')(process.argv.slice(2), {
  alias: { u: 'url', h: 'help' },
});

if (argv.help) {
  console.log(help);
  return;
}

const url = argv.url || DEVICES_URL;
const outputPath = argv._[0];
if (!outputPath) {
  console.log('ERROR: output file name is missing. Use --help for help.');
  return;
}

main(url);

async function main(url) {
  const browser = await playwright.launch();
  const chromeVersion = (await browser.version()).split('/').pop();
  await browser.close();
  console.log('GET ' + url);
  const text = await httpGET(url);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error(`FAILED: error parsing response - ${e.message}`);
    return;
  }
  const devicePayloads = json.extensions.filter(extension => extension.type === 'emulated-device').map(extension => extension.device);
  let devices = [];
  for (const payload of devicePayloads) {
    let names = [];
    if (payload.title === 'iPhone 6/7/8')
      names = ['iPhone 6', 'iPhone 7', 'iPhone 8'];
    else if (payload.title === 'iPhone 6/7/8 Plus')
      names = ['iPhone 6 Plus', 'iPhone 7 Plus', 'iPhone 8 Plus'];
    else if (payload.title === 'iPhone 5/SE')
      names = ['iPhone 5', 'iPhone SE'];
    else
      names = [payload.title];
    for (const name of names) {
      const device = createDevice(chromeVersion, name, payload, false);
      const landscape = createDevice(chromeVersion, name, payload, true);
      devices.push(device);
      if (landscape.viewport.width !== device.viewport.width || landscape.viewport.height !== device.viewport.height)
        devices.push(landscape);
    }
  }
  devices = devices.filter(device => device.viewport.isMobile);
  devices.sort((a, b) => a.name.localeCompare(b.name));
  // Use single-quotes instead of double-quotes to conform with codestyle.
  const serialized = JSON.stringify(devices, null, 2)
      .replace(/'/g, `\\'`)
      .replace(/"/g, `'`);
  const result = util.format(template, serialized);
  fs.writeFileSync(outputPath, result, 'utf8');
}

/**
 * @param {string} chromeVersion
 * @param {string} deviceName
 * @param {*} descriptor
 * @param {boolean} landscape
 * @return {!Object}
 */
function createDevice(chromeVersion, deviceName, descriptor, landscape) {
  const devicePayload = loadFromJSONV1(descriptor);
  const viewportPayload = landscape ? devicePayload.horizontal : devicePayload.vertical;
  return {
    name: deviceName + (landscape ? ' landscape' : ''),
    userAgent: devicePayload.userAgent.includes('%s') ? util.format(devicePayload.userAgent, chromeVersion) : devicePayload.userAgent,
    viewport: {
      width: viewportPayload.width,
      height: viewportPayload.height,
      deviceScaleFactor: devicePayload.deviceScaleFactor,
      isMobile: devicePayload.capabilities.includes('mobile'),
      hasTouch: devicePayload.capabilities.includes('touch'),
      isLandscape: landscape || false
    }
  };
}

/**
 * @param {*} json
 * @return {?Object}
 */
function loadFromJSONV1(json) {
  /**
   * @param {*} object
   * @param {string} key
   * @param {string} type
   * @param {*=} defaultValue
   * @return {*}
   */
  function parseValue(object, key, type, defaultValue) {
    if (typeof object !== 'object' || object === null || !object.hasOwnProperty(key)) {
      if (typeof defaultValue !== 'undefined')
        return defaultValue;
      throw new Error('Emulated device is missing required property \'' + key + '\'');
    }
    const value = object[key];
    if (typeof value !== type || value === null)
      throw new Error('Emulated device property \'' + key + '\' has wrong type \'' + typeof value + '\'');
    return value;
  }

  /**
   * @param {*} object
   * @param {string} key
   * @return {number}
   */
  function parseIntValue(object, key) {
    const value = /** @type {number} */ (parseValue(object, key, 'number'));
    if (value !== Math.abs(value))
      throw new Error('Emulated device value \'' + key + '\' must be integer');
    return value;
  }

  /**
   * @param {*} json
   * @return {!{width: number, height: number}}
   */
  function parseOrientation(json) {
    const result = {};
    const minDeviceSize = 50;
    const maxDeviceSize = 9999;
    result.width = parseIntValue(json, 'width');
    if (result.width < 0 || result.width > maxDeviceSize ||
        result.width < minDeviceSize)
      throw new Error('Emulated device has wrong width: ' + result.width);

    result.height = parseIntValue(json, 'height');
    if (result.height < 0 || result.height > maxDeviceSize ||
        result.height < minDeviceSize)
      throw new Error('Emulated device has wrong height: ' + result.height);

    return /** @type {!{width: number, height: number}} */ (result);
  }

  const result = {};
  result.type = /** @type {string} */ (parseValue(json, 'type', 'string'));
  result.userAgent = /** @type {string} */ (parseValue(json, 'user-agent', 'string'));

  const capabilities = parseValue(json, 'capabilities', 'object', []);
  if (!Array.isArray(capabilities))
    throw new Error('Emulated device capabilities must be an array');
  result.capabilities = [];
  for (let i = 0; i < capabilities.length; ++i) {
    if (typeof capabilities[i] !== 'string')
      throw new Error('Emulated device capability must be a string');
    result.capabilities.push(capabilities[i]);
  }

  result.deviceScaleFactor = /** @type {number} */ (parseValue(json['screen'], 'device-pixel-ratio', 'number'));
  if (result.deviceScaleFactor < 0 || result.deviceScaleFactor > 100)
    throw new Error('Emulated device has wrong deviceScaleFactor: ' + result.deviceScaleFactor);

  result.vertical = parseOrientation(parseValue(json['screen'], 'vertical', 'object'));
  result.horizontal = parseOrientation(parseValue(json['screen'], 'horizontal', 'object'));
  return result;
}

/**
 * @param {url}
 * @return {!Promise}
 */
function httpGET(url) {
  let fulfill, reject;
  const promise = new Promise((res, rej) => {
    fulfill = res;
    reject = rej;
  });
  const driver = url.startsWith('https://') ? require('https') : require('http');
  const request = driver.get(url, response => {
    let data = '';
    response.setEncoding('utf8');
    response.on('data', chunk => data += chunk);
    response.on('end', () => fulfill(data));
    response.on('error', reject);
  });
  request.on('error', reject);
  return promise;
}
