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
import { parseAgentSpec } from './agentParser';

import type { AgentSpec } from './agent';

/* eslint-disable no-console */

async function loadAgentSpecs(): Promise<AgentSpec[]> {
  const files = await fs.promises.readdir(__dirname);
  return Promise.all(files.filter(file => file.endsWith('.agent.md')).map(file => parseAgentSpec(path.join(__dirname, file))));
}

export class ClaudeGenerator {
  static async init(config: FullConfigInternal, projectName: string, prompts: boolean) {
    await initRepo(config, projectName, {
      promptsFolder: prompts ? '.claude/prompts' : undefined,
    });

    const agents = await loadAgentSpecs();

    await fs.promises.mkdir('.claude/agents', { recursive: true });
    for (const agent of agents)
      await writeFile(`.claude/agents/${agent.name}.md`, ClaudeGenerator.agentSpec(agent), '🤖', 'agent definition');

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

  static agentSpec(agent: AgentSpec): string {
    const claudeToolMap = new Map<string, string[]>([
      ['search', ['Glob', 'Grep', 'Read', 'LS']],
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
    const header = {
      name: agent.name,
      description: agent.description + examples,
      tools: agent.tools.map(tool => asClaudeTool(tool)).join(', '),
      model: agent.model,
      color: agent.color,
    };
    lines.push(`---`);
    lines.push(yaml.stringify(header, { lineWidth: 100000 }) + `---`);
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

    const agents = await loadAgentSpecs();

    for (const agent of agents) {
      const prompt = [agent.instructions];
      prompt.push('');
      prompt.push(...agent.examples.map(example => `<example>${example}</example>`));
      await writeFile(`.opencode/prompts/${agent.name}.md`, prompt.join('\n'), '🤖', 'agent definition');
    }

    await writeFile('opencode.json', OpencodeGenerator.configuration(agents), '🔧', 'opencode configuration');

    initRepoDone();
  }

  static configuration(agents: AgentSpec[]): string {
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
      result['agent'][agent.name] = {
        description: agent.description,
        mode: 'subagent',
        prompt: `{file:.opencode/prompts/${agent.name}.md}`,
        tools,
      };
      for (const tool of agent.tools)
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

    const agents = await loadAgentSpecs();

    await fs.promises.mkdir('.github/agents', { recursive: true });
    for (const agent of agents)
      await writeFile(`.github/agents/${agent.name}.agent.md`, CopilotGenerator.agentSpec(agent), '🤖', 'agent definition');

    await deleteFile(`.github/chatmodes/ 🎭 planner.chatmode.md`, 'legacy planner chatmode');
    await deleteFile(`.github/chatmodes/🎭 generator.chatmode.md`, 'legacy generator chatmode');
    await deleteFile(`.github/chatmodes/🎭 healer.chatmode.md`, 'legacy healer chatmode');
    await deleteFile(`.github/agents/ 🎭 planner.agent.md`, 'legacy planner agent');
    await deleteFile(`.github/agents/🎭 generator.agent.md`, 'legacy generator agent');
    await deleteFile(`.github/agents/🎭 healer.agent.md`, 'legacy healer agent');

    await VSCodeGenerator.appendToMCPJson();

    const mcpConfig = { mcpServers: CopilotGenerator.mcpServers };

    if (!fs.existsSync('.github/copilot-setup-steps.yml')) {
      const yaml = fs.readFileSync(path.join(__dirname, 'copilot-setup-steps.yml'), 'utf-8');
      await writeFile('.github/workflows/copilot-setup-steps.yml', yaml, '🔧', 'GitHub Copilot setup steps');
    }

    console.log('');
    console.log('');
    console.log(' 🔧 TODO: GitHub > Settings > Copilot > Coding agent > MCP configuration');
    console.log('------------------------------------------------------------------');
    console.log(JSON.stringify(mcpConfig, null, 2));
    console.log('------------------------------------------------------------------');

    initRepoDone();
  }

  static agentSpec(agent: AgentSpec): string {
    const examples = agent.examples.length ? ` Examples: ${agent.examples.map(example => `<example>${example}</example>`).join('')}` : '';
    const lines: string[] = [];
    const header = {
      'name': agent.name,
      'description': agent.description + examples,
      'tools': agent.tools,
      'model': 'Claude Sonnet 4',
      'mcp-servers': CopilotGenerator.mcpServers,
    };
    lines.push(`---`);
    lines.push(yaml.stringify(header) + `---`);
    lines.push('');
    lines.push(agent.instructions);
    lines.push('');
    return lines.join('\n');
  }

  static mcpServers = {
    'playwright-test': {
      'type': 'stdio',
      'command': 'npx',
      'args': [
        'playwright',
        'run-test-mcp-server'
      ],
      'tools': ['*']
    },
  };
}

export class VSCodeGenerator {
  static async init(config: FullConfigInternal, projectName: string) {
    await initRepo(config, projectName, {
      promptsFolder: undefined
    });
    const agents = await loadAgentSpecs();

    const nameMap = new Map<string, string>([
      ['playwright-test-planner', ' 🎭 planner'],
      ['playwright-test-generator', '🎭 generator'],
      ['playwright-test-healer', '🎭 healer'],
    ]);

    await fs.promises.mkdir('.github/chatmodes', { recursive: true });
    for (const agent of agents)
      await writeFile(`.github/chatmodes/${nameMap.get(agent.name)}.chatmode.md`, VSCodeGenerator.agentSpec(agent), '🤖', 'chatmode definition');

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

  static agentSpec(agent: AgentSpec): string {
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
    const tools = agent.tools.map(asVscodeTool).flat().sort((a, b) => {
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
    lines.push(`description: ${agent.description}.`);
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
  console.log(` ${icon} ${path.relative(process.cwd(), filePath)} ${colors.dim('- ' + description)}`);
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

  console.log(` ✂️  ${path.relative(process.cwd(), filePath)} ${colors.dim('- ' + description)}`);
  await fs.promises.unlink(filePath);
}

type RepoParams = {
  promptsFolder?: string;
  promptSuffix?: string;
  defaultAgentName?: string;
};

async function initRepo(config: FullConfigInternal, projectName: string, options: RepoParams) {
  const project = seedProject(config, projectName);
  console.log(` 🎭 Using project "${project.project.name}" as a primary project`);

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
  console.log(' ✅ Done.');
}

async function loadPrompt(file: string, params: Record<string, string>) {
  const content = await fs.promises.readFile(path.join(__dirname, file), 'utf-8');
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\\${${key}}`, 'g'), value);
  }, content);
}
