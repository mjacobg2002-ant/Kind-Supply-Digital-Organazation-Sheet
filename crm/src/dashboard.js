import { avatar, button, chip, contactName, day, dayLabel, dollars, example, h, icon, panel, timeLabel } from './ui.js';

export function metrics(s, today) {
  const outcomes = Object.fromEntries(s.stages.map(stage => [stage.id, stage.outcome]));
  const open = s.deals.filter(deal => outcomes[deal.stage] === 'open');
  const won = s.deals.filter(deal => outcomes[deal.stage] === 'won');
  const lost = s.deals.filter(deal => outcomes[deal.stage] === 'lost');
  const due = s.tasks.filter(task => !task.done && task.due <= today).sort((a, b) => a.due.localeCompare(b.due));
  const followups = s.contacts.filter(contact => contact.followUp && contact.followUp <= today);
  const pipeline = open.reduce((sum, deal) => sum + deal.value, 0);
  const revenue = won.reduce((sum, deal) => sum + deal.mrr, 0);
  const collected = s.payments.filter(row => ['Paid','Refunded','Partially refunded'].includes(row.status) && row.mode !== 'subscription' && row.currency === 'usd')
    .reduce((sum, row) => sum + (row.collectedAmount || 0) - (row.refunded || 0), 0);
  return { open, won, lost, due, followups, pipeline, revenue, collected };
}

function metricCard(title, value, note, glyph, tone, route) {
  return `<button type="button" class="metric-card" data-action="nav:${route}">
    <div class="metric-header"><span class="metric-icon ${tone}">${icon(glyph)}</span>${icon('arrow-up-right')}</div>
    <span class="metric-label">${h(title)}</span><strong>${h(value)}</strong><span class="metric-note">${h(note)}</span>
  </button>`;
}

function activityChart(s, period, zone) {
  const weeks = period === '56' ? 8 : 4;
  const end = day(new Date(), zone);
  const middle = Date.parse(end + 'T12:00:00Z');
  const labels = [];
  const buckets = [];
  for (let index = weeks - 1; index >= 0; index--) {
    const start = new Date(middle - (index * 7 + 6) * 86400000).toISOString().slice(0, 10);
    const stop = new Date(middle - index * 7 * 86400000).toISOString().slice(0, 10);
    labels.push(dayLabel(start));
    const inRange = timestamp => {
      const occurred = day(new Date(timestamp), zone);
      return occurred >= start && occurred <= stop;
    };
    buckets.push([s.contacts.filter(row => inRange(row.createdAt)).length,
      s.activity.filter(row => ['messages','proposals'].includes(row.type) && inRange(row.at)).length]);
  }
  const max = Math.max(4, ...buckets.flat());
  const step = Math.ceil(max / 4);
  return `<div class="chart-legend"><span><i></i> New contacts</span><span><i></i> Messages and proposals</span></div>
    <div class="chart" aria-label="Weekly contact and sales activity">
      <div class="chart-axis">${[4,3,2,1,0].map(level => `<span>${level * step}</span>`).join('')}</div>
      <div class="chart-body"><div class="chart-grid">${'<span></span>'.repeat(5)}</div><div class="bar-groups">
      ${buckets.map(([leads, actions], index) => `<div class="bar-group" title="${h(labels[index])}: ${leads} contacts, ${actions} activities">
        <div class="bars"><i class="bar leads" style="height:${leads ? leads / (step * 4) * 100 : 0}%"></i><i class="bar actions" style="height:${actions ? actions / (step * 4) * 100 : 0}%"></i></div>
        <span>${h(labels[index])}</span></div>`).join('')}</div></div>
    </div>`;
}

function dueList(s, m, today) {
  const rows = [...m.due.map(row => ({ ...row, kind:'task' })), ...m.followups.filter(contact => !m.due.some(row => row.contactId === contact.id)).map(contact => ({
    id: contact.id, title: 'Follow up with ' + contact.company, contactId:contact.id, kind:'contact', due:contact.followUp
  }))].sort((a, b) => a.due.localeCompare(b.due));
  return rows.length ? `<ul class="followups">${rows.slice(0, 4).map(row => `<li>
    <button type="button" class="task-check" data-action="${row.kind === 'task' ? 'toggle-task' : 'contact'}" data-id="${h(row.id)}" title="${row.kind === 'task' ? 'Complete task' : 'Open contact'}" aria-label="${row.kind === 'task' ? 'Complete ' + h(row.title) : 'Open contact'}">${icon(row.kind === 'task' ? 'check' : 'arrow-right')}</button>
    <div class="row-main"><strong>${h(row.title)}</strong><span>${h(contactName(s, row.contactId))}</span></div>
    ${row.due < today ? chip('Overdue', 'amber') : chip('Today', 'blue')}
  </li>`).join('')}</ul>` : example('circle-check','You’re caught up','Follow-ups due today will appear here.');
}

function stageSnapshot(s) {
  const count = s.stages.map(stage => [stage, s.deals.filter(deal => deal.stage === stage.id).length]);
  const max = Math.max(1, ...count.map(([, n]) => n));
  return `<div class="stage-list">${count.map(([stage, n], i) => `<div class="stage-line">
    <span class="stage-dot stage-${i % 7}"></span><span>${h(stage.name)}</span>
    <div class="stage-track"><i class="stage-${i % 7}" style="width:${n / max * 100}%"></i></div><strong>${n}</strong>
  </div>`).join('')}</div>`;
}

export function activityFeed(s, limit = 5, items = s.activity) {
  return items.length ? `<ul class="feed">${items.slice(0, limit).map(item => `<li>
    <span class="feed-icon">${icon(({ contacts:'users', deals:'columns-3', messages:'messages-square', proposals:'file-text', tasks:'list-checks', events:'calendar-days', forms:'clipboard-list' })[item.type] || 'activity')}</span>
    <div class="row-main"><strong>${h(item.title)}</strong><span>${h(item.actor)} · ${h(timeLabel(item.at, s.settings.timezone))}</span></div>
  </li>`).join('')}</ul>` : example('activity','No activity yet','Changes to your workspace will appear here.');
}

export function dashboard(s, period) {
  const today = day(new Date(), s.settings.timezone);
  const m = metrics(s, today);
  const cards = `<div class="metrics">
    ${metricCard('Open pipeline', dollars(m.pipeline), `${m.open.length} open opportunities`, 'columns-3', 'lavender', 'pipeline')}
    ${metricCard('Active contacts', s.contacts.length, 'Across this workspace', 'users', 'periwinkle', 'contacts')}
    ${metricCard('Won monthly retainers', dollars(m.revenue), `${m.won.length} won opportunities`, 'circle-dollar-sign', 'mint', 'reports')}
    ${metricCard('Follow-ups due', m.due.length + m.followups.filter(c => !m.due.some(t => t.contactId === c.id)).length, 'Due today or overdue', 'clock', 'peach', 'tasks')}
  </div>`;
  const periodControl = `<label class="sr-only" for="period">Activity period</label><select id="period" class="select small" data-filter="period"><option value="28">Last 4 weeks</option><option value="56" ${period === '56' ? 'selected' : ''}>Last 8 weeks</option></select>`;
  return cards + `<div class="dashboard-grid">
    ${panel('Sales activity', 'Weekly activity across your workspace', activityChart(s, period, s.settings.timezone), periodControl, 'chart-panel')}
    ${panel('Follow-up queue', 'Today and overdue', dueList(s, m, today), button('', { glyph:'arrow-right', action:'nav:tasks', kind:'ghost', title:'Open tasks' }))}
    ${panel('Pipeline by stage', 'Opportunities across your sales pipeline', stageSnapshot(s), button('View pipeline', { glyph:'arrow-right', action:'nav:pipeline', kind:'ghost' }))}
    ${panel('Recent activity', '', activityFeed(s, 4), button('', { glyph:'arrow-right', action:'nav:reports', kind:'ghost', title:'Open reports' }))}
  </div>`;
}

export function reports(s, period) {
  const m = metrics(s, day(new Date(), s.settings.timezone));
  const wonRate = m.won.length + m.lost.length ? Math.round(m.won.length / (m.won.length + m.lost.length) * 100) + '%' : '—';
  const bySource = new Map();
  for (const row of s.contacts) bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
  const sourceRows = [...bySource].sort((a,b) => b[1] - a[1]);
  return `<div class="metrics">
    ${metricCard('Win rate', wonRate, `${m.won.length} won · ${m.lost.length} lost`, 'target', 'lavender', 'pipeline')}
    ${metricCard('Won monthly retainers', dollars(m.revenue), 'Based on won opportunity values', 'trending-up', 'periwinkle', 'pipeline')}
    ${metricCard('Collected through Stripe', dollars(m.collected), 'Recorded USD payments less refunds', 'credit-card', 'mint', 'billing')}
    ${metricCard('Open pipeline', dollars(m.pipeline), `${m.open.length} open opportunities`, 'layers-3', 'peach', 'pipeline')}
  </div><div class="dashboard-grid">
  ${panel('Sales activity', 'New contacts and logged sales activity', activityChart(s, period, s.settings.timezone))}
  ${panel('Lead sources', '', sourceRows.length ? `<ul class="followups">${sourceRows.map(([name, count]) => `<li>${avatar(name, count)}<strong class="row-main">${h(name)}</strong>${chip(count)}</li>`).join('')}</ul>` : example('users','No contacts yet','Lead sources appear when contacts are added.'))}
  ${panel('Workspace activity', '', activityFeed(s, 60), '', 'span-all')}</div>`;
}
