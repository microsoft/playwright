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

import type { Point, SerializedError } from './channels';

export type CallMetadata = {
  id: string;
  startTime: number;
  endTime: number;
  pauseStartTime?: number;
  pauseEndTime?: number;
  type: string;
  method: string;
  params: any;
  title?: string;
  // Client is making an internal call that should not show up in
  // the inspector or trace.
  internal?: boolean;
  // Service-side is making a call to itself, this metadata does not go
  // through the dispatcher, so is always excluded from inspector / tracing.
  isServerSide?: boolean;
  // Test runner step id.
  stepId?: string;
  location?: { file: string, line?: number, column?: number };
  log: string[];
  error?: SerializedError;
  result?: any;
  point?: Point;
  objectId?: string;
  pageId?: string;
  frameId?: string;
  potentiallyClosesScope?: boolean;
};
