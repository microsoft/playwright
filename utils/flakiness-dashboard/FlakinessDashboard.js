const fs = require('fs');
const os = require('os');
const path = require('path');
const spawn = require('child_process').spawn;
const debug = require('debug')('flakiness');

const rmAsync = promisify(require('rimraf'));
const mkdtempAsync = promisify(fs.mkdtemp);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const TMP_FOLDER = path.join(os.tmpdir(), 'flakiness_tmp_folder-');

const RED_COLOR = '\x1b[31m';
const GREEN_COLOR = '\x1b[32m';
const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

const DASHBOARD_VERSION = 1;
const DASHBOARD_FILENAME = 'dashboard.json';
const DASHBOARD_MAX_BUILDS = 100;

class FlakinessDashboard {
  static async getCommitDetails(repoPath, ref = 'HEAD') {
    const {stdout: timestamp} = await spawnAsyncOrDie('git', 'show', '-s', '--format=%ct', ref, {cwd: repoPath});
    const {stdout: sha} = await spawnAsyncOrDie('git', 'rev-parse', ref, {cwd: repoPath});
    return {timestamp: timestamp * 1000, sha: sha.trim()};
  }

  constructor({build, commit, dashboardRepo}) {
    if (!commit)
      throw new Error('"options.commit" must be specified!');
    if (!commit.sha)
      throw new Error('"options.commit.sha" must be specified!');
    if (!commit.timestamp)
      throw new Error('"options.commit.timestamp" must be specified!');
    if (!build)
      throw new Error('"options.build" must be specified!');
    if (!build.url)
      throw new Error('"options.build.url" must be specified!');
    if (!dashboardRepo.branch)
      throw new Error('"options.dashboardRepo.branch" must be specified!');
    this._dashboardRepo = dashboardRepo;
    this._build = new Build(Date.now(), build.url, commit, []);
  }

  reportTestResult(test) {
    this._build._tests.push(test);
  }

  setBuildResult(result) {
    this._build._result = result;
  }

  async uploadAndCleanup() {
    console.log(`\n${YELLOW_COLOR}=== UPLOADING Flakiness Dashboard${RESET_COLOR}`);
    const startTimestamp = Date.now();
    const branch = this._dashboardRepo.branch.toLowerCase().replace(/\s/g, '-').replace(/[^-0-9a-zа-яё]/ig, '');
    console.log(`  > Dashboard URL: ${this._dashboardRepo.url}`);
    console.log(`  > Dashboard Branch: ${branch}`);
    const git = await Git.initialize(this._dashboardRepo.url, branch, this._dashboardRepo.username, this._dashboardRepo.email, this._dashboardRepo.password);
    console.log(`  > Dashboard Checkout: ${git.path()}`);

    // Do at max 7 attempts to upload changes to github.
    let success = false;
    const MAX_ATTEMPTS = 7;
    for (let i = 0; !success && i < MAX_ATTEMPTS; ++i) {
      await saveBuildToDashboard(git.path(), this._build);
      // if push went through - great! We're done!
      if (await git.commitAllAndPush(`update dashboard\n\nbuild: ${this._build._url}`)) {
        success = true;
        console.log(`  > Push attempt ${YELLOW_COLOR}${i + 1}${RESET_COLOR} of ${YELLOW_COLOR}${MAX_ATTEMPTS}${RESET_COLOR}: ${GREEN_COLOR}SUCCESS${RESET_COLOR}`);
      } else {
        // Otherwise - wait random time between 3 and 11 seconds.
        const cooldown = 3000 + Math.round(Math.random() * 1000) * 8;
        console.log(`  > Push attempt ${YELLOW_COLOR}${i + 1}${RESET_COLOR} of ${YELLOW_COLOR}${MAX_ATTEMPTS}${RESET_COLOR}: ${RED_COLOR}FAILED${RESET_COLOR}, cooldown ${YELLOW_COLOR}${cooldown / 1000}${RESET_COLOR} seconds`);
        await new Promise(x => setTimeout(x, cooldown));
        // Reset our generated dashboard and pull from origin.
        await git.hardResetToOriginMaster();
        await git.pullFromOrigin();
      }
    }
    await rmAsync(git.path());
    console.log(`  > TOTAL TIME: ${YELLOW_COLOR}${(Date.now() - startTimestamp) / 1000}${RESET_COLOR} seconds`);
    if (success)
      console.log(`${YELLOW_COLOR}=== COMPLETE${RESET_COLOR}`);
    else
      console.log(`${RED_COLOR}=== FAILED${RESET_COLOR}`);
    console.log('');
  }
}

async function saveBuildToDashboard(dashboardPath, build) {
  const filePath = path.join(dashboardPath, DASHBOARD_FILENAME);
  let data = null;
  try {
    data = JSON.parse(await readFileAsync(filePath));
  } catch (e) {
    // Looks like there's no dashboard yet - create one.
    data = {builds: []};
  }
  if (!data.builds)
    throw new Error('Unrecognized dashboard format!');
  data.builds.push({
    version: DASHBOARD_VERSION,
    result: build._result,
    timestamp: build._timestamp,
    url: build._url,
    commit: build._commit,
    tests: build._tests,
  });
  if (data.builds.length > DASHBOARD_MAX_BUILDS)
    data.builds = data.builds.slice(data.builds.length - DASHBOARD_MAX_BUILDS);
  await writeFileAsync(filePath, JSON.stringify(data));
}

class Build {
  constructor(timestamp, url, commit, tests) {
    this._timestamp = timestamp;
    this._url = url;
    this._commit = commit;
    this._tests = tests;
    this._result = undefined;
  }
}

module.exports = {FlakinessDashboard};

function promisify(nodeFunction) {
  function promisified(...args) {
    return new Promise((resolve, reject) => {
      function callback(err, ...result) {
        if (err)
          return reject(err);
        if (result.length === 1)
          return resolve(result[0]);
        return resolve(result);
      }
      nodeFunction.call(null, ...args, callback);
    });
  }
  return promisified;
}

class Git {
  static async initialize(url, branch, username, email, password) {
    let schemeIndex = url.indexOf('://');
    if (schemeIndex === -1)
      throw new Error(`Malformed URL "${url}": expected to start with "https://"`);
    schemeIndex += '://'.length;
    url = url.substring(0, schemeIndex) + username + ':' + password + '@' + url.substring(schemeIndex);
    const repoPath = await mkdtempAsync(TMP_FOLDER);
    // Check existence of a remote branch for this bot.
    const {stdout} = await spawnAsync('git', 'ls-remote', '--heads', url, branch);
    // If there is no remote branch for this bot - create one.
    if (!stdout.includes(branch)) {
      await spawnAsyncOrDie('git', 'clone', '--no-checkout', '--depth=1', url, repoPath);

      await spawnAsyncOrDie('git', 'checkout', '--orphan', branch, {cwd: repoPath});
      await spawnAsyncOrDie('git', 'reset', '--hard', {cwd: repoPath});
    } else {
      await spawnAsyncOrDie('git', 'clone', '--single-branch', '--branch', `${branch}`, '--depth=1', url, repoPath);
    }
    await spawnAsyncOrDie('git', 'config', 'user.email', `"${email}"`, {cwd: repoPath});
    await spawnAsyncOrDie('git', 'config', 'user.name', `"${username}"`, {cwd: repoPath});
    return new Git(repoPath, url, branch, username);
  }

  async commitAllAndPush(message) {
    await spawnAsyncOrDie('git', 'add', '.', {cwd: this._repoPath});
    await spawnAsyncOrDie('git', 'commit', '-m', `${message}`, '--author', '"playwright-flakiness <aslushnikov+playwrightflakiness@gmail.com>"', {cwd: this._repoPath});
    const {code} = await spawnAsync('git', 'push', 'origin', this._branch, {cwd: this._repoPath});
    return code === 0;
  }

  async hardResetToOriginMaster() {
    await spawnAsyncOrDie('git', 'reset', '--hard', `origin/${this._branch}`, {cwd: this._repoPath});
  }

  async pullFromOrigin() {
    await spawnAsyncOrDie('git', 'pull', 'origin', this._branch, {cwd: this._repoPath});
  }

  constructor(repoPath, url, branch, username) {
    this._repoPath = repoPath;
    this._url = url;
    this._branch = branch;
    this._username = username;
  }

  path() {
    return this._repoPath;
  }
}

async function spawnAsync(command, ...args) {
  let options = {};
  if (args.length && args[args.length - 1].constructor.name !== 'String')
    options = args.pop();
  const cmd = spawn(command, args, options);
  let stdout = '';
  let stderr = '';
  cmd.stdout.on('data', data => stdout += data);
  cmd.stderr.on('data', data => stderr += data);
  const code = await new Promise(x => cmd.once('close', x));
  if (stdout)
    debug(stdout);
  if (stderr)
    debug(stderr);
  return {code, stdout, stderr};
}

async function spawnAsyncOrDie(command, ...args) {
  const {code, stdout, stderr} = await spawnAsync(command, ...args);
  if (code !== 0)
    throw new Error(`Failed to executed: "${command} ${args.join(' ')}".\n\n=== STDOUT ===\n${stdout}\n\n\n=== STDERR ===\n${stderr}`);
  return {stdout, stderr};
}
