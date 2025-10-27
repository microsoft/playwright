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

import fs from 'fs';
import path from 'path';

import { colors, yaml } from 'playwright-core/lib/utilsBundle';
import { mkdirIfNeeded } from 'playwright-core/lib/utils';

import { FullConfigInternal } from '../common/config';
import { defaultSeedFile, findSeedFile, seedFileContent, seedProject } from '../mcp/test/seed';

interface AgentHeader {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
}

interface Agent {
  source: string;
  header: AgentHeader;
  instructions: string;
  examples: string[];
}

/* eslint-disable no-console */

class AgentParser {
  static async loadAgents(): Promise<Agent[]> {
    const files = await fs.promises.readdir(__dirname);
    return Promise.all(files.filter(file => file.endsWith('.agent.md')).map(file => AgentParser.parseFile(path.join(__dirname, file))));
  }

  static async parseFile(filePath: string): Promise<Agent> {
    const source = await fs.promises.readFile(filePath, 'utf-8');
    const { header, content } = this.extractYamlAndContent(source);
    const { instructions, examples } = this.extractInstructionsAndExamples(content);
    return { source, header, instructions, examples };
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

export class ClaudeGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    await initRepo(config, projectName, {
      promptsFolder: '.claude/prompts',
    });

    const agents = await AgentParser.loadAgents();

    await fs.promises.mkdir('.claude/agents', { recursive: true });
    for (const agent of agents)
      await writeFile(`.claude/agents/${agent.header.name}.agent.md`, ClaudeGenerator.agentSpec(agent), '🤖', 'agent definition');

    await writeFile('.mcp.json', JSON.stringify({
      mcpServers: {
        'playwright-test': {
          command: 'npx',
          args: ['playwright', 'run-test-mcp-server'],
        }
      }
    }, null, 2), '🔧', 'mcp configuration');

    initRepoDone();
  }

  static agentSpec(agent: Agent): string {
    const claudeToolMap = new Map<string, string[]>([
      ['search', ['Glob', 'Grep']],
      ['read', ['Read']],
      ['edit', ['Edit', 'MultiEdit']],
      ['write', ['Write']],
    ]);

    function asClaudeTool(tool: string): string {
      const [first, second] = tool.split('/');
      if (!second)
        return (claudeToolMap.get(first) || [first]).join(', ');
      return `mcp__${first}__${second}`;
    }

    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${agent.header.name}`);
    lines.push(`description: ${agent.header.description}. Examples: ${agent.examples.map(example => `<example>${example}</example>`).join('')}`);
    lines.push(`tools: ${agent.header.tools.map(tool => asClaudeTool(tool)).join(', ')}`);
    lines.push(`model: ${agent.header.model}`);
    lines.push(`color: ${agent.header.color}`);
    lines.push(`---`);
    lines.push('');
    lines.push(agent.instructions);
    return lines.join('\n');
  }
}

export class OpencodeGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    await initRepo(config, projectName, {
      agentDefault: 'Build',
      promptsFolder: '.opencode/prompts'
    });

    const agents = await AgentParser.loadAgents();

    for (const agent of agents) {
      const prompt = [agent.instructions];
      prompt.push('');
      prompt.push(...agent.examples.map(example => `<example>${example}</example>`));
      await writeFile(`.opencode/prompts/${agent.header.name}.agent.md`, prompt.join('\n'), '🤖', 'agent definition');
    }
    await writeFile('opencode.json', OpencodeGenerator.configuration(agents), '🔧', 'opencode configuration');

    initRepoDone();
  }

  static configuration(agents: Agent[]): string {
    const opencodeToolMap = new Map<string, string[]>([
      ['search', ['ls', 'glob', 'grep']],
      ['read', ['read']],
      ['edit', ['edit']],
      ['write', ['write']],
    ]);

    const asOpencodeTool = (tools: Record<string, boolean>, tool: string) => {
      const [first, second] = tool.split('/');
      if (!second) {
        for (const tool of opencodeToolMap.get(first) || [first])
          tools[tool] = true;
      } else {
        tools[`${first}*${second}`] = true;
      }
    };

    const result: Record<string, any> = {};
    result['$schema'] = 'https://opencode.ai/config.json';
    result['mcp'] = {};
    result['tools'] = {
      'playwright*': false,
    };
    result['agent'] = {};
    for (const agent of agents) {
      const tools: Record<string, boolean> = {};
      result['agent'][agent.header.name] = {
        description: agent.header.description,
        mode: 'subagent',
        prompt: `{file:.opencode/prompts/${agent.header.name}.agent.md}`,
        tools,
      };
      for (const tool of agent.header.tools)
        asOpencodeTool(tools, tool);
    }

    result['mcp']['playwright-test'] = {
      type: 'local',
      command: ['npx', 'playwright', 'run-test-mcp-server'],
      enabled: true,
    };

    return JSON.stringify(result, null, 2);
  }
}
export class AgentGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    const agentsFolder = process.env.AGENTS_FOLDER;
    if (!agentsFolder) {
      console.error('AGENTS_FOLDER environment variable is not set');
      return;
    }

    await initRepo(config, projectName, {
      promptsFolder: path.join(agentsFolder, 'prompts')
    });

    const agents = await AgentParser.loadAgents();

    await fs.promises.mkdir(agentsFolder, { recursive: true });
    for (const agent of agents)
      await writeFile(`${agentsFolder}/agents/${agent.header.name}.md`, agent.source, '🤖', 'agent definition');

    console.log('🔧 MCP configuration');
    console.log(JSON.stringify({
      mcpServers: {
        'playwright-test': {
          type: 'stdio',
          command: 'npx',
          args: [
            `--prefix=${path.resolve(process.cwd())}`,
            'playwright',
            'run-test-mcp-server',
            `--headless`,
            `--config=${path.resolve(process.cwd())}`,
          ],
          tools: ['*']
        }
      }
    }, null, 2));

    initRepoDone();
  }
}

export class VSCodeGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    await initRepo(config, projectName, {
      agentDefault: 'agent',
      agentHealer: '🎭 healer',
      agentGenerator: '🎭 generator',
      agentPlanner: '🎭 planner',
      promptsFolder: '.github/prompts'
    });
    const agents = await AgentParser.loadAgents();

    const nameMap = new Map<string, string>([
      ['playwright-test-planner', '🎭 planner'],
      ['playwright-test-generator', '🎭 generator'],
      ['playwright-test-healer', '🎭 healer'],
    ]);

    await deleteFile(`.github/chatmodes/ 🎭 planner.chatmode.md`, 'old planner chatmode');

    await fs.promises.mkdir('.github/chatmodes', { recursive: true });
    for (const agent of agents)
      await writeFile(`.github/chatmodes/${nameMap.get(agent.header.name)}.chatmode.md`, VSCodeGenerator.agentSpec(agent), '🤖', 'chatmode definition');

    await fs.promises.mkdir('.vscode', { recursive: true });

    const mcpJsonPath = '.vscode/mcp.json';
    let mcpJson: any = {
      servers: {},
      inputs: []
    };
    try {
      mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
    } catch {
    }

    if (!mcpJson.servers)
      mcpJson.servers = {};

    mcpJson.servers['playwright-test'] = {
      type: 'stdio',
      command: 'npx',
      args: ['playwright', 'run-test-mcp-server'],
    };
    await writeFile(mcpJsonPath, JSON.stringify(mcpJson, null, 2), '🔧', 'mcp configuration');

    initRepoDone();
  }

  static agentSpec(agent: Agent): string {
    const vscodeToolMap = new Map<string, string[]>([
      ['search', ['search/listDirectory', 'search/fileSearch', 'search/textSearch']],
      ['read', ['search/readFile']],
      ['edit', ['edit/editFiles']],
      ['write', ['edit/createFile', 'edit/createDirectory']],
    ]);
    const vscodeToolsOrder = ['edit/createFile', 'edit/createDirectory', 'edit/editFiles', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'search/readFile'];
    const vscodeMcpName = 'playwright-test';

    function asVscodeTool(tool: string): string | string[] {
      const [first, second] = tool.split('/');
      if (second)
        return `${vscodeMcpName}/${second}`;
      return vscodeToolMap.get(first) || first;
    }
    const tools = agent.header.tools.map(asVscodeTool).flat().sort((a, b) => {
      // VSCode insists on the specific tools order when editing agent config.
      const indexA = vscodeToolsOrder.indexOf(a);
      const indexB = vscodeToolsOrder.indexOf(b);
      if (indexA === -1 && indexB === -1)
        return a.localeCompare(b);
      if (indexA === -1)
        return 1;
      if (indexB === -1)
        return -1;
      return indexA - indexB;
    }).map(tool => `'${tool}'`).join(', ');

    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`description: ${agent.header.description}.`);
    lines.push(`tools: [${tools}]`);
    lines.push(`---`);
    lines.push('');
    lines.push(agent.instructions);
    for (const example of agent.examples)
      lines.push(`<example>${example}</example>`);

    return lines.join('\n');
  }
}

async function writeFile(filePath: string, content: string, icon: string, description: string) {
  console.log(`- ${icon} ${path.relative(process.cwd(), filePath)} ${colors.dim('- ' + description)}`);
  await mkdirIfNeeded(filePath);
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

async function deleteFile(filePath: string, description: string) {
  try {
    if (!fs.existsSync(filePath))
      return;
  } catch {
    return;
  }

  console.log(`- ✂️  ${path.relative(process.cwd(), filePath)} ${colors.dim('- ' + description)}`);
  await fs.promises.unlink(filePath);
}

type RepoParams = {
  promptsFolder: string;
  agentDefault?: string;
  agentHealer?: string;
  agentGenerator?: string;
  agentPlanner?: string;
};

async function initRepo(config: FullConfigInternal, projectName: string, options: RepoParams) {
  const project = seedProject(config, projectName);
  console.log(`🎭 Using project "${project.project.name}" as a primary project`);

  if (!fs.existsSync('specs')) {
    await fs.promises.mkdir('specs');
    await writeFile(path.join('specs', 'README.md'), `# Specs

This is a directory for test plans.
`, '📝', 'directory for test plans');
  }

  let seedFile = await findSeedFile(project);
  if (!seedFile) {
    seedFile = defaultSeedFile(project);
    await writeFile(seedFile, seedFileContent, '🌱', 'default environment seed file');
  }

  await fs.promises.mkdir(options.promptsFolder, { recursive: true });

  for (const promptFile of await fs.promises.readdir(__dirname)) {
    if (!promptFile.endsWith('.prompt.md'))
      continue;
    const content = await loadPrompt(promptFile, { ...options, seedFile: path.relative(process.cwd(), seedFile) });
    await writeFile(path.join(options.promptsFolder, promptFile), content, '📝', 'prompt template');
  }
}

function initRepoDone() {
  console.log('✅ Done.');
}

async function loadPrompt(file: string, params: Record<string, string>) {
  const templateParams = {
    agentDefault: params.agentDefault ?? 'default',
    agentHealer: params.agentHealer ?? 'playwright-test-healer',
    agentGenerator: params.agentGenerator ?? 'playwright-test-generator',
    agentPlanner: params.agentPlanner ?? 'playwright-test-planner',
    seedFile: params.seedFile,
  };

  const content = await fs.promises.readFile(path.join(__dirname, file), 'utf-8');
  return Object.entries(templateParams).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\\${${key}}`, 'g'), value);
  }, content);
}
