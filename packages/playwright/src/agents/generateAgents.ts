/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { yaml } from 'playwright-core/lib/utilsBundle';

interface AgentHeader {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
  'mcp-servers': Record<string, McpServerConfig>;
}

interface McpServerConfig {
  type: string;
  command: string;
  args: string[];
  tools: string[];
}

interface Agent {
  header: AgentHeader;
  instructions: string;
  examples: string[];
}

class AgentParser {
  static async parseFile(filePath: string): Promise<Agent> {
    const rawMarkdown = await fs.promises.readFile(filePath, 'utf-8');
    const { header, content } = this.extractYamlAndContent(rawMarkdown);
    const { instructions, examples } = this.extractInstructionsAndExamples(content);
    return { header, instructions, examples };
  }

  static extractYamlAndContent(markdown: string): { header: AgentHeader; content: string } {
    const lines = markdown.split('\n');

    if (lines[0] !== '---')
      throw new Error('Markdown file must start with YAML front matter (---)');

    let yamlEndIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        yamlEndIndex = i;
        break;
      }
    }

    if (yamlEndIndex === -1)
      throw new Error('YAML front matter must be closed with ---');

    const yamlLines = lines.slice(1, yamlEndIndex);
    const yamlRaw = yamlLines.join('\n');
    const contentLines = lines.slice(yamlEndIndex + 1);
    const content = contentLines.join('\n');

    let header: AgentHeader;
    try {
      header = yaml.parse(yamlRaw) as AgentHeader;
    } catch (error: any) {
      throw new Error(`Failed to parse YAML header: ${error.message}`);
    }

    if (!header.name)
      throw new Error('YAML header must contain a "name" field');

    if (!header.description)
      throw new Error('YAML header must contain a "description" field');

    return { header, content };
  }

  static extractInstructionsAndExamples(content: string): { instructions: string; examples: string[] } {
    const examples: string[] = [];

    const instructions = content.split('<example>')[0].trim();
    const exampleRegex = /<example>([\s\S]*?)<\/example>/g;
    let match: RegExpExecArray | null;

    while ((match = exampleRegex.exec(content)) !== null) {
      const example = match[1].trim();
      examples.push(example.replace(/[\n]/g, ' ').replace(/ +/g, ' '));
    }

    return { instructions, examples };
  }
}

const claudeToolMap = new Map<string, string[]>([
  ['ls', ['Glob']],
  ['grep', ['Grep']],
  ['read', ['Read']],
  ['edit', ['Edit', 'MultiEdit', 'NotebookEdit']],
  ['write', ['Write']],
]);

function saveAsClaudeCode(agent: Agent): string {
  function asClaudeTool(hash: string, tool: string): string {
    const [first, second] = tool.split('/');
    if (!second)
      return (claudeToolMap.get(first) || [first]).join(', ');
    return `mcp__${first}-${hash}__${second}`;
  }

  const hash = shortHash(agent.header.name);

  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`name: ${agent.header.name}`);
  lines.push(`description: ${agent.header.description}. Examples: ${agent.examples.map(example => `<example>${example}</example>`).join('')}`);
  lines.push(`tools: ${agent.header.tools.map(tool => asClaudeTool(hash, tool)).join(', ')}`);
  lines.push(`model: ${agent.header.model}`);
  lines.push(`color: ${agent.header.color}`);
  lines.push(`---`);
  lines.push('');
  lines.push(agent.instructions);
  return lines.join('\n');
}

const opencodeToolMap = new Map<string, string[]>([
  ['ls', ['ls', 'glob']],
  ['grep', ['grep']],
  ['read', ['read']],
  ['edit', ['edit']],
  ['write', ['write']],
]);

function saveAsOpencodeJson(agents: Agent[]): string {
  function asOpencodeTool(tools: Record<string, boolean>, hash: string, tool: string): void {
    const [first, second] = tool.split('/');
    if (!second) {
      for (const tool of opencodeToolMap.get(first) || [first])
        tools[tool] = true;
    } else {
      tools[`${first}-${hash}*${second}`] = true;
    }
  }

  const result: Record<string, any> = {};
  result['$schema'] = 'https://opencode.ai/config.json';
  result['mcp'] = {};
  result['tools'] = {
    'playwright*': false,
  };
  result['agent'] = {};
  for (const agent of agents) {
    const hash = shortHash(agent.header.name);
    const tools: Record<string, boolean> = {};
    result['agent'][agent.header.name] = {
      description: agent.header.description,
      mode: 'subagent',
      prompt: `{file:.opencode/prompts/${agent.header.name}.md}`,
      tools,
    };
    for (const tool of agent.header.tools)
      asOpencodeTool(tools, hash, tool);

    for (const [name, mcp] of Object.entries(agent.header['mcp-servers'])) {
      result['mcp'][name + '-' + hash] = {
        type: mcp.type,
        command: [mcp.command, ...mcp.args],
        enabled: true,
      };
    }
  }
  return JSON.stringify(result, null, 2);
}

function shortHash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 4);
}

async function loadAgents(): Promise<Agent[]> {
  const files = await fs.promises.readdir(__dirname);
  return Promise.all(files.filter(file => file.endsWith('.md')).map(file => AgentParser.parseFile(path.join(__dirname, file))));
}

async function writeFile(filePath: string, content: string) {
  // eslint-disable-next-line no-console
  console.log(`Writing file: ${filePath}`);
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

export async function initClaudeCodeRepo() {
  const agents = await loadAgents();

  await fs.promises.mkdir('.claude/agents', { recursive: true });
  for (const agent of agents)
    await writeFile(`.claude/agents/${agent.header.name}.md`, saveAsClaudeCode(agent));

  const mcpServers: Record<string, { command: string; args: string[] }> = {};
  for (const agent of agents) {
    const hash = shortHash(agent.header.name);
    for (const [name, mcp] of Object.entries(agent.header['mcp-servers'])) {
      const entry = {
        command: mcp.command,
        args: mcp.args,
      };
      mcpServers[name + '-' + hash] = entry;
    }
  }
  await writeFile('.mcp.json', JSON.stringify({ mcpServers }, null, 2));
}

export async function initOpencodeRepo() {
  const agents = await loadAgents();

  await fs.promises.mkdir('.opencode/prompts', { recursive: true });
  for (const agent of agents) {
    const prompt = [agent.instructions];
    prompt.push('');
    prompt.push(...agent.examples.map(example => `<example>${example}</example>`));
    await writeFile(`.opencode/prompts/${agent.header.name}.md`, prompt.join('\n'));
  }
  await writeFile('opencode.json', saveAsOpencodeJson(agents));
}
