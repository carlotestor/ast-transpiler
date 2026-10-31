import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const PRELUDE = 'type Str = string | undefined;\n' +
    'type Dict = {[key: string]: any};\n' +
    'class Base {\n' +
    '    markets: Dict = undefined;\n' +
    '    markets_by_id: Dict = undefined;\n' +
    '    currencies: Dict = undefined;\n' +
    '    safeString (a: any, b: any, c?: string): Str { return undefined; }\n' +
    '}\n';

function go(body: string): string {
    return transpiler.transpileGo(PRELUDE + 'class Test extends Base {\n' + body + '}\n').content;
}

describe('a9j InOp on the market and currency book accessors', () => {
    test('a string-typed key reads the accessor map with comma-ok', () => {
        const out = go('    main () {\n' +
            '        const id = "BTC/USDT";\n' +
            '        if (id in this.markets_by_id) {\n' +
            '            return 1;\n' +
            '        }\n' +
            '        return 0;\n' +
            '    }\n');
        expect(out).toContain('_, ok := this.Markets_by_id[');
        expect(out).not.toContain('InOp(');
    });
    test('an any key keeps the helper', () => {
        const out = go('    main (key: any) {\n' +
            '        if (key in this.markets) {\n' +
            '            return 1;\n' +
            '        }\n' +
            '        return 0;\n' +
            '    }\n');
        expect(out).toContain('InOp(');
    });
});
