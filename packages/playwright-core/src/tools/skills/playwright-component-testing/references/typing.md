# Typing `mount()`

`mount(storyId, props?)` accepts any string id and any serializable props. Two optional layers
add type checking on top; both are supported and can be mixed in one project.

| | Explicit story type | Gallery types |
|---|---|---|
| Call | `mount<typeof WithTitle>('components/Button/WithTitle', { title })` | `mount('acme-ui/components/Button/WithTitle', { title })` |
| Checks | props and `update()` | props, `update()`, and the id itself (autocomplete, rename safety) |
| Needs | `import type { WithTitle } from './Button.story'` in the spec | a generated `stories.d.ts` kept in sync by a gallery plugin |
| Id grammar | any suffix the gallery resolves | full id, prefixed with the package name |

## Explicit story type

Pass the story type as a template argument. Nothing to set up; works in every project.

```ts
import type { WithTitle } from './Button.story';

const component = await mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Hello' });
await component.update({ title: 'Again' });
```

Use `import type` so the story (and with it React/Vue and CSS imports) is never loaded into the
Node test process. Function components, class components and `defineComponent` stories all infer
their props; see the `Typed props` sections in `react.md` / `vue.md` for framework details.

## Gallery types

`@playwright/test` exports an empty `interface Stories {}`. When a story id is a key of `Stories`,
`mount` types the props from that entry; any other string keeps untyped props, so adoption can be
partial. A tiny Vite plugin next to the gallery generates `stories.d.ts`, which fills `Stories` in
via module augmentation:

```ts
// playwright/gallery/stories.d.ts (generated)
type StoriesOf<Prefix extends string, Mod> = { [K in keyof Mod & string as `${Prefix}/${K}`]: Mod[K] };

declare module '@playwright/test' {
  interface Stories extends
    StoriesOf<'acme-ui/components/Button', typeof import('../../src/components/Button.story')>,
    StoriesOf<'acme-ui/components/Expandable', typeof import('../../src/components/Expandable.story')> {}
}

export {};
```

One line per story file; export names and prop types come from the story module itself, so the
file only changes when a story file is added, removed or moved. Specs then need no type imports:

```ts
const component = await mount('acme-ui/components/Button/WithTitle', { title: 'Hello' });
//                            ^ autocompletes registered ids       ^ checked against WithTitle's props
```

### Namespace ids with the package name

`Stories` is merged per TypeScript program. In a monorepo whose packages share one `tsconfig`,
two packages both registering `components/Button/Default` with different props fail with
`TS2320: Interface 'Stories' cannot simultaneously extend types ...` at the `Stories` declaration,
and even distinct ids leak into each other's autocomplete. Prefix every id with the package name,
`<package>/<path under src>/<Export>`, from the start, so the convention holds when a project
becomes a package. Read the name from `package.json` in both places that derive ids, so they
cannot drift:

```ts
// playwright/gallery/main.tsx
import packageJSON from '../../package.json';

const id = (f: string) => packageJSON.name + '/' + f.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');
```

Suffix resolution keeps working at runtime, so `mount('Button/Primary')` still renders; only the
full prefixed id is typed.

### The plugin

Framework-agnostic: it only lists story files. Adjust `storyFile` to match the gallery's glob.

```ts
// playwright/gallery/storyTypes.ts
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const storyFile = /\.story\.(tsx|jsx)$/;

export function storyTypes(options: { prefix: string, src: string, outFile: string }): Plugin {
  const generate = () => {
    const content = render(listStoryFiles(options.src), options);
    if (fs.existsSync(options.outFile) && fs.readFileSync(options.outFile, 'utf8') === content)
      return;
    fs.writeFileSync(options.outFile, content);
  };
  return {
    name: 'story-types',
    buildStart() {
      this.addWatchFile(options.src);
      generate();
    },
    configureServer(server) {
      const onFile = (file: string) => {
        if (storyFile.test(file))
          generate();
      };
      server.watcher.on('add', onFile);
      server.watcher.on('unlink', onFile);
    },
  };
}

function listStoryFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory())
      result.push(...listStoryFiles(file));
    else if (storyFile.test(entry.name))
      result.push(file);
  }
  return result.sort();
}

function render(files: string[], { prefix, src, outFile }: { prefix: string, src: string, outFile: string }): string {
  const outDir = path.dirname(outFile);
  const posix = (p: string) => p.split(path.sep).join('/');
  const entries = files.map(file => {
    const id = prefix + '/' + posix(path.relative(src, file)).replace(storyFile, '');
    const specifier = posix(path.relative(outDir, file)).replace(/\.\w+$/, '');
    return `    StoriesOf<'${id}', typeof import('${specifier.startsWith('.') ? specifier : './' + specifier}')>`;
  });
  const stories = entries.length ? `interface Stories extends\n${entries.join(',\n')} {}` : 'interface Stories {}';
  return `// Generated by storyTypes.ts, do not edit.

type StoriesOf<Prefix extends string, Mod> = { [K in keyof Mod & string as \`\${Prefix}/\${K}\`]: Mod[K] };

declare module '@playwright/test' {
  ${stories}
}

export {};
`;
}
```

Register it on whichever Vite server serves the gallery (the app's `vite.config.ts`, or the
standalone `playwright/vite.config.ts`):

```ts
import packageJSON from './package.json';
import { storyTypes } from './playwright/gallery/storyTypes';

export default defineConfig({
  plugins: [
    react(),
    storyTypes({
      prefix: packageJSON.name,
      src: path.resolve(__dirname, 'src'),
      outFile: path.resolve(__dirname, 'playwright/gallery/stories.d.ts'),
    }),
  ],
});
```

The file is regenerated on every dev-server start and build, and while the server runs, whenever
a story file appears or disappears. Its content is deterministic, so **commit it**: type-checking
in CI or an editor must not depend on a running dev server. Nothing imports the file, so list it
explicitly in the project's `tsconfig` (`"files": ["playwright/gallery/stories.d.ts"]`) so that
`tsc` and editors load it.

For `.story.vue` single-file components, map the `default` export to the bare path in
`StoriesOf` (`K extends 'default' ? Prefix : \`${Prefix}/${K}\``) and rely on `vue-tsc` for the
SFC's types; a story without inferable props types as `unknown` props, which accepts anything.
