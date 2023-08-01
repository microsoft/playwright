const MIN_API_VERSION = 1;

export class PatchSupport {
  private _enabled: boolean | undefined;

  static instance(): PatchSupport {
    return gInstance;
  }

  async initialize() {
    if (this._enabled !== undefined)
      return;
    try {
      const version = await fetch('/api/version').then(response => response.text()).then(text => JSON.parse(text)).catch(e => {
        console.error('Failed to get backend version');
        return undefined;
      });
      console.log('initialzed patch support');
      this._enabled = version !== undefined && version >= MIN_API_VERSION;
    } catch (e) {
      console.error(e);
      this._enabled = false;
    }
  }

  isEnabled() {
    return this._enabled;
  }

  async patchImage(actualPath: string, snapshotPath: string) {
    if (!this._enabled)
      throw new Error('patch support is not available!');
    try {
      const response = await fetch('/api/patch_image', {
        method: 'POST',
        body: JSON.stringify({ actualPath, snapshotPath }),
      });
      return response.status === 200;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

const gInstance = new PatchSupport();

