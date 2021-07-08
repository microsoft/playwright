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

// Recalculates the value when dependencies change.
export function useAsyncMemo<T>(fn: () => Promise<T>, deps: React.DependencyList, initialValue: T, resetValue?: T) {
  const [value, setValue] = React.useState<T>(initialValue);
  React.useEffect(() => {
    let canceled = false;
    if (resetValue !== undefined)
      setValue(resetValue);
    fn().then(value => {
      if (!canceled)
        setValue(value);
    });
    return () => {
      canceled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

// Tracks the element size and returns it's contentRect (always has x=0, y=0).
export function useMeasure<T extends Element>() {
  const ref = React.useRef<T | null>(null);
  const [measure, setMeasure] = React.useState(new DOMRect(0, 0, 10, 10));
  React.useLayoutEffect(() => {
    const target = ref.current;
    if (!target)
      return;
    const resizeObserver = new ResizeObserver((entries: any) => {
      const entry = entries[entries.length - 1];
      if (entry && entry.contentRect)
        setMeasure(entry.contentRect);
    });
    resizeObserver.observe(target);
    return () => resizeObserver.unobserve(target);
  }, [ref]);
  return [measure, ref] as const;
}

export const Expandable: React.FunctionComponent<{
  title: JSX.Element,
  body: JSX.Element,
  setExpanded: Function,
  expanded: Boolean,
  style?: React.CSSProperties,
}> = ({ title, body, setExpanded, expanded, style }) => {
  return <div style={{ ...style, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <div
        className={'codicon codicon-' + (expanded ? 'chevron-down' : 'chevron-right')}
        style={{ cursor: 'pointer', color: 'var(--color)', marginRight: '4px'}}
        onClick={() => setExpanded(!expanded)} />
      {title}
    </div>
    { expanded && <div style={{ display: 'flex', flex: 'auto', margin: '5px 0 5px 20px' }}>{body}</div> }
  </div>;
};

export function highlightANSIText(text: string): JSX.Element {
  if (!text.includes('\u001b'))
    return <span>{text}</span>;
  let color: string | null = null;
  return <span>{text.split('\u001b').map((segment, index) => {
    if (index !== 0) {
      const matches = /^[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/.exec(segment);
      if (matches && matches.length) {
        const match = matches[0];
        segment = segment.slice(match.length);
        const COLORS: Record<string, string> = {
          '[30m': 'black',
          '[31m': 'red',
          '[32m': 'green',
          '[33m': 'yellow',
          '[34m': 'blue',
          '[35m': 'magenta',
          '[36m': 'cyan',
          '[37m': '#999',
        };
        if (match in COLORS)
          color = COLORS[match];
        else
          color = null;
      }
    }
    if (!color)
      return <span key={index}>{segment}</span>;
    return <span key={index}  style={{ color }}>{segment}</span>;
  })}</span>;
}

export function renderTestStatus(status: string, style: React.CSSProperties): JSX.Element {
  const codicon = { 'expected': 'check', 'unexpected': 'close', 'skipped': 'circle-slash', 'retry': 'refresh' }[status];
  return <div className={'codicon codicon-' + codicon} style={{ color: `var(--${status})`, fontWeight: 'bold', ...style }} />;
}
