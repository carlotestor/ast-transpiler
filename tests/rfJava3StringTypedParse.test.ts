import { Transpiler } from '../src/transpiler';
import fs from 'fs';
import path from 'path';

jest.mock('module', () => ({ __esModule: true, default: jest.fn() }));

// RF-java-3: parseInt/parseFloat on an operand that prints as java.lang.String call the String-typed twin.
describe('java string-typed parse', () => {
    const TMP = path.join(__dirname, 'files', 'tmp-rfjava3-parse');
    const VENUE = path.join(TMP, 'ts', 'src', 'fake.ts');
    const body =
        "export class fake {\n" +
        "    a (p: any): any { return parseInt (p as string); }\n" +
        "    b (p: any): any { return parseFloat (p); }\n" +
        "    c (p: any): any { const s = 'x'; return parseFloat (s as string); }\n" +
        "}\n";
    let out: string;
    beforeAll(() => {
        fs.mkdirSync(path.dirname(VENUE), { recursive: true });
        fs.writeFileSync(VENUE, body);
        const t = new Transpiler({ 'verbose': false, 'java': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
        out = t.transpileJavaByPath(VENUE).content;
    });
    afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

    test('a string-cast operand calls the typed twin', () => {
        expect(out).toContain('io.github.ccxt.base.JsParse.parseInt(');
        expect(out).toContain('io.github.ccxt.base.JsParse.parseFloat(');
    });
    test('an any operand keeps the helper', () => {
        expect(out).toContain('Helpers.parseFloat(p)');
    });
});
