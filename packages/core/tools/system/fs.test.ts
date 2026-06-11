import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { filesystem_search_files } from './fs';

describe('filesystem_search_files', () => {
  const testDir = path.join(process.cwd(), 'temp_test_dir');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.txt'), 'Hello World\nhello world\nHELLO WORLD');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should be case-sensitive by default', async () => {
    const result = await filesystem_search_files.execute({
      pattern: 'Hello',
      directory: 'temp_test_dir',
    });

    expect(result).toContain('temp_test_dir/test.txt:1: Hello World');
    expect(result).not.toContain('temp_test_dir/test.txt:2: hello world');
    expect(result).not.toContain('temp_test_dir/test.txt:3: HELLO WORLD');
  });

  it('should support case-insensitive search', async () => {
    const result = await filesystem_search_files.execute({
      pattern: 'hello',
      directory: 'temp_test_dir',
      caseInsensitive: true,
    });

    expect(result).toContain('temp_test_dir/test.txt:1: Hello World');
    expect(result).toContain('temp_test_dir/test.txt:2: hello world');
    expect(result).toContain('temp_test_dir/test.txt:3: HELLO WORLD');
  });

  it('should find exact matches when caseInsensitive is false', async () => {
    const result = await filesystem_search_files.execute({
      pattern: 'HELLO',
      directory: 'temp_test_dir',
      caseInsensitive: false,
    });

    expect(result).not.toContain('temp_test_dir/test.txt:1: Hello World');
    expect(result).not.toContain('temp_test_dir/test.txt:2: hello world');
    expect(result).toContain('temp_test_dir/test.txt:3: HELLO WORLD');
  });
});
