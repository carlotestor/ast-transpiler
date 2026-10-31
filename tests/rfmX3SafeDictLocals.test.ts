import { Transpiler, installRfmX3SafeDictLocals } from '../src/transpiler';

// RFM-X3 M43: `const d = this.safeDict (c, k[, {}])` locals the shipped container rules leave boxed become `map[string]any`
// locals read through the typed twin SafeDictMap; keyed on the checker-resolved base fields and the TS use positions.
const t = (install = true) => {
    const x = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (install) { installRfmX3SafeDictLocals (x.goTranspiler); }
    return x;
};
const BASE = [
    'class BaseExchange {',
    '    options: any = {};',
    '    balance: any = {};',
    '    markets: any = {};',
    '    safeDict (d: any, k: any, dflt: any = undefined): any { return d[k] ?? dflt; }',
    '    safeDict2 (d: any, k: any, k2: any, dflt: any = undefined): any { return d[k] ?? dflt; }',
    '    safeString (d: any, k: any, dflt: string = undefined): string { return d[k] ?? dflt; }',
    '    safeInteger (d: any, k: any, dflt: number = undefined): number { return d[k] ?? dflt; }',
    '    extend (a: any, b: any): any { return a; }',
    '}',
    '',
].join ('\n');
const venue = (body: string) => BASE + 'class venue extends BaseExchange {\n' + body + '}\n';
const go = (body: string, install = true) => t (install).transpileGo (venue (body)).content;
const typed = 'var d map[string]any = this.SafeDictMap(';

describe('RFM-X3 M43 SafeDict-seeded locals', () => {
    test('a literal-default local with read/argument uses is a typed map', () => {
        const body = '    f (r: any) {\n        const d = this.safeDict (r, \'k\', {});\n        const e = this.extend (d, {});\n        return this.safeString (d, \'x\') + e;\n    }\n';
        expect (go (body)).toContain (typed + 'r, "k", map[string]any{})');
        expect (go (body, false)).not.toContain ('SafeDictMap');
    });
    test('the two-key accessor and a base options receiver', () => {
        expect (go ('    f (r: any) {\n        const d = this.safeDict2 (r, \'a\', \'b\', {});\n        return this.extend (d, {});\n    }\n')).toContain ('var d map[string]any = this.SafeDict2Map(r, "a", "b", map[string]any{})');
        expect (go ('    f () {\n        const d = this.safeDict (this.options, \'k\', {});\n        return this.extend (d, {});\n    }\n')).toContain (typed + 'this.Options, "k", map[string]any{})');
    });
    test('no default: nil tests and plain safe reads type the local, a handed-out use keeps the box', () => {
        const guarded = '    f (r: any) {\n        const d = this.safeDict (r, \'k\');\n        if (d !== undefined) {\n            return this.extend (d, {});\n        }\n        return this.safeString (d, \'x\');\n    }\n';
        expect (go (guarded)).toContain (typed + 'r, "k")');
        const handedOut = '    f (r: any) {\n        const d = this.safeDict (r, \'k\');\n        return d;\n    }\n';
        expect (go (handedOut)).not.toContain ('SafeDictMap');
        const unguarded = '    f (r: any) {\n        const d = this.safeDict (r, \'k\');\n        return this.extend (d, {});\n    }\n';
        expect (go (unguarded)).not.toContain ('SafeDictMap');
    });
    test('a rebind to again a literal-default accessor keeps one map type', () => {
        const body = '    f (r: any) {\n        let d = this.safeDict (r, \'k\', {});\n        d = this.safeDict (r, \'j\', {});\n        return this.extend (d, {});\n    }\n';
        const out = go (body);
        expect (out).toContain ('var d map[string]any = this.SafeDictMap(r, "k", map[string]any{})');
        expect (out).toContain ('d = this.SafeDictMap(r, "j", map[string]any{})');
    });
    test('uses that need the box keep it', () => {
        for (const use of [ 'd = this.extend (d, {});', 'const q = d.foo;', 'if (Array.isArray (d)) { return 1; }', 'if (d === r) { return 1; }', 'd = r;' ]) {
            const body = '    f (r: any) {\n        let d = this.safeDict (r, \'k\', {});\n        ' + use + '\n        return this.extend (d, {});\n    }\n';
            expect (go (body)).not.toContain ('SafeDictMap');
        }
    });
    test('other this members and computed defaults keep the box; a second declaration keeps it', () => {
        expect (go ('    f () {\n        const d = this.safeDict (this.markets, \'k\', {});\n        return this.extend (d, {});\n    }\n')).not.toContain ('SafeDictMap');
        expect (go ('    f (r: any, q: any) {\n        const d = this.safeDict (r, \'k\', q);\n        return this.extend (d, {});\n    }\n')).not.toContain ('SafeDictMap');
        expect (go ('    f (r: any) {\n        const d = this.safeDict (r, \'k\', {});\n        for (let i = 0; i < 2; i++) {\n            const d = this.safeDict (r, \'j\', {});\n            this.extend (d, {});\n        }\n        return this.extend (d, {});\n    }\n')).not.toContain ('SafeDictMap');
    });
    test('a pointer-typed local stored into a typed local keeps the helper; a plain value or an accessor call writes natively; .length reads the box', () => {
        const ptr = '    f (r: any) {\n        const d = this.safeDict (r, \'k\', {});\n        const n = this.safeInteger (r, \'n\');\n        d[\'n\'] = n;\n        d[\'m\'] = 5;\n        d[\'o\'] = this.safeInteger (r, \'o\');\n        return d;\n    }\n';
        const out = go (ptr).replace ('safeInteger', '');
        expect (out).toContain ('AddElementToObject(d, "n", n)');
        expect (out).toContain ('d["m"] = 5');
        expect (out).toContain ('d["o"] = this.SafeInteger(r, "o")');
        expect (go ('    f (r: any) {\n        const d = this.safeDict (r, \'k\', {});\n        return (d as any).length;\n    }\n')).toContain ('SafeDictMap');
    });
    test('an `in` test with a nullable string key keeps the box; a string key types the local', () => {
        const nullable = '    f (r: any, s: any) {\n        const d = this.safeDict (r, \'k\', {});\n        const key = this.safeString (s, \'x\');\n        return key in d;\n    }\n';
        expect (go (nullable)).not.toContain ('SafeDictMap');
        const plain = '    f (r: any) {\n        const d = this.safeDict (r, \'k\', {});\n        return \'x\' in d;\n    }\n';
        expect (go (plain)).toContain ('var d map[string]any = ');
    });
});
