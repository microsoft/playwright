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

import nock from 'nock';

import type { Reporter } from '@playwright/test/reporter';
import path from 'path';
import headers from './azureHeaders';

class AzureInterceptor implements Reporter {
  constructor(config: any) {
  }

  async onBegin() {
    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .options('/alex-alex/_apis/Location')
        .replyWithFile(200, path.resolve(__dirname, './azureLocationOptionsResponse.json'), headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .get('/alex-alex/_apis/ResourceAreas')
        .replyWithFile(200, path.resolve(__dirname, './azureAreas.json'), headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .options('/alex-alex/_apis/Test')
        .replyWithFile(200, path.resolve(__dirname, './azureTestOptionsResponse.json'), headers).persist();

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .options('/alex-alex/_apis/core')
        .replyWithFile(200, path.resolve(__dirname, './azureCoreOptionsResponse.json'), headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .get('/alex-alex/_apis/projects/SampleSample')
        .reply(404, { '$id': '1','innerException': null,'message': 'TF200016: The following project does not exist: SampleSample. Verify that the name of the project is correct and that the project exists on the specified Azure DevOps Server.','typeName': 'Microsoft.TeamFoundation.Core.WebApi.ProjectDoesNotExistWithNameException, Microsoft.TeamFoundation.Core.WebApi','typeKey': 'ProjectDoesNotExistWithNameException','errorCode': 0,'eventId': 3000 }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs', { 'name': ' Playwright Test Run','automated': true,'configurationIds': [1],'plan': { 'id': '4' } })
        .reply(404, { '$id': '1','innerException': null,'message': 'TF200016: The following project does not exist: SampleSample. Verify that the name of the project is correct and that the project exists on the specified Azure DevOps Server.','typeName': 'Microsoft.TeamFoundation.Core.WebApi.ProjectDoesNotExistWithNameException, Microsoft.TeamFoundation.Core.WebApi','typeKey': 'ProjectDoesNotExistWithNameException','errorCode': 0,'eventId': 3000 }, headers);
  }

}

export default AzureInterceptor;