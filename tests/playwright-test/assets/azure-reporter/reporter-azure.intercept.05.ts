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
        .reply(200, { 'id': '40067afb-7d94-4832-8565-a31e3427ecd3','name': 'SampleSample','url': 'https://dev.azure.com/alex-alex/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3','state': 'wellFormed','revision': 11,'_links': { 'self': { 'href': 'https://dev.azure.com/alex-alex/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3' },'collection': { 'href': 'https://dev.azure.com/alex-alex/_apis/projectCollections/71c15d06-b625-4e94-b256-84099a3c58d1' },'web': { 'href': 'https://dev.azure.com/alex-alex/SampleSample' } },'visibility': 'private','defaultTeam': { 'id': '24a24c07-d755-4b33-bfaf-4b16ecf0fd85','name': 'SampleSample Team','url': 'https://dev.azure.com/alex-alex/_apis/projects/40067afb-7d94-4832-8565-a31e3427ecd3/teams/24a24c07-d755-4b33-bfaf-4b16ecf0fd85' },'lastUpdateTime': '2022-02-08T22:21:09.643Z' }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs', { 'name': ' Playwright Test Run','automated': true,'configurationIds': [1],'plan': { 'id': '4' } })
        .reply(200, { 'id': 150,'name': ' Playwright Test Run','url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Runs/150','isAutomated': true,'owner': { 'displayName': null,'id': '00000000-0000-0000-0000-000000000000' },'project': { 'id': '40067afb-7d94-4832-8565-a31e3427ecd3','name': 'SampleSample' },'state': 'Unspecified','plan': { 'id': '4' },'totalTests': 0,'incompleteTests': 0,'notApplicableTests': 0,'passedTests': 0,'unanalyzedTests': 0,'revision': 2,'webAccessUrl': 'https://dev.azure.com/alex-alex/SampleSample/_TestManagement/Runs?runId=150&_a=runCharts' }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Points', { 'pointsFilter': { 'testcaseIds': [3] } })
        .reply(200, { 'points': [{ 'id': 1,'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Plans/4/Suites/6/Points/1','assignedTo': { 'displayName': 'Alex Neo','id': '230e55b4-9e71-6a10-a0fa-777777777' },'automated': false,'configuration': { 'id': '1','name': 'Windows 10' },'lastTestRun': { 'id': '238' },'lastResult': { 'id': '100000' },'outcome': 'Passed','state': 'Completed','lastResultState': 'Completed','suite': { 'id': '6' },'testCase': { 'id': '3' },'testPlan': { 'id': '4' },'workItemProperties': [{ 'workItem': { 'key': 'Microsoft.VSTS.TCM.AutomationStatus','value': 'Not Automated' } }] }],'pointsFilter': { 'testcaseIds': [3] } }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Points', { 'pointsFilter': { 'testcaseIds': [7] } })
        .reply(200, { 'points': [{ 'id': 2,'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Plans/4/Suites/6/Points/2','assignedTo': { 'displayName': 'Alex Neo','id': '230e55b4-9e71-6a10-a0fa-7777777777777' },'automated': false,'configuration': { 'id': '1','name': 'Windows 10' },'lastTestRun': { 'id': '208' },'lastResult': { 'id': '100000' },'outcome': 'Passed','state': 'Completed','lastResultState': 'Completed','suite': { 'id': '6' },'testCase': { 'id': '7' },'testPlan': { 'id': '4' },'workItemProperties': [{ 'workItem': { 'key': 'Microsoft.VSTS.TCM.AutomationStatus','value': 'Not Automated' } }] }],'pointsFilter': { 'testcaseIds': [7] } }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs/150/Results', [{ 'testCase': { 'id': '3' },'testPoint': { 'id': '1' },'testCaseTitle': '[3] foobar','outcome': 'Passed','state': 'Completed','durationInMs': /.+/i }])
        .reply(200, { 'count': 1,'value': [{ 'id': 100000,'project': {},'outcome': 'Passed','testRun': { 'id': '150' },'priority': 0,'url': '','lastUpdatedBy': { 'displayName': null,'id': null } }] }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs/150/Results', [{ 'testCase': { 'id': '7' },'testPoint': { 'id': '2' },'testCaseTitle': '[7] with screenshot','outcome': 'Failed','state': 'Completed','durationInMs': /.+/i,'errorMessage': /.+/i, 'stackTrace': /.+/i }])
        .reply(200, { 'count': 1,'value': [{ 'id': 100001,'project': {},'outcome': 'Passed','testRun': { 'id': '150' },'priority': 0,'url': '','lastUpdatedBy': { 'displayName': null,'id': null } }] }, headers);

    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments', { 'attachmentType': 'GeneralAttachment','fileName': /^(screenshot).+(.png)$/i,'stream': /.+/i })
        .reply(200, { 'id': 20,'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments/20' }, headers);
    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments', { 'attachmentType': 'GeneralAttachment','fileName': /^(trace).+(.zip)$/i,'stream': /.+/i })
        .reply(200, { 'id': 20,'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments/20' }, headers);
    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .post('/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments', { 'attachmentType': 'GeneralAttachment','fileName': /^(video).+(.webm)$/i,'stream': /.+/i })
        .reply(200, { 'id': 20,'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Runs/150/Results/100001/Attachments/20' }, headers);
  }

  onEnd() {
    nock('https://dev.azure.com:443', { 'encodedQueryParams': true })
        .patch('/alex-alex/SampleSample/_apis/test/Runs/150', { 'state': 'Completed' })
        .reply(200, {
          'id': 150,
          'name': ' Playwright Test Run',
          'url': 'https://dev.azure.com/alex-alex/SampleSample/_apis/test/Runs/150',
          'isAutomated': true,
          'owner': {
            'displayName': 'Alex Neo',
            'id': '230e55b4-9e71-6a10-a0fa-777777777'
          },
          'project': {
            'id': '40067afb-7d94-4832-8565-a31e3427ecd3',
            'name': 'SampleSample'
          },
          'startedDate': '2022-07-02T14:59:47.523Z',
          'completedDate': '2022-07-02T15:10:07.313Z',
          'state': 'Completed',
          'plan': {
            'id': '4'
          },
          'totalTests': 0,
          'incompleteTests': 0,
          'notApplicableTests': 0,
          'passedTests': 0,
          'unanalyzedTests': 0,
          'revision': 4,
          'webAccessUrl': 'https://dev.azure.com/alex-alex/SampleSample/_TestManagement/Runs?runId=150&_a=runCharts'
        }, headers);
  }
}

export default AzureInterceptor;