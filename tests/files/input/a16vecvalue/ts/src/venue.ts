import Exchange from './base/Exchange.js';
import type { Dict } from './base/Exchange.js';
export default class venue extends Exchange {
    parseRows (id: string, rows: any[]): Dict {
        const count = rows.length;
        const out = [];
        for (let i = 0; i < count; i++) {
            const row = rows[i];
            out.push (this.safeString (row, 'a'));
        }
        return { 'ids': out, 'info': rows };
    }
    async fetchRows (id: string, params: Dict = {}) {
        const rawRows = this.safeList (params, 'rows', []);
        const first = this.parseRows (id, rawRows);
        const second = this.parseRows (id, rawRows);
        const third = this.parseRows (id, []);
        return [ first, second, third ];
    }
    sumRows (rows: any[], extra: any[]): number {
        // pushed into: stays Value
        extra.push (1);
        return rows.length;
    }
    async callSum (params: Dict = {}) {
        const rawRows = this.safeList (params, 'rows', []);
        return this.sumRows (rawRows, rawRows);
    }
}
