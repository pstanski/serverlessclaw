const config = {
  buildCommand:
    'cd ../../../ && pnpm --filter @serverlessclaw/dashboard build && (cd framework/apps/dashboard/.next/standalone && [ -d framework/apps ] && [ ! -d apps ] && ln -s framework/apps apps || true)',
  default: {
    // Explicitly include runtime dependencies in the Lambda bundle.
    // This ensures SWC helper deep imports and Next runtime packages are present at runtime.
    install: {
      packages: ['@swc/helpers', 'next', 'react', 'react-dom'],
    },
  },
};

export default config;
