import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const go = (body: string) => transpiler.transpileGo(
    'class B {\n    safeString(a, b, c?): string | undefined { return a; }\n}\nclass E extends B {\n    take(s: string): string { return s; }\n    m(x: string | undefined) {\n' + body + '\n    }\n}').content;

describe('go *string local passed to a string parameter', () => {
    test('a checker-narrowed local derefs at the call', () => {
        const out = go("const k = this.safeString({}, 'k'); if (k !== undefined) { this.take(k); }");
        expect(out).toContain('this.Take(*k)');
    });
    test('an unnarrowed local keeps the pointer', () => {
        const out = go("const k = this.safeString({}, 'k'); this.take(k);");
        expect(out).not.toContain('this.Take(*k)');
    });
});
