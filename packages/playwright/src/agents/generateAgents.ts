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

export class ClaudeGenerator {
  static async init(config: FullConfigInternal, projectName: string, prompts: boolean) {
    await initRepo(config, projectName, {
      promptsFolder: prompts ? '.claude/prompts' : undefined,
    });

    const agents = await AgentParser.loadAgents();

    await fs.promises.mkdir('.claude/agents', { recursive: true });
    for (const agent of agents)
      await writeFile(`.claude/agents/${agent.header.name}.md`, ClaudeGenerator.agentSpec(agent), '🤖', 'agent definition');

    await deleteFile(`.claude/agents/playwright-test-planner.md`, 'legacy planner agent');
    await deleteFile(`.claude/agents/playwright-test-generator.md`, 'legacy generator agent');
    await deleteFile(`.claude/agents/playwright-test-healer.md`, 'legacy healer agent');

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
      ['search', ['Glob', 'Grep', 'Read']],
      ['edit', ['Edit', 'MultiEdit', 'Write']],
    ]);

    function asClaudeTool(tool: string): string {
      const [first, second] = tool.split('/');
      if (!second)
        return (claudeToolMap.get(first) || [first]).join(', ');
      return `mcp__${first}__${second}`;
    }

    const examples = agent.examples.length ? ` Examples: ${agent.examples.map(example => `<example>${example}</example>`).join('')}` : '';
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${agent.header.name}`);
    lines.push(`description: ${agent.header.description}.${examples}`);
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
  static async init(config: FullConfigInternal, projectName: string, prompts: boolean) {
    await initRepo(config, projectName, {
      defaultAgentName: 'Build',
      promptsFolder: prompts ? '.opencode/prompts' : undefined
    });

    const agents = await AgentParser.loadAgents();

    for (const agent of agents) {
      const prompt = [agent.instructions];
      prompt.push('');
      prompt.push(...agent.examples.map(example => `<example>${example}</example>`));
      await writeFile(`.opencode/prompts/${agent.header.name}.md`, prompt.join('\n'), '🤖', 'agent definition');
    }

    await deleteFile(`.opencode/prompts/playwright-test-planner.md`, 'legacy planner agent');
    await deleteFile(`.opencode/prompts/playwright-test-generator.md`, 'legacy generator agent');
    await deleteFile(`.opencode/prompts/playwright-test-healer.md`, 'legacy healer agent');

    await writeFile('opencode.json', OpencodeGenerator.configuration(agents), '🔧', 'opencode configuration');

    initRepoDone();
  }

  static configuration(agents: Agent[]): string {
    const opencodeToolMap = new Map<string, string[]>([
      ['search', ['ls', 'glob', 'grep', 'read']],
      ['edit', ['edit', 'write']],
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
        prompt: `{file:.opencode/prompts/${agent.header.name}.md}`,
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
export class CopilotGenerator {
  static async init(config: FullConfigInternal, projectName: string, prompts: boolean) {

    await initRepo(config, projectName, {
      defaultAgentName: 'agent',
      promptsFolder: prompts ? '.github/prompts' : undefined,
      promptSuffix: 'prompt'
    });

    const agents = await AgentParser.loadAgents();

    await fs.promises.mkdir('.github/agents', { recursive: true });
    for (const agent of agents)
      await writeFile(`.github/agents/${agent.header.name}.agent.md`, CopilotGenerator.agentSpec(agent), '🤖', 'agent definition');

    await deleteFile(`.github/chatmodes/ 🎭 planner.chatmode.md`, 'legacy planner chatmode');
    await deleteFile(`.github/chatmodes/🎭 generator.chatmode.md`, 'legacy generator chatmode');
    await deleteFile(`.github/chatmodes/🎭 healer.chatmode.md`, 'legacy healer chatmode');

    await VSCodeGenerator.appendToMCPJson();

    initRepoDone();
  }

  static agentSpec(agent: Agent): string {
    const examples = agent.examples.length ? ` Examples: ${agent.examples.map(example => `<example>${example}</example>`).join('')}` : '';
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`name: ${agent.header.name}`);
    lines.push(`description: ${agent.header.description}.${examples}`);
    lines.push(`tools:\n${agent.header.tools.map(tool => `  - ${tool}`).join('\n')}`);
    lines.push(`model: Claude Sonnet 4`);
    lines.push(`---`);
    lines.push('');
    lines.push(agent.instructions);
    lines.push('');
    return lines.join('\n');
  }
}

export class VSCodeGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    await initRepo(config, projectName, {
      promptsFolder: undefined
    });
    const agents = await AgentParser.loadAgents();

    const nameMap = new Map<string, string>([
      ['playwright-test-planner', ' 🎭 planner'],
      ['playwright-test-generator', '🎭 generator'],
      ['playwright-test-healer', '🎭 healer'],
    ]);

    await fs.promises.mkdir('.github/chatmodes', { recursive: true });
    for (const agent of agents)
      await writeFile(`.github/chatmodes/${nameMap.get(agent.header.name)}.chatmode.md`, VSCodeGenerator.agentSpec(agent), '🤖', 'chatmode definition');

    await VSCodeGenerator.appendToMCPJson();

    initRepoDone();
  }

  static async appendToMCPJson() {
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

    lines.push('');
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
  promptsFolder?: string;
  promptSuffix?: string;
  defaultAgentName?: string;
};

async function initRepo(config: FullConfigInternal, projectName: string, options: RepoParams) {
  const project = seedProject(config, projectName);
  console.log(`- 🎭 Using project "${project.project.name}" as a primary project`);

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

  if (options.promptsFolder) {
    await fs.promises.mkdir(options.promptsFolder, { recursive: true });

    for (const promptFile of await fs.promises.readdir(__dirname)) {
      if (!promptFile.endsWith('.prompt.md'))
        continue;
      const shortName = promptFile.replace('.prompt.md', '');
      const fileName = options.promptSuffix ? `${shortName}.${options.promptSuffix}.md` : `${shortName}.md`;
      const content = await loadPrompt(promptFile, {
        defaultAgentName: 'default',
        ...options,
        seedFile: path.relative(process.cwd(), seedFile)
      });
      await writeFile(path.join(options.promptsFolder, fileName), content, '📝', 'prompt template');
    }
  }
}

function initRepoDone() {
  console.log('✅ Done.');
}

async function loadPrompt(file: string, params: Record<string, string>) {
  const content = await fs.promises.readFile(path.join(__dirname, file), 'utf-8');
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\\${${key}}`, 'g'), value);
  }, content);
}
