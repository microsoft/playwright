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

const path = require('path');
const ts = require('typescript');

/**
 * @param {string} filePath
 * @param {(className: string) => string} commentForClass
 * @param {(className: string, methodName: string, overloadIndex: number) => string} commentForMethod
 * @param {(className: string) => string} extraForClass
 */
async function parseOverrides(filePath, commentForClass, commentForMethod, extraForClass) {
  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      target: ts.ScriptTarget.ESNext
    }
  });
  const checker = program.getTypeChecker();
  const replacers = [];
  const file = program.getSourceFile(filePath);

  visit(file);

  let src = file.text;
  for (const replacer of replacers.sort((a, b) => b.pos - a.pos)) {
    src = src.substring(0, replacer.pos) + replacer.text + src.substring(replacer.pos);
  }
  return src;

    /**
   * @param {!ts.Node} node
   */
  function visit(node) {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isInterfaceDeclaration(node)) {
      const symbol = node.name ? checker.getSymbolAtLocation(node.name) : node.symbol;
      let className = symbol.getName();
      if (className === '__class') {
        let parent = node;
        while (parent.parent)
          parent = parent.parent;
        className = path.basename(parent.fileName, '.js');

      }
      if (className)
        serializeClass(className, symbol, node);
    }
    ts.forEachChild(node, visit);
  }


  /**
   * @param {string} className
   * @param {!ts.Symbol} symbol
   * @param {ts.Node} node
   */
  function serializeClass(className, symbol, node) {
    replacers.push({
      pos: node.getStart(file, false),
      text: commentForClass(className),
    });
    for (const [name, member] of symbol.members || []) {
      if (member.flags & ts.SymbolFlags.TypeParameter)
        continue;
      if (!member.declarations)
        continue;
      for (let index = 0; index < member.declarations.length; index++) {
        const declaration = member.declarations[index];
        const pos = declaration.getStart(file, false);
        replacers.push({
          pos,
          text: commentForMethod(className, name, index),
        });
        if (ts.isPropertySignature(declaration))
          ts.forEachChild(declaration, child => visitProperties(className, name, child));
      }
    }
    replacers.push({
      pos: node.getEnd(file) - 1,
      text: extraForClass(className),
    });
  }

  /**
   * @param {string} className
   * @param {string} prefix
   * @param {ts.Node} node
   */
  function visitProperties(className, prefix, node) {
    // This function supports structs like "a: { b: string; c: number, (): void }"
    // and inserts comments for "a.b", "a.c", a.
    if (ts.isPropertySignature(node)) {
      const name = checker.getSymbolAtLocation(node.name).getName();
      const pos = node.getStart(file, false);
      replacers.push({
        pos,
        text: commentForMethod(className, `${prefix}.${name}`, 0),
      });
      ts.forEachChild(node, child => visitProperties(className, `${prefix}.${name}`, child));
    } else if (ts.isCallSignatureDeclaration(node)) {
      const pos = node.getStart(file, false);
      replacers.push({
        pos,
        text: commentForMethod(className, `${prefix}`, 0),
      });
    } else if (ts.isIntersectionTypeNode(node) || ts.isTypeLiteralNode(node)) {
      ts.forEachChild(node, child => visitProperties(className, prefix, child));
    }
  }

}

module.exports = {parseOverrides};