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

import { SplitView, type SplitViewProps } from './splitView';

type StoryProps = Partial<Pick<SplitViewProps, 'sidebarSize' | 'sidebarHidden' | 'sidebarIsFirst' | 'orientation'>>;

export const Default = (props: StoryProps) =>
  <SplitView
    sidebarSize={100}
    {...props}
    main={<div id='main' style={{ border: '1px solid red', flex: 'auto' }}>main</div>}
    sidebar={<div id='sidebar' style={{ border: '1px solid blue', flex: 'auto' }}>sidebar</div>}
  />;
