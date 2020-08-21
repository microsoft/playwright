import "../lib"
import { spawnSync } from "child_process";
import path from 'path';

it('should fail', async() => {
  const result = runTest('one-failure.js');
  expect(result.exitCode).toBe(1);
  expect(result.passing).toBe(0);
  expect(result.failing).toBe(1);
});

it('should succeed', async() => {
  const result = runTest('one-success.js');
  expect(result.exitCode).toBe(0);
  expect(result.passing).toBe(1);
  expect(result.failing).toBe(0);
});

function runTest(filePath: string) {
  const {output, status} = spawnSync('node', [path.join(__dirname, '..', 'cli.js'), path.join(__dirname, 'assets', filePath)]);
  const passing = (/  (\d+) passing/.exec(output.toString()) || [])[1];
  const failing = (/  (\d+) failing/.exec(output.toString()) || [])[1];
  return {
    exitCode: status,
    output,
    passing: parseInt(passing),
    failing: parseInt(failing || '0')
  }
}