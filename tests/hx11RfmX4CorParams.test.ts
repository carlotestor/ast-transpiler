import { Transpiler } from '../src/transpiler';
import * as nodefs from 'fs';
import * as nodepath from 'path';

// hx11 RFM-X4: the string parameter proofs ccxt used to monkey-patch onto the printer
// (build/hx11w8-cor-params.ts) live in the Go printer: goPrintedArgType (bound identifiers),
// goParameterCallSitesPassType (ws Client.url sites, order-request builders).

const BASE = 'export class Exchange {\n    safeString (a, b, c?) { return undefined; }\n}\n';
const CLIENT = 'export default class Client {\n    url: string;\n}\n';

function write(root: string, rel: string, text: string) {
    const file = nodepath.join(root, 'ts', 'src', rel);
    nodefs.mkdirSync(nodepath.dirname(file), { recursive: true });
    nodefs.writeFileSync(file, text);
    return file;
}

function tree(name: string, files: { [rel: string]: string }) {
    const root = nodepath.join(__dirname, 'files', name);
    nodefs.rmSync(root, { recursive: true, force: true });
    Object.keys(files).forEach((rel) => write(root, rel, files[rel]));
    return root;
}

function goOf(root: string, rel: string, unifiedStringParams: any = {}) {
    return new Transpiler({ verbose: false, go: { unifiedStringParams } }).transpileGoByPath(nodepath.join(root, 'ts', 'src', rel)).content;
}

const roots: string[] = [];
function fixture(name: string, files: { [rel: string]: string }) {
    const root = tree(name, files);
    roots.push(root);
    return root;
}

afterAll(() => {
    roots.forEach((root) => nodefs.rmSync(root, { recursive: true, force: true }));
});

describe('hx11 RFM-X4 ws Client.url call sites', () => {
    const header = "import { Exchange } from '../base/Exchange';\nimport Client from '../base/ws/Client';\n";

    test('every call site passes client.url of a Client: the string parameter prints string', () => {
        const root = fixture('tmp-x4-url', {
            'base/Exchange.ts': BASE,
            'base/ws/Client.ts': CLIENT,
            'pro/ex.ts': header +
                'export default class ex extends Exchange {\n' +
                '    handleA (client: Client) {\n' +
                '        return this.typeByUrl (client.url);\n' +
                '    }\n' +
                '    handleB (client: Client) {\n' +
                '        return this.typeByUrl (client.url);\n' +
                '    }\n' +
                "    typeByUrl (url: string): string {\n" +
                "        if (url.indexOf ('fstream') > -1) {\n" +
                "            return 'swap';\n" +
                '        }\n' +
                "        return 'spot';\n" +
                '    }\n' +
                '}\n',
        });
        expect(goOf(root, 'pro/ex.ts')).toContain('func (this *ex) TypeByUrl(url string) any {');
    });

    test('a call site that passes anything else keeps the box', () => {
        const root = fixture('tmp-x4-url-neg', {
            'base/Exchange.ts': BASE,
            'base/ws/Client.ts': CLIENT,
            'pro/ex.ts': header +
                'export default class ex extends Exchange {\n' +
                '    handleA (client: Client) {\n' +
                '        return this.typeByUrl (client.url);\n' +
                '    }\n' +
                '    handleB (client: Client, other) {\n' +
                '        return this.typeByUrl (other);\n' +
                '    }\n' +
                '    typeByUrl (url: string): string {\n' +
                "        return url.indexOf ('fstream') > -1 ? 'swap' : 'spot';\n" +
                '    }\n' +
                '}\n',
        });
        expect(goOf(root, 'pro/ex.ts')).toContain('func (this *ex) TypeByUrl(url any) any {');
    });

    test('a sibling file calling the method is a call site the checker did not prove: keeps the box', () => {
        const root = fixture('tmp-x4-url-sibling', {
            'base/Exchange.ts': BASE,
            'base/ws/Client.ts': CLIENT,
            'pro/ex.ts': header +
                'export default class ex extends Exchange {\n' +
                '    handleA (client: Client) {\n' +
                '        return this.typeByUrl (client.url);\n' +
                '    }\n' +
                '    typeByUrl (url: string): string {\n' +
                "        return url.indexOf ('fstream') > -1 ? 'swap' : 'spot';\n" +
                '    }\n' +
                '}\n',
            'pro/other.ts': "import ex from './ex';\nexport default class other extends ex {\n    use (name) {\n        return this.typeByUrl (name);\n    }\n}\n",
        });
        expect(goOf(root, 'pro/ex.ts')).toContain('func (this *ex) TypeByUrl(url any) any {');
    });

    test('a `client` that is not the ws Client class does not prove a string', () => {
        const root = fixture('tmp-x4-url-foreign', {
            'base/Exchange.ts': BASE,
            'pro/ex.ts': 'export class Client {\n    url: any;\n}\n' +
                "import { Exchange } from '../base/Exchange';\n" +
                'export default class ex extends Exchange {\n' +
                '    handleA (client: Client) {\n' +
                '        return this.typeByUrl (client.url);\n' +
                '    }\n' +
                '    typeByUrl (url: string): string {\n' +
                "        return url.indexOf ('fstream') > -1 ? 'swap' : 'spot';\n" +
                '    }\n' +
                '}\n',
        });
        expect(goOf(root, 'pro/ex.ts')).toContain('func (this *ex) TypeByUrl(url any) any {');
    });
});

describe('hx11 RFM-X4 order-request builders', () => {
    const exchange = (proBody: string) => ({
        'base/Exchange.ts': BASE,
        'ex.ts': "import { Exchange } from './base/Exchange';\n" +
            'export default class ex extends Exchange {\n' +
            '    async createOrder (symbol: string, type: string, side: string) {\n' +
            '        return this.createOrderRequest (symbol, type, side);\n' +
            '    }\n' +
            '    createOrderRequest (symbol: string, type: string, side: string) {\n' +
            "        return { 'symbol': symbol, 'type': type.toUpperCase (), 'side': side };\n" +
            '    }\n' +
            '}\n',
        'pro/ex.ts': "import ex from '../ex';\n" +
            'export default class expro extends ex {\n' + proBody + '}\n',
    });
    const table = { 'createOrder': [ 0, 1, 2 ], 'createOrderWs': [ 0, 1, 2 ] };

    test('a sibling passing its unified-table parameters straight through types the builder', () => {
        const root = fixture('tmp-x4-order', exchange(
            '    async createOrderWs (symbol: string, type: string, side: string) {\n' +
            '        return this.createOrderRequest (symbol, type, side);\n' +
            '    }\n'));
        expect(goOf(root, 'ex.ts', table)).toContain('func (this *ex) CreateOrderRequest(symbol string, typeVar string, side string) any {');
    });

    test('a sibling passing a method parameter outside the unified table keeps the box', () => {
        const root = fixture('tmp-x4-order-neg', exchange(
            '    async createOrderStuff (symbol: string, type: string, side: string) {\n' +
            '        return this.createOrderRequest (symbol, type, side);\n' +
            '    }\n'));
        expect(goOf(root, 'ex.ts', table)).toContain('func (this *ex) CreateOrderRequest(symbol any, typeVar any, side any) any {');
    });

    test('a sibling that reassigns a parameter before the call keeps only that slot boxed', () => {
        const root = fixture('tmp-x4-order-reassigned', exchange(
            '    async createOrderWs (symbol: string, type: string, side: string) {\n' +
            "        side = 'buy';\n" +
            '        return this.createOrderRequest (symbol, type, side);\n' +
            '    }\n'));
        expect(goOf(root, 'ex.ts', table)).toContain('func (this *ex) CreateOrderRequest(symbol string, typeVar string, side any) any {');
    });

    test('a method that is not an order-request builder keeps the upstream verdict', () => {
        const root = fixture('tmp-x4-order-other', {
            'base/Exchange.ts': BASE,
            'ex.ts': "import { Exchange } from './base/Exchange';\n" +
                'export default class ex extends Exchange {\n' +
                '    async createOrder (symbol: string, type: string, side: string) {\n' +
                '        return this.buildBody (symbol, type, side);\n' +
                '    }\n' +
                '    buildBody (symbol: string, type: string, side: string) {\n' +
                "        return { 'symbol': symbol, 'type': type.toUpperCase (), 'side': side };\n" +
                '    }\n' +
                '}\n',
            'pro/ex.ts': "import ex from '../ex';\n" +
                'export default class expro extends ex {\n' +
                '    async createOrderWs (symbol: string, type: string, side: string) {\n' +
                '        return this.buildBody (symbol, type, side);\n' +
                '    }\n' +
                '}\n',
        });
        expect(goOf(root, 'ex.ts', table)).toContain('func (this *ex) BuildBody(symbol any, typeVar any, side any) any {');
    });
});

describe('hx11 RFM-X4 bound identifier arguments', () => {
    const prelude = 'type Str = string | undefined;\ntype Dict = {[key: string]: any};\n' +
        'class Base {\n' +
        '    safeString (a: any, b: any, c?: string): Str { return undefined; }\n' +
        '    handleMarketTypeAndParams (methodName: string, market = undefined, params = {}): [string, Dict] { return [ undefined, params ]; }\n' +
        '}\n';
    const go = (ts: string) => new Transpiler({ verbose: false, go: { parser: { NUM_LINES_END_FILE: 0 } } }).transpileGo(ts).content;

    test('a defaulted string parameter is a Go string at the call site of a local method', () => {
        const out = go(prelude +
            'class Test extends Base {\n' +
            "    request (method: string = 'GET') {\n" +
            '        return this.send (method);\n' +
            '    }\n' +
            '    send (verb: string) {\n' +
            "        return verb.indexOf ('G');\n" +
            '    }\n' +
            '}\n');
        expect(out).toContain('func (this *Test) Send(verb string) any {');
    });

    test('slot 0 of a const handleMarketTypeAndParams destructure is the *string tuple result', () => {
        const out = go(prelude +
            'class Test extends Base {\n' +
            '    fetch (params = {}) {\n' +
            "        const [ marketType, query ] = this.handleMarketTypeAndParams ('fetch', undefined, params);\n" +
            '        return this.pick (marketType);\n' +
            '    }\n' +
            '    pick (kind: Str) {\n' +
            '        return kind;\n' +
            '    }\n' +
            '}\n');
        expect(out).toContain('func (this *Test) Pick(kind *string) any {');
    });

    test('a let destructure is not proven', () => {
        const out = go(prelude +
            'class Test extends Base {\n' +
            '    fetch (params = {}) {\n' +
            "        let [ marketType, query ] = this.handleMarketTypeAndParams ('fetch', undefined, params);\n" +
            '        return this.pick (marketType);\n' +
            '    }\n' +
            '    pick (kind: Str) {\n' +
            '        return kind;\n' +
            '    }\n' +
            '}\n');
        expect(out).toContain('func (this *Test) Pick(kind any) any {');
    });
});
