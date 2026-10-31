import { Transpiler } from '../src/transpiler';

// hx11 RF-go-3: rules folded from ccxt build/ post-print passes into the Go printer.
let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});
const go = (ts: string): string => transpiler.transpileGo(ts).content;
const signature = (out: string, name: string): string => out.split('\nfunc ').find((f) => f.startsWith('(this *Test) ' + name + '(')) ?? '';

describe('RF-go-3 async boolean parameter (was hx11w8-async-bool)', () => {
    const body = (call: string, use = 'if (flag) { return 1; } return 2;') => 'class Base {}\nclass Test extends Base {\n'
        + '    async load (flag: boolean): Promise<any> { ' + use + ' }\n'
        + '    async main (): Promise<any> { ' + call + ' }\n}\n';
    test('every call site passes a bool literal: the parameter prints bool', () => {
        const out = go(body('await this.load (true); return await this.load (false);'));
        expect(signature(out, 'Load')).toContain('(flag bool)');
    });
    test('a call site passing a non-literal keeps any', () => {
        const out = go(body('const x: any = 1; return await this.load (x);'));
        expect(signature(out, 'Load')).not.toContain('flag bool');
    });
    test('a body that nil-tests the parameter keeps any', () => {
        const out = go(body('return await this.load (true);', 'if (flag === undefined) { return 1; } return 2;'));
        expect(signature(out, 'Load')).not.toContain('flag bool');
    });
});

const OPTIONS = 'type Dict = { [key: string]: any };\nclass Base { options: Dict = {}; safeString (d: Dict, k: string): string | undefined { return undefined; } safeDict (d: Dict, k: string): Dict { return {}; } }\n';
describe('RF-go-3 Options is a plain map[string]any field (was hx10w2-G09)', () => {
    const run = (stmts: string, params = '') => go(OPTIONS + 'class Test extends Base {\n    f (' + params + '): any { ' + stmts + ' }\n}\n');
    test('literal-key store and read are native', () => {
        const out = run("this.options['k'] = 1; return this.options['k'];");
        expect(out).toContain('this.Options["k"] = 1');
        expect(out).not.toContain('AddElementToObject(this.Options');
        expect(out).not.toContain('Options.Store');
    });
    test('string-typed key is native, any key keeps the helper', () => {
        const typed = run("const k: string = 'a'; this.options[k] = 1;");
        expect(typed).toContain('this.Options[k] = 1');
        const boxed = run("this.options[k] = 1;", 'k: any');
        expect(boxed).toContain('AddElementToObject(this.Options, k, 1)');
    });
    test('a safeString (typed pointer) value is stored through DerefScalar', () => {
        const out = run("this.options['k'] = this.safeString ({}, 'a');");
        expect(out).toMatch(/this\.Options\["k"\] = DerefScalar\(this\.SafeString\(/);
    });
    test('a pointer value stored into another map field is not wrapped (only the plain-valued Options field is)', () => {
        const out = go(OPTIONS + "class Test extends Base {\n    features: Dict = {};\n    f (): any { this.features['k'] = this.safeString ({}, 'a'); return 1; }\n}\n");
        expect(out).toMatch(/this\.Features\["k"\] = this\.SafeString\(/);
        expect(out).not.toContain('DerefScalar(this.SafeString');
    });
});
