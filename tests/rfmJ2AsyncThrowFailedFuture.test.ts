import { Transpiler } from '../src/transpiler';
import fs from 'fs';
import path from 'path';

jest.mock('module', () => ({ __esModule: true, default: jest.fn() }));

// RFM-J2 leaf A: an async method whose whole body is one `throw new X(args)` returns the completed-exceptionally
// future instead of a supplier lambda that throws.
describe('java throw-only async body', () => {
    const TMP = path.join(__dirname, 'files', 'tmp-rfmj2a-failed-future');
    const VENUE = path.join(TMP, 'ts', 'src', 'fake.ts');
    const body =
        "class NotSupported extends Error {}\n" +
        "export class fake {\n" +
        "    id = 'x';\n" +
        "    async a (symbol: string, params = {}): Promise<any> {\n" +
        "        throw new NotSupported (this.id + ' a() is not supported yet');\n" +
        "    }\n" +
        "    async b (symbol: string): Promise<any> {\n" +
        "        if (symbol === 'x') {\n" +
        "            throw new NotSupported ('b');\n" +
        "        }\n" +
        "        return 1;\n" +
        "    }\n" +
        "    async c (symbol: string): Promise<any> {\n" +
        "        const y = 1;\n" +
        "        throw new NotSupported ('c' + y);\n" +
        "    }\n" +
        "    d (symbol: string): any {\n" +
        "        throw new NotSupported ('d');\n" +
        "    }\n" +
        "    async e (symbol: string): Promise<any> {\n" +
        "        const s = \"supplyAsync(() -> { throw new X(); })\";\n" +
        "        throw new NotSupported (s);\n" +
        "    }\n" +
        "}\n";
    let out: string;
    const method = (name: string): string => {
        const start = out.indexOf(' ' + name + '(');
        const next = out.indexOf('\n    public ', start + 1);
        return out.slice(start, next === -1 ? undefined : next);
    };
    beforeAll(() => {
        fs.mkdirSync(path.dirname(VENUE), { recursive: true });
        fs.writeFileSync(VENUE, body);
        const t = new Transpiler({ 'verbose': false, 'java': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
        out = t.transpileJavaByPath(VENUE).content;
    });
    afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

    test('a throw-only async body completes its future exceptionally', () => {
        const a = method('a');
        expect(a).toContain('return java.util.concurrent.CompletableFuture.failedFuture(new NotSupported(');
        expect(a).not.toContain('supplyAsync');
        expect(a).not.toContain('throw new');
    });
    test('a body with other statements keeps the supplier lambda', () => {
        expect(method('b')).toContain('supplyAsync(() -> {');
        expect(method('c')).toContain('supplyAsync(() -> {');
    });
    test('a sync method keeps its throw', () => {
        const d = method('d');
        expect(d).toContain('throw new NotSupported(');
        expect(d).not.toContain('failedFuture');
    });
    test('a message literal that looks like a supplier is not special', () => {
        const e = method('e');
        expect(e).toContain('supplyAsync(() -> {');
    });
});
