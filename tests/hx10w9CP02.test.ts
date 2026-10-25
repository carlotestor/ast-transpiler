import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config: any = { 'verbose': false, 'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } } };

const transpile = (ts: string): string => new Transpiler(config).transpileCSharp(ts).content;

describe('hx10w9 CP02: `add` on a proven non-null string operand', () => {
    test('a local held a non-null string keeps its type across self-concat writes', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    build (underlying, targetPrice) {\n" +
            "        let bs = underlying.toUpperCase();\n" +
            "        if (targetPrice) {\n" +
            "            bs = bs + '_ABOVE_' + targetPrice;\n" +
            "        }\n" +
            "        return bs + ':';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string bs = ((string)underlying).ToUpper();');
        expect(output).toContain('bs = ((bs + "_ABOVE_") + targetPrice);');
        expect(output).toContain('return (bs + ":");');
        expect(output).not.toContain('add(bs');
    });

    test('`+=` on that local prints the native concat too', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    build (expiry) {\n" +
            "        let tag = 'x';\n" +
            "        tag += '_' + expiry;\n" +
            "        return tag;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string tag = "x";');
        expect(output).toContain('tag = (tag + (("_" + expiry)));');
        expect(output).not.toContain('add(tag');
    });

    test('a nullable string local stays object and keeps the helper', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    safeString(a, b) { return a; }\n" +
            "    build (item, other) {\n" +
            "        let tag = this.safeString(item, 'tag');\n" +
            "        tag = tag + '_x';\n" +
            "        return tag + other;\n" +
            "    }\n" +
            "}");
        expect(output).toContain("object tag = this.safeString(item, \"tag\");");
        expect(output).toContain('tag = add(tag, "_x");');
        expect(output).toContain("return add(tag, other);");
    });

    test('a local written from an unproven operand stays object', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    build (value, other) {\n" +
            "        let tag = 'x';\n" +
            "        tag = value;\n" +
            "        return tag + other;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('object tag = "x";');
        expect(output).toContain('add(tag, other)');
    });

    test('a literal and a string-returning call are non-null string operands on either side', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    json(a) { return a; }\n" +
            "    build (item, count) {\n" +
            "        return 'id:' + count + this.json(item) + '!';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('return ((("id:" + count) + this.json(item)) + "!");');
        expect(output).not.toContain('add(');
    });

    test('a conditional whose arms are both non-null strings is one too', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    build (flag, value) {\n" +
            "        let label = flag ? 'YES' : 'NO';\n" +
            "        label += value;\n" +
            "        return label;\n" +
            "    }\n" +
            "}");
        expect(output).toContain('string label = isTrue(flag) ? "YES" : "NO";');
        expect(output).toContain('label = (label + (value));');
    });

    test('an unproven left keeps the helper even with a string right', () => {
        const output = transpile(
            "class Exchange {\n" +
            "    build (a, b) {\n" +
            "        return a + b + 'suffix';\n" +
            "    }\n" +
            "}");
        expect(output).toContain('add(add(a, b), "suffix")');
    });
});
