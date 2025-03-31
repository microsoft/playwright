export class ReusedBrowser {
  private options: { wsEndpoint: string, cleanup: () => void, onClose: () => void };

  constructor(options: { wsEndpoint: string, cleanup: () => void, onClose: () => void }) {
    this.options = options;
  }
  
  async _checkVersion() {
    throw new Error('Version mismatch: expected v1.2.3, got v2.0.0');
  }

  async inspect() {
    try {
      await this._checkVersion();
    } catch (error) {
      this.options.cleanup();
      throw error;
    }
  }
} 