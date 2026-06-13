import { vi } from 'vitest';

vi.stubGlobal('$app', {
  stage: 'dev',
  name: 'serverlessclaw',
});
