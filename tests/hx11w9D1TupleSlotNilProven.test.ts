import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const go = (body: string) => transpiler.transpileGo(
    'class B {\n}\nclass E extends B {\n    take(s: string): string { return s; }\n    tup(): [string, string | undefined, object] { return [ "a", undefined, {} ]; }\n    m() {\n' + body + '\n    }\n}').content;

describe('go destructured tuple slot passed to a string parameter', () => {
    test('a string slot derefs at the call and types the parameter', () => {
        const out = go('const [ type, sub, p ] = this.tup(); this.take(type);');
        expect(out).toContain('this.Take(*typeVar)');
        expect(out).toContain('Take(s string)');
    });
    test('an optional slot keeps the pointer', () => {
        const out = go('const [ type, sub, p ] = this.tup(); this.take(sub);');
        expect(out).not.toContain('this.Take(*sub)');
    });
});
