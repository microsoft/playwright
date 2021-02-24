/**
 * Copyright (c) Microsoft Corporation.
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

import * as trace from '../common/traceEvents';
import { ContextEntry } from './traceModel';
export * as trace from '../common/traceEvents';

export type SerializedFrameSnapshot = {
  html: string;
  resourcesByUrl: { [key: string]: { resourceId: string, frameId: string }[] };
  overriddenUrls: { [key: string]: boolean };
  resourceOverrides: { [key: string]: string };
};

export class FrameSnapshot {
  private _snapshots: trace.FrameSnapshotTraceEvent[];
  private _index: number;
  contextEntry: ContextEntry;

  constructor(contextEntry: ContextEntry, events: trace.FrameSnapshotTraceEvent[], index: number) {
    this.contextEntry = contextEntry;
    this._snapshots = events;
    this._index = index;
  }

  traceEvent(): trace.FrameSnapshotTraceEvent {
    return this._snapshots[this._index];
  }

  serialize(): SerializedFrameSnapshot {
    const visit = (n: trace.NodeSnapshot, snapshotIndex: number): string => {
      // Text node.
      if (typeof n === 'string')
        return escapeText(n);

      if (!(n as any)._string) {
        if (Array.isArray(n[0])) {
          // Node reference.
          const referenceIndex = snapshotIndex - n[0][0];
          if (referenceIndex >= 0 && referenceIndex < snapshotIndex) {
            const nodes = snapshotNodes(this._snapshots[referenceIndex].snapshot);
            const nodeIndex = n[0][1];
            if (nodeIndex >= 0 && nodeIndex < nodes.length)
              (n as any)._string = visit(nodes[nodeIndex], referenceIndex);
          }
        } else if (typeof n[0] === 'string') {
          // Element node.
          const builder: string[] = [];
          builder.push('<', n[0]);
          for (const [attr, value] of Object.entries(n[1] || {}))
            builder.push(' ', attr, '="', escapeAttribute(value as string), '"');
          builder.push('>');
          for (let i = 2; i < n.length; i++)
            builder.push(visit(n[i], snapshotIndex));
          if (!autoClosing.has(n[0]))
            builder.push('</', n[0], '>');
          (n as any)._string = builder.join('');
        } else {
          // Why are we here? Let's not throw, just in case.
          (n as any)._string = '';
        }
      }
      return (n as any)._string;
    };

    const snapshot = this._snapshots[this._index].snapshot;
    let html = visit(snapshot.html, this._index);
    if (snapshot.doctype)
      html = `<!DOCTYPE ${snapshot.doctype}>` + html;
    html += `<script>${this.contextEntry.created.snapshotScript}</script>`;

    const resourcesByUrl = this.contextEntry.resourcesByUrl;
    const overriddenUrls = this.contextEntry.overriddenUrls;
    const resourceOverrides: any = {};
    for (const o of this._snapshots[this._index].snapshot.resourceOverrides)
      resourceOverrides[o.url] = o.sha1;
    return { html, resourcesByUrl, overriddenUrls: overriddenUrls, resourceOverrides };
  }
}

const autoClosing = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

function escapeAttribute(s: string): string {
  return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
}
function escapeText(s: string): string {
  return s.replace(/[&<]/ug, char => (escaped as any)[char]);
}

function snapshotNodes(snapshot: trace.FrameSnapshot): trace.NodeSnapshot[] {
  if (!(snapshot as any)._nodes) {
    const nodes: trace.NodeSnapshot[] = [];
    const visit = (n: trace.NodeSnapshot) => {
      if (typeof n === 'string') {
        nodes.push(n);
      } else if (typeof n[0] === 'string') {
        for (let i = 2; i < n.length; i++)
          visit(n[i]);
        nodes.push(n);
      }
    };
    visit(snapshot.html);
    (snapshot as any)._nodes = nodes;
  }
  return (snapshot as any)._nodes;
}
