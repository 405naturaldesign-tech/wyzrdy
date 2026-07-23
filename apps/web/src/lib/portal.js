import pb from '@/lib/pocketbaseClient';

const uid = () => pb.authStore.record?.id;
const rk = (p) => ({ requestKey: `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}` });

export const portal = {
  // ---- Workflows ----
  listWorkflows: (filter = '') =>
    pb.collection('workflows').getFullList({
      sort: '-updated',
      filter: [`owner = "${uid()}"`, 'deleted != true', filter].filter(Boolean).join(' && '),
      ...rk('wf-list'),
    }),
  getWorkflow: (id) => pb.collection('workflows').getOne(id, rk('wf-get')),
  createWorkflow: async (data) => {
    const rec = await pb.collection('workflows').create({ owner: uid(), status: 'draft', version: 1, ...data }, rk('wf-create'));
    await pb.collection('workflow_history').create({ owner: uid(), workflow: rec.id, version: 1, data: rec.workflow_data || {} }, rk('wfh'));
    return rec;
  },
  updateWorkflow: async (id, data) => {
    const cur = await pb.collection('workflows').getOne(id, rk('wf-cur'));
    const nextVersion = (cur.version || 1) + 1;
    const rec = await pb.collection('workflows').update(id, { ...data, version: nextVersion }, rk('wf-update'));
    await pb.collection('workflow_history').create({ owner: uid(), workflow: id, version: nextVersion, data: rec.workflow_data || {} }, rk('wfh2'));
    return rec;
  },
  deleteWorkflow: (id) => pb.collection('workflows').update(id, { deleted: true, status: 'archived' }, rk('wf-del')),
  workflowHistory: (id) =>
    pb.collection('workflow_history').getFullList({ sort: '-version', filter: `workflow = "${id}" && owner = "${uid()}"`, ...rk('wfh-list') }),

  // ---- Conversations ----
  listConversations: () =>
    pb.collection('conversations').getFullList({ sort: '-updated', filter: `owner = "${uid()}" && deleted != true`, ...rk('cv-list') }),
  createConversation: (data) => pb.collection('conversations').create({ owner: uid(), ...data }, rk('cv-create')),
  getMessages: (conversationId) =>
    pb.collection('messages').getFullList({ sort: 'created', filter: `conversation = "${conversationId}" && owner = "${uid()}"`, ...rk('msg-list') }),
  addMessage: async (conversationId, role, content) => {
    const rec = await pb.collection('messages').create({ owner: uid(), conversation: conversationId, role, content }, rk('msg-add'));
    await pb.collection('conversations').update(conversationId, { updated: new Date().toISOString() }, rk('cv-touch')).catch(() => {});
    return rec;
  },

  // ---- Projects ----
  listProjects: () =>
    pb.collection('projects').getFullList({ sort: '-updated', filter: `owner = "${uid()}" && deleted != true`, ...rk('pj-list') }),
  createProject: (data) => pb.collection('projects').create({ owner: uid(), status: 'active', ...data }, rk('pj-create')),
  deleteProject: (id) => pb.collection('projects').update(id, { deleted: true }, rk('pj-del')),

  // ---- Assets ----
  listAssets: () =>
    pb.collection('assets').getFullList({ sort: '-created', filter: `owner = "${uid()}" && deleted != true`, ...rk('as-list') }),
  createAsset: (data) => pb.collection('assets').create({ owner: uid(), ...data }, rk('as-create')),

  // ---- Activity ----
  logActivity: (action, resource_type = '', resource_id = '', meta = {}) =>
    pb.collection('activity_log').create({ owner: uid(), action, resource_type, resource_id, meta }, rk('ac-log')),
  listActivity: (page = 1, perPage = 30) =>
    pb.collection('activity_log').getList(page, perPage, { sort: '-created', filter: `owner = "${uid()}"`, ...rk('ac-list') }),

  // ---- Analytics ----
  analytics: async () => {
    const [wf, cv, pj, as, ac] = await Promise.all([
      pb.collection('workflows').getList(1, 1, { filter: `owner = "${uid()}" && deleted != true`, ...rk('an-wf') }),
      pb.collection('conversations').getList(1, 1, { filter: `owner = "${uid()}" && deleted != true`, ...rk('an-cv') }),
      pb.collection('projects').getList(1, 1, { filter: `owner = "${uid()}" && deleted != true`, ...rk('an-pj') }),
      pb.collection('assets').getList(1, 1, { filter: `owner = "${uid()}" && deleted != true`, ...rk('an-as') }),
      pb.collection('activity_log').getList(1, 1, { filter: `owner = "${uid()}"`, ...rk('an-ac') }),
    ]);
    return {
      workflows: wf.totalItems,
      conversations: cv.totalItems,
      projects: pj.totalItems,
      assets: as.totalItems,
      activity: ac.totalItems,
    };
  },

  // ---- Referrals ----
  referralStats: async () => {
    const list = await pb.collection('referrals').getFullList({
      sort: '-created',
      filter: `referrer_id = "${uid()}"`,
      ...rk('ref-list'),
    }).catch(() => []);
    const clicks = list.filter((r) => r.event === 'click').length;
    const signups = list.filter((r) => r.event === 'signup').length;
    const conversions = list.filter((r) => r.event === 'conversion' || r.conversion_status === 'converted').length;
    return { total: list.length, clicks, signups, conversions, recent: list.slice(0, 8) };
  },

  // ---- Payments / Invoices ----
  listPayments: () =>
    pb.collection('payments').getFullList({ sort: '-created', filter: `owner = "${uid()}"`, ...rk('pay-list') }).catch(() => []),
  listInvoices: () =>
    pb.collection('invoices').getFullList({ sort: '-created', filter: `owner = "${uid()}"`, ...rk('inv-list') }).catch(() => []),

  // ---- Export ----
  exportData: async () => {
    const [profile, workflows, conversations, projects, assets, activity] = await Promise.all([
      pb.collection('users').getOne(uid(), rk('ex-u')),
      portal.listWorkflows(),
      portal.listConversations(),
      portal.listProjects(),
      portal.listAssets(),
      pb.collection('activity_log').getFullList({ sort: '-created', filter: `owner = "${uid()}"`, ...rk('ex-ac') }),
    ]);
    return { exported_at: new Date().toISOString(), profile, workflows, conversations, projects, assets, activity };
  },
};

export default portal;
