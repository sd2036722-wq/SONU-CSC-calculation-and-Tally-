import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Check if tsx loader is active or already bootstrapped
const isTsx = process.execArgv.some(arg => arg.includes('tsx')) || process.env.__TSX_BOOTSTRAPPED__ === '1';

if (!isTsx) {
  // Spawns node with --import tsx to natively support TypeScript and extensionless/directory imports
  const currentFile = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, ['--import', 'tsx', currentFile, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, __TSX_BOOTSTRAPPED__: '1' },
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    try {
      child.kill(signal);
    } catch {}
  };

  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  process.on('SIGINT', () => forwardSignal('SIGINT'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
} else {
  // TSX loader is active; load and run full Express server
  const { startServer } = await import('./src/server/app');
  startServer();
}
