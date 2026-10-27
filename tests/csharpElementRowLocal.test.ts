import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config = {
    'verbose': false,
    'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } }
};

function printed(source: string, enabled: boolean): string {
    const transpiler = new Transpiler(config);
    if (enabled) {
        (transpiler as any).csharpTranspiler.csharpElementRowLocalSource = () => true;
    }
    return transpiler.transpileCSharp(source).content;
}

const HEAD = 'IDictionary<string, object> row = ((IDictionary<string, object>)getValue(list, i));';

const body = (lines: string) => 'class T {\n    f (list, i) {\n' + lines + '\n    }\n}';

describe('csharp element-row locals', () => {
    test('a row read only through string keys declares the dictionary', () => {
        const ts = body('        const row = list[i];\n        const a = row[\'a\'];\n        row[\'b\'] = 1;\n        return a;');
        expect(printed(ts, true)).toContain(HEAD);
        expect(printed(ts, false)).toContain('object row = getValue(list, i);');
    });

    test('a safe* reader and a null test count as dictionary uses', () => {
        const ts = body('        const row = list[i];\n        if (row !== undefined) {\n            return this.safeString (row, \'a\');\n        }\n        return row[\'b\'];');
        expect(printed(ts, true)).toContain(HEAD);
    });

    test('a use that is not a dictionary read keeps object', () => {
        for (const use of [ 'return row;', 'return row[0];', 'return this.foo (row);', 'return row + 1;', 'row = list[0];' ]) {
            const ts = body('        let row = list[i];\n        const a = row[\'a\'];\n        ' + use);
            expect(printed(ts, true)).not.toContain('IDictionary<string, object> row');
        }
    });

    test('a string-keyed initializer, a non-read local and the market names keep object', () => {
        expect(printed(body('        const row = list[\'k\'];\n        return row[\'a\'];'), true)).not.toContain('IDictionary<string, object> row');
        expect(printed(body('        const row = list[i];\n        return 1;'), true)).not.toContain('IDictionary<string, object> row');
        expect(printed(body('        const market = list[i];\n        return market[\'a\'];'), true)).not.toContain('IDictionary<string, object> market');
    });

    test('a second binding of the name keeps object', () => {
        const ts = body('        const row = list[i];\n        const a = row[\'a\'];\n        if (a) {\n            const row = list[0];\n            return row[\'c\'];\n        }\n        return a;');
        expect(printed(ts, true)).not.toContain('IDictionary<string, object> row');
    });

    test('the source predicate decides per file', () => {
        const transpiler = new Transpiler(config);
        (transpiler as any).csharpTranspiler.csharpElementRowLocalSource = () => false;
        const ts = body('        const row = list[i];\n        return row[\'a\'];');
        expect(transpiler.transpileCSharp(ts).content).toContain('object row = getValue(list, i);');
    });

    test('without a host hook the default source rule keeps virtual (non ts/src) files on object', () => {
        const transpiler = new Transpiler(config);
        const ts = body('        const row = list[i];\n        return row[\'a\'];');
        expect(transpiler.transpileCSharp(ts).content).toContain('object row = getValue(list, i);');
    });
});
