import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
import {DuoLedger, duoCalendar, duoEvent, pairPolicies} from '../duo/sync.mjs';
import {DriveDuoTransport} from '../duo/drive.mjs';

const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const E = await import('data:text/javascript;base64,' + Buffer.from(engineSource(html) +
  '\nexport {ProfileGoals, profileCalendar, PLANS, SessionCore};').toString('base64'));
const id = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const now = Date.parse('2026-09-23T12:00:00Z');
class Storage {
  data = new Map(); fail = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw Error('quota'); this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}
const alice = {pairId: id(1), memberId: id(2), partnerId: id(3), accountId: 'google-1',
  ownerId: 'owner-1', partnerOwnerId: 'owner-2', timeZone: 'Europe/London',
  target: 3, includeUnassessed: false, version: 1, startedAt: now - 1000};
const bob = {pairId: id(1), memberId: id(3), partnerId: id(2), accountId: 'google-2',
  ownerId: 'owner-2', partnerOwnerId: 'owner-1', timeZone: 'Europe/London',
  target: 3, includeUnassessed: false, version: 1, startedAt: now - 1000};
class Remote {
  files = []; offline = false; denied = false; full = false; dropReply = false;
  transport(policy) {
    return {accountId: policy.accountId, identity: async () => policy.ownerId,
      list: async () => { if (this.offline) throw {code: 'offline'}; if (this.denied) throw {code: 'share-revoked'};
        return structuredClone(this.files); },
      create: async event => { if (this.full) throw {code: 'storage-full'};
        this.files.push({event: structuredClone(event), ownerId: policy.ownerId});
        if (this.dropReply) { this.dropReply = false; throw {code: 'offline'}; }
      }};
  }
}
function completedPayload() {
  const core = new E.SessionCore(E.PLANS.find(p => p.id === 'first-steps'), 'building',
    {speaking: () => false, portrait: () => false, hasDemo: () => true});
  core.start(); let payload;
  for (let n = 0; n < 100 && !core.done; n++) payload = core.skip('test').find(f => f.t === 'finish')?.payload || payload;
  assert.ok(payload);
  payload.out = payload.out.map(row => ({...row, skipped: false, score: 0, achieved: row.kind === 'reps' ? 6 : 20}));
  return payload;
}
function savedProfile(n, at = now, enabledAt = now - 1000) {
  const profile = new E.ProfileGoals(new Storage());
  assert.equal(profile.setEnabled(true, enabledAt, {timeZone: 'Europe/London', target: 3}).status, 'ready');
  assert.equal(profile.saveSession(id(n), 'first-steps', completedPayload(), at).status, 'ready');
  return profile;
}
const savedProfileEvent = (n, at = now) => savedProfile(n, at).read().data.events[0];
const enqueue = (ledger, n, at = now) => ledger.enqueue(savedProfile(n, at), id(n));
function peers() {
  const a = new DuoLedger(new Storage(), alice), b = new DuoLedger(new Storage(), bob), remote = new Remote();
  a.enable(); b.enable(); return {a, b, remote};
}

test('Two separately approved policies agree only on exact pair, timezone, target and unassessed policy', () => {
  assert.equal(pairPolicies(alice, bob), true);
  for (const change of [{target: 4}, {timeZone: 'UTC'}, {includeUnassessed: true}, {startedAt: now}, {partnerId: id(4)},
    {partnerOwnerId: 'other'}, {version: 2}]) assert.equal(pairPolicies(alice, {...bob, ...change}), false);
});
test('Duo event derives only eligible saved-profile fields and matches civil dates at DST', () => {
  const profile = savedProfileEvent(10);
  const event = duoEvent(profile, alice);
  assert.deepEqual(Object.keys(event), ['schema','pairId','memberId','sessionId','finishedAt','day','week','basis','policyVersion']);
  assert.equal(event.week, '2026-09-21'); assert.equal(event.day, '2026-09-23');
  assert.doesNotMatch(JSON.stringify(event), /score|planId|landmarks|diagnostic|google-1/);
  for (const at of [Date.parse('2026-03-29T00:30:00Z'), Date.parse('2026-10-25T01:30:00Z'),
    Date.parse('2026-09-27T23:00:00Z')]) assert.deepEqual(duoCalendar(at, 'Europe/London'), E.profileCalendar(at, 'Europe/London'));
  assert.throws(() => duoEvent({...profile, basis: 'unassessed'}, alice));
});
test('Two accounts sync local work and count unique member-days, not scores or extra routines', async () => {
  const {a, b, remote} = peers();
  enqueue(a, 10); enqueue(a, 11, now + 1000);
  enqueue(b, 12);
  assert.equal(a.week('2026-09-21').credits, 1); assert.equal(a.week('2026-09-21').syncStatus, 'pending');
  assert.equal((await a.sync(remote.transport(alice), now + 2000)).status, 'synced');
  assert.equal((await b.sync(remote.transport(bob), now + 2000)).status, 'synced');
  assert.equal((await a.sync(remote.transport(alice), now + 3000)).status, 'synced');
  assert.equal(a.week('2026-09-21').credits, 2);
  assert.equal(b.week('2026-09-21').credits, 2);
  assert.equal(a.week('2026-09-21').confirmedMet, false);
  assert.equal(remote.files.length, 3);
});
test('The combined target is met by three distinct member-days without a per-person quota', async () => {
  const {a, b, remote} = peers();
  enqueue(a, 13, now); enqueue(a, 14, now + 86400000); enqueue(b, 15, now);
  await a.sync(remote.transport(alice), now + 2 * 86400000);
  await b.sync(remote.transport(bob), now + 2 * 86400000);
  await a.sync(remote.transport(alice), now + 2 * 86400000 + 1);
  assert.equal(a.week('2026-09-21').credits, 3);
  assert.equal(a.week('2026-09-21').confirmedMet, true);
  assert.equal(b.week('2026-09-21').credits, 3);
});
test('Unsaved session IDs and disabled profile records cannot enter the outbox', () => {
  const {a} = peers(), profile = savedProfile(16);
  assert.equal(a.enqueue(profile, id(17)).status, 'ineligible');
  assert.equal(a.enqueue({read: () => ({status: 'ready', data: {enabled: false, events: [profile.read().data.events[0]]}})}, id(16)).status, 'ineligible');
  profile.setEnabled(false, now + 1);
  assert.equal(a.enqueue(profile, id(16)).status, 'ineligible');
  assert.equal(a.read().data.events.length, 0);
});
test('Pair opt-in never backfills previously saved local routines', () => {
  const {a} = peers(), prior = savedProfile(18, now - 5000, now - 10000);
  assert.equal(a.enqueue(prior, id(18)).status, 'ineligible');
  assert.equal(a.read().data.pending.length, 0);
  assert.equal(a.read().data.events.length, 0);
});
test('Offline work survives reload; lost create reply replays idempotently after a list', async () => {
  const storage = new Storage(), a = new DuoLedger(storage, alice), remote = new Remote(); a.enable();
  enqueue(a, 20); remote.offline = true;
  assert.equal((await a.sync(remote.transport(alice), now + 1)).status, 'offline');
  assert.equal(a.read().data.pending.length, 1); remote.offline = false; remote.dropReply = true;
  assert.equal((await a.sync(remote.transport(alice), now + 2)).status, 'offline');
  assert.equal(remote.files.length, 1); assert.equal(a.read().data.pending.length, 1);
  const reopened = new DuoLedger(storage, alice); reopened.enable();
  assert.equal((await reopened.sync(remote.transport(alice), now + 3)).status, 'synced');
  assert.equal(remote.files.length, 1); assert.equal(reopened.read().data.pending.length, 0);
});
test('A fresh installation restores shared credits from remote records without inventing local profile history', async () => {
  const {a, b, remote} = peers(); enqueue(a, 27); enqueue(b, 28, now + 86400000);
  await a.sync(remote.transport(alice), now + 86400001);
  await b.sync(remote.transport(bob), now + 86400001);
  const fresh = new DuoLedger(new Storage(), alice); fresh.enable();
  assert.equal(fresh.week('2026-09-21').credits, 0);
  assert.equal((await fresh.sync(remote.transport(alice), now + 86400002)).status, 'synced');
  assert.equal(fresh.week('2026-09-21').credits, 2);
  assert.equal(fresh.read().data.pending.length, 0);
});
test('Independent devices for one account merge distinct immutable completions', async () => {
  const remote = new Remote(), first = new DuoLedger(new Storage(), alice), second = new DuoLedger(new Storage(), alice);
  first.enable(); second.enable(); enqueue(first, 31); enqueue(second, 32, now + 86400000);
  await first.sync(remote.transport(alice), now + 86400001);
  await second.sync(remote.transport(alice), now + 86400002);
  await first.sync(remote.transport(alice), now + 86400003);
  assert.equal(first.week('2026-09-21').credits, 2);
  assert.equal(second.week('2026-09-21').credits, 2);
  assert.equal(remote.files.length, 2);
});
test('Late upload retains the completion week across Monday and DST', async () => {
  const {a, b, remote} = peers();
  enqueue(a, 21, Date.parse('2026-09-27T22:59:59Z'));
  await a.sync(remote.transport(alice), Date.parse('2026-09-28T12:00:00Z'));
  await b.sync(remote.transport(bob), Date.parse('2026-09-28T12:00:00Z'));
  assert.equal(b.week('2026-09-21').credits, 1);
  assert.equal(b.week('2026-09-28').credits, 0);
});
test('Provider quota, revocation and wrong account preserve queued work', async () => {
  const {a, remote} = peers(); enqueue(a, 22);
  assert.equal((await a.sync({...remote.transport(alice), accountId: bob.accountId}, now)).status, 'sign-in-required');
  assert.equal(a.read().data.pending.length, 1);
  assert.equal((await a.sync({...remote.transport(alice), identity: async () => bob.ownerId}, now)).status, 'sign-in-required');
  assert.equal(a.read().data.pending.length, 1);
  remote.full = true; assert.equal((await a.sync(remote.transport(alice), now)).status, 'storage-full');
  assert.equal(a.read().data.pending.length, 1);
  remote.full = false; remote.denied = true;
  assert.equal((await a.sync(remote.transport(alice), now)).status, 'share-revoked');
  assert.equal(a.read().data.pending.length, 1);
  remote.denied = false; assert.equal((await a.sync(remote.transport(alice), now)).status, 'synced');
});
test('Conflicting same UUID, wrong owner and disappearing partner file fail closed without changing prior credits', async () => {
  const {a, b, remote} = peers(); enqueue(a, 23);
  await a.sync(remote.transport(alice), now); await b.sync(remote.transport(bob), now);
  remote.files.push({event: {...remote.files[0].event, basis: 'unassessed'}, ownerId: alice.ownerId});
  assert.equal((await b.sync(remote.transport(bob), now + 1)).status, 'conflict');
  assert.equal(b.week('2026-09-21').credits, 1);
  remote.files.pop(); remote.files[0].ownerId = bob.ownerId;
  assert.equal((await b.sync(remote.transport(bob), now + 2)).status, 'conflict');
  remote.files[0].ownerId = alice.ownerId; remote.files.length = 0;
  assert.equal((await b.sync(remote.transport(bob), now + 3)).status, 'conflict');
  assert.equal(b.week('2026-09-21').credits, 1);
});
test('Store failures do not upload, and account/pair switching cannot inherit a ledger', async () => {
  const storage = new Storage(), a = new DuoLedger(storage, alice), remote = new Remote(); a.enable();
  storage.fail = true; assert.equal(enqueue(a, 24).status, 'error');
  assert.equal(remote.files.length, 0);
  const other = new DuoLedger(storage, {...alice, accountId: 'google-other'}); other.enable();
  assert.equal(other.read().data.events.length, 0);
  assert.equal((await a.sync(remote.transport(alice), now)).status, 'error');
});
test('Disable during a pending network read prevents upload after consent is withdrawn', async () => {
  const {a} = peers(); enqueue(a, 25);
  let release; const gate = new Promise(resolve => { release = resolve; }); let created = 0;
  const running = a.sync({accountId: alice.accountId, identity: async () => alice.ownerId,
    list: () => gate, create: async () => { created++; }}, now);
  a.disable(); release([]); await running;
  assert.equal(created, 0);
});
test('Disable and re-enable cannot revive an earlier in-flight sync (ABA)', async () => {
  const {a} = peers(); enqueue(a, 26);
  let release; const gate = new Promise(resolve => { release = resolve; }); let created = 0;
  const running = a.sync({accountId: alice.accountId, identity: async () => alice.ownerId,
    list: () => gate, create: async () => { created++; }}, now);
  a.disable(); a.enable(); release([]);
  assert.equal((await running).status, 'off'); assert.equal(created, 0);
  assert.equal(a.read().data.pending.length, 1);
});

test('Drive adapter uses ordinary shared-folder files, page-safe reads and injected bearer auth', async () => {
  const event = duoEvent(savedProfileEvent(30), alice), calls = [];
  const transport = new DriveDuoTransport({accessToken: 'private-token', accountId: alice.accountId,
    folderId: 'sharedFolder12345', fetchFn: async (url, options) => {
      calls.push({url: String(url), options});
      if (String(url).includes('/about?')) return {ok: true, json: async () => ({user: {permissionId: alice.ownerId}})};
      if (String(url).includes('uploadType=multipart')) return {ok: true, json: async () => ({id: 'createdFile12345'})};
      if (String(url).includes('alt=media')) return {ok: true, text: async () => JSON.stringify(event)};
      return {ok: true, json: async () => ({files: [{id: 'createdFile12345', name: 'formcoach-duo-test.json',
        mimeType: 'application/json', size: 300, owners: [{permissionId: alice.ownerId}]}]})};
    }});
  assert.equal(await transport.identity(), alice.ownerId);
  assert.equal(await transport.create(event), 'createdFile12345');
  assert.deepEqual(await transport.list(), [{event, ownerId: alice.ownerId}]);
  assert.equal(calls[0].options.headers.authorization, 'Bearer private-token');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.match(calls[1].options.body, /"parents":\["sharedFolder12345"\]/);
  assert.ok(calls[2].url.includes('in+parents'));
  assert.doesNotMatch(calls[1].options.body, /score|planId|landmarks|diagnostic/);
});
for (const [status, reason, expected] of [[401, '', 'sign-in-required'], [403, 'storageQuotaExceeded', 'storage-full'],
  [403, '', 'share-revoked'], [403, 'rateLimitExceeded', 'error'], [404, '', 'share-revoked'], [429, '', 'error']])
  test(`Drive HTTP ${status}/${reason} reports ${expected}`, async () => {
    const transport = new DriveDuoTransport({accessToken: 'token', accountId: alice.accountId,
      folderId: 'sharedFolder12345', fetchFn: async () => ({ok: false, status,
        json: async () => ({error: {errors: [{reason}]}})})});
    await assert.rejects(transport.list(), error => error.code === expected);
  });
test('Drive offline and malformed/truncated listings are not mistaken for zero partner activity', async () => {
  const config = {accessToken: 'token', accountId: alice.accountId, folderId: 'sharedFolder12345'};
  await assert.rejects(new DriveDuoTransport({...config, fetchFn: async () => { throw Error('network'); }}).list(),
    error => error.code === 'offline');
  await assert.rejects(new DriveDuoTransport({...config, fetchFn: async () => ({ok: true, json: async () => ({files: [] , nextPageToken: 'same'})})}).list(),
    error => error.code === 'error');
  await assert.rejects(new DriveDuoTransport({...config, fetchFn: async () => ({ok: true, json: async () => ({files: [], incompleteSearch: true})})}).list(),
    error => error.code === 'error');
});
