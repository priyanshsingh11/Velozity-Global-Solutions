/**
 * End-to-end verification of the behaviours the assessment grades:
 * API-level RBAC, role-filtered real-time delivery, missed-event catch-up,
 * notifications, presence, filters and the overdue background job.
 *
 * This drives the real HTTP + WebSocket surface - it is not a unit test and
 * deliberately uses no mocks, because the properties worth proving here
 * (a forged token is rejected, PM B never receives PM A's events) are only
 * meaningful against the real server.
 *
 * Usage:
 *   1. Start Postgres, apply the schema, and run `npm run seed`
 *   2. Start the API
 *   3. npm run verify                      # ~15s
 *      API_URL=http://localhost:5055 npm run verify
 *      RUN_CRON=1 npm run verify           # +3min, also exercises node-cron
 */
import { io } from 'socket.io-client';

const B = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
const PASSWORD = 'Password123!';
const RUN_CRON = process.env.RUN_CRON === '1';

let pass = 0;
let fail = 0;
const failures = [];

const ok = (cond, msg, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${msg}`);
  } else {
    fail++;
    failures.push(msg);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${msg} ${extra}`);
  }
};
const section = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = (t) => ({ Authorization: `Bearer ${t}` });

async function login(email) {
  const r = await fetch(`${B}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await r.json();
  return { status: r.status, body, setCookie: r.headers.getSetCookie?.() ?? [] };
}
async function get(path, token) {
  const r = await fetch(`${B}${path}`, { headers: H(token) });
  return { status: r.status, body: await r.json() };
}
async function send(method, path, token, payload) {
  const r = await fetch(`${B}${path}`, {
    method,
    headers: { ...H(token), 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return { status: r.status, body: await r.json() };
}

function connect(token, label) {
  const socket = io(B, { auth: { token }, transports: ['websocket'], reconnection: false });
  socket.events = {
    'task:updated': [],
    'activity:new': [],
    'notification:new': [],
    'presence:update': [],
  };
  for (const e of Object.keys(socket.events)) socket.on(e, (d) => socket.events[e].push(d));
  socket.reset = () => {
    for (const k of Object.keys(socket.events)) socket.events[k] = [];
  };
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error(`${label} connect timeout`)), 5000);
  });
}
const joinRoom = (socket, projectId) =>
  new Promise((resolve) => socket.emit('project:join', { projectId }, resolve));

// ---------------------------------------------------------------- preflight
try {
  const h = await fetch(`${B}/api/health`);
  if (!h.ok) throw new Error(`status ${h.status}`);
} catch (e) {
  console.error(`\nCannot reach the API at ${B} - start it first (npm run dev).\n${e.message}\n`);
  process.exit(1);
}
console.log(`Verifying ${B}`);

// ------------------------------------------------------------ authentication
section('Authentication');
const admin = await login('admin@velozity.com');
const pm1 = await login('pm1@velozity.com');
const pm2 = await login('pm2@velozity.com');
const dev1 = await login('dev1@velozity.com');
const dev2 = await login('dev2@velozity.com');

ok(admin.status === 200 && !!admin.body.data.accessToken, 'login returns an access token');
ok(admin.body.data.user.role === 'ADMIN', 'login returns the user role');

const cookie = admin.setCookie.find((c) => c.startsWith('refreshToken='));
ok(!!cookie, 'refresh token is set as a cookie');
ok(/HttpOnly/i.test(cookie), 'refresh cookie is HttpOnly');
ok(/SameSite=/i.test(cookie), 'refresh cookie sets SameSite');
const rawCookieValue = cookie.split('=')[1].split(';')[0];
ok(!JSON.stringify(admin.body).includes(rawCookieValue), 'refresh token is NOT in the response body');

const wrongPassword = await fetch(`${B}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@velozity.com', password: 'WrongPassword1' }),
});
ok(wrongPassword.status === 401, 'invalid credentials rejected with 401');

const rawCookie = cookie.split(';')[0];
const refreshed = await fetch(`${B}/api/auth/refresh`, { method: 'POST', headers: { Cookie: rawCookie } });
const refreshedBody = await refreshed.json();
ok(refreshed.status === 200 && !!refreshedBody.data.accessToken, 'refresh issues a new access token');
const rotated = refreshed.headers.getSetCookie().find((c) => c.startsWith('refreshToken='));
ok(rotated && rotated.split(';')[0] !== rawCookie, 'refresh token is rotated on use');
const replay = await fetch(`${B}/api/auth/refresh`, { method: 'POST', headers: { Cookie: rawCookie } });
ok(replay.status === 401, 'a rotated-out refresh token is revoked');

const A = admin.body.data.accessToken;
const P1 = pm1.body.data.accessToken;
const P2 = pm2.body.data.accessToken;
const D1 = dev1.body.data.accessToken;
const D2 = dev2.body.data.accessToken;

// A tampered role claim must not survive signature verification.
const [jwtHeader, jwtPayload, jwtSig] = D1.split('.');
const forgedPayload = JSON.parse(Buffer.from(jwtPayload, 'base64url').toString());
forgedPayload.role = 'ADMIN';
const forged = `${jwtHeader}.${Buffer.from(JSON.stringify(forgedPayload)).toString('base64url')}.${jwtSig}`;
ok((await get('/api/users', forged)).status === 401, 'forged ADMIN role claim rejected with 401');
ok((await get('/api/tasks', undefined)).status === 401, 'missing token rejected with 401');

// ---------------------------------------------------------------------- RBAC
section('API-level authorization');
const adminProjects = (await get('/api/projects', A)).body.data.projects;
const pm1Projects = (await get('/api/projects', P1)).body.data.projects;
const pm2Projects = (await get('/api/projects', P2)).body.data.projects;
const dev1Projects = (await get('/api/projects', D1)).body.data.projects;
const pm1ProjectId = pm1Projects[0].id;
const pm2ProjectId = pm2Projects[0].id;

ok(adminProjects.length >= 3, 'admin sees every project');
ok(pm1Projects.every((p) => p.createdById === pm1.body.data.user.id), 'PM sees only projects they created');
ok(!pm1Projects.some((p) => p.id === pm2ProjectId), "PM's list excludes another PM's project");

ok((await get(`/api/projects/${pm2ProjectId}`, P1)).status === 403, "PM direct API call to another PM's project -> 403");
ok((await send('PUT', `/api/projects/${pm2ProjectId}`, P1, { name: 'hijack' })).status === 403, "PM cannot edit another PM's project");
ok((await send('DELETE', `/api/projects/${pm2ProjectId}`, P1)).status === 403, "PM cannot delete another PM's project");

const dev1Id = dev1.body.data.user.id;
const dev1Tasks = (await get('/api/tasks', D1)).body.data.tasks;
const dev2Tasks = (await get('/api/tasks', D2)).body.data.tasks;
ok(dev1Tasks.length > 0 && dev1Tasks.every((t) => t.assignedDeveloperId === dev1Id), 'developer sees only their assigned tasks');
ok((await get(`/api/tasks/${dev2Tasks[0].id}`, D1)).status === 403, "developer direct call to another developer's task -> 403");
ok((await send('PATCH', `/api/tasks/${dev2Tasks[0].id}/status`, D1, { status: 'DONE' })).status === 403, "developer cannot update another developer's task");
ok((await send('POST', '/api/tasks', D1, { projectId: pm1ProjectId, title: 'no', description: 'no', dueDate: new Date().toISOString() })).status === 403, 'developer cannot create tasks');
ok((await get('/api/users', D1)).status === 403, 'developer cannot list users');
ok((await get('/api/clients', D1)).status === 403, 'developer cannot list clients');
ok((await send('POST', '/api/clients', P1, { name: 'X', email: 'x@x.com', company: 'X' })).status === 403, 'PM cannot create clients');

// A developer may open a project they work in, but must not see others' tasks through it.
const devProject = await get(`/api/projects/${dev1Projects[0].id}`, D1);
ok(devProject.status === 200, 'developer can open a project they are assigned in');
ok(devProject.body.data.project.tasks.every((t) => t.assignedDeveloperId === dev1Id), "project detail hides other developers' tasks");

ok((await get('/api/tasks/00000000-0000-0000-0000-000000000000', A)).status === 404, 'unknown task id -> 404');
ok((await get('/api/does-not-exist', A)).status === 404, 'unknown endpoint -> structured 404');

// ------------------------------------------------------------------- filters
section('Task filters (URL query parameters)');
ok((await get('/api/tasks?status=IN_PROGRESS', A)).body.data.tasks.every((t) => t.status === 'IN_PROGRESS'), 'status filter');
ok((await get('/api/tasks?priority=HIGH', A)).body.data.tasks.every((t) => t.priority === 'HIGH'), 'priority filter');
ok((await get('/api/tasks?dueFrom=2020-01-01&dueTo=2035-12-31', A)).body.data.tasks.length > 0, 'due-date range filter');
const composed = await get('/api/tasks?status=TODO&priority=CRITICAL&dueFrom=2020-01-01', A);
ok(composed.status === 200 && composed.body.data.tasks.every((t) => t.status === 'TODO' && t.priority === 'CRITICAL'), 'filters compose');
ok((await get('/api/tasks?status=BOGUS', A)).status === 400, 'invalid enum value rejected with 400');
ok((await get('/api/tasks?dueFrom=2026-12-01&dueTo=2026-01-01', A)).status === 400, 'dueFrom after dueTo rejected with 400');
ok((await get('/api/tasks?projectId=not-a-uuid', A)).status === 400, 'malformed projectId rejected with 400');

const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
let devSorted = true;
for (let i = 1; i < dev1Tasks.length; i++) {
  const prev = priorityOrder.indexOf(dev1Tasks[i - 1].priority);
  const cur = priorityOrder.indexOf(dev1Tasks[i].priority);
  if (prev > cur || (prev === cur && new Date(dev1Tasks[i - 1].dueDate) > new Date(dev1Tasks[i].dueDate))) {
    devSorted = false;
    break;
  }
}
ok(devSorted, 'developer tasks are sorted by priority then due date');

// ---------------------------------------------------------------- dashboards
section('Role-specific dashboards');
const dashAdmin = (await get('/api/dashboard', A)).body.data;
ok(dashAdmin.role === 'ADMIN' && typeof dashAdmin.totalProjects === 'number', 'admin dashboard: total projects');
ok(Object.keys(dashAdmin.tasksByStatus).join() === 'TODO,IN_PROGRESS,IN_REVIEW,DONE', 'admin dashboard: tasks by status');
ok(dashAdmin.overdueCount >= 2, `admin dashboard: at least 2 overdue tasks seeded (${dashAdmin.overdueCount})`);
ok('activeUsersOnline' in dashAdmin, 'admin dashboard: active users online');

const dashPm = (await get('/api/dashboard', P1)).body.data;
ok(dashPm.role === 'PM' && dashPm.projects.every((p) => p.createdById === pm1.body.data.user.id), 'PM dashboard: own projects only');
ok(!!dashPm.tasksByPriority && Array.isArray(dashPm.upcomingTasksThisWeek), 'PM dashboard: priority breakdown + due this week');

const dashDev = (await get('/api/dashboard', D1)).body.data;
ok(dashDev.role === 'DEVELOPER' && dashDev.tasks.every((t) => t.assignedDeveloperId === dev1Id), 'developer dashboard: assigned tasks only');

// ------------------------------------------------------- websocket handshake
section('WebSocket handshake authentication');
for (const [token, label] of [[undefined, 'anonymous'], ['not.a.real.token', 'invalid']]) {
  try {
    await connect(token, label);
    ok(false, `${label} socket rejected`);
  } catch (e) {
    ok(/Authentication error/.test(e.message), `${label} socket rejected at the handshake`);
  }
}

const sAdmin = await connect(A, 'admin');
const sPm1 = await connect(P1, 'pm1');
const sPm2 = await connect(P2, 'pm2');
const sDev1 = await connect(D1, 'dev1');
ok(sAdmin.connected && sPm1.connected && sPm2.connected && sDev1.connected, 'authenticated sockets connect');

// -------------------------------------------------------------------presence
section('Presence');
await sleep(500);
const presence = sAdmin.events['presence:update'].at(-1);
ok(!!presence, 'admin receives presence:update on connect');
const baseline = presence.onlineCount;
ok(baseline === 4, `presence counts distinct users, not sockets (${baseline})`);
ok(sPm1.events['presence:update'].length === 0, 'non-admins do not receive presence broadcasts');

const secondTab = await connect(D1, 'dev1-tab2');
await sleep(500);
ok(sAdmin.events['presence:update'].at(-1).onlineCount === baseline, 'a second tab for the same user does not double-count');
secondTab.disconnect();
await sleep(500);
ok(sAdmin.events['presence:update'].at(-1).onlineCount === baseline, 'closing one of two tabs keeps the user online');
ok((await get('/api/dashboard', A)).body.data.activeUsersOnline === baseline, 'dashboard reports the live presence count');

// -------------------------------------------------------- room authorization
section('Project room authorization');
ok((await joinRoom(sPm1, pm1ProjectId)).success === true, 'PM joins their own project room');
const refusedJoin = await joinRoom(sPm1, pm2ProjectId);
ok(refusedJoin.success === false, "PM refused another PM's project room");
ok((await joinRoom(sAdmin, pm1ProjectId)).success === true, 'admin joins any project room');
ok((await joinRoom(sDev1, dev1Tasks[0].projectId)).success === true, 'developer joins a project they are assigned in');

const unrelated = adminProjects.find((p) => !dev1Tasks.some((t) => t.projectId === p.id));
if (unrelated) {
  ok((await joinRoom(sDev1, unrelated.id)).success === false, 'developer refused a project with no assigned task');
} else {
  ok(true, 'developer refused unrelated project (skipped - assigned in every project)');
}
ok((await joinRoom(sAdmin, '00000000-0000-0000-0000-000000000000')).success === false, 'unknown project id refused');

// -------------------------------------------------- real-time status updates
section('Real-time task status updates');
const targetTask = (await get(`/api/tasks?projectId=${pm1ProjectId}`, P1)).body.data.tasks
  .find((t) => t.status !== 'DONE' && t.assignedDeveloperId);
const nextStatus = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'IN_REVIEW', IN_REVIEW: 'DONE' }[targetTask.status];

[sAdmin, sPm1, sPm2, sDev1].forEach((s) => s.reset());
ok((await send('PATCH', `/api/tasks/${targetTask.id}/status`, P1, { status: nextStatus })).status === 200, 'PM updates a task in their own project');
await sleep(700);

ok(sPm1.events['task:updated'].some((e) => e.task.id === targetTask.id), 'project-room member receives task:updated');
ok(sAdmin.events['task:updated'].some((e) => e.task.id === targetTask.id), 'admin global room receives task:updated');
ok(sAdmin.events['activity:new'].some((a) => a.taskId === targetTask.id), 'admin receives activity:new');
ok(sPm2.events['task:updated'].length === 0, "another PM receives NOTHING for a project they don't own");
ok(sPm2.events['activity:new'].length === 0, "another PM receives no activity for a project they don't own");

const emitted = sAdmin.events['activity:new'].find((a) => a.taskId === targetTask.id);
ok(emitted.oldStatus === targetTask.status && emitted.newStatus === nextStatus, `activity records ${targetTask.status} -> ${nextStatus}`);
ok(!!emitted.userId && !!emitted.createdAt, 'activity records who made the change and when');

// ----------------------------------------------------------- status history
section('Status history persisted in PostgreSQL');
const detail = (await get(`/api/tasks/${targetTask.id}`, P1)).body.data.task;
const history = detail.activities.filter((a) => a.action === 'STATUS_CHANGE');
ok(history.length >= 1, `status-change rows persisted (${history.length})`);
ok(history.every((h) => h.oldStatus !== null && h.newStatus !== null), 'every history row carries old and new status');
ok(detail.status === nextStatus, 'current status reflects the latest change');
ok(history.some((h) => h.newStatus === nextStatus), 'history is stored, not derived from current status');

// ------------------------------------------------------------- notifications
section('Notifications');
const developers = (await get('/api/users/developers', P1)).body.data.developers;
const assignee = developers.find((d) => d.id !== targetTask.assignedDeveloperId);
const assigneeAuth = (await login(assignee.email)).body.data.accessToken;
const sAssignee = await connect(assigneeAuth, 'assignee');
await sleep(400);
sAssignee.reset();
sPm1.reset();
sPm2.reset();

const createdTask = await send('POST', '/api/tasks', P1, {
  projectId: pm1ProjectId,
  title: 'E2E assignment probe',
  description: 'Created by the verification suite',
  assignedDeveloperId: assignee.id,
  priority: 'HIGH',
  dueDate: new Date(Date.now() + 3 * 864e5).toISOString(),
});
ok(createdTask.status === 201, 'PM creates and assigns a task');
await sleep(700);
ok(sAssignee.events['notification:new'].some((n) => n.type === 'TASK_ASSIGNED'), 'assigned developer is notified over WebSocket');

const assigneeNotifications = (await get('/api/notifications', assigneeAuth)).body.data;
ok(assigneeNotifications.notifications.some((n) => n.taskId === createdTask.body.data.task.id), 'assignment notification persisted in the database');
ok(assigneeNotifications.unreadCount > 0, `unread count is non-zero (${assigneeNotifications.unreadCount})`);

const probeTaskId = createdTask.body.data.task.id;
await send('PATCH', `/api/tasks/${probeTaskId}/status`, assigneeAuth, { status: 'IN_PROGRESS' });
await send('PATCH', `/api/tasks/${probeTaskId}/status`, assigneeAuth, { status: 'IN_REVIEW' });
await sleep(700);
ok(sPm1.events['notification:new'].some((n) => n.type === 'TASK_IN_REVIEW'), 'owning PM is notified when a task moves to In Review');
ok(sPm2.events['notification:new'].length === 0, 'other PMs are not notified');

const current = (await get('/api/notifications', assigneeAuth)).body.data;
const unread = current.notifications.find((n) => !n.isRead);
const markedOne = await send('PATCH', `/api/notifications/${unread.id}/read`, assigneeAuth);
ok(markedOne.status === 200 && markedOne.body.data.unreadCount === current.unreadCount - 1, 'mark one read decrements the unread count');
ok((await send('POST', '/api/notifications/read-all', assigneeAuth)).body.data.unreadCount === 0, 'mark all read zeroes the unread count');
ok((await send('PATCH', `/api/notifications/${unread.id}/read`, P2)).status === 404, "a user cannot mark another user's notification read");

// ---------------------------------------------------------- offline catch-up
section('Missed-event catch-up from PostgreSQL');
sAssignee.disconnect();
await sleep(300);

const marker = `Offline probe ${Date.now()}`;
for (let i = 0; i < 3; i++) {
  await send('POST', '/api/tasks', P1, {
    projectId: pm1ProjectId,
    title: `${marker} ${i}`,
    description: 'occurred while the client was disconnected',
    assignedDeveloperId: assignee.id,
    priority: 'LOW',
    dueDate: new Date(Date.now() + 10 * 864e5).toISOString(),
  });
}

const missed = await get('/api/activity/missed', assigneeAuth);
ok(missed.status === 200, 'reconnecting client can fetch missed activity');
ok(missed.body.data.activities.length <= 20, `catch-up returns at most 20 events (${missed.body.data.activities.length})`);
ok(missed.body.data.activities.filter((a) => a.details?.includes(marker)).length === 3, 'every event that occurred while offline is returned');
ok(missed.body.data.source === 'PostgreSQL', 'catch-up is sourced from the database, not memory');
ok(!(await get('/api/activity/missed', P2)).body.data.activities.some((a) => a.details?.includes(marker)), 'catch-up is role filtered');

// ------------------------------------------------------------ overdue cron
if (RUN_CRON) {
  section('Overdue background job (node-cron)');
  sAdmin.reset();
  const sAssignee2 = await connect(assigneeAuth, 'assignee2');
  await sleep(400);

  const probe = await send('POST', '/api/tasks', P1, {
    projectId: pm1ProjectId,
    title: 'E2E cron overdue probe',
    description: 'becomes overdue after creation, so only the cron can flag it',
    assignedDeveloperId: assignee.id,
    priority: 'CRITICAL',
    dueDate: new Date(Date.now() + 35_000).toISOString(),
  });
  const probeId = probe.body.data.task.id;
  ok(probe.body.data.task.isOverdue === false, 'probe task is not overdue at creation time');

  console.log('  ... polling up to 110s for the cron tick');
  let flagged = false;
  for (let i = 0; i < 22; i++) {
    await sleep(5000);
    if ((await get(`/api/tasks/${probeId}`, P1)).body.data.task.isOverdue) {
      flagged = true;
      console.log(`  ... flagged after ~${(i + 1) * 5}s`);
      break;
    }
  }
  ok(flagged, 'background job flags the task overdue with no page load involved');

  await sleep(1500);
  const overdueDetail = (await get(`/api/tasks/${probeId}`, P1)).body.data.task;
  ok(overdueDetail.activities.some((a) => a.action === 'TASK_OVERDUE'), 'job persists a TASK_OVERDUE activity row');
  ok(sAdmin.events['task:updated'].some((e) => e.task.id === probeId && e.task.isOverdue), 'job broadcasts task:updated');
  ok(sAssignee2.events['notification:new'].some((n) => n.type === 'TASK_OVERDUE'), 'assigned developer is notified');

  const before = overdueDetail.activities.filter((a) => a.action === 'TASK_OVERDUE').length;
  await sleep(65_000);
  const after = (await get(`/api/tasks/${probeId}`, P1)).body.data.task.activities.filter((a) => a.action === 'TASK_OVERDUE').length;
  ok(before === 1 && after === 1, 'job is idempotent - a task is flagged exactly once across ticks');

  sAssignee2.disconnect();
} else {
  section('Overdue background job (node-cron)');
  console.log('  SKIPPED - re-run with RUN_CRON=1 (takes about 3 minutes)');
}

// ---------------------------------------------------------------------- done
[sAdmin, sPm1, sPm2, sDev1].forEach((s) => s.disconnect());

console.log(`\n${'-'.repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
}
console.log(`${'-'.repeat(52)}\n`);
process.exit(fail ? 1 : 0);
