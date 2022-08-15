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
import { colors, debug } from 'playwright-core/lib/utilsBundle';
import { existsSync, readFileSync } from 'fs';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi';
import type { TeamProject } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { createGuid } from 'playwright-core/lib/utils';

const log = debug('pw:test:azure');

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
  private publishedResultsCount = 0;
  private resultsToBePublished: string[] = [];
  private connection!: WebApi;
  private orgUrl!: string;
  private projectName!: string;
  private environment?: string;
  private planId = 0;
  private isDisabled = false;
  private testRunTitle = '';
  private uploadAttachments = false;
  private attachmentsType?: TAttachmentType;
  private token: string = '';
  private runIdPromise: Promise<number>;
  private resolveRunId: (value: number) => void = () => {};
  private rejectRunId: (error: Error) => void = () => {};

  public constructor(options: AzureReporterOptions) {
    this._validateOptions(options);
    this.runIdPromise = new Promise<number>((resolve, reject) => {
      this.resolveRunId = resolve;
      this.rejectRunId = reject;
    });
  }

  _validateOptions(options: AzureReporterOptions): void {
    if (options?.isDisabled){
      this.isDisabled = true;
      return;
    }
    if (!options?.orgUrl) {
      this._warning("'orgUrl' is not set. Reporting is disabled.");
      this.isDisabled = true;
      return;
    }
    if (!options?.projectName) {
      this._warning("'projectName' is not set. Reporting is disabled.");
      this.isDisabled = true;
      return;
    }
    if (!options?.planId) {
      this._warning("'planId' is not set. Reporting is disabled.");
      this.isDisabled = true;
      return;
    }
    if (!options?.token) {
      this._warning("'token' is not set. Reporting is disabled.");
      this.isDisabled = true;
      return;
    }
    if (options?.uploadAttachments) {
      if (!options?.attachmentsType) {
        this._warning("'attachmentsType' is not set. Attachments Type will be set to 'screenshot' by default.");
        this.attachmentsType = ['screenshot'];
      } else {
        this.attachmentsType = options.attachmentsType;
      }
    }

    this.orgUrl = options.orgUrl;
    this.projectName = options.projectName;
    this.planId = options.planId;
    this.token = options.token;
    this.environment = options?.environment || undefined;
    this.testRunTitle = `${this.environment ? `[${this.environment}]:` : ''} ${options?.testRunTitle || 'Playwright Test Run'}` ||
      `${this.environment ? `[${this.environment}]:` : ''}Test plan ${this.planId}`;
    this.uploadAttachments = options?.uploadAttachments || false;

    this.connection = new azdev.WebApi(this.orgUrl, azdev.getPersonalAccessTokenHandler(this.token));
  }

  async onBegin(): Promise<void> {
    if (this.isDisabled)
      return;

    (async () => {
      this.testApi = await this.connection.getTestApi();

      const run = await this._createRun(this.testRunTitle);
      if (run) {
        this.resolveRunId(run.id);
        this._log(colors.green(`Using run ${run.id} to publish test results`));
      } else {
        this.isDisabled = true;
      }
    })().catch(error => {
      this.isDisabled = true;
      this._warning(`Failed to create test run: ${error.message}. Check your token and orgUrl. Reporting is disabled.`);
      this.rejectRunId(error);
    });
  }

  async onTestEnd(test: TestCase, testResult: TestResult): Promise<void> {
    const runId = await this.runIdPromise;
    if (!runId || this.isDisabled)
      return;

    this._logTestItem(test, testResult);
    await this.publishCaseResult(test, testResult);
  }

  async onEnd(): Promise<void> {
    const runId = await this.runIdPromise;
    if (!runId || this.isDisabled)
      return;

    let prevCount = this.resultsToBePublished.length;
    while (this.resultsToBePublished.length > 0) {
      // need wait all results to be published
      if (prevCount > this.resultsToBePublished.length) {
        this._log(
            colors.gray(`Waiting for all results to be published. Remaining ${this.resultsToBePublished.length} results`)
        );
        prevCount--;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (this.publishedResultsCount === 0 && !runId) {
      this._log(colors.gray('No testcases were matched. Ensure that your tests are declared correctly.'));
      return;
    }

    try {
      if (!this.testApi)
        this.testApi = await this.connection.getTestApi();
      const runUpdatedResponse = await this.testApi.updateTestRun({ state: 'Completed' }, this.projectName, runId);
      this._log(colors.green(`Run ${runId} - ${runUpdatedResponse.state}`));
    } catch (err) {
      this._log(`Error on completing run ${err as string}`);
    }
  }

  printsToStdio() {
    return true;
  }

  private _log(message?: any) {
    log(message);
  }

  private _warning(message?: any) {
    console.log(colors.magenta('pw:test:azure'), colors.yellow(message));
  }

  private _getCaseIds(test: TestCase): string {
    const results = /\[([\d,]+)\]/.exec(test.title);
    if (results && results.length === 2)
      return results[1];

    return '';
  }

  private _logTestItem(test: TestCase, testResult: TestResult) {
    const map = {
      failed: colors.red(`Test ${test.title} - ${testResult.status}`),
      passed: colors.green(`Test ${test.title} - ${testResult.status}`),
      skipped: colors.blue(`Test ${test.title} - ${testResult.status}`),
      pending: colors.blue(`Test ${test.title} - ${testResult.status}`),
      disabled: colors.gray(`Test ${test.title} - ${testResult.status}`),
      timedOut: colors.gray(`Test ${test.title} - ${testResult.status}`)
    };
    if (testResult.status)
      this._log(map[testResult.status]);

  }

  private async _createRun(runName: string): Promise<TestInterfaces.TestRun | void> {
    try {
      await this._checkProject(this.projectName);
      const runModel: TestInterfaces.RunCreateModel = {
        name: runName,
        automated: true,
        configurationIds: [1],
        plan: { id: String(this.planId) }
      };
      if (!this.testApi)
        this.testApi = await this.connection.getTestApi();
      const adTestRun = await this.testApi.createTestRun(runModel, this.projectName);
      if (adTestRun)
        return adTestRun;
      else
        throw new Error('Failed to create test run');

    } catch (e) {
      this._warning(colors.red(e.message));
      this.isDisabled = true;
    }
  }

  private _removePublished(testAlias: string): void {
    const resultIndex = this.resultsToBePublished.indexOf(testAlias);
    if (resultIndex !== -1)
      this.resultsToBePublished.splice(resultIndex, 1);
  }

  private async _checkProject(projectName: string): Promise<TeamProject | void> {
    try {
      if (!this.coreApi)
        this.coreApi = await this.connection.getCoreApi();
      const project = await this.coreApi.getProject(projectName);
      if (project)
        return project;
      else
        throw new Error(`Project ${projectName} does not exist. Reporting is disabled.`);

    } catch (e) {
      this._warning(colors.red(e.message));
      this.isDisabled = true;
    }
  }

  private async _getTestPointIdsByTCIds(planId: number, testcaseIds: number[]): Promise<number[]> {
    const pointsIds: number[] = [];
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
      if (pointsQueryResult.points) {
        pointsQueryResult.points.forEach((point: TestPoint) => {
          if (point.testPlan && point.testPlan.id && parseInt(point.testPlan.id, 10) === planId)
            pointsIds.push(point.id);
          else
            throw new Error(`Could not find test point for test case [${point.testCase.id}] associated with test plan ${this.planId}. Check, maybe testPlanId, what you specified, is incorrect.`);
        });
      }
      return pointsIds;
    } catch (e) {
      this._log(colors.red(e.message));
    }
    return pointsIds;
  }

  private _addReportingOverride = (api: Test.ITestApi): Test.ITestApi => {
    /**
     * Override the default behavior of publishing test results to the test run.
     * This is necessary because Microsoft Azure API documentation at version higher than '5.0-preview.5'
     * has undocumented fields and they not implementing at 'azure-devops-node-api/TestApi' package.
     * This function is downgraded the API version to '5.0-preview.5'.
     * https://github.com/microsoft/azure-devops-node-api/issues/318#issuecomment-498802402
     */
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
    this._log(colors.gray(`Start upload attachments for test case [${testCaseId}]`));
    const runId = await this.runIdPromise;
    const attachmentsResult: string[] = [];
    for (const attachment of testResult.attachments) {
      try {
        if (this.attachmentsType!.includes((attachment.name as TAttachmentType[number]))) {
          if (existsSync(attachment.path!)) {
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
                runId,
                caseId
            );
            attachmentsResult.push(response.url);
          } else {
            throw new Error(`Attachment ${attachment.path} does not exist`);
          }
        }
      } catch (err) {
        this._log(colors.red(err.message));
      }
    }
    return attachmentsResult;
  }

  // private async awaitForRunId(): Promise<number | void> {
  //   // need wait runId variable to be initialised in onBegin() hook
  //   if (this.isDisabled)
  //     return;
  //   try {
  //     const timeout = 10_000;
  //     const startTime = Date.now();
  //     while (this.runId === undefined && Date.now() - startTime < timeout)
  //       await new Promise(resolve => setTimeout(resolve, 250));

  //     if (this.runId === undefined) {
  //       this.isDisabled = true;
  //       throw new Error('Timeout while waiting for runId. Reporting is disabled.');
  //     } else {
  //       return this.runId;
  //     }
  //   } catch (error) {
  //     this._log(colors.red(`While waiting for runId.\n ${error.message}`));
  //   }
  // }

  private async publishCaseResult(test: TestCase, testResult: TestResult): Promise<TestResultsToTestRun | void> {
    const caseId = this._getCaseIds(test);
    if (caseId === '')
      return;

    const testAlias = `${caseId} - ${test.title}`;
    this.resultsToBePublished.push(testAlias);
    const runId = await this.runIdPromise;
    this._log(colors.gray(`Start publishing: ${test.title}`));

    try {
      const pointIds = await this._getTestPointIdsByTCIds(this.planId as number, [parseInt(caseId, 10)]);
      if (!pointIds || !pointIds.length) {
        this._removePublished(testAlias);
        throw new Error(`No test points found for test case [${caseId}]`);
      }
      const results: TestInterfaces.TestCaseResult[] = [
        {
          testCase: { id: caseId },
          testPoint: { id: String(pointIds[0]) },
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
      const testCaseResult: TestResultsToTestRun = await this._addReportingOverride(this.testApi).addTestResultsToTestRun(results, this.projectName, runId) as unknown as TestResultsToTestRun;
      if (this.uploadAttachments && testResult.attachments.length > 0)
        await this.uploadAttachmentsFunc(testResult, testCaseResult.result.value![0].id, caseId);

      this._removePublished(testAlias);
      this.publishedResultsCount++;
      this._log(colors.gray(`Result published: ${test.title}`));
      return testCaseResult;
    } catch (err) {
      this._removePublished(testAlias);
      this._log(colors.red(err.message));
    }
  }
}

export default AzureDevOpsReporter;
