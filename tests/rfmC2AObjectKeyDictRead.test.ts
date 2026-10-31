import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config: any = { 'verbose': false, 'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } } };

// RFM-C2-A: reads of a local the embedding build layer printed as a string-keyed dictionary
const source =
    "class Exchange {\n" +
    "    tickers: any;\n" +
    "    f (code: any, name: string) {\n" +
    "        const rows = {};\n" +
    "        for (let i = 0; i < 2; i++) {\n" +
    "            const inner = {};\n" +
    "            const a = inner[code];\n" +
    "            const b = inner[name];\n" +
    "            const c = rows[code];\n" +
    "        }\n" +
    "        const d = this.tickers[name];\n" +
    "        const e = this.tickers[code];\n" +
    "    }\n" +
    "}";

const print = (): string => {
    const transpiler: any = new Transpiler(config);
    const printer = transpiler.csharpTranspiler;
    // the build layer's records: the dictionary locals and the `object` / `string` key declarations it printed
    printer.csharpDeclaredLocalTypeResolver = (declaration: any) => {
        const name = declaration?.name?.text;
        if (name === 'inner' || name === 'rows') return 'Dictionary<string, object>';
        return undefined;
    };
    printer.csharpPrintedLocalType = (node: any) => (node?.text === 'code') ? 'object' : ((node?.text === 'name') ? 'string' : undefined);
    printer.csharpElementRowLocalSource = () => true; // an exchange source
    printer.csharpDeclaredBaseFields = { 'tickers': 'IDictionary<string, object>' };
    return transpiler.transpileCSharp(source).content;
};

describe('RFM-C2-A: object-keyed reads of a declared dictionary', () => {
    const out = print();
    test('an object key casts like GetValue(object, object) on a block-scoped dictionary local', () => {
        expect(out).toContain('(inner != null && code != null && inner.ContainsKey((string)code) ? inner[(string)code] : null)');
        expect(out).toContain('(rows != null && code != null && rows.ContainsKey((string)code) ? rows[(string)code] : null)');
    });
    test('a string key needs no cast', () => {
        expect(out).toContain('(inner != null && name != null && inner.ContainsKey(name) ? inner[name] : null)');
    });
    test('a ws cache member declared a dictionary reads through its own indexer; a non-string key keeps the helper', () => {
        expect(out).toContain('(this.tickers != null && this.tickers.ContainsKey(name) ? this.tickers[name] : null)');
        expect(out).toContain('getValue(this.tickers, code)');
    });
});
