import { Transpiler } from '../src/transpiler';

// hx10w10 GP28 (was ccxt build/hx10w10-GP28.ts): a store of a ws list cache into BaseExchange.Trades is the
// helper's map branch, so it prints as a native index write; a *string key keeps the helper's nil skip.

let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const BASE = 'type Str = string | undefined;\ntype Int = number | undefined;\n'
    + 'class ArrayCache { constructor (n: Int) {} append (x: any) {} }\n'
    + 'class BaseExchange {\n'
    + '    trades: any;\n    options: any;\n'
    + '    safeValue (o: any, k: any, d?: any): any { return d; }\n'
    + '    safeString (o: any, k: string, d?: string): Str { return d; }\n'
    + '    safeInteger (o: any, k: string, d?: number): Int { return d; }\n'
    + '}\n';

const go = (body: string) => transpiler.transpileGo(BASE + 'class Venue extends BaseExchange {\n' + body + '\n}\n').content;

const handler = (tail: string) => 'handle (m: any) {\n'
    + "    const symbol = this.safeString (m, 's');\n"
    + '    let stored = this.safeValue (this.trades, symbol);\n'
    + '    if (stored === undefined) {\n'
    + "        stored = new ArrayCache (this.safeInteger (this.options, 'limit', 1000));\n"
    + '    }\n'
    + tail
    + '}';

describe('GP28 cache stores into BaseExchange.Trades', () => {
    test('a *string key stores under its nil skip', () => {
        const out = go(handler('    this.trades[symbol] = stored;\n'));
        expect(out).toContain('if symbol != nil {\n\t\tthis.Trades[*symbol] = stored\n\t}');
        expect(out).not.toContain('AddElementToObject(this.Trades');
    });
    test('a constructor stored directly', () => {
        const out = go("handle (m: any) {\n    const symbol = this.safeString (m, 's');\n    this.trades[symbol] = new ArrayCache (10);\n}");
        expect(out).toContain('if symbol != nil {\n\t\tthis.Trades[*symbol] = NewArrayCache(10)\n\t}');
        expect(out).not.toContain('AddElementToObject(this.Trades');
    });
    test('a string key stores bare', () => {
        const out = go("handle (m: any) {\n    const symbol = this.safeString (m, 's', '');\n    this.trades[symbol] = new ArrayCache (10);\n}");
        expect(out).not.toContain('AddElementToObject(this.Trades');
    });
    test('an enclosing nil test stores bare', () => {
        const out = go(handler('    if (symbol !== undefined) {\n        this.trades[symbol] = stored;\n    }\n'));
        expect(out).toContain('this.Trades[*symbol] = stored');
        expect(out.split('if symbol != nil').length).toBe(2); // the source guard only
    });
    test('negative: a value of another shape keeps the helper', () => {
        const out = go('handle (symbol: any, v: any) {\n    this.trades[symbol] = v;\n}');
        expect(out).toContain('AddElementToObject(this.Trades');
    });
    test('negative: a local rewritten with another value keeps the helper', () => {
        const out = go(handler('    stored = this.safeString (m, "x");\n    this.trades[symbol] = stored;\n'));
        expect(out).toContain('AddElementToObject(this.Trades');
    });
    test('negative: another field is untouched', () => {
        const out = go('handle (symbol: any) {\n    this.options[symbol] = new ArrayCache (10);\n}');
        expect(out).not.toContain('this.Trades');
    });
});
