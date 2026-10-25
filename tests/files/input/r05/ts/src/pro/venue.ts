interface Dictionary<T> { [key: string]: T }
type Dict = Dictionary<any>;

class Client { subscriptions: Dictionary<any> = {}; futures: Dictionary<any> = {}; }

export default class venuews {
    tickers: Dictionary<any> = {};
    bidsasks: Dictionary<any> = {};
    orders: Dictionary<any> = {};
    options: Dict = {};

    safeDict (obj, key: string, def: any = undefined) { return obj[key] || def; }
    parsePosition (x) { return { 'a': x }; }

    handle (client: Client, symbol: string, messageHash: string, total: Dict) {
        delete this.tickers[symbol];
        delete client.subscriptions[messageHash];
        const subs = client.subscriptions;
        delete subs[messageHash];
        delete total[messageHash];
        return 1;
    }

    purge (symbols: Value[], i: number, key: string, params: Dict) {
        delete this.tickers[symbols[i]];
        delete this.bidsasks[symbols[i]];
        const stored = this.safeDict (this.options, 'symbolsByOrderId', {});
        delete stored[key];
        const balance: Dict = this.parsePosition (1);
        delete balance[key];
        const cache = this.orders;
        delete cache[key];
        delete this.tickers[this.options['x']];
        delete this.tickers[params['x']];
        return 1;
    }
}
