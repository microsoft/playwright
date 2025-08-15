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
const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

function log(...args) {
	console.error(new Date(), '[webkit-wsl-host-wrapper]', ...args);
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

	const origWrite = fs.write;
	const origClose = fs.close;
	fs.write = function (fd, ...args) {
		if (fd === parentWrite.fd) log('[probe] fs.write(fd4)');
		return origWrite.call(this, fd, ...args);
	};
	fs.close = function (fd, ...args) {
		if (fd === parentWrite.fd) console.trace('[probe] fs.close(fd4)');
		return origClose.call(this, fd, ...args);
	};

	parentRead.on('close', () => log('Parent read stream closed'));
	parentWrite.on('close', () => log('Parent write stream closed'));

	console.log('parentRead is paused', parentRead.isPaused())
	console.log('hello from pid', process.pid)

	const server = net.createServer({
		// highWaterMark: 128 * 1024,
	});

	const sockets = new Set();
	server.on('connection', socket => {
		socket.unref()
		if (sockets.size > 0) {
			log('Extra connection received, destroying.');
			socket.destroy();
			return;
		}
		sockets.add(socket);
		log('Client connected, wiring pipes.');
		socket.on('data', data => {
			console.log('writing to parentWrite', data.length, 'bytes');
			const isDrain = parentWrite.write(data)
			console.log('parentWrite is drained', isDrain);
		});
		parentRead.on('data', data => {
			console.log('writing to socket', data.length, 'bytes');
			const isDrain = socket.write(data)
			console.log('socket is drained', isDrain);
		});

		// setInterval(() => {
		// // 	for (const handle of process._getActiveHandles()) {
		// // 		console.log('active handle:', handle.constructor.name, handle);
		// // 	}
		// for (const req of process._getActiveRequests()) {
		//  		console.log('active request:', req.constructor.name, req);
		//  	}
		// }, 1000)

		socket.on('close', () => {
			log('Socket closed');
			sockets.delete(socket);
		});
	});

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, resolve);
	});
	server.unref()
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
		PW_WKWSL_PORT: String(port),
		WEBKIT_EXECUTABLE: undefined,
	};

	let shuttingDown = false;

	const child = spawn(process.execPath, [
		path.join(__dirname, 'webkit-wsl-transport-client.mjs'),
		process.env.WEBKIT_EXECUTABLE || '',
		...argv,
	], {
		env, stdio: 'ignore',
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
	console.log('waiting for child to exit');
	await new Promise(resolve => {
		child.on('close', resolve);
	});
	console.log('child exited');

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

		// Also close the custom pipe streams so no handles remain.

	}
	console.log('done in main')
	// wait until the process exists
}

// process.on('exit', () => {
//	  console.error('handles:', process._getActiveHandles().map(h => h?.constructor?.name));
// })

main().then(() => {
	console.log('main is done')
}).catch(e => {
	console.error('Fatal wrapper error:', e);
	process.exit(1);
})