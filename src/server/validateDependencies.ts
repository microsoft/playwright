import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as os from 'os';
import {spawn} from 'child_process';
import {linuxLddDirectories, BrowserDescriptor} from '../install/browserPaths.js';

const accessAsync = util.promisify(fs.access.bind(fs));
const checkExecutable = (filePath: string) => accessAsync(filePath, fs.constants.X_OK).then(() => true).catch(e => false);
const statAsync = util.promisify(fs.stat.bind(fs));
const readdirAsync = util.promisify(fs.readdir.bind(fs));

export async function validateDependencies(browserPath: string, browser: BrowserDescriptor) {
  // We currently only support Linux.
  if (os.platform() !== 'linux')
    return;
  const directoryPaths = linuxLddDirectories(browserPath, browser);
  const lddPaths: string[] = [];
  for (const directoryPath of directoryPaths)
    lddPaths.push(...(await executablesOrSharedLibraries(directoryPath)));
  const allMissingDeps = await Promise.all(lddPaths.map(lddPath => missingFileDependencies(lddPath)));
  const missingDeps = new Set();
  for (const deps of allMissingDeps) {
    for (const dep of deps)
      missingDeps.add(dep);
  }
  if (!missingDeps.size)
    return;
  const deps = [...missingDeps].sort().map(dep => '   ' + dep).join('\n');
  throw new Error('Host system is missing dependencies to run browser:\n' + deps);
}

async function executablesOrSharedLibraries(directoryPath: string): Promise<string[]> {
  const allPaths = (await readdirAsync(directoryPath)).map(file => path.resolve(directoryPath, file));
  const allStats = await Promise.all(allPaths.map(aPath => statAsync(aPath)));
  const filePaths = allPaths.filter((aPath, index) => allStats[index].isFile());

  const executablersOrLibraries = (await Promise.all(filePaths.map(async filePath => {
    const basename = path.basename(filePath).toLowerCase();
    if (basename.endsWith('.so') || basename.includes('.so.'))
      return filePath;
    if (await checkExecutable(filePath))
      return filePath;
    return false;
  }))).filter(Boolean);

  return executablersOrLibraries as string[];
}

async function missingFileDependencies(filePath: string): Promise<Array<string>> {
  const {stdout} = await lddAsync(filePath);
  const missingDeps = stdout.split('\n').map(line => line.trim()).filter(line => line.endsWith('not found') && line.includes('=>')).map(line => line.split('=>')[0].trim());
  return missingDeps;
}

function lddAsync(filePath: string): Promise<{stdout: string, stderr: string, code: number}> {
  const dirname = path.dirname(filePath);
  const ldd = spawn('ldd', [filePath], {
    cwd: dirname,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: dirname,
    },
  });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    ldd.stdout.on('data', data => stdout += data);
    ldd.stderr.on('data', data => stderr += data);
    ldd.on('close', (code) => {
      resolve({stdout, stderr, code});
    });
  });
}
