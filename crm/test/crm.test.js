import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import Stripe from 'stripe';
import { migrate } from '../server/db.js';
import { bootstrap } from '../server/security.js';
import { createHandler } from '../server/http.js';
import { updateState, newRecord } from '../server/model.js';
import { contactsCsv, parseCsv } from '../src/csv.js';

test('CSV supports quoted fields and preserves exported international numbers', () => {
  const parsed = parseCsv('Practice,Contact,State,Notes\r\n"Practice, Inc.",Jamie,VA,"Said ""yes""\nThen asked for terms"\r\n');
  assert.deepEqual(parsed, [{
    company:'Practice, Inc.', name:'Jamie', region:'Northern Virginia', notes:'Said "yes"\nThen asked for terms'
  }]);
  const [exported] = parseCsv(contactsCsv([{ company:'Acme',phone:'+17035550100',websiteStatus:'Broken',notes:'=2+2' }]));
  assert.equal(exported.websiteStatus,'Broken');
  assert.equal(exported.phone,'+17035550100');
  assert.equal(exported.notes,"'=2+2");
});

test('CRM HTTP lifecycle with transactional PostgreSQL and signed provider callbacks', async t => {
  const db = new PGlite();
  await migrate(db);
  await migrate(db);
  const password = 'test-password-at-least-14';
  const workspace = await bootstrap(db,{ email:'owner@example.com',password,name:'Owner',workspace:'Agency' });
  const server = createServer(createHandler({db}));
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const priorEnv = Object.fromEntries(['APP_URL','INTEGRATION_WORKSPACE_ID','STRIPE_API_KEY','STRIPE_WEBHOOK_SECRET','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM'].map(key => [key,process.env[key]]));
  Object.assign(process.env,{
    APP_URL:origin, INTEGRATION_WORKSPACE_ID:workspace.id, STRIPE_API_KEY:'placeholder_test_credential',
    STRIPE_WEBHOOK_SECRET:'whsec_fixture', TWILIO_ACCOUNT_SID:'AC-fixture', TWILIO_AUTH_TOKEN:'twilio-fixture', TWILIO_FROM:'+17035550101'
  });
  t.after(async () => {
    for (const [key,value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.close();
    await db.close();
  });

  const path = route => '/api/crm?route=' + encodeURIComponent(route);
  async function call(route,input,options = {}) {
    const response = await fetch(origin + path(route),{
      method:input === undefined ? 'GET' : 'POST',
      headers:{ ...(input !== undefined && {'Content-Type':'application/json',Origin:origin}), ...options.headers,
        ...(options.cookie && { Cookie:options.cookie }) },
      body:input === undefined ? undefined : JSON.stringify(input)
    });
    return { status:response.status, data:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function expect(route,input,code,options = {}) {
    const result = await call(route,input,options);
    assert.equal(result.status,code,JSON.stringify(result.data));
    return result;
  }
  const route = 'workspaces/' + workspace.id;
  await expect('auth/me',undefined,401);
  await expect('auth/login',{email:'owner@example.com',password:'wrong'},401);
  await expect('auth/login',{email:'owner@example.com',password},403,{headers:{Origin:'https://elsewhere.example'}});
  const { cookie } = await expect('auth/login',{email:'owner@example.com',password},200);
  const own = (part,input,code = 200) => expect(route + (part ? '/' + part : ''),input,code,{cookie});
  assert.equal((await own('')).data.role,'owner');

  const second = (await expect('workspaces',{name:'Other practice'},201,{cookie})).data;
  assert.equal((await expect('workspaces/' + second.id,undefined,200,{cookie})).data.integrations.stripe,false);
  const contact = (await own('records/contacts',{
    company:'Cedar Group',email:'person@example.com',phone:'703-555-0100',name:'Avery',region:'Northern Virginia',smsAllowed:true
  })).data;
  await own('records/contacts',{company:'Cedar Group',email:'person@example.com'},409);
  const updated = (await own('records/contacts',{...contact,notes:'Met at event'})).data;
  await own('records/contacts',{...contact,notes:'Stale edit'},409);
  const deal = (await own('records/deals',{contactId:contact.id,title:'Agency retainer',value:1200000,mrr:200000})).data;
  await expect('workspaces/' + second.id + '/records/deals',{contactId:contact.id,title:'Cross-scope record'},404,{cookie});

  await own('records/workflows',{title:'Proposal follow-up',trigger:'Stage changed',stage:'proposal',action:'Create task',active:true,value:'Check agreement',delay:1});
  await own('records/deals',{...deal,stage:'proposal'});
  const state = (await own('')).data.state;
  assert.equal(state.tasks.length,1);
  assert.equal(state.runs[0].rule,'Proposal follow-up');
  await own('records/events',{title:'Discovery',contactId:contact.id,startsAt:'2026-11-18T15:00:00Z',endsAt:'2026-11-18T15:30:00Z'});
  await own('records/events',{title:'Invalid time',startsAt:'2026-11-18T15:00:00Z',endsAt:'2026-11-18T14:00:00Z'},400);

  const proposal = (await own('records/proposals',{
    dealId:deal.id,title:'Growth partnership',terms:'A private proposal',amount:200000,cadence:'Monthly',status:'Published'
  })).data;
  const publicView = (await expect('public/proposal/' + proposal.linkToken,undefined,200)).data;
  assert.equal(publicView.company,'Cedar Group');
  assert.ok(!('contactId' in publicView));
  await own('records/proposals',{...proposal,terms:'Edited terms'},409);
  await expect('public/proposal/' + proposal.linkToken,{name:'Client',agree:true},200);
  await expect('public/proposal/' + proposal.linkToken,{name:'Second attempt',agree:true},200);
  assert.equal((await own('')).data.state.proposals[0].acceptedBy,'Client');

  const capture = (await own('records/forms',{title:'Consultation request',type:'Booking request',active:true})).data;
  await expect('public/capture/' + capture.linkToken,{
    company:'New Practice',email:'lead@example.com',requested:'2026-11-24',notes:'Please call',
    tags:['unauthorized'],followUp:'2026-11-17',smsAllowed:true
  },200);
  const afterCapture = (await own('')).data.state;
  assert.equal(afterCapture.contacts[0].source,'Website');
  assert.deepEqual(afterCapture.contacts[0].tags,[]);
  assert.equal(afterCapture.contacts[0].smsAllowed,false);
  assert.equal(afterCapture.tasks[0].due,'2026-11-24');

  const csv = (await own('import',{rows:[{company:'CSV Practice',email:'practice@example.com'}, {company:'Cedar Group',email:'person@example.com'}, {company:''}]})).data;
  assert.equal(csv.added,1);
  assert.equal(csv.duplicates,1);
  assert.equal(csv.errors.length,1);

  const invite = (await own('invite',{email:'viewer@example.com',role:'viewer'})).data;
  const signed = await expect('auth/invite',{email:'viewer@example.com',password,token:invite.token,name:'Viewer'},200);
  await expect('auth/invite',{email:'viewer@example.com',password,token:invite.token,name:'Viewer'},404);
  assert.equal((await expect(route,undefined,200,{cookie:signed.cookie})).data.role,'viewer');
  await expect(route + '/records/contacts',{company:'Forbidden'},403,{cookie:signed.cookie});
  await expect('workspaces/' + second.id,undefined,404,{cookie:signed.cookie});

  const pending = await updateState(db,workspace.id,s => {
    const row = newRecord({ contactId:contact.id,dealId:deal.id,status:'Open',mode:'payment',title:'Agency retainer',amount:200000,currency:'usd' });
    s.payments.push(row);
    return row;
  });
  const stripe = new Stripe('placeholder_test_credential');
  const stripeBody = JSON.stringify({id:'evt_fixture',created:Math.floor(Date.now()/1000),type:'checkout.session.completed',data:{
    object:{id:'cs_fixture',payment_status:'paid',amount_total:200000,metadata:{app:'kind-supply-crm',workspace:workspace.id,payment:pending.id}}
  }});
  const signature = stripe.webhooks.generateTestHeaderString({ payload:stripeBody,secret:process.env.STRIPE_WEBHOOK_SECRET });
  const sendStripe = signature => fetch(origin + path('webhook/stripe'),{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':signature},body:stripeBody});
  assert.equal((await sendStripe('invalid')).status,400);
  assert.equal((await sendStripe(signature)).status,200);
  assert.equal((await sendStripe(signature)).status,200);
  const paid = (await own('')).data.state;
  assert.equal(paid.payments[0].status,'Paid');
  assert.equal(paid.activity.filter(row => row.title.startsWith('Stripe checkout completed')).length,1);

  const inbound = (await own('inbound',{})).data.token;
  const providerPath = path('webhook/sms/' + inbound);
  const sms = async (id,body) => {
    const params = {AccountSid:'AC-fixture',From:'+17035550100',MessageSid:id,Body:body};
    const source = origin + providerPath + Object.keys(params).sort().map(key => key + params[key]).join('');
    const signature = createHmac('sha1',process.env.TWILIO_AUTH_TOKEN).update(source).digest('base64');
    return fetch(origin + providerPath,{method:'POST',headers:{'X-Twilio-Signature':signature},body:new URLSearchParams(params)});
  };
  assert.equal((await sms('SM1','Do you have openings?')).status,200);
  assert.equal((await sms('SM1','Do you have openings?')).status,200);
  assert.equal((await sms('SM2','STOP')).status,200);
  const final = (await own('')).data.state;
  assert.equal(final.messages.filter(row => row.providerId === 'SM1').length,1);
  const optedOut = final.contacts.find(row => row.id === updated.id);
  assert.equal(optedOut.smsAllowed,false);
  await own('records/contacts',{...optedOut,smsAllowed:true},409);
  await expect('auth/logout',{},200,{cookie});
  await expect(route,undefined,401,{cookie});
});
