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

import React from 'react';

export const ChevronLeftIcon: React.FC = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <polyline points='15 18 9 12 15 6'/>
  </svg>
);

export const ChevronRightIcon: React.FC = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <polyline points='9 18 15 12 9 6'/>
  </svg>
);

export const CloseIcon: React.FC = () => (
  <svg viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
    <line x1='2' y1='2' x2='10' y2='10'/>
    <line x1='10' y1='2' x2='2' y2='10'/>
  </svg>
);

export const PlusIcon: React.FC = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
    <line x1='12' y1='5' x2='12' y2='19'/>
    <line x1='5' y1='12' x2='19' y2='12'/>
  </svg>
);

export const ReloadIcon: React.FC = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <polyline points='23 4 23 10 17 10'/>
    <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/>
  </svg>
);

export const PickLocatorIcon: React.FC = () => (
  <svg viewBox='0 0 48 48' fill='currentColor'>
    <path d='M18 42h-7.5c-3 0-4.5-1.5-4.5-4.5v-27C6 7.5 7.5 6 10.5 6h27C42 6 42 10.404 42 10.5V18h-3V9H9v30h9v3Zm27-15-9 6 9 9-3 3-9-9-6 9-6-24 24 6Z'/>
  </svg>
);

export const InspectorPanelIcon: React.FC = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <rect x='3' y='3' width='18' height='18' rx='2'/>
    <line x1='9' y1='3' x2='9' y2='21'/>
  </svg>
);
