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

import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/theme.css';

const stories = import.meta.glob('../../src/**/*.story.{tsx,jsx}');
const storyId = (file: string) => file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

async function resolveStory(id: string): Promise<React.ComponentType<any> | undefined> {
  const sep = id.lastIndexOf('/');
  const [path, name] = [id.slice(0, sep), id.slice(sep + 1)];
  const file = Object.keys(stories).find(f => storyId(f) === path || storyId(f).endsWith('/' + path));
  const mod = (file && await stories[file]()) as Record<string, any> | undefined;
  return mod?.[name] ?? mod?.default;
}

const rootElement = document.getElementById('root')!;
let root: Root | undefined;

(window as any).mount = async ({ story, props }: { story: string, props?: Record<string, any> }) => {
  const Story = await resolveStory(story);
  if (!Story)
    throw new Error(`Unknown story: ${story}`);
  // Reuse the root so that update() reconciles and preserves state.
  root ??= createRoot(rootElement);
  // flushSync so that a render error rejects the promise instead of being swallowed.
  flushSync(() => root!.render(<Story {...props} />));
};

(window as any).unmount = async () => {
  root?.unmount();
  root = undefined;
};
