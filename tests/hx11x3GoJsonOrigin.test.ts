import { Transpiler } from '../src/transpiler';

// RFM-X3 goB (was ccxt build/hx11w8-json-origin.ts): `this.safeList (R, k)` unboxed to a []any, where R is the
// decoded body of an implicit endpoint (or a safeDict of one), reads its elements without the DerefScalar
// helper. Decoded JSON holds no typed pointer. Any use that could put one in keeps the helper.
let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});
const go = (ts: string): string => transpiler.transpileGo(ts).content;

const HEAD =
    'interface Test {\n    publicGetThing (params?: {}): Promise<any>;\n}\n' +
    'class Test {\n' +
    "    safeList (o: any, k: string, d: any[] = []): any[] { return d; }\n" +
    "    safeDict (o: any, k: string, d: any = {}): any { return d; }\n" +
    '    parse (x: any): any { return x; }\n';
const run = (body: string, extra = ''): string => go(HEAD + extra + '    async f (params: any): Promise<any> {\n' + body + '    }\n}\n');
const LOOP = '        for (let i = 0; i < data.length; i++) {\n            const row = data[i];\n            this.parse (row);\n        }\n';
const READ = '        const response = await this.publicGetThing (params);\n';

describe('RFM-X3 JSON-origin list element reads', () => {
    test('a safeList of an endpoint response reads its elements natively', () => {
        const out = run(READ + "        const data = this.safeList (response, 'data');\n" + LOOP);
        expect(out).toContain('return data[i]');
        expect(out).not.toContain('DerefScalar');
    });
    test('a safeList of a safeDict of an endpoint response reads natively', () => {
        const out = run(READ + "        const result = this.safeDict (response, 'result');\n        const data = this.safeList (result, 'data');\n" + LOOP);
        expect(out).not.toContain('DerefScalar');
    });
    test('a list of a non-endpoint container keeps the helper', () => {
        const out = run("        const data = this.safeList (params, 'data');\n" + LOOP);
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a response read by anything but the typed accessors keeps the helper', () => {
        const out = run(READ + "        const data = this.safeList (response, 'data');\n        this.parse (response);\n" + LOOP);
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a rebound response keeps the helper', () => {
        const out = run('        let response = await this.publicGetThing (params);\n        response = params;\n'
            + "        const data = this.safeList (response, 'data');\n" + LOOP);
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a list whose element is written keeps the helper', () => {
        const out = run(READ + "        const data = this.safeList (response, 'data');\n        data[0] = params['x'];\n" + LOOP);
        expect(out).toContain('var data any = this.SafeList(response');
        expect(out).not.toContain('data[i]');
    });
    test('a list that escapes whole keeps the helper', () => {
        const out = run(READ + "        const data = this.safeList (response, 'data');\n        this.parse (data);\n" + LOOP);
        expect(out).toContain('var data any = this.SafeList(response');
        expect(out).not.toContain('data[i]');
    });
    test('a response read through a non-literal safeDict key keeps the helper', () => {
        const out = run(READ + "        const result = this.safeDict (response, params['k']);\n        const data = this.safeList (result, 'data');\n" + LOOP);
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a method TypeScript implements is not an endpoint', () => {
        const out = run("        const response = await this.fetchThing (params);\n        const data = this.safeList (response, 'data');\n" + LOOP,
            '    async fetchThing (params: any): Promise<any> { return params; }\n');
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a helper whose every return is an endpoint body makes its caller a JSON origin', () => {
        const helper = '    async body (params: any): Promise<any> {\n        if (params) {\n            return await this.publicGetThing (params);\n        }\n        return undefined;\n    }\n';
        const out = run("        const response = await this.body (params);\n        const data = this.safeList (response, 'data');\n" + LOOP, helper);
        expect(out).toContain('return data[i]');
        expect(out).not.toContain('DerefScalar');
    });
    test('a helper that can return anything else keeps the helper', () => {
        const helper = '    async body (params: any): Promise<any> {\n        if (params) {\n            return await this.publicGetThing (params);\n        }\n        return params;\n    }\n';
        const out = run("        const response = await this.body (params);\n        const data = this.safeList (response, 'data');\n" + LOOP, helper);
        expect(out).toContain('DerefScalar(data[i])');
    });
    test('a helper returning a literal of safeList values of an endpoint body is a JSON origin', () => {
        const helper = "    async body (params: any): Promise<any> {\n        const r = await this.publicGetThing (params);\n        return { 'rows': this.safeList (r, 'data', []) };\n    }\n";
        const out = run("        const response = await this.body (params);\n        const data = this.safeList (response, 'rows');\n" + LOOP, helper);
        expect(out).toContain('return data[i]');
    });
    test('a response assigned in branches keeps the helper', () => {
        const out = run("        let response: any = {};\n        if (params) {\n            response = await this.publicGetThing (params);\n        }\n        const data = this.safeList (response, 'data');\n" + LOOP);
        expect(out).toContain('DerefScalar(data[i])');
    });
});
