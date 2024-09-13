/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  EXPECTED_COLOR,
  RECEIVED_COLOR,
  matcherHint,
  pluralize,
} from 'jest-matcher-utils';
import { getState, setState } from './jestMatchersObject';
import type { Expect, ExpectedAssertionsErrors } from './types';

const resetAssertionsLocalState = () => {
  setState({
    assertionCalls: 0,
    expectedAssertionsNumber: null,
    isExpectingAssertions: false,
    numPassingAsserts: 0,
  });
};

// Create and format all errors related to the mismatched number of `expect`
// calls and reset the matcher's state.
const extractExpectedAssertionsErrors: Expect['extractExpectedAssertionsErrors'] =
  () => {
    const result: ExpectedAssertionsErrors = [];
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberError,
      isExpectingAssertions,
      isExpectingAssertionsError,
    } = getState();

    resetAssertionsLocalState();

    if (
      typeof expectedAssertionsNumber === 'number' &&
      assertionCalls !== expectedAssertionsNumber
    ) {
      const numOfAssertionsExpected = EXPECTED_COLOR(
          pluralize('assertion', expectedAssertionsNumber),
      );

      expectedAssertionsNumberError!.message =
        `${matcherHint('.assertions', '', expectedAssertionsNumber.toString(), {
          isDirectExpectCall: true,
        })}\n\n` +
        `Expected ${numOfAssertionsExpected} to be called but received ${RECEIVED_COLOR(
            pluralize('assertion call', assertionCalls || 0),
        )}.`;

      result.push({
        actual: assertionCalls.toString(),
        error: expectedAssertionsNumberError!,
        expected: expectedAssertionsNumber.toString(),
      });
    }
    if (isExpectingAssertions && assertionCalls === 0) {
      const expected = EXPECTED_COLOR('at least one assertion');
      const received = RECEIVED_COLOR('received none');

      isExpectingAssertionsError!.message = `${matcherHint(
          '.hasAssertions',
          '',
          '',
          { isDirectExpectCall: true },
      )}\n\nExpected ${expected} to be called but ${received}.`;

      result.push({
        actual: 'none',
        error: isExpectingAssertionsError!,
        expected: 'at least one',
      });
    }

    return result;
  };

export default extractExpectedAssertionsErrors;
