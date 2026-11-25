import { h, get, credits, fmtDateTime, modeLabel } from './common.js';
import { empty } from './app-ui.js';

/* The teacher desk. Students never see this page. */
export async function home(root, _arg, ctx) {
  const u = ctx.state.user;
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, `Welcome, ${u.name.split(' ')[0]}`), h('p', { class: 'muted' }, `Teacher space at ${u.university.name}, ${u.university.city}`)),
    h('div', { class: 'row' }, h('a', { class: 'btn btn-primary', href: '#/new-offer' }, 'Offer a course'), h('a', { class: 'btn', href: '#/post' }, 'Post an event'))));

  const [d, queue, mine] = await Promise.all([get('/api/dashboard'), get('/api/review-queue'), get('/api/offers?mine=1')]);
  if (!ctx.alive()) return;

  if (u.role === 'teacher' && !u.verified) {
    root.append(h('div', { class: 'notice' }, h('strong', {}, 'Waiting for verification.'),
      'An administrator verifies teachers and assigns them to courses. Until then you can offer sessions and post events. Reviewing resources, the difficulty radar and announcements unlock after verification.'));
  }

  const waiting = queue.resources.length + queue.handovers.length;
  root.append(h('dl', { class: 'facts statrow' },
    h('div', {}, h('dt', {}, 'Waiting for your review'), h('dd', {}, String(waiting))),
    h('div', {}, h('dt', {}, 'Session requests'), h('dd', {}, String(d.requests_waiting))),
    h('div', {}, h('dt', {}, 'Active listings'), h('dd', {}, String(mine.offers.filter((o) => o.status === 'active').length))),
    h('div', {}, h('dt', {}, 'Wallet'), h('dd', {}, credits(d.balance)))));

  const todo = [];
  if (waiting) todo.push(h('li', {}, h('a', { href: '#/review' }, `${waiting} submission${waiting === 1 ? '' : 's'} to review`)));
  if (d.requests_waiting) todo.push(h('li', {}, h('a', { href: '#/sessions' }, `${d.requests_waiting} session request${d.requests_waiting === 1 ? '' : 's'} waiting for your answer`)));
  if (d.unread_messages) todo.push(h('li', {}, h('a', { href: '#/messages' }, `${d.unread_messages} unread message${d.unread_messages === 1 ? '' : 's'}`)));

  root.append(h('div', { class: 'grid2' },
    h('div', { class: 'stack' },
      h('section', { class: 'panel' }, h('h2', {}, 'Needs you'),
        todo.length ? h('ul', { class: 'ruled' }, todo) : h('p', { class: 'muted flush' }, 'Nothing is waiting.'),
        h('div', { class: 'row' }, h('a', { class: 'btn btn-sm', href: '#/review' }, 'Review queue'), h('a', { class: 'btn btn-sm', href: '#/radar' }, 'Difficulty radar'))),
      h('section', { class: 'panel' }, h('h2', {}, 'Coming up'),
        d.upcoming.length
          ? h('ul', { class: 'ruled' }, d.upcoming.map((s) => h('li', {}, h('strong', {}, s.course_code), ` with ${s.other}`, h('div', { class: 'small muted' }, `${fmtDateTime(s.start_at)}, ${modeLabel(s.mode)}`))))
          : h('p', { class: 'muted flush' }, 'No accepted sessions yet.'))),
    h('div', { class: 'stack' },
      h('section', { class: 'panel' }, h('h2', {}, 'Your listings'),
        mine.offers.length
          ? h('ul', { class: 'ruled' }, mine.offers.slice(0, 5).map((o) => h('li', {}, h('strong', {}, o.course.code), ` ${o.course.name}`, h('div', { class: 'small muted' }, `${o.price_per_hour === 0 ? 'Free' : `${o.price_per_hour} credits per hour`}${o.status === 'paused' ? ', paused' : ''}`))))
          : empty('No listings yet', 'Offer a course so students at your university can book you.', h('a', { class: 'btn btn-primary btn-sm', href: '#/new-offer' }, 'Offer a course')),
        mine.offers.length ? h('p', {}, h('a', { href: '#/teach' }, 'Manage listings')) : null),
      h('section', { class: 'panel' }, h('h2', {}, 'Campus events'),
        d.events.length
          ? h('ul', { class: 'ruled' }, d.events.map((e) => h('li', {}, h('strong', {}, e.title), h('div', { class: 'small muted' }, `${e.kind === 'hackathon' ? 'Hackathon' : 'Event'}, ${fmtDateTime(e.event_at)}${e.venue ? `, ${e.venue}` : ''}`))))
          : h('p', { class: 'muted flush' }, 'No upcoming events. Post the first one.'),
        h('p', {}, h('a', { href: '#/post' }, 'Post an event'), ' or ', h('a', { href: '#/feed' }, 'open the campus feed'))))));
}
