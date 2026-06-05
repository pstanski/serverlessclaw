import './bootstrap-env';
import { logger } from './logger';

let initialized = false;

/**
 * Framework-level bootstrap hook.
 * Dynamically attempts to load domain-specific extensions (like Product).
 */
export async function bootstrap() {
  if (initialized) return;

  // CRITICAL: SST Proxy Hardening
  // Unset SST_KEY_FILE if we are running in Lambda and the encrypted map is missing.
  // This prevents 'ENOENT: resource.enc' crashes when hitting the Resource proxy.
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.SST_KEY_FILE) {
    const fs = await import('fs');
    const path = await import('path');
    const resourcePath = path.resolve(process.cwd(), process.env.SST_KEY_FILE);
    if (!fs.existsSync(resourcePath)) {
      logger.info(
        `[Bootstrap] Purging SST_KEY_FILE environment variable (resource map not found at ${resourcePath}).`
      );
      delete process.env.SST_KEY_FILE;
    }
  }

  try {
    // Attempt to load domain-specific extensions
    // We use a dynamic import with a variable to bypass Vite static analysis
    // and keep the core framework decoupled from private logic
    const domainName = '@product/core';
    const domain = await import(domainName);
    if (domain && typeof domain.bootstrap === 'function') {
      domain.bootstrap();
      logger.info('[Bootstrap] Domain extensions activated.');
    }
  } catch {
    // Graceful fallback if no domain extension is present
    logger.debug('[Bootstrap] No domain extensions found or failed to load.');
  }

  initialized = true;
}
