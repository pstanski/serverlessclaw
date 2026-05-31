import * as ext from '/Users/pengcao/projects/goldex/apps/goldex-dashboard/index';
export const init = ext.init;
const extServer = ext as { initServer?: () => void };
export const initServer = extServer.initServer ?? (() => {});
