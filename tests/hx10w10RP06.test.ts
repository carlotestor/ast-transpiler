import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const PRELUDE = 'interface Dictionary<T> { [key: string]: T }\n' +
    'type Dict = Dictionary<any>;\n' +
    'type Str = string | undefined;\n' +
    'interface MarketInterface { id?: string, symbol?: string }\n' +
    'type Market = MarketInterface | undefined;\n' +
    'class Base {\n' +
    '    market (symbol: Str): Market { return undefined; }\n' +
    '    safeString (o: any, k: any, def: any = undefined): any { return undefined; }\n' +
    '    safeDict (o: any, k: any, def: any = undefined): Dict { return o[k]; }\n' +
    '    safeList (o: any, k: any, def: any = undefined): any[] { return []; }\n' +
    '    extend (a: any, b: any): any { return a; }\n' +
    '    parseOrderBook (o: any, s: Str): Dict { return { "symbol": s }; }\n' +
    '    use (x: any): any { return x; }\n' +
    '}\n' +
    'class Venue extends Base {\n';

function rust(body: string): string {
    return transpiler.transpileRust(PRELUDE + body + '}\n').content;
}

// hx10w10 RP06: a local initialised from `this.<m>(…)` is typed as the container
// the callee's own returns build, so its reads and writes print the native op.
describe('hx10w10 RP06 call-init container locals', () => {
    test('a base method that returns a literal map types the local and its write', () => {
        const out = rust('    depth (response: any, symbol: Str) {\n'
            + '        const orderbook = this.parseOrderBook (response, symbol);\n'
            + "        orderbook['nonce'] = 1;\n"
            + '        return orderbook;\n'
            + '    }\n');
        expect(out).toContain('let mut orderbook: indexmap::IndexMap<String, Value> = self.parseOrderBook(response, symbol).as_map().cloned().unwrap_or_default();');
        expect(out).toContain('orderbook.insert("nonce".into(), Value::Int(1));');
        expect(out).not.toContain('add_element_to_object(&mut orderbook');
        expect(out).not.toContain('if let Value::Dict(__d) = &mut orderbook');
    });

    test('a literal-key read on the typed local prints the map lookup', () => {
        const out = rust('    depthNonce (response: any, symbol: Str) {\n'
            + '        const orderbook = this.parseOrderBook (response, symbol);\n'
            + "        return orderbook['nonce'];\n"
            + '    }\n');
        expect(out).toContain('let mut orderbook: indexmap::IndexMap<String, Value>');
        expect(out).toContain('orderbook.get("nonce").cloned().unwrap_or(Value::Null)');
        expect(out).not.toContain('get_value(&orderbook');
    });

    test('a request builder local rebuilt from its own literal local types too', () => {
        const out = rust('    orderRequest (symbol: Str, params: Dict) {\n'
            + '        const request = this.createOrderRequest (symbol, params);\n'
            + "        request['limit'] = 10;\n"
            + '        return request;\n'
            + '    }\n'
            + '\n'
            + '    createOrderRequest (symbol: Str, params: Dict): Dict {\n'
            + "        const request: Dict = { 'symbol': symbol };\n"
            + "        request['amount'] = 1;\n"
            + '        return this.extend (request, params);\n'
            + '    }\n');
        expect(out).toContain('let mut request: indexmap::IndexMap<String, Value> = self.createOrderRequest(symbol, params).as_map().cloned().unwrap_or_default();');
        expect(out).toContain('request.insert("limit".into(), Value::Int(10));');
        expect(out).not.toContain('add_element_to_object(&mut request');
    });

    test('a pass-through builder of a literal argument types the local', () => {
        const out = rust('    parsedTicker (t: Dict, m: Market) {\n'
            + '        const ticker = this.safeTicker ({}, m);\n'
            + "        ticker['symbol'] = 'BTC/USDT';\n"
            + '        return ticker;\n'
            + '    }\n'
            + '\n'
            + '    safeTicker (ticker: Dict, market: Market = undefined): Dict {\n'
            + '        return ticker;\n'
            + '    }\n');
        expect(out).toContain('let mut ticker: indexmap::IndexMap<String, Value>');
        expect(out).toContain('ticker.insert("symbol".into(), Value::Str("BTC/USDT".into()));');
        expect(out).not.toContain('add_element_to_object(&mut ticker');
    });

    test('a callee returning a boxed reader keeps the helper', () => {
        const out = rust('    boxed (response: any) {\n'
            + '        const orderbook = this.parseOrderBook (response, "BTC/USDT");\n'
            + '        return orderbook;\n'
            + '    }\n'
            + '\n'
            + '    parseOrderBook (o: any, s: Str): Dict {\n'
            + "        const data = this.safeDict (o, 'data');\n"
            + '        return data;\n'
            + '    }\n');
        expect(out).toContain('let mut orderbook: Value = self.parseOrderBook(response, Value::Str("BTC/USDT".into()));');
    });

    test('a callee that also returns an element read keeps the helper', () => {
        const out = rust('    mixed (rows: any[]) {\n'
            + '        const first = this.pick (rows);\n'
            + "        first['seen'] = true;\n"
            + '        return first;\n'
            + '    }\n'
            + '\n'
            + '    pick (rows: any[]): Dict {\n'
            + "        if (rows.length > 0) { return rows[0]; }\n"
            + "        return { 'seen': false };\n"
            + '    }\n');
        expect(out).toContain('add_element_to_object(&mut first');
        expect(out).toContain('let mut first: Value = self.pick(rows)');
    });

    test('a callee that reassigns its built local keeps the box', () => {
        const out = rust('    reassigned (symbol: Str) {\n'
            + '        const request = this.build (symbol);\n'
            + "        request['limit'] = 5;\n"
            + '        return request;\n'
            + '    }\n'
            + '\n'
            + '    build (symbol: Str): Dict {\n'
            + "        let request: Dict = { 'symbol': symbol };\n"
            + '        request = [ request ] as any;\n'
            + '        return request;\n'
            + '    }\n');
        expect(out).toContain('add_element_to_object(&mut request');
    });

    test('a produced local that escapes boxes once at the escape, write folded', () => {
        const out = rust('    escaped (response: any) {\n'
            + '        const orderbook = this.parseOrderBook (response, "BTC/USDT");\n'
            + "        orderbook['nonce'] = 1;\n"
            + '        return this.use (orderbook);\n'
            + '    }\n');
        expect(out).toContain('let mut orderbook: indexmap::IndexMap<String, Value>');
        expect(out).toContain('orderbook.insert("nonce".into(), Value::Int(1));');
        expect(out).toContain('self.use(Value::Map(orderbook))');
        expect(out).not.toContain('add_element_to_object(&mut orderbook');
    });

    test('a produced local that only escapes keeps the box (no helper folds)', () => {
        const out = rust('    onlyEscaped (response: any) {\n'
            + '        const orderbook = this.parseOrderBook (response, "BTC/USDT");\n'
            + '        return this.use (orderbook);\n'
            + '    }\n');
        expect(out).toContain('let mut orderbook: Value = self.parseOrderBook(response, Value::Str("BTC/USDT".into()));');
    });

    test('a local read out of the live ws order cache keeps the helper', () => {
        const out = rust('    cachedOrders (cached: any, orderId: Str) {\n'
            + '        const orders = this.safeDict (cached.hashmap (), "BTC/USDT", {});\n'
            + '        orders[orderId] = 1;\n'
            + '        return orders;\n'
            + '    }\n');
        expect(out).toContain('let mut orders: Value = self.safeDict(cached.hashmap(), Value::Str("BTC/USDT".into())');
        expect(out).not.toContain('let mut orders: indexmap::IndexMap');
    });

    test('a callee that stores the container it returns keeps the box', () => {
        const out = rust('    stored (response: any) {\n'
            + '        const book = this.seed (response);\n'
            + "        book['nonce'] = 1;\n"
            + '        return book;\n'
            + '    }\n'
            + '\n'
            + '    seed (response: any): Dict {\n'
            + '        const book: Dict = {};\n'
            + '        this.orderbooks["BTC/USDT"] = book;\n'
            + '        return book;\n'
            + '    }\n');
        expect(out).toContain('add_element_to_object(&mut book');
    });
});
