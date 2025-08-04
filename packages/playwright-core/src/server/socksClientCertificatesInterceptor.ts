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
import { getProxyForUrl } from '../utilsBundle';

import type * as types from './types';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from './utils/socksProxy';
import type https from 'https';
import type { Progress } from '@protocol/progress';

let dummyServerTlsOptions: tls.TlsOptions | undefined = undefined;
function loadDummyServerCertsIfNeeded() {
  if (dummyServerTlsOptions)
    return;
  const { cert, key } = generateSelfSignedCertificate();
  dummyServerTlsOptions = { key, cert };
}

// Client Certificates in Playwright are implemented as a SOCKS5 proxy that injects client certificates into the TLS handshake.
// We do that to avoid patching the browsers TLS stack and expose the certificates there.
// The following shows two flow diagrams, one for http:// and one for https://.
// Key Decision Point: First byte check (0x16 = TLS handshake)

// HTTP FLOW (Plain text):
//     BROWSER                    PROXY                     SERVER
//        │                        │                         │
//        │   SOCKS5 Connect       │                         │
//        │───────────────────────►│                         │
//        │                        │    TCP Connect          │
//        │                        │────────────────────────►│
//        │                        │                         │
//        │   HTTP Request         │                         │
//        │───────────────────────►│                         │
//        │                        │ Check: not 0x16         │
//        │                        │ → Direct pipe           │
//        │                        │                         │
//        │                        │   HTTP Request          │
//        │                        │────────────────────────►│
//        │                        │                         │
//        │◄═══════════════════════│════════════════════════►│
//        │      Plain HTTP        │      Plain HTTP         │

// HTTPS FLOW (TLS with client certificates):
//     BROWSER                    PROXY                     SERVER
//        │                        │                         │
//        │   SOCKS5 Connect       │                         │
//        │───────────────────────►│                         │
//        │                        │    TCP Connect          │
//        │                        │────────────────────────►│
//        │                        │                         │
//        │   TLS ClientHello      │                         │
//        │   (with ALPN)          │                         │
//        │───────────────────────►│                         │
//        │                        │ Check: 0x16 = TLS       │
//        │                        │ Parse ALPN protocols    │
//        │                        │ Create dual TLS conns   │
//        │                        │                         │
//        │                        │   TLS ClientHello       │
//        │                        │   (with client cert)    │
//        │                        │────────────────────────►│
//        │                        │                         │
//        │                        │◄───── TLS Handshake ────│
//        │◄──── TLS Handshake ────│                         │
//        │                        │                         │
//        │◄═══════════════════════│════════════════════════►│
//        │      Encrypted Data    │    Encrypted Data       │
//        │      (HTTP/1.1 or H2)  │    (with client auth)   │

class SocksProxyConnection {
  private readonly socksProxy: ClientCertificatesProxy;
  private readonly uid: string;
  private readonly host: string;
  private readonly port: number;
  private _firstPackageReceived = false;
  private _serverEncrypted!: net.Socket;
  private _browserEncrypted: stream.Duplex;
  private _brorwserDecrypted: Promise<tls.TLSSocket> | undefined;
  private _serverCloseEventListener: () => void;
  private _closed = false;

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
    this._serverCloseEventListener = () => {
      this._browserEncrypted.destroy();
    };
    this._browserEncrypted = new stream.Duplex({
      read: () => { },
      write: (data, encoding, callback) => {
        this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data });
        callback();
      },
      destroy: (error, callback) => {
        if (error)
          socksProxy._socksProxy.sendSocketError({ uid: this.uid, error: error.message });
        else
          socksProxy._socksProxy.sendSocketEnd({ uid: this.uid });
        callback();
      },
    });
  }

  async connect() {
    const proxyAgent = this.socksProxy.getProxyAgent(this.host, this.port);
    if (proxyAgent)
      this._serverEncrypted = await proxyAgent.callback(new EventEmitter() as any, { host: rewriteToLocalhostIfNeeded(this.host), port: this.port, secureEndpoint: false });
    else
      this._serverEncrypted = await createSocket(rewriteToLocalhostIfNeeded(this.host), this.port);

    this._serverEncrypted.once('close', this._serverCloseEventListener);
    this._serverEncrypted.once('error', error => this._browserEncrypted.destroy(error));
    if (this._closed) {
      this._serverEncrypted.destroy();
      return;
    }
    this.socksProxy._socksProxy.socketConnected({
      uid: this.uid,
      host: this._serverEncrypted.localAddress!,
      port: this._serverEncrypted.localPort!,
    });
  }

  public onClose() {
    // Close the other end and cleanup TLS resources.
    this._serverEncrypted.destroy();
    this._browserEncrypted.destroy();
    this._closed = true;
  }

  public onData(data: Buffer) {
    // HTTP / TLS are client-hello based protocols. This allows us to detect
    // the protocol on the first package and attach appropriate listeners.
    if (!this._firstPackageReceived) {
      this._firstPackageReceived = true;
      // 0x16 is SSLv3/TLS "handshake" content type: https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_record
      if (data[0] === 0x16)
        this._establishTlsTunnel(this._browserEncrypted, data);
      else
        this._establishPlaintextTunnel(this._browserEncrypted);
    }

    this._browserEncrypted.push(data);
  }


  private _establishPlaintextTunnel(browserEncrypted: stream.Duplex) {
    browserEncrypted.pipe(this._serverEncrypted);
    this._serverEncrypted.pipe(browserEncrypted);
  }

  private _establishTlsTunnel(browserEncrypted: stream.Duplex, clientHello: Buffer) {
    const browserALPNProtocols = parseALPNFromClientHello(clientHello) || ['http/1.1'];
    debugLogger.log('client-certificates', `Browser->Proxy ${this.host}:${this.port} offers ALPN ${browserALPNProtocols}`);

    const serverDecrypted = tls.connect({
      socket: this._serverEncrypted,
      host: this.host,
      port: this.port,
      rejectUnauthorized: !this.socksProxy.ignoreHTTPSErrors,
      ALPNProtocols: browserALPNProtocols,
      servername: !net.isIP(this.host) ? this.host : undefined,
      secureContext: this.socksProxy.secureContextMap.get(new URL(`https://${this.host}:${this.port}`).origin),
    }, async () => {
      const browserDecrypted = await this._upgradeToTLSIfNeeded(browserEncrypted, serverDecrypted.alpnProtocol);
      debugLogger.log('client-certificates', `Proxy->Server ${this.host}:${this.port} chooses ALPN ${browserDecrypted.alpnProtocol}`);
      browserDecrypted.pipe(serverDecrypted);
      serverDecrypted.pipe(browserDecrypted);

      const cleanup = (error: Error | undefined) => this._serverEncrypted.destroy(error);

      browserDecrypted.once('error', cleanup);
      serverDecrypted.once('error', cleanup);
      browserDecrypted.once('close', cleanup);
      serverDecrypted.once('close', cleanup);

      if (this._closed)
        serverDecrypted.destroy();
    });
    serverDecrypted.once('error', async (error: Error) => {
      debugLogger.log('client-certificates', `error when connecting to server: ${error.message.replaceAll('\n', ' ')}`);

      // Once we receive an error, we manually close the server connection.
      // In case of an 'error' event on the server connection, we still need to perform the http2 handshake on the browser side.
      // This is an async operation, so we need to remove the listener to prevent the socket from being closed too early.
      // This means we call this._serverCloseEventListener manually.
      this._serverEncrypted.removeListener('close', this._serverCloseEventListener);
      this._serverEncrypted.destroy();

      const browserDecrypted = await this._upgradeToTLSIfNeeded(this._browserEncrypted, serverDecrypted.alpnProtocol);
      const responseBody = escapeHTML('Playwright client-certificate error: ' + error.message)
          .replaceAll('\n', ' <br>');
      if (browserDecrypted.alpnProtocol === 'h2') {
        // This method is available only in Node.js 20+
        if ('performServerHandshake' in http2) {
          // @ts-expect-error
          const session: http2.ServerHttp2Session = http2.performServerHandshake(browserDecrypted);
          session.on('error', error => {
            this._browserEncrypted.destroy(error);
          });
          session.once('stream', (stream: http2.ServerHttp2Stream) => {
            const cleanup = (error?: Error) => {
              session.close();
              this._browserEncrypted.destroy(error);
            };
            stream.once('end', cleanup);
            stream.once('error', cleanup);
            stream.respond({
              [http2.constants.HTTP2_HEADER_CONTENT_TYPE]: 'text/html',
              [http2.constants.HTTP2_HEADER_STATUS]: 503,
            });
            stream.end(responseBody);
          });
        } else {
          this._browserEncrypted.destroy(error);
        }
      } else {
        browserDecrypted.end([
          'HTTP/1.1 503 Internal Server Error',
          'Content-Type: text/html; charset=utf-8',
          'Content-Length: ' + Buffer.byteLength(responseBody),
          '',
          responseBody,
        ].join('\r\n'));
      }
    });
  }

  private async _upgradeToTLSIfNeeded(socket: stream.Duplex, alpnProtocol: string | false | null): Promise<tls.TLSSocket> {
    // TLS errors can happen after secureConnect event from the server. In this case the socket is already upgraded to TLS.
    this._brorwserDecrypted ??= new Promise<tls.TLSSocket>((resolve, reject) => {
      const dummyServer = tls.createServer({
        ...dummyServerTlsOptions,
        ALPNProtocols: [alpnProtocol || 'http/1.1'],
      });
      dummyServer.emit('connection', socket);
      dummyServer.once('secureConnection', tlsSocket => {
        dummyServer.close();
        resolve(tlsSocket);
      });
      dummyServer.once('error', error => {
        dummyServer.close();
        reject(error);
      });
    });
    return this._brorwserDecrypted;
  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();
  ignoreHTTPSErrors: boolean | undefined;
  secureContextMap: Map<string, tls.SecureContext> = new Map();
  private _proxy: types.ProxySettings | undefined;

  private constructor(
    contextOptions: Pick<types.BrowserContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors' | 'proxy'>
  ) {
    verifyClientCertificates(contextOptions.clientCertificates);
    this.ignoreHTTPSErrors = contextOptions.ignoreHTTPSErrors;
    this._proxy = contextOptions.proxy;
    this._initSecureContexts(contextOptions.clientCertificates);
    this._socksProxy = new SocksProxy();
    this._socksProxy.setPattern('*');
    this._socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      try {
        const connection = new SocksProxyConnection(this, payload.uid, payload.host, payload.port);
        await connection.connect();
        this._connections.set(payload.uid, connection);
      } catch (error) {
        debugLogger.log('client-certificates', `Failed to connect to ${payload.host}:${payload.port}: ${error.message}`);
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
    loadDummyServerCertsIfNeeded();
  }

  getProxyAgent(host: string, port: number) {
    const proxyFromOptions = createProxyAgent(this._proxy);
    if (proxyFromOptions)
      return proxyFromOptions;
    const proxyFromEnv = getProxyForUrl(`https://${host}:${port}`);
    if (proxyFromEnv)
      return createProxyAgent({ server: proxyFromEnv });
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

  public static async create(progress: Progress, contextOptions: Pick<types.BrowserContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors' | 'proxy'>) {
    const proxy = new ClientCertificatesProxy(contextOptions);
    try {
      await progress.race(proxy._socksProxy.listen(0, '127.0.0.1'));
      return proxy;
    } catch (error) {
      await proxy.close();
      throw error;
    }
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


/**
 * Parses the ALPN (Application-Layer Protocol Negotiation) extension from a TLS ClientHello.
 * Based on RFC 8446 (TLS 1.3): https://datatracker.ietf.org/doc/html/rfc8446
 */
function parseALPNFromClientHello(buffer: Buffer): string[] | null {
  if (buffer.length < 6)
    return null;

  // --- TLS Record Header (RFC 8446 §5.1) ---
  // https://datatracker.ietf.org/doc/html/rfc8446#section-5.1
  // TLSPlaintext.type (1 byte): 0x16 = TLS handshake
  if (buffer[0] !== 0x16)
    return null;

  let offset = 5; // TLS record header is 5 bytes

  // --- Handshake Header (RFC 8446 §4.1) ---
  // HandshakeType (1 byte): 0x01 = ClientHello
  // https://datatracker.ietf.org/doc/html/rfc8446#section-4
  if (buffer[offset] !== 0x01)
    return null;

  offset += 4; // Handshake header: type (1) + length (3)

  // --- ClientHello (RFC 8446 §4.1.2) ---
  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.1.2

  // legacy_version (2 bytes) — always 0x0303 (TLS 1.2 for compatibility)
  offset += 2;
  // random (32 bytes)
  offset += 32;

  // legacy_session_id<0..32> (preceded by 1-byte length)
  if (offset >= buffer.length)
    return null;
  const sessionIdLength = buffer[offset];
  offset += 1 + sessionIdLength;

  // cipher_suites<2..2^16-2> (preceded by 2-byte length)
  if (offset + 2 > buffer.length)
    return null;
  const cipherSuitesLength = buffer.readUInt16BE(offset);
  offset += 2 + cipherSuitesLength;

  // legacy_compression_methods<1..2^8-1> (preceded by 1-byte length)
  if (offset >= buffer.length)
    return null;
  const compressionMethodsLength = buffer[offset];
  offset += 1 + compressionMethodsLength;

  // extensions<8..2^16-1> (preceded by 2-byte length)
  if (offset + 2 > buffer.length)
    return null;
  const extensionsLength = buffer.readUInt16BE(offset);
  offset += 2;

  const extensionsEnd = offset + extensionsLength;
  if (extensionsEnd > buffer.length)
    return null;

  // --- Extensions (RFC 8446 §4.2) ---
  // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2
  // Each extension is structured as:
  // - extension_type (2 bytes)
  // - extension_data length (2 bytes)
  // - extension_data (variable)
  while (offset + 4 <= extensionsEnd) {
    const extensionType = buffer.readUInt16BE(offset);
    offset += 2;
    const extensionLength = buffer.readUInt16BE(offset);
    offset += 2;

    if (offset + extensionLength > extensionsEnd)
      return null;

    // ALPN extension (RFC 8446 §4.2.11): extension_type = 16
    // https://datatracker.ietf.org/doc/html/rfc8446#section-4.2
    if (extensionType === 16)
      return parseALPNExtension(buffer.subarray(offset, offset + extensionLength));

    offset += extensionLength;
  }

  return null; // No ALPN extension found
}

/**
 * Parses the ALPN extension data from a ClientHello extension block.
 *
 * The ALPN structure is defined in:
 * - RFC 7301 §3.1: https://datatracker.ietf.org/doc/html/rfc7301#section-3.1
 */
function parseALPNExtension(buffer: Buffer): string[] | null {
  if (buffer.length < 2)
    return null;

  // protocol_name_list<2..2^16-1> (preceded by 2-byte length)
  const listLength = buffer.readUInt16BE(0);
  if (listLength !== buffer.length - 2)
    return null;

  const protocols: string[] = [];
  let offset = 2;

  while (offset < buffer.length) {
    // ProtocolName<1..2^8-1> (preceded by 1-byte length)
    const protocolLength = buffer[offset];
    offset += 1;

    if (offset + protocolLength > buffer.length)
      break;

    const protocol = buffer.subarray(offset, offset + protocolLength).toString('utf8');
    protocols.push(protocol);
    offset += protocolLength;
  }

  return protocols.length > 0 ? protocols : null;
}
