import { Transpiler } from '../src/transpiler';
import * as nodefs from 'fs';
import * as nodepath from 'path';

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

function go(ts: string): string {
    return transpiler.transpileGo(ts).content;
}

const PRELUDE = 'type Str = string | undefined;\n' +
    'type Dict = {[key: string]: any};\n' +
    'class Base {\n' +
    '    safeString (a: any, b: any, c?: string): Str { return undefined; }\n' +
    '}\n';

describe('hx10 GP15 *string argument into a venue string parameter', () => {
    test('a dominating guard dereferences the pointer and the parameter prints string', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const messageHash = this.safeString (message, \'messageHash\');\n' +
            '        if (messageHash !== undefined) {\n' +
            '            this.cleanFlag (messageHash);\n' +
            '        }\n' +
            '    }\n' +
            '    cleanFlag (hash: string) {\n' +
            '        return hash.indexOf (\'trade:\') === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) CleanFlag(hash string) any {');
        expect(out).toContain('this.CleanFlag(*messageHash)');
        expect(out).toContain('strings.Index(hash, "trade:")');
    });

    test('an unguarded nullable call site keeps the pointer on both sides', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const messageHash = this.safeString (message, \'messageHash\');\n' +
            '        this.cleanFlag (messageHash);\n' +
            '    }\n' +
            '    cleanFlag (hash: string) {\n' +
            '        return hash.indexOf (\'trade:\') === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) CleanFlag(hash *string) any {');
        expect(out).not.toContain('this.CleanFlag(*');
    });

    test('every pointer-shaped argument of one call keeps its own dereference', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const symbol = this.safeString (message, \'symbol\');\n' +
            '        const type = this.safeStringUpper (message, \'type\');\n' +
            '        if ((symbol !== undefined) && (type !== undefined)) {\n' +
            '            return this.build (symbol, type);\n' +
            '        }\n' +
            '    }\n' +
            '    safeStringUpper (a: any, b: any): Str { return undefined; }\n' +
            '    build (symbol: string, type: Str) {\n' +
            '        return symbol.indexOf (\'/\') === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) Build(symbol string, typeVar string) any {');
        expect(out).toContain('return this.Build(*symbol, *typeVar)');
    });

    test('a trailing default parameter does not hide the dereference', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const amountString = this.safeString (message, \'amount\');\n' +
            '        if (amountString !== undefined) {\n' +
            '            return this.toUnits (amountString);\n' +
            '        }\n' +
            '    }\n' +
            '    toUnits (num: string, dec: string = \'1000000000000000000\') {\n' +
            '        return num.indexOf (dec) === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) ToUnits(num string, optionalArgs ...any) any {');
        expect(out).toContain('return this.ToUnits(*amountString)');
    });

    test('an exiting nil guard earlier in the block proves the pointer', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const amountString = this.safeString (message, \'amount\');\n' +
            '        if (amountString === undefined) {\n' +
            '            throw new Error (\'amount required\');\n' +
            '        }\n' +
            '        return this.toUnits (amountString);\n' +
            '    }\n' +
            '    toUnits (num: string) {\n' +
            '        return num.indexOf (\'/\') === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) ToUnits(num string) any {');
        expect(out).toContain('return this.ToUnits(*amountString)');
    });

    test('an exiting guard on another local proves nothing', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const amountString = this.safeString (message, \'amount\');\n' +
            '        const other = this.safeString (message, \'other\');\n' +
            '        if (other === undefined) {\n' +
            '            return;\n' +
            '        }\n' +
            '        return this.toUnits (amountString);\n' +
            '    }\n' +
            '    toUnits (num: string) {\n' +
            '        return num.indexOf (\'/\') === 0;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) ToUnits(num *string) any {');
        expect(out).not.toContain('this.ToUnits(*');
    });

    test('a pointer argument into a pointer parameter keeps the pointer', () => {
        const ts = PRELUDE +
            'class Test extends Base {\n' +
            '    main (message: Dict) {\n' +
            '        const messageHash = this.safeString (message, \'messageHash\');\n' +
            '        if (messageHash !== undefined) {\n' +
            '            this.cleanFlag (messageHash);\n' +
            '        }\n' +
            '    }\n' +
            '    cleanFlag (hash: Str) {\n' +
            '        if (hash === undefined) {\n' +
            '            return;\n' +
            '        }\n' +
            '        return hash;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Test) CleanFlag(hash *string) any {');
        expect(out).toContain('this.CleanFlag(messageHash)');
        expect(out).not.toContain('this.CleanFlag(*');
    });

    // the base file is a dependency, never transpiled: its accessor overloads can declare the
    // three-argument form as a non-nilable `string`, the way ts/src/base/Exchange.ts does
    const BASE_FIXTURE = 'type Str = string | undefined;\n' +
    'export class Exchange {\n' +
    '    safeDict (a, b) { return undefined; }\n' +
    '    safeString (a, b): Str;\n' +
    '    safeString (a, b, c: string): string;\n' +
    '    safeString (a, b, c?) { return undefined; }\n' +
    '    handleMessage (client, message) {}\n' +
    '}\n';
    const PRO_HEADER = "import { Exchange } from '../base/Exchange';\n" +
        "import { Client } from '../base/ws/Client';\n" +
        "import type { Dict } from '../base/types';\n";

    const treeFor = (name: string, pro: string) => {
        const src = nodepath.join(__dirname, 'files', name, 'ts', 'src');
        nodefs.mkdirSync(nodepath.join(src, 'base', 'ws'), { recursive: true });
        nodefs.mkdirSync(nodepath.join(src, 'pro'), { recursive: true });
        nodefs.writeFileSync(nodepath.join(src, 'base', 'Exchange.ts'), BASE_FIXTURE);
        nodefs.writeFileSync(nodepath.join(src, 'base', 'ws', 'Client.ts'), 'export class Client { receive () { return undefined; } }\n');
        nodefs.writeFileSync(nodepath.join(src, 'base', 'types.ts'), 'export type Dict = {[key: string]: any};\n');
        nodefs.writeFileSync(nodepath.join(src, 'pro', 'ex.ts'), PRO_HEADER + pro);
        return nodepath.join(src, 'pro', 'ex.ts');
    };

    afterAll(() => {
        for (const entry of nodefs.readdirSync(nodepath.join(__dirname, 'files'))) {
            if (entry.startsWith('tmp-gp15-')) {
                nodefs.rmSync(nodepath.join(__dirname, 'files', entry), { recursive: true, force: true });
            }
        }
    });

    test('a Safe* accessor with a non-nil default dereferences in place', () => {
        const file = treeFor('tmp-gp15-default',
            "export class ex extends Exchange {\n" +
            "    main (message: Dict) {\n" +
            "        this.cleanFlag (this.safeString (message, 'id', ''));\n" +
            "    }\n" +
            "    cleanFlag (hash: string) {\n" +
            "        return hash.indexOf ('trade:') === 0;\n" +
            "    }\n" +
            "}\n");
        const out = new Transpiler({ verbose: false, go: {} }).transpileGoByPath(file).content;
        expect(out).toContain('func (this *ex) CleanFlag(hash string) any {');
        expect(out).toContain('this.CleanFlag(*this.SafeString(message, "id", ""))');
    });

    test('a pro handle* method types its string parameter, the frame keeps its box', () => {
        const file = treeFor('tmp-gp15-pro',
            "export class ex extends Exchange {\n" +
            "    handleUnsubscription (client: Client, message: Dict) {\n" +
            "        const messageHash = this.safeString (message, 'messageHash');\n" +
            "        if (messageHash !== undefined) {\n" +
            "            this.handleUnsubscriptionCache (messageHash);\n" +
            "        }\n" +
            "    }\n" +
            "    handleUnsubscriptionCache (messageHash: string) {\n" +
            "        return messageHash.indexOf ('trade:') === 0;\n" +
            "    }\n" +
            "}\n");
        const out = new Transpiler({ verbose: false, go: {} }).transpileGoByPath(file).content;
        expect(out).toContain('func (this *ex) HandleUnsubscriptionCache(messageHash string) any {');
        expect(out).toContain('this.HandleUnsubscriptionCache(*messageHash)');
        expect(out).toContain('func (this *ex) HandleUnsubscription(client any, message map[string]any) {');
    });

    test('a pro handle* Str parameter takes the pointer when the body nil-tests it', () => {
        const file = treeFor('tmp-gp15-pro-str',
            "type Str = string | undefined;\n" +
            "export class ex extends Exchange {\n" +
            "    handleUnsubscription (client: Client, message: Dict) {\n" +
            "        const messageHash = this.safeString (message, 'messageHash');\n" +
            "        if (messageHash !== undefined) {\n" +
            "            this.handleUnsubscriptionCache (messageHash);\n" +
            "        }\n" +
            "    }\n" +
            "    handleUnsubscriptionCache (messageHash: Str) {\n" +
            "        if (messageHash === undefined) {\n" +
            "            return;\n" +
            "        }\n" +
            "        return messageHash.indexOf ('trade:') === 0;\n" +
            "    }\n" +
            "}\n");
        const out = new Transpiler({ verbose: false, go: {} }).transpileGoByPath(file).content;
        expect(out).toContain('func (this *ex) HandleUnsubscriptionCache(messageHash *string) any {');
        expect(out).toContain('if messageHash == nil {');
        expect(out).toContain('strings.Index(*messageHash, "trade:")');
    });

    test('a pro handle* string parameter the body never nil-tests keeps the box', () => {
        const file = treeFor('tmp-gp15-pro-unguarded',
            "export class ex extends Exchange {\n" +
            "    handleUnsubscription (client: Client, message: Dict) {\n" +
            "        this.handleUnsubscriptionCache (this.safeString (message, 'symbol'));\n" +
            "    }\n" +
            "    handleUnsubscriptionCache (symbol: string) {\n" +
            "        return symbol.indexOf ('trade:') === 0;\n" +
            "    }\n" +
            "}\n");
        const out = new Transpiler({ verbose: false, go: {} }).transpileGoByPath(file).content;
        expect(out).toContain('func (this *ex) HandleUnsubscriptionCache(symbol any) any {');
        expect(out).toContain('GetIndexOf(symbol, "trade:")');
    });
});
