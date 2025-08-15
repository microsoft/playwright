// Copyright (c) Microsoft Corporation.
//
// Tiny helper that:
// 1. Starts a TCP server (single connection) used as a transport.
// 2. Exposes its port to the spawned child process via PW_WKWSL_PORT env var
//    (and marks it for propagation with WSLENV when crossing Windows <-> WSL).
// 3. Bridges between parent-side pipe fd3/fd4 and the accepted TCP socket.
// 4. Spawns the target executable passed on the CLI (first arg), forwarding
//    remaining args, and performs robust cleanup on exit / signals.
// @ts-check
import net from 'net';
import fs from 'fs';
import { spawn } from 'child_process';

function log(...args) {
	if (process.env.PW_WRAPPER_DEBUG)
		console.error('[webkit-wsl-host-wrapper]', ...args);
}

async function main() {
	const argv = process.argv.slice(2);
	if (!argv.length) {
		console.error('Usage: node webkit-wsl-host-wrapper.mjs <executable> [args...]');
		process.exit(1);
	}

	// Prepare parent <-> wrapper pipe endpoints (fd 3 / 4 expected to be set up by the launcher).
	let parentRead; // data coming from parent (we read this and forward to socket)
	let parentWrite; // data going to parent (we write into this from socket)
	try {
		parentRead = fs.createReadStream('', { fd: 3 });
		parentWrite = fs.createWriteStream('', { fd: 4 });
	} catch (e) {
		console.error('Failed to open pipe fds 3/4:', e);
		process.exit(1);
	}

	console.log('parentRead is paused', parentRead.isPaused())

	const server = net.createServer({
		// highWaterMark: 128 * 1024,
	});

	const sockets = new Set();
	server.on('connection', socket => {
		if (sockets.size > 0) {
			log('Extra connection received, destroying.');
			socket.destroy();
			return;
		}
		sockets.add(socket);
		log('Client connected, wiring pipes.');
		parentRead.on('data', data => socket.write(data));
		socket.on('data', data => parentWrite.write(data));

		socket.on('close', () => {
			log('Socket closed');
			console.log('parentRead is paused', parentRead.isPaused())
			parentRead.removeAllListeners('data');
			sockets.delete(socket);
		});
	});

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, resolve);
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		console.error('Failed to obtain listening address');
		process.exit(1);
	}
	const port = address.port;
	log('Server listening on', port);

	// Spawn child process with augmented env (propagate port + mark for WSL env forwarding when needed).
	const env = {
		...process.env,
		WSLENV: 'PW_WKWSL_PORT',
		PW_WKWSL_PORT: String(port),
    WEBKIT_EXECUTABLE: undefined,
	};

	const child = spawn('node.exe', [
    'packages\\playwright-core\\bin\\webkit-wsl-transport-client.mjs',
    'C:\\Users\\maxschmitt\\AppData\\Local\\ms-playwright\\webkit-2198\\Playwright.exe',
    ...argv,
  ], { env, stdio: ['ignore', 'inherit', 'inherit'],
	 });

	log('Spawned child pid', child.pid);

	// If the spawned process exposes its own inspector protocol via fd3/4 we could bridge it here.
	// For now, we only provide the TCP server + env for it to connect back.

	child.on('close', (code, signal) => {
		log('Child exit', { code, signal });
		shutdown(code ?? (signal ? 0 : 0));
	});
	child.on('error', err => {
		console.error('Child process failed to start:', err);
		shutdown(1);
	});

	let shuttingDown = false;
	async function shutdown(code = 0) {
		console.trace('shutdown')
		if (shuttingDown)
			return;
		shuttingDown = true;

		await new Promise((resolve, reject) => {
			server.close(err => {
				if (err)
					reject(err);
				else
					resolve(null);
			});
		});
		for (const socket of sockets)
			socket.destroy();

		console.log(process.listeners('exit'));
console.log(process.stdin.listeners('data'));
process.reallyExit(code);
	}
}

// process.on('exit', () => {
//	  console.error('handles:', process._getActiveHandles().map(h => h?.constructor?.name));
// })

main().catch(e => {
	console.error('Fatal wrapper error:', e);
	process.exit(1);
}).then(() => {
	console.log('Wrapper exited cleanly');
});
