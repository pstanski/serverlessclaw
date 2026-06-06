'use client';

import * as ext from 'integration-active';
export const init = ext.init;
export const initServer = (ext as { initServer?: () => void }).initServer;
