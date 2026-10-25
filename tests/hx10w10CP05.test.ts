import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config: any = { 'verbose': false, 'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } } };

const transpile = (ts: string): string => new Transpiler(config).transpileCSharp(ts).content;

describe('hx10w10 CP05: C# nullable scalar locals', () => {
    test('safeNumber / safeNumber2 name the base signature `double?`', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeNumber(o, k, d?) { return o; }\n" +
            "    safeNumber2(o, k1, k2, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let cost = this.safeNumber(item, 'cost');\n" +
            "        return cost;\n" +
            "    }\n" +
            "    other (item) {\n" +
            "        let rate = this.safeNumber2(item, 'a', 'b');\n" +
            "        return rate;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('double? cost = this.safeNumber(item, "cost");');
        expect(output).toContain('double? rate = this.safeNumber2(item, "a", "b");');
    });

    test('a later write of the non-null twin keeps the nullable scalar type', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let tag = this.safeString(item, 'tag');\n" +
            "        if (tag === undefined) {\n" +
            "            tag = 'default';\n" +
            "        }\n" +
            "        return tag;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string? tag = this.safeString(item, "tag");');
        expect(output).toContain('tag = "default";');
    });

    test('a null write and a widened numeric literal keep the nullable scalar type', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeInteger(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let n = this.safeInteger(item, 'n');\n" +
            "        n = null;\n" +
            "        n = 0;\n" +
            "        return n;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('Int64? n = this.safeInteger(item, "n");');
        expect(output).toContain('n = null;');
        expect(output).toContain('n = 0;');
    });

    test('a copy from a local the printer already declares that type is a keep', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let first = this.safeString(item, 'a');\n" +
            "        let second = this.safeString(item, 'b');\n" +
            "        second = first;\n" +
            "        return second;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string? first = this.safeString(item, "a");');
        expect(output).toContain('string? second = this.safeString(item, "b");');
        expect(output).toContain('second = first;');
    });

    test('a write of an unproven box still blocks the declaration', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    safeValue(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let tag = this.safeString(item, 'tag');\n" +
            "        tag = this.safeValue(item, 'other');\n" +
            "        return tag;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('object tag = this.safeString(item, "tag");');
    });

    test('a null-guarded `+` left read of a string? local folds to native concatenation', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let apiUrl = this.safeString(item, 'url');\n" +
            "        if (apiUrl === undefined) {\n" +
            "            throw new ExchangeError('no url');\n" +
            "        }\n" +
            "        return apiUrl + '/ticker';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string? apiUrl = this.safeString(item, "url");');
        expect(output).toContain('return (apiUrl + "/ticker");');
        expect(output).not.toContain('add(apiUrl');
    });

    test('the same read inside a `x !== undefined && …` conjunction folds too', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item, flag) {\n" +
            "        let host = this.safeString(item, 'host');\n" +
            "        if (host !== undefined && flag) {\n" +
            "            return host + '/x';\n" +
            "        }\n" +
            "        return undefined;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string? host = this.safeString(item, "host");');
        expect(output).toContain('return (host + "/x");');
    });

    test('a ternary arm guarded by a null test folds too', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let baseId = this.safeString(item, 'baseId');\n" +
            "        return baseId === undefined ? undefined : baseId + 'SUSDT';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string? baseId = this.safeString(item, "baseId");');
        expect(output).toContain('(baseId + "SUSDT")');
    });

    test('an unguarded `+` left read stays object', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let part = this.safeString(item, 'part');\n" +
            "        return part + '/';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('object part = this.safeString(item, "part");');
        expect(output).toContain('add(part, "/")');
    });

    test('a guarded read whose right operand is not a printed string stays object', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(o, k, d?) { return o; }\n" +
            "    run (item, rest) {\n" +
            "        let head = this.safeString(item, 'head');\n" +
            "        if (head === null) {\n" +
            "            return undefined;\n" +
            "        }\n" +
            "        return head + rest;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('object head = this.safeString(item, "head");');
        expect(output).toContain('add(head, rest)');
    });

    test('a null write never claims a non-null string declaration (the ccxt layer promotes it)', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    run (value) {\n" +
            "        let side = 'long';\n" +
            "        if (value) {\n" +
            "            side = 'short';\n" +
            "        }\n" +
            "        side = undefined;\n" +
            "        return side;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('object side = "long";');
        expect(output).toContain('side = null;');
    });

    test('a guarded numeric local stays a nullable scalar (no concat)', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeInteger(o, k, d?) { return o; }\n" +
            "    run (item) {\n" +
            "        let n = this.safeInteger(item, 'n');\n" +
            "        if (n === undefined) {\n" +
            "            return 0;\n" +
            "        }\n" +
            "        return n;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('Int64? n = this.safeInteger(item, "n");');
    });
});
