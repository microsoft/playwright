// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

const fs = require('fs');
const path = require('path');

function run() {
  const json = require('../docs/docs.json');

  const md = [];
  const links = new Map();
  const inlined = new Map();

  function append(line, indent) {
    line = (line || '').trim();
    line = line.replace(/{@link ([^}|]*)(?:\|([^}]*))?}/g, (match, url, text) => {
      text = text || url;
      if (links.has(url))
        url = links.get(url);
      return `[${text.trim()}](${url.trim()})`;
    });
    md.push(' '.repeat(indent || 0) + line);
  }

  function appendComment(comment) {
    if (!comment)
      return;
    if (comment.text)
      append(comment.text);
    for (const tag of comment.tags || []) {
      append();
      if (tag.tag === 'remarks')
        append(`> **NOTE** ${tag.text}`);
      else
        append(tag.text);
    }
  }

  function isNullOrUndefined(t) {
    return t.type === 'intrinsic' && (t.name === 'null' || t.name === 'undefined');
  }

  function appendType(t, comment, optional, prefix, indent) {
    let type = '';
    let children;
    let union = '';
    let template;
    if (t.type === 'reference' && t.name === 'Promise' && t.typeArguments && t.typeArguments[0].name !== 'void') {
      template = t.name;
      t = t.typeArguments[0];
    }
    while (t.type === 'union') {
      let hasInlined = false;
      for (const child of t.types) {
        if (isNullOrUndefined(child)) {
          optional = true;
        } else if ((child.type === 'reference' && inlined.has(child.name)) || child.type === 'reflection') {
          if (hasInlined)
            throw new Error('Cannot handle union of two inlined types');
          hasInlined = true;
          t = child;
        } else {
          union += child.name + '|';
        }
      }
      if (!hasInlined) {
        type = union.substring(0, union.length - 1);
        union = '';
        break;
      }
    }
    while (t.type === 'reference' && inlined.has(t.name))
      t = inlined.get(t.name);
    if (t.type === 'intrinsic') {
      type = t.name;
    } else if (t.type === 'reference') {
      type = t.name;
    } else if (t.type === 'reflection') {
      type = 'Object';
      children = t.declaration && t.declaration.children;
    }
    type = union + type;
    type = `${optional ? '?' : ''}[${type}]`;
    if (template)
      type = `[${template}]<${type}>`;
    const text = comment ? ' ' + comment.trim() : '';
    append(`${prefix}<${type}>${text}`, indent);
    for (const child of children || [])
      appendType(child.type, child.comment && child.comment.text, child.flags && child.flags.isOptional, `- \`${child.name}\` `, (indent || 0) + 2);
  }

  function appendParameter(p, indent) {
    appendType(p.type, p.comment && p.comment.text, p.flags && p.flags.isOptional, `- \`${p.name}\` `, indent);
  }

  function appendReturn(r, comment) {
    appendType(r, comment, false, `- returns: `);
  }

  function methods(interface) {
    return (interface.children || []).filter(child => child.kindString === 'Method');
  }

  const types = json.children[0].children.filter(e => e.kindString === 'Type alias');
  for (const type of types) {
    if (type.comment && (type.comment.tags || []).find(tag => tag.tag === 'inline')) {
      inlined.set(type.name, type.type);
    }
  }

  const interfaces = json.children[0].children.filter(e => e.kindString === 'Interface');

  append(`##### Table of Contents`);
  append();
  for (const c of interfaces) {
    const classLink = '#class-' + c.name.toLowerCase();
    links.set(c.name, classLink);
    append(`- [class: ${c.name}](${classLink})`);
    for (const method of methods(c)) {
      const methodName = c.name + '.' + method.signatures[0].name;
      const methodLink = '#' + c.name.toLowerCase() + method.signatures[0].name.toLowerCase();
      links.set(methodName, methodLink);
      append(`* [${methodName}](${methodLink})`, 2);
    }
  }
  append();

  for (const c of interfaces) {
    append(`### class: ${c.name}`);
    append();
    if (c.comment) {
      append(c.comment.shortText);
      append();
    }
    appendComment(c.comment);

    for (const method of methods(c)) {
      const signature = method.signatures[0];
      append();
      append(`#### ${c.name}.${signature.name}`);
      if (signature.comment) {
        append(signature.comment.shortText);
        append();
      }
      for (const parameter of signature.parameters || [])
        appendParameter(parameter);
      if (signature.type)
        appendReturn(signature.type, signature.comment && signature.comment.returns);
      append();
      appendComment(signature.comment);
    }
  }

  const bottom = [];
  for (const c of interfaces)
    bottom.push({id: c.name, text: `[${c.name}]: ${links.get(c.name)} "${c.name}"`});
  bottom.push({id: 'Array', text: '[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"'});
  bottom.push({id: 'Buffer', text: '[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"'});
  bottom.push({id: 'ChildProcess', text: '[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"'});
  bottom.push({id: 'Element', text: '[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"'});
  bottom.push({id: 'Error', text: '[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"'});
  bottom.push({id: 'File', text: '[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"'});
  bottom.push({id: 'Map', text: '[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"'});
  bottom.push({id: 'Object', text: '[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"'});
  bottom.push({id: 'Promise', text: '[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"'});
  bottom.push({id: 'Serializable', text: '[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"'});
  bottom.push({id: 'UIEvent.detail', text: '[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"'});
  bottom.push({id: 'UnixTime', text: '[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"'});
  bottom.push({id: 'boolean', text: '[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"'});
  bottom.push({id: 'function', text: '[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"'});
  bottom.push({id: 'iterator', text: '[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"'});
  bottom.push({id: 'number', text: '[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"'});
  bottom.push({id: 'origin', text: '[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"'});
  bottom.push({id: 'selector', text: '[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"'});
  bottom.push({id: 'stream.Readable', text: '[stream.Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "stream.Readable"'});
  bottom.push({id: 'string', text: '[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"'});
  bottom.push({id: 'xpath', text: '[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"'});
  bottom.sort((a, b) => a.id.localeCompare(b.id));

  append();
  for (const {text} of bottom)
    append(text);

  append();
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'gen.md'), md.join('\n'));
}

run();
