import { getMemory } from '../packages/core/tools/knowledge/utils';
import { GapStatus } from '../packages/core/lib/types/agent';

async function main() {
  try {
    const memory = getMemory();
    const gaps = await memory.getAllGaps(GapStatus.OPEN);
    console.log(JSON.stringify(gaps, null, 2));
  } catch (error) {
    console.error('Error listing gaps:', error);
    process.exit(1);
  }
}

main();
