/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from 'assert';
import * as debug from 'debug';
import { EventEmitter } from 'events';
import * as usb from 'usb';
import { Backend, DeviceBackend, SocketBackend } from './android';
import { loadOrGenerateKeys, rsaSign } from './rsa';

const kAdbClass = 0xff;
const kAdbSubclass = 0x42;
const kAdbProtocol = 0x1;
const kAdbHeaderSize = 4 * 6;
const kAdbVersion = 0x01000000;
const kAdbMaxPayload = 4096;

export enum AdbCommand {
  Connect = 0x4e584e43,
  Open = 0x4e45504f,
  OK = 0x59414b4f,
  Close = 0x45534c43,
  Write = 0x45545257,
  Auth = 0x48545541,
}

enum AdbAuth {
  Token = 1,
  Signature = 2,
  RSAPublicKey = 3
}

const zero = Buffer.alloc(1);
zero.writeUInt8(0, 0);

export class UsbBackend implements Backend {
  async devices(): Promise<DeviceBackend[]> {
    const usbDevices: usb.Device[] = [];
    for (const device of usb.getDeviceList()) {
      const interfaces = device.configDescriptor.interfaces;
      for (const alternates of interfaces) {
        for (const alternate of alternates) {
          if (alternate.bInterfaceClass === kAdbClass &&
              alternate.bInterfaceSubClass === kAdbSubclass &&
              alternate.bInterfaceProtocol === kAdbProtocol &&
              alternate.bAlternateSetting === 0 &&
              alternate.endpoints.length === 2)
            usbDevices.push(device);
        }
      }
    }
    return usbDevices.map(device => new UsbDeviceBackend(new UsbTransport(device)));
  }
}

export class AdbMessage {
  command: AdbCommand;
  arg0: number;
  arg1: number;
  body: Buffer | undefined;
  bodyLength = 0;
  appendZero = false;

  constructor(command: AdbCommand, arg0: number, arg1: number, body?: Buffer) {
    this.command = command;
    this.arg0 = arg0;
    this.arg1 = arg1;
    this.body = body;

    this.appendZero = true;
    if (!this.body || this.body.length === 0)
      this.appendZero = false;
    if (this.command === AdbCommand.Auth && this.arg0 === AdbAuth.Signature)
      this.appendZero = false;
    if (this.command === AdbCommand.Write)
      this.appendZero = false;
    this.bodyLength = this.body ? (this.body.length + (this.appendZero ? 1 : 0)) : 0;
  }

  serializeHeader(): Buffer {
    const header = Buffer.alloc(kAdbHeaderSize);
    header.writeUInt32LE(this.command, 4 * 0);
    header.writeUInt32LE(this.arg0, 4 * 1);
    header.writeUInt32LE(this.arg1, 4 * 2);
    header.writeUInt32LE(this.bodyLength, 4 * 3);
    header.writeUInt32LE(this.body ? crc(this.body) : 0, 4 * 4);
    header.writeUInt32LE((this.command ^ 0xffffffff) >>> 0, 4 * 5);
    return header;
  }

  hasBody(): boolean {
    return !!this.body && !!this.body.length;
  }

  toString() {
    const info = {
      command: this._commandName(this.command),
      arg0: `0x${this.arg0.toString(16)}`,
      arg1: `0x${this.arg1.toString(16)}`,
      length: this.bodyLength,
    };
    return JSON.stringify(info, undefined, 2);
  }

  private _commandName(command: AdbCommand): string {
    switch (command) {
      case AdbCommand.Connect: return 'Connect';
      case AdbCommand.Open: return 'Open';
      case AdbCommand.OK: return 'OK';
      case AdbCommand.Close: return 'Close';
      case AdbCommand.Write: return 'Write';
      case AdbCommand.Auth: return 'Auth';
    }
  }
}

export class UsbDeviceBackend implements DeviceBackend {
  private _lastSocketId = 0;
  private _sockets = new Map<number, AdbSocket>();
  private _privateKey: string;
  private _publicKey: string;
  private _isDisconnected = false;
  private _transport: UsbTransport;
  private _requestQueue: { message: AdbMessage, callback: (ack: AdbMessage) => void }[] = [];
  private _ackCallback: ((message: AdbMessage) => void) | null = null;

  constructor(transport: UsbTransport) {
    this._transport = transport;
    const { privateKey, publicKey } = loadOrGenerateKeys();
    this._privateKey = privateKey;
    this._publicKey = publicKey;
    this._dispatchIncomingMessages().then(() => {
      this._transport.close();
    }).catch(e => console.error(e));  // eslint-disable-line no-console
  }

  async init() {
    debug('pw:android:usb')('Init');
    let response = await this.sendMessage(AdbCommand.Connect, kAdbVersion, kAdbMaxPayload, Buffer.from('host::'));
    if (response.command === AdbCommand.Auth) {
      const signature = rsaSign(this._privateKey, response.body!);
      response = await this.sendMessage(AdbCommand.Auth, AdbAuth.Signature, 0, signature);
    }

    if (response.command === AdbCommand.Auth)
      response = await this.sendMessage(AdbCommand.Auth, AdbAuth.RSAPublicKey, 0, Buffer.from(this._publicKey));

    if (response.command !== AdbCommand.Connect)
      throw new Error('Unable to connect');
  }

  async close() {
    this._isDisconnected = true;
  }

  async _dispatchIncomingMessages() {
    while (true) {
      if (this._isDisconnected)
        return;
      try {
        const message = await this._read();
        await this._dispatchMessage(message);
      } catch (e) {
        if (!e.message.includes('LIBUSB_TRANSFER_TIMED_OUT'))
          throw e;
      }
    }
  }

  async _dispatchMessage(message: AdbMessage) {
    switch (message.command) {
      // Acks.
      case AdbCommand.Auth:
      case AdbCommand.Connect:
      case AdbCommand.OK: {
        await this._processAck(message);
        break;
      }

      // Notifications
      case AdbCommand.Write: {
        await this._doSendMessage(new AdbMessage(AdbCommand.OK, message.arg1, message.arg0)).catch(e => {});
        const socket = this._sockets.get(message.arg1);
        if (socket)
          await socket._onMessage(message);
        break;
      }

      // Both
      case AdbCommand.Close: {
        const socket = this._sockets.get(message.arg1);
        if (socket) {
          if (socket.wasClosedByUs())
            await this._processAck(message);
          else
            await this._doSendMessage(new AdbMessage(AdbCommand.Close, message.arg0, 0));
          socket._onClose();
          this._sockets.delete(message.arg1);
        }
        break;
      }
    }
  }

  private async _processAck(message?: AdbMessage) {
    if (this._ackCallback && message)
      this._ackCallback(message);
    this._ackCallback = null;
    if (this._requestQueue.length) {
      const entry = this._requestQueue.shift()!;
      this._ackCallback = entry.callback;
      await this._doSendMessage(entry.message);
    }
  }

  private async _read(): Promise<AdbMessage> {
    const header = await this._transport.recv(kAdbHeaderSize);
    if (header.length < kAdbHeaderSize)
      debug('pw:android:usb')('Wring header', header.toString('base64'));
    const message = new AdbMessage(
        header.readUInt32LE(4 * 0),
        header.readUInt32LE(4 * 1),
        header.readUInt32LE(4 * 2));
    const bodyLength = header.readUInt32LE(4 * 3);
    const checksum = header.readUInt32LE(4 * 4);
    const magic = header.readUInt32LE(4 * 5);
    assert(magic === (message.command ^ 0xffffffff) >>> 0);
    if (bodyLength) {
      const body = await this._transport.recv(bodyLength);
      message.body = body;
      message.bodyLength = bodyLength;
      assert(crc(body) === checksum);
    }
    debug('pw:android:usb:recv')(message.toString());
    return message;
  }

  async sendMessage(command: AdbCommand, arg0: number, arg1: number, body?: Buffer): Promise<AdbMessage> {
    const message = new AdbMessage(command, arg0, arg1, body);
    let callback: ((message: AdbMessage) => void) | undefined;
    const ack = new Promise<AdbMessage>(f => callback = f);
    this._requestQueue.push({ message, callback: callback! });
    if (!this._ackCallback)
      this._processAck();
    return ack;
  }

  private async _doSendMessage(message: AdbMessage) {
    debug('pw:android:usb:send')(message.toString());
    await this._transport.send(message.serializeHeader());
    if (message.hasBody()) {
      const buffer = message.appendZero ? Buffer.concat([message.body!, zero]) : message.body!;
      await this._transport.send(buffer);
    }
  }

  async runCommand(command: string): Promise<string> {
    const socket = await this._open(command, true);
    const response = await socket.fullResponse();
    return response.toString();
  }

  async open(address: string): Promise<AdbSocket> {
    return this._open(address, false);
  }

  private async _open(address: string, collect: boolean): Promise<AdbSocket> {
    const localId = ++this._lastSocketId;
    const response = await this.sendMessage(AdbCommand.Open, localId, 0, Buffer.from(address));
    if (response.command !== AdbCommand.OK)
      throw new Error('Unable to open channel to ' + address);
    const socket = new AdbSocket(this, localId, response.arg0, collect);
    this._sockets.set(localId, socket);
    return socket;
  }
}

export class AdbSocket extends EventEmitter implements SocketBackend {
  private _responses: Buffer[] = [];
  private _device: UsbDeviceBackend;
  private _closeCallback: (() => void) | undefined;
  private _closePromise: Promise<Buffer>;
  private _localId: number;
  private _remoteId: number;
  private _collectResponse = false;
  private _isClosedByUs = false;

  constructor(device: UsbDeviceBackend, localId: number, remoteId: number, collectResponse: boolean = false) {
    super();
    this._device = device;
    this._localId = localId;
    this._remoteId = remoteId;
    this._collectResponse = collectResponse;
    this._closePromise = new Promise(f => this._closeCallback = f);
  }

  async write(data: Buffer) {
    for (let i = 0; i < data.length; i += kAdbMaxPayload)
      await this._device.sendMessage(AdbCommand.Write, this._localId, this._remoteId, data.slice(i, i + kAdbMaxPayload));
  }

  async _onMessage(message: AdbMessage) {
    if (message.hasBody()) {
      this.emit('data', message.body);
      if (this._collectResponse)
        this._responses.push(message.body!);
    }
  }

  wasClosedByUs(): boolean {
    return this._isClosedByUs;
  }

  _onClose() {
    this._closeCallback!();
  }

  async close() {
    this._isClosedByUs = true;
    await this._device.sendMessage(AdbCommand.Close, this._localId, this._remoteId);
  }

  async fullResponse(): Promise<Buffer> {
    return this._closePromise.then(() => Buffer.concat(this._responses));
  }
}

export class UsbTransport {
  private _usbDevice: usb.Device;
  private _interface: usb.Interface;
  private _inEndpoint: usb.InEndpoint;
  private _outEndpoint: usb.OutEndpoint;
  private _zeroMask: number;

  constructor(device: usb.Device) {
    this._usbDevice = device;
    this._usbDevice.open();
    const { iface, inEndpoint, outEndpoint, zeroMask } = findInterface(device)!;
    this._interface = iface;
    this._inEndpoint = inEndpoint;
    this._inEndpoint.timeout = 1000;
    this._outEndpoint = outEndpoint;
    this._outEndpoint.timeout = 1000;
    this._zeroMask = zeroMask;
    this._interface.claim();
  }

  async send(buffer: Buffer) {
    await this._send(buffer);
    if (this._zeroMask && (buffer.length & this._zeroMask) === 0)
      await this._send(Buffer.alloc(0));
  }

  async recv(length: number): Promise<Buffer>{
    return this._recv(length);
  }

  close() {
    this._interface.release();
    this._usbDevice.close();
  }

  private async _send(buffer: Buffer): Promise<void> {
    return new Promise((f, r) => this._outEndpoint.transfer(buffer, (error: usb.LibUSBException | undefined) => {
      if (error) {
        r(error);
        return;
      }
      f();
    }));
  }

  private async _recv(length: number): Promise<Buffer> {
    return new Promise((f, r) => this._inEndpoint.transfer(length, (error: usb.LibUSBException | undefined, data: Buffer | undefined) => {
      if (error) {
        r(error);
        return;
      }
      f(data);
    }));
  }
}

export function findInterface(device: usb.Device) {
  for (const iface of device.interfaces) {
    const descriptor = iface.descriptor;
    if (descriptor.bInterfaceClass === kAdbClass &&
        descriptor.bInterfaceSubClass === kAdbSubclass &&
        descriptor.bInterfaceProtocol === kAdbProtocol &&
        descriptor.bAlternateSetting === 0 &&
        descriptor.endpoints.length === 2) {

      let inEndpoint: usb.InEndpoint;
      let outEndpoint: usb.OutEndpoint;
      let zeroMask = 0;

      for (const endpoint of iface.endpoints) {
        if (endpoint.transferType !== usb.LIBUSB_TRANSFER_TYPE_BULK)
          continue;
        if (endpoint.direction === 'in')
          inEndpoint = endpoint as usb.InEndpoint;
        else
          outEndpoint = endpoint as usb.OutEndpoint;
        zeroMask = endpoint.descriptor.wMaxPacketSize - 1;
      }

      return { iface, inEndpoint: inEndpoint!, outEndpoint: outEndpoint!, zeroMask };
    }
  }
}

function crc(body: Buffer): number {
  let sum = 0;
  for (let i = 0; i < body.length; ++i)
    sum = ((sum + body[i]) & 0xffffffff) >>> 0;
  return sum;
}
