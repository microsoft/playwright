#!/usr/bin/env node
import { runCli } from '../src/cli.mjs';

try {
  const code = await runCli();
  if (code === 'serving') {
    await new Promise(() => {});
  } else if (typeof code === 'number' && code !== 0) {
    process.exitCode = code;
  }
} catch (err) {
  process.stderr.write(`${err?.message ?? err}\n`);
  process.exitCode = 1;
}
