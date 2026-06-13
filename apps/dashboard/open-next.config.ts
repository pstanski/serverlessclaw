const config = {
  buildCommand: 'cd ../../ && pnpm --filter @serverlessclaw/dashboard build',
  default: {
    // Explicitly include runtime dependencies in the Lambda bundle.
    // This ensures SWC helper deep imports and Next runtime packages are present at runtime.
    install: {
      packages: ['@swc/helpers'],
    },
  },
};

export default config;
