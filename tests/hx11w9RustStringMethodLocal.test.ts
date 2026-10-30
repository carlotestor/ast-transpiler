import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({ __esModule: true, default: jest.fn() }));

const transpiler = new Transpiler({ verbose: false, rust: { parser: { NUM_LINES_END_FILE: 0 } } });
const rust = (ts: string) => transpiler.transpileRust(ts).content;

describe('rust string-method locals print a native String', () => {
    const cls = (body: string) => `class A extends Exchange { f(params: Dict, side: string): any { ${body} } }`;
    test('capitalize local boxed only at its object-literal move', () => {
        const out = rust(cls("const low = this.safeStringLower (params, 'k', 'd'); const tif: string = this.capitalize (low); return { 'tif': tif };"));
        expect(out).toContain('let mut tif: String = self.capitalize(low');
        expect(out).toContain('Value::from(tif)');
    });
    test('toUpperCase local on a string param, boxed at a request write', () => {
        const out = rust(cls("const request: Dict = {}; const up: string = side.toUpperCase (); request['s'] = up; return request;"));
        expect(out).toContain('let mut up: String = side.as_str().map(str::to_uppercase).unwrap_or_default();');
    });
    test('another use of the local keeps the Value box', () => {
        const out = rust(cls("const up: string = side.toLowerCase (); if (up === 'a') { return 1; } return up;"));
        expect(out).not.toContain('let mut up: String');
    });
});
