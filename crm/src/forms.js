import { avatar, button, chip, contactName, day, dayLabel, dollars, fieldSelect, h, icon, safeLink, stageName, statusTone, timeLabel } from './ui.js';
import { activityFeed } from './dashboard.js';
import { regions, websiteStatuses } from './views.js';

const sources = ['Manual','Email outreach','Cold call','Referral','Website','LinkedIn','Google Ads','CSV import','SMS'];
const options = rows => rows.map(row => [row.id, row.company ?? row.title ?? row.name]);
const base = (name, label, props = {}) => ({ name, label, ...props });
const select = (name, label, choices, props = {}) => base(name, label, { type:'select', choices, ...props });
const area = (name,label,max,length = 3) => base(name,label,{type:'textarea',max,length,wide:true});
const check = (name,label) => base(name,label,{type:'checkbox',wide:true});
const money = (name,label) => base(name,label,{type:'number',number:true,money:true,min:0,step:'0.01'});
const contact = (s, required = true) => select('contactId','Contact',options(s.contacts),{ required, blank: required ? 'Select a contact' : 'No linked contact' });
const stage = (s, name = 'stage', label = 'Pipeline stage') => select(name,label,options(s.stages),{required:true});

export const singular = { contacts:'contact', deals:'opportunity', tasks:'task', events:'appointment', messages:'message', proposals:'proposal', workflows:'workflow', forms:'form' };
export const fieldsFor = (s, key) => ({
  contacts:[
    base('company','Practice or company',{required:true,max:140}), base('name','Contact name',{max:100}),
    base('email','Email',{type:'email',max:254}),base('phone','Phone',{type:'tel',max:40}),
    base('city','City',{max:100}),select('region','Region',regions,{default:'Other'}),
    base('website','Website',{type:'url',max:700}),select('websiteStatus','Website status',websiteStatuses),
    select('source','Lead source',sources),base('followUp','Next follow-up',{type:'date'}),
    base('tags','Tags',{placeholder:'Dental, Priority',wide:true,max:450}),
    area('notes','Notes',6000),check('emailAllowed','This contact has given permission to receive email through this workspace.'),
    check('smsAllowed','This contact has opted in to SMS.')
  ],
  deals:[
    base('title','Opportunity name',{required:true,max:140}),contact(s),stage(s),
    base('closeDate','Expected close date',{type:'date'}),money('value','Total deal value (USD)'),money('mrr','Monthly retainer (USD)'),
    base('demoUrl','Demo link',{type:'url',max:700}),base('proposalUrl','External proposal link',{type:'url',max:700}),
    base('paymentUrl','External payment link',{type:'url',max:700}),area('notes','Notes and objections',5000)
  ],
  tasks:[
    base('title','Task name',{required:true,max:140}),contact(s,false),base('due','Due date',{type:'date',required:true}),
    select('priority','Priority',['Normal','High','Low']),area('notes','Notes',2500),
    check('done','Task is complete.')
  ],
  events:[
    base('title','Appointment name',{required:true,max:140}),contact(s,false),
    base('startsAt','Starts',{type:'datetime-local',required:true,zoned:true}),base('endsAt','Ends',{type:'datetime-local',required:true,zoned:true}),
    select('status','Status',['Scheduled','Completed','Canceled','No show']),base('location','Location or meeting link',{max:300}),
    area('notes','Notes',2500)
  ],
  messages:[
    contact(s),select('channel','Channel',['Email','SMS','Call','LinkedIn','Note']),
    select('status','Message type',['Draft','Inbound','Logged'],{blank:'Select a type',required:true}),
    base('subject','Subject',{max:160}),{...area('body','Message',6000,6),required:true}
  ],
  proposals:[
    select('dealId','Opportunity',options(s.deals),{blank:'Select an opportunity',required:true}),
    base('title','Proposal title',{required:true,max:140}),money('amount','Amount (USD)'),
    select('cadence','Billing frequency',['One-time','Monthly']),base('expires','Expires',{type:'date'}),
    select('status','Visibility',['Draft','Published']),{...area('terms','Scope and terms',12000,8),required:true}
  ],
  workflows:[
    base('title','Workflow name',{required:true,max:100}),select('trigger','When this happens',['Lead created','Form submitted','Stage changed','Proposal accepted','Payment received','Reply received','Missed call']),
    select('stage','To this stage',options(s.stages),{blank:'Any stage'}),select('source','Lead source',sources,{blank:'Any source'}),
    select('action','Then do this',['Create task','Add tag','Set follow-up','Draft email','Draft SMS']),
    base('delay','Due in days (tasks and follow-ups)',{type:'number',number:true,min:0,max:90,default:0}),
    base('subject','Draft email subject',{max:160}),area('value','Action text or draft body',6000,5),check('active','Enable this workflow.')
  ],
  forms:[
    base('title','Form name',{required:true,max:120}),select('type','Type',['Lead inquiry','Booking request']),
    stage(s,'stage','Stage for new inquiries'),area('description','Description for visitors',800),
    check('active','Publish this form and accept submissions.')
  ]
}[key]);

function localValue(value, zone) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const part = name => parts.find(v => v.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function fromLocal(value, zone) {
  if (!value) return '';
  const wanted = Date.parse(value + ':00Z');
  let current = wanted;
  for (let i = 0; i < 4; i++) {
    const formatted = localValue(new Date(current),zone);
    if (formatted === value) return new Date(current).toISOString();
    current += wanted - Date.parse(formatted + ':00Z');
  }
  throw new Error('That local time does not exist in the workspace time zone.');
}

export function formFields(definitions, data = {}, zone = 'America/New_York') {
  return definitions.map(def => {
    const { name, label, type = 'text', max, min, step, placeholder, required, choices, blank, wide, money: cents, zoned, length } = def;
    const raw = data[name] ?? def.default ?? '';
    const value = zoned ? localValue(raw,zone) : cents && raw !== '' ? raw / 100 : Array.isArray(raw) ? raw.join(', ') : raw;
    const attrs = `name="${h(name)}"${required ? ' required' : ''}${max && type !== 'number' ? ` maxlength="${max}"` : ''}${max && type === 'number' ? ` max="${max}"` : ''}${min != null ? ` min="${min}"` : ''}${step ? ` step="${step}"` : ''}${placeholder ? ` placeholder="${h(placeholder)}"` : ''}`;
    if (type === 'checkbox') return `<label class="check-field ${wide ? 'wide' : ''}"><input type="checkbox" ${attrs}${value ? ' checked' : ''}><span>${h(label)}</span></label>`;
    const input = type === 'select' ? `<select ${attrs}>${fieldSelect(choices,value,blank)}</select>`
      : type === 'textarea' ? `<textarea ${attrs} rows="${length ?? 3}">${h(value)}</textarea>`
      : `<input type="${type}" ${attrs} value="${h(value)}">`;
    return `<label class="field ${wide ? 'wide' : ''}"><span>${h(label)}${required ? ' *' : ''}</span>${input}</label>`;
  }).join('');
}

export function extract(defs, form, zone) {
  const data = new FormData(form);
  return Object.fromEntries(defs.map(def => {
    const value = data.get(def.name) ?? '';
    if (def.type === 'checkbox') return [def.name, data.has(def.name)];
    if (def.money) return [def.name, Math.round(Number(value) * 100)];
    if (def.number) return [def.name, Number(value)];
    if (def.zoned) return [def.name, fromLocal(value,zone)];
    if (def.name === 'tags') return [def.name, String(value).split(',').map(tag => tag.trim()).filter(Boolean)];
    return [def.name, value];
  }));
}

export function contactDetail(s, contact, canEdit) {
  const related = s.deals.filter(row => row.contactId === contact.id);
  const recent = s.messages.filter(row => row.contactId === contact.id).slice(0,6);
  return `<div class="detail-identity">${avatar(contact.company,0,'large')}<div><strong>${h(contact.company)}</strong><span>${h(contact.name || 'Practice contact')}</span></div></div>
    <dl class="settings-list"><dt>Email</dt><dd>${h(contact.email || '—')}</dd><dt>Phone</dt><dd>${h(contact.phone || '—')}</dd><dt>Location</dt><dd>${h([contact.city,contact.region].filter(Boolean).join(' · '))}</dd><dt>Website</dt><dd>${safeLink(contact.website,'Open website')} ${chip(contact.websiteStatus)}</dd><dt>Follow-up</dt><dd>${dayLabel(contact.followUp)}</dd><dt>Tags</dt><dd>${(contact.tags ?? []).map(tag => chip(tag,'blue')).join(' ') || '—'}</dd></dl>
    ${contact.notes ? `<div class="detail-block"><h3>Notes</h3><p>${h(contact.notes)}</p></div>` : ''}
    <div class="detail-block"><h3>Opportunities</h3>${related.length ? related.map(deal => `<div class="detail-row">${button(deal.title,{action:'deal',id:deal.id,kind:'ghost'})}${chip(stageName(s,deal.stage))}<strong>${dollars(deal.value)}</strong></div>`).join('') : '<p>No linked opportunities.</p>'}</div>
    <div class="detail-block"><h3>Recent conversations</h3>${recent.length ? recent.map(row => `<div class="detail-row"><span>${h(row.subject || row.body.slice(0,80))}</span>${chip(row.channel)}${chip(row.status,statusTone(row.status))}</div>`).join('') : '<p>No messages logged.</p>'}</div>
    <div class="detail-block"><h3>Timeline</h3>${activityFeed(s,8,s.activity.filter(row => row.contactId === contact.id))}</div>
    ${canEdit ? `<div class="action-row detail-actions">${button('Edit contact',{glyph:'square-pen',action:'edit:contacts',id:contact.id})}${button('New opportunity',{glyph:'plus',action:'new-deal-for',id:contact.id})}${button('Log or draft message',{glyph:'messages-square',action:'draft-for',id:contact.id})}</div>` : ''}`;
}

export function dealDetail(s, deal, canEdit, canBill) {
  return `<div class="detail-identity">${avatar(deal.title,1,'large')}<div><strong>${h(deal.title)}</strong><span>${h(contactName(s,deal.contactId))}</span></div></div>
    <dl class="settings-list"><dt>Pipeline stage</dt><dd>${chip(stageName(s,deal.stage),'blue')}</dd><dt>Deal value</dt><dd>${dollars(deal.value)}</dd><dt>Monthly retainer</dt><dd>${dollars(deal.mrr)}</dd><dt>Expected close</dt><dd>${dayLabel(deal.closeDate)}</dd>
    <dt>Demo</dt><dd>${safeLink(deal.demoUrl,'Open demo')}</dd><dt>Proposal</dt><dd>${safeLink(deal.proposalUrl,'Open external proposal')}</dd><dt>Payment</dt><dd>${safeLink(deal.paymentUrl,'Open external payment link')}</dd></dl>
    ${deal.notes ? `<div class="detail-block"><h3>Notes and objections</h3><p>${h(deal.notes)}</p></div>` : ''}
    <div class="detail-block"><h3>Timeline</h3>${activityFeed(s,8,s.activity.filter(row => row.dealId === deal.id))}</div>
    ${canEdit ? `<div class="action-row detail-actions">${button('Edit opportunity',{glyph:'square-pen',action:'edit:deals',id:deal.id})}${button('Create proposal',{glyph:'plus',action:'new-proposal-for',id:deal.id})}${canBill ? button('Create checkout',{glyph:'credit-card',action:'checkout',id:deal.id}) : ''}</div>` : ''}`;
}

export function proposalDetail(s, row, canEdit) {
  return `<div class="detail-row">${chip(row.status,statusTone(row.status))}<strong>${dollars(row.amount)} · ${h(row.cadence)}</strong></div>
    <dl class="settings-list"><dt>Practice</dt><dd>${h(contactName(s,row.contactId))}</dd><dt>Expires</dt><dd>${dayLabel(row.expires)}</dd>
    ${row.acceptedAt ? `<dt>Accepted by</dt><dd>${h(row.acceptedBy)} · ${h(timeLabel(row.acceptedAt,s.settings.timezone))}</dd>` : ''}
    </dl><div class="detail-block"><h3>Scope and terms</h3><p>${h(row.terms)}</p></div>
    <div class="action-row detail-actions">${row.linkToken && ['Published','Accepted'].includes(row.status) ? button('Copy private link',{glyph:'copy',action:'copy:proposal',id:row.linkToken}) : ''}${canEdit && row.status === 'Draft' ? button('Edit draft',{glyph:'square-pen',action:'edit:proposals',id:row.id}) : ''}
    ${canEdit && row.status === 'Published' ? button('Withdraw proposal',{action:'withdraw-proposal',id:row.id,kind:'danger-outline'}) : ''}</div>`;
}

export function stageInputs(stages) {
  return stages.map((stage,i) => `<div class="stage-edit-row" data-stage-input="${h(stage.id ?? '')}">
    <input aria-label="Stage ${i+1} name" data-stage-name maxlength="40" required value="${h(stage.name)}">
    <select aria-label="Stage ${i+1} outcome" data-stage-outcome>${fieldSelect([['open','Open'],['won','Won'],['lost','Lost']],stage.outcome)}</select>
    ${button('',{glyph:'trash-2',action:'stage-remove',title:'Remove stage',kind:'ghost'})}
  </div>`).join('');
}

export function defaultsFor(key, s) {
  if (key === 'tasks') return { due:day(new Date(),s.settings.timezone) };
  if (key === 'forms') return { active:true };
  if (key === 'messages') return { status:'Draft' };
  return {};
}

export function publicCapture(form) {
  const fields = [base('company','Practice or company',{required:true,max:140}),base('name','Your name',{max:100}),
    base('email','Email',{type:'email',max:254}),base('phone','Phone',{type:'tel',max:40}),
    ...(form.type === 'Booking request' ? [base('requested','Preferred date',{type:'date',required:true,wide:true})] : []),
    area('notes','How can we help?',1200,5)];
  return `<form data-external="capture"><div class="form-grid">${formFields(fields)}
    <label class="trap">Website<input type="text" name="homepage" tabindex="-1" autocomplete="off"></label></div>
    <p class="form-error" role="alert"></p><button class="button primary" type="submit">${icon('send')} ${form.type === 'Booking request' ? 'Send booking request' : 'Send inquiry'}</button></form>`;
}
