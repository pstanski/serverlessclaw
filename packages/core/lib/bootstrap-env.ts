import fs from 'fs';
import path from 'path';

// CRITICAL: SST Proxy Hardening (Module-load time)
// Unset SST_KEY_FILE if the encrypted map is missing, or resolve it to an absolute path.
// This prevents 'ENOENT: resource.enc' crashes when process.chdir() changes CWD to /tmp.
if (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.SST_KEY_FILE) {
  const resourcePath = path.resolve(process.cwd(), process.env.SST_KEY_FILE);
  if (fs.existsSync(resourcePath)) {
    // Convert to absolute path so it survives process.chdir()
    process.env.SST_KEY_FILE = resourcePath;
  } else {
    // Purge if missing
    delete process.env.SST_KEY_FILE;
  }
}
