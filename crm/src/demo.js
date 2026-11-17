const stages = [
  ['new','New lead','open'], ['contacted','Contacted','open'], ['replied','Replied','open'],
  ['demo','Demo sent','open'], ['proposal','Proposal sent','open'], ['won','Won','won'], ['lost','Lost','lost']
].map(([id,name,outcome]) => ({ id,name,outcome }));
const when = (days = 0, hour = 18) => {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + days);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString();
};
const companies = [
  ['Cedar Grove Dental','Dr. Morgan Ellis','McLean','Northern Virginia','proposal','Needs improvement'],
  ['Juniper Dental Arts','Dr. Avery Thompson','Washington','Washington, DC','demo','Working'],
  ['Harborview Family Dental','Dr. Jordan Blake','Towson','Maryland','replied','Broken'],
  ['Maple Ridge Dentistry','Dr. Riley Brooks','Vienna','Northern Virginia','contacted','Needs improvement'],
  ['Oak & Elm Dental Studio','Dr. Cameron Reed','Arlington','Northern Virginia','proposal','Working'],
  ['Northline Dental Care','Dr. Peyton Morgan','Sterling','Northern Virginia','won','Working'],
  ['Bayside Smile Studio','Dr. Harper Bell','Annapolis','Maryland','demo','Needs improvement'],
  ['Fieldstone Dental Co.','Dr. Taylor James','Bethesda','Maryland','new','No website'],
  ['Larkspur Dental Collective','Dr. Alex Lane','Washington','Washington, DC','new','Unknown'],
  ['Copperleaf Dental','Dr. Robin Hayes','Fairfax','Northern Virginia','contacted','Working'],
  ['Parkline Dental Group','Dr. Sydney Ray','Rockville','Maryland','replied','Working'],
  ['Alder House Dental','Dr. Emery Park','Leesburg','Northern Virginia','won','Working'],
  ['Palmetto Modern Dental','Dr. Logan Hart','Tampa','Florida','contacted','Working'],
  ['Sage Hill Dental','Dr. Casey Kline','Washington','Washington, DC','new','No website'],
  ['Blue Heron Dentistry','Dr. Quinn King','Baltimore','Maryland','proposal','Needs improvement'],
  ['Morningside Family Dental','Dr. Jamie Taylor','Alexandria','Northern Virginia','lost','Working'],
  ['Willow Creek Studio','Dr. Devon Wells','Reston','Northern Virginia','won','Working'],
  ['Grove Point Dental','Dr. Jesse Vale','Washington','Washington, DC','demo','Needs improvement'],
  ['Birchwood Dental Arts','Dr. Blake Fox','Orlando','Florida','new','Unknown'],
  ['Granite Dental Co.','Dr. Sage Hart','Woodbridge','Northern Virginia','contacted','Broken'],
  ['Mill House Dental','Dr. Rowan Stone','Silver Spring','Maryland','new','No website'],
  ['Olive Branch Dentistry','Dr. Drew Summers','Falls Church','Northern Virginia','won','Working'],
  ['Pine Harbor Dental','Dr. Carter Cole','Tampa','Florida','contacted','Working'],
  ['Southfield Dental Group','Dr. Eden West','Vienna','Northern Virginia','new','Needs improvement']
];
const record = (id, props, days = 0) => ({ id, version: 1, createdAt: when(days), updatedAt: when(days), ...props });
const contacts = companies.map(([company,name,city,region,stage,websiteStatus], i) => record('c' + i, {
  company,name,city,region,websiteStatus,source: ['Email outreach','Referral','Cold call','Website'][i % 4],
  email: 'hello@' + company.replace(/[^a-z]/gi, '').toLowerCase() + '.example',
  phone: '+1703555' + (100 + i).toString().padStart(4, '0'),
  website: websiteStatus === 'No website' ? '' : 'https://example.com', tags: i % 3 === 0 ? ['Dental','Priority'] : ['Dental'],
  notes: i === 0 ? 'Interested in a new practice website and help with lead response. Review the proposal before the follow-up.' : '',
  followUp: i < 5 ? when(i - 1).slice(0, 10) : '', emailAllowed: false, smsAllowed: false
}, -[1, 3, 7, 9, 10, 13, 15, 16, 18, 20, 22, 25, 27, 28, 29, 32, 34, 35, 35, 39, 42, 44, 45, 48][i]));
const deals = companies.slice(0, 22).filter((_, i) => i < 18 || i === 21).map(([company,name,city,region,stage], i) => {
  const idx = companies.findIndex(row => row[0] === company);
  return record('d' + idx, {
    contactId: 'c' + idx, title: company, stage, value: [1200000, 750000, 650000, 450000, 1200000, 1200000, 450000][i % 7],
    mrr: [200000, 125000, 100000, 75000, 200000, 200000, 80000][i % 7], closeDate: when(i + 2).slice(0, 10),
    demoUrl: '', proposalUrl: '', paymentUrl: '', notes: '', enteredAt: when(-2 - i)
  }, -3 * i);
});
const tasks = [
  ['Follow up on proposal','c0',0,'High'], ['Confirm demo availability','c1',0,'Normal'],
  ['Reply to inquiry','c2',-1,'High'], ['Send website assessment','c3',1,'Normal'],
  ['Prepare onboarding checklist','c5',2,'Low']
].map(([title,contactId,due,priority], i) => record('t' + i, { title,contactId,priority,due:when(due).slice(0,10),done:false,notes:'' }));
const activity = [
  ['Proposal shared with Cedar Grove Dental','c0','proposals',0],
  ['Harborview Family Dental replied','c2','messages',0],
  ['Juniper Dental Arts moved to Demo sent','c1','deals',-1],
  ['Added Fieldstone Dental Co.','c7','contacts',-2],
  ['Northline Dental Care moved to Won','c5','deals',-2],
  ...Array.from({ length: 37 }, (_, i) => [i % 3 ? 'Outreach logged' : 'Prospect added', 'c' + (i % contacts.length), i % 3 ? 'messages' : 'contacts', -Math.floor(i / 2)])
].map(([title,contactId,type,days], i) => ({ id:'a'+i, title,contactId,type,at:when(days, 17 - (i % 5)),actor:'Demo team' }));

function seed() {
  return {
    contacts, deals, tasks, activity, stages,
    events: [record('e1',{ title:'Website walkthrough',contactId:'c1',startsAt:when(1, 19),endsAt:when(1, 20),status:'Scheduled',notes:'',location:'Google Meet' })],
    messages: [record('m1',{contactId:'c2',channel:'Email',status:'Inbound',subject:'Re: practice website',body:'Thanks for sharing the assessment. Could we go over next steps later this week?'},-1),record('m2',{contactId:'c0',channel:'Email',status:'Draft',subject:'Cedar Grove Dental proposal',body:'Hi Dr. Ellis, I wanted to see if you had any questions about the proposal.'})],
    proposals: [record('p1', { dealId:'d0',contactId:'c0',title:'Dental Growth Partnership',terms:'Website design, local SEO, and Google Ads management for Cedar Grove Dental.',amount:200000,cadence:'Monthly',expires:when(10).slice(0,10),status:'Draft' })],
    workflows: [record('w1',{title:'New lead follow-up',trigger:'Lead created',action:'Create task',value:'Review new inquiry',delay:1,active:true,source:'',stage:'',subject:''})],
    forms: [record('f1',{title:'Request a website assessment',description:'Tell us about your practice and what you’d like to improve.',type:'Lead inquiry',stage:'new',active:true})],
    payments: [record('demo_failure',{title:'Alder House Dental',contactId:'c11',dealId:'d11',invoiceId:'in_demo_failure',mode:'invoice',status:'Payment failed',amount:200000,outstandingAmount:200000,currency:'usd',nextAttemptAt:when(1),createdAt:when(-1)}),record('b1',{dealId:'d5',contactId:'c5',title:'Northline Dental Care',mode:'invoice',status:'Paid',amount:200000,collectedAmount:200000,currency:'usd',paidAt:when(-4)})],
    subscriptions: [
      {id:'sub_demo_active',title:'Northline Dental Care',currency:'usd',status:'active',mrr:200000,amount:200000,createdAt:when(-40)},
      {id:'sub_demo_pastdue',title:'Alder House Dental',currency:'usd',status:'past_due',mrr:200000,amount:200000,createdAt:when(-30)}
    ], runs: [], settings: { timezone:'America/New_York', inbound:'' }
  };
}

const keyFor = id => 'ksd-crm-demo-v1:' + id;
export const sampleUser = { id:'demo-user', name:'Marcel Grisard', email:'demo@example.com' };
export const prepareDemo = () => {
  const key = 'ksd-crm-demo-spaces-v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([{ id:'sample', name:'Kind Supply Digital', role:'owner' }]));
  return JSON.parse(localStorage.getItem(key));
};
export function newDemoSpace(name) {
  const spaces = prepareDemo();
  const id = crypto.randomUUID();
  const fresh = Object.fromEntries(Object.entries(seed()).map(([key, value]) => [key, Array.isArray(value) && key !== 'stages' ? [] : value]));
  localStorage.setItem(keyFor(id), JSON.stringify(fresh));
  localStorage.setItem('ksd-crm-demo-spaces-v1', JSON.stringify([...spaces, { id, name, role:'owner' }]));
  return id;
}
export function demoSpace(id) {
  const space = prepareDemo().find(row => row.id === id);
  const saved = localStorage.getItem(keyFor(id));
  return { ...space, state:saved ? JSON.parse(saved) : structuredClone(seed()), members:[{ ...sampleUser, role:'owner' }],
    integrations:{ stripe:false,stripePrices:[],email:false,sms:false,inboundEmail:false,google:{configured:false,connected:false} } };
}
export function demoSave(workspace, route, input) {
  const s = workspace.state;
  const [area, key, action] = route.split('/');
  let result;
  if (area === 'records' && key in s) {
    const rows = s[key];
    const prior = rows.find(row => row.id === input.id);
    if (action === 'delete') {
      s[key] = rows.filter(row => row.id !== input.id);
      result = { deleted:true };
    } else {
      result = { ...(prior ?? record(crypto.randomUUID(), {})), ...input, version:(prior?.version ?? 0) + 1 };
      if (prior) Object.assign(prior, result);
      else rows.unshift(result);
    }
    s.activity.unshift({ id:crypto.randomUUID(), title:`${action === 'delete' ? 'Deleted' : prior ? 'Updated' : 'Added'} ${input.title || input.company || key}`,
      contactId:key === 'contacts' ? result.id : result.contactId, at:new Date().toISOString(), actor:sampleUser.name,type:key });
  } else if (area === 'import') {
    const rows = input.rows.filter(row => row.company);
    const unique = rows.filter((row, i) => ![...s.contacts, ...rows.slice(0, i)].some(contact => contact.email && contact.email === row.email && contact.company === row.company));
    s.contacts.unshift(...unique.map(row => record(crypto.randomUUID(), { region:'Other', websiteStatus:'Unknown', tags:[], source:'CSV import', ...row })));
    result = { added:unique.length, duplicates:rows.length - unique.length, errors:[] };
  } else if (area === 'stages') {
    s.stages = input.stages.map(row => ({ ...row, id:row.id || crypto.randomUUID() }));
  } else if (area === 'settings') {
    const spaces = prepareDemo().map(row => row.id === workspace.id ? { ...row, name:input.name } : row);
    localStorage.setItem('ksd-crm-demo-spaces-v1', JSON.stringify(spaces));
    s.settings.timezone = input.timezone;
  } else {
    throw new Error('This action requires a live workspace.');
  }
  localStorage.setItem(keyFor(workspace.id), JSON.stringify(s));
  return result ?? { saved:true };
}
