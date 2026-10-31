import { Transpiler } from '../src/transpiler';

// hx11 RF-go-7: createOrders `[]any` slot, Client.url / bound-parameter call-site proofs, uncalled-method table.

const PRELUDE =
    'type Dict = { [key: string]: any };\n' +
    'interface OrderRequest { symbol: string }\n' +
    'class Client { url: string; }\n' +
    'class Exchange {\n' +
    '    async createOrders (orders: OrderRequest[], params = {}): Promise<any> {\n' +
    '        return orders.length;\n' +
    '    }\n' +
    '    createOrder (symbol: string, type: string, side: string): any {\n' +
    '        return symbol;\n' +
    '    }\n' +
    '}\n';

const config = (go: any) => ({ 'verbose': false, 'go': Object.assign({ 'parser': { 'NUM_LINES_END_FILE': 0 } }, go) });
const go = (ts: string, extra: any = {}) => new Transpiler(config(extra)).transpileGo(ts).content;

describe('hx11 RF-go-7 general parameter rules', () => {
    test('a table-listed []any slot prints orders []any and the native length', () => {
        const out = go(PRELUDE, { 'unifiedSliceParams': { 'createOrders': { 0: '[]any' } } });
        expect(out).toContain('orders []any');
        expect(out).toContain('len(orders)');
    });
    test('without the table slot orders stays boxed', () => {
        const out = go(PRELUDE);
        expect(out).not.toContain('orders []any');
    });
    test('an element read of the slot keeps GetValue', () => {
        const ts = PRELUDE.replace('return orders.length;', 'return orders[0];');
        const out = go(ts, { 'unifiedSliceParams': { 'createOrders': { 0: '[]any' } } });
        expect(out).toContain('GetValue(orders, 0)');
    });
    test('a Client.url call site proves a string parameter', () => {
        const ts = 'class Client { url: string; }\n' +
            'class Exchange {}\n' +
            'class ex extends Exchange {\n' +
            '    getType (url: string): string {\n        return url.toUpperCase ();\n    }\n' +
            '    run (client: Client): string {\n        return this.getType (client.url);\n    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('GetType(url string)');
    });
    test('an uncalled table method types its required string params; a stranger stays boxed', () => {
        const ts = 'class Exchange {}\n' +
            'class ex extends Exchange {\n' +
            '    convertIt (code: string, fromNetwork: string): string {\n        return fromNetwork.toUpperCase ();\n    }\n' +
            '    other (code: string, fromNetwork: string): string {\n        return fromNetwork.toUpperCase ();\n    }\n' +
            '}\n';
        const out = go(ts, { 'uncalledStringParams': { 'ex.convertIt': [ 1 ] } });
        expect(out).toContain('ConvertIt(code any, fromNetwork string)');
        expect(out).toContain('Other(code any, fromNetwork any)');
    });
});
