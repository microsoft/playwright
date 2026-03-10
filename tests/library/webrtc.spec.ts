/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

import { browserTest as it, expect } from '../config/browserTest';
import { TestTurnServer } from '../config/turn-server';

it('should establish a WebRTC DataChannel connection', async ({ browserType, browserName, server }) => {
  using turn = new TestTurnServer();
  await turn.start();

  const launchOptions = browserName === 'firefox' ? {
    firefoxUserPrefs: { 'media.peerconnection.ice.loopback': true },
  } : {};
  await using browser = await browserType.launch(launchOptions);
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  await page1.goto(server.EMPTY_PAGE);
  await page2.goto(server.EMPTY_PAGE);

  const iceConfig = {
    iceServers: [{ urls: `turn:127.0.0.1:${turn.port}`, username: 'test', credential: 'test' }],
    iceTransportPolicy: 'relay' as RTCIceTransportPolicy,
  };

  // Create offer with full ICE gathering on page 1.
  const offer = await page1.evaluate(async config => {
    const pc = new RTCPeerConnection(config);
    const dc = pc.createDataChannel('test');
    (window as any).__pc = pc;
    (window as any).__dc = dc;
    return new Promise<RTCSessionDescriptionInit>(resolve => {
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete')
          resolve(pc.localDescription!.toJSON());
      };
      void pc.setLocalDescription();
    });
  }, iceConfig);

  // Create answer with full ICE gathering on page 2.
  const answer = await page2.evaluate(async (args: { offer: RTCSessionDescriptionInit; config: RTCConfiguration }) => {
    const pc = new RTCPeerConnection(args.config);
    (window as any).__pc = pc;
    (window as any).__messagePromise = new Promise<string>(resolve => {
      pc.ondatachannel = e => {
        e.channel.onmessage = msg => resolve(msg.data);
      };
    });
    return new Promise<RTCSessionDescriptionInit>(resolve => {
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete')
          resolve(pc.localDescription!.toJSON());
      };
      void pc.setRemoteDescription(args.offer).then(() => pc.setLocalDescription());
    });
  }, { offer, config: iceConfig });

  // Complete handshake on page 1 and wait for the DataChannel to open.
  await page1.evaluate(async a => {
    const pc = (window as any).__pc as RTCPeerConnection;
    const dc = (window as any).__dc as RTCDataChannel;
    await pc.setRemoteDescription(a);
    if (dc.readyState !== 'open')
      await new Promise<void>(resolve => { dc.onopen = () => resolve(); });
  }, answer);

  // Send a message and verify it arrives on the other side.
  const message = 'hello via WebRTC';
  await page1.evaluate(msg => {
    ((window as any).__dc as RTCDataChannel).send(msg);
  }, message);

  const received = await page2.evaluate(() => (window as any).__messagePromise);
  expect(received).toBe(message);
});
