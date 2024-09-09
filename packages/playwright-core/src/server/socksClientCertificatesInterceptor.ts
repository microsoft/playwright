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

import net from 'net';
import http2 from 'http2';
import type https from 'https';
import tls from 'tls';
import stream from 'stream';
import { createSocket, createTLSSocket } from '../utils/happy-eyeballs';
import { escapeHTML, generateSelfSignedCertificate, ManualPromise, rewriteErrorMessage } from '../utils';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../common/socksProxy';
import { SocksProxy } from '../common/socksProxy';
import type * as channels from '@protocol/channels';
import { debugLogger } from '../utils/debugLogger';

let dummyServerTlsOptions: tls.TlsOptions | undefined = undefined;
function loadDummyServerCertsIfNeeded() {
  if (dummyServerTlsOptions)
    return;
  const { cert, key } = generateSelfSignedCertificate();
  dummyServerTlsOptions = { key, cert };
}

class ALPNCache {
  private _cache = new Map<string, ManualPromise<string>>();

  get(host: string, port: number, success: (protocol: string) => void) {
    const cacheKey = `${host}:${port}`;
    {
      const result = this._cache.get(cacheKey);
      if (result) {
        result.then(success);
        return;
      }
    }
    const result = new ManualPromise<string>();
    this._cache.set(cacheKey, result);
    result.then(success);
    createTLSSocket({
      host,
      port,
      servername: net.isIP(host) ? undefined : host,
      ALPNProtocols: ['h2', 'http/1.1'],
      rejectUnauthorized: false,
    }).then(socket => {
      // The server may not respond with ALPN, in which case we default to http/1.1.
      result.resolve(socket.alpnProtocol || 'http/1.1');
      socket.end();
    }).catch(error => {
      debugLogger.log('client-certificates', `ALPN error: ${error.message}`);
      result.resolve('http/1.1');
    });
  }
}

class SocksProxyConnection {
  private readonly socksProxy: ClientCertificatesProxy;
  private readonly uid: string;
  private readonly host: string;
  private readonly port: number;
  firstPackageReceived: boolean = false;
  target!: net.Socket;
  // In case of http, we just pipe data to the target socket and they are |undefined|.
  internal: stream.Duplex | undefined;
  internalTLS: tls.TLSSocket | undefined;
  private _targetCloseEventListener: () => void;
  private _dummyServer: tls.Server | undefined;
  private _closed = false;

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
    this._targetCloseEventListener = () => {
      // Close the other end and cleanup TLS resources.
      this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid });
      this.internalTLS?.destroy();
      this._dummyServer?.close();
    };
  }

  async connect() {
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
    this.internalTLS?.destroy();
    this._dummyServer?.close();
    this._closed = true;
  }

  public onData(data: Buffer) {
    // HTTP / TLS are client-hello based protocols. This allows us to detect
    // the protocol on the first package and attach appropriate listeners.
    if (!this.firstPackageReceived) {
      this.firstPackageReceived = true;
      // 0x16 is SSLv3/TLS "handshake" content type: https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_record
      if (data[0] === 0x16)
        this._attachTLSListeners();
      else
        this.target.on('data', data => this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data }));
    }
    if (this.internal)
      this.internal.push(data);
    else
      this.target.write(data);
  }

  private _attachTLSListeners() {
    this.internal = new stream.Duplex({
      read: () => {},
      write: (data, encoding, callback) => {
        this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data });
        callback();
      }
    });
    this.socksProxy.alpnCache.get(rewriteToLocalhostIfNeeded(this.host), this.port, alpnProtocolChosenByServer => {
      debugLogger.log('client-certificates', `Proxy->Target ${this.host}:${this.port} chooses ALPN ${alpnProtocolChosenByServer}`);
      if (this._closed)
        return;
      this._dummyServer = tls.createServer({
        ...dummyServerTlsOptions,
        ALPNProtocols: alpnProtocolChosenByServer === 'h2' ? ['h2', 'http/1.1'] : ['http/1.1'],
      });
      this._dummyServer.emit('connection', this.internal);
      this._dummyServer.once('secureConnection', internalTLS => {
        this.internalTLS = internalTLS;
        debugLogger.log('client-certificates', `Browser->Proxy ${this.host}:${this.port} chooses ALPN ${internalTLS.alpnProtocol}`);

        let targetTLS: tls.TLSSocket | undefined = undefined;

        const handleError = (error: Error) => {
          debugLogger.log('client-certificates', `error when connecting to target: ${error.message.replaceAll('\n', ' ')}`);
          const responseBody = escapeHTML('Playwright client-certificate error: ' + error.message)
              .replaceAll('\n', ' <br>');
          if (internalTLS?.alpnProtocol === 'h2') {
            // This method is available only in Node.js 20+
            if ('performServerHandshake' in http2) {
              // In case of an 'error' event on the target connection, we still need to perform the http2 handshake on the browser side.
              // This is an async operation, so we need to remove the listener to prevent the socket from being closed too early.
              // This means we call this._targetCloseEventListener manually.
              this.target.removeListener('close', this._targetCloseEventListener);
              // @ts-expect-error
              const session: http2.ServerHttp2Session = http2.performServerHandshake(internalTLS);
              session.on('error', () => {
                this.target.destroy();
                this._targetCloseEventListener();
              });
              session.once('stream', (stream: http2.ServerHttp2Stream) => {
                stream.respond({
                  'content-type': 'text/html',
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
        };

        if (this._closed) {
          internalTLS.destroy();
          return;
        }
        targetTLS = tls.connect({
          socket: this.target,
          host: this.host,
          port: this.port,
          rejectUnauthorized: !this.socksProxy.ignoreHTTPSErrors,
          ALPNProtocols: [internalTLS.alpnProtocol || 'http/1.1'],
          servername: !net.isIP(this.host) ? this.host : undefined,
          secureContext: this.socksProxy.secureContextMap.get(new URL(`https://${this.host}:${this.port}`).origin),
        });

        targetTLS.once('secureConnect', () => {
          internalTLS.pipe(targetTLS);
          targetTLS.pipe(internalTLS);
        });

        internalTLS.once('error', () => this.target.destroy());
        targetTLS.once('error', handleError);
      });
    });
  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();
  ignoreHTTPSErrors: boolean | undefined;
  secureContextMap: Map<string, tls.SecureContext> = new Map();
  alpnCache: ALPNCache;

  constructor(
    contextOptions: Pick<channels.BrowserNewContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors'>
  ) {
    this.alpnCache = new ALPNCache();
    this.ignoreHTTPSErrors = contextOptions.ignoreHTTPSErrors;
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
    this._socksProxy.addListener(SocksProxy.Events.SocksData, async (payload: SocksSocketDataPayload) => {
      this._connections.get(payload.uid)?.onData(payload.data);
    });
    this._socksProxy.addListener(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => {
      this._connections.get(payload.uid)?.onClose();
      this._connections.delete(payload.uid);
    });
    loadDummyServerCertsIfNeeded();
  }

  _initSecureContexts(clientCertificates: channels.BrowserNewContextOptions['clientCertificates']) {
    // Step 1. Group certificates by origin.
    const origin2certs = new Map<string, channels.BrowserNewContextOptions['clientCertificates']>();
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

  public async listen(): Promise<string> {
    const port = await this._socksProxy.listen(0, '127.0.0.1');
    return `socks5://127.0.0.1:${port}`;
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
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates']
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
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates'],
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
  if (error.message !== 'unsupported')
    return error;
  return rewriteErrorMessage(error, [
    'Unsupported TLS certificate.',
    'Most likely, the security algorithm of the given certificate was deprecated by OpenSSL.',
    'For more details, see https://github.com/openssl/openssl/blob/master/README-PROVIDERS.md#the-legacy-provider',
    'You could probably modernize the certificate by following the steps at https://github.com/nodejs/node/issues/40672#issuecomment-1243648223',
  ].join('\n'));
}