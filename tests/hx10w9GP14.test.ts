import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    const config = { 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
    transpiler = new Transpiler(config);
});

function go(ts: string): string {
    return transpiler.transpileGo(ts).content;
}

// the trampoline and its Body half both have to carry the parameter type
function signature(out: string, name: string): string {
    return out.split('\nfunc ').find((f) => f.startsWith('(this *Test) ' + name + '(')) ?? '';
}

const PRELUDE = 'interface MarketInterface { id: string; symbol: string; url: string; }\n' +
    'type Market = MarketInterface | undefined;\n' +
    'type Dict = { [key: string]: any };\n' +
    'type Str = string | undefined;\n' +
    'class Base {}\n';

describe('hx10 GP14 async venue-only parameters', () => {
    test('an untyped parameter whose every caller passes the market row prints the map in both halves', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    async watchPublic (body: any): Promise<any> {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const body = this.market (symbol);\n' +
            '        return this.watchPublic (body);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchPublic')).toContain('(body map[string]any)');
        expect(signature(out, 'watchPublicBody')).toContain(', body map[string]any)');
        expect(out).toContain('ch <- body["id"]');
        expect(out).not.toContain('GetValue(body');
    });

    test('an untyped parameter whose every caller passes one string prints the string', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchCrumb (topicID: any): Promise<any> {\n' +
            '        return topicID;\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        this.watchCrumb (\'7\');\n' +
            '        return this.watchCrumb (\'11\');\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchCrumb')).toContain('(topicID string)');
        expect(signature(out, 'watchCrumbBody')).toContain(', topicID string)');
    });

    test('one caller passing an absent value keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchPublic (body: any): Promise<any> {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        this.watchPublic ({ \'id\': 1 });\n' +
            '        return this.watchPublic (undefined);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchPublic')).toContain('(body any)');
        expect(out).toContain('GetValue(body, "id")');
    });

    test('a body that nil-tests a map parameter compares it natively', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchPublic (body: any): Promise<any> {\n' +
            '        if (body === undefined) { return 0; }\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        return this.watchPublic ({ \'id\': 1 });\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchPublic')).toContain('(body map[string]any)');
        expect(out).not.toContain('IsEqual(body, nil)');
    });

    test('a body that writes another type keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchPublic (body: any): Promise<any> {\n' +
            '        body = 1;\n' +
            '        return body;\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        return this.watchPublic ({ \'id\': 1 });\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchPublic')).toContain('(body any)');
    });

    test('a dynamically named call site keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchPublic (body: any): Promise<any> {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (raw: any): any {\n' +
            '        this.watchPublic ({ \'id\': 1 });\n' +
            '        return this[\'watchPublic\'](raw);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchPublic')).toContain('(body any)');
        expect(out).toContain('GetValue(body, "id")');
    });

    test('a pointer-typed call site keeps the box, so the call site needs no conversion', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    str (): Str { return undefined; }\n' +
            '    async watchCrumb (code: any): Promise<any> {\n' +
            '        return code;\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        const code = this.str ();\n' +
            '        return this.watchCrumb (code);\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchCrumb')).toContain('(code any)');
    });

    // a `string` body value handed to a `Str`-annotated parameter is re-wrapped there (SafeStringPtr)
    test('a string parameter the body feeds into a nullable slot keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    inner (code: Str): any { return code; }\n' +
            '    async watchCrumb (topicID: any): Promise<any> {\n' +
            '        return this.inner (topicID);\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        return this.watchCrumb (\'7\');\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchCrumb')).toContain('(topicID any)');
    });

    test('a `??` default keeps the box', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    async watchCrumb (topicID: any): Promise<any> {\n' +
            '        return topicID ?? \'1\';\n' +
            '    }\n' +
            '    main (): any {\n' +
            '        return this.watchCrumb (\'7\');\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(signature(out, 'WatchCrumb')).toContain('(topicID any)');
    });
});

describe('hx10 GP14 wrapper records', () => {
    // the generated public wrapper is built from these records (ccxt createWrapper), so a
    // positional parameter has to carry the type its core prints
    const record = (out: any, name: string): any => (out.methodsTypes ?? []).find((m: any) => m.name === name);

    test('an async positional parameter carries the printed Go type', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    async fetchBody (body: any): Promise<any> {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const body = this.market (symbol);\n' +
            '        return this.fetchBody (body);\n' +
            '    }\n' +
            '}\n';
        const out = transpiler.transpileGo(ts);
        expect(record(out, 'fetchBody').parameters[0].goType).toBe('map[string]any');
    });

    test('an optional parameter or a sync method carries no Go type', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    market (symbol: Str): Market { return undefined; }\n' +
            '    async fetchBody (body?: any): Promise<any> {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    syncBody (body: any): any {\n' +
            '        return body[\'id\'];\n' +
            '    }\n' +
            '    main (symbol: string): any {\n' +
            '        const body = this.market (symbol);\n' +
            '        this.syncBody (body);\n' +
            '        return this.fetchBody (body);\n' +
            '    }\n' +
            '}\n';
        const out = transpiler.transpileGo(ts);
        expect(record(out, 'fetchBody').parameters[0].goType).toBeUndefined();
        expect(record(out, 'syncBody').parameters[0].goType).toBeUndefined();
    });
});
