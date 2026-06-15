import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { probePort, getCurrentBranch } from './utils';

export interface SlotInfo {
  id: string;
  metroPort: number | null;
  healthy: boolean;
  createdAt: string;
}

export async function listSlots(): Promise<SlotInfo[]> {
  try {
    const registryDir = process.env.WF_REGISTRY_DIR
      ? path.resolve(process.env.WF_REGISTRY_DIR)
      : path.resolve(os.homedir(), '.local/state/wf-registry');
    const registryPath = path.join(registryDir, 'registry.json');

    const currentBranch = process.env.WF_BRANCH ?? await getCurrentBranch();
    if (!currentBranch) return []; // not in a git repo (or detached HEAD)

    const raw = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(raw) as {
      slots?: Record<string, { metro_claims?: { metroPort?: number }; createdAt?: string }>;
    };

    const slots: SlotInfo[] = [];

    for (const [id, data] of Object.entries(registry.slots ?? {})) {
      // Slot IDs are `{git-branch}/{slot-name}`. The branch itself may
      // contain `/` (e.g. `claude/feature/foo`), so we must split on the
      // LAST `/`, not the first.
      const lastSlash = id.lastIndexOf('/');
      const slotBranch = lastSlash >= 0 ? id.slice(0, lastSlash) : id;
      if (slotBranch.toLowerCase() !== currentBranch.toLowerCase()) continue;

      const metroPort = data.metro_claims?.metroPort ?? null;
      const healthy = metroPort != null ? await probePort(metroPort) : false;

      slots.push({
        id,
        metroPort,
        healthy,
        createdAt: data.createdAt ?? '',
      });
    }

    return slots;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.error('[multiSlotTools] registry read failed:', err);
    }
    return [];
  }
}
