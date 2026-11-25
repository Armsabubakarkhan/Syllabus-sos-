import { h, clear, get, post, patch, toast, fail, field, showFieldErrors, skeletonRows, fmtDateTime, credits } from './common.js';
import { empty, errorNotice } from './app-ui.js';

const main = document.getElementById('main');
const side = document.getElementById('side');
const TABS = [['overview', 'Overview'], ['universities', 'Universities'], ['users', 'Users'], ['teachers', 'Teacher access'], ['disputes', 'Disputes'], ['withdrawals', 'Withdrawals'], ['reports', 'Reports'], ['audit', 'Audit log']];
let tab = 'overview';

const table = (heads, rows) => h('div', { class: 'table-scroll' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, heads.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', {}, rows)));
const btn = (label, fn, cls = '') => h('button', { class: `btn btn-sm ${cls}`, type: 'button', onclick: fn }, label);
const act = (fn, ok) => async () => { try { await fn(); toast(ok); await show(); } catch (e) { fail(e); } };

const views = {
  async overview(root) {
    const s = await get('/api/admin/stats');
    root.append(h('h1', {}, 'Overview'),
      s.ledger_balanced ? h('div', { class: 'notice ok' }, h('strong', {}, 'Credits ledger balanced.'), 'Every credit movement adds up to zero.') : h('div', { class: 'notice bad', role: 'alert' }, h('strong', {}, 'Ledger does not balance.'), 'Investigate immediately.'),
      h('dl', { class: 'facts' },
        h('div', {}, h('dt', {}, 'Members'), h('dd', {}, String(s.users))),
        h('div', {}, h('dt', {}, 'Approved universities'), h('dd', {}, String(s.universities))),
        h('div', {}, h('dt', {}, 'Universities waiting for approval'), h('dd', {}, String(s.pending_universities))),
        h('div', {}, h('dt', {}, 'Active tutoring listings'), h('dd', {}, String(s.active_offers))),
        h('div', {}, h('dt', {}, 'Open disputes'), h('dd', {}, String(s.disputes))),
        h('div', {}, h('dt', {}, 'Open reports'), h('dd', {}, String(s.open_reports))),
        h('div', {}, h('dt', {}, 'Pending withdrawals'), h('dd', {}, String(s.pending_withdrawals))),
        h('div', {}, h('dt', {}, 'Credits in escrow'), h('dd', {}, credits(s.escrow))),
        h('div', {}, h('dt', {}, 'Platform fees earned'), h('dd', {}, credits(s.platform_earnings)))));
  },
  async universities(root) {
    const { universities } = await get('/api/admin/universities');
    const f = h('form', { class: 'panel stack', novalidate: true }, h('h2', {}, 'Add a university'),
      h('div', { class: 'grid2' }, field('Name', h('input', { id: 'u-name', name: 'name', maxlength: 120 })), field('City', h('input', { id: 'u-city', name: 'city', maxlength: 80 }))),
      field('Student email domain', h('input', { id: 'u-dom', name: 'email_domain', placeholder: 'example.edu' }), '(optional)'), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add university'));
    f.addEventListener('submit', async (e) => { e.preventDefault(); const b = { name: f.name.value, city: f.city.value }; if (f.email_domain.value.trim()) b.email_domain = f.email_domain.value; try { await post('/api/admin/universities', b); toast('Added.'); show(); } catch (err) { showFieldErrors(f, err.fields); fail(err); } });
    root.append(h('h1', {}, 'Universities'), table(['Name', 'City', 'Status', 'Members', ''], universities.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.city), h('td', {}, u.status), h('td', {}, String(u.members)),
      h('td', { class: 'row' }, u.status !== 'approved' ? btn('Approve', act(() => patch(`/api/admin/universities/${u.id}`, { status: 'approved' }), 'Approved.')) : null, u.status !== 'rejected' ? btn('Reject', act(() => patch(`/api/admin/universities/${u.id}`, { status: 'rejected' }), 'Rejected.')) : null)))), f);
  },
  async users(root) {
    const q = h('input', { id: 'au-q', type: 'search', placeholder: 'Search name or email', 'aria-label': 'Search users', maxlength: 60 });
    const out = h('div', {});
    let timer;
    const load = async () => {
      const { users } = await get(`/api/admin/users?q=${encodeURIComponent(q.value.trim())}`);
      clear(out).append(table(['Name', 'Email', 'University', 'Role', 'Verified', 'Status', ''], users.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.email), h('td', {}, u.university), h('td', {}, u.role), h('td', {}, u.verified ? 'Yes' : 'No'), h('td', {}, u.status),
        h('td', { class: 'row' }, u.role === 'admin' ? null : [
          btn(u.verified ? 'Remove verified' : 'Verify', async () => { try { await patch(`/api/admin/users/${u.id}`, { verified: u.verified ? 0 : 1 }); toast('Saved.'); load(); } catch (e) { fail(e); } }),
          btn(u.status === 'banned' ? 'Restore' : 'Suspend', async () => { try { await patch(`/api/admin/users/${u.id}`, { status: u.status === 'banned' ? 'active' : 'banned' }); toast('Saved.'); load(); } catch (e) { fail(e); } }, u.status === 'banned' ? '' : 'btn-danger'),
          u.role === 'student' ? btn('Make teacher', async () => { try { await patch(`/api/admin/users/${u.id}`, { role: 'teacher' }); toast('Saved. Verify the account before assigning courses.'); load(); } catch (e) { fail(e); } }) : null])))));
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
    root.append(h('h1', {}, 'Users'), q, out);
    await load();
  },
  async teachers(root) {
    const d = await get('/api/admin/course-teachers');
    const t = h('select', { id: 'ct-t', name: 'user_id' }, h('option', { value: '' }, 'Choose a teacher'), d.teachers.map((x) => h('option', { value: x.id }, `${x.name} (${x.university})${x.verified ? '' : ', not verified'}`)));
    const c = h('select', { id: 'ct-c', name: 'course_id' }, h('option', { value: '' }, 'Choose a course'), d.courses.map((x) => h('option', { value: x.id }, `${x.code} ${x.name} (${x.university})`)));
    const f = h('form', { class: 'panel stack', novalidate: true }, h('h2', {}, 'Assign a teacher to a course'), h('p', { class: 'small muted' }, 'Assigned, verified teachers can review resources and see the difficulty radar for that course only.'), field('Teacher', t), field('Course', c), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Assign'));
    f.addEventListener('submit', async (e) => { e.preventDefault(); try { await post('/api/admin/course-teachers', { course_id: Number(c.value) || 0, user_id: Number(t.value) || 0 }); toast('Assigned.'); show(); } catch (err) { fail(err); } });
    root.append(h('h1', {}, 'Teacher access'), d.assignments.length ? table(['Teacher', 'Course', 'University', ''], d.assignments.map((a) => h('tr', {}, h('td', {}, a.teacher), h('td', {}, `${a.code} ${a.course}`), h('td', {}, a.university), h('td', {}, btn('Remove', act(() => post('/api/admin/course-teachers', { course_id: a.course_id, user_id: a.user_id, remove: 1 }), 'Removed.'), 'btn-danger'))))) : empty('No assignments', 'Assign a verified teacher to a course below.'), f);
  },
  async disputes(root) {
    const { disputes } = await get('/api/admin/disputes');
    root.append(h('h1', {}, 'Disputes'), disputes.length ? h('div', {}, disputes.map((d) => h('article', { class: 'item' }, h('h3', {}, `Session ${d.id}: ${d.course_code}`), h('p', { class: 'small' }, `Learner ${d.learner}, tutor ${d.tutor}, ${credits(d.price_total)}, ${fmtDateTime(d.start_at)}`), h('p', { class: 'preline' }, d.dispute_reason),
      h('div', { class: 'actions' }, btn('Refund the learner', act(() => post(`/api/admin/bookings/${d.id}/resolve`, { outcome: 'refund' }), 'Refunded.')), btn('Pay the tutor', act(() => post(`/api/admin/bookings/${d.id}/resolve`, { outcome: 'release' }), 'Released.')))))) : empty('No open disputes', 'Problems raised by learners or tutors appear here.'));
  },
  async withdrawals(root) {
    const { withdrawals } = await get('/api/admin/withdrawals');
    root.append(h('h1', {}, 'Withdrawals'), withdrawals.length ? table(['Person', 'Amount', 'Note', 'Status', ''], withdrawals.map((w) => h('tr', {}, h('td', {}, w.name), h('td', {}, credits(w.amount)), h('td', {}, w.note), h('td', {}, w.status), h('td', { class: 'row' }, w.status === 'pending' ? [btn('Mark paid', act(() => post(`/api/admin/withdrawals/${w.id}/resolve`, { outcome: 'paid' }), 'Marked paid.')), btn('Reject', act(() => post(`/api/admin/withdrawals/${w.id}/resolve`, { outcome: 'rejected' }), 'Rejected and returned.'), 'btn-danger')] : null)))) : empty('No withdrawals', 'Requests appear here.'));
  },
  async reports(root) {
    const { reports } = await get('/api/admin/reports');
    root.append(h('h1', {}, 'Reports'), reports.length ? h('div', {}, reports.map((r) => h('article', { class: 'item' }, h('h3', {}, `${r.target_type} ${r.target_id}`), h('p', { class: 'small muted' }, `${r.university}, from ${r.reporter}, ${fmtDateTime(r.created_at)}, ${r.status}`), h('p', { class: 'preline' }, r.reason),
      r.status === 'open' ? h('div', { class: 'actions' }, btn('Remove the content', act(() => post(`/api/admin/reports/${r.id}/resolve`, { action: 'remove_content' }), 'Removed.'), 'btn-danger'), btn('Dismiss', act(() => post(`/api/admin/reports/${r.id}/resolve`, { action: 'dismiss' }), 'Dismissed.'))) : null))) : empty('No reports', 'Reports from members appear here.'));
  },
  async audit(root) {
    const { entries } = await get('/api/admin/audit');
    root.append(h('h1', {}, 'Audit log'), table(['Time', 'Actor', 'Action', 'Detail', 'IP'], entries.map((e) => h('tr', {}, h('td', {}, fmtDateTime(e.created_at)), h('td', {}, e.actor_id ?? ''), h('td', {}, e.action), h('td', {}, e.detail), h('td', {}, e.ip ?? '')))));
  },
};

async function show() {
  clear(side).append(...TABS.map(([k, label]) => h('li', {}, h('a', { href: `#${k}`, 'aria-current': tab === k ? 'page' : null }, label))));
  const root = h('div', {});
  clear(main).append(skeletonRows(3));
  try { await views[tab](root); clear(main).append(root); } catch (e) { clear(main).append(errorNotice(e)); }
}

window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (views[k]) { tab = k; show(); } });
document.getElementById('logout').addEventListener('click', async () => { try { await post('/api/auth/logout'); } finally { location.href = '/'; } });
{ const k = location.hash.slice(1); if (views[k]) tab = k; }
show();
