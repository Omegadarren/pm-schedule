/**
 * publish.js
 */

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const os           = require('os');

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
  console.log('\n📦  Step 1/4 — Exporting data from database...');
  require('./export-data');

  // ── 2. Build static Vite bundle ─────────────────────────────────────────────
  console.log('\n🔨  Step 2/4 — Building static app...');

  const distDir  = path.join(clientDir, 'dist');

  // Manually wipe dist/ before the build so stale assets don't accumulate.
  // We do this ourselves (instead of Vite's emptyOutDir) to avoid Windows
  // EBUSY errors on locked files.  Any file that can't be removed is skipped —
  // Vite will overwrite the important ones and we copy the whole dir to a
  // temp folder for the git push anyway.
  if (fs.existsSync(distDir)) {
    try {
      const entries = fs.readdirSync(distDir);
      for (const entry of entries) {
        try {
          fs.rmSync(path.join(distDir, entry), { recursive: true, force: true });
        } catch (_) { /* skip locked files */ }
      }
    } catch (_) { /* skip if dist itself can't be read */ }
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
    // If dist/index.html was produced the build is usable.
    const distHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(distHtml)) {
      throw new Error('Build failed — dist/index.html was not produced.\n' + (e.message || e));
    }
    console.log('⚠   Build exited non-zero but dist/ looks good — continuing.');
  }

  // ── 3. Generate per-project client share pages ─────────────────────────────
  console.log('\n🔗  Step 3/4 — Generating client share pages...');
  const webDataPath = path.join(distDir, 'web-data.json');
  let shareCount = 0;
  if (fs.existsSync(webDataPath)) {
    const webData = JSON.parse(fs.readFileSync(webDataPath, 'utf8'));
    const distIndexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    for (const project of (webData.projects || [])) {
      if (!project.share_token) continue;
      const token = project.share_token;
      const projectTasks     = (webData.tasks     || {})[project.id] ?? [];
      const projectResources = (webData.resources || {})[project.id] ?? [];
      // Omit share_token from what the customer receives — unnecessary and cleaner
      const { share_token: _tok, ...safeProject } = project;
      const sharePayload = JSON.stringify({
        project:    safeProject,
        tasks:      projectTasks,
        resources:  projectResources,
        exportedAt: webData.exportedAt,
      });
      // Inject the data as an inline script before </head>
      const injectedHtml = distIndexHtml.replace(
        '</head>',
        `  <script>window.__PROJECT_SHARE__=${sharePayload};</script>\n</head>`
      );
      const shareDir = path.join(distDir, 'projects', token);
      fs.mkdirSync(shareDir, { recursive: true });
      fs.writeFileSync(path.join(shareDir, 'index.html'), injectedHtml, 'utf8');
      console.log(`  📎  ${project.name}  →  /projects/${token}/`);
      shareCount++;
    }
  }
  if (shareCount === 0) {
    console.log('  ℹ️   No share links yet — use "🔗 Share Link" in the app to create one, then publish again.');
  } else {
    console.log(`\n  Generated ${shareCount} client share page(s).`);
  }

  // ── 4. Push dist → gh-pages ─────────────────────────────────────────────────
  // Copy dist into a fresh OS temp dir so there is NEVER a stale .git folder.
  // This sidesteps Windows file-locking issues entirely.
  console.log('\n🚀  Step 4/4 — Pushing to GitHub Pages...');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-deploy-'));
  try {
    fs.cpSync(distDir, tmpDir, { recursive: true });

    // Nuke any .git that may have been copied in or left from a prior run.
    const gitDir = path.join(tmpDir, '.git');
    if (fs.existsSync(gitDir)) {
      try { fs.rmSync(gitDir, { recursive: true, force: true }); } catch (_) {}
    }

    const git = (cmd) => run(`git ${cmd}`, { cwd: tmpDir });

    git('init -b gh-pages');
    git('config user.email "deploy@pm-schedule"');
    git('config user.name "PM Schedule Deploy"');
    git(`remote add origin "${remoteUrl}"`);

    // Fetch the current remote gh-pages so git knows its true SHA.
    // This prevents the "expected X but got Y" ref-lock rejection on push.
    // Ignore errors — the branch may not exist yet on a first deploy.
    try { git('fetch --depth=1 origin gh-pages'); } catch (_) {}

    git('add -A');
    git('commit -m "Deploy to GitHub Pages"');

    // Retry push up to 3 times to handle transient GitHub ref-lock races.
    let pushed = false;
    for (let attempt = 1; attempt <= 3 && !pushed; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`\n⏳  Retrying push (attempt ${attempt}/3)...`);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
        }
        git('push --force origin gh-pages');
        pushed = true;
      } catch (pushErr) {
        if (attempt === 3) throw pushErr;
      }
    }
  } finally {
    // Best-effort cleanup of the temp dir — ignore errors.
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }

  console.log(`\n✅  Published!  →  https://${githubUser}.github.io/${repoName}\n`);
  process.exit(0);
} catch (err) {
  console.error(`\n❌  Publish failed: ${err.message || err}\n`);
  process.exit(1);
}
