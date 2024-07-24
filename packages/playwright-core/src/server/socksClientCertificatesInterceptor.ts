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
import path from 'path';
import type https from 'https';
import fs from 'fs';
import tls from 'tls';
import stream from 'stream';
import { createSocket } from '../utils/happy-eyeballs';
import { globToRegex, isUnderTest, ManualPromise } from '../utils';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../common/socksProxy';
import { SocksProxy } from '../common/socksProxy';
import type * as channels from '@protocol/channels';
import { debugLogger } from '../utils/debugLogger';

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
    const socket = tls.connect({
      host,
      port,
      servername: net.isIP(host) ? undefined : host,
      ALPNProtocols: ['h2', 'http/1.1'],
      rejectUnauthorized: false,
    });
    socket.on('secureConnect', () => {
      // The server may not respond with ALPN, in which case we default to http/1.1.
      result.resolve(socket.alpnProtocol || 'http/1.1');
      socket.end();
    });
    socket.on('error', error => {
      debugLogger.log('client-certificates', `ALPN error: ${error.message}`);
      result.resolve('http/1.1');
      socket.end();
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

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
  }

  async connect() {
    this.target = await createSocket(rewriteToLocalhostIfNeeded(this.host), this.port);
    this.target.on('close', () => this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid }));
    this.target.on('error', error => this.socksProxy._socksProxy.sendSocketError({ uid: this.uid, error: error.message }));
    this.socksProxy._socksProxy.socketConnected({
      uid: this.uid,
      host: this.target.localAddress!,
      port: this.target.localPort!,
    });
  }

  public onClose() {
    this.internal?.destroy();
    this.target.destroy();
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
      const dummyServer = tls.createServer({
        key: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/cert.pem')),
        ALPNProtocols: alpnProtocolChosenByServer === 'h2' ? ['h2', 'http/1.1'] : ['http/1.1'],
      });
      this.internal?.on('close', () => dummyServer.close());
      dummyServer.emit('connection', this.internal);
      dummyServer.on('secureConnection', internalTLS => {
        debugLogger.log('client-certificates', `Browser->Proxy ${this.host}:${this.port} chooses ALPN ${internalTLS.alpnProtocol}`);
        internalTLS.on('close', () => this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid }));
        const tlsOptions: tls.ConnectionOptions = {
          socket: this.target,
          host: this.host,
          port: this.port,
          rejectUnauthorized: !this.socksProxy.ignoreHTTPSErrors,
          ALPNProtocols: [internalTLS.alpnProtocol || 'http/1.1'],
          ...clientCertificatesToTLSOptions(this.socksProxy.clientCertificates, `https://${this.host}:${this.port}`),
        };
        if (!net.isIP(this.host))
          tlsOptions.servername = this.host;
        if (process.env.PWTEST_UNSUPPORTED_CUSTOM_CA && isUnderTest())
          tlsOptions.ca = [fs.readFileSync(process.env.PWTEST_UNSUPPORTED_CUSTOM_CA)];
        const targetTLS = tls.connect(tlsOptions);

        internalTLS.pipe(targetTLS);
        targetTLS.pipe(internalTLS);

        // Handle close and errors
        const closeBothSockets = () => {
          internalTLS.end();
          targetTLS.end();
        };

        internalTLS.on('end', () => closeBothSockets());
        targetTLS.on('end', () => closeBothSockets());

        internalTLS.on('error', () => closeBothSockets());
        targetTLS.on('error', error => {
          debugLogger.log('client-certificates', `error when connecting to target: ${error.message}`);
          if (internalTLS?.alpnProtocol === 'h2') {
          // https://github.com/nodejs/node/issues/46152
          // TODO: http2.performServerHandshake does not work here for some reason.
          } else {
            const responseBody = 'Playwright client-certificate error: ' + error.message;
            internalTLS.end([
              'HTTP/1.1 503 Internal Server Error',
              'Content-Type: text/html; charset=utf-8',
              'Content-Length: ' + Buffer.byteLength(responseBody),
              '\r\n',
              responseBody,
            ].join('\r\n'));
          }
          closeBothSockets();
        });
      });
    });
  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();
  ignoreHTTPSErrors: boolean | undefined;
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates'];
  alpnCache: ALPNCache;

  constructor(
    contextOptions: Pick<channels.BrowserNewContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors'>
  ) {
    this.alpnCache = new ALPNCache();
    this.ignoreHTTPSErrors = contextOptions.ignoreHTTPSErrors;
    this.clientCertificates = contextOptions.clientCertificates;
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
  }

  public async listen(): Promise<string> {
    const port = await this._socksProxy.listen(0, '127.0.0.1');
    return `socks5://127.0.0.1:${port}`;
  }

  public async close() {
    await this._socksProxy.close();
  }
}

const kClientCertificatesGlobRegex = Symbol('kClientCertificatesGlobRegex');

export function clientCertificatesToTLSOptions(
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates'],
  origin: string
): Pick<https.RequestOptions, 'pfx' | 'key' | 'cert'> | undefined {
  const matchingCerts = clientCertificates?.filter(c => {
    let regex: RegExp | undefined = (c as any)[kClientCertificatesGlobRegex];
    if (!regex) {
      regex = globToRegex(c.origin);
      (c as any)[kClientCertificatesGlobRegex] = regex;
    }
    regex.lastIndex = 0;
    return regex.test(origin);
  });
  if (!matchingCerts || !matchingCerts.length)
    return;
  const tlsOptions = {
    pfx: [] as { buf: Buffer, passphrase?: string }[],
    key: [] as { pem: Buffer, passphrase?: string }[],
    cert: [] as Buffer[],
  };
  for (const cert of matchingCerts) {
    if (cert.cert)
      tlsOptions.cert.push(cert.cert);
    if (cert.key)
      tlsOptions.key.push({ pem: cert.key, passphrase: cert.passphrase });
    if (cert.pfx)
      tlsOptions.pfx.push({ buf: cert.pfx, passphrase: cert.passphrase });
  }
  return tlsOptions;
}

function rewriteToLocalhostIfNeeded(host: string): string {
  return host === 'local.playwright' ? 'localhost' : host;
}
