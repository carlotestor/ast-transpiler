import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    const config = { 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
    transpiler = new Transpiler(config);
});

function go(ts: string): string {
    return transpiler.transpileGo(ts).content;
}

const PRELUDE = 'interface MarketInterface { id: string; symbol: string; url: string; }\n' +
    'type Market = MarketInterface | undefined;\n' +
    'type Dict = { [key: string]: any };\n' +
    'type Str = string | undefined;\n' +
    'class Base {}\n';

describe('hx10 G02 required market parameters', () => {
    test('an untyped market parameter whose callers all pass the accessor row prints the map', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    requestBody (market: any): any {\n' +
            '        return market[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const market = this.market (symbol);\n' +
            '        return this.requestBody (market);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) RequestBody(market map[string]any) any {');
        expect(out).toContain('return market["id"]');
    });

    test('one caller passing an absent value keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    requestBody (market: any): any {\n' +
            '        return market[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const market = this.market (symbol);\n' +
            '        return [ this.requestBody (market), this.requestBody (undefined) ];\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) RequestBody(market any) any {');
        expect(out).toContain('GetValue(market, "id")');
    });

    test('a body that nil-tests a map parameter compares it natively', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    requestBody (market: any): any {\n' +
            '        if (market === undefined) { return undefined; }\n' +
            '        return market[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const market = this.market (symbol);\n' +
            '        return this.requestBody (market);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) RequestBody(market map[string]any) any {');
        expect(out).toContain('if market == nil {');
        expect(out).not.toContain('IsEqual(market, nil)');
    });

    test('a parameter the caller does not prove stays the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    requestBody (market: any): any {\n' +
            '        return market[\'id\'];\n' +
            '    }\n' +
            '    main (raw: any): any {\n' +
            '        return this.requestBody (raw);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) RequestBody(market any) any {');
    });

    test('a Market-typed required parameter still takes the map', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    requestBody (market: Market): any {\n' +
            '        return market[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const market = this.market (symbol);\n' +
            '        return this.requestBody (market);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) RequestBody(market map[string]any) any {');
        expect(out).toContain('return market["id"]');
    });
});
