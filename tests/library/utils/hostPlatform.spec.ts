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

import { test, expect } from '@playwright/test';
import { calculateLinuxPlatform } from '../../../packages/utils/hostPlatform';

test.describe('calculateLinuxPlatform - RHEL family detection', () => {
  test('rocky linux 9 maps to rhel9-x64', () => {
    const result = calculateLinuxPlatform({ id: 'rocky', version: '9', idLike: 'rhel centos fedora' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('rhel 9.3 maps to rhel9-x64', () => {
    const result = calculateLinuxPlatform({ id: 'rhel', version: '9.3', idLike: '' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('almalinux 9.1 maps to rhel9-x64', () => {
    const result = calculateLinuxPlatform({ id: 'almalinux', version: '9.1', idLike: 'rhel centos fedora' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('centos 9 maps to rhel9-x64', () => {
    const result = calculateLinuxPlatform({ id: 'centos', version: '9', idLike: 'rhel fedora' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('fedora 40 does NOT map to rhel9-*', () => {
    const result = calculateLinuxPlatform({ id: 'fedora', version: '40', idLike: '' }, 'x64');
    expect(result.hostPlatform).not.toContain('rhel9');
  });

  test('unknown distro with id_like containing rhel maps to rhel9-x64 for version >= 9', () => {
    const result = calculateLinuxPlatform({ id: 'unknown', version: '9', idLike: 'rhel centos fedora' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('rocky linux 8.9 does NOT map to rhel9-* (falls to unknown)', () => {
    const result = calculateLinuxPlatform({ id: 'rocky', version: '8.9', idLike: 'rhel centos fedora' }, 'x64');
    expect(result.hostPlatform).toBe('<unknown>');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('rocky linux 9 on arm64 maps to rhel9-arm64', () => {
    const result = calculateLinuxPlatform({ id: 'rocky', version: '9', idLike: 'rhel centos fedora' }, 'arm64');
    expect(result.hostPlatform).toBe('rhel9-arm64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('fedora with id_like rhel does NOT map to rhel9-* (fedora excluded by id check)', () => {
    const result = calculateLinuxPlatform({ id: 'fedora', version: '9', idLike: 'rhel' }, 'x64');
    expect(result.hostPlatform).not.toContain('rhel9');
  });

  test('oracle linux 9.3 maps to rhel9-x64', () => {
    const result = calculateLinuxPlatform({ id: 'ol', version: '9.3', idLike: '' }, 'x64');
    expect(result.hostPlatform).toBe('rhel9-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });

  test('undefined distroInfo falls through to ubuntu24.04 default', () => {
    const result = calculateLinuxPlatform(undefined, 'x64');
    expect(result.hostPlatform).toBe('ubuntu24.04-x64');
    expect(result.isOfficiallySupportedPlatform).toBe(false);
  });
});
