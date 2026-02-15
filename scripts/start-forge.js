const { spawnSync } = require('child_process');

const env = { ...process.env };
// Signal to forge.config.ts that we're in dev/start mode (not package/make)
// This skips FusesPlugin which conflicts with WebpackPlugin on Windows
env.ELECTRON_FORGE_START = 'true';
if (process.platform === 'win32') {
  env.FORGE_SKIP_NATIVE_REBUILD = 'true';
}

const extraArgs = process.argv.slice(2);
const args = ['start'];
if (extraArgs.length > 0) {
  args.push('--', ...extraArgs);
}

const result = spawnSync('electron-forge', args, {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 0);
