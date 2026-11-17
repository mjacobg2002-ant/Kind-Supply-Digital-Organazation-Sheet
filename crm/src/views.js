import { billingView } from './billing-view.js';
import { dashboard, reports } from './dashboard.js';
import { avatar, button, chip, contactName, day, dayLabel, dollars, edit, example, fieldSelect, h, icon, panel, primary, safeLink, stageName, statusTone, table, timeLabel } from './ui.js';

export const sections = [
  ['Workspace', [
    ['dashboard','Overview','layout-dashboard'], ['contacts','Contacts','contact-round'], ['pipeline','Pipeline','columns-3'],
    ['inbox','Inbox','messages-square'], ['calendar','Calendar','calendar-days'], ['tasks','Tasks','list-checks']
  ]],
  ['Operations', [
    ['proposals','Proposals','file-text'], ['billing','Payments','credit-card'], ['workflows','Workflows','workflow'],
    ['forms','Lead forms','clipboard-list'], ['reports','Reports','chart-no-axes-combined']
  ]]
];

export const pages = {
  dashboard:['Overview','A snapshot of your sales, follow-ups, and revenue.','New opportunity','new:deals'],
  contacts:['Contacts','Find prospects and keep their outreach history in one place.','New contact','new:contacts'],
  pipeline:['Pipeline','Move opportunities from first contact to signed client.','New opportunity','new:deals'],
  inbox:['Inbox','Review replies, log outreach, and manage drafts.','Log or draft message','new:messages'],
  calendar:['Calendar','Track booked meetings, demos, and client appointments.','New appointment','new:events'],
  tasks:['Tasks','Manage follow-ups and keep track of what’s due.','New task','new:tasks'],
  proposals:['Proposals','Publish private proposal links and track client acceptance.','New proposal','new:proposals'],
  billing:['Payments','Create Stripe Checkout links and review payment activity.','Create checkout','checkout'],
  workflows:['Workflows','Create tasks, update contacts, and prepare drafts when events occur.','New workflow','new:workflows'],
  forms:['Lead forms','Collect inquiries or booking requests with shareable forms.','New form','new:forms'],
  reports:['Reports','Review sales activity, pipeline value, and client payments.','Export data','export-all'],
  settings:['Settings','Manage workspace settings, team access, and integrations.','','']
};
export const regions = ['Northern Virginia','Washington, DC','Maryland','Florida','Other'];
export const websiteStatuses = ['Unknown','Working','Needs improvement','Broken','No website'];

const linkText = (name, action, id) => `<button type="button" class="text-button" data-action="${action}" data-id="${h(id)}">${h(name)}</button>`;
const cellLines = (primaryText, secondaryText, glyph = '') => `<div class="cell-lines">${glyph ? icon(glyph) : ''}<div><strong>${h(primaryText)}</strong>${secondaryText ? `<small>${h(secondaryText)}</small>` : ''}</div></div>`;
const stateBadge = value => chip(value, statusTone(value));
const filterSelect = (key, label, options, value) => `<select class="select" aria-label="${h(label)}" data-filter="${key}">${fieldSelect(options, value, label)}</select>`;

function contacts(s, filters, canEdit) {
  const term = (filters.contactQuery ?? '').toLowerCase();
  const rows = s.contacts.filter(row => (!term || [row.company,row.name,row.email,row.phone,row.city,(row.tags ?? []).join(' ')].join(' ').toLowerCase().includes(term))
    && (!filters.region || row.region === filters.region) && (!filters.website || row.websiteStatus === filters.website)
    && (!filters.followUp || (row.followUp && row.followUp <= day(new Date(), s.settings.timezone))));
  const toolbar = `<div class="toolbar"><div class="toolbar-filters"><label class="input-icon">${icon('search')}<input type="search" data-filter="contactQuery" value="${h(filters.contactQuery ?? '')}" placeholder="Search contacts…" aria-label="Search contacts"></label>
    ${filterSelect('region','All regions',regions,filters.region)}
    ${filterSelect('website','All website statuses',websiteStatuses,filters.website)}
    ${filterSelect('followUp','All follow-ups',[['due','Due or overdue']],filters.followUp)}
    </div><div class="toolbar-filters">${canEdit ? button('Import CSV',{ glyph:'upload',action:'import' }) : ''}${button('Export CSV',{glyph:'download',action:'export-contacts'})}</div></div>`;
  return `<section class="panel list-panel">${toolbar}<div class="table-count">${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'}</div>${table(['Practice / contact','Location','Website status','Source','Follow-up',''],
    rows.map((row,i) => [
      `<div class="table-identity">${avatar(row.company,i)}<div>${linkText(row.company,'contact',row.id)}<small>${h(row.name || row.email)}</small></div></div>`,
      cellLines(row.city || '—',row.region), stateBadge(row.websiteStatus), h(row.source), h(dayLabel(row.followUp)), canEdit ? edit('contacts',row) : ''
    ]),example('users','No matching contacts','Add a contact or adjust the filters.'))}</section>`;
}

function pipeline(s, filters, canEdit, canManage) {
  const term = (filters.dealQuery || '').toLowerCase();
  const shown = s.deals.filter(deal => !term || [deal.title, contactName(s, deal.contactId)].join(' ').toLowerCase().includes(term));
  const toolbar = `<div class="toolbar pipeline-tools"><div class="toolbar-filters"><label class="input-icon">${icon('search')}<input type="search" data-filter="dealQuery" value="${h(term)}" placeholder="Find an opportunity…" aria-label="Search opportunities"></label>
    <span class="muted">${shown.length} opportunities</span></div>${canManage ? button('Edit stages',{ glyph:'settings',action:'stages' }) : ''}</div>`;
  return toolbar + `<div class="kanban" aria-label="Opportunity stages">${s.stages.map((stage,i) => {
    const rows = shown.filter(deal => deal.stage === stage.id);
    return `<section class="kanban-col" data-stage="${h(stage.id)}"><div class="kanban-title"><span class="stage-dot stage-${i % 7}"></span><h2>${h(stage.name)}</h2>${chip(rows.length)}${canEdit ? button('',{glyph:'plus',action:'new:deals',id:stage.id,kind:'ghost',title:'Add opportunity'}) : ''}</div>
      <div class="kanban-total">${dollars(rows.reduce((sum,row) => sum + row.value,0))}</div>
      ${rows.map(row => `<article class="deal-card" data-deal="${h(row.id)}" draggable="${canEdit}">
        ${linkText(row.title,'deal',row.id)}<span>${h(contactName(s,row.contactId))}</span><div class="deal-bottom"><strong>${dollars(row.value)}</strong><span>${row.closeDate ? dayLabel(row.closeDate) : ''}</span></div>
        </article>`).join('') || '<p class="kanban-empty">No opportunities</p>'}</section>`;
  }).join('')}</div>`;
}

function tasks(s, filters, canEdit) {
  const today = day(new Date(), s.settings.timezone);
  const selection = filters.taskStatus || 'Open';
  const rows = s.tasks.filter(row => selection === 'Completed' ? row.done : selection === 'Due' ? !row.done && row.due <= today : selection === 'Open' ? !row.done : true)
    .sort((a,b) => a.due.localeCompare(b.due));
  const chips = ['Open','Due','Completed','All'].map(type => button(type, {action:'task-filter',id:type,kind:selection === type ? 'selected' : 'ghost'})).join('');
  const list = table(['','Task','Practice','Due date','Priority',''],rows.map(row => [
    canEdit ? button('',{ glyph:row.done ? 'circle-check' : 'check',title:row.done ? 'Reopen task' : 'Complete task',action:'toggle-task',id:row.id,kind:row.done ? 'success ghost' : 'ghost' }) : (row.done ? icon('circle-check') : ''),
    cellLines(row.title,row.notes), h(contactName(s,row.contactId)), row.due < today && !row.done ? chip(dayLabel(row.due),'amber') : h(dayLabel(row.due)),
    stateBadge(row.priority), canEdit ? edit('tasks',row) : ''
  ]),example('list-checks','No tasks in this view','Create a task or change the task filter.'));
  const contactDue = s.contacts.filter(row => row.followUp && row.followUp <= today);
  return `<div class="stack"><section class="panel"><div class="toolbar tabs">${chips}</div>${list}</section>
    ${panel('Contact reminders', 'Follow-up dates due today or overdue',table(['Practice','Contact','Follow-up'],
      contactDue.map(row => [linkText(row.company,'contact',row.id),h(row.name),h(dayLabel(row.followUp))]),
      example('clock','No contact reminders due','Add a follow-up date on a contact to see it here.')))}</div>`;
}

function inbox(s, filters, canEdit, integrations) {
  const channel = filters.channel || '';
  const rows = s.messages.filter(row => !channel || row.channel === channel);
  const threads = [...new Set(rows.map(row => row.contactId))].map(id => [id, rows.find(row => row.contactId === id)]);
  const chosen = threads.some(([id]) => id === filters.thread) ? filters.thread : threads[0]?.[0];
  const messages = rows.filter(row => row.contactId === chosen);
  const conversation = `<div class="inbox-grid"><div class="thread-list">
    <div class="thread-filter">${filterSelect('channel','All channels',['Email','SMS','Call','LinkedIn','Note'],channel)}</div>
    ${threads.map(([id,row],i) => `<button type="button" class="thread ${chosen === id ? 'active' : ''}" data-action="thread" data-id="${h(id)}">
      ${avatar(contactName(s,id),i)}<div class="row-main"><strong>${h(contactName(s,id))}</strong><span>${h(row.subject || row.body)}</span></div>${stateBadge(row.status)}
    </button>`).join('')}
  </div><div class="conversation">${chosen ? `<div class="toolbar"><strong>${h(contactName(s,chosen))}</strong>${canEdit ? button('New message',{action:'draft-for',glyph:'plus',id:chosen}) : ''}</div>
    <div class="message-list">${messages.map(row => `<article class="message"><div class="message-head"><div>${chip(row.channel,'blue')} ${stateBadge(row.status)}</div><span>${h(timeLabel(row.createdAt,s.settings.timezone))}</span></div>
      <strong>${h(row.subject)}</strong><p>${h(row.body)}</p>
      ${canEdit && ['Draft','Failed'].includes(row.status) ? `<div class="action-row">${edit('messages',row)}${row.status === 'Draft' && (row.channel === 'Email' ? integrations.email : integrations.sms) ? button('Send draft',{action:'send',id:row.id,glyph:'send'}) : ''}</div>` : ''}
    </article>`).join('')}</div>` : example('inbox','No conversations yet','Create a draft or log a reply to start a conversation.')}</div></div>`;
  return `<section class="panel">${conversation}</section>`;
}

function calendar(s, filters, canEdit, integrations, canManage) {
  const timezone = s.settings.timezone;
  const month = filters.month || day(new Date(),timezone).slice(0,7);
  const monthStart = new Date(month + '-01T12:00:00Z');
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const numDays = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth()+1,0)).getUTCDate();
  const eventDay = row => row.allDay ? row.allDayStart : day(new Date(row.startsAt),timezone);
  const appointments = s.events.filter(row => eventDay(row).startsWith(month)).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  const grid = `<div class="calendar-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(name => `<div class="calendar-dayname">${name}</div>`).join('')}
    ${'<div class="calendar-blank"></div>'.repeat(offset)}
    ${Array.from({length:numDays},(_,i) => {
      const date = month + '-' + String(i+1).padStart(2,'0');
      const rows = appointments.filter(row => eventDay(row) === date);
      return `<div class="calendar-day ${date === day(new Date(),timezone) ? 'today' : ''}"><span>${i+1}</span>
        ${rows.map(row => `<button type="button" title="${h(row.title)}" data-action="${canEdit && !row.allDay ? 'edit:events' : 'event'}" data-id="${h(row.id)}">${h(row.title)}</button>`).join('')}</div>`;
    }).join('')}${'<div class="calendar-blank"></div>'.repeat((7 - (numDays + offset) % 7) % 7)}</div>`;
  const google=integrations.google || {};
  const connection=`<div class="notice calendar-connection">${icon('calendar-days')}<div><strong>${google.connected ? h(google.name || 'Google Calendar') : 'Connect Google Calendar'}</strong>
    <span>${google.connected ? google.issue ? h(google.issue) : 'Syncs when opened and every five minutes while the workspace is open.' : 'Bring your Google appointments into this calendar and sync CRM appointment changes.'}</span></div>
    <div class="action-row">${google.connected ? button('Sync Google',{glyph:'refresh-cw',action:'google-sync'}) : canManage ? button('Connect calendar',{glyph:'link',action:'google-connect'}) : ''}
    ${canManage ? button('Calendar settings',{glyph:'settings',action:'google-settings'}) : ''}</div></div>`;
  return `<div class="stack">${connection}${panel(new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(monthStart),timezone,
    grid,`<div class="action-row">${button('',{glyph:'chevron-left',action:'month-prev',title:'Previous month'})}${button('Today',{action:'month-current'})}${button('',{glyph:'chevron-right',action:'month-next',title:'Next month'})}</div>`)}
    ${panel('Appointments','',table(['Appointment','Practice','Starts','Ends','Status','Google sync',''],appointments.map(row => [
      cellLines(row.title,row.location),h(contactName(s,row.contactId)),h(row.allDay ? row.allDayStart+' · All day' : timeLabel(row.startsAt,timezone)),h(row.allDay ? row.allDayEnd : timeLabel(row.endsAt,timezone)),stateBadge(row.status),
      row.googleSync ? chip(row.googleSync,row.googleSync==='Synced' ? 'green' : 'amber') : '—',
      row.googleSync==='Conflict' ? button('Use Google version',{action:'google-resolve',id:row.id}) : canEdit && !row.allDay ? edit('events',row) : ''
    ]),example('calendar-days','No appointments this month','Add a meeting or move to another month.')))}</div>`;
}

function proposals(s, canEdit) {
  return panel('All proposals','',table(['Proposal','Practice','Amount','Status','Expires',''],s.proposals.map(row => [
    linkText(row.title,'proposal-detail',row.id),h(contactName(s,row.contactId)),`${dollars(row.amount)} <small>${h(row.cadence)}</small>`,stateBadge(row.status),h(dayLabel(row.expires)),
    `<div class="action-row">${row.linkToken && ['Published','Accepted'].includes(row.status) ? button('',{glyph:'copy',action:'copy:proposal',id:row.linkToken,title:'Copy private proposal link'}) : ''}${canEdit && row.status === 'Draft' ? edit('proposals',row) : ''}</div>`
  ]),example('file-text','No proposals yet','Create a proposal from an opportunity.')));
}


function workflows(s, canManage) {
  return `<div class="stack">${panel('Automation rules','',table(['Workflow','Trigger','Action','Status',''],s.workflows.map(row => [
    cellLines(row.title,row.source ? 'Source: ' + row.source : ''),h(row.trigger),h(row.action),stateBadge(row.active ? 'Active' : 'Paused'),canManage ? edit('workflows',row) : ''
  ]),example('workflow','No workflow rules','Create a rule to follow up when a lead comes in or a deal moves stages.')))}
  ${panel('Recent runs','',table(['Workflow','Practice','Action','Time'],s.runs.slice(0,40).map(row => [
    cellLines(row.rule,row.trigger),h(contactName(s,row.contactId)),h(row.action),h(timeLabel(row.at,s.settings.timezone))
  ]),example('activity','No workflow runs','Triggered actions will appear here.')))}</div>`;
}

function forms(s, canManage) {
  return panel('Shareable forms','',table(['Form','Type','Pipeline stage','Status',''],s.forms.map(row => [
    cellLines(row.title,row.description),h(row.type),h(stageName(s,row.stage)),stateBadge(row.active ? 'Active' : 'Paused'),
    `<div class="action-row">${row.linkToken && row.active ? button('Copy link',{glyph:'copy',action:'copy:capture',id:row.linkToken}) : ''}${canManage ? edit('forms',row) : ''}</div>`
  ]),example('clipboard-list','No forms yet','Create a lead inquiry or booking request form.')));
}

function settings(workspace, ui) {
  const { state:s, name, role, integrations, members } = workspace;
  const manager = ['owner','admin'].includes(role);
  const integrationRows = [
    ['Stripe','Checkout, recurring payments, and billing events',integrations.stripe,'credit-card'],
    ['Resend','Outbound email and optional inbound replies',integrations.email,'mail'],
    ['Twilio','SMS and missed-call status callbacks',integrations.sms,'phone']
  ];
  return `<div class="dashboard-grid">${panel('Workspace profile','',`<dl class="settings-list"><dt>Name</dt><dd>${h(name)}</dd><dt>Time zone</dt><dd>${h(s.settings.timezone)}</dd><dt>Your role</dt><dd>${chip(role)}</dd>${manager ? `<dt>Workspace ID</dt><dd><code>${h(workspace.id)}</code></dd>` : ''}</dl>`,
    manager ? button('Edit profile',{glyph:'square-pen',action:'workspace-settings'}) : '')}
    ${panel('Integrations','Provider credentials are configured on the Vercel project.',`<ul class="followups">${integrationRows.map(([service,desc,connected,glyph]) => `<li><span class="feed-icon">${icon(glyph)}</span><div class="row-main"><strong>${service}</strong><span>${desc}</span></div>${chip(connected ? 'Configured' : 'Setup needed',connected ? 'green' : 'neutral')}</li>`).join('')}</ul>`)}
    ${panel('Google Calendar',integrations.google?.connected ? 'Connected to '+integrations.google.name : 'Connect a calendar for appointment tracking.',
      `<dl class="settings-list"><dt>Status</dt><dd>${chip(integrations.google?.connected ? 'Connected' : 'Setup needed',integrations.google?.connected ? 'green' : 'neutral')}</dd>
      <dt>Last sync</dt><dd>${h(timeLabel(integrations.google?.lastSync,s.settings.timezone))}</dd>
      ${integrations.google?.issue ? `<dt>Attention</dt><dd>${h(integrations.google.issue)}</dd>` : ''}</dl>`,manager ? button('Manage calendar',{glyph:'calendar-days',action:'google-settings'}) : '')}
    ${panel('Stripe reporting','Payments, recurring revenue, and recovery.',`<div class="settings-links">${button(integrations.stripe ? 'View payments' : 'Set up Stripe',{glyph:'credit-card',action:integrations.stripe ? 'nav:billing' : 'stripe-setup'})}</div>`)}
    ${panel('Team','',table(['Name','Email','Role',''],members.map(member => [
      cellLines(member.name,''),h(member.email),chip(member.role),role === 'owner' && member.role !== 'owner' ? button('Manage',{action:'member',id:member.id}) : ''
    ]),''),manager && !ui.demo ? button('Invite member',{glyph:'plus',action:'invite'}) : '', 'span-all')}
    ${manager ? panel('Inbound webhooks','Use these workspace addresses for incoming replies and missed-call events.',
      s.settings.inbound ? `<div class="settings-links">${[['resend','Inbound email'],['sms','Inbound SMS'],['voice','Missed calls']].map(([key,label]) => button(label,{glyph:'copy',action:'copy-webhook:'+key,id:s.settings.inbound})).join('')}</div>` : `<div class="settings-links">${ui.demo ? '<span class="muted">Available in a live workspace.</span>' : button('Generate addresses',{glyph:'link',action:'generate-inbound'})}</div>`,
      s.settings.inbound ? button('Rotate addresses',{glyph:'rotate-ccw',action:'rotate-inbound'}) : '', 'span-all') : ''}</div>`;
}

export function renderPage(workspace, ui) {
  const { state:s, integrations } = workspace;
  const canEdit = workspace.role !== 'viewer';
  const manager = ['owner','admin'].includes(workspace.role);
  const filters = ui.filters;
  switch (ui.page) {
    case 'dashboard': return dashboard(s,filters.period,integrations,ui.demo);
    case 'contacts': return contacts(s,filters,canEdit);
    case 'pipeline': return pipeline(s,filters,canEdit,manager);
    case 'tasks': return tasks(s,filters,canEdit);
    case 'inbox': return inbox(s,filters,canEdit,integrations);
    case 'calendar': return calendar(s,filters,canEdit,integrations,manager);
    case 'proposals': return proposals(s,canEdit);
    case 'billing': return billingView(s,integrations,filters,manager,ui.demo);
    case 'workflows': return workflows(s,manager);
    case 'forms': return forms(s,manager);
    case 'reports': return reports(s,filters.period);
    case 'settings': return settings(workspace,ui);
    default: return dashboard(s,filters.period,integrations,ui.demo);
  }
}
