declare module '@playwright-core/utils' {
  const content: typeof import('../packages/playwright-core/src/utils');
  export = content;
}

declare module '@playwright-core/utilsBundle' {
  const content: typeof import('../packages/playwright-core/src/utilsBundle');
  export = content;
}

declare module '@playwright-core/common/socksProxy' {
  const content: typeof import('../packages/playwright-core/src/common/socksProxy');
  export = content;
}

declare module '@playwright-core/utils/isomorphic/traceUtils' {
  const content: typeof import('../packages/playwright-core/src/utils/isomorphic/traceUtils');
  export = content;
}

declare module '@playwright-core/utils/isomorphic/locatorGenerators' {
  const content: typeof import('../packages/playwright-core/src/utils/isomorphic/locatorGenerators');
  export = content;
}

declare module '@playwright-core/utils/isomorphic/locatorParser' {
  const content: typeof import('../packages/playwright-core/src/utils/isomorphic/locatorParser');
  export = content;
}

declare module '@playwright-core/utils/isomorphic/cssParser' {
  const content: typeof import('../packages/playwright-core/src/utils/isomorphic/cssParser');
  export = content;
}

declare module '@playwright-core/utils/isomorphic/selectorParser' {
  const content: typeof import('../packages/playwright-core/src/utils/isomorphic/selectorParser');
  export = content;
}