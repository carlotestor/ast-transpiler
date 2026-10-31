import { Transpiler } from '../src/transpiler';

// hx11 rfm-G1 G02w3: the ws caches a base class declares (Orderbooks / Ohlcvs / Trades / FundingRates) are owned by
// the exchange's dispatch loop. A user-path method (async watch*/fetch*/seed*, cleanWsData) hands every access to the
// loop through the configured accessors; handlers keep indexing the map. Keyed on the checker declaration + the method
// the access sits in, never on printed text. No `wsCaches` config = the plain map operations.

const WS_CACHES = {
    'declaredIn': 'BaseExchange',
    'fields': [ 'orderbooks', 'ohlcvs', 'trades', 'fundingRates' ],
    'ops': { 'get': 'WsCacheGet', 'set': 'WsCacheSet', 'has': 'WsCacheHas', 'snapshot': 'WsCacheSnapshot', 'reset': 'WsCacheReset' },
    'readCalls': [ 'safeValue', 'safeDict' ],
    'walkCalls': [ 'filterByArray' ],
    'userPath': [ { 'name': '^(?:watch|fetch|seed)\\w*$', 'async': true }, { 'name': '^cleanWsData$', 'async': false } ],
};

const PRELUDE =
    'type Dict = { [key: string]: any };\n' +
    'type Str = string | undefined;\n' +
    'class BaseExchange {\n' +
    '    orderbooks: Dict = {};\n' +
    '    ohlcvs: Dict = {};\n' +
    '    trades: Dict = {};\n' +
    '    fundingRates: Dict = {};\n' +
    '    balance: Dict = {};\n' +
    '    safeValue (d: any, k: any): any { return d[k]; }\n' +
    '    safeDict (d: any, k: any): any { return d[k]; }\n' +
    '    safeString (d: any, k: any): Str { return undefined; }\n' +
    '    filterByArray (d: any, k: string, v: any): any { return d; }\n' +
    '    createSafeDictionary (x: boolean): Dict { return {}; }\n' +
    '    orderBook (x: any = {}, limit: any = undefined): any { return x; }\n' +
    '}\n';

const run = (body: string, config: any = WS_CACHES, prelude = PRELUDE) =>
    new Transpiler({ 'verbose': false, 'go': { ...((config === null) ? {} : { 'wsCaches': config }), 'parser': { 'NUM_LINES_END_FILE': 0 } } })
        .transpileGo(prelude + 'class Ex extends BaseExchange {\n' + body + '}\n').content;

describe('hx11 rfm-G1 G02w3: ws caches owned by the dispatch loop', () => {
    test('a user-path read, store and membership test ask the owner', () => {
        const out = run(
            '    async watchBook (symbol: string) {\n' +
            '        if (!(symbol in this.orderbooks)) {\n' +
            '            this.orderbooks[symbol] = this.orderBook ({}, 5);\n' +
            '        }\n' +
            '        const ob = this.orderbooks[symbol];\n' +
            '        const seen = this.safeValue (this.orderbooks, symbol);\n' +
            '        const dict = this.safeDict (this.orderbooks, symbol);\n' +
            '        return [ ob, seen, dict ];\n' +
            '    }\n');
        expect(out).toContain('if !this.WsCacheHas("Orderbooks", symbol) {');
        expect(out).toContain('this.WsCacheSet("Orderbooks", symbol, this.OrderBook(map[string]any{}, 5))');
        expect(out).toContain('var ob any = this.WsCacheGet("Orderbooks", symbol)');
        expect(out).toContain('this.WsCacheGet("Orderbooks", symbol)');
        expect(out).not.toContain('this.Orderbooks');
        expect(out).not.toContain('SafeValue(this');
    });

    test('a walk over the whole cache reads a snapshot', () => {
        const out = run('    async watchRates (symbols: string) {\n        return this.filterByArray (this.fundingRates, \'symbol\', symbols);\n    }\n');
        expect(out).toContain('this.FilterByArray(this.WsCacheSnapshot("FundingRates"), "symbol", symbols)');
    });

    test('cleanWsData resets a cache through the owner, other fields keep the assignment', () => {
        const out = run('    cleanWsData () {\n        this.orderbooks = this.createSafeDictionary (true);\n        this.ohlcvs = {};\n        this.balance = {};\n    }\n');
        expect(out).toContain('this.WsCacheReset("Orderbooks")');
        expect(out).toContain('this.WsCacheReset("Ohlcvs")');
        expect(out).toContain('this.Balance = ');
    });

    test('the closure of a user-path method is user path', () => {
        const out = run('    async watchBook (symbol: string) {\n        const f = () => this.safeValue (this.orderbooks, symbol);\n        return f ();\n    }\n');
        expect(out).toContain('this.WsCacheGet("Orderbooks", symbol)');
    });

    test('handlers and sync methods keep the plain map', () => {
        const out = run(
            '    handleBook (symbol: string) {\n' +
            '        if (!(symbol in this.orderbooks)) {\n' +
            '            this.orderbooks[symbol] = this.orderBook ();\n' +
            '        }\n' +
            '        return this.orderbooks[symbol];\n' +
            '    }\n' +
            '    cleanCache (symbol: string) {\n' +
            '        return this.safeValue (this.orderbooks, symbol);\n' +
            '    }\n');
        expect(out).not.toContain('WsCache');
        expect(out).toContain('this.Orderbooks');
    });

    test('a sync fetch* and a non-cache field of a user-path method are untouched', () => {
        const out = run('    fetchBook (symbol: string) {\n        return this.orderbooks[symbol];\n    }\n    async watchBalance (symbol: string) {\n        return this.balance[symbol];\n    }\n');
        expect(out).not.toContain('WsCache');
    });

    test('a same-named field of another class is not the cache', () => {
        const out = new Transpiler({ 'verbose': false, 'go': { 'wsCaches': WS_CACHES, 'parser': { 'NUM_LINES_END_FILE': 0 } } }).transpileGo(
            'class Other { orderbooks: any = {}; }\nclass Ex extends Other {\n    async watchBook (symbol: string) {\n        return this.orderbooks[symbol];\n    }\n}\n').content;
        expect(out).not.toContain('WsCache');
    });

    test('a key that is not a proven Go string prints as is', () => {
        const out = run('    async watchBook (symbol: Str) {\n        if (symbol !== undefined) {\n            this.orderbooks[symbol] = this.orderBook ();\n        }\n    }\n');
        expect(out).toContain('this.WsCacheSet("Orderbooks", symbol, this.OrderBook())');
    });

    test('no wsCaches config = the plain map operations', () => {
        const out = run('    async watchBook (symbol: string) {\n        this.orderbooks[symbol] = this.orderBook ();\n        return this.safeValue (this.orderbooks, symbol);\n    }\n', null);
        expect(out).not.toContain('WsCache');
        expect(out).toContain('this.Orderbooks');
    });
});
