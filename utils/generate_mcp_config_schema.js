#!/usr/bin/env node
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

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const configDtsPath = path.join(root, 'packages', 'playwright-core', 'src', 'tools', 'mcp', 'config.d.ts');
const schemaOutputPath = path.join(root, 'packages', 'playwright-core', 'src', 'tools', 'mcp', 'mcp-config.schema.json');

const typesToExclude = new Set([
  'Logger',
]);

const propertiesToExclude = new Set([
  'logger',
]);

/**
 * Strip Markdown formatting to plain text. JSON Schema `description` is plain text per spec;
 * leaving Markdown links ([text](url)) and backtick code spans (`code`) causes raw syntax
 * noise in editors that don't render Markdown in JSON hover tooltips.
 * @param {string} text
 */
function stripMarkdown(text) {
  return text
      .replace(/\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1');
}

/** @param {ts.TypeChecker} checker  @param {ts.Type} type */
function typeToSchema(checker, type, depth = 0) {
  if (depth > 15)
    return { type: 'object', additionalProperties: false };

  // Handle union types
  if (type.isUnion()) {
    const members = type.types;
    const hasNull = members.some(m => m.flags & ts.TypeFlags.Null);
    const substantive = members.filter(m => !(m.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)));

    // All string literals -> enum
    if (substantive.length > 0 && substantive.every(m => m.isStringLiteral())) {
      /** @type {string[]} */
      const values = substantive.map(m => /** @type {ts.StringLiteralType} */ (m).value);
      const schema = { enum: values };
      if (hasNull)
        return { oneOf: [{ type: 'null' }, schema] };
      return schema;
    }

    // true | false -> boolean (TS decomposes boolean into true|false literals)
    if (substantive.length === 2 && substantive.every(m => m.flags & ts.TypeFlags.BooleanLiteral))
      return { type: 'boolean' };

    // Collapse boolean literal pairs before building oneOf
    const collapsed = [];
    let hasBooleanLiterals = false;
    for (const m of substantive) {
      if (m.flags & ts.TypeFlags.BooleanLiteral) {
        if (!hasBooleanLiterals) {
          hasBooleanLiterals = true;
          collapsed.push({ type: 'boolean' });
        }
      } else {
        const s = typeToSchema(checker, m, depth + 1);
        if (s)
          collapsed.push(s);
      }
    }

    // Deduplicate schemas by JSON representation
    const seen = new Set();
    const deduped = [];
    for (const s of collapsed) {
      const key = JSON.stringify(s);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(s);
      }
    }

    // Multiple substantive types (e.g. boolean | Array<string>)
    if (deduped.length >= 2 || (deduped.length >= 1 && hasNull)) {
      const schemas = [...deduped];
      if (hasNull)
        schemas.unshift({ type: 'null' });
      return schemas.length === 1 ? schemas[0] : { oneOf: schemas };
    }
    if (deduped.length === 1)
      return deduped[0];

    // Single substantive type with null or undefined stripped
    if (substantive.length === 1) {
      const schema = typeToSchema(checker, substantive[0], depth + 1);
      if (hasNull && schema)
        return { oneOf: [{ type: 'null' }, schema] };
      return schema;
    }

    // Nothing left (pure undefined/null)
    return {};
  }

  // Boolean literal type (from union decomposition)
  if (type.flags & ts.TypeFlags.BooleanLiteral)
    return { type: 'boolean' };

  // Primitives
  if (type.flags & ts.TypeFlags.String)
    return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number)
    return { type: 'number' };
  if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLike))
    return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.Undefined)
    return {};

  // String/number literal types
  if (type.isStringLiteral())
    return { enum: [/** @type {ts.StringLiteralType} */ (type).value] };
  if (type.isNumberLiteral())
    return { type: 'number' };

  // Array types
  if (checker.isArrayType(type)) {
    const typeArgs = /** @type {ts.TypeReference} */ (type).typeArguments;
    if (typeArgs && typeArgs.length > 0)
      return { type: 'array', items: typeToSchema(checker, typeArgs[0], depth + 1) };
    return { type: 'array' };
  }

  // Check for known non-JSON types by name
  const typeName = checker.typeToString(type);
  if (typeName === 'RegExp')
    return { type: 'string' };
  if (typeName === 'Buffer' || typeName.startsWith('Buffer<') || typeName === 'Uint8Array')
    return undefined; // Excluded — binary data not representable in JSON config
  if (typesToExclude.has(typeName))
    return undefined; // Excluded

  // Index signature / Record types: { [key: string]: V }
  const stringIndex = type.getStringIndexType();
  if (stringIndex) {
    const props = type.getProperties();
    if (!props.length || props.every(p => p.flags & ts.SymbolFlags.Signature))
      return { type: 'object', additionalProperties: typeToSchema(checker, stringIndex, depth + 1) };
  }

  // Object / interface types
  const properties = type.getProperties();
  if (properties.length > 0) {
    /** @type {Record<string, any>} */
    const props = {};
    /** @type {string[]} */
    const required = [];

    for (const prop of properties) {
      const propName = prop.getName();
      if (propertiesToExclude.has(propName))
        continue;

      const propType = checker.getTypeOfSymbol(prop);
      const propTypeName = checker.typeToString(propType);

      // Skip function types
      if (propType.getCallSignatures().length > 0)
        continue;
      // Skip Buffer-typed properties
      if (propTypeName === 'Buffer')
        continue;
      if (typesToExclude.has(propTypeName))
        continue;

      const schema = typeToSchema(checker, propType, depth + 1);
      if (!schema)
        continue;

      // Extract JSDoc description, stripped to plain text.
      // JSON Schema `description` is defined as plain text (not Markdown). Markdown links
      // and backtick formatting from upstream types.d.ts JSDoc would render as raw syntax
      // in editors that don't support Markdown in schema descriptions, causing visual noise.
      const jsDoc = stripMarkdown(ts.displayPartsToString(prop.getDocumentationComment(checker)).trim());
      if (jsDoc)
        schema.description = jsDoc;

      // Check deprecated tag
      const tags = prop.getJsDocTags();
      if (tags.some(t => t.name === 'deprecated'))
        schema.description = (schema.description ? schema.description + ' ' : '') + '(Deprecated)';

      props[propName] = schema;

      // Optional check: if the symbol declaration has a questionToken, it's optional
      const declarations = prop.getDeclarations();
      const isOptional = declarations?.some(d => {
        return /** @type {ts.PropertySignature} */ (d).questionToken !== undefined;
      });
      if (!isOptional)
        required.push(propName);
    }

    const result = { type: 'object', properties: props };
    if (required.length > 0)
      result.required = required;
    result.additionalProperties = false;
    return result;
  }

  return {};
}

function main() {
  const program = ts.createProgram([configDtsPath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    types: [],
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(configDtsPath);
  if (!sourceFile)
    throw new Error('Could not load ' + configDtsPath);

  // Find the Config type alias
  let configType = null;
  ts.forEachChild(sourceFile, node => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Config')
      configType = checker.getTypeAtLocation(node);
  });

  if (!configType)
    throw new Error('Could not find Config type in ' + configDtsPath);

  const schema = typeToSchema(checker, configType);

  // Allow "$schema" in config files for IDE autocompletion while keeping additionalProperties: false.
  if (schema.properties)
    schema.properties = { $schema: { type: 'string', description: 'URL or path to the JSON Schema for IDE validation.' }, ...schema.properties };

  const fullSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/src/tools/mcp/mcp-config.schema.json',
    title: 'Playwright MCP / CLI Configuration',
    description: 'Schema for Playwright MCP/CLI JSON configuration files. INI format configuration files use the same options but are not validated by this schema.',
    ...schema,
  };

  const schemaContent = JSON.stringify(fullSchema, null, 2) + '\n';
  return writeFile(schemaOutputPath, schemaContent);
}

let hasChanges = false;

function writeFile(filePath, content) {
  try {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content)
      return;
  } catch {
  }
  hasChanges = true;
  console.log(`Writing //${path.relative(root, filePath)}`);
  fs.writeFileSync(filePath, content, 'utf8');
}

main();
process.exit(hasChanges ? 1 : 0);
