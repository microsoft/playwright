module.exports = [
  {
    html: '<button id="target"></button>',
    target: '#target',
    role: 'button',
  },

  {
    html: '<div id="target"></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<canvas id="target" aria-label="hello"></canvas>',
    target: '#target',
    role: null,
  },

  {
    html: '<a id="target" href>link</a>',
    target: '#target',
    role: 'link',
  },

  {
    html: '<a id="target">link</a>',
    target: '#target',
    role: null,
  },

  {
    html: '<area id="target" href>link</area>',
    target: '#target',
    role: 'link',
  },

  {
    html: '<area id="target">link</area>',
    target: '#target',
    role: null,
  },

  {
    html: '<footer id="target"></footer>',
    target: '#target',
    role: 'contentinfo',
  },

  {
    html: '<article><footer id="target"></footer></article>',
    target: '#target',
    role: null,
  },

  {
    html: '<aside><footer id="target"></footer></aside>',
    target: '#target',
    role: null,
  },

  {
    html: '<main><footer id="target"></footer></main>',
    target: '#target',
    role: null,
  },

  {
    html: '<nav><footer id="target"></footer></nav>',
    target: '#target',
    role: null,
  },

  {
    html: '<section><footer id="target"></footer></section>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="article"><footer id="target"></footer></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="complementary"><footer id="target"></footer></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="main"><footer id="target"></footer></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="navigation"><footer id="target"></footer></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="region"><footer id="target"></footer></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<form id="target" aria-label="foo"></form>',
    target: '#target',
    role: 'form',
  },

  {
    html: '<div id="foo">foo</div><form id="target" aria-labelledby="foo"></form>',
    target: '#target',
    role: 'form',
  },

  {
    html: '<form id="target" title="foo"></form>',
    target: '#target',
    role: null,
  },

  {
    html: '<form id="target"></form>',
    target: '#target',
    role: null,
  },

  {
    html: '<header id="target"></header>',
    target: '#target',
    role: 'banner',
  },

  {
    html: '<article><header id="target"></header></article>',
    target: '#target',
    role: null,
  },

  {
    html: '<aside><header id="target"></header></aside>',
    target: '#target',
    role: null,
  },

  {
    html: '<main><header id="target"></header></main>',
    target: '#target',
    role: null,
  },

  {
    html: '<nav><header id="target"></header></nav>',
    target: '#target',
    role: null,
  },

  {
    html: '<section><header id="target"></header></section>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="article"><header id="target"></header></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="complementary"><header id="target"></header></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="main"><header id="target"></header></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="navigation"><header id="target"></header></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<div role="region"><header id="target"></header></div>',
    target: '#target',
    role: null,
  },

  {
    html: '<img id="target" alt="value"></img>',
    target: '#target',
    role: 'img',
  },

  {
    html: '<img id="target"></img>',
    target: '#target',
    role: 'img',
  },

  {
    html: '<img id="target" alt=""></img>',
    target: '#target',
    role: 'presentation',
  },

  {
    html: '<img id="target" alt="" aria-label></img>',
    target: '#target',
    role: 'img',
  },

  {
    html: '<img id="target" alt="" tabindex="0"></img>',
    target: '#target',
    role: 'img',
  },

  {
    html: '<input id="target" type="button"/>',
    target: '#target',
    role: 'button',
  },

  {
    html: '<input id="target" type="image"/>',
    target: '#target',
    role: 'button',
  },

  {
    html: '<input id="target" type="reset"/>',
    target: '#target',
    role: 'button',
  },

  {
    html: '<input id="target" type="submit"/>',
    target: '#target',
    role: 'button',
  },

  {
    html: '<input id="target" type="checkbox"/>',
    target: '#target',
    role: 'checkbox',
  },

  {
    html: '<input id="target" type="email"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="tel"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="text"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="url"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="password"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="time"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="date"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" list="list"/><datalist id="list"></datalist>',
    target: '#target',
    role: 'combobox',
  },

  {
    html: '<input id="target" list="list"/><div id="list"></div>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="password" list="list"/><datalist id="list"></datalist>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<input id="target" type="number"/>',
    target: '#target',
    role: 'spinbutton',
  },

  {
    html: '<input id="target" type="radio"/>',
    target: '#target',
    role: 'radio',
  },

  {
    html: '<input id="target" type="range"/>',
    target: '#target',
    role: 'slider',
  },

  {
    html: '<input id="target" type="search"/>',
    target: '#target',
    role: 'searchbox',
  },

  {
    html: '<input id="target" type="search" list="list"/><datalist id="list"></datalist>',
    target: '#target',
    role: 'combobox',
  },

  {
    html: '<input id="target" type="invalid"/>',
    target: '#target',
    role: 'textbox',
  },

  {
    html: '<section id="target" aria-label="foo"></section>',
    target: '#target',
    role: 'region',
  },

  {
    html: '<div id="foo">foo</div><section id="target" aria-labelledby="foo"></section>',
    target: '#target',
    role: 'region',
  },

  {
    html: '<section id="target" title="foo"></section>',
    target: '#target',
    role: null,
  },

  {
    html: '<section id="target"></section>',
    target: '#target',
    role: null,
  },

  {
    html: '<select id="target" multiple></select>',
    target: '#target',
    role: 'listbox',
  },

  {
    html: '<select id="target" size="3"></select>',
    target: '#target',
    role: 'listbox',
  },

  {
    html: '<select id="target" size="1"></select>',
    target: '#target',
    role: 'combobox',
  },

  {
    html: '<select id="target"></select>',
    target: '#target',
    role: 'combobox',
  },

  {
    html: '<table><td id="target"></td></table>',
    target: '#target',
    role: 'cell',
  },

  {
    html: '<table role="grid"><td id="target"></td></table>',
    target: '#target',
    role: 'gridcell',
  },

  {
    html: '<table role="treegrid"><td id="target"></td></table>',
    target: '#target',
    role: 'gridcell',
  },

  {
    html: '<table><th id="target" scope="row"></th></table>',
    target: '#target',
    role: 'rowheader',
  },

  {
    html: '<table><th id="target" scope="col"></th></table>',
    target: '#target',
    role: 'columnheader',
  },
];
