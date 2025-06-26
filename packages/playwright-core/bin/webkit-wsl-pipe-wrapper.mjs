// @ts-check
import net from 'net';
import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';

const socketPort = process.env.SOCKET_ADDRESS;

if (!socketPort)
    throw new Error('SOCKET_ADDRESS is not set');
const address = (() => {
  if (execSync('wslinfo --networking-mode', { encoding: 'utf8' }).trim() === 'nat') {
    const ip = execSync('ip route show', { encoding: 'utf8' }).trim().split('\n').find(line => line.includes('default'))?.split(' ')[2];
    if (!ip)
      throw new Error('Could not determine WSL IP address');
    return ip;
}
  return '127.0.0.1';
})();

const socket = net.createConnection(parseInt(socketPort), address);
socket.setNoDelay(true);
socket.on('error', (error) => console.log('socket error from wrapper', error));

await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('error', reject);
});

const [executable, ...args] = process.argv.slice(2);

// 3 is readFD and 4 is writeFD
const child = spawn(executable, args, {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe']
});

// Connect socket to child process pipes
socket.pipe(child.stdio[3]);
child.stdio[4].pipe(socket);

// Handle cleanup
socket.on('end', () => {
    child.kill();
});

child.on('exit', () => {
    socket.end();
});

await new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
});
