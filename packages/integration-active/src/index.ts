export * from '@voltx/ui';

import { PluginManager } from '@serverlessclaw/core/lib/plugin-manager';
import { VppPlugin } from '@voltx/core/src/vpp/plugin';

export const initServer = async () => {
  await PluginManager.register(VppPlugin);
};
