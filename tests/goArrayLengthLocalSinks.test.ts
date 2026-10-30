import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

let transpiler: Transpiler;

beforeAll(() => {
    const config = {
        'verbose': false,
        'go': {
            'parser': {
                'NUM_LINES_END_FILE': 0,
            }
        }
    }
    transpiler = new Transpiler(config);
})

const transpile = (ts: string) => transpiler.transpileGo(ts).content;

// hx10w6 G08: GetArrayLength(x) -> len(x) on a local the printer itself declares as a slice.
// The declaration only takes []any when every later use reads the list the member already was;
// a nil test, an any-parameter helper and a copy into another any/[]any local all qualify.
describe('go .length on a list local from safeList', () => {
    test('a nil test on a defaultless read does not keep the box', () => {
        const ts =
        "class Test {\n" +
        "    safeList (a: any, b: any, c: any) { return a; }\n" +
        "    safeValue (a: any, b: any) { return a; }\n" +
        "    parseTrades (a: any, b: any, c: any, d: any) { return a; }\n" +
        "    f (response: any) {\n" +
        "        const rows = this.safeList(response, 'rows')\n" +
        "        if (rows !== undefined) {\n" +
        "            const n = rows.length\n" +
        "            return n\n" +
        "        }\n" +
        "        return 0\n" +
        "    }\n" +
        "}";
        const output = transpile(ts);
        expect(output).toContain('var rows []any = this.SafeListSlice(response, "rows")');
        expect(output).toContain('len(rows)');
        expect(output).not.toContain('GetArrayLength(rows)');
    });

    test('a copy into another local does not keep the box', () => {
        const ts =
        "class Test {\n" +
        "    safeList (a: any, b: any, c: any) { return a; }\n" +
        "    safeValue (a: any, b: any) { return a; }\n" +
        "    parseTrades (a: any, b: any, c: any, d: any) { return a; }\n" +
        "    f (response: any) {\n" +
        "        let assets: any = []\n" +
        "        const src = this.safeList(response, 'assets')\n" +
        "        assets = src\n" +
        "        const n = src.length\n" +
        "        return [assets, n]\n" +
        "    }\n" +
        "}";
        const output = transpile(ts);
        expect(output).toContain('var src []any = this.SafeListSlice(response, "assets")');
        expect(output).toContain('assets = src');
        expect(output).toContain('len(src)');
        expect(output).not.toContain('GetArrayLength(src)');
    });

    test('a read carrying a default keeps the box', () => {
        const ts =
        "class Test {\n" +
        "    safeList (a: any, b: any, c: any) { return a; }\n" +
        "    f (response: any) {\n" +
        "        const rows = this.safeList(response, 'rows', [])\n" +
        "        if (rows !== undefined) {\n" +
        "            return rows.length\n" +
        "        }\n" +
        "        return 0\n" +
        "    }\n" +
        "}";
        const output = transpile(ts);
        expect(output).toContain('var rows any = this.SafeList(response, "rows", []any{})');
        expect(output).toContain('GetArrayLength(rows)');
    });

    test('a hand-written any sink reads the list', () => {
        const ts =
        "class Test {\n" +
        "    safeList (a: any, b: any, c: any) { return a; }\n" +
        "    safeValue (a: any, b: any) { return a; }\n" +
        "    parseTrades (a: any, b: any, c: any, d: any) { return a; }\n" +
        "    f (response: any) {\n" +
        "        const rows = this.safeList(response, 'rows', [])\n" +
        "        const first = this.safeValue(rows, 0)\n" +
        "        const n = rows.length\n" +
        "        return n\n" +
        "    }\n" +
        "}";
        const output = transpile(ts);
        expect(output).toContain('var rows []any = this.SafeListSlice(response, "rows")');
        expect(output).toContain('len(rows)');
    });

    test('a generated callee keeps the box', () => {
        const ts =
        "class Test {\n" +
        "    safeList (a: any, b: any, c: any) { return a; }\n" +
        "    safeValue (a: any, b: any) { return a; }\n" +
        "    parseTrades (a: any, b: any, c: any, d: any) { return a; }\n" +
        "    f (response: any) {\n" +
        "        const rows = this.safeList(response, 'rows', [])\n" +
        "        const parsed = this.parseTrades(rows, undefined, undefined, undefined)\n" +
        "        const n = rows.length\n" +
        "        return parsed\n" +
        "    }\n" +
        "}";
        const output = transpile(ts);
        expect(output).toContain('var rows any = this.SafeList(response, "rows", []any{})');
        expect(output).toContain('GetArrayLength(rows)');
    });
});
