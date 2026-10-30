import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({ __esModule: true, default: jest.fn() }));

const transpiler = new Transpiler({ verbose: false, rust: { parser: { NUM_LINES_END_FILE: 0 } } });
const rust = (ts: string) => transpiler.transpileRust(ts).content;

describe('rust string replace locals print a native String', () => {
    const cls = (body: string) => `class A extends Exchange { f(params: Dict, key: string): any { ${body} } }`;
    test('replace local boxed at an object-literal move', () => {
        const out = rust(cls("const id: string = key.replace ('_', ''); return { 'id': id };"));
        expect(out).toContain('let mut id: String = key.as_str().map(|__s| __s.replace("_", "")).unwrap_or_default();');
        expect(out).toContain('Value::from(id)');
    });
    test('another use keeps the Value box', () => {
        const out = rust(cls("const id: string = key.replace ('_', ''); if (id === 'a') { return 1; } return id;"));
        expect(out).not.toContain('let mut id: String');
    });
});
