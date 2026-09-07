/**
 * PiyushDhara MathBoard — Clean Launcher
 * Spawns Electron and filters SSL noise from terminal.
 */

const { spawn } = require('child_process');
const path      = require('path');

// ── Find Electron binary (works on Windows, Mac, Linux) ──
const electronPath = path.join(
  __dirname, 'node_modules', '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

// SSL/Chromium noise to suppress
const NOISE = [
  'ssl_client_socket', 'handshake failed', 'SSL error',
  'net_error', ':ERROR:', 'ERR_CERT', 'ERR_SSL',
];

function isNoise(line) {
  return NOISE.some(p => line.includes(p));
}

console.log('Starting PiyushDhara MathBoard...');

const child = spawn(electronPath, ['.'], {
  cwd:   __dirname,
  stdio: ['inherit', 'inherit', 'pipe'],
  shell: false,
});

child.stderr.on('data', (data) => {
  data.toString().split('\n').forEach(line => {
    if (line.trim() && !isNoise(line)) process.stderr.write(line + '\n');
  });
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err.message);
  console.log('Trying fallback...');
  // Fallback: use npx
  const fallback = spawn('npx', ['electron', '.'], {
    cwd: __dirname, stdio: 'inherit', shell: true
  });
  fallback.on('exit', code => process.exit(code || 0));
});

child.on('exit', (code) => process.exit(code || 0));

process.on('SIGINT',  () => child.kill());
process.on('SIGTERM', () => child.kill());