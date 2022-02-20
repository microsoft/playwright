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

const React = require('react');
const ReactDOM = require('react-dom');

const fillStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const checkerboardCommon = {
  ...fillStyle,
  backgroundSize: '50px 50px',
  backgroundPosition: '0 0, 25px 25px',
};

const checkerboardLight = {
  ...checkerboardCommon,
  backgroundColor: '#FFF',
  backgroundImage: `linear-gradient(45deg, #00000008 25%, transparent 25%, transparent 75%, #00000008 75%, #00000008),
                    linear-gradient(45deg, #00000008 25%, transparent 25%, transparent 75%, #00000008 75%, #00000008)`,
};

const checkerboardDark = {
  ...checkerboardCommon,
  backgroundColor: '#000',
  backgroundImage: `linear-gradient(45deg, #FFFFFF12 25%, transparent 25%, transparent 75%, #FFFFFF12 75%, #FFFFFF12),
                    linear-gradient(45deg, #FFFFFF12 25%, transparent 25%, transparent 75%, #FFFFFF12 75%, #FFFFFF12)`,
};

const Component = ({ style, children }) => {
  const checkerboard = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? checkerboardDark
    : checkerboardLight;
  const bgStyle = { ...checkerboard };
  const fgStyle = { ...fillStyle, ...style };
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('div', { style: bgStyle }),
    React.createElement('div', { style: fgStyle, id: 'pw-root' }, children),
  );
};

const registry = new Map();

export const registerComponent = (name, componentFunc) => {
  registry.set(name, componentFunc);
};

function render(component) {
  const componentFunc = registry.get(component.type) || component.type;
  return React.createElement(
    componentFunc,
    component.props,
    ...component.children.map((child) => {
      if (typeof child === 'string') return child;
      return render(child);
    }),
  );
}

window.__playwright_render = (component) => {
  ReactDOM.render(
    React.createElement(Component, null, render(component)),
    document.getElementById('root'),
  );
};
