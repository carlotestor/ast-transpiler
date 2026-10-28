import { Transpiler } from '../src/transpiler';
import fs from 'fs';
import path from 'path';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

// hx11 w8: crc32 checksum compares. BaseExchange.crc32 hands back a Long box on every path, so
// against a local the build layer declares Long, Objects.equals is isEqual's integral branch.
describe('java crc32 checksum equality', () => {
    const TMP = path.join(__dirname, 'files', 'tmp-hx11w8-crc32');
    const CRYPTO = path.join(TMP, 'ts', 'src', 'base', 'functions', 'crypto.ts');
    const VENUE = path.join(TMP, 'ts', 'src', 'pro', 'fake.ts');
    const OTHER = path.join(TMP, 'ts', 'src', 'pro', 'other.ts');
    const body =
        "export class fake {\n" +
        "    crc32 = crc32;\n" +
        "    safeInteger (o: any, k: any): number { return 1; }\n" +
        "    f1 (m: any): boolean {\n" +
        "        const local = this.crc32 ('a', true);\n" +
        "        const resp = this.safeInteger (m, 'k');\n" +
        "        if (local !== resp) { return true; }\n" +
        "        return resp === local;\n" +
        "    }\n" +
        "    f2 (m: any): boolean {\n" +
        "        let local = this.crc32 ('a', true);\n" +
        "        local = this.safeInteger (m, 'z');\n" +
        "        const resp = this.safeInteger (m, 'k');\n" +
        "        return local !== resp;\n" +
        "    }\n" +
        "    f3 (m: any): boolean {\n" +
        "        const local = this.safeInteger (m, 'q');\n" +
        "        const resp = this.safeInteger (m, 'k');\n" +
        "        return local !== resp;\n" +
        "    }\n" +
        "    f4 (m: any): boolean {\n" +
        "        const local = this.crc32 ('a', true);\n" +
        "        const raw: any = m['k'];\n" +
        "        return local !== raw;\n" +
        "    }\n" +
        "}\n";
    let out: string;
    let outOther: string;

    beforeAll(() => {
        fs.mkdirSync(path.dirname(CRYPTO), { recursive: true });
        fs.mkdirSync(path.dirname(VENUE), { recursive: true });
        fs.writeFileSync(CRYPTO, "export function crc32 (str: string, signed = false) { return 1; }\n");
        fs.writeFileSync(VENUE, "import { crc32 } from '../base/functions/crypto.js';\n" + body);
        // a venue-local crc32 is not the base function: it must keep the helper
        fs.writeFileSync(OTHER, body.replace('crc32 = crc32;', 'crc32 (s: string, g: boolean): number { return 2; }'));
        const byPath = new Transpiler({ 'verbose': false, 'java': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
        const printer: any = (byPath as any).javaTranspiler;
        printer.javaDeclaredLocalTypeResolver = (declaration: any) => {
            const name = declaration?.name?.text;
            return name === 'resp' ? 'Long' : undefined;
        };
        out = byPath.transpileJavaByPath(VENUE).content;
        outOther = byPath.transpileJavaByPath(OTHER).content;
    });

    afterAll(() => {
        fs.rmSync(TMP, { recursive: true, force: true });
    });

    const method = (text: string, name: string) => {
        const start = text.indexOf(' ' + name + '(');
        return text.slice(start, text.indexOf('\n    }', start));
    };

    test('a never-rewritten crc32 const against a Long local compares natively', () => {
        const f1 = method(out, 'f1');
        expect(f1).toContain('!java.util.Objects.equals(local, resp)');
        expect(f1).toContain('java.util.Objects.equals(resp, local)');
        expect(f1).not.toContain('Helpers.isEqual');
    });

    test('a rewritten crc32 local, a non-crc32 local and an Object operand keep the helper', () => {
        expect(method(out, 'f2')).toContain('Helpers.isEqual(local, resp)');
        expect(method(out, 'f3')).not.toContain('Objects.equals(local, resp)');
        expect(method(out, 'f4')).toContain('Helpers.isEqual(local, raw)');
    });

    test('a venue-declared crc32 keeps the helper', () => {
        expect(method(outOther, 'f1')).toContain('Helpers.isEqual(');
    });
});
