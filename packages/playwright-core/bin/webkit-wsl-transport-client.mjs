// @ts-check
import net from 'net';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';

const socketPort = process.env.PW_WKWSL_PORT;
delete process.env.PW_WKWSL_PORT;
if (!socketPort)
    throw new Error('PW_WKWSL_PORT env var is not set');

const [executable, ...args] = process.argv.slice(2);

if (!(await fs.promises.stat(executable)).isFile())
    throw new Error(`Executable does not exist. Did you update Playwright recently? Make sure to run npx playwright install webkit-wsl`);

const address = (() => {
    const res = spawnSync('/usr/bin/wslinfo', ['--networking-mode'], { encoding: 'utf8'});
    if (res.error || res.status !== 0)
        throw new Error(`Failed to run /usr/bin/wslinfo --networking-mode: ${res.error?.message || res.stderr || res.status}`);
    if (res.stdout.trim() === 'nat') {
        const ipRes = spawnSync('/usr/sbin/ip', ['route', 'show'], { encoding: 'utf8' });
        if (ipRes.error || ipRes.status !== 0)
            throw new Error(`Failed to run ip route show: ${ipRes.error?.message || ipRes.stderr || ipRes.status}`);
        const ip = ipRes.stdout.trim().split('\n').find(line => line.includes('default'))?.split(' ')[2];
        if (!ip)
            throw new Error('Could not determine WSL IP address (NAT mode).');
        return ip;
    }
    return '127.0.0.1';
})();

const socket = net.createConnection(parseInt(socketPort), address);
socket.setNoDelay(true);

await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('error', reject);
});

// 3 is readFD and 4 is writeFD
const child = spawn(executable, args, {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe']
});

socket.pipe(/** @type {NodeJS.WritableStream} */ (child.stdio[3]));
/** @type {NodeJS.ReadableStream} */ (child.stdio[4]).pipe(socket);

// Handle cleanup
socket.on('end', () => child.kill());

child.on('exit', (exitCode) => {
    socket.end();
    process.exit(exitCode || 0);
});

await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
});
