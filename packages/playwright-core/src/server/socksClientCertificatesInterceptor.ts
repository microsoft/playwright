/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from 'events';
import http2 from 'http2';
import net from 'net';
import stream from 'stream';
import tls from 'tls';

import { SocksProxy } from './utils/socksProxy';
import { escapeHTML, generateSelfSignedCertificate, rewriteErrorMessage } from '../utils';
import { verifyClientCertificates } from './browserContext';
import { createProxyAgent } from './utils/network';
import { debugLogger } from './utils/debugLogger';
import { createSocket } from './utils/happyEyeballs';

import type * as types from './types';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from './utils/socksProxy';
import type https from 'https';

let proxyServerTlsOptions: tls.TlsOptions | undefined = undefined;
function loadProxyServerCertsIfNeeded() {
  if (proxyServerTlsOptions)
    return;
  const { cert, key } = generateSelfSignedCertificate();
  proxyServerTlsOptions = { key, cert };
}

class SocksProxyConnection {
  private readonly socksProxy: ClientCertificatesProxy;
  private readonly uid: string;
  private readonly host: string;
  private readonly port: number;
  target!: net.Socket;
  internal: stream.Duplex | undefined;
  private _targetCloseEventListener: () => void;
  private _closed = false;

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
    this._targetCloseEventListener = () => {
      // Close the other end and cleanup TLS resources.
      this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid });
      this.internal?.destroy();
    };
  }

  async connect() {
    if (this.socksProxy.proxyAgentFromOptions)
      this.target = await this.socksProxy.proxyAgentFromOptions.callback(new EventEmitter() as any, { host: rewriteToLocalhostIfNeeded(this.host), port: this.port, secureEndpoint: false });
    else
      this.target = await createSocket(rewriteToLocalhostIfNeeded(this.host), this.port);

    this.target.once('close', this._targetCloseEventListener);
    this.target.once('error', error => this.socksProxy._socksProxy.sendSocketError({ uid: this.uid, error: error.message }));
    if (this._closed) {
      this.target.destroy();
      return;
    }
    this.socksProxy._socksProxy.socketConnected({
      uid: this.uid,
      host: this.target.localAddress!,
      port: this.target.localPort!,
    });
  }

  public onClose() {
    // Close the other end and cleanup TLS resources.
    this.target.destroy();
    this.internal?.destroy();
    this._closed = true;
  }

  public onData(data: Buffer) {
    // HTTP / TLS are client-hello based protocols. This allows us to detect
    // the protocol on the first package and attach appropriate listeners.
    if (!this.internal) {
      this.internal = new stream.Duplex({
        read: () => {},
        write: (data, encoding, callback) => {
          this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data });
          callback();
        }
      });

      const firstPacket = data;
      if (firstPacket[0] === 0x16) // 0x16 is SSLv3/TLS "handshake" content type: https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_record
        this._pipeTLS(this.internal, firstPacket);
      else
        this._pipeRaw(this.internal);

      // TODO: Needed?
      this.target.once('error', error => this.internal?.destroy(error));
    }

    this.internal.push(data);
  }

  private _pipeRaw(internal: stream.Duplex) {
    internal.pipe(this.target);
    this.target.pipe(internal);
  }

  private _pipeTLS(internal: stream.Duplex, clientHello: Buffer) {
    const browserALPNProtocols = parseALPNFromClientHello(clientHello) || ['http/1.1'];
    debugLogger.log('client-certificates', `Proxy->Target ${this.host}:${this.port} offers ALPN ${browserALPNProtocols}`);
    const targetTLS = tls.connect({
      socket: this.target,
      host: this.host,
      port: this.port,
      rejectUnauthorized: !this.socksProxy.ignoreHTTPSErrors,
      ALPNProtocols: browserALPNProtocols,
      servername: !net.isIP(this.host) ? this.host : undefined,
      secureContext: this.socksProxy.secureContextMap.get(new URL(`https://${this.host}:${this.port}`).origin),
    }, async () => {
      const internalTLS = await this._upgradeToTLS(internal, [targetTLS.alpnProtocol || 'http/1.1']);
      debugLogger.log('client-certificates', `Browser->Proxy ${this.host}:${this.port} chooses ALPN ${internalTLS.alpnProtocol}`);
      internalTLS.pipe(targetTLS);
      targetTLS.pipe(internalTLS);

      const cleanup = () => {
        internalTLS.unpipe(targetTLS);
        targetTLS.unpipe(internalTLS);
        this.target.destroy();
      };

      internalTLS.once('error', cleanup);
      targetTLS.once('error', cleanup);
      internalTLS.once('close', cleanup);
      targetTLS.once('close', cleanup);

      if (this._closed)
        internalTLS.destroy();
    });
    targetTLS.once('error', async (error: Error) => {
      // Once we receive an error, we manually close the target connection.
      // In case of an 'error' event on the target connection, we still need to perform the http2 handshake on the browser side.
      // This is an async operation, so we need to remove the listener to prevent the socket from being closed too early.
      // This means we call this._targetCloseEventListener manually.
      this.target.removeListener('close', this._targetCloseEventListener);
      const internalTLS = await this._upgradeToTLS(this.internal!, [targetTLS.alpnProtocol || 'http/1.1']);
      debugLogger.log('client-certificates', `error when connecting to target: ${error.message.replaceAll('\n', ' ')}`);
      const responseBody = escapeHTML('Playwright client-certificate error: ' + error.message)
          .replaceAll('\n', ' <br>');
      if (internalTLS.alpnProtocol === 'h2') {
        // This method is available only in Node.js 20+
        if ('performServerHandshake' in http2) {
          // @ts-expect-error
          const session: http2.ServerHttp2Session = http2.performServerHandshake(internalTLS);
          session.on('error', () => {
            this.target.destroy();
            this._targetCloseEventListener();
          });
          session.once('stream', (stream: http2.ServerHttp2Stream) => {
            stream.respond({
              [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/html',
              [http2.constants.HTTP2_HEADER_STATUS]: 503,
            });
            const cleanup = () => {
              session.close();
              this.target.destroy();
              this._targetCloseEventListener();
            };
            stream.end(responseBody, cleanup);
            stream.once('error', cleanup);
          });
        } else {
          this.target.destroy();
        }
      } else {
        internalTLS.end([
          'HTTP/1.1 503 Internal Server Error',
          'Content-Type: text/html; charset=utf-8',
          'Content-Length: ' + Buffer.byteLength(responseBody),
          '',
          responseBody,
        ].join('\r\n'));
        this.target.destroy();
      }
    });
  }

  private async _upgradeToTLS(socket: stream.Duplex, alpnProtocols: string[]): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const server = tls.createServer({
        ...proxyServerTlsOptions,
        ALPNProtocols: alpnProtocols,
      });
      server.emit('connection', socket);
      server.once('secureConnection', tlsSocket => {
        server.close();
        resolve(tlsSocket);
      });
      server.once('error', error => {
        server.close();
        reject(error);
      });
    });

  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();
  ignoreHTTPSErrors: boolean | undefined;
  secureContextMap: Map<string, tls.SecureContext> = new Map();
  proxyAgentFromOptions: ReturnType<typeof createProxyAgent>;

  private constructor(
    contextOptions: Pick<types.BrowserContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors' | 'proxy'>
  ) {
    verifyClientCertificates(contextOptions.clientCertificates);
    this.ignoreHTTPSErrors = contextOptions.ignoreHTTPSErrors;
    this.proxyAgentFromOptions = createProxyAgent(contextOptions.proxy);
    this._initSecureContexts(contextOptions.clientCertificates);
    this._socksProxy = new SocksProxy();
    this._socksProxy.setPattern('*');
    this._socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      try {
        const connection = new SocksProxyConnection(this, payload.uid, payload.host, payload.port);
        await connection.connect();
        this._connections.set(payload.uid, connection);
      } catch (error) {
        this._socksProxy.socketFailed({ uid: payload.uid, errorCode: error.code });
      }
    });
    this._socksProxy.addListener(SocksProxy.Events.SocksData, (payload: SocksSocketDataPayload) => {
      this._connections.get(payload.uid)?.onData(payload.data);
    });
    this._socksProxy.addListener(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => {
      this._connections.get(payload.uid)?.onClose();
      this._connections.delete(payload.uid);
    });
    loadProxyServerCertsIfNeeded();
  }

  _initSecureContexts(clientCertificates: types.BrowserContextOptions['clientCertificates']) {
    // Step 1. Group certificates by origin.
    const origin2certs = new Map<string, types.BrowserContextOptions['clientCertificates']>();
    for (const cert of clientCertificates || []) {
      const origin = normalizeOrigin(cert.origin);
      const certs = origin2certs.get(origin) || [];
      certs.push(cert);
      origin2certs.set(origin, certs);
    }

    // Step 2. Create secure contexts for each origin.
    for (const [origin, certs] of origin2certs) {
      try {
        this.secureContextMap.set(origin, tls.createSecureContext(convertClientCertificatesToTLSOptions(certs)));
      } catch (error) {
        error = rewriteOpenSSLErrorIfNeeded(error);
        throw rewriteErrorMessage(error, `Failed to load client certificate: ${error.message}`);
      }
    }
  }

  public static async create(contextOptions: Pick<types.BrowserContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors' | 'proxy'>) {
    const proxy = new ClientCertificatesProxy(contextOptions);
    await proxy._socksProxy.listen(0, '127.0.0.1');
    return proxy;
  }

  public proxySettings(): types.ProxySettings {
    return { server: `socks5://127.0.0.1:${this._socksProxy.port()}` };
  }

  public async close() {
    await this._socksProxy.close();
  }
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch (error) {
    return origin;
  }
}

function convertClientCertificatesToTLSOptions(
  clientCertificates: types.BrowserContextOptions['clientCertificates']
): Pick<https.RequestOptions, 'pfx' | 'key' | 'cert'> | undefined {
  if (!clientCertificates || !clientCertificates.length)
    return;
  const tlsOptions = {
    pfx: [] as { buf: Buffer, passphrase?: string }[],
    key: [] as { pem: Buffer, passphrase?: string }[],
    cert: [] as Buffer[],
  };
  for (const cert of clientCertificates) {
    if (cert.cert)
      tlsOptions.cert.push(cert.cert);
    if (cert.key)
      tlsOptions.key.push({ pem: cert.key, passphrase: cert.passphrase });
    if (cert.pfx)
      tlsOptions.pfx.push({ buf: cert.pfx, passphrase: cert.passphrase });
  }
  return tlsOptions;
}

export function getMatchingTLSOptionsForOrigin(
  clientCertificates: types.BrowserContextOptions['clientCertificates'],
  origin: string
): Pick<https.RequestOptions, 'pfx' | 'key' | 'cert'> | undefined {
  const matchingCerts = clientCertificates?.filter(c =>
    normalizeOrigin(c.origin) === origin
  );
  return convertClientCertificatesToTLSOptions(matchingCerts);
}

function rewriteToLocalhostIfNeeded(host: string): string {
  return host === 'local.playwright' ? 'localhost' : host;
}

export function rewriteOpenSSLErrorIfNeeded(error: Error): Error {
  if (error.message !== 'unsupported' && (error as NodeJS.ErrnoException).code !== 'ERR_CRYPTO_UNSUPPORTED_OPERATION')
    return error;
  return rewriteErrorMessage(error, [
    'Unsupported TLS certificate.',
    'Most likely, the security algorithm of the given certificate was deprecated by OpenSSL.',
    'For more details, see https://github.com/openssl/openssl/blob/master/README-PROVIDERS.md#the-legacy-provider',
    'You could probably modernize the certificate by following the steps at https://github.com/nodejs/node/issues/40672#issuecomment-1243648223',
  ].join('\n'));
}


function parseALPNFromClientHello(buffer: Buffer) {
  if (!buffer || buffer.length < 6)
    return null;

  // Check if this is a TLS handshake record (0x16)
  if (buffer[0] !== 0x16)
    return null;

  let offset = 5; // Skip TLS record header (5 bytes)

  // Check if this is a ClientHello (0x01)
  if (buffer[offset] !== 0x01)
    return null;

  offset += 4; // Skip handshake header (4 bytes total)
  offset += 2; // Skip TLS version (2 bytes)
  offset += 32; // Skip random (32 bytes)

  // Skip session ID
  if (offset >= buffer.length)
    return null;
  const sessionIdLength = buffer[offset];
  offset += 1 + sessionIdLength;

  // Skip cipher suites
  if (offset + 1 >= buffer.length)
    return null;
  const cipherSuitesLength = buffer.readUInt16BE(offset);
  offset += 2 + cipherSuitesLength;

  // Skip compression methods
  if (offset >= buffer.length)
    return null;
  const compressionMethodsLength = buffer[offset];
  offset += 1 + compressionMethodsLength;

  // Check if we have extensions
  if (offset + 1 >= buffer.length)
    return null;

  const extensionsLength = buffer.readUInt16BE(offset);
  offset += 2;

  const extensionsEnd = offset + extensionsLength;

  // Parse extensions looking for ALPN (0x0010)
  while (offset + 3 < extensionsEnd) {
    const extensionType = buffer.readUInt16BE(offset);
    const extensionLength = buffer.readUInt16BE(offset + 2);
    offset += 4;

    if (extensionType === 0x0010) { // ALPN extension
      return parseALPNExtension(buffer.slice(offset, offset + extensionLength));
    }

    offset += extensionLength;
  }

  return null; // No ALPN extension found
}

function parseALPNExtension(data: Buffer) {
  if (data.length < 2)
    return null;

  const listLength = data.readUInt16BE(0);
  if (listLength !== data.length - 2)
    return null;

  const protocols = [];
  let offset = 2;

  while (offset < data.length) {
    const protocolLength = data[offset];
    offset += 1;

    if (offset + protocolLength > data.length)
      break;

    const protocol = data.slice(offset, offset + protocolLength).toString('utf8');
    protocols.push(protocol);
    offset += protocolLength;
  }

  return protocols.length > 0 ? protocols : null;
}
