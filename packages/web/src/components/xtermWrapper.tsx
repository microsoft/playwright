/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as React from 'react';
import './xtermWrapper.css';
import type { Terminal } from 'xterm';
import type { XTermModule } from './xtermModule';

export type XTermDataSource = {
  pending: (string | Uint8Array)[];
  write: (data: string | Uint8Array) => void;
  resize: (cols: number, rows: number) => void;
};

export const XTermWrapper: React.FC<{ source: XTermDataSource }> = ({
  source
}) => {
  const xtermElement = React.createRef<HTMLDivElement>();
  const [modulePromise] = React.useState<Promise<XTermModule>>(import('./xTermModule').then(m => m.default));
  const [terminal, setTerminal] = React.useState<Terminal>();
  React.useEffect(() => {
    (async () => {
      // Always load the module first.
      const { Terminal, FitAddon } = await modulePromise;
      const element = xtermElement.current;
      if (!element)
        return;

      if (terminal)
        return;

      const newTerminal = new Terminal({ convertEol: true });
      const fitAddon = new FitAddon();
      newTerminal.loadAddon(fitAddon);
      for (const p of source.pending)
        newTerminal.write(p);
      source.write = (data => {
        newTerminal.write(data);
      });
      newTerminal.open(element);
      fitAddon.fit();
      setTerminal(newTerminal);
      const resizeObserver = new ResizeObserver(() => {
        source.resize(newTerminal.cols, newTerminal.rows);
        fitAddon.fit();
      });
      resizeObserver.observe(element);
    })();
  }, [modulePromise, terminal, xtermElement, source]);
  return <div className='xterm-wrapper' style={{ flex: 'auto' }} ref={xtermElement}>
  </div>;
};
