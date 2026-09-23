// Foreground-only Google Drive transport spike. No OAuth flow, token persistence,
// pairing UI or background notification service is included.
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = /^[A-Za-z0-9_-]{10,200}$/;
const FILE_PREFIX = 'formcoach-duo-';
const MAX_FILE_BYTES = 4096;

export class DriveDuoError extends Error {
  constructor(code) { super(code); this.name = 'DriveDuoError'; this.code = code; }
}
function classify(status, reason) {
  if (status === 401) return 'sign-in-required';
  if (reason === 'storageQuotaExceeded' || reason === 'activeItemCreationLimitExceeded') return 'storage-full';
  if (status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)) return 'error';
  if (status === 403 || status === 404) return 'share-revoked';
  return 'error';
}
export class DriveDuoTransport {
  constructor({accessToken, accountId, folderId, fetchFn = globalThis.fetch}) {
    if (typeof accessToken !== 'string' || !accessToken || typeof accountId !== 'string' || !accountId ||
        !FOLDER.test(folderId) || typeof fetchFn !== 'function') throw Error('Invalid Drive transport');
    this.accessToken = accessToken; this.accountId = accountId; this.folderId = folderId; this.fetch = fetchFn;
  }
  async request(url, options = {}) {
    let response;
    try {
      response = await this.fetch(url, {...options, signal: AbortSignal.timeout(10000), headers: {
        authorization: `Bearer ${this.accessToken}`, ...options.headers
      }});
    } catch { throw new DriveDuoError('offline'); }
    if (!response.ok) {
      let reason;
      try { reason = (await response.json()).error?.errors?.[0]?.reason; } catch { /* A provider error body may not be JSON. */ }
      throw new DriveDuoError(classify(response.status, reason));
    }
    return response;
  }
  async identity() {
    const about = await (await this.request('https://www.googleapis.com/drive/v3/about?fields=user(permissionId)')).json();
    if (typeof about?.user?.permissionId !== 'string' || !about.user.permissionId) throw new DriveDuoError('sign-in-required');
    return about.user.permissionId;
  }
  async list() {
    const result = []; let pageToken = null;
    for (let page = 0; page < 20; page++) {
      const url = new URL(API);
      url.searchParams.set('q', `'${this.folderId}' in parents and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,owners(permissionId))');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const listing = await (await this.request(url)).json();
      if (!listing || listing.incompleteSearch === true || !Array.isArray(listing.files) || listing.files.length > 1000)
        throw new DriveDuoError('error');
      for (const file of listing.files) {
        if (!file.name?.startsWith(FILE_PREFIX)) continue;
        if (!FOLDER.test(file.id) || file.mimeType !== 'application/json' || Number(file.size) > MAX_FILE_BYTES ||
            !Array.isArray(file.owners) || file.owners.length !== 1 || typeof file.owners[0].permissionId !== 'string')
          throw new DriveDuoError('error');
        const response = await this.request(`${API}/${encodeURIComponent(file.id)}?alt=media`);
        const body = await response.text();
        if (new TextEncoder().encode(body).byteLength > MAX_FILE_BYTES) throw new DriveDuoError('error');
        let event; try { event = JSON.parse(body); } catch { throw new DriveDuoError('error'); }
        result.push({event, ownerId: file.owners[0].permissionId});
        if (result.length > 4000) throw new DriveDuoError('error');
      }
      if (!listing.nextPageToken) return result;
      if (typeof listing.nextPageToken !== 'string' || listing.nextPageToken === pageToken) throw new DriveDuoError('error');
      pageToken = listing.nextPageToken;
    }
    throw new DriveDuoError('error'); // An incomplete page scan is never a clean sync.
  }
  async create(event) {
    if (!event || typeof event.sessionId !== 'string' || typeof event.memberId !== 'string') throw Error('Invalid Duo upload');
    const metadata = {name: `${FILE_PREFIX}${event.memberId}-${event.sessionId}.json`,
      mimeType: 'application/json', parents: [this.folderId]};
    const content = JSON.stringify(event);
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) throw new DriveDuoError('error');
    const boundary = 'formcoachduo' + crypto.randomUUID().replaceAll('-', '');
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`+
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const url = `${UPLOAD}?uploadType=multipart&fields=id,name,owners(permissionId)`;
    const response = await this.request(url, {method: 'POST', headers: {'content-type': `multipart/related; boundary=${boundary}`}, body});
    const saved = await response.json();
    if (!FOLDER.test(saved?.id)) throw new DriveDuoError('error');
    return saved.id;
  }
}
