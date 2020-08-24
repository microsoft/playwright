import path from 'path';
import { spawnSync } from "child_process";

export function runTest(filePath: string, ...args) {
  const {output, status} = spawnSync('node', [
    path.join(__dirname, '..', 'cli.js'),
    ...args.filter(x => x.startsWith('-')),
    path.join(__dirname, 'assets', filePath),
    ...args.filter(x => !x.startsWith('-')),
  ]);
  const passing = (/  (\d+) passing/.exec(output.toString()) || [])[1];
  const failing = (/  (\d+) failing/.exec(output.toString()) || [])[1];
  return {
    exitCode: status,
    output,
    passing: parseInt(passing),
    failing: parseInt(failing || '0')
  }
}