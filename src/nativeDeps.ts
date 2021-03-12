/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

// This file is used to:
// - Generate Dockerfile.* files
// - Build GitHubAction
// - Execute 'npx playwright install-deps'

export const deps = {
  bionic: {
    tools: [
      'xvfb',
    ],
    chromium: [
      'fonts-liberation',
      'libasound2',
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libatspi2.0-0',
      'libcairo2',
      'libcups2',
      'libdbus-1-3',
      'libdrm2',
      'libgbm1',
      'libglib2.0-0',
      'libgtk-3-0',
      'libnspr4',
      'libnss3',
      'libpango-1.0-0',
      'libx11-6',
      'libxcb1',
      'libxcomposite1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxrandr2',
    ],
    firefox: [
      'ffmpeg',
      'libatk1.0-0',
      'libcairo-gobject2',
      'libcairo2',
      'libdbus-1-3',
      'libdbus-glib-1-2',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libglib2.0-0',
      'libgtk-3-0',
      'libpango-1.0-0',
      'libpangocairo-1.0-0',
      'libpangoft2-1.0-0',
      'libx11-6',
      'libx11-xcb1',
      'libxcb-shm0',
      'libxcb1',
      'libxcomposite1',
      'libxcursor1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxi6',
      'libxrender1',
      'libxt6',
    ],
    webkit: [
      'gstreamer1.0-libav',
      'gstreamer1.0-plugins-bad',
      'gstreamer1.0-plugins-base',
      'gstreamer1.0-plugins-good',
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libbrotli1',
      'libcairo2',
      'libegl1',
      'libenchant1c2a',
      'libepoxy0',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libgl1',
      'libgles2',
      'libglib2.0-0',
      'libgstreamer-gl1.0-0',
      'libgstreamer1.0-0',
      'libgtk-3-0',
      'libharfbuzz-icu0',
      'libharfbuzz0b',
      'libhyphen0',
      'libicu60',
      'libjpeg-turbo8',
      'libnotify4',
      'libopenjp2-7',
      'libopus0',
      'libpango-1.0-0',
      'libpng16-16',
      'libsecret-1-0',
      'libvpx5',
      'libwayland-client0',
      'libwayland-egl1',
      'libwayland-server0',
      'libwebp6',
      'libwebpdemux2',
      'libwoff1',
      'libx11-6',
      'libxcomposite1',
      'libxdamage1',
      'libxkbcommon0',
      'libxml2',
      'libxslt1.1',
    ],
  },

  focal: {
    tools: [
      'xvfb',
    ],
    chromium: [
      'fonts-liberation',
      'libasound2',
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libatspi2.0-0',
      'libcairo2',
      'libcups2',
      'libdbus-1-3',
      'libdrm2',
      'libgbm1',
      'libglib2.0-0',
      'libgtk-3-0',
      'libnspr4',
      'libnss3',
      'libpango-1.0-0',
      'libx11-6',
      'libxcb1',
      'libxcomposite1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxrandr2',
    ],
    firefox: [
      'ffmpeg',
      'libatk1.0-0',
      'libcairo-gobject2',
      'libcairo2',
      'libdbus-1-3',
      'libdbus-glib-1-2',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libglib2.0-0',
      'libgtk-3-0',
      'libpango-1.0-0',
      'libpangocairo-1.0-0',
      'libpangoft2-1.0-0',
      'libx11-6',
      'libx11-xcb1',
      'libxcb-shm0',
      'libxcb1',
      'libxcomposite1',
      'libxcursor1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxi6',
      'libxrender1',
      'libxt6',
    ],
    webkit: [
      'gstreamer1.0-libav',
      'gstreamer1.0-plugins-bad',
      'gstreamer1.0-plugins-base',
      'gstreamer1.0-plugins-good',
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libcairo2',
      'libegl1',
      'libenchant1c2a',
      'libepoxy0',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libgl1',
      'libgles2',
      'libglib2.0-0',
      'libgstreamer-gl1.0-0',
      'libgstreamer1.0-0',
      'libgtk-3-0',
      'libharfbuzz-icu0',
      'libharfbuzz0b',
      'libhyphen0',
      'libicu66',
      'libjpeg-turbo8',
      'libnotify4',
      'libopenjp2-7',
      'libopus0',
      'libpango-1.0-0',
      'libpng16-16',
      'libsecret-1-0',
      'libsoup2.4-1',
      'libvpx6',
      'libwayland-client0',
      'libwayland-egl1',
      'libwayland-server0',
      'libwebp6',
      'libwebpdemux2',
      'libwoff1',
      'libx11-6',
      'libxcomposite1',
      'libxdamage1',
      'libxkbcommon0',
      'libxml2',
      'libxslt1.1',
    ],
  },
};

