#!/usr/bin/env node
import path from 'node:path';
import { loadConfig, resolveConfig } from '../src/config.mjs';
import { runMcpServer } from '../src/mcp.mjs';

const root = path.resolve(process.argv[2] ?? process.cwd());
const { config: fileConfig } = await loadConfig(root);
const config = resolveConfig(root, fileConfig);
runMcpServer({ root, config });
