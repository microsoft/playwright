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
		parentRead = fs.createReadStream(null, { fd: 3 });
		parentWrite = fs.createWriteStream(null, { fd: 4 });
	} catch (e) {
		console.error('Failed to open pipe fds 3/4:', e);
		process.exit(1);
	}

	const server = net.createServer({
		highWaterMark: 128 * 1024,
	});

	let socketAccepted = false;
	server.on('connection', socket => {
		if (socketAccepted) {
			log('Extra connection received, destroying.');
			socket.destroy();
			return;
		}
		socketAccepted = true;
		socket.setNoDelay(true);
		log('Client connected, wiring pipes.');
		// Parent writes (fd3 data) go to the socket.
		parentRead.pipe(socket);
		// Data from socket goes back to parent through fd4.
		socket.pipe(parentWrite);
		socket.on('close', () => log('Socket closed'));
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

  if (!process.env.WEBKIT_EXECUTABLE)
    throw new Error('WEBKIT_EXECUTABLE env var is not set');

	// Spawn child process with augmented env (propagate port + mark for WSL env forwarding when needed).
	const env = {
		...process.env,
		WSLENV: 'PW_WKWSL_PORT',
		PW_WKWSL_PORT: String(port),
    WEBKIT_EXECUTABLE: undefined,
	};

	const child = spawn('wsl.exe', [
     '-d',
    'playwright',
    '--cd',
    '/home/pwuser',
    '/home/pwuser/node/bin/node',
    '/home/pwuser/webkit-wsl-transport-client.mjs',
    process.env.WEBKIT_EXECUTABLE,
    ...argv,
  ], { env });

	log('Spawned child pid', child.pid);

	// If the spawned process exposes its own inspector protocol via fd3/4 we could bridge it here.
	// For now, we only provide the TCP server + env for it to connect back.

	child.on('exit', (code, signal) => {
		log('Child exit', { code, signal });
		shutdown(code ?? (signal ? 0 : 0));
	});
	child.on('error', err => {
		console.error('Child process failed to start:', err);
		shutdown(1);
	});

	const signals = [ 'SIGINT', 'SIGTERM', 'SIGHUP' ];
	for (const sig of signals) {
		process.on(sig, () => {
			log('Received', sig);
			shutdown(130);
		});
	}

	let shuttingDown = false;
	function shutdown(code = 0) {
		if (shuttingDown) return;
		shuttingDown = true;
		try { server.close(); } catch {}
		try { parentRead.destroy(); } catch {}
		try { parentWrite.end(); } catch {}
		if (child && child.exitCode == null) {
			try { child.kill('SIGTERM'); } catch {}
			// Fallback hard kill after grace period.
			setTimeout(() => { if (child.exitCode == null) { try { child.kill('SIGKILL'); } catch {} } }, 3000).unref();
		}
		// Give a short grace period for streams to flush.
		setTimeout(() => process.exit(code), 50).unref();
	}

	// If parent stdio closes unexpectedly, perform shutdown.
	parentRead.on('close', () => { log('Parent read pipe closed'); shutdown(0); });
	parentWrite.on('error', () => { log('Parent write pipe error'); shutdown(1); });
}

main().catch(e => {
	console.error('Fatal wrapper error:', e);
	process.exit(1);
});

