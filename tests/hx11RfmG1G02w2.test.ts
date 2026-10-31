import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

// RFM-G1 G02w2 (was build/hx10w2-G02.ts): a local that provably holds a slice is declared with it, so
// GetArrayLength(x) prints len(x) and GetValue(xs, i) prints xs[i] inside a loop that bounds i to the slice length.
// The host names the generated methods whose signature it retypes to `[]any` (config `listReturnMethods`).
const transpile = (ts: string, listReturnMethods: string[] = [ 'ParseTrades' ]) => {
    const transpiler = new Transpiler({
        'verbose': false,
        'go': { 'listReturnMethods': listReturnMethods, 'parser': { 'NUM_LINES_END_FILE': 0 } },
    });
    return transpiler.transpileGo(ts).content;
};

const cls = (body: string) =>
    'class Test {\n' +
    '    parseTrades (a: any): any[] { return []; }\n' +
    '    parseOther (a: any): any[] { return []; }\n' +
    '    keysOf (a: any): string[] { return []; }\n' +
    body +
    '}';

describe('go: slice locals and bounded element reads', () => {
    test('a local holding a list-returning call is a []any and its length is native', () => {
        const output = transpile(cls(
            '    f (response: any) {\n' +
            '        const trades = this.parseTrades (response);\n' +
            '        const n = trades.length;\n' +
            '        return n;\n' +
            '    }\n'));
        expect(output).toContain('var trades []any = this.ParseTrades(response)');
        expect(output).toContain('var n int = len(trades)');
        expect(output).not.toContain('GetArrayLength(trades)');
    });

    test('a method the host did not name keeps the box', () => {
        const output = transpile(cls(
            '    f (response: any) {\n' +
            '        const rows = this.parseOther (response);\n' +
            '        const n = rows.length;\n' +
            '        return n;\n' +
            '    }\n'));
        expect(output).toContain('var rows any = this.ParseOther(response)');
        expect(output).toContain('GetArrayLength(rows)');
    });

    test('a nil test on a list-call local keeps the box', () => {
        const output = transpile(cls(
            '    f (response: any) {\n' +
            '        const trades = this.parseTrades (response);\n' +
            '        if (trades === undefined) {\n' +
            '            return 0;\n' +
            '        }\n' +
            '        return trades.length;\n' +
            '    }\n'));
        expect(output).toContain('var trades any = this.ParseTrades(response)');
        expect(output).toContain('GetArrayLength(trades)');
    });

    test('a nil-initialised local written only with slices is a []any', () => {
        const output = transpile(cls(
            '    f (response: any) {\n' +
            '        let out: any[];\n' +
            '        if (response) {\n' +
            '            out = this.parseTrades (response);\n' +
            '        } else {\n' +
            '            out = [ response ];\n' +
            '        }\n' +
            '        return out.length;\n' +
            '    }\n'));
        expect(output).toContain('var out []any = nil');
        expect(output).toContain('len(out)');
    });

    test('a plain-element slice read by the counter of its own length loop is native', () => {
        const output = transpile(cls(
            '    f (p: any) {\n' +
            '        const keys: string[] = Object.keys (p);\n' +
            '        let out = \'\';\n' +
            '        for (let i = 0; i < keys.length; i++) {\n' +
            '            out = keys[i];\n' +
            '        }\n' +
            '        return out;\n' +
            '    }\n'), []);
        expect(output).toContain('keys[i]');
        expect(output).not.toContain('GetValue(keys, i)');
    });

    test('a read outside a bounding loop, or with a written counter, keeps the helper', () => {
        const outside = transpile(cls(
            '    f (p: any) {\n' +
            '        const keys: string[] = Object.keys (p);\n' +
            '        return keys[0];\n' +
            '    }\n'), []);
        expect(outside).toContain('GetValue(keys, 0)');
        const rebased = transpile(cls(
            '    f (p: any) {\n' +
            '        const keys: string[] = Object.keys (p);\n' +
            '        let out = \'\';\n' +
            '        for (let i = 0; i < keys.length; i++) {\n' +
            '            i = i + 1;\n' +
            '            out = keys[i];\n' +
            '        }\n' +
            '        return out;\n' +
            '    }\n'), []);
        expect(rebased).toContain('GetValue(keys, i)');
    });

    test('a read whose element is nil-tested keeps the helper', () => {
        const output = transpile(cls(
            '    f (p: any) {\n' +
            '        const keys: string[] = Object.keys (p);\n' +
            '        for (let i = 0; i < keys.length; i++) {\n' +
            '            if (keys[i] === undefined) {\n' +
            '                return 1;\n' +
            '            }\n' +
            '        }\n' +
            '        return 0;\n' +
            '    }\n'), []);
        expect(output).not.toContain('keys[i] ==');
    });
});
