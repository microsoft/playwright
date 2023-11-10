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

// @ts-ignore
import codemirror from '../third_party/codemirror/lib/codemirror';
import '../third_party/codemirror/lib/codemirror.css';
import '../third_party/codemirror/lib/css';
import '../third_party/codemirror/lib/htmlmixed';
import '../third_party/codemirror/lib/javascript';
import '../third_party/codemirror/lib/python';
import '../third_party/codemirror/lib/clike';
import type CodeMirrorType from 'codemirror';

export type CodeMirror = typeof CodeMirrorType;
export default codemirror;
