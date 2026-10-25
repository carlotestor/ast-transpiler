interface Dictionary<T> { [key: string]: T }
type Dict = Dictionary<any>;

export default class venue {
    balance: Dict = {};
    ohlcvs: Dict = {};
    orderbook: any = {};
    cache: any = {};
    tickers: Dict = {};

    omit (x, k) { return x; }

    sign (path: string, params: Dict = {}) {
        const marks = Object.keys (this.tickers);
        params['x']['y'] = 5;
        params['a']['b']['c'] = 8;
        const code = 'USDT';
        params[code]['free'] = 4;
        const request: Dict = { 'a': 1 };
        request['a']['b'] = 2;
        const response: Dict = this.omit (params, 'x');
        response['a']['b'] = 5;
        this.orderbook['a']['b'] = 6;
        return [ request, response, code, marks ];
    }

    dynamic (key: any, params: Dict = {}) {
        const marks = Object.keys (this.tickers);
        params[key]['b'] = 1;
        params['a']['b'] = 2;
        return [ params, marks ];
    }
}
