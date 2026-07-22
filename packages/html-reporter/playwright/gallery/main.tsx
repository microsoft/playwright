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
import { SearchParamsProvider } from '../../src/links';

const stories = import.meta.glob('../../src/**/*.story.{tsx,jsx}');
const storyId = (file: string) => file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

async function resolveStory(id: string): Promise<React.ComponentType<any> | undefined> {
  const sep = id.lastIndexOf('/');
  const [path, name] = [id.slice(0, sep), id.slice(sep + 1)];
  const file = Object.keys(stories).find(f => storyId(f) === path || storyId(f).endsWith('/' + path));
  const mod = (file && await stories[file]()) as Record<string, any> | undefined;
  return mod?.[name] ?? mod?.default;
}

const wrapperElement = document.getElementById('wrapper')!;
let root: Root | undefined;

(window as any).mount = async ({ story, props }: { story: string, props?: Record<string, any> }) => {
  const Story = await resolveStory(story);
  if (!Story)
    throw new Error(`Unknown story: ${story}`);
  // Reuse the root so that update() reconciles and preserves state.
  root ??= createRoot(wrapperElement);
  // flushSync so that a render error rejects the promise instead of being swallowed.
  flushSync(() => root!.render(
    <SearchParamsProvider>
      <div id="root">
        <Story {...props} />
      </div>
    </SearchParamsProvider>
  ));
};

(window as any).unmount = async () => {
  root?.unmount();
  root = undefined;
};

async function listStories(): Promise<string[]> {
  const lists = await Promise.all(Object.entries(stories).map(async ([file, loadModule]) => {
    const mod = await loadModule() as Record<string, any>;
    return Object.keys(mod).filter(name => typeof mod[name] === 'function').map(name => `${storyId(file)}/${name}`);
  }));
  return lists.flat().sort();
}

const pickerElement = document.getElementById('picker') as HTMLSelectElement;
let pickerPopulated = false;
async function populatePicker() {
  if (pickerPopulated)
    return;
  pickerPopulated = true;
  for (const id of await listStories())
    pickerElement.add(new Option(id, id));
}
// Populate on mouseenter/focus rather than on click, because an already-open
// select popup does not refresh when options are added.
pickerElement.addEventListener('mouseenter', () => void populatePicker());
pickerElement.addEventListener('focus', () => void populatePicker());
pickerElement.addEventListener('change', () => {
  if (pickerElement.value)
    void (window as any).mount({ story: pickerElement.value });
});
