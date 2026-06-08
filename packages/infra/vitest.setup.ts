import { vi } from 'vitest';

vi.stubGlobal('$app', {
  stage: 'prod',
  name: 'serverlessclaw',
  region: 'ap-southeast-2',
});
