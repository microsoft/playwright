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

import type net from 'net';
import path from 'path';
import type https from 'https';
import fs from 'fs';
import tls from 'tls';
import stream from 'stream';
import { createSocket } from '../utils/happy-eyeballs';
import { globToRegex, isUnderTest } from '../utils';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../common/socksProxy';
import { SocksProxy } from '../common/socksProxy';
import type * as channels from '@protocol/channels';

class SocksConnectionDuplex extends stream.Duplex {
  constructor(private readonly writeCallback: (data: Buffer) => void) {
    super();
  }
  override _read(): void { }
  override _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    this.writeCallback(chunk);
    callback();
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

  constructor(socksProxy: ClientCertificatesProxy, uid: string, host: string, port: number) {
    this.socksProxy = socksProxy;
    this.uid = uid;
    this.host = host;
    this.port = port;
  }

  async connect() {
    this.target = await createSocket(this.host === 'local.playwright' ? 'localhost' : this.host, this.port);
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
    this.internal = new SocksConnectionDuplex(data => this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data }));
    const internalTLS = new tls.TLSSocket(this.internal, {
      isServer: true,
      key: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/cert.pem')),
    });
    this.internalTLS = internalTLS;
    internalTLS.on('close', () => this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid }));

    const tlsOptions: tls.ConnectionOptions = {
      socket: this.target,
      rejectUnauthorized: !this.socksProxy.ignoreHTTPSErrors,
      ...clientCertificatesToTLSOptions(this.socksProxy.clientCertificates, `https://${this.host}:${this.port}/`),
    };
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
      const responseBody = 'Playwright client-certificate error: ' + error.message;
      internalTLS.end([
        'HTTP/1.1 503 Internal Server Error',
        'Content-Type: text/html; charset=utf-8',
        'Content-Length: ' + Buffer.byteLength(responseBody),
        '\r\n',
        responseBody,
      ].join('\r\n'));
      closeBothSockets();
    });
  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();
  ignoreHTTPSErrors: boolean | undefined;
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates'];

  constructor(
    contextOptions: Pick<channels.BrowserNewContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors'>
  ) {
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
  requestURL: string
): Pick<https.RequestOptions, 'pfx' | 'key' | 'cert'> | undefined {
  const matchingCerts = clientCertificates?.filter(c => {
    let regex: RegExp | undefined = (c as any)[kClientCertificatesGlobRegex];
    if (!regex) {
      regex = globToRegex(c.url);
      (c as any)[kClientCertificatesGlobRegex] = regex;
    }
    regex.lastIndex = 0;
    return regex.test(requestURL);
  });
  if (!matchingCerts || !matchingCerts.length)
    return;
  const tlsOptions = {
    pfx: [] as { buf: Buffer, passphrase?: string }[],
    key: [] as { pem: Buffer, passphrase?: string }[],
    cert: [] as Buffer[],
  };
  for (const { certs } of matchingCerts) {
    for (const cert of certs) {
      if (cert.cert)
        tlsOptions.cert.push(cert.cert);
      if (cert.key)
        tlsOptions.key.push({ pem: cert.key, passphrase: cert.passphrase });
      if (cert.pfx)
        tlsOptions.pfx.push({ buf: cert.pfx, passphrase: cert.passphrase });
    }
  }
  return tlsOptions;
}
