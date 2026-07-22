// Playwright component gallery — implements the contract in the playwright-component-testing
// skill (references/gallery-spec.md): a single page exposing window.mount()/window.unmount().
// Vue's createApp().mount() builds a fresh instance each call, so the gallery mounts a small
// reactive host once and updates its refs — re-rendering in place preserves component state
// across component.update() calls.
import { createApp, h, shallowRef, type App, type Component } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { routes } from '../../src/router';
import '../../src/assets/index.css';

// import.meta.glob must stay inline: Vite analyzes it statically, relative to this file.
const stories = import.meta.glob('../../src/**/*.story.{ts,vue}');
const id = (f: string) => f.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

// Story id is '<path under src, without .story.*>/<ExportName>', e.g. 'components/Button/Submit'.
// A single-file-component story (X.scenario.story.vue) is addressed by its path alone, e.g.
// 'components/DefaultSlot.main' — its default export is the story.
async function resolve(storyId: string) {
  const sfc = Object.keys(stories).find(f => id(f) === storyId || id(f).endsWith('/' + storyId));
  if (sfc)
    return ((await stories[sfc]()) as Record<string, any>).default;
  const sep = storyId.lastIndexOf('/');
  const [path, name] = [storyId.slice(0, sep), storyId.slice(sep + 1)];
  const file = Object.keys(stories).find(f => id(f) === path || id(f).endsWith('/' + path));
  const mod = (file && await stories[file]()) as Record<string, any> | undefined;
  return mod?.[name] ?? mod?.default;
}

const story = shallowRef<Component | null>(null);
const props = shallowRef<Record<string, any>>({});
const host = { render: () => (story.value ? h(story.value, props.value) : null) };
let app: App | undefined;

(window as any).mount = async ({ story: storyId, props: next }: { story: string, props?: Record<string, any> }) => {
  const resolved = await resolve(storyId);
  if (!resolved)
    throw new Error(`Unknown story: ${storyId}`);
  story.value = resolved;
  props.value = next ?? {};
  if (!app) {                    // mount once; the ref updates above re-render in place
    app = createApp(host);
    // App-wide plugins live here — the gallery is the equivalent of the app's own bootstrap.
    // Memory history keeps routing stories independent from the gallery's own URL.
    app.use(createRouter({ history: createMemoryHistory(), routes }));
    app.mount('#root');
  }
};

(window as any).unmount = async () => {
  app?.unmount();
  app = undefined;
  story.value = null;
};
