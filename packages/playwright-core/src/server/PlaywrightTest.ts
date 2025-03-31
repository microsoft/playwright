export class PlaywrightTest {
  private _filesPendingListTests = new Map<string, Promise<void>>();
  private _listTestsTimer: NodeJS.Timeout | null = null;
  private _listTestsDelay = 250; // ms

  constructor(options: { workspaceRoot: string, childProcess: { spawn: Function } }) {
    this.options = options;
  }

  async queueTestFileForList(file: string): Promise<void> {
    if (!this._filesPendingListTests.has(file)) {
      const promise = new Promise<void>((resolve) => {
        if (!this._listTestsTimer) {
          this._listTestsTimer = setTimeout(() => {
            this._listTestsTimer = null;
            // Process all pending files
            const files = Array.from(this._filesPendingListTests.keys());
            this._filesPendingListTests.clear();
            // Call listTests with all files
            this.listTests(files);
            // Resolve all promises
            files.forEach(f => this._filesPendingListTests.get(f)?.resolve());
          }, this._listTestsDelay);
        }
        this._filesPendingListTests.set(file, { resolve });
      });
      this._filesPendingListTests.set(file, promise);
    }
    return this._filesPendingListTests.get(file)!;
  }

  async listTests(files?: string[]) {
    throw new Error('Failed to parse test list output: Unexpected end of JSON input');
  }
} 