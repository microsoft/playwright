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

import * as React from 'react';
import { Expandable } from './expandable';

export const Collapsed = () =>
  <Expandable expanded={false} setExpanded={() => {}} title='Title'>Details text</Expandable>;

export const Expanded = () =>
  <Expandable expanded={true} setExpanded={() => {}} title='Title'>Details text</Expandable>;

export const Stateful = () => {
  const [expanded, setExpanded] = React.useState(false);
  return <>
    <Expandable expanded={expanded} setExpanded={setExpanded} title='Title'>Details text</Expandable>
    <form hidden><input data-testid='expanded' readOnly value={String(expanded)} /></form>
  </>;
};

export const StatefulTitleClick = () => {
  const [expanded, setExpanded] = React.useState(false);
  return <>
    <Expandable expanded={expanded} setExpanded={setExpanded} expandOnTitleClick title='Title'>Details text</Expandable>
    <form hidden><input data-testid='expanded' readOnly value={String(expanded)} /></form>
  </>;
};
