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
import { DevToolsTransport } from './transport';

export const Screencast: React.FC<{ wsUrl: string }> = ({ wsUrl }) => {
  const [frameSrc, setFrameSrc] = React.useState('');

  React.useEffect(() => {
    const transport = new DevToolsTransport(wsUrl);
    transport.onevent = (method: string, params: any) => {
      if (method === 'frame')
        setFrameSrc('data:image/jpeg;base64,' + params.data);
    };
    return () => transport.close();
  }, [wsUrl]);

  if (!frameSrc)
    return <div className='screencast-placeholder'>Connecting...</div>;

  return <img className='screencast-frame' alt='screencast' src={frameSrc} />;
};
