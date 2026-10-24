import { describe, test, expect } from '@jest/globals';
import { Transpiler } from '../src/transpiler.js';

const transpiler = new Transpiler();
const printer = () => (transpiler as any).csharpTranspiler;
// the embedding build layer (ccxt: build/csharp-local-types.js) answers csharpExpressionTypeResolver
// for the locals it prints with its own C# type: the reads are then already those types
const cs = (input: string, types: { [name: string]: string } = {}) => {
    const target = printer();
    target.csharpExpressionTypeResolver = (node) => types[node?.text];
    try {
        return transpiler.transpileCSharp(input).content;
    } finally {
        target.csharpExpressionTypeResolver = undefined;
    }
};
const DICT = 'type Dict = { [key: string]: any };\n';

describe('csharp isEqual over printed numeric arithmetic and hand-written number fields', () => {
    test('an integer modulo an integer literal prints the operator', () => {
        const output = cs(
        "class A {\n" +
        "    run (params: Dict) {\n" +
        "        const i = this.safeInteger(params, 'i');\n" +
        "        if ((i % 2) === 0) { return 1; }\n" +
        "        if ((i % 2) !== 0) { return 2; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n", { i: 'int' });
        expect(output).toContain('((Int64)i % 2L == 0)');
        expect(output).toContain('((Int64)i % 2L != 0)');
        expect(output).not.toContain('isEqual(');
    });
    test('a modulo that still prints the mod helper keeps isEqual', () => {
        const output = cs(
        "class A {\n" +
        "    run (params: Dict) {\n" +
        "        const msInt = this.safeInteger(params, 'ms');\n" +
        "        const week = this.safeInteger(params, 'w');\n" +
        "        if ((msInt % week) === 0) { return 1; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n", { msInt: 'Int64', week: 'Int64' });
        expect(output).toContain('isEqual((mod(msInt, week)), 0)');
    });
    test('a literal the integer kind cannot hold keeps the helper', () => {
        const output = cs(
        "class A {\n" +
        "    run (params: Dict) {\n" +
        "        const i = this.safeInteger(params, 'i');\n" +
        "        if ((i % 2) === 0.5) { return 1; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n", { i: 'int' });
        expect(output).toContain('isEqual(');
    });
    test('a hand-written double field against a literal prints the operator', () => {
        const output = cs(
        "class A {\n" +
        "    rateLimit: number = 2000;\n" +
        "    rollingWindowSize: number = 0;\n" +
        "    run () {\n" +
        "        if (this.rateLimit === -1) { return 1; }\n" +
        "        if (this.rollingWindowSize === 0) { return 2; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n");
        expect(output).toContain('(this.rateLimit == -1)');
        expect(output).toContain('(this.rollingWindowSize == 0)');
        expect(output).not.toContain('isEqual(');
    });
    test('an object-boxed field keeps the helper', () => {
        const output = cs(
        "class A {\n" +
        "    precisionMode: any = 2;\n" +
        "    run () {\n" +
        "        if (this.precisionMode === 2) { return 1; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n");
        expect(output).toContain('isEqual(');
    });
    test('an object-typed local keeps the helper', () => {
        const output = cs(
        "class A {\n" +
        "    run (x: any) {\n" +
        "        if ((x % 2) === 0) { return 1; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n");
        expect(output).toContain('isEqual(');
    });
});

describe('csharp inOp on `this.headers`', () => {
    test('the printer leaves the site to the build layer (which emits the null guard)', () => {
        // the embedding build layer prints this site natively WITH the helper's null test (inOp
        // answers false for a null receiver); a printer-table entry would drop that guard
        const output = cs(DICT +
        "class A {\n" +
        "    headers: Dict = {};\n" +
        "    run () {\n" +
        "        if ('x-simulated-trading' in this.headers) { return 1; }\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n");
        expect(output).toContain('inOp(this.headers, "x-simulated-trading")');
    });
});
