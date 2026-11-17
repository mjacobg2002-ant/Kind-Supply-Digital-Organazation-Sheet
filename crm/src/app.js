import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/manrope/wght.css';
import './style.css';
import { avatar, button, chip, dollars, example, h, hashLink, icon, primary, safeLink, timeLabel } from './ui.js';
import { sections, pages, renderPage } from './views.js';
import { contactDetail, dealDetail, defaultsFor, extract, fieldsFor, formFields, proposalDetail, publicCapture, singular, stageInputs } from './forms.js';
import { contactsCsv, parseCsv } from './csv.js';
import { demoSave, demoSpace, newDemoSpace, prepareDemo, sampleUser } from './demo.js';

const root = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const publicParams = new URLSearchParams(location.search);
const ui = { page:'dashboard', filters:{}, demo:false, workspace:null, workspaces:[], user:null, sidebar:false, switcher:false };
let modalSubmit;
let toastTimer;
let busy = false;
let calendarSyncRunning = false;
let stripeSyncRunning = false;
const manager = () => ['admin','owner'].includes(ui.workspace?.role);
const canEdit = () => ui.workspace && ui.workspace.role !== 'viewer';
const state = () => ui.workspace.state;
const find = (key,id) => state()[key].find(row => row.id === id);
const endpoint = route => '/api/crm?route=' + encodeURIComponent(route);
const pagesAllowed = () => sections.flatMap(([,rows]) => rows);

async function api(route, input) {
  const res = await fetch(endpoint(route), input == null ? undefined : {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(input)
  });
  const value = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(value.error || 'The CRM could not reach its server.'), { status:res.status });
  return value;
}

function notify(message, error = false) {
  clearTimeout(toastTimer);
  toast.className = error ? 'visible error' : 'visible';
  toast.innerHTML = `${icon(error ? 'triangle-alert' : 'circle-check')}<span>${h(message)}</span>`;
  toastTimer = setTimeout(() => { toast.className = ''; },5500);
}

const mark = () => '<span class="brand-mark" aria-hidden="true"><b>K</b><i></i></span>';
const brand = () => `<div class="brand">${mark()}<div><strong>Kind Supply</strong><span>CRM</span></div></div>`;

function navigate(page) {
  if (!Object.hasOwn(pages,page)) return;
  if (dialog.open) dialog.close();
  ui.page = page;
  ui.sidebar = false;
  ui.switcher = false;
  history.replaceState(null,'','#' + page);
  render();
  if (page==='calendar' && ui.workspace?.integrations.google?.connected) syncConnectedCalendar(true);
  window.scrollTo(0,0);
}

async function loadWorkspaces() {
  if (ui.demo) {
    ui.user = sampleUser;
    ui.workspaces = prepareDemo();
  } else {
    const me = await api('auth/me');
    ui.user = me.user;
    ui.workspaces = me.workspaces;
  }
}

async function loadWorkspace(id) {
  ui.workspace = ui.demo ? demoSpace(id) : await api('workspaces/' + id);
  sessionStorage.setItem('ksd-crm-space-' + (ui.demo ? 'demo' : 'live'),id);
  ui.switcher = false;
}

async function save(route,input) {
  const ws = ui.workspace;
  const result = ui.demo ? demoSave(ws,route,input) : await api('workspaces/' + ws.id + '/' + route,input);
  await loadWorkspace(ws.id);
  render();
  return result;
}

function navRow(row) {
  const [id,title,glyph] = row;
  return `<button type="button" class="nav-item ${id === ui.page ? 'active' : ''}" data-action="nav:${id}" ${id === ui.page ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${title}</span></button>`;
}

function actionForPage(action) {
  if (!action) return false;
  if (action === 'export-all') return true;
  if (['checkout','new:forms','new:workflows'].includes(action)) return manager();
  return canEdit();
}

function render() {
  if (!ui.workspace) return;
  const ws = ui.workspace;
  const [title,subtitle,cta,action] = pages[ui.page] ?? pages.dashboard;
  const ctaIcon = action === 'export-all' ? 'download' : action === 'checkout' ? 'credit-card' : 'plus';
  document.title = title + ' · Kind Supply CRM';
  root.innerHTML = `<div class="shell">
      <aside class="sidebar ${ui.sidebar ? 'sidebar-open' : ''}">
        ${brand()}
        <div class="workspace-switch"><button type="button" class="workspace-button" data-action="switcher" aria-expanded="${ui.switcher}">
          <span class="workspace-icon">${icon('building-2')}</span><span class="row-main"><strong>${h(ws.name)}</strong><small>${ui.demo ? 'Demo workspace' : 'Workspace'}</small></span>${icon('chevrons-up-down')}</button>
          ${ui.switcher ? `<div class="workspace-menu">${ui.workspaces.map(row => `<button type="button" data-action="workspace" data-id="${h(row.id)}">${icon(row.id === ws.id ? 'check' : 'building-2')}<span>${h(row.name)}</span></button>`).join('')}
            ${manager() ? `<button type="button" data-action="new-workspace">${icon('plus')}<span>New workspace</span></button>` : ''}</div>` : ''}
        </div>
        <nav aria-label="Main navigation">${sections.map(([name, rows]) => `<div class="nav-group"><p>${name}</p>${rows.map(navRow).join('')}</div>`).join('')}</nav>
        <div class="sidebar-bottom">${navRow(['settings','Settings','settings'])}<div class="sidebar-user">${avatar(ui.user.name,0)}<span class="row-main"><strong>${h(ui.user.name)}</strong><span>${h(ws.role)}</span></span>
          ${!ui.demo ? button('',{glyph:'log-out',action:'logout',kind:'sidebar-icon',title:'Sign out'}) : ''}</div></div>
      </aside>
      ${ui.sidebar ? '<button type="button" class="mobile-scrim" data-action="toggle-sidebar" aria-label="Close sidebar"></button>' : ''}
      <div class="viewport"><header class="topbar">
        <div class="breadcrumb">${button('',{glyph:'menu',action:'toggle-sidebar',kind:'ghost mobile-menu',title:'Open navigation'})}<span>Workspace</span>${icon('chevron-right')}<strong>${title}</strong></div>
        <div class="top-actions"><button class="top-search" type="button" data-action="search">${icon('search')}<span>Search workspace</span><kbd>⌘ K</kbd></button>
          ${button('',{glyph:'refresh-cw',action:'refresh',kind:'ghost',title:'Refresh workspace'})}</div>
      </header>
      <main class="content" id="main"><div class="page-heading"><div>
        <div class="heading-row"><h1>${title}</h1>${ui.demo && ui.page === 'dashboard' ? chip('Demo data','amber') : ''}</div><p>${subtitle}</p>
        </div>${actionForPage(action) ? primary(cta,action,ctaIcon) : ''}</div>
        <div id="page-view">${renderPage(ws,ui)}</div>
      </main></div></div>`;
}

function modal(title, body, { submit, label = 'Save', description = '', extra = '' } = {}) {
  modalSubmit = submit;
  dialog.innerHTML = `<div class="modal-head"><div><h2 id="modal-title">${h(title)}</h2>${description ? `<p>${h(description)}</p>` : ''}</div>
    ${button('',{glyph:'x',action:'close',kind:'ghost',title:'Close'})}</div>
    ${submit ? `<form id="modal-form"><div class="modal-body">${body}<p class="form-error" role="alert"></p></div><div class="modal-foot">
      <div>${extra}</div><div class="action-row">${button('Cancel',{action:'close'})}<button type="submit" class="button primary">${h(label)}</button></div></div></form>`
      : `<div class="modal-body">${body}<p class="form-error" role="alert"></p></div>`}`;
  dialog.setAttribute('aria-labelledby','modal-title');
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => (dialog.querySelector('[autofocus]') ?? dialog.querySelector('input:not([type=checkbox]), select, textarea, button'))?.focus());
}

function formModal(title,defs,data,submit,options = {}) {
  const zone = ui.workspace?.state.settings.timezone;
  modal(title,`<div class="form-grid">${formFields(defs,data,zone)}</div>`,{
    ...options, submit:form => submit(extract(defs,form,zone))
  });
}

function editRecord(key, row, prefills = {}) {
  if (!canEdit() || (['workflows','forms'].includes(key) && !manager())) return;
  const s = state();
  if ((key === 'deals' || key === 'messages') && !s.contacts.length) {
    return modal('Add a contact first',example('users','This record needs a contact','Create a contact and return here to continue.',primary('Add contact','new:contacts')));
  }
  if (key === 'proposals' && !s.deals.length) {
    return modal('Add an opportunity first',example('columns-3','This proposal needs an opportunity','Add an opportunity to associate with the proposal.',primary('Add opportunity','new:deals')));
  }
  const defs = fieldsFor(s,key).map(def => row?.smsOptedOutAt && def.name === 'smsAllowed' ? { ...def,label:'SMS opt-out is active. The recipient must text START first.' } : def);
  let description = ({
    events:'Appointment times use ' + s.settings.timezone + '.',
    messages:'Save a draft, record a reply, or log outreach that happened outside the CRM.',
    proposals:'Publishing creates a private link and fixes the terms for review.',
    workflows:'Each matching event runs one action. Draft messages stay in the inbox for review.',
    forms:'New form submissions create a contact and an opportunity.'
  })[key];
  if (ui.demo && ['proposals','forms','workflows'].includes(key)) description += ' Live links and automation require a configured workspace.';
  formModal((row ? 'Edit ' : 'New ') + singular[key],defs,{ ...defaultsFor(key,s),...row,...prefills },async input => {
    if (row) Object.assign(input,{ id:row.id,version:row.version });
    const result = await save('records/' + key,input);
    dialog.close();
    if (key === 'messages') ui.filters.thread = result.contactId;
    render();
    notify(result.calendarIssue || 'Saved ' + singular[key] + '.',Boolean(result.calendarIssue));
  },{
    description, extra:row ? button('Delete',{glyph:'trash-2',action:'delete:' + key,id:row.id,kind:'danger-outline'}) : ''
  });
}

function confirmAction(title, description, label, action) {
  modal(title,`<p class="confirmation-copy">${h(description)}</p>`,{ label,submit:async () => { await action(); dialog.close(); } });
}

function checkoutModal(dealId) {
  if (!manager()) return;
  if (!ui.workspace.integrations.stripe) {
    return modal('Connect Stripe',example('credit-card','Stripe setup is required','Set the Stripe key and webhook secret on the Vercel project to start creating checkout links.',button('Open integration settings',{action:'nav:settings'})));
  }
  if (!state().deals.length) return modal('Add an opportunity first',example('columns-3','Checkout needs an opportunity','Create an opportunity and add its pricing first.',primary('New opportunity','new:deals')));
  const deals = state().deals.map(row => [row.id,row.title]);
  const prices = ui.workspace.integrations.stripePrices;
  const defs = [
    {name:'dealId',label:'Opportunity',type:'select',choices:deals,required:true},
    {name:'mode',label:'Billing type',type:'select',choices:[['payment','One-time payment'],...(prices.length ? [['subscription','Monthly subscription']] : [])]},
    {name:'amount',label:'One-time amount (USD)',type:'number',money:true,min:0,step:'0.01'},
    ...(prices.length ? [{name:'price',label:'Monthly Stripe price',type:'select',choices:prices,blank:'Select if monthly'}] : [])
  ];
  const requestId = crypto.randomUUID();
  formModal('Create Stripe checkout',defs,{dealId,amount:find('deals',dealId)?.value},async input => {
    const result = await save('checkout',{...input,requestId});
    modal('Checkout link ready',`<p class="confirmation-copy">Share this Stripe-hosted link with your client. It expires ${h(timeLabel(result.expiresAt,state().settings.timezone))}.</p>
      <div class="action-row">${safeLink(result.checkoutUrl,'Open checkout')}${button('Copy checkout link',{glyph:'copy',action:'copy-payment',id:result.id})}</div>`);
  },{label:'Create checkout',description:'Monthly checkout uses the opportunity’s monthly amount and the selected recurring Stripe price.'});
}

async function copy(value) {
  if (!value) throw new Error('No link is available yet.');
  try { await navigator.clipboard.writeText(value); notify('Link copied.'); }
  catch {
    modal('Copy this link',`<label class="field"><span>Link</span><input type="url" readonly value="${h(value)}" autofocus></label>`);
    dialog.querySelector('input').select();
  }
}

async function searchResults(value) {
  const node = dialog.querySelector('#search-results');
  if (!node) return;
  const query = value.trim().toLowerCase();
  if (!query) { node.innerHTML = '<p class="muted">Type to find contacts, opportunities, or pages.</p>'; return; }
  const parts = [
    ...pagesAllowed().filter(([,title]) => title.toLowerCase().includes(query)).slice(0,4).map(([id,title,glyph]) => [title,'Page',glyph,'nav:' + id,'']),
    ...state().contacts.filter(row => [row.company,row.name,row.email,row.city].join(' ').toLowerCase().includes(query)).slice(0,8).map(row => [row.company,row.name || 'Contact','users','contact',row.id]),
    ...state().deals.filter(row => row.title.toLowerCase().includes(query)).slice(0,6).map(row => [row.title,'Opportunity','columns-3','deal',row.id])
  ];
  node.innerHTML = parts.length ? parts.map(([name,detail,glyph,action,id]) => `<button type="button" class="search-result" data-action="${action}" data-id="${h(id)}">
    ${icon(glyph)}<span class="row-main"><strong>${h(name)}</strong><span>${h(detail)}</span></span>${icon('chevron-right')}</button>`).join('') : '<p class="muted">No matches found.</p>';
}

function openSearch() {
  modal('Search workspace',`<label class="input-icon modal-search">${icon('search')}<input autofocus type="search" data-search placeholder="Contact, opportunity, or page…" aria-label="Search workspace"></label><div id="search-results"></div>`);
  searchResults('');
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content],{ type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function stagesModal() {
  if (!manager()) return;
  modal('Edit pipeline stages',`<div id="stage-inputs">${stageInputs(state().stages)}</div>
    ${button('Add stage',{glyph:'plus',action:'stage-add'})}`,{
    description:'Keep at least one open, won, and lost stage.',
    submit:async form => {
      const stages = [...form.querySelectorAll('[data-stage-input]')].map(row => ({id:row.dataset.stageInput,name:row.querySelector('[data-stage-name]').value,outcome:row.querySelector('[data-stage-outcome]').value}));
      await save('stages',{stages});
      dialog.close();
      notify('Pipeline stages saved.');
    }
  });
}

function memberModal(member) {
  if (ui.workspace.role !== 'owner') return;
  formModal('Manage ' + member.name,[{name:'role',label:'Workspace role',type:'select',choices:['admin','member','viewer',['remove','Remove workspace access']]}],
    {role:member.role},async input => { await save('member',{...input,userId:member.id}); dialog.close(); notify('Team access updated.'); });
}

function googleSetup() {
  const callback=location.origin+'/api/google-calendar';
  modal('Connect your Google Calendar',`<p class="setup-note">Create the Google connection once, then use Connect calendar to approve access.</p>
    <ol class="setup-instructions">
      <li>Open <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud</a>, choose a project, and enable Google Calendar API.</li>
      <li>In Google Auth Platform, configure your app audience. For a testing app, add the Google account you plan to connect as a test user.</li>
      <li>Create an OAuth client for a Web application. Add this exact authorized redirect URI<br><code>${h(callback)}</code></li>
      <li>Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> as sensitive Production environment variables in the CRM’s Vercel project, then redeploy.</li>
    </ol><p class="setup-note">Your calendar connection is encrypted on the server. Google access is approved from your Google account.</p>
    <div class="action-row">${button('Copy redirect URI',{action:'copy-literal',id:callback,glyph:'copy'})}</div>`);
}

async function connectGoogle() {
  if (ui.demo) return notify('Connect Google from your live workspace.');
  if (!ui.workspace.integrations.google?.configured) return googleSetup();
  const result=await api('workspaces/'+ui.workspace.id+'/calendar/connect',{});
  const url=new URL(result.url);
  if (url.origin!=='https://accounts.google.com') throw new Error('The Google authorization address is invalid.');
  location.assign(url.href);
}
async function googleSettings() {
  const google=ui.workspace.integrations.google || {};
  if (!google.connected) return google.configured && !ui.demo
    ? modal('Google Calendar',example('calendar-days','Connect your calendar','Approve access to create appointments and track Google Calendar changes.',button('Connect calendar',{action:'google-connect',glyph:'link',kind:'primary'})))
    : googleSetup();
  const result=await api('workspaces/'+ui.workspace.id+'/calendar/calendars',{});
  const defs=[{name:'calendarId',label:'Calendar to sync',type:'select',required:true,choices:result.calendars.map(row=>[row.id,row.name+(row.primary ? ' (primary)' : '')])}];
  formModal('Google Calendar settings',defs,{calendarId:google.calendarId},async input=>{
    await save('calendar/select',input);dialog.close();await syncConnectedCalendar();
  },{label:'Save calendar',description:'Google imports the previous 90 days and the next year. CRM changes sync to the selected calendar.',
    extra:button('Disconnect',{action:'google-disconnect',kind:'danger-outline'})});
}
async function syncConnectedCalendar(silent=false) {
  if (calendarSyncRunning || ui.demo || !ui.workspace?.integrations.google?.connected || !canEdit()) return;
  if (silent && ui.workspace.integrations.google.lastSync && Date.now()-Date.parse(ui.workspace.integrations.google.lastSync)<300000) return;
  const workspaceId=ui.workspace.id;
  calendarSyncRunning=true;
  if (!silent) notify('Syncing Google Calendar…');
  try {
    let result;
    let batches=0;
    do {
      result=await api('workspaces/'+workspaceId+'/calendar/sync',{});
      batches++;
    } while ((result.more || result.pending) && batches<50 && ui.workspace.id===workspaceId);
    if (ui.workspace.id===workspaceId) {await loadWorkspace(workspaceId);render();}
    if (!silent) notify(result.more || result.pending ? 'Calendar sync has more changes. Sync again to continue.' : 'Google Calendar is up to date.');
  } catch(error) {
    if (ui.workspace.id===workspaceId) {await loadWorkspace(workspaceId).catch(()=>{});render();}
    if (!silent || ui.page==='calendar') notify(error.message,true);
  } finally {calendarSyncRunning=false;}
}
function stripeSetup() {
  const hook=location.origin+endpoint('webhook/stripe');
  modal('Connect Stripe reporting',`<ol class="setup-instructions">
    <li>Add a restricted Stripe key as <code>STRIPE_API_KEY</code> in the CRM’s Vercel project. Allow Checkout creation and read access to charges, refunds, invoices, invoice payments, prices, and subscriptions.</li>
    <li>Set <code>INTEGRATION_WORKSPACE_ID</code> to <code>${h(ui.workspace.id)}</code>.</li>
    <li>In Stripe Workbench, add a webhook endpoint using <code>${h(hook)}</code>, then save its signing secret in Vercel as <code>STRIPE_WEBHOOK_SECRET</code>. The repository guide lists the required payment and subscription events.</li>
    <li>Redeploy, then select Sync Stripe on the Payments page to import existing payments and subscriptions. New billing events update the dashboard automatically.</li>
  </ol><p class="setup-note">Configure Stripe Tax separately if tax collection applies to your services.</p><div class="action-row">
    ${button('Copy workspace ID',{action:'copy-literal',id:ui.workspace.id,glyph:'copy'})}
    ${button('Copy webhook URL',{action:'copy-literal',id:hook,glyph:'copy'})}
    <a class="text-link" href="https://github.com/mjacobg2002-ant/Kind-Supply-Digital-Organazation-Sheet/blob/main/crm/README.md#stripe" target="_blank" rel="noopener noreferrer">Setup guide</a></div>`);
}
async function syncStripeAccount() {
  if (stripeSyncRunning || ui.demo || !manager() || !ui.workspace.integrations.stripe) return;
  const workspaceId=ui.workspace.id;
  stripeSyncRunning=true;
  notify('Importing Stripe payments and subscriptions…');
  try {
    for (const kind of ['invoices','charges','subscriptions']) {
      let cursor='';
      let batches=0;
      do {
        const result=await api('workspaces/'+workspaceId+'/stripe-sync',{kind,cursor});
        cursor=result.cursor;
        batches++;
      } while (cursor && batches<100);
      if (cursor) throw new Error('More Stripe history remains. Run sync again to continue.');
    }
    if (ui.workspace.id===workspaceId) {await loadWorkspace(workspaceId);render();}
    notify('Stripe account activity is up to date.');
  } catch(error) {
    if (ui.workspace.id===workspaceId) {await loadWorkspace(workspaceId).catch(()=>{});render();}
    notify(error.message,true);
  } finally {stripeSyncRunning=false;}
}

async function handleAction(action, id, element) {
  const [group,key] = action.split(':');
  const area = ui.workspace;
  if (action === 'copy-literal') return copy(id);
  if (action === 'close') return dialog.close();
  if (!area) return;
  if (group === 'nav') return navigate(key);
  if (group === 'new') return editRecord(key,null,key === 'deals' && id ? {stage:id} : {});
  if (group === 'edit') return editRecord(key,find(key,id));
  if (group === 'delete') {
    const row = find(key,id);
    return confirmAction('Delete ' + singular[key] + '?','This removes the record from your workspace.','Delete',async () => {
      await save('records/' + key + '/delete',{id,version:row.version}); notify('Record deleted.');
    });
  }
  if (group === 'copy') return copy(hashLink(key,id));
  if (group === 'copy-webhook') return copy(location.origin + endpoint('webhook/' + key + '/' + id));
  if (action === 'toggle-sidebar') { ui.sidebar = !ui.sidebar; return render(); }
  if (action === 'switcher') { ui.switcher = !ui.switcher; return render(); }
  if (action === 'workspace') {
    ui.filters = {};
    await loadWorkspace(id);
    return navigate('dashboard');
  }
  if (action === 'new-workspace') return formModal('New workspace',[{name:'name',label:'Workspace name',required:true,max:100}],{},async input => {
    const id = ui.demo ? newDemoSpace(input.name) : (await api('workspaces',input)).id;
    await loadWorkspaces();
    await loadWorkspace(id);
    navigate('dashboard');
  },{label:'Create workspace',description:'Each workspace has its own contacts, pipeline, team, and activity.'});
  if (action === 'workspace-settings') return formModal('Edit workspace profile',[
    {name:'name',label:'Workspace name',required:true,max:100},{name:'timezone',label:'IANA time zone',required:true,max:100}
  ],{name:area.name,timezone:state().settings.timezone},async input => {
    await save('settings',input);
    await loadWorkspaces();
    dialog.close();
    render();
    notify('Workspace profile saved.');
  });
  if (action === 'invite') return formModal('Invite a team member',[
    {name:'email',label:'Email',type:'email',required:true,max:254},
    {name:'role',label:'Role',type:'select',choices:['member','viewer',...(area.role === 'owner' ? ['admin'] : [])]}
  ],{},async input => {
    const result = await save('invite',input);
    modal('Invitation ready',`<p class="confirmation-copy">Share this one-time link with ${h(input.email)}. It expires in 72 hours.</p>
      <label class="field"><span>Invitation link</span><input readonly value="${h(hashLink('invite',result.token))}" autofocus></label>
      <div class="detail-actions">${button('Copy invitation',{glyph:'copy',action:'copy:invite',id:result.token})}</div>`);
  },{label:'Create invitation'});
  if (action === 'member') return memberModal(area.members.find(row => row.id === id));
  if (action === 'generate-inbound') { await save('inbound',{}); return notify('Webhook addresses created.'); }
  if (action === 'rotate-inbound') return confirmAction('Rotate webhook addresses?','Update your provider dashboards after rotating. The old addresses will stop accepting events.','Rotate',async () => {
    await save('inbound',{rotate:true}); notify('Webhook addresses rotated.');
  });
  if (action === 'logout') {
    await api('auth/logout',{});
    ui.workspace = null;
    return signIn();
  }
  if (action === 'refresh') { await loadWorkspace(area.id); render(); return notify('Workspace refreshed.'); }
  if (action === 'contact') {
    const contact = find('contacts',id);
    return modal('Contact details',contactDetail(state(),contact,canEdit()));
  }
  if (action === 'deal') return modal('Opportunity details',dealDetail(state(),find('deals',id),canEdit(),manager()));
  if (action === 'proposal-detail') {
    const row = find('proposals',id);
    return modal(row.title,proposalDetail(state(),row,canEdit()));
  }
  if (action === 'event') {
    const row = find('events',id);
    return modal(row.title,`<p>${h(timeLabel(row.startsAt,state().settings.timezone))} to ${h(timeLabel(row.endsAt,state().settings.timezone))}</p><p>${h(row.location)}</p><p>${h(row.notes)}</p><div class="detail-actions">${safeLink(row.google?.url,'Open in Google Calendar')}</div>`);
  }
  if (action === 'withdraw-proposal') {
    const row = find('proposals',id);
    return confirmAction('Withdraw proposal?','The private link will stop accepting this proposal.','Withdraw',async () => {
      await save('records/proposals',{id,version:row.version,status:'Withdrawn'}); notify('Proposal withdrawn.');
    });
  }
  if (action === 'new-proposal-for') {
    const row = find('deals',id);
    return editRecord('proposals',null,{dealId:id,amount:row.mrr || row.value,cadence:row.mrr ? 'Monthly' : 'One-time'});
  }
  if (action === 'new-deal-for') return editRecord('deals',null,{contactId:id,title:find('contacts',id).company});
  if (action === 'draft-for') return editRecord('messages',null,{contactId:id});
  if (action === 'toggle-task' && canEdit()) {
    const row = find('tasks',id);
    await save('records/tasks',{...row,done:!row.done});
    return notify(row.done ? 'Task reopened.' : 'Task completed.');
  }
  if (action === 'task-filter' || action === 'thread') {
    ui.filters[action === 'thread' ? 'thread' : 'taskStatus'] = id;
    return render();
  }
  if (action.startsWith('month-')) {
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:state().settings.timezone}).format(new Date()).slice(0,7);
    const cursor = new Date((ui.filters.month || today) + '-01T12:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth() + (action === 'month-next' ? 1 : -1));
    ui.filters.month = action === 'month-current' ? today : cursor.toISOString().slice(0,7);
    return render();
  }
  if (action === 'send') {
    const row = find('messages',id);
    return confirmAction('Send this draft?', 'Send this ' + row.channel.toLowerCase() + ' through your configured messaging account.', 'Send',async () => {
      const result = await save('send',{id,version:row.version});
      notify(result.status === 'Submitted' ? 'Draft submitted to the provider.' : 'Message status: ' + result.status,result.status !== 'Submitted');
    });
  }
  if (action==='google-connect') return connectGoogle();
  if (action==='google-settings') return googleSettings();
  if (action==='google-sync') return syncConnectedCalendar();
  if (action==='google-disconnect') return confirmAction('Disconnect Google Calendar?','Existing appointments stay in the CRM. Synchronization stops until you reconnect.','Disconnect',async()=>{
    await save('calendar/disconnect',{});notify('Google Calendar disconnected.');
  });
  if (action==='google-resolve') return confirmAction('Use the Google version?','Replace the CRM appointment details with the current Google Calendar version.','Use Google version',async()=>{
    await save('calendar/resolve',{id});notify('Appointment conflict resolved.');
  });
  if (action==='google-setup') return googleSetup();
  if (action==='stripe-setup') return stripeSetup();
  if (action==='stripe-sync') return syncStripeAccount();
  if (action === 'checkout') return checkoutModal(id);
  if (action === 'copy-payment') return copy(find('payments',id)?.checkoutUrl);
  if (action === 'stages') return stagesModal();
  if (action === 'stage-add') return dialog.querySelector('#stage-inputs').insertAdjacentHTML('beforeend',stageInputs([{name:'',outcome:'open'}]));
  if (action === 'stage-remove') return element.closest('[data-stage-input]').remove();
  if (action === 'search') return openSearch();
  if (action === 'export-contacts') return download('kind-supply-contacts.csv',contactsCsv(state().contacts),'text/csv');
  if (action === 'export-all') {
    const { inbound, ...settings } = state().settings;
    return download('kind-supply-crm-export.json',JSON.stringify({...state(),settings},null,2),'application/json');
  }
  if (action === 'import') return modal('Import contacts from CSV',
    `<label class="field"><span>CSV file *</span><input type="file" name="file" accept=".csv,text/csv" required></label>
      <p class="confirmation-copy">Include a Practice or Company column. Common fields include Contact, Email, Phone, City, Region, Website, Website Status, Tags, and Notes.</p>`,{
    label:'Import contacts',description:'Import up to 500 contacts per file.',
    submit:async form => {
      const file = form.elements.file.files[0];
      if (file.size > 700000) throw new Error('Use a CSV file smaller than 700 KB.');
      const rows = parseCsv(await file.text());
      if (rows.length > 500) throw new Error('Split this file into groups of 500 rows or fewer.');
      const result = await save('import',{rows});
      if (!result.errors.length) { dialog.close(); notify(`Imported ${result.added} contacts. Skipped ${result.duplicates} duplicates.`); }
      else modal('CSV import results',`<p>Imported ${result.added}. Skipped ${result.duplicates} duplicates. ${result.errors.length} rows need a correction.</p>
        <ul class="import-errors">${result.errors.map(row => `<li>Row ${row.row}: ${h(row.message)}</li>`).join('')}</ul>`);
    }
  });
}

function authLayout(title,subtitle,body) {
  root.innerHTML = `<main class="auth-screen"><div class="auth-panel">${brand()}<h1>${h(title)}</h1>${subtitle ? `<p class="auth-description">${h(subtitle)}</p>` : ''}${body}</div></main>`;
}

function signIn() {
  const token = publicParams.get('invite');
  const checkoutStatus = publicParams.get('checkout');
  if (checkoutStatus) {
    const confirmed = checkoutStatus === 'confirmed';
    return authLayout(confirmed ? 'Checkout submitted' : 'Checkout canceled', confirmed ? 'Stripe will confirm payment separately.' : 'Ask your Kind Supply Digital contact for help if you need a new checkout link.', '');
  }
  const fields = [
    ...(token ? [{name:'name',label:'Your name',max:100}] : []),
    {name:'email',label:'Email address',type:'email',required:true,max:254},
    {name:'password',label:'Password',type:'password',required:true,max:256}
  ];
  authLayout(token ? 'Accept invitation' : 'Sign in to your CRM', token ? 'Enter the email address used for your invitation.' : 'Access your Kind Supply Digital workspace.',
    `<form data-external="${token ? 'invite' : 'login'}"><div class="form-grid">${formFields(fields)}</div><p class="form-error" role="alert"></p>
    <button class="button primary" type="submit">${token ? 'Join workspace' : 'Sign in'}</button></form>`);
}

async function publicPage(kind, token) {
  const record = await api('public/' + kind + '/' + token);
  if (kind === 'capture') return authLayout(record.title,record.description,publicCapture(record));
  const body = `<p class="public-terms">${h(record.terms)}</p><div class="public-amount">${dollars(record.amount)} <span>${h(record.cadence)}</span></div>`;
  if (record.status === 'Accepted') return authLayout(record.title,record.company,body + chip('Accepted','green'));
  if (record.expired) return authLayout(record.title,record.company,body + chip('Expired','amber'));
  authLayout(record.title,record.company,body + `<form data-external="proposal"><div class="form-grid">
    ${formFields([{name:'name',label:'Your name',required:true,max:100},{name:'agree',label:'I accept the scope and terms above.',type:'checkbox',required:true,wide:true}])}
    </div><p class="form-error" role="alert"></p><button class="button primary" type="submit">Accept proposal</button></form>`);
}

async function startWorkspace() {
  await loadWorkspaces();
  const last = sessionStorage.getItem('ksd-crm-space-' + (ui.demo ? 'demo' : 'live'));
  const first = ui.workspaces.find(row => row.id === last) || ui.workspaces[0];
  if (!first) return authLayout('No workspace access','A workspace owner can invite you to their team.', '');
  await loadWorkspace(first.id);
  ui.page = Object.hasOwn(pages,location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  render();
  if (publicParams.has('google')) {
    const status=publicParams.get('google');
    history.replaceState(null,'','#settings');
    if (status==='connected') {notify('Google Calendar connected. Choose the calendar to sync.');await googleSettings();}
    else notify(status==='denied' ? 'Google Calendar connection was canceled.' : 'Google Calendar could not connect. Start again from Settings.',true);
  } else if (ui.page==='calendar') syncConnectedCalendar(true);
}

document.addEventListener('click',event => {
  const element = event.target.closest('[data-action]');
  if (!element || busy) return;
  handleAction(element.dataset.action,element.dataset.id,element).catch(error => notify(error.message,true));
});

document.addEventListener('submit',async event => {
  const form = event.target;
  const external = form.dataset.external;
  if (form.id !== 'modal-form' && !external) return;
  event.preventDefault();
  if (busy) return;
  busy = true;
  const errorMessage = form.querySelector('.form-error');
  const submit = form.querySelector('button[type=submit]');
  if (errorMessage) errorMessage.textContent = '';
  if (submit) submit.disabled = true;
  try {
    if (!external) return await modalSubmit(form);
    const input = Object.fromEntries(new FormData(form));
    if (external === 'login' || external === 'invite') {
      if (external === 'invite') input.token = publicParams.get('invite');
      await api('auth/' + external,input);
      history.replaceState(null,'','/');
      return await startWorkspace();
    }
    input.agree = input.agree === 'on';
    await api('public/' + external + '/' + publicParams.get(external),input);
    authLayout(external === 'proposal' ? 'Proposal accepted' : 'Thank you',external === 'proposal' ? 'Your acceptance was recorded.' : 'Your request was sent. The team will be in touch.', '');
  } catch (error) {
    if (errorMessage) errorMessage.textContent = error.message;
    else notify(error.message,true);
  } finally {
    busy = false;
    if (submit) submit.disabled = false;
  }
});

document.addEventListener('input',event => {
  const input = event.target;
  if (input.dataset.search !== undefined) searchResults(input.value);
  if (input.type === 'search' && input.dataset.filter) {
    const field = input.dataset.filter;
    const cursor = input.selectionStart;
    ui.filters[field] = input.value;
    document.querySelector('#page-view').innerHTML = renderPage(ui.workspace,ui);
    const replacement = document.querySelector(`[data-filter="${field}"]`);
    replacement?.focus();
    if (cursor != null && replacement?.setSelectionRange) replacement.setSelectionRange(cursor,cursor);
  }
});
document.addEventListener('change',event => {
  if (event.target.tagName === 'SELECT' && event.target.dataset.filter) {
    ui.filters[event.target.dataset.filter] = event.target.value;
    render();
  }
});
document.addEventListener('keydown',event => {
  if (ui.workspace && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); openSearch();
  }
});

let dragged;
document.addEventListener('dragstart',event => {
  const card = event.target.closest('[data-deal]');
  if (!card || !canEdit()) return;
  dragged = card.dataset.deal;
  event.dataTransfer.setData('text/plain',dragged);
  event.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover',event => {
  if (dragged && event.target.closest('[data-stage]')) event.preventDefault();
});
document.addEventListener('drop',event => {
  const stage = event.target.closest('[data-stage]')?.dataset.stage;
  if (!stage || !dragged) return;
  event.preventDefault();
  const row = find('deals',dragged);
  dragged = null;
  if (row.stage !== stage) save('records/deals',{...row,stage}).then(() => notify('Opportunity moved.'),error => notify(error.message,true));
});
document.addEventListener('dragend',() => { dragged = null; });

async function start() {
  const publicKind = ['capture','proposal'].find(key => publicParams.has(key));
  if (publicKind) return publicPage(publicKind,publicParams.get(publicKind));
  if (publicParams.has('invite') || publicParams.has('checkout')) return signIn();
  const health = await api('health').catch(() => ({}));
  ui.demo = health.demo === true;
  if (!ui.demo && health.ready === false) {
    return authLayout('CRM setup required','Connect the database and bootstrap the workspace owner using the repository’s deployment guide.', '');
  }
  try { await startWorkspace(); }
  catch (error) {
    if ([401,403].includes(error.status)) signIn();
    else throw error;
  }
}
setInterval(()=>{
  if (document.visibilityState==='visible' && ui.workspace) syncConnectedCalendar(true);
},300000);
document.addEventListener('visibilitychange',()=>{
  if (document.visibilityState==='visible' && ui.workspace) syncConnectedCalendar(true);
});
start().catch(error => authLayout('CRM unavailable',error.message,''));
