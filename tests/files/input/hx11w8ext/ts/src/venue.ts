import Exchange from './base/Exchange';
import type { Dict } from './base/Exchange';
export default class venue extends Exchange {
    sign (path: string, params: any, maybe: Dict | undefined) {
        const extended = this.extend (params, { 'a': 1 });
        extended['b'] = 2;
        const omitted = this.omit (extended, 'a');
        omitted['c'] = 3;
        const sorted = this.keysort (extended);
        sorted['d'] = 4;
        const loose = this.omit (params, 'a');
        loose['e'] = 5;
        const optional = this.omit (maybe, 'a');
        optional['f'] = 6;
        return [ extended, omitted, sorted, loose, optional ];
    }
}
