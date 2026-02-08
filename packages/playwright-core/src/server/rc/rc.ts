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

const statusEl = document.getElementById('status')!;
const display = document.getElementById('display') as HTMLImageElement;
const omnibox = document.getElementById('omnibox') as HTMLInputElement;
const screenEl = document.getElementById('screen')!;
const tabstrip = document.getElementById('tabstrip')!;
const captureHint = document.getElementById('capture-hint')!;
const noPagesEl = document.getElementById('no-pages')!;

function setStatus(text: string, cls?: string) {
  statusEl.textContent = text;
  statusEl.className = cls || '';
}

const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(wsProtocol + '//' + location.host + '/ws');

ws.onopen = () => setStatus('Connected', 'connected');
let viewportWidth = 0;
let viewportHeight = 0;
let resized = false;

function resizeToFit() {
  if (!viewportWidth || !viewportHeight || resized)
    return;
  resized = true;
  // Chrome height for tabbar + toolbar
  const chromeHeight = document.getElementById('tabbar')!.offsetHeight
                     + document.getElementById('toolbar')!.offsetHeight;
  // Window chrome (title bar, borders) = difference between outer and inner size
  const extraW = window.outerWidth - window.innerWidth;
  const extraH = window.outerHeight - window.innerHeight;
  // Target: screencast fits exactly, capped at screen size
  const targetW = Math.min(viewportWidth + extraW, screen.availWidth);
  const targetH = Math.min(viewportHeight + chromeHeight + extraH, screen.availHeight);
  window.resizeTo(targetW, targetH);
}

ws.onmessage = (event: MessageEvent) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'frame') {
    noPagesEl.classList.remove('visible');
    screenEl.style.display = '';
    display.src = 'data:image/jpeg;base64,' + msg.data;
    if (msg.viewportWidth)
      viewportWidth = msg.viewportWidth;
    if (msg.viewportHeight)
      viewportHeight = msg.viewportHeight;
    resizeToFit();
  }
  if (msg.type === 'noPages') {
    screenEl.style.display = 'none';
    display.src = '';
    omnibox.value = '';
    noPagesEl.classList.add('visible');
  }
  if (msg.type === 'url' && document.activeElement !== omnibox)
    omnibox.value = msg.url;
  if (msg.type === 'tabs')
    renderTabs(msg.tabs);
};
ws.onclose = () => setStatus('Disconnected', 'error');
ws.onerror = () => setStatus('Connection error', 'error');

function tabFavicon(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    return host ? host[0].toUpperCase() : '';
  } catch { return ''; }
}

type TabInfo = { id: string, title: string, url: string, selected: boolean };

function renderTabs(tabs: TabInfo[]) {
  tabstrip.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.selected ? ' active' : '');
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(tab.selected));
    el.title = tab.url || '';

    const fav = document.createElement('span');
    fav.className = 'tab-favicon';
    fav.setAttribute('aria-hidden', 'true');
    fav.textContent = tabFavicon(tab.url);

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.title || 'New Tab';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Close tab';
    closeBtn.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>';
    closeBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      ws.send(JSON.stringify({ type: 'closeTab', id: tab.id }));
    });

    el.appendChild(fav);
    el.appendChild(label);
    el.appendChild(closeBtn);
    el.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'selectTab', id: tab.id }));
    });
    tabstrip.appendChild(el);
  }
}

// Navigation
omnibox.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    let url = omnibox.value.trim();
    if (!/^https?:\/\//i.test(url))
      url = 'https://' + url;
    omnibox.value = url;
    ws.send(JSON.stringify({ type: 'navigate', url }));
    omnibox.blur();
  }
});
omnibox.addEventListener('focus', () => omnibox.select());
document.getElementById('back')!.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'back' }));
});
document.getElementById('fwd')!.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'forward' }));
});
document.getElementById('reload')!.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'reload' }));
});
document.getElementById('new-tab-btn')!.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'newTab' }));
});

// Input capture
const BUTTONS: string[] = ['left', 'middle', 'right'];
let captured = false;

function setCapture(on: boolean) {
  captured = on;
  screenEl.classList.toggle('captured', on);
  captureHint.classList.toggle('visible', !on);
}

function imgCoords(e: MouseEvent): { x: number, y: number } {
  if (!viewportWidth || !viewportHeight)
    return { x: 0, y: 0 };
  const rect = display.getBoundingClientRect();
  const imgAspect = display.naturalWidth / display.naturalHeight;
  const elemAspect = rect.width / rect.height;
  let renderW: number, renderH: number, offsetX: number, offsetY: number;
  if (imgAspect > elemAspect) {
    renderW = rect.width;
    renderH = rect.width / imgAspect;
    offsetX = 0;
    offsetY = (rect.height - renderH) / 2;
  } else {
    renderH = rect.height;
    renderW = rect.height * imgAspect;
    offsetX = (rect.width - renderW) / 2;
    offsetY = 0;
  }
  const fracX = (e.clientX - rect.left - offsetX) / renderW;
  const fracY = (e.clientY - rect.top - offsetY) / renderH;
  return {
    x: Math.round(fracX * viewportWidth),
    y: Math.round(fracY * viewportHeight),
  };
}

screenEl.addEventListener('mousedown', (e: MouseEvent) => {
  e.preventDefault();
  screenEl.focus();
  if (!captured) {
    setCapture(true);
    return;
  }
  const { x, y } = imgCoords(e);
  ws.send(JSON.stringify({ type: 'mousedown', x, y, button: BUTTONS[e.button] || 'left' }));
});

screenEl.addEventListener('mouseup', (e: MouseEvent) => {
  if (!captured)
    return;
  e.preventDefault();
  const { x, y } = imgCoords(e);
  ws.send(JSON.stringify({ type: 'mouseup', x, y, button: BUTTONS[e.button] || 'left' }));
});

let moveThrottle = 0;
screenEl.addEventListener('mousemove', (e: MouseEvent) => {
  if (!captured)
    return;
  const now = Date.now();
  if (now - moveThrottle < 32)
    return;
  moveThrottle = now;
  const { x, y } = imgCoords(e);
  ws.send(JSON.stringify({ type: 'mousemove', x, y }));
});

screenEl.addEventListener('wheel', (e: WheelEvent) => {
  if (!captured)
    return;
  e.preventDefault();
  ws.send(JSON.stringify({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY }));
}, { passive: false });

screenEl.addEventListener('contextmenu', (e: Event) => e.preventDefault());

screenEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!captured)
    return;
  e.preventDefault();
  if (e.key === 'Escape' && !(e.metaKey || e.ctrlKey)) {
    setCapture(false);
    return;
  }
  ws.send(JSON.stringify({ type: 'keydown', key: e.key }));
});

screenEl.addEventListener('keyup', (e: KeyboardEvent) => {
  if (!captured)
    return;
  e.preventDefault();
  ws.send(JSON.stringify({ type: 'keyup', key: e.key }));
});

screenEl.addEventListener('blur', () => {
  if (captured)
    setCapture(false);
});

// Show hint on hover when not captured
screenEl.addEventListener('mouseenter', () => {
  if (!captured)
    captureHint.classList.add('visible');
});
screenEl.addEventListener('mouseleave', () => captureHint.classList.remove('visible'));
