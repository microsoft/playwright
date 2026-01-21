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

const fs = require('fs')
const path = require('path')

const { browserTools } = require('playwright/lib/mcp/browser/tools');

const capabilityNames = {
  'core': 'Core',
  'core-tabs': 'Tab management',
  'core-install': 'Browser installation',
  'vision': 'Coordinate-based',
  'pdf': 'PDF generation',
  'tracing': 'Tracing',
  'testing': 'Testing',
};

function camelToKebabCase(camel) {
  return camel.replace(/([A-Z])/g, (letter) => `-${letter.toLowerCase()}`);
}

/** @type {Record<string, string[]>} */
const aliases = {
  'navigate': ['goto', 'open'],
  'take_screenshot': ['screenshot'],
};

/** @type {Record<string, Record<string, string>>} */
const commandToExtraOptions = {
  'navigate': {
    'headed': 'run browser in headed mode'
  },
};

function commandNameForTool(toolName) {
  if (toolName.startsWith('browser_'))
    toolName = toolName.slice('browser_'.length);
  return toolName;
}


/**
 * @param {any} tool
 * @returns {string[]}
 */
function requiredParamsForTool(tool) {
  const inputSchema = tool.inputSchema.toJSONSchema()  ;
  return (inputSchema.required || []).filter(param => {
    const property = inputSchema.properties?.[param];
    return !(typeof property === 'object' && 'default' in property)
  });
}

/**
 * @param {any} tool
 * @returns {string}
 */
function formatHelpForCommand(tool) {
  const commandName = commandNameForTool(tool.name);

  const inputSchema = tool.inputSchema.toJSONSchema();
  const requiredParams = (inputSchema.required || []).filter(param => {
    const property = inputSchema.properties?.[param];
    return !(typeof property === 'object' && 'default' in property)
  });

  const lines = /** @type {string[]} */ ([]);
  lines.push(`playwright-cli ${commandName} ${requiredParams.map(param => `<${param}>`).join(' ')}`);
  lines.push(``);
  lines.push(tool.description);

  if (aliases[commandName]) {
    lines.push(``);
    lines.push(`Aliases: ${aliases[commandName].join(', ')}`);
  }

  if (requiredParams.length) {
    lines.push(``);
    lines.push(`Parameters:`);
    for (const param of requiredParams) {
      const property = inputSchema.properties?.[param];
      lines.push(formatNameAndDescription(`  <${param}>`, property.description, 20));
    }
  }
  if (inputSchema.properties && Object.keys(inputSchema.properties).length) {
    let printedHeader = false;
    function ensureHeader() {
      if (!printedHeader) {
        lines.push(``);
        lines.push(`Options:`);
        printedHeader = true;
      }
    }
    const extraOptions = commandToExtraOptions[commandName] || {};
    for (const [option, description] of Object.entries(extraOptions)) {
      ensureHeader();
      lines.push(formatNameAndDescription(`  --${option}`, description));
    }
    Object.entries(inputSchema.properties).forEach(([name, param]) => {
      if (requiredParams.includes(name))
        return;
      ensureHeader();
      lines.push(formatNameAndDescription(`  --${camelToKebabCase(name)}`, param.description, 20));
    });
  }
  lines.push('');
  return lines.join('\n');
}

function startWithLowerCase(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}

/**
 * @param {string} name
 * @param {string} description
 * @returns {string}
 */
function formatNameAndDescription(name, description, padding = 30) {
  if (name.length > padding)
    return `${name}\n${' '.repeat(padding)}${description}`;
  const paddedName = name.padEnd(padding);
  return `${paddedName}${description}`;
}

/**
 * @returns {string}
 */
function formatGlobalHelp() {
  const lines = /** @type {string[]} */ ([]);
  lines.push(`playwright-cli - run playwright mcp commands from terminal`);
  lines.push('');
  lines.push(`Usage: playwright-cli <command> [options]`);
  lines.push('');

  // Group tools by capability
  /** @type {Record<string, Array<{name: string, title: string, requiredParams: string[]}>>} */
  const capabilityToTools = {};

  for (const tool of browserTools) {
    const capability = tool.capability;
    if (!capabilityToTools[capability])
      capabilityToTools[capability] = [];
    capabilityToTools[capability].push({
      name: commandNameForTool(tool.schema.name),
      title: tool.schema.title,
      requiredParams: requiredParamsForTool(tool.schema),
    });
  }

  const capabilityOrder = Object.keys(capabilityNames);
  for (const capability of Object.keys(capabilityToTools)) {
    if (!capabilityOrder.includes(capability))
      throw new Error(`Unknown capability: ${capability}`);
  }
  for (const capability of capabilityOrder) {
    if (!capabilityToTools[capability])
      throw new Error(`Unknown capability: ${capability}`);
    lines.push(`${capabilityNames[capability]}:`);
    for (const tool of capabilityToTools[capability]) {
      const params = tool.requiredParams.map(param => `<${param}>`).join(' ');
      const nameAndParams = `  ${tool.name}${params ? ` ${params}` : ''}`;
      lines.push(formatNameAndDescription(nameAndParams, startWithLowerCase(tool.title)));
    }
    lines.push('');
  }

  lines.push(`Options:`);
  lines.push(formatNameAndDescription(`  --help`, `show help for a specific command`));
  lines.push(formatNameAndDescription(`  --version`, `show version information`));
  lines.push('');
  lines.push(`Examples:`);
  lines.push(`  playwright-cli navigate https://playwright.dev`);
  lines.push(`  playwright-cli snapshot`);
  lines.push(`  playwright-cli click e67`);
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {string} content
 * @param {string} startMarker
 * @param {string} endMarker
 * @param {string} generatedContent
 * @returns {Promise<string>}
 */
async function updateSection(content, startMarker, endMarker, generatedContent) {
  const startMarkerIndex = content.indexOf(startMarker);
  const endMarkerIndex = content.indexOf(endMarker);
  if (startMarkerIndex === -1 || endMarkerIndex === -1)
    throw new Error('Markers for generated section not found');

  return [
    content.slice(0, startMarkerIndex + startMarker.length),
    '',
    generatedContent,
    '',
    content.slice(endMarkerIndex),
  ].join('\n');
}

async function updateToolCommands() {
  const toolCommandsPath = path.join(__dirname, '../packages/playwright/src/mcp/terminal/commands.ts');
  const commands = browserTools.map(tool => {
    return `helpMessage['${commandNameForTool(tool.schema.name)}'] =\n\`${formatHelpForCommand(tool.schema).replace(/`/g, '\\`')}\`;`;
  });

  const aliasesContent = `export const aliases: Record<string, string[]> = {${Object.entries(aliases).map(([key, value]) => `\n  '${key}': ['${value.join('\', \'')}'],`).join('')}
};`;

  const lines = [
    `export const helpMessage: Record<string, string> = {};`,
    ...commands,
    `export const globalHelp: string =\n\`${formatGlobalHelp().replace(/`/g, '\\`')}\`;`,
    aliasesContent,
  ];

  const startMarker = `// Commands generated by ${path.basename(__filename)}`;
  const endMarker = `// End of commands generated section\n`;

  const content = await fs.promises.readFile(toolCommandsPath, 'utf-8');
  const newContent = await updateSection(content, startMarker, endMarker, lines.join('\n\n'));
  await fs.promises.writeFile(toolCommandsPath, newContent, 'utf-8');
  console.log('Tool commands updated successfully');
}

updateToolCommands().catch(err => {
  console.error('Error updating tool commands:', err);
  process.exit(1);
});
