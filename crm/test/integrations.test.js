import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../server/db.js';
import { createWorkspace, bootstrap, day, digest, secret } from '../server/security.js';
import { providerWorkspace } from '../server/integrations.js';
import { initialState, newRecord, updateState } from '../server/model.js';
import { financialMetrics, receivedPayments } from '../src/finance.js';
import { importStripeObject, monthlyAmount, applyStripeResourceEvent } from '../server/stripe-data.js';
import { authorizeCalendar, calendarCallback, calendarStatus, googleAppointment, listGoogleCalendars, selectGoogleCalendar, syncGoogleCalendar, useGoogleAppointment } from '../server/calendar.js';

test('Stripe receipts avoid invoice, Checkout, and charge duplication',()=>{
  const state=initialState();
  const time='2026-11-10T10:00:00Z';
  state.payments=[
    {id:'checkout',mode:'payment',paymentIntent:'pi_1',status:'Paid',amount:200000,collectedAmount:200000,currency:'usd',paidAt:time},
    {id:'invoice',mode:'invoice',invoiceId:'in_1',paymentIntents:['pi_1'],status:'Paid',amount:200000,collectedAmount:200000,currency:'usd',paidAt:time},
    {id:'charge',mode:'charge',paymentIntent:'pi_1',chargeId:'ch_1',status:'Paid',amount:200000,collectedAmount:200000,currency:'usd',paidAt:time},
    {id:'sub_checkout',mode:'subscription',status:'Paid',amount:200000,collectedAmount:200000,currency:'usd',paidAt:time}
  ];
  assert.equal(receivedPayments(state.payments).length,1);
  assert.equal(financialMetrics(state,'month',new Date('2026-11-17T12:00:00Z'),'UTC').gross,200000);
});
test('Financial reporting uses subscription intervals, failure recovery, and refund dates',()=>{
  const state=initialState();
  const sub={id:'sub_1',status:'active',items:{data:[{price:{currency:'usd',unit_amount:1200000,recurring:{interval:'year',interval_count:1,usage_type:'licensed'}},quantity:2}]}};
  assert.equal(monthlyAmount(sub),200000);
  importStripeObject(state,'subscription',sub);
  importStripeObject(state,'subscription',{...sub,id:'sub_2',status:'trialing'});
  importStripeObject(state,'subscription',{...sub,id:'sub_3',status:'past_due'});
  state.payments=[
    {id:'paid',mode:'charge',status:'Partially refunded',chargeId:'ch_1',paymentIntent:'pi_paid',currency:'usd',
      amount:200000,collectedAmount:200000,refunded:50000,paidAt:'2026-10-20T12:00:00Z',
      refunds:[{id:'re_1',amount:50000,status:'succeeded',at:'2026-11-10T12:00:00Z'}]},
    {id:'failed_invoice',mode:'invoice',invoiceId:'in_failed',paymentIntents:['pi_failed'],status:'Payment failed',currency:'usd',amount:200000,outstandingAmount:200000},
    {id:'failed_charge',mode:'charge',chargeId:'ch_2',paymentIntent:'pi_failed',status:'Failed',currency:'usd',amount:200000},
    {id:'old_failed',mode:'charge',chargeId:'ch_3',paymentIntent:'pi_paid',status:'Failed',currency:'usd',amount:200000}
  ];
  let metrics=financialMetrics(state,'month',new Date('2026-11-17T12:00:00Z'),'UTC');
  assert.equal(metrics.gross,0);
  assert.equal(metrics.refunded,50000);
  assert.equal(metrics.net,-50000);
  assert.equal(metrics.mrr,400000);
  assert.equal(metrics.atRiskMrr,200000);
  assert.equal(metrics.failed.length,1);
  assert.equal(metrics.failedAmount,200000);
  state.payments[1].status='Paid';
  state.payments[1].collectedAmount=200000;
  state.payments[1].paidAt='2026-11-15T12:00:00Z';
  state.payments[1].outstandingAmount=0;
  metrics=financialMetrics(state,'all',new Date('2026-11-17T12:00:00Z'),'UTC');
  assert.equal(metrics.outstanding,0);
  assert.equal(metrics.failed.length,0);
});
test('Google all-day dates and contact association remain accurate',()=>{
  const event=googleAppointment({summary:'Conference',start:{date:'2026-11-19'},end:{date:'2026-11-20'},attendees:[{email:'client@example.com'}]},
    [{id:'c1',email:'client@example.com'}],'America/New_York');
  assert.equal(event.allDayStart,'2026-11-19');
  assert.equal(event.allDayEnd,'2026-11-20');
  assert.equal(event.contactId,'c1');
});

test('Google OAuth, durable synchronization, and conflicting edits',async t=>{
  const db=new PGlite();
  await migrate(db);
  const ws=await bootstrap(db,{email:'owner@example.com',password:'Test!123',name:'Owner',workspace:'Agency'});
  const user=(await db.query('SELECT id,email,name FROM crm_users')).rows[0];
  const originalFetch=globalThis.fetch;
  const envNames=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','CALENDAR_ENCRYPTION_KEY','APP_URL'];
  const priorEnv=Object.fromEntries(envNames.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture',
    CALENDAR_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),APP_URL:'https://crm.example.com'});
  t.after(async()=>{
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries(priorEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await db.close();
  });
  await assert.rejects(authorizeCalendar(db,ws.id,{id:'unrelated',email:'other@example.com'},{headers:{host:'crm.example.com'}}),error=>error.status===403);
  const auth=await authorizeCalendar(db,ws.id,user,{headers:{host:'crm.example.com'}});
  const url=new URL(auth.url);
  assert.equal(url.origin,'https://accounts.google.com');
  assert.equal(url.searchParams.get('access_type'),'offline');
  assert.equal(url.searchParams.get('redirect_uri'),'https://crm.example.com/api/google-calendar');
  const token=secret();
  await db.query('INSERT INTO crm_sessions VALUES ($1,$2,$3)',[digest(token),user.id,new Date(Date.now()+day)]);
  let changed=false;
  let conflict=false;
  const remote={id:'remote_1',summary:'Client meeting',etag:'v1',updated:new Date().toISOString(),
    start:{dateTime:new Date(Date.now()+86400000).toISOString()},end:{dateTime:new Date(Date.now()+90000000).toISOString()}};
  globalThis.fetch=async(url,options={})=>{
    if(String(url)==='https://oauth2.googleapis.com/token') return Response.json({
      access_token:'access_fixture',refresh_token:'refresh_fixture',expires_in:3600,
      scope:'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly'
    });
    assert.equal(options.headers.Authorization,'Bearer access_fixture');
    if(String(url).includes('/calendarList'))return Response.json({items:[{id:'owner@example.com',summary:'Agency schedule',timeZone:'America/New_York',primary:true}]});
    if(options.method==='PATCH') {
      assert.equal(options.headers['If-Match'],'v1');
      if(conflict)return Response.json({error:'conflict'},{status:412});
      Object.assign(remote,JSON.parse(options.body),{etag:'v2',updated:new Date().toISOString()});
      changed=true;
      return Response.json(remote);
    }
    if(String(url).includes('/events/remote_1'))return Response.json({...remote,summary:'Updated in Google',etag:'v3'});
    return Response.json({items:[remote],nextSyncToken:'sync_fixture'});
  };
  const req={url:'/api/google-calendar?state='+url.searchParams.get('state')+'&code=fixture',headers:{cookie:'ksd_session='+token,host:'crm.example.com'}};
  assert.match(await calendarCallback(db,req),/google=connected/);
  await assert.rejects(calendarCallback(db,req),error=>error.status===400);
  const stored=(await db.query('SELECT tokens FROM crm_google_connections')).rows[0].tokens;
  assert.ok(!stored.includes('refresh_fixture'));
  assert.equal((await calendarStatus(db,ws.id)).connected,true);
  assert.equal((await listGoogleCalendars(db,ws.id,user)).calendars[0].name,'Agency schedule');
  await selectGoogleCalendar(db,ws.id,user,{calendarId:'owner@example.com'});
  await syncGoogleCalendar(db,ws.id,user);
  let state=(await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[ws.id])).rows[0].state;
  assert.equal(state.events.length,1);
  assert.equal(state.events[0].googleSync,'Synced');
  await updateState(db,ws.id,s=>{
    s.events[0].title='CRM edit';s.events[0].googleSync='Pending';s.events[0].version++;
  });
  await syncGoogleCalendar(db,ws.id,user);
  assert.equal(changed,true);
  state=(await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[ws.id])).rows[0].state;
  assert.equal(state.events[0].title,'CRM edit');
  assert.equal(state.events[0].google.etag,'v2');
  conflict=true;
  await updateState(db,ws.id,s=>{
    s.events[0].google.etag='v1';s.events[0].title='Conflicting CRM edit';s.events[0].googleSync='Pending';s.events[0].version++;
  });
  await syncGoogleCalendar(db,ws.id,user);
  state=(await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[ws.id])).rows[0].state;
  assert.equal(state.events[0].googleSync,'Conflict');
  assert.equal(state.events[0].title,'Conflicting CRM edit');
  await useGoogleAppointment(db,ws.id,user,state.events[0].id);
  state=(await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[ws.id])).rows[0].state;
  assert.equal(state.events[0].title,'Updated in Google');
  assert.equal(state.events[0].googleSync,'Synced');
  await db.query('UPDATE crm_google_connections SET sync_token=NULL,sync_query=NULL,full_sync_at=NULL WHERE workspace_id=$1',[ws.id]);
  const pageRequests=[];
  globalThis.fetch=async(url)=>{
    const query=new URL(url).searchParams;
    pageRequests.push(Object.fromEntries(query));
    if(query.get('pageToken')==='page3') return Response.json({items:[],nextSyncToken:'sync_paginated'});
    return Response.json({items:[remote],nextPageToken:query.get('pageToken')==='page2' ? 'page3' : 'page2'});
  };
  const firstPage=await syncGoogleCalendar(db,ws.id,user);
  assert.equal(firstPage.more,true);
  const lastPage=await syncGoogleCalendar(db,ws.id,user);
  assert.equal(lastPage.more,undefined);
  assert.equal(pageRequests[0].timeMin,pageRequests[2].timeMin);
  assert.equal(pageRequests[2].pageToken,'page3');
  const syncState=(await db.query('SELECT sync_token,sync_query FROM crm_google_connections WHERE workspace_id=$1',[ws.id])).rows[0];
  assert.equal(syncState.sync_token,'sync_paginated');
  assert.equal(syncState.sync_query,null);
});

test('Stripe webhook retries reconcile the latest invoice state once',async()=>{
  const db=new PGlite();
  try{
    await migrate(db);
    const ws=await bootstrap(db,{email:'owner@example.com',password:'Test!123',name:'Owner',workspace:'Agency'});
    const invoice={id:'in_fixture',status:'paid',created:1700000000,currency:'usd',amount_due:200000,amount_paid:200000,
      amount_remaining:0,attempted:true,attempt_count:2,payments:{data:[{payment:{payment_intent:'pi_fixture'}}]},status_transitions:{paid_at:1700000000}};
    const stripe={invoices:{retrieve:async()=>invoice}};
    const event={id:'evt_late_failure',type:'invoice.payment_failed',data:{object:{id:'in_fixture'}}};
    await applyStripeResourceEvent(db,ws.id,event,stripe);
    await applyStripeResourceEvent(db,ws.id,event,stripe);
    const state=(await db.query('SELECT state FROM crm_workspaces WHERE id=$1',[ws.id])).rows[0].state;
    assert.equal(state.payments.length,1);
    assert.equal(state.payments[0].status,'Paid');
    assert.equal(state.payments[0].outstandingAmount,0);
    assert.deepEqual(state.payments[0].paymentIntents,['pi_fixture']);
    assert.equal(state.activity.filter(row=>row.title.startsWith('Stripe')).length,1);
  }finally{await db.close();}
});

test('Provider credentials stay with the first workspace when more workspaces are created',async()=>{
  const db=new PGlite();
  const prior=process.env.INTEGRATION_WORKSPACE_ID;
  delete process.env.INTEGRATION_WORKSPACE_ID;
  try {
    await migrate(db);
    const first=await bootstrap(db,{email:'owner@example.com',password:'Test!123',name:'Owner',workspace:'Agency'});
    assert.equal(await providerWorkspace(db),first.id);
    const user=(await db.query('SELECT id FROM crm_users')).rows[0];
    const second=await createWorkspace(db,user.id,'Client');
    assert.equal(await providerWorkspace(db),first.id);
    await migrate(db);
    assert.equal(await providerWorkspace(db),first.id);
    process.env.INTEGRATION_WORKSPACE_ID=second.id;
    assert.equal(await providerWorkspace(db),second.id);
  } finally {
    if(prior===undefined)delete process.env.INTEGRATION_WORKSPACE_ID;
    else process.env.INTEGRATION_WORKSPACE_ID=prior;
    await db.close();
  }
});
