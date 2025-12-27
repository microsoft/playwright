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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

const setGeolocation = defineTool({
    capability: 'core',

    schema: {
        name: 'browser_set_geolocation',
        title: 'Set geolocation',
        description: 'Set the browser geolocation to mock location-based features. This affects all pages in the browser context.',
        inputSchema: z.object({
            latitude: z.number().min(-90).max(90).describe('Latitude between -90 and 90'),
            longitude: z.number().min(-180).max(180).describe('Longitude between -180 and 180'),
            accuracy: z.number().optional().describe('Optional accuracy in meters, defaults to 0'),
        }),
        type: 'action',
    },

    handle: async (context, params, response) => {
        const browserContext = await context.ensureBrowserContext();

        // Grant geolocation permission first
        await browserContext.grantPermissions(['geolocation']);

        // Set the geolocation
        await browserContext.setGeolocation({
            latitude: params.latitude,
            longitude: params.longitude,
            accuracy: params.accuracy ?? 0,
        });

        response.addCode(`await context.grantPermissions(['geolocation']);`);
        response.addCode(`await context.setGeolocation({ latitude: ${params.latitude}, longitude: ${params.longitude}, accuracy: ${params.accuracy ?? 0} });`);
    },
});

const clearGeolocation = defineTool({
    capability: 'core',

    schema: {
        name: 'browser_clear_geolocation',
        title: 'Clear geolocation',
        description: 'Clear the mocked geolocation and restore default behavior',
        inputSchema: z.object({}),
        type: 'action',
    },

    handle: async (context, params, response) => {
        const browserContext = await context.ensureBrowserContext();

        // Clear permissions revokes geolocation access
        await browserContext.clearPermissions();

        response.addCode(`await context.clearPermissions();`);
    },
});

export default [
    setGeolocation,
    clearGeolocation,
];
