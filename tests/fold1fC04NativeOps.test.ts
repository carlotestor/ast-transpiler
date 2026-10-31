import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

const config: any = { 'verbose': false, 'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'INFER_ARG_TYPE': true, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } } };

const print = (source: string, install: (printer: any) => void = () => undefined): string => {
    const transpiler: any = new Transpiler(config);
    install(transpiler.csharpTranspiler);
    return transpiler.transpileCSharp(source).content;
};

const clientSource =
    "class Client {\n" +
    "    subscriptions: Dictionary<any>;\n" +
    "    rejections: Dictionary<any>;\n" +
    "}\n" +
    "class Exchange {\n" +
    "    f (client: Client, hash: string, other: any, n: number) {\n" +
    "        if (hash in client.rejections) { return 1; }\n" +
    "        if ('ping' in client.subscriptions) { return 2; }\n" +
    "        if (other in client.subscriptions) { return 3; }\n" +
    "        if (n in client.subscriptions) { return 4; }\n" +
    "    }\n" +
    "    g (client: Client, hash: string) {\n" +
    "        const other = this.safeValue (client, 'x');\n" +
    "        if (hash in other.rejections) { return 1; }\n" +
    "    }\n" +
    "}";

const declareClientTables = (printer: any) => {
    printer.csharpDeclaredDictMember = (node: any) => ((node.name.text === 'subscriptions') || (node.name.text === 'rejections')) ? {} : undefined;
};

describe('hx11 fold 1F C04: native ops proved by types', () => {
    test('isTrue around a bool-annotated base method call is dropped', () => {
        const out = print(
            "class T {\n" +
            "    isDictionary (value: any): boolean { return true; }\n" +
            "    f (v: any) {\n" +
            "        if (this.isDictionary (v)) { return 1; }\n" +
            "    }\n" +
            "}");
        expect(out).toContain('if (this.isDictionary(v))');
        expect(out).not.toContain('isTrue(this.isDictionary');
    });

    test('a modulo of an Int64 local by a positive literal prints the cast-back remainder', () => {
        const source =
            "class T {\n" +
            "    f (params: any) {\n" +
            "        const msInt = this.safeInteger (params, 'ms');\n" +
            "        if (msInt % 1000 === 0) { return 1; }\n" +
            "        if (msInt % 0 === 0) { return 2; }\n" +
            "    }\n" +
            "}";
        const out = print(source, (printer) => {
            printer.csharpExpressionTypeResolver = (node: any) => (node?.text === 'msInt' ? 'Int64?' : undefined);
        });
        expect(out).toContain('(((Int64?)((double?)msInt % 1000)) == 0)');
        expect(out).toContain('isEqual(mod(msInt, 0), 0)');
    });

    test('without the type proof the modulo keeps the helper', () => {
        const out = print(
            "class T {\n" +
            "    f (params: any) {\n" +
            "        const msInt = this.safeInteger (params, 'ms');\n" +
            "        if (msInt % 1000 === 0) { return 1; }\n" +
            "    }\n" +
            "}");
        expect(out).toContain('isEqual(mod(msInt, 1000), 0)');
    });

    test('`in` on a declared table of a client parameter prints ContainsKey behind the receiver and key tests', () => {
        const out = print(clientSource, declareClientTables);
        expect(out).toContain('(client.rejections != null && hash != null && client.rejections.ContainsKey(hash))');
        expect(out).toContain('(client.subscriptions != null && client.subscriptions.ContainsKey("ping"))');
        // a key that is not provably a string keeps the helper
        expect(out).toContain('inOp(client.subscriptions, other)');
        expect(out).toContain('inOp(client.subscriptions, n)');
        // a receiver the printer does not type as the class keeps the helper
        expect(out).toContain('inOp(other.rejections, hash)');
    });

    test('with no declared table the helper stays', () => {
        const out = print(clientSource);
        expect(out).toContain('inOp(client.rejections, hash)');
        expect(out).not.toContain('ContainsKey');
    });
});
