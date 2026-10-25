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
    'class Base {\n' +
    '    safeDict (o: any, k: any, d?: any): any { return undefined; }\n' +
    '    safeString (o: any, k: any): Str { return undefined; }\n' +
    '}\n';

const body = (src: string): string => go(PRELUDE + 'class Test extends Base {\n' + src + '\n}\n');

describe('hx10 w11 GP35 safeDict-with-default locals', () => {
    test('a map default types the local and the store prints natively', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        x[\'a\'] = \'v\';\n' +
            '        return x;\n' +
            '    }');
        expect(out).toContain('var x map[string]any = this.SafeDictMap(p, "k", map[string]any{})');
        expect(out).toContain('x["a"] = "v"');
        expect(out).not.toContain('AddElementToObject(x,');
    });

    test('a non-empty default is carried into the typed reader', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', { \'a\': 1 });\n' +
            '        return x;\n' +
            '    }');
        expect(out).toContain('var x map[string]any = this.SafeDictMap(p, "k", map[string]any{');
        expect(out).toContain('"a": 1');
    });

    test('a store of a nullable local keeps the boxed local', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        const s: Str = this.safeString (p, \'s\');\n' +
            '        x[\'a\'] = s;\n' +
            '        return x;\n' +
            '    }');
        expect(out).toContain('var x any = this.SafeDict(');
        expect(out).toContain('AddElementToObject(x, "a", s)');
    });

    test('an assertion re-boxes the local', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        return (x as Dict)[\'a\'];\n' +
            '    }');
        expect(out).toContain('var x any = this.SafeDict(');
    });

    test('a nil test and a read still type the local', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        if (x === undefined) { return undefined; }\n' +
            '        return x[\'a\'];\n' +
            '    }');
        expect(out).toContain('var x map[string]any');
        expect(out).toContain('if x == nil {');
    });

    test('a two-argument accessor keeps its old path', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\');\n' +
            '        return x[\'a\'];\n' +
            '    }');
        expect(out).toContain('var x map[string]any = SafeMapTyped(p, "k")');
    });

    test('the local handed to another container keeps the type', () => {
        const out = body('    f (p: any, o: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        o[\'a\'] = x;\n' +
            '        return o;\n' +
            '    }');
        expect(out).toContain('var x map[string]any');
    });

    test('a rebinding write re-boxes the local', () => {
        const out = body('    f (p: any, q: any): any {\n' +
            '        let x = this.safeDict (p, \'k\', {});\n' +
            '        x = q;\n' +
            '        return x;\n' +
            '    }');
        expect(out).toContain('var x any = this.SafeDict(');
    });

    test('a local that backs an `in` read keeps the box', () => {
        const out = body('    f (p: any): any {\n' +
            '        const x = this.safeDict (p, \'k\', {});\n' +
            '        if (\'a\' in x) { return x; }\n' +
            '        return undefined;\n' +
            '    }');
        expect(out).toContain('var x any = this.SafeDict(');
        expect(out).not.toContain('func() bool {');
    });
});
