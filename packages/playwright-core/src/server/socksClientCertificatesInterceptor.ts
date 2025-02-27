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
import { ManualPromise, escapeHTML, generateSelfSignedCertificate, rewriteErrorMessage } from '../utils';
import { verifyClientCertificates } from './browserContext';
import { createProxyAgent } from './fetch';
import { debugLogger } from './utils/debugLogger';
import { createSocket, createTLSSocket } from './utils/happyEyeballs';

import type * as types from './types';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from './utils/socksProxy';
import type https from 'https';

let dummyServerTlsOptions: tls.TlsOptions | undefined = undefined;
function loadDummyServerCertsIfNeeded() {
  if (dummyServerTlsOptions)
    return;
  const { cert, key } = generateSelfSignedCertificate();
  dummyServerTlsOptions = { key, cert };
}

type ALPNCacheOptions = {
  socket?: stream.Duplex | undefined;
  secureContext: tls.SecureContext | undefined;
};

class ALPNCache {
  private _cache = new Map<string, ManualPromise<string>>();

  get(host: string, port: number, options: ALPNCacheOptions, success: (protocol: string) => void) {
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
    const fixtures = {
      __testHookLookup: (options as any).__testHookLookup
    };

    if (!options.socket) {
      createTLSSocket({
        host,
        port,
        servername: net.isIP(host) ? undefined : host,
        ALPNProtocols: ['h2', 'http/1.1'],
        rejectUnauthorized: false,
        secureContext: options.secureContext,
        ...fixtures,
      }).then(socket => {
        // The server may not respond with ALPN, in which case we default to http/1.1.
        result.resolve(socket.alpnProtocol || 'http/1.1');
        socket.end();
      }).catch(error => {
        debugLogger.log('client-certificates', `ALPN error: ${error.message}`);
        result.resolve('http/1.1');
      });
    } else {
      // a socket might be provided, for example, when using a proxy.
      const socket = tls.connect({
        socket: options.socket,
        port: port,
        host: host,
        ALPNProtocols: ['h2', 'http/1.1'],
        rejectUnauthorized: false,
        secureContext: options.secureContext,
        servername: net.isIP(host) ? undefined : host
      });
      socket.on('secureConnect', () => {
        result.resolve(socket.alpnProtocol || 'http/1.1');
        socket.end();
      });
      socket.on('error', error => {
        result.resolve('http/1.1');
      });
      socket.on('timeout', () => {
        result.resolve('http/1.1');
      });
    }
  }
}

// Only used for fixtures
type SocksProxyConnectionOptions = {
};

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
  private _options: SocksProxyConnectionOptions;

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number, options: SocksProxyConnectionOptions) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
    this._options = options;
    this._targetCloseEventListener = () => {
      // Close the other end and cleanup TLS resources.
      this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid });
      this.internalTLS?.destroy();
      this._dummyServer?.close();
    };
  }

  async connect() {
    const fixtures = {
      __testHookLookup: (this._options as any).__testHookLookup
    };

    if (this.socksProxy.proxyAgentFromOptions)
      this.target = await this.socksProxy.proxyAgentFromOptions.callback(new EventEmitter() as any, { host: rewriteToLocalhostIfNeeded(this.host), port: this.port, secureEndpoint: false });
    else
      this.target = await createSocket({ host: rewriteToLocalhostIfNeeded(this.host), port: this.port, ...fixtures });

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

  private async _attachTLSListeners() {
    this.internal = new stream.Duplex({
      read: () => {},
      write: (data, encoding, callback) => {
        this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data });
        callback();
      }
    });
    const secureContext = this.socksProxy.secureContextForOrigin(new URL(`https://${this.host}:${this.port}`).origin);
    const fixtures = {
      __testHookLookup: (this._options as any).__testHookLookup
    };

    const alpnCacheOptions: ALPNCacheOptions = {
      secureContext,
      ...fixtures
    };
    if (this.socksProxy.proxyAgentFromOptions)
      alpnCacheOptions.socket = await this.socksProxy.proxyAgentFromOptions.callback(new EventEmitter() as any, { host: rewriteToLocalhostIfNeeded(this.host), port: this.port, secureEndpoint: false });

    this.socksProxy.alpnCache.get(rewriteToLocalhostIfNeeded(this.host), this.port, alpnCacheOptions, alpnProtocolChosenByServer => {
      alpnCacheOptions.socket?.destroy();
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
          secureContext: secureContext,
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
  private _patterns: Pattern[] = [];
  ignoreHTTPSErrors: boolean | undefined;
  private _secureContextMap: Map<string, tls.SecureContext> = new Map();
  alpnCache: ALPNCache;
  proxyAgentFromOptions: ReturnType<typeof createProxyAgent> | undefined;

  constructor(
    contextOptions: Pick<types.BrowserContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors' | 'proxy'>
  ) {
    verifyClientCertificates(contextOptions.clientCertificates);
    this.alpnCache = new ALPNCache();
    this.ignoreHTTPSErrors = contextOptions.ignoreHTTPSErrors;
    this.proxyAgentFromOptions = contextOptions.proxy ? createProxyAgent(contextOptions.proxy) : undefined;
    this._initSecureContexts(contextOptions.clientCertificates);
    this._socksProxy = new SocksProxy();
    this._socksProxy.setPattern('*');
    this._socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      try {
        const connection = new SocksProxyConnection(this, payload.uid, payload.host, payload.port, {
          __testHookLookup: (contextOptions as any).__testHookLookup
        });
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

  _initSecureContexts(clientCertificates: types.BrowserContextOptions['clientCertificates']) {
    // Step 1. Group certificates by origin.
    const origin2certs = new Map<string, types.BrowserContextOptions['clientCertificates']>();
    for (const cert of clientCertificates || []) {
      const pattern = Pattern.fromString(cert.origin);
      if (pattern === undefined) {
        debugLogger.log('client-certificates', `Invalid client certificate pattern: ${cert.origin}`);
        continue;
      } else {
        this._patterns.push(pattern);
      }
      const origin = pattern.normalizedOrigin;
      const certs = origin2certs.get(origin) || [];
      certs.push(cert);
      origin2certs.set(origin, certs);
    }

    // Step 2. Create secure contexts for each origin.
    for (const [origin, certs] of origin2certs) {
      try {
        this._secureContextMap.set(origin, tls.createSecureContext(convertClientCertificatesToTLSOptions(certs)));
      } catch (error) {
        error = rewriteOpenSSLErrorIfNeeded(error);
        throw rewriteErrorMessage(error, `Failed to load client certificate: ${error.message}`);
      }
    }
  }

  public secureContextForOrigin(origin: string): tls.SecureContext | undefined {
    const pattern = this._patterns.find(p => p.matches(origin));
    if (!pattern)
      return undefined;
    return this._secureContextMap.get(pattern.normalizedOrigin);
  }

  public async listen() {
    const port = await this._socksProxy.listen(0, '127.0.0.1');
    return { server: `socks5://127.0.0.1:${port}` };
  }

  public async close() {
    await this._socksProxy.close();
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
    Pattern.fromString(c.origin)?.matches(origin)
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

/*
  Pattern is a pattern that matches a URL. Based on the Chromium
  implementation, used in content policies:
  https://source.chromium.org/chromium/chromium/src/+/main:components/content_settings/core/common/content_settings_pattern.h;l=248;drc=20799f4c32d950ce93d495f44eec648400f38a19

  Example: "https://[*.].hello.com/path"

  The only difference is that we don't support the precedence rules and
  paths patterns are not implemented.
*/
export class Pattern {
  private readonly _scheme: string;
  private readonly _isSchemeWildcard: boolean;
  private readonly _host: string;
  private readonly _isDomainWildcard: boolean;
  private readonly _isSubdomainWildcard: boolean;
  private readonly _port: string;
  private readonly _isPortWildcard: boolean;
  private readonly _host_parts: string[];
  private readonly _implicitPort: string;
  private readonly _normalizedOrigin: string;
  constructor(scheme: string, isSchemeWildcard: boolean, host: string, isDomainWildcard: boolean, isSubdomainWildcard: boolean, port: string, isPortWildcard: boolean) {
    this._scheme = scheme;
    this._isSchemeWildcard = isSchemeWildcard;
    this._host = host;
    this._isDomainWildcard = isDomainWildcard;
    this._isSubdomainWildcard = isSubdomainWildcard;
    this._port = port;
    this._isPortWildcard = isPortWildcard;
    this._host_parts = this._host.split('.').reverse();
    this._implicitPort = this._scheme === 'https' ? '443' : (this._scheme === 'http' ? '80' : '');
    this._normalizedOrigin = `${this._isSchemeWildcard ? '*' : this._scheme}://${this._isSubdomainWildcard ? '[*.]' : ''}${this._isDomainWildcard ? '*' : this._host}${this._isPortWildcard ? ':*' : this._port ? `:${this._port}` : ''}`;
  }

  get scheme() {
    return this._scheme;
  }

  get host() {
    return this._host;
  }

  get port() {
    return this._port;
  }

  get isSchemeWildcard() {
    return this._isSchemeWildcard;
  }

  get isDomainWildcard() {
    return this._isDomainWildcard;
  }

  get isSubdomainWildcard() {
    return this._isSubdomainWildcard;
  }

  get isPortWildcard() {
    return this._isPortWildcard;
  }

  get normalizedOrigin() {
    return this._normalizedOrigin;
  }

  matches(url: string): boolean {
    const urlObj = new URL(url);
    const urlScheme = urlObj.protocol.replace(':', '');
    if (!this._isSchemeWildcard && this._scheme !== urlScheme)
      return false;

    let urlPort = urlObj.port;
    if (urlPort === '')
      urlPort = urlScheme === 'https' ? '443' : (urlScheme === 'http' ? '80' : '');
    let patternPort = this._port;
    if (patternPort === '')
      patternPort = this._implicitPort;

    if (!this._isPortWildcard && patternPort !== urlPort)
      return false;

    const urlHostParts = urlObj.hostname.split('.').reverse();

    if (this._isDomainWildcard)
      return true;

    if (this._host_parts.length > urlHostParts.length)
      return false;

    for (let i = 0; i < this._host_parts.length; i++) {
      if (this._host_parts[i] !== '*' && this._host_parts[i] !== urlHostParts[i])
        return false;
    }

    if (this._host_parts.length < urlHostParts.length)
      return this._isSubdomainWildcard;

    return true;
  }

  static fromString(pattern: string, defaultScheme: string = 'https') {

    let restPattern = pattern;
    let scheme = '';
    let host = '';
    let port = '';
    let isSchemeWildcard = false;
    let isDomainWildcard = false;
    let isSubdomainWildcard = false;
    let isPortWildcard = false;

    const schemeIndex = pattern.indexOf('://');
    if (schemeIndex !== -1) {
      scheme = restPattern.substring(0, schemeIndex);
      restPattern = restPattern.substring(schemeIndex + 3);
    } else {
      scheme = defaultScheme;
    }
    // skip userinfo
    const userInfoIndex = restPattern.indexOf('@');
    if (userInfoIndex !== -1)
      restPattern = restPattern.substring(schemeIndex + 1);

    isSchemeWildcard = scheme === '*';
    isSubdomainWildcard = restPattern.startsWith('[*.]');
    if (isSubdomainWildcard)
      restPattern = restPattern.substring(4);

    // literal ipv6 address
    if (restPattern.startsWith('[')) {
      const closingBracketIndex = restPattern.indexOf(']');
      if (closingBracketIndex === -1)
        return undefined;
      host = restPattern.substring(1, closingBracketIndex);
      restPattern = restPattern.substring(closingBracketIndex + 1);
    } else {
      // ipv4 or domain
      const slashIndex = restPattern.indexOf('/');
      const portIndex = restPattern.indexOf(':');
      host = restPattern;
      if (slashIndex !== -1 && (portIndex === -1 || slashIndex < portIndex)) {
        host = restPattern.substring(0, slashIndex);
        restPattern = restPattern.substring(slashIndex);
      } else if (portIndex !== -1) {
        host = restPattern.substring(0, portIndex);
        restPattern = restPattern.substring(portIndex);
      } else {
        restPattern = '';
      }
    }
    if (host === '*')
      isDomainWildcard = true;

    const portIndex = restPattern.indexOf(':');
    if (portIndex !== -1) {
      if (restPattern.startsWith(':*')) {
        isPortWildcard = true;
        port = '*';
        restPattern = restPattern.substring(2);
        if (!restPattern.startsWith('/') || restPattern === '')
          return undefined;
      } else {
        const slashIndex = restPattern.indexOf('/');
        if (slashIndex !== -1) {
          port = restPattern.substring(1, slashIndex);
          restPattern = restPattern.substring(slashIndex);
        } else {
          port = restPattern.substring(1);
          restPattern = '';
        }
      }
    }
    return new Pattern(scheme, isSchemeWildcard, host, isDomainWildcard, isSubdomainWildcard, port, isPortWildcard);
  }

}
