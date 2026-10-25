interface Dictionary<T> { [key: string]: T }
type Dict = Dictionary<any>;

export default class venue {
    tickers: Dictionary<any> = {};
    options: Dict = {};

    safeDict (obj, key: string, def: any = undefined) { return obj[key] || def; }

    purge (symbols: Value[], i: number, key: string) {
        delete this.tickers[symbols[i]];
        const stored = this.safeDict (this.options, 'rows', {});
        delete stored[key];
        return 1;
    }
}
