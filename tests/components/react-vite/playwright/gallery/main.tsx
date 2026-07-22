// Playwright component gallery — implements the contract in the playwright-component-testing
// skill (references/gallery-spec.md): a single page exposing window.mount()/window.unmount().
// The built-in `mount` fixture navigates here (baseURL) and calls window.mount via
// page.evaluate(..., { exposeFunctions: true }), so props may carry real callbacks.
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/assets/index.css';

// import.meta.glob must stay inline: Vite analyzes it statically, relative to this file.
const stories = import.meta.glob('../../src/**/*.story.tsx');
const id = (f: string) => f.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

// Story id is '<path under src, without .story.tsx>/<ExportName>', e.g. 'components/Button/Default'.
async function resolve(storyId: string) {
  const sep = storyId.lastIndexOf('/');
  const [path, name] = [storyId.slice(0, sep), storyId.slice(sep + 1)];
  const file = Object.keys(stories).find(f => id(f) === path || id(f).endsWith('/' + path));
  const mod = (file && await stories[file]()) as Record<string, any> | undefined;
  return mod?.[name] ?? mod?.default;
}

const rootEl = document.getElementById('root')!;
let root: Root | undefined;

(window as any).mount = async ({ story, props }: { story: string, props?: Record<string, any> }) => {
  const Story = await resolve(story);
  if (!Story)
    throw new Error(`Unknown story: ${story}`);
  // Reuse the root so component.update() reconciles in place and preserves state.
  root ??= createRoot(rootEl);
  // flushSync so a render error rejects the promise instead of being swallowed.
  flushSync(() => root!.render(<Story {...props} />));
};

(window as any).unmount = async () => {
  root?.unmount();
  root = undefined;
};
