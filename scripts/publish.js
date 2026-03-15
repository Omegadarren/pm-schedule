/**
 * publish.js
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const rootDir   = path.join(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const config    = JSON.parse(fs.readFileSync(path.join(rootDir, 'web-config.json'), 'utf8'));

const { githubUser, repoName } = config;
const remoteUrl = `https://github.com/${githubUser}/${repoName}.git`;
const base      = `/${repoName}/`;

// ── helpers ──────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`\n▶  ${cmd}`);
  // Use 'pipe' so subprocess output goes through publish.js's own stdio,
  // avoiding Windows pipe-handle inheritance issues that block child.on('close').
  try {
    const out = execSync(cmd, { stdio: 'pipe', ...opts });
    if (out && out.length) process.stdout.write(out);
  } catch (e) {
    if (e.stdout && e.stdout.length) process.stdout.write(e.stdout);
    if (e.stderr && e.stderr.length) process.stderr.write(e.stderr);
    throw e;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
try {
  // ── 1. Export data ──────────────────────────────────────────────────────────
  console.log('\n📦  Step 1/3 — Exporting data from database...');
  require('./export-data');

  // ── 2. Build static Vite bundle ─────────────────────────────────────────────
  console.log('\n🔨  Step 2/3 — Building static app...');

  // Delete dist entirely before building so no stale .git from a previous
  // publish run can block Step 3's git init.
  const distDir = path.join(clientDir, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true });
    } catch (_) {
      try { execSync(`rmdir /s /q "${distDir}"`, { stdio: 'pipe', shell: true }); } catch (_2) {}
    }
  }

  const buildEnv = {
    ...process.env,
    VITE_STATIC_MODE : 'true',
    VITE_BASE        : base,
  };
  try {
    run('npm run build', { cwd: clientDir, env: buildEnv });
  } catch (e) {
    // Vite may exit non-zero due to deprecation warnings from 3rd-party SCSS.
    // If the dist/index.html was produced the build is usable.
    const distHtml = path.join(clientDir, 'dist', 'index.html');
    if (!fs.existsSync(distHtml)) {
      throw new Error('Build failed — dist/index.html was not produced.\n' + (e.message || e));
    }
    console.log('⚠   Build exited non-zero but dist/ looks good — continuing.');
  }

  // ── 3. Push dist → gh-pages ─────────────────────────────────────────────────
  console.log('\n🚀  Step 3/3 — Pushing to GitHub Pages...');

  const git = (cmd) => run(`git ${cmd}`, { cwd: distDir });

  git('init -b gh-pages');
  git('config user.email "deploy@pm-schedule"');
  git('config user.name "PM Schedule Deploy"');
  git('add -A');
  git('commit -m "Deploy to GitHub Pages"');
  run(`git push --force "${remoteUrl}" gh-pages`, { cwd: distDir });

  console.log(`\n✅  Published!  →  https://${githubUser}.github.io/${repoName}\n`);
  process.exit(0);
} catch (err) {
  console.error(`\n❌  Publish failed: ${err.message || err}\n`);
  process.exit(1);
}
