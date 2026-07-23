/**
 * Artifact management: versioning, history, diff, restore, full-text search,
 * lineage, access logging, and export. All calls go through the resilient
 * layer (retry/backoff + validation + friendly errors + audit trail).
 */

import pb from '@/lib/pocketbaseClient';
import { resilientCall, validate, checksum, audit } from '@/lib/pbResilient';

const uid = () => pb.authStore.record?.id;
const rk = (p) => ({ requestKey: `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}` });

export const ARTIFACT_TYPES = [
  'blueprint', 'audit', 'workflow', 'content', 'document', 'schema', 'report', 'export', 'other',
];

const ARTIFACT_SCHEMA = {
  title: { required: true, type: 'string', min: 1, max: 240, label: 'Title' },
  type: { required: false, values: ARTIFACT_TYPES },
};

async function logAccess(artifactId, action, detail = '') {
  const owner = uid();
  if (!owner) return;
  try {
    await pb.collection('artifact_access_log').create(
      { owner, artifact: artifactId, action, detail }, rk('artlog'),
    );
  } catch (_) { /* best-effort */ }
}

/** Create a new artifact + its v1 snapshot atomically-ish (with rollback). */
export async function createArtifact(input) {
  const { valid, errors } = validate(input, ARTIFACT_SCHEMA);
  if (!valid) return { ok: false, error: { category: 'validation', message: Object.values(errors)[0], fields: errors } };

  const owner = uid();
  const sum = checksum({ title: input.title, body: input.body, data: input.data });
  const payload = {
    owner,
    title: input.title,
    type: input.type || 'other',
    category: input.category || '',
    tags: input.tags || [],
    summary: input.summary || '',
    body: input.body || '',
    data: input.data || {},
    status: 'active',
    checksum: sum,
    current_version: 1,
    lineage: input.lineage || [],
    access_count: 0,
    deleted: false,
  };

  const res = await resilientCall(() => pb.collection('artifacts').create(payload, rk('art-create')));
  if (!res.ok) return res;
  const rec = res.data;

  // Version snapshot. If it fails, roll back the head record.
  const verRes = await resilientCall(() => pb.collection('artifact_versions').create({
    owner, artifact: rec.id, version: 1, title: rec.title, summary: rec.summary,
    body: rec.body, data: rec.data, tags: rec.tags, checksum: sum,
    change_note: input.change_note || 'Initial version', author: pb.authStore.record?.name || pb.authStore.record?.email || '',
  }, rk('ver-create')));
  if (!verRes.ok) {
    await resilientCall(() => pb.collection('artifacts').delete(rec.id, rk('art-rollback')));
    return verRes;
  }

  await logAccess(rec.id, 'create', `v1 · ${rec.title}`);
  await audit('artifact.create', 'artifact', rec.id, { title: rec.title, type: rec.type });
  return { ok: true, data: rec };
}

/** Update an artifact -> bumps version and appends a snapshot. */
export async function updateArtifact(id, changes, changeNote = '') {
  const cur = await resilientCall(() => pb.collection('artifacts').getOne(id, rk('art-cur')));
  if (!cur.ok) return cur;
  const head = cur.data;
  const next = { ...head, ...changes };
  const version = (head.current_version || 1) + 1;
  const sum = checksum({ title: next.title, body: next.body, data: next.data });

  const res = await resilientCall(() => pb.collection('artifacts').update(id, {
    title: next.title, type: next.type, category: next.category, tags: next.tags,
    summary: next.summary, body: next.body, data: next.data,
    checksum: sum, current_version: version,
  }, rk('art-update')));
  if (!res.ok) return res;

  await resilientCall(() => pb.collection('artifact_versions').create({
    owner: uid(), artifact: id, version, title: next.title, summary: next.summary,
    body: next.body, data: next.data, tags: next.tags, checksum: sum,
    change_note: changeNote || `Updated to v${version}`, author: pb.authStore.record?.name || pb.authStore.record?.email || '',
  }, rk('ver-create2')));

  await logAccess(id, 'update', `v${version} · ${changeNote || ''}`);
  await audit('artifact.update', 'artifact', id, { version });
  return res;
}

/** Restore an artifact to a prior version (creates a new forward version). */
export async function restoreVersion(artifactId, versionRecord) {
  const res = await updateArtifact(
    artifactId,
    {
      title: versionRecord.title,
      summary: versionRecord.summary,
      body: versionRecord.body,
      data: versionRecord.data,
      tags: versionRecord.tags,
    },
    `Restored from v${versionRecord.version}`,
  );
  if (res.ok) await logAccess(artifactId, 'restore', `restored v${versionRecord.version}`);
  return res;
}

export async function listArtifacts({ type = '', includeArchived = false } = {}) {
  const parts = [`owner = "${uid()}"`, 'deleted != true'];
  if (type) parts.push(`type = "${type}"`);
  if (!includeArchived) parts.push('status != "archived"');
  return resilientCall(() => pb.collection('artifacts').getFullList({
    sort: '-updated', filter: parts.join(' && '), ...rk('art-list'),
  }));
}

export async function getArtifact(id, { track = true } = {}) {
  const res = await resilientCall(() => pb.collection('artifacts').getOne(id, rk('art-one')));
  if (res.ok && track) {
    logAccess(id, 'view');
    resilientCall(() => pb.collection('artifacts').update(id, { access_count: (res.data.access_count || 0) + 1 }, rk('art-count')));
  }
  return res;
}

export async function versionHistory(artifactId) {
  return resilientCall(() => pb.collection('artifact_versions').getFullList({
    sort: '-version', filter: `artifact = "${artifactId}" && owner = "${uid()}"`, ...rk('ver-list'),
  }));
}

export async function accessLog(artifactId) {
  return resilientCall(() => pb.collection('artifact_access_log').getFullList({
    sort: '-created', filter: `artifact = "${artifactId}" && owner = "${uid()}"`, ...rk('log-list'),
  }));
}

export async function archiveArtifact(id) {
  const res = await resilientCall(() => pb.collection('artifacts').update(id, { status: 'archived' }, rk('art-arch')));
  if (res.ok) { await logAccess(id, 'archive'); await audit('artifact.archive', 'artifact', id); }
  return res;
}

export async function unarchiveArtifact(id) {
  return resilientCall(() => pb.collection('artifacts').update(id, { status: 'active' }, rk('art-unarch')));
}

export async function softDeleteArtifact(id) {
  const res = await resilientCall(() => pb.collection('artifacts').update(id, { deleted: true, status: 'archived' }, rk('art-del')));
  if (res.ok) { await logAccess(id, 'delete'); await audit('artifact.delete', 'artifact', id); }
  return res;
}

/**
 * Full-text search across artifacts (client-side ranked). Supports quotes,
 * AND (default), OR, and NOT (-term) operators.
 */
export function searchArtifacts(list, query) {
  if (!query || !query.trim()) return list;
  const raw = query.trim().toLowerCase();
  const phrases = [...raw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const rest = raw.replace(/"[^"]+"/g, ' ');
  const orMode = /\bor\b/.test(rest);
  const tokens = rest.split(/\s+/).filter(Boolean).filter((t) => t !== 'or' && t !== 'and');
  const negatives = tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1)).filter(Boolean);
  const positives = [...phrases, ...tokens.filter((t) => !t.startsWith('-'))];

  const scored = list.map((a) => {
    const hay = `${a.title} ${a.summary} ${a.category} ${(a.tags || []).join(' ')} ${a.body} ${a.type}`.toLowerCase();
    if (negatives.some((n) => hay.includes(n))) return { a, score: -1 };
    let score = 0;
    for (const p of positives) {
      if (!p) continue;
      if (hay.includes(p)) {
        score += 1;
        if (a.title.toLowerCase().includes(p)) score += 3;
        if ((a.tags || []).join(' ').toLowerCase().includes(p)) score += 2;
      }
    }
    const need = orMode ? positives.some((p) => hay.includes(p)) : positives.every((p) => hay.includes(p));
    return { a, score: need ? score : -1 };
  });
  return scored.filter((s) => s.score >= 0).sort((x, y) => y.score - x.score).map((s) => s.a);
}

/** Line-level diff between two text blobs. Returns [{type, text}]. */
export function diffLines(oldText = '', newText = '') {
  const a = String(oldText).split('\n');
  const b = String(newText).split('\n');
  const n = a.length; const m = b.length;
  // LCS table
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i += 1; j += 1; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i += 1; }
    else { out.push({ type: 'add', text: b[j] }); j += 1; }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i += 1; }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j += 1; }
  return out;
}

/** Export helpers. */
export function exportJSON(artifact, versions = []) {
  const blob = new Blob([JSON.stringify({ artifact, versions }, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${slug(artifact.title)}-history.json`);
}

export function exportCSV(versions = []) {
  const header = ['version', 'created', 'author', 'checksum', 'change_note', 'title'];
  const rows = versions.map((v) => header.map((h) => csvCell(v[h])).join(','));
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  triggerDownload(blob, 'artifact-history.csv');
}

/** Auto-generate a README/markdown doc from an artifact. */
export function generateReadme(artifact, versions = []) {
  const lines = [
    `# ${artifact.title}`,
    '',
    `- **Type:** ${artifact.type || 'other'}`,
    `- **Category:** ${artifact.category || '—'}`,
    `- **Status:** ${artifact.status || 'active'}`,
    `- **Current version:** v${artifact.current_version || 1}`,
    `- **Checksum:** \`${artifact.checksum || '—'}\``,
    `- **Tags:** ${(artifact.tags || []).join(', ') || '—'}`,
    `- **Created:** ${artifact.created}`,
    `- **Last updated:** ${artifact.updated}`,
    '',
    '## Summary',
    '',
    artifact.summary || '_No summary._',
    '',
    '## Content',
    '',
    artifact.body || '_No content._',
    '',
    '## Version history',
    '',
    ...versions.map((v) => `- **v${v.version}** — ${v.change_note || ''} (${new Date(v.created).toLocaleString()})`),
  ];
  return lines.join('\n');
}

function slug(s = '') { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artifact'; }
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export default {
  createArtifact, updateArtifact, restoreVersion, listArtifacts, getArtifact,
  versionHistory, accessLog, archiveArtifact, unarchiveArtifact, softDeleteArtifact,
  searchArtifacts, diffLines, exportJSON, exportCSV, generateReadme, ARTIFACT_TYPES,
};
