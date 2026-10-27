import { Transpiler } from '../src/transpiler';
import fs from 'fs';
import path from 'path';

jest.mock('module',()=>({
    __esModule: true,
    default: jest.fn()
}));

const CONFIG = { 'verbose': false, 'java': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };

describe('hx11 java: typed boolean parameter condition', () => {
    const transpiler = new Transpiler(CONFIG);
    const out = (src: string) => transpiler.transpileJava(src).content;

    test('a never-written boolean parameter prints the null-safe TRUE test', () => {
        const output = out("class T {\n    g(flag: boolean): void {\n        if (flag) { const x = 1; }\n    }\n}");
        expect(output).toContain('if (Boolean.TRUE.equals(flag))');
        expect(output).not.toContain('Helpers.isTrue(flag)');
    });

    test('a defaulted boolean parameter keeps its default inside the TRUE test', () => {
        const output = out("class T {\n    g(flag = false): void {\n        if (flag) { const x = 1; }\n    }\n}");
        expect(output).toContain('Boolean.TRUE.equals(java.util.Objects.requireNonNullElse(flag, false))');
    });

    test('an any parameter keeps the helper', () => {
        const output = out("class T {\n    g(raw: any): void {\n        if (raw) { const x = 1; }\n    }\n}");
        expect(output).toContain('Helpers.isTrue(raw)');
    });

    test('a boolean parameter the body writes keeps the helper', () => {
        const output = out("class T {\n    g(flag: boolean): void {\n        flag = this.h();\n        if (flag) { const x = 1; }\n    }\n    h(): any { return 1; }\n}");
        expect(output).toContain('Helpers.isTrue(flag)');
        expect(output).not.toContain('Boolean.TRUE.equals(flag)');
    });
});

describe('hx11 java: typed String slice and split', () => {
    const transpiler = new Transpiler(CONFIG);
    const out = (src: string) => transpiler.transpileJava(src).content;

    test('an open-end slice over a String prints the one-argument substring', () => {
        const output = out("class T {\n    f(a: string): void {\n        const t = a.slice(2);\n    }\n}");
        expect(output).toContain('(a == null ? null : ((String)a).substring(Math.min(2, ((String)a).length())))');
        expect(output).not.toContain('Helpers.slice(a, 2');
    });

    test('a slice with a bound the build layer declared Integer clamps natively', () => {
        const typed = new Transpiler(CONFIG);
        (typed as any).javaTranspiler.javaDeclaredLocalTypeResolver = (d) => (String(d?.name?.text) === 'n' ? 'Integer' : undefined);
        const output = typed.transpileJava("class T {\n    f(a: string, n: number): void {\n        const s = a.slice(0, n);\n    }\n}").content;
        expect(output).toContain('(a == null ? null : ((String)a).substring(0, (int) Math.min(n < 0 ? ((String)a).length() + n : n, ((String)a).length())))');
        expect(output).not.toContain('Helpers.slice(a, 0, n)');
    });

    test('an unproven Object bound keeps the helper', () => {
        const output = out("class T {\n    f(a: string, n: number): void {\n        const s = a.slice(0, n);\n    }\n}");
        expect(output).toContain('Helpers.slice(a, 0, n)');
    });

    test('a fractional bound keeps the helper', () => {
        const output = out("class T {\n    f(a: string): void {\n        const s = a.slice(1.5);\n    }\n}");
        expect(output).toContain('Helpers.slice(a, 1.5');
    });

    test('an any receiver keeps the helper', () => {
        const output = out("class T {\n    f(a: any): void {\n        const s = a.slice(2);\n    }\n}");
        expect(output).toContain('Helpers.slice(a, 2');
    });

    test('a String separator prints the native split', () => {
        const output = out("class T {\n    f(a: string, b: string): void {\n        const p = a.split(b);\n    }\n}");
        expect(output).toContain('((String)a).split(java.util.regex.Pattern.quote(b))');
        expect(output).not.toContain('Helpers.split(a, b)');
    });

    test('an any separator keeps the helper', () => {
        const output = out("class T {\n    f(a: string, b: any): void {\n        const p = a.split(b);\n    }\n}");
        expect(output).toContain('Helpers.split(a, b)');
    });
});

describe('hx11 java: String-cast members anchor a native concat', () => {
    const transpiler = new Transpiler(CONFIG);
    const out = (src: string) => transpiler.transpileJava(src).content;

    test('x + y.toLowerCase() prints a native concat', () => {
        const output = out("class T {\n    f(a: string, b: string): void {\n        const x = a + b.toLowerCase();\n    }\n}");
        expect(output).toContain('(a + ((String)b).toLowerCase())');
        expect(output).not.toContain('Helpers.add(');
    });

    test('x + y.toString() prints a native concat', () => {
        const output = out("class T {\n    f(a: string, b: number): void {\n        const x = a + b.toString();\n    }\n}");
        expect(output).toContain('(a + String.valueOf(b))');
    });

    test('a member call with arguments is not an anchor', () => {
        const output = out("class T {\n    f(a: string, b: any): void {\n        const x = a + b.toFixed(2);\n    }\n}");
        expect(output).not.toContain('(a + toFixed');
    });
});

describe('hx11 java: venue callee types', () => {
    const TMP = path.join(__dirname, 'files', 'tmp-hx11-java-describe');
    const VENUE = path.join(TMP, 'ts', 'src', 'venue.ts');
    const BASE = path.join(TMP, 'ts', 'src', 'base', 'Exchange.ts');
    let byPath: Transpiler;
    let venueOutput: string;
    let baseOutput: string;
    let calleeOutput: string;

    beforeAll(() => {
        fs.mkdirSync(path.join(TMP, 'ts', 'src', 'base'), { recursive: true });
        fs.writeFileSync(path.join(TMP, 'ts', 'src', 'base', 'types.ts'),
            "export interface Dictionary<T> {\n    [key: string]: T;\n}\nexport type Dict = Dictionary<any>;\n");
        fs.writeFileSync(BASE,
            "import type { Dict } from './types';\n" +
            "export default class Exchange {\n" +
            "    deepExtend (...args: any[]): any { return args[0]; }\n" +
            "    // METHODS BELOW THIS LINE ARE TRANSPILED FROM TYPESCRIPT\n" +
            "}\n");
        fs.writeFileSync(VENUE,
            "import type { Dict } from './base/types';\n" +
            "import Exchange from './base/Exchange';\n" +
            "export default class venue extends Exchange {\n" +
            "    mk (): Dict { return { 'a': 1 }; }\n" +
            "    use (): void { const m = this.mk (); const k = m['a']; }\n" +
            "}\n");
        byPath = new Transpiler(CONFIG);
        venueOutput = byPath.transpileJavaByPath(VENUE).content;
        baseOutput = byPath.transpileJavaByPath(BASE).content;
        // mirrors the build layer: a local whose initialiser is a whole sync venue call answers the callee type
        const printer: any = (byPath as any).javaTranspiler;
        printer.javaDeclaredLocalTypeResolver = (declaration) => declaration?.initializer === undefined
            ? undefined : printer.javaVenueCalleeType(declaration.initializer)?.type;
        calleeOutput = byPath.transpileJavaByPath(VENUE).content;
    });

    afterAll(() => {
        fs.rmSync(TMP, { recursive: true, force: true });
    });

    test('a callee whose signature prints a Map types the local initialised from it', () => {
        expect(calleeOutput).toContain('Object k = m.get("a")');
        expect(venueOutput).toContain('((java.util.Map<String, Object>)m).get("a")');
    });
});
