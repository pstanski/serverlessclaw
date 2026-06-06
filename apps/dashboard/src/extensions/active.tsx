'use client';

import * as ext from '/Users/pengcao/projects/voltx/packages/voltx-ui/src/index';
export const init = ext.init;
export const initServer = (ext as { initServer?: () => void }).initServer;
