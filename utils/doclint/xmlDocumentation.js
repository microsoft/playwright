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

// @ts-check

const Documentation = require('./documentation');
const { visitAll } = require('../markdown');
/**
 * @param {Documentation.MarkdownNode[]} nodes
 * @param {number} maxColumns
 */
function renderXmlDoc(nodes, maxColumns) {
    const summary = [];
    const examples = [];
    /** @type {Documentation.MarkdownNode} */
    let lastNode;

    summary.push('<summary>');

    visitAll(nodes, (node, depth) => {
        lastNode = innerRenderXmlNode(node, lastNode, summary, examples, maxColumns);
    });

    if (summary.length == 1) { // just the <summary> node 
        return [];
    }

    // we might have a stray list, if the <li> is the last element
    if (lastNode && lastNode.type === 'li') {
        summary.push('</list>');
    }
    summary.push('</summary>');

    // add examples
    summary.push(...examples);
    return summary.map(n => `/// ${n}`);
}

/**
 * @param {Documentation.MarkdownNode} node
 * @param {Documentation.MarkdownNode} lastNode
 * @param {number=} maxColumns
 * @param {string[]} summary
 * @param {string[]} examples
 */
function innerRenderXmlNode(node, lastNode, summary, examples, maxColumns) {
    /** @param {string[]} a */
    const newLine = (a) => {
        if (a[a.length - 1] !== '')
            a.push('');
    };

    let escapedText = node.text;
    // resolve links (within [])

    if (node.type === 'text') {
        // clear up the list, if there was one
        if (lastNode && lastNode.type === 'li') {
            summary.push('</list>');
        }

        summary.push(...wrapText(escapedText, maxColumns));

        return node;
    }

    if (node.type === 'li') {
        if (escapedText.startsWith('extends: ')) {
            summary.push(...wrapText(`<seealso cref="${escapedText.substring(9)}"/>`, maxColumns));
            return undefined;
        }

        // if the previous node was not li, start list
        if (lastNode && lastNode.type !== 'li') {
            summary.push(`<list>`);
        }

        summary.push(...wrapText(`<item><description>${escapedText}</description></item>`, maxColumns));
    }

    // TODO: this should really move to the examples array
    if (node.type == 'code' && node.codeLang == "csharp") {
        summary.push('<![CDATA[');
        summary.push(...node.lines);
        summary.push(']]>');
    }

    return node;
}

/**
 * @param {string} text
 * @param {number=} maxColumns
 * @param {string=} prefix
 */
function wrapText(text, maxColumns = 0, prefix = '') {
    if (!maxColumns) {
        return prefix + text;
    }

    // we'll apply some fixes, like rendering the links from markdown
    // TODO: maybe we can move this to either markdown.js or documentation.js?
    text = text.replace(/\[([^\[\]]*)\]\((.*?)\)/g, function (match, name, url) {
        return `<a href="${url}">${name}</a>`;
    });

    const lines = [];

    let insideTag = false;
    let escapeChar = false;
    let insideLink = false;
    let breakOnSpace = false;
    let insideNode = false;

    let line = "";
    let currentWidth = 0;

    let prevChar = '';
    for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        let skipThisChar = true;

        if (['<', '['].includes(char)) {
            // maybe we should break if a node starts, and we're almost at the end of the block
            if (!insideNode && currentWidth >= maxColumns * 0.85) {
                lines.push(line);
                line = "";
                currentWidth = 0;
            }
            insideNode = true;
            insideTag = true;
        } else if (['>', ']'].includes(char)) {
            insideTag = false;
            if (prevChar === '/') { // self-closing tag
                insideNode = false;
            }
        } else if (char === '/' && prevChar === '<') { // closing node
            insideNode = false;
        } else if (char === '(' && prevChar === ']') {
            insideLink = true;
        } else if (char === ')' && insideLink) {
            insideLink = false;
        } else if (char === `\\`) {
            escapeChar = true;
        } else if (char === " " && breakOnSpace) {
            breakOnSpace = false;
            lines.push(line);
            line = "";
            currentWidth = 0;
            continue;
        } else {
            skipThisChar = false;
        }

        if (currentWidth == 0 && char === " ") {
            continue;
        }

        line += char;
        currentWidth++;

        prevChar = char;
        if (skipThisChar) {
            continue;
        }

        if (currentWidth >= maxColumns
            && !insideTag
            && !escapeChar
            && !insideLink
            && !insideNode) {
            breakOnSpace = true;
        }
    }

    // make sure we push the last line, if it hasn't been pushed yet
    if (line !== "") {
        lines.push(line);
    }

    return lines;
}

module.exports = { renderXmlDoc }