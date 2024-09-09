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

export function ClickPointer({ point }: { point: { x: number; y: number } }) {
  return (
    <div
      style={{
        position: 'fixed',
        backgroundColor: '#f44336',
        width: '20px',
        height: '20px',
        borderRadius: '10px',
        margin: '-10px 0 0 -10px',
        zIndex: 2147483646,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        left: `${point.x}px`,
        top: `${point.y}px`,
      }}
    >
      <div
        style={{
          fontSize: '19px',
          color: 'white',
          marginTop: '-3.5px',
          userSelect: 'none'
        }}
        title='Click positions on screenshots are inaccurate.'
      >
        ⚠
      </div>
    </div>
  );
}
