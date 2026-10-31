import * as nodefs from 'fs';
import * as nodepath from 'path';
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
    test('a sibling passthrough of a unified-string parameter proves a builder parameter only when the pattern names it', () => {
        const dir = nodepath.join(__dirname, 'files', 'tmp-rf-go-7', 'ts', 'src');
        nodefs.mkdirSync(nodepath.join(dir, 'pro'), { recursive: true });
        nodefs.writeFileSync(nodepath.join(dir, 'ex.ts'),
            'class Exchange {}\nexport class ex extends Exchange {\n    buildRequest (symbol: string): string {\n        return symbol.toUpperCase ();\n    }\n    plain (symbol: string): string {\n        return symbol.toUpperCase ();\n    }\n}\n');
        nodefs.writeFileSync(nodepath.join(dir, 'pro', 'ex.ts'),
            "import ex from '../ex.js';\nexport default class exs extends ex {\n    async createOrderWs (symbol: string, type: string) {\n        const a = this.buildRequest (symbol);\n        const b = this.plain (symbol);\n        return [ a, b ];\n    }\n}\n");
        const run = (extra: any) => new Transpiler(config(Object.assign({ 'unifiedStringParams': { 'createOrderWs': [ 0, 1 ] } }, extra))).transpileGoByPath(nodepath.join(dir, 'ex.ts')).content;
        const on = run({ 'siblingStringPassthroughPattern': '^build\\w*Request$' });
        expect(on).toContain('BuildRequest(symbol string)');
        expect(on).toContain('Plain(symbol any)');
        expect(run({})).toContain('BuildRequest(symbol any)');
    });
    afterAll(() => nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-rf-go-7'), { recursive: true, force: true }));
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
