import assert from 'assert';
import * as net from 'net';
import * as url from 'url';
import * as http from 'http';
import * as os from 'os';

const pkg = { version: '1.0.0' }

import createDebug from 'debug';

// log levels
const debug = {
	request: createDebug('proxy ← ← ←'),
	response: createDebug('proxy → → →'),
	proxyRequest: createDebug('proxy ↑ ↑ ↑'),
	proxyResponse: createDebug('proxy ↓ ↓ ↓'),
};

// hostname
const hostname = os.hostname();

export interface ProxyServer extends http.Server {
	authenticate?: (req: http.IncomingMessage) => boolean | Promise<boolean>;
	localAddress?: string;
}

/**
 * Sets up an `http.Server` or `https.Server` instance with the necessary
 * "request" and "connect" event listeners in order to make the server act
 * as an HTTP proxy.
 */
export function createProxy(server?: http.Server): ProxyServer {
	if (!server) server = http.createServer();
	server.on('request', onrequest);
	server.on('connect', onconnect);
	return server;
}

/**
 * 13.5.1 End-to-end and Hop-by-hop Headers
 *
 * Hop-by-hop headers must be removed by the proxy before passing it on to the
 * next endpoint. Per-request basis hop-by-hop headers MUST be listed in a
 * Connection header, (section 14.10) to be introduced into HTTP/1.1 (or later).
 */
const hopByHopHeaders = [
	'Connection',
	'Keep-Alive',
	'Proxy-Authenticate',
	'Proxy-Authorization',
	'TE',
	'Trailers',
	'Transfer-Encoding',
	'Upgrade',
];

// create a case-insensitive RegExp to match "hop by hop" headers
const isHopByHop = new RegExp('^(' + hopByHopHeaders.join('|') + ')$', 'i');

/**
 * Iterator function for the request/response's "headers".
 */
function* eachHeader(obj: http.IncomingMessage) {
	// every even entry is a "key", every odd entry is a "value"
	let key: string | null = null;
	for (const v of obj.rawHeaders) {
		if (key === null) {
			key = v;
		} else {
			yield [key, v];
			key = null;
		}
	}
}

/**
 * HTTP GET/POST/DELETE/PUT, etc. proxy requests.
 */
async function onrequest(
	this: ProxyServer,
	req: http.IncomingMessage,
	res: http.ServerResponse
) {
	debug.request('%s %s HTTP/%s ', req.method, req.url, req.httpVersion);
	const socket = req.socket;

	// pause the socket during authentication so no data is lost
	socket.pause();

	try {
		const success = await authenticate(this, req);
		if (!success) return requestAuthorization(req, res);
	} catch (_err: unknown) {
		const err = _err as Error;
		// an error occurred during login!
		res.writeHead(500);
		res.end((err.stack || err.message || err) + '\n');
		return;
	}

	socket.resume();
	const parsed = url.parse(req.url || '/');

	// setup outbound proxy request HTTP headers
	const headers: http.OutgoingHttpHeaders = {};
	let hasXForwardedFor = false;
	let hasVia = false;
	const via = '1.1 ' + hostname + ' (proxy/' + pkg.version + ')';

	for (const header of eachHeader(req)) {
		debug.request('Request Header: %o', header);
		const key = header[0];
		let value = header[1];
		const keyLower = key.toLowerCase();

		if (!hasXForwardedFor && 'x-forwarded-for' === keyLower) {
			// append to existing "X-Forwarded-For" header
			// http://en.wikipedia.org/wiki/X-Forwarded-For
			hasXForwardedFor = true;
			if (typeof socket.remoteAddress === 'string') {
				value += ', ' + socket.remoteAddress;
				debug.proxyRequest(
					'appending to existing "%s" header: "%s"',
					key,
					value
				);
			}
		}

		if (!hasVia && 'via' === keyLower) {
			// append to existing "Via" header
			hasVia = true;
			value += ', ' + via;
			debug.proxyRequest(
				'appending to existing "%s" header: "%s"',
				key,
				value
			);
		}

		if (isHopByHop.test(key)) {
			debug.proxyRequest('ignoring hop-by-hop header "%s"', key);
		} else {
			const v = headers[key] as string;
			if (Array.isArray(v)) {
				v.push(value);
			} else if (null != v) {
				headers[key] = [v, value];
			} else {
				headers[key] = value;
			}
		}
	}

	// add "X-Forwarded-For" header if it's still not here by now
	// http://en.wikipedia.org/wiki/X-Forwarded-For
	if (!hasXForwardedFor && typeof socket.remoteAddress === 'string') {
		headers['X-Forwarded-For'] = socket.remoteAddress;
		debug.proxyRequest(
			'adding new "X-Forwarded-For" header: "%s"',
			headers['X-Forwarded-For']
		);
	}

	// add "Via" header if still not set by now
	if (!hasVia) {
		headers.Via = via;
		debug.proxyRequest('adding new "Via" header: "%s"', headers.Via);
	}

	// custom `http.Agent` support, set `server.agent`
	//let agent = server.agent;
	//if (null != agent) {
	//	debug.proxyRequest(
	//		'setting custom `http.Agent` option for proxy request: %s',
	//		agent
	//	);
	//	parsed.agent = agent;
	//	agent = null;
	//}

	//if (!parsed.port) {
	//	// default the port number if not specified, for >= node v0.11.6...
	//	// https://github.com/joyent/node/issues/6199
	//	parsed.port = 80;
	//}

	if (parsed.protocol !== 'http:') {
		// only "http://" is supported, "https://" should use CONNECT method
		res.writeHead(400);
		res.end(
			`Only "http:" protocol prefix is supported (got: "${parsed.protocol}")\n`
		);
		return;
	}

	let gotResponse = false;
	const proxyReq = http.request({
		...parsed,
		method: req.method,
		headers,
		localAddress: this.localAddress,
	});
	debug.proxyRequest('%s %s HTTP/1.1 ', proxyReq.method, proxyReq.path);

	proxyReq.on('response', function (proxyRes) {
		debug.proxyResponse('HTTP/1.1 %s', proxyRes.statusCode);
		gotResponse = true;

		const headers: http.OutgoingHttpHeaders = {};
		for (const [key, value] of eachHeader(proxyRes)) {
			debug.proxyResponse('Proxy Response Header: "%s: %s"', key, value);
			if (isHopByHop.test(key)) {
				debug.response('ignoring hop-by-hop header "%s"', key);
			} else {
				const v = headers[key] as string;
				if (Array.isArray(v)) {
					v.push(value);
				} else if (null != v) {
					headers[key] = [v, value];
				} else {
					headers[key] = value;
				}
			}
		}

		debug.response('HTTP/1.1 %s', proxyRes.statusCode);
		res.writeHead(proxyRes.statusCode || 200, headers);
		proxyRes.pipe(res);
		res.on('finish', onfinish);
	});

	proxyReq.on('error', function (err: NodeJS.ErrnoException) {
		debug.proxyResponse(
			'proxy HTTP request "error" event\n%s',
			err.stack || err
		);
		cleanup();
		if (gotResponse) {
			debug.response(
				'already sent a response, just destroying the socket...'
			);
			socket.destroy();
		} else if ('ENOTFOUND' == err.code) {
			debug.response('HTTP/1.1 404 Not Found');
			res.writeHead(404);
			res.end();
		} else {
			debug.response('HTTP/1.1 500 Internal Server Error');
			res.writeHead(500);
			res.end();
		}
	});

	// if the client closes the connection prematurely,
	// then close the upstream socket
	function onclose() {
		debug.request(
			'client socket "close" event, aborting HTTP request to "%s"',
			req.url
		);
		proxyReq.abort();
		cleanup();
	}
	socket.on('close', onclose);

	function onfinish() {
		debug.response('"finish" event');
		cleanup();
	}

	function cleanup() {
		debug.response('cleanup');
		socket.removeListener('close', onclose);
		res.removeListener('finish', onfinish);
	}

	req.pipe(proxyReq);
}

/**
 * HTTP CONNECT proxy requests.
 */
async function onconnect(
	this: ProxyServer,
	req: http.IncomingMessage,
	socket: net.Socket,
	head: Buffer
) {
	debug.request('%s %s HTTP/%s ', req.method, req.url, req.httpVersion);
	assert(
		!head || 0 == head.length,
		'"head" should be empty for proxy requests'
	);

	let res: http.ServerResponse | null;
	let gotResponse = false;

	// define request socket event listeners
	socket.on('close', function onclientclose() {
		debug.request('HTTP request %s socket "close" event', req.url);
	});

	socket.on('end', function onclientend() {
		debug.request('HTTP request %s socket "end" event', req.url);
	});

	socket.on('error', function onclienterror(err) {
		debug.request(
			'HTTP request %s socket "error" event:\n%s',
			req.url,
			err.stack || err
		);
	});

	// define target socket event listeners
	function ontargetclose() {
		debug.proxyResponse('proxy target %s "close" event', req.url);
		socket.destroy();
	}

	function ontargetend() {
		debug.proxyResponse('proxy target %s "end" event', req.url);
	}

	function ontargeterror(err: NodeJS.ErrnoException) {
		debug.proxyResponse(
			'proxy target %s "error" event:\n%s',
			req.url,
			err.stack || err
		);
		if (gotResponse) {
			debug.response(
				'already sent a response, just destroying the socket...'
			);
			socket.destroy();
		} else if (err.code === 'ENOTFOUND') {
			debug.response('HTTP/1.1 404 Not Found');
			if (res) {
				res.writeHead(404);
				res.end();
			}
		} else {
			debug.response('HTTP/1.1 500 Internal Server Error');
			if (res) {
				res.writeHead(500);
				res.end();
			}
		}
	}

	function ontargetconnect() {
		debug.proxyResponse('proxy target %s "connect" event', req.url);
		debug.response('HTTP/1.1 200 Connection established');
		gotResponse = true;

		if (res) {
			res.removeListener('finish', onfinish);

			res.writeHead(200, 'Connection established');
			res.flushHeaders();

			// relinquish control of the `socket` from the ServerResponse instance
			res.detachSocket(socket);

			// nullify the ServerResponse object, so that it can be cleaned
			// up before this socket proxying is completed
			res = null;
		}

    socket.on('end', () => target.destroy());
		socket.pipe(target);
		target.pipe(socket);
	}

	// create the `res` instance for this request since Node.js
	// doesn't provide us with one :(
	res = new http.ServerResponse(req);
	res.shouldKeepAlive = false;
	res.chunkedEncoding = false;
	res.useChunkedEncodingByDefault = false;
	res.assignSocket(socket);

	// called for the ServerResponse's "finish" event
	// XXX: normally, node's "http" module has a "finish" event listener that would
	// take care of closing the socket once the HTTP response has completed, but
	// since we're making this ServerResponse instance manually, that event handler
	// never gets hooked up, so we must manually close the socket...
	function onfinish() {
		debug.response('response "finish" event');
		if (res) {
			res.detachSocket(socket);
		}
		socket.end();
	}
	res.once('finish', onfinish);

	// pause the socket during authentication so no data is lost
	socket.pause();

	try {
		const success = await authenticate(this, req);
		if (!success) return requestAuthorization(req, res);
	} catch (_err) {
		const err = _err as Error;
		// an error occurred during login!
		res.writeHead(500);
		res.end((err.stack || err.message || err) + '\n');
		return;
	}

	socket.resume();

	if (!req.url) {
		throw new TypeError('No "url" provided');
	}

	// `req.url` should look like "example.com:443"
	const lastColon = req.url.lastIndexOf(':');
	const host = req.url.substring(0, lastColon);
	const port = parseInt(req.url.substring(lastColon + 1), 10);
	const localAddress = this.localAddress;
	const opts = { host: host.replace(/^\[|\]$/g, ''), port, localAddress };

	debug.proxyRequest('connecting to proxy target %o', opts);
	const target = net.connect(opts);
	target.on('connect', ontargetconnect);
	target.on('close', ontargetclose);
	target.on('error', ontargeterror);
	target.on('end', ontargetend);
}

/**
 * Checks `Proxy-Authorization` request headers. Same logic applied to CONNECT
 * requests as well as regular HTTP requests.
 */
async function authenticate(server: ProxyServer, req: http.IncomingMessage) {
	if (typeof server.authenticate === 'function') {
		debug.request('authenticating request "%s %s"', req.method, req.url);
		return server.authenticate(req);
	}
	// no `server.authenticate()` function, so just allow the request
	return true;
}

/**
 * Sends a "407 Proxy Authentication Required" HTTP response to the `socket`.
 */
function requestAuthorization(
	req: http.IncomingMessage,
	res: http.ServerResponse
) {
	// request Basic proxy authorization
	debug.response(
		'requesting proxy authorization for "%s %s"',
		req.method,
		req.url
	);

	// TODO: make "realm" and "type" (Basic) be configurable...
	const realm = 'proxy';

	const headers = {
		'Proxy-Authenticate': 'Basic realm="' + realm + '"',
	};
	res.writeHead(407, headers);
	res.end('Proxy authorization required');
}