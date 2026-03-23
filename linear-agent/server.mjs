import { loadConfig, startWebhookServer } from './app.mjs';

const config = loadConfig();
const server = await startWebhookServer(config);

console.log(
  JSON.stringify(
    {
      message: 'Linear webhook server listening',
      port: config.port,
      dryRun: config.dryRun,
      runtimeDir: config.runtimeDir,
    },
    null,
    2,
  ),
);

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
