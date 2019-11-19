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

const Documentation = require('./Documentation');
const commonmark = require('commonmark');

class MDOutline {
  /**
   * @param {!Page} page
   * @param {string} text
   * @return {!MDOutline}
   */
  static async create(page, text) {
    // Render markdown as HTML.
    const reader = new commonmark.Parser();
    const parsed = reader.parse(text);
    const writer = new commonmark.HtmlRenderer();
    const html = writer.render(parsed);

    page.on('console', msg => {
      console.log(msg.text());
    });
    // Extract headings.
    await page.setContent(html);
    const {classes, errors} = await page.evaluate(() => {
      const classes = [];
      const errors = [];
      const headers = document.body.querySelectorAll('h3');
      for (let i = 0; i < headers.length; i++) {
        const fragment = extractSiblingsIntoFragment(headers[i], headers[i + 1]);
        classes.push(parseClass(fragment));
      }
      return {classes, errors};

      /**
       * @param {HTMLLIElement} element
       */
      function parseProperty(element) {
        const clone = element.cloneNode(true);
        const ul = clone.querySelector(':scope > ul');
        const str = parseComment(extractSiblingsIntoFragment(clone.firstChild, ul));
        const name = str.substring(0, str.indexOf('<')).replace(/\`/g, '').trim();
        const type = findType(str);
        const properties = [];
        const comment = str.substring(str.indexOf('<') + type.length + 2).trim();
        // Strings have enum values instead of properties
        if (!type.includes('string')) {
          for (const childElement of element.querySelectorAll(':scope > ul > li')) {
            const property = parseProperty(childElement);
            property.required = property.comment.includes('***required***');
            properties.push(property);
          }
        }
        return {
          name,
          type,
          comment,
          properties
        };
      }

      /**
       * @param {string} str
       * @return {string}
       */
      function findType(str) {
        const start = str.indexOf('<') + 1;
        let count = 1;
        for (let i = start; i < str.length; i++) {
          if (str[i] === '<') count++;
          if (str[i] === '>') count--;
          if (!count)
            return str.substring(start, i);
        }
        return 'unknown';
      }

      /**
       * @param {DocumentFragment} content
       */
      function parseClass(content) {
        const members = [];
        const headers = content.querySelectorAll('h4');
        const name = content.firstChild.textContent;
        let extendsName = null;
        let commentStart = content.firstChild.nextSibling;
        const extendsElement = content.querySelector('ul');
        if (extendsElement && extendsElement.textContent.trim().startsWith('extends:')) {
          commentStart = extendsElement.nextSibling;
          extendsName = extendsElement.querySelector('a').textContent;
        }
        const comment = parseComment(extractSiblingsIntoFragment(commentStart, headers[0]));
        for (let i = 0; i < headers.length; i++) {
          const fragment = extractSiblingsIntoFragment(headers[i], headers[i + 1]);
          members.push(parseMember(fragment));
        }
        return {
          name,
          comment,
          extendsName,
          members
        };
      }

      /**
       * @param {Node} content
       */
      function parseComment(content) {
        for (const code of content.querySelectorAll('pre > code'))
          code.replaceWith('```' + code.className.substring('language-'.length) + '\n' + code.textContent + '```');
        for (const code of content.querySelectorAll('code'))
          code.replaceWith('`' + code.textContent + '`');
        for (const strong of content.querySelectorAll('strong'))
          strong.replaceWith('**' + parseComment(strong) + '**');
        return content.textContent.trim();
      }

      /**
       * @param {string} name
       * @param {DocumentFragment} content
       */
      function parseMember(content) {
        const name = content.firstChild.textContent;
        const args = [];
        let returnType = null;

        const paramRegex = /^\w+\.[\w$]+\((.*)\)$/;
        const matches = paramRegex.exec(name) || ['', ''];
        const parameters = matches[1];
        const optionalStartIndex = parameters.indexOf('[');
        const optinalParamsStr = optionalStartIndex !== -1 ? parameters.substring(optionalStartIndex).replace(/[\[\]]/g, '') : '';
        const optionalparams = new Set(optinalParamsStr.split(',').filter(x => x).map(x => x.trim()));
        const ul = content.querySelector('ul');
        for (const element of content.querySelectorAll('h4 + ul > li')) {
          if (element.matches('li') && element.textContent.trim().startsWith('<')) {
            returnType = parseProperty(element);
          } else if (element.matches('li') && element.firstChild.matches && element.firstChild.matches('code')) {
            const property = parseProperty(element);
            property.required = !optionalparams.has(property.name);
            args.push(property);
          } else if (element.matches('li') && element.firstChild.nodeType === Element.TEXT_NODE && element.firstChild.textContent.toLowerCase().startsWith('return')) {
            returnType = parseProperty(element);
            const expectedText = 'returns: ';
            let actualText = element.firstChild.textContent;
            let angleIndex = actualText.indexOf('<');
            let spaceIndex = actualText.indexOf(' ');
            angleIndex = angleIndex === -1 ? actualText.length : angleIndex;
            spaceIndex = spaceIndex === -1 ? actualText.length : spaceIndex + 1;
            actualText = actualText.substring(0, Math.min(angleIndex, spaceIndex));
            if (actualText !== expectedText)
              errors.push(`${name} has mistyped 'return' type declaration: expected exactly '${expectedText}', found '${actualText}'.`);
          }
        }
        const comment = parseComment(extractSiblingsIntoFragment(ul ? ul.nextSibling : content));
        return {
          name,
          args,
          returnType,
          comment
        };
      }

      /**
       * @param {!Node} fromInclusive
       * @param {!Node} toExclusive
       * @return {!DocumentFragment}
       */
      function extractSiblingsIntoFragment(fromInclusive, toExclusive) {
        const fragment = document.createDocumentFragment();
        let node = fromInclusive;
        while (node && node !== toExclusive) {
          const next = node.nextSibling;
          fragment.appendChild(node);
          node = next;
        }
        return fragment;
      }
    });
    return new MDOutline(classes, errors);
  }

  constructor(classes, errors) {
    this.classes = [];
    this.errors = errors;
    const classHeading = /^class: (\w+)$/;
    const constructorRegex = /^new (\w+)\((.*)\)$/;
    const methodRegex = /^(\w+)\.([\w$]+)\((.*)\)$/;
    const propertyRegex = /^(\w+)\.(\w+)$/;
    const eventRegex = /^event: '(\w+)'$/;
    let currentClassName = null;
    let currentClassMembers = [];
    let currentClassComment = '';
    let currentClassExtends = null;
    for (const cls of classes) {
      const match = cls.name.match(classHeading);
      if (!match)
        continue;
      currentClassName = match[1];
      currentClassComment = cls.comment;
      currentClassExtends = cls.extendsName;
      for (const member of cls.members) {
        if (constructorRegex.test(member.name)) {
          const match = member.name.match(constructorRegex);
          handleMethod.call(this, member, match[1], 'constructor', match[2]);
        } else if (methodRegex.test(member.name)) {
          const match = member.name.match(methodRegex);
          handleMethod.call(this, member, match[1], match[2], match[3]);
        } else if (propertyRegex.test(member.name)) {
          const match = member.name.match(propertyRegex);
          handleProperty.call(this, member, match[1], match[2]);
        } else if (eventRegex.test(member.name)) {
          const match = member.name.match(eventRegex);
          handleEvent.call(this, member, match[1]);
        }
      }
      flushClassIfNeeded.call(this);
    }

    function handleMethod(member, className, methodName, parameters) {
      if (!currentClassName || !className || !methodName || className.toLowerCase() !== currentClassName.toLowerCase()) {
        this.errors.push(`Failed to process header as method: ${member.name}`);
        return;
      }
      parameters = parameters.trim().replace(/[\[\]]/g, '');
      if (parameters !== member.args.map(arg => arg.name).join(', '))
        this.errors.push(`Heading arguments for "${member.name}" do not match described ones, i.e. "${parameters}" != "${member.args.map(a => a.name).join(', ')}"`);
      const args = member.args.map(createPropertyFromJSON);
      let returnType = null;
      let returnComment = '';
      if (member.returnType) {
        const returnProperty = createPropertyFromJSON(member.returnType);
        returnType = returnProperty.type;
        returnComment = returnProperty.comment;
      }
      const method = Documentation.Member.createMethod(methodName, args, returnType, returnComment, member.comment);
      currentClassMembers.push(method);
    }

    function createPropertyFromJSON(payload) {
      const type = new Documentation.Type(payload.type, payload.properties.map(createPropertyFromJSON));
      const required = payload.required;
      return Documentation.Member.createProperty(payload.name, type, payload.comment, required);
    }

    function handleProperty(member, className, propertyName) {
      if (!currentClassName || !className || !propertyName || className.toLowerCase() !== currentClassName.toLowerCase()) {
        this.errors.push(`Failed to process header as property: ${member.name}`);
        return;
      }
      const type = member.returnType ? member.returnType.type : null;
      const properties = member.returnType ? member.returnType.properties : [];
      currentClassMembers.push(createPropertyFromJSON({type, name: propertyName, properties, comment: member.comment}));
    }

    function handleEvent(member, eventName) {
      if (!currentClassName || !eventName) {
        this.errors.push(`Failed to process header as event: ${member.name}`);
        return;
      }
      currentClassMembers.push(Documentation.Member.createEvent(eventName, member.returnType && createPropertyFromJSON(member.returnType).type, member.comment));
    }

    function flushClassIfNeeded() {
      if (currentClassName === null)
        return;
      this.classes.push(new Documentation.Class(currentClassName, currentClassMembers, currentClassExtends, currentClassComment));
      currentClassName = null;
      currentClassMembers = [];
    }
  }
}

/**
 * @param {!Page} page
 * @param {!Array<!Source>} sources
 * @return {!Promise<{documentation: !Documentation, errors: !Array<string>}>}
 */
module.exports = async function(page, sources) {
  const classes = [];
  const errors = [];
  for (const source of sources) {
    const outline = await MDOutline.create(page, source.text());
    classes.push(...outline.classes);
    errors.push(...outline.errors);
  }
  const documentation = new Documentation(classes);
  return { documentation, errors };
};

