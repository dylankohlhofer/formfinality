// Prototype contract only: no workout, account or network side effects on import.
// The native host must establish both members' consent and verified provider IDs.
export const DUO_SCHEMA = 'duo-completion/1';
export const DUO_STORE = 'formcoach.duo-prototype.v1';
const MAX_BYTES = 1024 * 1024;
const MAX_EVENTS = 4000;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const instant = value => Number.isSafeInteger(value) && value >= 0 && value < 253370000000000;
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const clone = value => structuredClone(value);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export function duoCalendar(at, zone) {
  if (!instant(at) || typeof zone !== 'string' || !zone || zone.length > 100) throw Error('Invalid Duo date or timezone');
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(at);
  const part = kind => parts.find(p => p.type === kind).value;
  const day = `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
  const monday = new Date(`${day}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return {day, week: monday.toISOString().slice(0, 10)};
}

export function validDuoPolicy(p) {
  if (!keys(p, ['pairId','memberId','partnerId','accountId','ownerId','partnerOwnerId','timeZone','target','includeUnassessed','version','startedAt']) ||
      !uuid(p.pairId) || !uuid(p.memberId) || !uuid(p.partnerId) || p.memberId === p.partnerId ||
      typeof p.accountId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(p.accountId) ||
      typeof p.ownerId !== 'string' || !p.ownerId || p.ownerId.length > 200 ||
      typeof p.partnerOwnerId !== 'string' || !p.partnerOwnerId || p.partnerOwnerId.length > 200 ||
      p.ownerId === p.partnerOwnerId || !Number.isInteger(p.target) || p.target < 1 || p.target > 14 ||
      typeof p.includeUnassessed !== 'boolean' || !Number.isSafeInteger(p.version) || p.version < 1 ||
      !instant(p.startedAt)) return false;
  try { duoCalendar(0, p.timeZone); return true; } catch { return false; }
}

export function pairPolicies(a, b) {
  return validDuoPolicy(a) && validDuoPolicy(b) && a.pairId === b.pairId &&
    a.memberId === b.partnerId && b.memberId === a.partnerId &&
    a.ownerId === b.partnerOwnerId && b.ownerId === a.partnerOwnerId &&
    a.timeZone === b.timeZone && a.target === b.target &&
    a.includeUnassessed === b.includeUnassessed && a.version === b.version &&
    a.startedAt === b.startedAt &&
    a.accountId !== b.accountId;
}

// Enforce the minimal wire shape at the transport too, even for direct callers.
export function validDuoEnvelope(event) {
  if (!keys(event, ['schema','pairId','memberId','sessionId','finishedAt','day','week','basis','policyVersion']) ||
      event.schema !== DUO_SCHEMA || !uuid(event.pairId) || !uuid(event.memberId) || !uuid(event.sessionId) ||
      !instant(event.finishedAt) || !['observed','unassessed'].includes(event.basis) ||
      !Number.isSafeInteger(event.policyVersion) || event.policyVersion < 1) return false;
  for (const date of [event.day, event.week]) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const time = Date.parse(date + 'T00:00:00.000Z');
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return false;
  }
  const monday = Date.parse(event.week + 'T00:00:00.000Z'), day = Date.parse(event.day + 'T00:00:00.000Z');
  return new Date(monday).getUTCDay() === 1 && day >= monday && day < monday + 7 * 86400000;
}

export function validDuoEvent(event, policy) {
  if (!validDuoPolicy(policy) || !validDuoEnvelope(event) || event.pairId !== policy.pairId ||
      ![policy.memberId, policy.partnerId].includes(event.memberId) || event.finishedAt < policy.startedAt ||
      event.policyVersion !== policy.version ||
      (event.basis === 'unassessed' && !policy.includeUnassessed)) return false;
  const calendar = duoCalendar(event.finishedAt, policy.timeZone);
  return event.day === calendar.day && event.week === calendar.week;
}

export function duoEvent(profileEvent, policy) {
  if (!validDuoPolicy(policy) || !keys(profileEvent, ['sessionId','planId','finishedAt','basis']) ||
      !uuid(profileEvent.sessionId) || !instant(profileEvent.finishedAt) ||
      profileEvent.finishedAt < policy.startedAt ||
      !['observed','unassessed'].includes(profileEvent.basis) ||
      (profileEvent.basis === 'unassessed' && !policy.includeUnassessed)) throw Error('Ineligible local completion');
  const {day, week} = duoCalendar(profileEvent.finishedAt, policy.timeZone);
  return {schema: DUO_SCHEMA, pairId: policy.pairId, memberId: policy.memberId,
    sessionId: profileEvent.sessionId, finishedAt: profileEvent.finishedAt,
    day, week, basis: profileEvent.basis, policyVersion: policy.version};
}

const eventKey = event => `${event.memberId}/${event.sessionId}`;
const same = (a, b) => Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(key => b[key] === a[key]);
function validateState(state, policy) {
  if (!keys(state, ['schema','policy','events','pending','lastSyncAt','lastStatus']) ||
      state.schema !== 'duo-sync/1' || !same(state.policy, policy) ||
      !Array.isArray(state.events) || state.events.length > MAX_EVENTS ||
      !Array.isArray(state.pending) || state.pending.length > MAX_EVENTS ||
      state.lastSyncAt !== null && !instant(state.lastSyncAt) ||
      !['never','pending','synced','offline','storage-full','sign-in-required','share-revoked','conflict','error'].includes(state.lastStatus)) return false;
  const ids = new Set();
  for (const event of state.events) {
    if (!validDuoEvent(event, policy) || ids.has(eventKey(event))) return false;
    ids.add(eventKey(event));
  }
  return state.pending.every(id => typeof id === 'string' && ids.has(`${policy.memberId}/${id}`)) &&
    new Set(state.pending).size === state.pending.length;
}

// Storage is injected. Local profile records must be durably saved before enqueue().
// This store is separate so opting out of the profile cannot silently erase pending sync.
export class DuoLedger {
  constructor(storage, policy) {
    if (!validDuoPolicy(policy)) throw Error('Invalid Duo policy');
    this.storage = storage; this.policy = clone(policy);
    this.key = `${DUO_STORE}.${policy.accountId}.${policy.pairId}.${policy.memberId}`;
    this.state = {schema: 'duo-sync/1', policy: clone(policy), events: [], pending: [], lastSyncAt: null, lastStatus: 'never'};
    this.raw = null; this.error = null; this.busy = false; this.enabled = false; this.epoch = 0;
    try {
      const raw = storage.getItem(this.key);
      if (raw !== null) {
        if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw Error('Duo store too large');
        const saved = JSON.parse(raw);
        if (!validateState(saved, policy)) throw Error('Invalid Duo store');
        this.state = saved; this.raw = raw;
      }
    } catch { this.error = 'Duo store could not be read; nothing was overwritten.'; }
  }
  read() { return {status: this.error ? 'error' : this.state.lastStatus, message: this.error, data: clone(this.state)}; }
  enable() { if (this.error) return this.read(); this.epoch++; this.enabled = true; return this.read(); }
  disable() { this.epoch++; this.enabled = false; return {status: 'off', message: 'Sync stopped on this device. Remote records were not deleted.'}; }
  save(next) {
    if (this.error) return this.read();
    if (!validateState(next, this.policy) || bytes(next) > MAX_BYTES) return {status: 'full', message: 'Duo storage limit reached; existing records were kept.'};
    try {
      if (this.storage.getItem(this.key) !== this.raw) throw Error('Stale Duo writer');
      const raw = JSON.stringify(next); this.storage.setItem(this.key, raw);
      this.raw = raw; this.state = next; return this.read();
    } catch { this.error = 'Duo saving failed or another window changed it. Existing records were kept; reload before syncing.'; return this.read(); }
  }
  enqueue(profile, sessionId) {
    if (!this.enabled) return {status: 'off'};
    if (this.error) return this.read();
    // Only a completion already committed by the local profile can enter the outbox.
    const saved = profile?.read?.();
    if (saved?.status !== 'ready' || saved.data?.enabled !== true || !Array.isArray(saved.data.events))
      return {status: 'ineligible'};
    const profileEvent = saved.data.events.find(e => e.sessionId === sessionId);
    if (!profileEvent) return {status: 'ineligible'};
    let event;
    try { event = duoEvent(profileEvent, this.policy); } catch { return {status: 'ineligible'}; }
    const prior = this.state.events.find(e => eventKey(e) === eventKey(event));
    if (prior) return {status: same(prior, event) ? 'duplicate' : 'conflict'};
    const next = clone(this.state); next.events.push(event); next.pending.push(event.sessionId);
    next.lastStatus = 'pending';
    return this.save(next);
  }
  week(week) {
    if (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw Error('Invalid week');
    const events = this.state.events.filter(e => e.week === week), pending = new Set(this.state.pending);
    const dayKey = e => `${e.memberId}/${e.day}`;
    const days = new Set(events.map(dayKey));
    const confirmed = new Set(events.filter(e => e.memberId !== this.policy.memberId || !pending.has(e.sessionId)).map(dayKey));
    const current = !this.error && !this.busy && this.state.lastStatus === 'synced' && this.state.lastSyncAt !== null && !pending.size;
    return {week, credits: days.size, target: this.policy.target,
      confirmedCredits: confirmed.size, pendingCredits: days.size - confirmed.size,
      // true/false describes the last successful reconciliation; every incomplete
      // state is unknown, including a fresh installation and a failed upload.
      confirmedMet: current ? confirmed.size >= this.policy.target : null,
      pending: this.state.pending.length, lastSyncAt: this.state.lastSyncAt,
      syncStatus: this.error ? 'error' : this.busy ? 'syncing' : this.state.lastStatus};
  }
  async sync(transport, at) {
    if (!this.enabled) return {status: 'off'};
    if (this.error) return this.read();
    if (this.busy) return {status: 'busy'};
    if (!instant(at) || transport.accountId !== this.policy.accountId || typeof transport.identity !== 'function')
      return this.save({...clone(this.state), lastStatus: 'sign-in-required'});
    this.busy = true; const epoch = this.epoch;
    try {
      // Account label is local routing, not authentication: verify the bearer
      // token's actual Drive permission ID before reading or uploading.
      const ownerId = await transport.identity();
      if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
      if (ownerId !== this.policy.ownerId) return this.save({...clone(this.state), lastStatus: 'sign-in-required'});
      // Listing first resolves ambiguous successful uploads after a lost reply.
      const remote = await transport.list();
      if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
      if (!Array.isArray(remote) || remote.length > MAX_EVENTS) throw Error('Incomplete Duo listing');
      const listed = new Map();
      for (const item of remote) {
        if (!keys(item, ['event','ownerId']) || !validDuoEvent(item.event, this.policy) ||
            item.ownerId !== (item.event.memberId === this.policy.memberId ? this.policy.ownerId : this.policy.partnerOwnerId))
          return this.save({...clone(this.state), lastStatus: 'conflict'});
        const key = eventKey(item.event), prior = listed.get(key);
        if (prior && !same(prior, item.event)) return this.save({...clone(this.state), lastStatus: 'conflict'});
        listed.set(key, item.event);
      }
      const next = clone(this.state), known = new Map(next.events.map(e => [eventKey(e), e]));
      for (const [key, event] of listed) {
        const prior = known.get(key);
        if (prior && !same(prior, event)) return this.save({...clone(this.state), lastStatus: 'conflict'});
        if (!prior) { next.events.push(event); known.set(key, event); }
      }
      // A previously seen partner event disappearing must never lower a week silently.
      if (next.events.some(e => e.memberId === this.policy.partnerId && !listed.has(eventKey(e))))
        return this.save({...clone(this.state), lastStatus: 'conflict'});
      next.pending = next.pending.filter(id => !listed.has(`${this.policy.memberId}/${id}`));
      let result = this.save(next); if (result.status === 'error' || result.status === 'full') return result;
      for (const id of [...this.state.pending]) {
        if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
        const event = this.state.events.find(e => e.memberId === this.policy.memberId && e.sessionId === id);
        await transport.create(event);
        if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
        const updated = clone(this.state); updated.pending = updated.pending.filter(value => value !== id);
        result = this.save(updated); if (result.status === 'error' || result.status === 'full') return result;
      }
      if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
      return this.save({...clone(this.state), lastStatus: 'synced', lastSyncAt: at});
    } catch (error) {
      if (!this.enabled || this.epoch !== epoch) return {status: 'off'};
      const status = ['offline','storage-full','sign-in-required','share-revoked'].includes(error?.code) ? error.code : 'error';
      return this.save({...clone(this.state), lastStatus: status});
    } finally { this.busy = false; }
  }
}
