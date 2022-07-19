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

import type * as Test from 'azure-devops-node-api/TestApi';
import type * as TestInterfaces from 'azure-devops-node-api/interfaces/TestInterfaces';
import * as azdev from 'azure-devops-node-api';

import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import type { TestPoint } from 'azure-devops-node-api/interfaces/TestInterfaces';
import type { WebApi } from 'azure-devops-node-api';
import { colors } from 'playwright-core/lib/utilsBundle';
import { readFileSync } from 'fs';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi';
import type { TeamProject } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { createGuid } from 'playwright-core/lib/utils';

const Statuses = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Paused',
  timedOut: 'Failed'
};

const attachmentTypesArray = [
  'screenshot',
  'video',
  'trace',
] as const;

type TAttachmentType = Array<typeof attachmentTypesArray[number]>;

export interface AzureReporterOptions {
  token: string;
  planId: number;
  orgUrl: string;
  projectName: string;
  logging?: boolean | undefined;
  isDisabled?: boolean | undefined;
  environment?: string | undefined;
  testRunTitle?: string | undefined;
  uploadAttachments?: boolean | undefined;
  attachmentsType?: TAttachmentType | undefined;
}

interface TestResultsToTestRun {
  statusCode: number;
  result: Result;
  headers: Headers;
}
interface Result {
  count: number;
  value?: ValueEntity[] | null;
}
interface ValueEntity {
  id: number;
  project: Project;
  outcome: string;
  testRun: TestRun;
  priority: number;
  url: string;
  lastUpdatedBy: LastUpdatedBy;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Project {
}
interface TestRun {
  id: string;
}
interface LastUpdatedBy {
  displayName?: null;
  id?: null;
}
interface Headers {
  'cache-control': string;
  'pragma': string;
  'content-length': string;
  'content-type': string;
  'expires': string;
  'p3p': string;
  'x-tfs-processid': string;
  'strict-transport-security': string;
  'activityid': string;
  'x-tfs-session': string;
  'x-vss-e2eid': string;
  'x-vss-senderdeploymentid': string;
  'x-vss-userdata': string;
  'x-frame-options': string;
  'request-context': string;
  'access-control-expose-headers': string;
  'x-content-type-options': string;
  'x-cache': string;
  'x-msedge-ref': string;
  'date': string;
  'connection': string;
}

class AzureDevOpsReporter implements Reporter {
  private testApi!: Test.ITestApi;
  private coreApi!: ICoreApi;
  private _options: AzureReporterOptions;
  private publishedResultsCount = 0;
  private resultsToBePublished: string[] = [];
  private connection!: WebApi;
  private orgUrl!: string;
  private projectName!: string;
  private environment?: string;
  private planId = 0;
  private runId!: number;
  private logging = true;
  private isDisabled = false;
  private testRunTitle = '';
  private uploadAttachments = false;
  private attachmentsType?: TAttachmentType = ['screenshot'];
  private token: string = '';

  public constructor(options: AzureReporterOptions = {} as AzureReporterOptions) {
    this._options = options;

    this.orgUrl = this._options.orgUrl;
    this.projectName = this._options.projectName;
    this.environment = this._options.environment || undefined;
    this.planId = this._options.planId;
    this.logging = (typeof this._options.logging === 'undefined') ? true : this._options.logging;
    this.isDisabled = this._options.isDisabled || false;
    this.testRunTitle = `${this.environment ? `[${this.environment}]:` : ''} ${this._options.testRunTitle || 'Playwright Test Run'}` ||
      `${this.environment ? `[${this.environment}]:` : ''}Test plan ${this.planId}`;
    this.uploadAttachments = this._options.uploadAttachments || false;
    this.attachmentsType = this._options.attachmentsType;
    this.token = this._options.token;

    if (!this.orgUrl || this.orgUrl.length === 0) {
      this.log(colors.yellow("'orgUrl' is not set. Reporting is disabled."));
      this.isDisabled = true;
      return;
    }
    if (!this.projectName || this.projectName.length === 0) {
      this.log(colors.yellow("'projectName' is not set. Reporting is disabled."));
      this.isDisabled = true;
      return;
    }
    if (!this.planId || this.planId === 0) {
      this.log(colors.yellow("'planId' is not set. Reporting is disabled."));
      this.isDisabled = true;
      return;
    }
    if (!this.token || this.token.length === 0) {
      this.log(colors.yellow("'token' is not set. Reporting is disabled."));
      this.isDisabled = true;
    }
    if (this.uploadAttachments) {
      if (!this.attachmentsType) {
        this.log(colors.yellow("'attachmentsType' is not set. Attachments will not be uploaded."));
        this.uploadAttachments = false;
      }
    }
    this.connection = new azdev.WebApi(this.orgUrl, azdev.getPersonalAccessTokenHandler(this.token));
  }

  async onBegin(): Promise<void> {
    if (this.isDisabled)
      return;

    this.testApi = await this.connection.getTestApi();

    this.createRun(this.testRunTitle).then(run => {
      if (run) {
        this.runId = run.id;
        this.log(colors.green(`Using run ${this.runId} to publish test results`));
      } else {
        this.isDisabled = true;
      }
    });
  }

  async onTestEnd(test: TestCase, testResult: TestResult): Promise<void> {
    await this.awaitForRunId().catch(e => {
      this.log(colors.red(e));
    });
    if (this.isDisabled)
      return;

    this.logTestItem(test, testResult);
    await this.publishCaseResult(test, testResult);
  }

  async onEnd(): Promise<void> {
    await this.awaitForRunId().catch(e => {
      this.log(colors.red(e));
    });
    if (this.isDisabled)
      return;

    let prevCount = this.resultsToBePublished.length;
    while (this.resultsToBePublished.length > 0) {
      // need wait all results to be published
      if (prevCount > this.resultsToBePublished.length) {
        this.log(
            colors.gray(`Waiting for all results to be published. Remaining ${this.resultsToBePublished.length} results`)
        );
        prevCount--;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (this.publishedResultsCount === 0 && !this.runId) {
      this.log('No testcases were matched. Ensure that your tests are declared correctly.');
      return;
    }

    try {
      const runUpdate: TestInterfaces.RunUpdateModel = {
        state: 'Completed'
      };
      if (!this.testApi)
        this.testApi = await this.connection.getTestApi();
      const runUpdatedResponse = await this.testApi.updateTestRun(runUpdate, this.projectName, this.runId as number);
      this.log(colors.green(`Run ${this.runId} - ${runUpdatedResponse.state}`));
    } catch (err) {
      this.log(`Error on completing run ${err as string}`);
    }
  }

  private log(message?: any) {
    if (this.logging)
      console.log(colors.magenta(`azure: ${message}`));

  }

  private getCaseIds(test: TestCase): string {
    const regexp = /\[([\d,]+)\]/;
    const results = regexp.exec(test.title);
    if (results && results.length === 2)
      return results[1];

    return '';
  }

  private logTestItem(test: TestCase, testResult: TestResult) {
    const map = {
      failed: colors.red(`Test ${test.title} - ${testResult.status}`),
      passed: colors.green(`Test ${test.title} - ${testResult.status}`),
      skipped: colors.blue(`Test ${test.title} - ${testResult.status}`),
      pending: colors.blue(`Test ${test.title} - ${testResult.status}`),
      disabled: colors.gray(`Test ${test.title} - ${testResult.status}`),
      timedOut: colors.gray(`Test ${test.title} - ${testResult.status}`)
    };
    if (testResult.status)
      this.log(map[testResult.status]);

  }

  private async createRun(runName: string): Promise<TestInterfaces.TestRun> {
    return new Promise<TestInterfaces.TestRun>(async (resolve, reject) => {
      try {
        this.checkProject(this.projectName).catch(e => {
          reject(e);
        });
        const runModel: TestInterfaces.RunCreateModel = {
          name: runName,
          automated: true,
          configurationIds: [1],
          plan: { id: `${this.planId}` }
        };
        if (!this.testApi)
          this.testApi = await this.connection.getTestApi();
        const adTestRun = await this.testApi.createTestRun(runModel, this.projectName);
        resolve(adTestRun);
      } catch (e) {
        reject(e);
      }
    }).catch(e => {
      this.log(colors.red(`While creating test run.\n ${e}`));
      this.isDisabled = true;
      throw e;
    });
  }

  private removePublished(testAlias: string): void {
    const resultIndex = this.resultsToBePublished.indexOf(testAlias);
    if (resultIndex !== -1)
      this.resultsToBePublished.splice(resultIndex, 1);
  }

  private async checkProject(projectName: string): Promise<TeamProject | void> {
    return new Promise<TeamProject>(async (resolve, reject) => {
      try {
        if (!this.coreApi)
          this.coreApi = await this.connection.getCoreApi();
        const project = await this.coreApi.getProject(projectName);
        if (project)
          resolve(project);
        else
          reject(`Project ${projectName} does not exist. Reporting is disabled.`);

      } catch (e) {
        reject(e);
      }
    }).catch(e => {
      this.log(e);
      this.isDisabled = true;
    });
  }

  private async getTestPointIdsByTCIds(planId: number, testcaseIds: number[]): Promise<number[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const pointsQuery: TestInterfaces.TestPointsQuery = {
          pointsFilter: { testcaseIds }
        };
        if (!this.testApi)
          this.testApi = await this.connection.getTestApi();
        const pointsQueryResult: TestInterfaces.TestPointsQuery = await this.testApi.getPointsByQuery(
            pointsQuery,
            this.projectName
        );
        const pointsIds: number[] = [];
        if (pointsQueryResult.points) {
          pointsQueryResult.points.forEach((point: TestPoint) => {
            if (point.testPlan && point.testPlan.id && parseInt(point.testPlan.id, 10) === planId)
              pointsIds.push(point.id);
            else
              reject(`Could not find test point for test case [${point.testCase.id}] associated with test plan ${this.planId}. Check, maybe testPlanId, what you specifiyed, is incorrect.`);
          });
        }
        resolve(pointsIds);
      } catch (e) {
        this.log(colors.red(`While getting test points ids, by test cases ids.\n ${e}`));
        reject(e);
      }
    });
  }

  private addReportingOverride = (api: Test.ITestApi): Test.ITestApi => {
    // https://github.com/microsoft/azure-devops-node-api/issues/318#issuecomment-498802402
    api.addTestResultsToTestRun = function(results, projectName, runId) {
      return new Promise(async (resolve, reject) => {
        const routeValues = {
          project: projectName,
          runId
        };

        try {
          const verData = await this.vsoClient.getVersioningData(
              '5.0-preview.5',
              'Test',
              '4637d869-3a76-4468-8057-0bb02aa385cf',
              routeValues
          );
          const url = verData.requestUrl;
          const options = this.createRequestOptions('application/json', verData.apiVersion);
          const res = await this.rest.create(url as string, results, options);
          resolve(res as any);
        } catch (err) {
          reject(err);
        }
      });
    };
    return api;
  };

  private async uploadAttachmentsFunc(testResult: TestResult, caseId: number, testCaseId: string): Promise<string[]> {
    this.log(colors.gray(`Start upload attachments for test case [${testCaseId}]`));
    return await Promise.all(
        testResult.attachments.map(async (attachment, i) => {
          if (this.attachmentsType!.includes((attachment.name as TAttachmentType[number]))) {
            const attachments: TestInterfaces.TestAttachmentRequestModel = {
              attachmentType: 'GeneralAttachment',
              fileName: `${attachment.name}-${createGuid()}.${attachment.contentType.split('/')[1]}`,
              stream: readFileSync(attachment.path!, { encoding: 'base64' })
            };

            if (!this.testApi)
              this.testApi = await this.connection.getTestApi();
            const response = await this.testApi.createTestResultAttachment(
                attachments,
                this.projectName,
            this.runId!,
            caseId
            );
            return response.url;
          } else {
            return '';
          }
        })
    );
  }

  private async awaitForRunId(): Promise<number | void> {
    // need wait runId variable to be initialised in onBegin() hook
    if (this.isDisabled)
      return;
    return new Promise(async (resolve, reject) => {
      const timeout = 10_000;
      const startTime = Date.now();
      while (this.runId === undefined && Date.now() - startTime < timeout)
        await new Promise(resolve => setTimeout(resolve, 250));

      if (this.runId === undefined) {
        this.isDisabled = true;
        reject('Timeout while waiting for runId. Reporting is disabled.');
      } else {
        resolve(this.runId);
      }
    });
  }

  private async publishCaseResult(test: TestCase, testResult: TestResult): Promise<TestResultsToTestRun | void> {
    const caseId = this.getCaseIds(test);
    if (caseId === '')
      return;

    return new Promise(async (resolved, reject) => {
      const testAlias = `${caseId} - ${test.title}`;
      this.resultsToBePublished.push(testAlias);
      this.log(colors.gray(`Start publishing: ${test.title}`));

      const pointIds = await this.getTestPointIdsByTCIds(this.planId as number, [parseInt(caseId, 10)]).catch(e => {
        this.log(colors.red(`While getting test point ids, by test cases ids.\n ${e}`));
        this.removePublished(testAlias);
        return;
      });
      if (!pointIds || !pointIds.length) {
        this.log(colors.red(`No test points found for test case [${caseId}]`));
        this.removePublished(testAlias);
        return;
      }
      try {
        const results: TestInterfaces.TestCaseResult[] = [
          {
            testCase: { id: caseId },
            testPoint: { id: (pointIds as number[])[0].toString() },
            testCaseTitle: test.title,
            outcome: Statuses[testResult.status],
            state: 'Completed',
            durationInMs: testResult.duration,
            errorMessage: testResult.error
              ? `${test.title}: ${testResult.error?.message?.replace(/\u001b\[.*?m/g, '') as string}`
              : undefined,
            stackTrace: testResult.error?.stack?.replace(/\u001b\[.*?m/g, '')
          }
        ];

        if (!this.testApi)
          this.testApi = await this.connection.getTestApi();
        const testCaseResult: TestResultsToTestRun = await this.addReportingOverride(this.testApi).addTestResultsToTestRun(results, this.projectName, this.runId) as unknown as TestResultsToTestRun;
        if (this.uploadAttachments && testResult.attachments.length > 0)
          await this.uploadAttachmentsFunc(testResult, testCaseResult.result.value![0].id, caseId);

        this.removePublished(testAlias);
        this.publishedResultsCount++;
        this.log(colors.gray(`Result published: ${test.title}`));
        resolved(testCaseResult);
      } catch (err) {
        this.removePublished(testAlias);
        this.log(colors.red(err));
        reject(err);
      }
    });
  }
}

export default AzureDevOpsReporter;
