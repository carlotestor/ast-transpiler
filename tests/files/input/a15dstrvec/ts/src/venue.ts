import Exchange from './base/Exchange.js';
import type { Dict } from './base/Exchange.js';
export default class venue extends Exchange {
    async fetchByIds (ids: string[], symbol: string = undefined, params: Dict = {}) {
        const request: Dict = { 'txid': ids.join (',') };
        return request;
    }
    async fetchOne (id: string, params: Dict = {}) {
        return await this.fetchByIds ([ id ], undefined, params);
    }
    async fetchIndexed (ids: string[], params: Dict = {}) {
        const first = ids[0];
        return ids.join (',') + first;
    }
    async fetchOneIndexed (id: string, params: Dict = {}) {
        return await this.fetchIndexed ([ id ], params);
    }
    async fetchComputed (ids: string[], params: Dict = {}) {
        return ids.join (',');
    }
    async fetchComputedCaller (params: Dict = {}) {
        const ids = this.safeList (params, 'ids', []);
        return await this.fetchComputed (ids, params);
    }
    async fetchNoCaller (ids: string[], symbol: string = undefined, params: Dict = {}) {
        const request: Dict = { 'txid': ids.join (',') };
        return request;
    }
}
