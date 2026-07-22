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

import { annotationLinksTest, attachmentLinksTest, basicTest, loadedReport, nextTest, twoAttemptsTest } from './sampleReport';
import { TestCaseView } from './testCaseView';

export const Default = () =>
  <TestCaseView report={loadedReport} test={basicTest} prev={undefined} next={undefined} run={0} />;

export const AnnotationLinks = () =>
  <TestCaseView report={loadedReport} test={annotationLinksTest} prev={undefined} next={undefined} run={0} />;

export const AttachmentLinks = () =>
  <TestCaseView report={loadedReport} test={attachmentLinksTest} prev={undefined} next={undefined} run={0} />;

export const PrevNext = () =>
  <TestCaseView report={loadedReport} test={attachmentLinksTest} prev={nextTest} next={nextTest} run={0} />;

export const TwoAttempts = () =>
  <TestCaseView report={loadedReport} test={twoAttemptsTest} prev={undefined} next={undefined} run={0} />;
