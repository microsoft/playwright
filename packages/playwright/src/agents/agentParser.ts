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
import { yaml } from 'playwright-core/lib/utilsBundle';

type AgentSpecHeader = {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
};

export type AgentSpec = {
  name: string;
  description: string;
  model: string;
  color: string;
  tools: string[];
  instructions: string;
  examples: string[];
};

export async function parseAgentSpec(filePath: string): Promise<AgentSpec> {
  const source = await fs.promises.readFile(filePath, 'utf-8');
  const { header, content } = extractYamlAndContent(source);
  const { instructions, examples } = extractInstructionsAndExamples(content);
  return {
    ...header,
    instructions,
    examples,
  };
}

function extractYamlAndContent(markdown: string): { header: AgentSpecHeader; content: string } {
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

  let header: AgentSpecHeader;
  try {
    header = yaml.parse(yamlRaw) as AgentSpecHeader;
  } catch (error: any) {
    throw new Error(`Failed to parse YAML header: ${error.message}`);
  }

  if (!header.name)
    throw new Error('YAML header must contain a "name" field');

  if (!header.description)
    throw new Error('YAML header must contain a "description" field');

  return { header, content };
}

function extractInstructionsAndExamples(content: string): { instructions: string; examples: string[] } {
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
