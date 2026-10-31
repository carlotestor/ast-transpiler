import * as nodefs from 'fs';
import * as nodepath from 'path';
import { Transpiler, installCcxtGoHooks } from '../src/transpiler';

// hx11 X2 GO-B: slot 0 of `const [ x, params ] = this.handleOptionIntegerAndParams (…)` on the Nullable
// overload is the *int64 CheckOptionInteger returns (nil when absent). The destructured local takes
// `*int64` (extracted with a native assertion) when every use reads it natively; the checker names the
// slot type, no name list. Replaces build/hx11w8-int64-tuple-local.ts (a post-print text rewrite).

const BASE =
    'export type Dict = { [key: string]: any };\n' +
    'export type Int = number | undefined;\n' +
    'export class Exchange {\n' +
    '    safeInteger (o: any, k: string): Int { return undefined; }\n' +
    '    parseToInt (x: any): number { return 0; }\n' +
    '    handleOptionIntegerAndParams (params: Dict, m: string, o: string, d: number): [number, Dict];\n' +
    '    handleOptionIntegerAndParams (params: Dict, m: string, o: string, d?: Int): [Int, Dict];\n' +
    '    handleOptionIntegerAndParams (params: Dict, m: string, o: string, d: Int = undefined): [Int, Dict] {\n' +
    '        return [ d, params ];\n' +
    '    }\n' +
    '}\n';

const treeName = 'tmp-x2-int64-tuple';

function go (body: string, install = true, extra = ''): string {
    const src = nodepath.join(__dirname, 'files', treeName, 'ts', 'src');
    nodefs.mkdirSync(nodepath.join(src, 'base'), { recursive: true });
    nodefs.writeFileSync(nodepath.join(src, 'base', 'Exchange.ts'), BASE);
    nodefs.writeFileSync(nodepath.join(src, 'ex.ts'),
        "import { Exchange, Dict, Int } from './base/Exchange';\n" +
        'export class ex extends Exchange {\n' +
        extra +
        '    run (params: Dict = {}): any {\n' +
        '        const request: Dict = {};\n' +
        body +
        '        return request;\n' +
        '    }\n' +
        '}\n');
    const t = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (install) {
        installCcxtGoHooks(t.goTranspiler);
    }
    return t.transpileGoByPath(nodepath.join(src, 'ex.ts')).content;
}

const HEAD = "        const [ until, paramsUntil ] = this.handleOptionIntegerAndParams (params, 'run', 'until');\n";

describe('hx11 X2: *int64 tuple slot local (handleOptionIntegerAndParams Nullable)', () => {
    afterAll(() => {
        nodefs.rmSync(nodepath.join(__dirname, 'files', treeName), { recursive: true, force: true });
    });

    test('a slot read by nil tests and a parseToInt division is a typed pointer local', () => {
        const out = go(HEAD +
            '        if (until !== undefined) {\n' +
            "            request['end'] = this.parseToInt (until / 1000);\n" +
            '        }\n' +
            '        if (until === undefined) {\n' +
            "            request['none'] = true;\n" +
            '        }\n');
        expect(out).toContain('var until *int64 = nil');
        expect(out).toContain('if p, ok := untilparamsUntilVariable[0].(*int64); ok {');
        expect(out).toContain('if until != nil {');
        expect(out).toContain('float64(*until) / 1000');
        expect(out).toContain('if until == nil {');
        expect(out).not.toContain('IsEqual(until');
        expect(out).not.toContain('GetValue(untilparamsUntilVariable, 0)');
    });

    test('an ordered comparison against another pointer reads the typed local', () => {
        const out = go(HEAD +
            "        const ts = this.safeInteger (params, 'ts');\n" +
            '        if ((ts === undefined) || (until === undefined) || (ts <= until)) {\n' +
            "            request['ok'] = true;\n" +
            '        }\n');
        expect(out).toContain('var until *int64 = nil');
        expect(out).not.toContain('until.(*int64)');
    });

    test('without the ccxt hooks the call prints the value twin and the slot stays boxed', () => {
        const out = go(HEAD + '        if (until !== undefined) {\n            request[\'a\'] = 1;\n        }\n', false);
        expect(out).toContain('until := GetValue(untilparamsUntilVariable, 0)');
        expect(out).not.toContain('var until *int64 = nil');
    });

    test('a slot stored into a map keeps the box (the store derefs a nil pointer through the helper)', () => {
        const out = go(HEAD + "        request['endTime'] = until;\n");
        expect(out).toContain('until := GetValue(untilparamsUntilVariable, 0)');
        expect(out).not.toContain('var until *int64 = nil');
    });

    test('a slot that is written later keeps the box', () => {
        const out = go(HEAD + '        let u = until;\n        u = undefined;\n        if (until !== undefined) {\n            request[\'a\'] = u;\n        }\n');
        expect(out).not.toContain('var until *int64 = nil');
    });

    test('a slot used in arithmetic keeps the box', () => {
        const out = go(HEAD + "        request['d'] = until - 5;\n");
        expect(out).not.toContain('var until *int64 = nil');
    });

    test('an integer-literal default selects the value twin and is not retyped', () => {
        const out = go(
            "        const [ until, paramsUntil ] = this.handleOptionIntegerAndParams (params, 'run', 'until', 5);\n" +
            "        request['a'] = this.parseToInt (until / 1000);\n");
        expect(out).not.toContain('var until *int64 = nil');
        expect(out).not.toContain('untilparamsUntilVariable[0].(*int64)');
    });

    test('a method with the same name outside base/Exchange.ts keeps the box', () => {
        const out = go(HEAD + '        if (until !== undefined) {\n            request[\'a\'] = 1;\n        }\n', true,
            '    handleOptionIntegerAndParams (params: Dict, m: string, o: string, d?: Int): [Int, Dict] { return [ d, params ]; }\n');
        expect(out).not.toContain('var until *int64 = nil');
    });
});
