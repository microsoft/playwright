`tar` dep tree:

```
├─┬ tar@7.4.3
│ ├─┬ @isaacs/fs-minipass@4.0.1
│ │ └── minipass@7.1.2 deduped
│ ├── chownr@3.0.0
│ ├── minipass@7.1.2
│ ├─┬ minizlib@3.0.1
│ │ ├── minipass@7.1.2 deduped
│ │ └─┬ rimraf@5.0.10
│ │   └─┬ glob@10.4.5
│ │     ├─┬ foreground-child@3.3.0
│ │     │ ├─┬ cross-spawn@7.0.6
│ │     │ │ ├── path-key@3.1.1
│ │     │ │ ├─┬ shebang-command@2.0.0
│ │     │ │ │ └── shebang-regex@3.0.0
│ │     │ │ └─┬ which@2.0.2
│ │     │ │   └── isexe@2.0.0
│ │     │ └── signal-exit@4.1.0
│ │     ├─┬ jackspeak@3.4.3
│ │     │ ├─┬ @isaacs/cliui@8.0.2
│ │     │ │ ├─┬ string-width-cjs@npm:string-width@4.2.3
│ │     │ │ │ ├── emoji-regex@8.0.0
│ │     │ │ │ ├── is-fullwidth-code-point@3.0.0
│ │     │ │ │ └─┬ strip-ansi@6.0.1
│ │     │ │ │   └── ansi-regex@5.0.1
│ │     │ │ ├─┬ string-width@5.1.2
│ │     │ │ │ ├── eastasianwidth@0.2.0
│ │     │ │ │ ├── emoji-regex@9.2.2
│ │     │ │ │ └── strip-ansi@7.1.0 deduped
│ │     │ │ ├─┬ strip-ansi-cjs@npm:strip-ansi@6.0.1
│ │     │ │ │ └── ansi-regex@5.0.1
│ │     │ │ ├─┬ strip-ansi@7.1.0
│ │     │ │ │ └── ansi-regex@6.1.0
│ │     │ │ ├─┬ wrap-ansi-cjs@npm:wrap-ansi@7.0.0
│ │     │ │ │ ├─┬ ansi-styles@4.3.0
│ │     │ │ │ │ └─┬ color-convert@2.0.1
│ │     │ │ │ │   └── color-name@1.1.4
│ │     │ │ │ ├─┬ string-width@4.2.3
│ │     │ │ │ │ ├── emoji-regex@8.0.0
│ │     │ │ │ │ ├── is-fullwidth-code-point@3.0.0 deduped
│ │     │ │ │ │ └── strip-ansi@6.0.1 deduped
│ │     │ │ │ └─┬ strip-ansi@6.0.1
│ │     │ │ │   └── ansi-regex@5.0.1
│ │     │ │ └─┬ wrap-ansi@8.1.0
│ │     │ │   ├── ansi-styles@6.2.1
│ │     │ │   ├── string-width@5.1.2 deduped
│ │     │ │   └── strip-ansi@7.1.0 deduped
│ │     │ └── @pkgjs/parseargs@0.11.0
│ │     ├─┬ minimatch@9.0.5
│ │     │ └─┬ brace-expansion@2.0.1
│ │     │   └── balanced-match@1.0.2 deduped
│ │     ├── minipass@7.1.2 deduped
│ │     ├── package-json-from-dist@1.0.1
│ │     └─┬ path-scurry@1.11.1
│ │       ├── lru-cache@10.4.3
│ │       └── minipass@7.1.2 deduped
│ ├── mkdirp@3.0.1
│ └── yallist@5.0.0
```

`tar-fs` dep tree:

```
├─┬ tar-fs@3.0.6
│ ├─┬ bare-fs@2.3.5
│ │ ├── bare-events@2.5.0
│ │ ├── bare-path@2.1.3 deduped
│ │ └─┬ bare-stream@2.4.2
│ │   └── streamx@2.20.2 deduped
│ ├─┬ bare-path@2.1.3
│ │ └── bare-os@2.4.4
│ ├─┬ pump@3.0.0
│ │ ├─┬ end-of-stream@1.4.4
│ │ │ └── once@1.4.0 deduped
│ │ └── once@1.4.0 deduped
│ └─┬ tar-stream@3.1.7
│   ├── b4a@1.6.7
│   ├── fast-fifo@1.3.2
│   └─┬ streamx@2.20.2
│     ├── bare-events@2.5.0 deduped
│     ├── fast-fifo@1.3.2 deduped
│     ├── queue-tick@1.0.1
│     └── text-decoder@1.2.1
```