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

import type { CallLog, Mode, Source } from './recorderTypes';
import * as React from 'react';
import { Recorder } from './recorder';
import './recorder.css';

export const Main: React.FC = ({}) => {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<string, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');

  React.useLayoutEffect(() => {
    window.playwrightSetMode = setMode;
    window.playwrightSetSources = sources => {
      setSources(sources);
      window.playwrightSourcesEchoForTest = sources;
    };
    window.playwrightSetPageURL = url => {
      document.title = url
        ? `Playwright Inspector - ${url}`
        : `Playwright Inspector`;
    };
    window.playwrightSetPaused = setPaused;
    window.playwrightUpdateLogs = callLogs => {
      setLog(log => {
        const newLog = new Map<string, CallLog>(log);
        for (const callLog of callLogs) {
          callLog.reveal = !log.has(callLog.id);
          newLog.set(callLog.id, callLog);
        }
        return newLog;
      });
    };
  }, []);

  return <Recorder sources={sources} paused={paused} log={log} mode={mode} />;
};
