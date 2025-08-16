// @ts-check
import net from 'net';
import { execSync, spawn } from 'child_process';

const socketPort = process.env.PW_WKWSL_PORT;
delete process.env.PW_WKWSL_PORT;
if (!socketPort)
    throw new Error('PW_WKWSL_PORT env var is not set');

const [executable, ...args] = process.argv.slice(2);


const address = (() => {
    return '127.0.0.1';
})();

const socket = net.createConnection(parseInt(socketPort), address);
// socket.setNoDelay(true);

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
