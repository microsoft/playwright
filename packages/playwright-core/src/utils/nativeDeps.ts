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

// - This file is used to execute 'npx playwright install-deps'
// - The reverse mappings "lib2package" are generated with the following script:
//     ./utils/linux-browser-dependencies/run.sh ubuntu:20.04

export const deps: any = {
  'ubuntu18.04': {
    tools: [
      'xvfb',
      'fonts-noto-color-emoji',
      'ttf-unifont',
      'libfontconfig',
      'libfreetype6',
      'xfonts-cyrillic',
      'xfonts-scalable',
      'fonts-liberation',
      'fonts-ipafont-gothic',
      'fonts-wqy-zenhei',
      'fonts-tlwg-loma-otf',
      'ttf-ubuntu-font-family',
    ],
    chromium: [
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
      'libnspr4',
      'libnss3',
      'libpango-1.0-0',
      'libx11-6',
      'libxcb1',
      'libxcomposite1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxkbcommon0',
      'libxrandr2'
    ],
    firefox: [
      'libasound2',
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
      'libxrandr2',
      'libxrender1',
      'libxtst6'
    ],
    webkit: [
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libbrotli1',
      'libcairo2',
      'libegl1',
      'libenchant1c2a',
      'libepoxy0',
      'libevdev2',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libgl1',
      'libgles2',
      'libglib2.0-0',
      'libgstreamer-gl1.0-0',
      'libgstreamer-plugins-bad1.0-0',
      'libgstreamer-plugins-base1.0-0',
      'libgstreamer1.0-0',
      'libgtk-3-0',
      'libgudev-1.0-0',
      'libharfbuzz-icu0',
      'libharfbuzz0b',
      'libhyphen0',
      'libjavascriptcoregtk-4.0-18',
      'libjpeg-turbo8',
      'liblcms2-2',
      'libnotify4',
      'libopenjp2-7',
      'libopus0',
      'libpango-1.0-0',
      'libpng16-16',
      'libsecret-1-0',
      'libsoup2.4-1',
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
      'libxslt1.1'
    ],
    lib2package: {
      'libasound.so.2': 'libasound2',
      'libatk-1.0.so.0': 'libatk1.0-0',
      'libatk-bridge-2.0.so.0': 'libatk-bridge2.0-0',
      'libatspi.so.0': 'libatspi2.0-0',
      'libbrotlidec.so.1': 'libbrotli1',
      'libcairo-gobject.so.2': 'libcairo-gobject2',
      'libcairo.so.2': 'libcairo2',
      'libcups.so.2': 'libcups2',
      'libdbus-1.so.3': 'libdbus-1-3',
      'libdbus-glib-1.so.2': 'libdbus-glib-1-2',
      'libdrm.so.2': 'libdrm2',
      'libEGL.so.1': 'libegl1',
      'libenchant.so.1': 'libenchant1c2a',
      'libepoxy.so.0': 'libepoxy0',
      'libevdev.so.2': 'libevdev2',
      'libfontconfig.so.1': 'libfontconfig1',
      'libfreetype.so.6': 'libfreetype6',
      'libgbm.so.1': 'libgbm1',
      'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf2.0-0',
      'libgdk-3.so.0': 'libgtk-3-0',
      'libgio-2.0.so.0': 'libglib2.0-0',
      'libGL.so.1': 'libgl1',
      'libGLESv2.so.2': 'libgles2',
      'libglib-2.0.so.0': 'libglib2.0-0',
      'libgmodule-2.0.so.0': 'libglib2.0-0',
      'libgobject-2.0.so.0': 'libglib2.0-0',
      'libgstapp-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstaudio-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstbase-1.0.so.0': 'libgstreamer1.0-0',
      'libgstcodecparsers-1.0.so.0': 'libgstreamer-plugins-bad1.0-0',
      'libgstfft-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstgl-1.0.so.0': 'libgstreamer-gl1.0-0',
      'libgstpbutils-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstreamer-1.0.so.0': 'libgstreamer1.0-0',
      'libgsttag-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstvideo-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgtk-3.so.0': 'libgtk-3-0',
      'libgudev-1.0.so.0': 'libgudev-1.0-0',
      'libharfbuzz-icu.so.0': 'libharfbuzz-icu0',
      'libharfbuzz.so.0': 'libharfbuzz0b',
      'libhyphen.so.0': 'libhyphen0',
      'libjavascriptcoregtk-4.0.so.18': 'libjavascriptcoregtk-4.0-18',
      'libjpeg.so.8': 'libjpeg-turbo8',
      'liblcms2.so.2': 'liblcms2-2',
      'libnotify.so.4': 'libnotify4',
      'libnspr4.so': 'libnspr4',
      'libnss3.so': 'libnss3',
      'libnssutil3.so': 'libnss3',
      'libopenjp2.so.7': 'libopenjp2-7',
      'libopus.so.0': 'libopus0',
      'libpango-1.0.so.0': 'libpango-1.0-0',
      'libpangocairo-1.0.so.0': 'libpangocairo-1.0-0',
      'libpng16.so.16': 'libpng16-16',
      'libsecret-1.so.0': 'libsecret-1-0',
      'libsmime3.so': 'libnss3',
      'libsoup-2.4.so.1': 'libsoup2.4-1',
      'libwayland-client.so.0': 'libwayland-client0',
      'libwayland-egl.so.1': 'libwayland-egl1',
      'libwayland-server.so.0': 'libwayland-server0',
      'libwebkit2gtk-4.0.so.37': 'libwebkit2gtk-4.0-37',
      'libwebp.so.6': 'libwebp6',
      'libwebpdemux.so.2': 'libwebpdemux2',
      'libwoff2dec.so.1.0.2': 'libwoff1',
      'libX11-xcb.so.1': 'libx11-xcb1',
      'libX11.so.6': 'libx11-6',
      'libxcb-shm.so.0': 'libxcb-shm0',
      'libxcb.so.1': 'libxcb1',
      'libXcomposite.so.1': 'libxcomposite1',
      'libXcursor.so.1': 'libxcursor1',
      'libXdamage.so.1': 'libxdamage1',
      'libXext.so.6': 'libxext6',
      'libXfixes.so.3': 'libxfixes3',
      'libXi.so.6': 'libxi6',
      'libxkbcommon.so.0': 'libxkbcommon0',
      'libxml2.so.2': 'libxml2',
      'libXrandr.so.2': 'libxrandr2',
      'libXrender.so.1': 'libxrender1',
      'libxslt.so.1': 'libxslt1.1',
      'libXtst.so.6': 'libxtst6',
    },
  },

  'ubuntu20.04': {
    tools: [
      'xvfb',
      'fonts-noto-color-emoji',
      'ttf-unifont',
      'libfontconfig',
      'libfreetype6',
      'xfonts-cyrillic',
      'xfonts-scalable',
      'fonts-liberation',
      'fonts-ipafont-gothic',
      'fonts-wqy-zenhei',
      'fonts-tlwg-loma-otf',
      'ttf-ubuntu-font-family',
    ],
    chromium: [
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
      'libnspr4',
      'libnss3',
      'libpango-1.0-0',
      'libx11-6',
      'libxcb1',
      'libxcomposite1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxkbcommon0',
      'libxrandr2'
    ],
    firefox: [
      'libasound2',
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
      'libxrandr2',
      'libxrender1',
      'libxtst6'
    ],
    webkit: [
      'libatk-bridge2.0-0',
      'libatk1.0-0',
      'libcairo2',
      'libegl1',
      'libenchant1c2a',
      'libepoxy0',
      'libevdev2',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf2.0-0',
      'libgles2',
      'libglib2.0-0',
      'libglx0',
      'libgstreamer-gl1.0-0',
      'libgstreamer-plugins-bad1.0-0',
      'libgstreamer-plugins-base1.0-0',
      'libgstreamer1.0-0',
      'libgtk-3-0',
      'libgudev-1.0-0',
      'libharfbuzz-icu0',
      'libharfbuzz0b',
      'libhyphen0',
      'libicu66',
      'libjavascriptcoregtk-4.0-18',
      'libjpeg-turbo8',
      'liblcms2-2',
      'libnotify4',
      'libopengl0',
      'libopenjp2-7',
      'libopus0',
      'libpango-1.0-0',
      'libpng16-16',
      'libsecret-1-0',
      'libsoup2.4-1',
      'libwayland-client0',
      'libwayland-egl1',
      'libwayland-server0',
      'libwebkit2gtk-4.0-37',
      'libwebp6',
      'libwebpdemux2',
      'libwoff1',
      'libwpe-1.0-1',
      'libwpebackend-fdo-1.0-1',
      'libwpewebkit-1.0-3',
      'libx11-6',
      'libxcomposite1',
      'libxdamage1',
      'libxkbcommon0',
      'libxml2',
      'libxslt1.1'
    ],
    lib2package: {
      'libasound.so.2': 'libasound2',
      'libatk-1.0.so.0': 'libatk1.0-0',
      'libatk-bridge-2.0.so.0': 'libatk-bridge2.0-0',
      'libatspi.so.0': 'libatspi2.0-0',
      'libcairo-gobject.so.2': 'libcairo-gobject2',
      'libcairo.so.2': 'libcairo2',
      'libcups.so.2': 'libcups2',
      'libdbus-1.so.3': 'libdbus-1-3',
      'libdbus-glib-1.so.2': 'libdbus-glib-1-2',
      'libdrm.so.2': 'libdrm2',
      'libEGL.so.1': 'libegl1',
      'libenchant.so.1': 'libenchant1c2a',
      'libepoxy.so.0': 'libepoxy0',
      'libevdev.so.2': 'libevdev2',
      'libfontconfig.so.1': 'libfontconfig1',
      'libfreetype.so.6': 'libfreetype6',
      'libgbm.so.1': 'libgbm1',
      'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf2.0-0',
      'libgdk-3.so.0': 'libgtk-3-0',
      'libgio-2.0.so.0': 'libglib2.0-0',
      'libGLESv2.so.2': 'libgles2',
      'libglib-2.0.so.0': 'libglib2.0-0',
      'libGLX.so.0': 'libglx0',
      'libgmodule-2.0.so.0': 'libglib2.0-0',
      'libgobject-2.0.so.0': 'libglib2.0-0',
      'libgstapp-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstaudio-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstbase-1.0.so.0': 'libgstreamer1.0-0',
      'libgstcodecparsers-1.0.so.0': 'libgstreamer-plugins-bad1.0-0',
      'libgstfft-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstgl-1.0.so.0': 'libgstreamer-gl1.0-0',
      'libgstpbutils-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstreamer-1.0.so.0': 'libgstreamer1.0-0',
      'libgsttag-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstvideo-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgtk-3.so.0': 'libgtk-3-0',
      'libgudev-1.0.so.0': 'libgudev-1.0-0',
      'libharfbuzz-icu.so.0': 'libharfbuzz-icu0',
      'libharfbuzz.so.0': 'libharfbuzz0b',
      'libhyphen.so.0': 'libhyphen0',
      'libicui18n.so.66': 'libicu66',
      'libicuuc.so.66': 'libicu66',
      'libjavascriptcoregtk-4.0.so.18': 'libjavascriptcoregtk-4.0-18',
      'libjpeg.so.8': 'libjpeg-turbo8',
      'liblcms2.so.2': 'liblcms2-2',
      'libnotify.so.4': 'libnotify4',
      'libnspr4.so': 'libnspr4',
      'libnss3.so': 'libnss3',
      'libnssutil3.so': 'libnss3',
      'libOpenGL.so.0': 'libopengl0',
      'libopenjp2.so.7': 'libopenjp2-7',
      'libopus.so.0': 'libopus0',
      'libpango-1.0.so.0': 'libpango-1.0-0',
      'libpangocairo-1.0.so.0': 'libpangocairo-1.0-0',
      'libpng16.so.16': 'libpng16-16',
      'libsecret-1.so.0': 'libsecret-1-0',
      'libsmime3.so': 'libnss3',
      'libsoup-2.4.so.1': 'libsoup2.4-1',
      'libwayland-client.so.0': 'libwayland-client0',
      'libwayland-egl.so.1': 'libwayland-egl1',
      'libwayland-server.so.0': 'libwayland-server0',
      'libwebp.so.6': 'libwebp6',
      'libwebpdemux.so.2': 'libwebpdemux2',
      'libwoff2dec.so.1.0.2': 'libwoff1',
      'libX11-xcb.so.1': 'libx11-xcb1',
      'libX11.so.6': 'libx11-6',
      'libxcb-shm.so.0': 'libxcb-shm0',
      'libxcb.so.1': 'libxcb1',
      'libXcomposite.so.1': 'libxcomposite1',
      'libXcursor.so.1': 'libxcursor1',
      'libXdamage.so.1': 'libxdamage1',
      'libXext.so.6': 'libxext6',
      'libXfixes.so.3': 'libxfixes3',
      'libXi.so.6': 'libxi6',
      'libxkbcommon.so.0': 'libxkbcommon0',
      'libxml2.so.2': 'libxml2',
      'libXrandr.so.2': 'libxrandr2',
      'libXrender.so.1': 'libxrender1',
      'libxslt.so.1': 'libxslt1.1',
      'libXtst.so.6': 'libxtst6',
    },
  },

  'ubuntu21.04': {
    tools: [
      'xvfb',
      'fonts-noto-color-emoji',
      'ttf-unifont',
      'libfontconfig',
      'libfreetype6',
      'xfonts-cyrillic',
      'xfonts-scalable',
      'fonts-liberation',
      'fonts-ipafont-gothic',
      'fonts-wqy-zenhei',
      'fonts-tlwg-loma-otf',
      'ttf-ubuntu-font-family',
    ],
    chromium: [
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
      'libnspr4',
      'libnss3',
      'libpango-1.0-0',
      'libx11-6',
      'libxcb1',
      'libxcomposite1',
      'libxdamage1',
      'libxext6',
      'libxfixes3',
      'libxkbcommon0',
      'libxrandr2',
      'libxshmfence1'
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
      'libgdk-pixbuf-2.0-0',
      'libglib2.0-0',
      'libgtk-3-0',
      'libgtk2.0-0',
      'libharfbuzz0b',
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
      'libxt6'
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
      'libepoxy0',
      'libevdev2',
      'libfontconfig1',
      'libfreetype6',
      'libgdk-pixbuf-2.0-0',
      'libgl1',
      'libgles2',
      'libglib2.0-0',
      'libgstreamer-gl1.0-0',
      'libgstreamer-plugins-bad1.0-0',
      'libgstreamer-plugins-base1.0-0',
      'libgstreamer1.0-0',
      'libgtk-3-0',
      'libharfbuzz-icu0',
      'libharfbuzz0b',
      'libhyphen0',
      'libjavascriptcoregtk-4.0-18',
      'libjpeg-turbo8',
      'liblcms2-2',
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
      'libwebkit2gtk-4.0-37',
      'libwebp6',
      'libwebpdemux2',
      'libwoff1',
      'libwpe-1.0-1',
      'libwpebackend-fdo-1.0-1',
      'libwpewebkit-1.0-3',
      'libx11-6',
      'libxcomposite1',
      'libxdamage1',
      'libxkbcommon0',
      'libxml2',
      'libxslt1.1'
    ],
    lib2package: {
      'libasound.so.2': 'libasound2',
      'libatk-1.0.so.0': 'libatk1.0-0',
      'libatk-bridge-2.0.so.0': 'libatk-bridge2.0-0',
      'libatspi.so.0': 'libatspi2.0-0',
      'libcairo-gobject.so.2': 'libcairo-gobject2',
      'libcairo.so.2': 'libcairo2',
      'libcups.so.2': 'libcups2',
      'libdbus-1.so.3': 'libdbus-1-3',
      'libdbus-glib-1.so.2': 'libdbus-glib-1-2',
      'libdrm.so.2': 'libdrm2',
      'libEGL.so.1': 'libegl1',
      'libepoxy.so.0': 'libepoxy0',
      'libfontconfig.so.1': 'libfontconfig1',
      'libfreetype.so.6': 'libfreetype6',
      'libgbm.so.1': 'libgbm1',
      'libgdk_pixbuf-2.0.so.0': 'libgdk-pixbuf-2.0-0',
      'libgdk-3.so.0': 'libgtk-3-0',
      'libgdk-x11-2.0.so.0': 'libgtk2.0-0',
      'libgio-2.0.so.0': 'libglib2.0-0',
      'libGL.so.1': 'libgl1',
      'libGLESv2.so.2': 'libgles2',
      'libglib-2.0.so.0': 'libglib2.0-0',
      'libgmodule-2.0.so.0': 'libglib2.0-0',
      'libgobject-2.0.so.0': 'libglib2.0-0',
      'libgstapp-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstaudio-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstbase-1.0.so.0': 'libgstreamer1.0-0',
      'libgstcodecparsers-1.0.so.0': 'libgstreamer-plugins-bad1.0-0',
      'libgstfft-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstgl-1.0.so.0': 'libgstreamer-gl1.0-0',
      'libgstpbutils-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstreamer-1.0.so.0': 'libgstreamer1.0-0',
      'libgsttag-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgstvideo-1.0.so.0': 'libgstreamer-plugins-base1.0-0',
      'libgthread-2.0.so.0': 'libglib2.0-0',
      'libgtk-3.so.0': 'libgtk-3-0',
      'libgtk-x11-2.0.so.0': 'libgtk2.0-0',
      'libharfbuzz-icu.so.0': 'libharfbuzz-icu0',
      'libharfbuzz.so.0': 'libharfbuzz0b',
      'libhyphen.so.0': 'libhyphen0',
      'libjavascriptcoregtk-4.0.so.18': 'libjavascriptcoregtk-4.0-18',
      'libjpeg.so.8': 'libjpeg-turbo8',
      'liblcms2.so.2': 'liblcms2-2',
      'libnotify.so.4': 'libnotify4',
      'libnspr4.so': 'libnspr4',
      'libnss3.so': 'libnss3',
      'libnssutil3.so': 'libnss3',
      'libopenjp2.so.7': 'libopenjp2-7',
      'libopus.so.0': 'libopus0',
      'libpango-1.0.so.0': 'libpango-1.0-0',
      'libpangocairo-1.0.so.0': 'libpangocairo-1.0-0',
      'libpangoft2-1.0.so.0': 'libpangoft2-1.0-0',
      'libpng16.so.16': 'libpng16-16',
      'libsecret-1.so.0': 'libsecret-1-0',
      'libsmime3.so': 'libnss3',
      'libsoup-2.4.so.1': 'libsoup2.4-1',
      'libvpx.so.6': 'libvpx6',
      'libwayland-client.so.0': 'libwayland-client0',
      'libwayland-egl.so.1': 'libwayland-egl1',
      'libwayland-server.so.0': 'libwayland-server0',
      'libwebkit2gtk-4.0.so.37': 'libwebkit2gtk-4.0-37',
      'libwebp.so.6': 'libwebp6',
      'libwebpdemux.so.2': 'libwebpdemux2',
      'libwoff2dec.so.1.0.2': 'libwoff1',
      'libwpe-1.0.so.1': 'libwpe-1.0-1',
      'libWPEBackend-fdo-1.0.so.1': 'libwpebackend-fdo-1.0-1',
      'libWPEWebKit-1.0.so.3': 'libwpewebkit-1.0-3',
      'libX11-xcb.so.1': 'libx11-xcb1',
      'libX11.so.6': 'libx11-6',
      'libxcb-shm.so.0': 'libxcb-shm0',
      'libxcb.so.1': 'libxcb1',
      'libXcomposite.so.1': 'libxcomposite1',
      'libXcursor.so.1': 'libxcursor1',
      'libXdamage.so.1': 'libxdamage1',
      'libXext.so.6': 'libxext6',
      'libXfixes.so.3': 'libxfixes3',
      'libXi.so.6': 'libxi6',
      'libxkbcommon.so.0': 'libxkbcommon0',
      'libxml2.so.2': 'libxml2',
      'libXrandr.so.2': 'libxrandr2',
      'libXrender.so.1': 'libxrender1',
      'libxshmfence.so.1': 'libxshmfence1',
      'libxslt.so.1': 'libxslt1.1',
      'libXt.so.6': 'libxt6',
    },
  }
};

deps['ubuntu20.04-arm64'] = {
  tools: [...deps['ubuntu20.04'].tools],
  chromium: [...deps['ubuntu20.04'].chromium],
  firefox: [
    ...deps['ubuntu20.04'].firefox,
  ],
  webkit: [
    ...deps['ubuntu20.04'].webkit,
    'libevent-2.1-7',
  ],
  lib2package: {
    ...deps['ubuntu20.04'].lib2package,
    'libevent-2.1.so.7': 'libevent-2.1.so.7',
  },
};

