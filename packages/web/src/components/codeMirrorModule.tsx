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
import codemirror from 'codemirror-shadow-1';
import type codemirrorType from 'codemirror';
import 'codemirror-shadow-1/lib/codemirror.css';
import 'codemirror-shadow-1/mode/css/css';
import 'codemirror-shadow-1/mode/htmlmixed/htmlmixed';
import 'codemirror-shadow-1/mode/javascript/javascript';
import 'codemirror-shadow-1/mode/python/python';
import 'codemirror-shadow-1/mode/clike/clike';
import 'codemirror-shadow-1/mode/markdown/markdown';
import 'codemirror-shadow-1/addon/mode/simple';

export type CodeMirror = typeof codemirrorType;
export default codemirror;
