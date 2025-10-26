#!/usr/bin/env node
/*
 Sync docs and logs:
 - Ensure /LOGS and its files exist
 - Append a timestamped entry to /LOGS/UPDATES.log
 - Ensure CHANGELOG.md and COMMENTS.md are present
 - Stamp AGENTS.md with a "Last Synced" timestamp near the top
*/

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ensureFile(p, content) {
  if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8');
}

function appendUpdate(logPath, message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

function stampAgents(agentsPath) {
  if (!fs.existsSync(agentsPath)) return false;
  const ts = new Date().toISOString();
  let text = fs.readFileSync(agentsPath, 'utf8');

  const marker = 'Last Synced:';
  const headerIdx = text.indexOf('# ');

  const lines = text.split(/\r?\n/);
  const existingIdx = lines.findIndex(l => l.startsWith(marker));
  if (existingIdx >= 0) {
    lines[existingIdx] = `${marker} ${ts}`;
  } else {
    // Insert after the first heading line if present, else at top
    let insertAt = 0;
    if (lines.length > 0 && lines[0].startsWith('#')) {
      insertAt = 1;
    }
    lines.splice(insertAt, 0, `${marker} ${ts}`);
  }

  // Ensure change policy emphasis exists
  const policyHeader = '## Change Discipline';
  if (!text.includes(policyHeader)) {
    const overviewIdx = lines.findIndex(l => l.trim() === '## Overview');
    const policyBlock = [
      '## Change Discipline',
      '- Always update both `AGENTS.md` and `/LOGS/UPDATES.log` for every change.',
      '- Use `npm run sync:docs` to stamp and log changes quickly.',
      '- Significant decisions go to `/LOGS/COMMENTS.md`; features to `CHANGELOG.md`.',
      ''
    ];
    const insertPos = overviewIdx >= 0 ? overviewIdx : lines.length;
    lines.splice(insertPos, 0, ...policyBlock);
  }

  fs.writeFileSync(agentsPath, lines.join('\n'), 'utf8');
  return true;
}

function main() {
  const root = process.cwd();
  const logsDir = path.join(root, 'LOGS');
  const updatesPath = path.join(logsDir, 'UPDATES.log');
  const changelogPath = path.join(logsDir, 'CHANGELOG.md');
  const commentsPath = path.join(logsDir, 'COMMENTS.md');
  const readmePath = path.join(logsDir, 'README.md');
  const agentsPath = path.join(root, 'AGENTS.md');

  ensureDir(logsDir);
  ensureFile(readmePath, '# LOGS\n\nThis folder tracks updates, decisions, and release notes.\n');
  ensureFile(changelogPath, '# Changelog\n\n## Unreleased\n- Initial entries.\n');
  ensureFile(commentsPath, '# Comments\n\nKey decisions and rationale.\n');
  ensureFile(updatesPath, '');

  const stamped = stampAgents(agentsPath);
  appendUpdate(updatesPath, stamped ? 'Sync docs: stamped AGENTS.md' : 'Sync docs: AGENTS.md missing');

  console.log('Docs synced. LOGS updated.');
}

main();

