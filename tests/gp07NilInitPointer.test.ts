import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    const config = { 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
    transpiler = new Transpiler(config);
});

function go(ts: string): string {
    return transpiler.transpileGo(ts).content;
}

const PRELUDE = 'type Dict = { [key: string]: any };\n' +
    'type Str = string | undefined;\n' +
    'type Int = number | undefined;\n' +
    'type Bool = boolean | undefined;\n' +
    'class Base {}\n';

describe('hx10w8 GP07 nil-initialised locals', () => {
    test('a Str local the body only writes one accessor into holds that pointer', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeString (d: any, k: any): string { return \'\'; }\n' +
            '    main (m: any): any {\n' +
            '        let currentType: Str = undefined;\n' +
            '        currentType = this.safeString (m, \'type\');\n' +
            '        if (currentType === undefined) { return \'a\'; }\n' +
            '        if (currentType !== \'spot\') { return \'b\'; }\n' +
            '        return \'d\';\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var currentType *string = nil');
        expect(out).toContain('if currentType == nil {');
        expect(out).not.toContain('IsEqual(currentType');
    });

    test('an Int local the body only writes one accessor into holds that pointer', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeInteger (d: any, k: any): number { return 0; }\n' +
            '    main (m: any): any {\n' +
            '        let limit: Int = undefined;\n' +
            '        limit = this.safeInteger (m, \'limit\');\n' +
            '        if (limit === undefined) { return 0; }\n' +
            '        if (limit > 10) { return 1; }\n' +
            '        return 2;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var limit *int64 = nil');
        expect(out).toContain('if limit == nil {');
        expect(out).not.toContain('IsEqual(limit');
    });

    test('a literal write keeps the box (a pointer literal would need a wrapping call)', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeString (d: any, k: any): string { return \'\'; }\n' +
            '    main (m: any): any {\n' +
            '        let type: Str = undefined;\n' +
            '        if (m[\'a\'] === 1) { type = \'spot\'; } else { type = this.safeString (m, \'type\'); }\n' +
            '        if (type === undefined) { return \'none\'; }\n' +
            '        return \'some\';\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var typeVar any = nil');
        expect(out).not.toContain('SafeStringPtr("spot")');
    });

    test('a helper-call argument keeps the pointer (every runtime accessor derefs)', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeInteger (d: any, k: any): number { return 0; }\n' +
            '    iso8601 (t: any): string { return \'\'; }\n' +
            '    main (m: any): any {\n' +
            '        let ts: Int = undefined;\n' +
            '        ts = this.safeInteger (m, \'ts\');\n' +
            '        if (ts === undefined) { return undefined; }\n' +
            '        return this.iso8601 (ts);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var ts *int64 = nil');
        expect(out).toContain('if ts == nil {');
    });

    test('a read as a value keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeString (d: any, k: any): string { return \'\'; }\n' +
            '    sink (x: string): any { return x; }\n' +
            '    main (m: any): any {\n' +
            '        let currentType: Str = undefined;\n' +
            '        currentType = this.safeString (m, \'type\');\n' +
            '        if (currentType === undefined) { return undefined; }\n' +
            '        return this.sink (currentType);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var currentType any = nil');
        expect(out).toContain('IsEqual(currentType, nil)');
    });

    test('a returned local keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeString (d: any, k: any): string { return \'\'; }\n' +
            '    main (m: any): any {\n' +
            '        let currentType: Str = undefined;\n' +
            '        currentType = this.safeString (m, \'type\');\n' +
            '        return currentType;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var currentType any = nil');
    });

    test('two written types keep the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    safeString (d: any, k: any): string { return \'\'; }\n' +
            '    main (m: any): any {\n' +
            '        let v: Str = undefined;\n' +
            '        if (m[\'a\'] === 1) { v = this.safeString (m, \'x\'); } else { v = 5; }\n' +
            '        return v === undefined;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var v any = nil');
        expect(out).toContain('IsEqual(v, nil)');
    });

    test('a local never written keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (m: any): any {\n' +
            '        let v: Str = undefined;\n' +
            '        if (v === undefined) { return 1; }\n' +
            '        return 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('var v any = nil');
    });
});
