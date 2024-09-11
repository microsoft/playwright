const packagesToBeIgnored = [
  "@types/codemirror",
  "@types/formidable",
  "@types/immutable",
  "@types/ws",
  "@types/xml2js",
  "@typescript-eslint/utils",
  "@vitejs/plugin-basic-ssl",
  "ansi-styles",
  "colors",
  "dotenv",
  "esbuild",
  "eslint-plugin-internal-playwright",
  "formidable",
  "immutable",
  "license-checker",
  "mime",
  "ssim.js",
  "ws",
  "xml2js",
  "@playwright/test",
];

const binariesToBeIgnored = ["playwright"];

const config = {
  workspaces: {
    ".": {
      //   entry: [""],
      ignore: [
        "packages/**/*",
        "utils/**/*",
        ".github/**/*",
        "tests/**/*",
        "examples/**/*",
        "browser_patches/**/*",
      ],
      ignoreDependencies: packagesToBeIgnored,
      ignoreBinaries: binariesToBeIgnored,
    },
  },
};

export default config;
