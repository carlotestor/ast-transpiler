import fs from 'fs';
import os from 'os';
import path from 'path';
import { Transpiler } from '../src/transpiler';

// hx10w11 GP38: `GetIndexOf` prints `strings.Index` on receivers whose Go type is already a
// string — a nil-proven `*string` deref and a `[]string` element needle included — in the two
// generated base files too, now that GP24 keeps their `import "strings"` alive. The inline
// nil-guard blob stays out of those files.

const config = () => ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });

const PRELUDE =
    'type Dict = { [key: string]: any };\n' +
    'type Int = number | undefined;\n' +
    'class Exchange {\n' +
    '    take (x: any): any { return x; }\n' +
    '    safeString (o: Dict, k: string, d: any = undefined): any { return undefined; }\n' +
    '    numberToString (x: any): string { return ""; }\n' +
    '}\n';

function go (body: string): string {
    return new Transpiler(config()).transpileGo(PRELUDE + 'class ex extends Exchange {\n' + body + '}\n').content;
}

function goByPath (fileName: string, body: string, seam?: RegExp): string {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hx10w11-GP38-'));
    try {
        const src = path.join(tmp, 'ts', 'src', 'base');
        fs.mkdirSync(src, { 'recursive': true });
        const file = path.join(src, fileName);
        fs.writeFileSync(file, PRELUDE.replace('class Exchange {', 'export class Exchange {') + 'export class ex extends Exchange {\n' + body + '}\n');
        const transpiler = new Transpiler(config());
        if (seam !== undefined) {
            transpiler.goTranspiler.goBaseFileStdlibImportSeamPaths = seam;
        }
        return transpiler.transpileGoByPath(file).content;
    } finally {
        fs.rmSync(tmp, { 'recursive': true, 'force': true });
    }
}

const EXCHANGE_SEAM = /base\/Exchange\.ts$/;

describe('hx10w11 GP38 GetIndexOf native arms', () => {
    // the defaulted SafeString result is a non-nil *string: the helper's nil -> -1 branch
    // is unreachable, so the pointee reads without a guard and without an inline blob
    test('a defaulted *string receiver derefs to strings.Index in a base file', () => {
        const out = goByPath('Exchange.ts',
            '    test (event: Dict): boolean {\n' +
            '        const title = this.safeString (event, "title", "");\n' +
            '        return title.indexOf ("-") >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('var title *string = this.SafeString(event, "title", "")');
        expect(out).toContain('strings.Index(*title, "-")');
        expect(out).toContain('import "strings"');
        expect(out).not.toContain('GetIndexOf(');
        expect(out).not.toContain('func() int {');
    });

    test('the same arm fires in a venue file without the seam', () => {
        const out = go(
            '    run (event: Dict): boolean {\n' +
            '        const title = this.safeString (event, "title", "");\n' +
            '        const q = "usdt";\n' +
            '        return title.indexOf (q) >= 0;\n' +
            '    }\n');
        expect(out).toContain('var q string = "usdt"');
        expect(out).toContain('strings.Index(*title, q)');
    });

    // a `[]string` element needle is left to the string-helper pass: the printer emits the
    // read as a `GetValue` box, whose nil-for-absent branch the subscript does not reproduce
    test('a GetValue-boxed element needle keeps the helper', () => {
        const out = goByPath('Exchange.ts',
            '    test (word: string): boolean {\n' +
            '        const letters = "abc";\n' +
            '        const chars = Object.keys (word);\n' +
            '        for (let ci = 0; ci < chars.length; ci++) {\n' +
            '            if (letters.indexOf (chars[ci]) >= 0) { return true; }\n' +
            '        }\n' +
            '        return false;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('var chars []string = ObjectKeys(word)');
        expect(out).toContain('GetIndexOf(letters, GetValue(chars, ci))');
        expect(out).not.toContain('strings.Index(letters');
    });

    // a checker-narrowed `string` does not prove the Go pointer: the port's NumberToString
    // answers nil for an input with no string form, so the base file keeps the helper
    test('a *string local whose Go producer can return nil keeps the helper in a base file', () => {
        const out = goByPath('Exchange.ts',
            '    test (number: any): boolean {\n' +
            '        const stringVersion = this.numberToString (number);\n' +
            '        return stringVersion.indexOf (".") >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('GetIndexOf(stringVersion, ".")');
        expect(out).not.toContain('strings.Index(*stringVersion');
    });

    // no non-nil proof: the helper's nil -> -1 branch is reachable and the inline blob is
    // not allowed in a base file
    test('an unproven *string receiver in a base file keeps the helper', () => {
        const out = goByPath('Exchange.ts',
            '    test (event: Dict): boolean {\n' +
            '        const title = this.safeString (event, "title");\n' +
            '        return title.indexOf ("-") >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('GetIndexOf(title, "-")');
        expect(out).not.toContain('func() int {');
        expect(out).not.toContain('strings.Index(*title');
    });

    // the same unproven receiver keeps the nil-guarded literal where the file owns its imports
    test('an unproven *string receiver in a venue file keeps the nil-guarded literal', () => {
        const out = go(
            '    run (event: Dict): boolean {\n' +
            '        const title = this.safeString (event, "title");\n' +
            '        return title.indexOf ("-") >= 0;\n' +
            '    }\n').replace(/\s+/g, ' ');
        expect(out).toContain('func() int { if title == nil { return -1 } return strings.Index(*title, "-") }()');
        expect(out).not.toContain('GetIndexOf(');
    });

    // a sliced writer's source is outside the seam: no import to declare, helper kept
    test('a source outside the seam paths keeps the helper', () => {
        const out = goByPath('test.cache.ts',
            '    test (event: Dict): boolean {\n' +
            '        const title = this.safeString (event, "title", "");\n' +
            '        return title.indexOf ("-") >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('GetIndexOf(title, "-")');
        expect(out).not.toContain('strings.Index(*title');
    });

    // an `any` box on either side keeps the helper (no new proof)
    test('an any needle keeps the helper', () => {
        const out = goByPath('Exchange.ts',
            '    test (event: Dict, q: any): boolean {\n' +
            '        const title = this.safeString (event, "title", "");\n' +
            '        return title.indexOf (q) >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('GetIndexOf(title, q)');
    });

    // a plain string receiver in a base file now prints the native op directly
    test('a declared string receiver prints strings.Index in a base file', () => {
        const out = goByPath('Exchange.ts',
            '    test (): boolean {\n' +
            '        const symbol = "BTC/USDT";\n' +
            '        return symbol.indexOf ("/") >= 0;\n' +
            '    }\n', EXCHANGE_SEAM);
        expect(out).toContain('strings.Index(symbol, "/")');
        expect(out).not.toContain('GetIndexOf(');
    });
});
