import * as nodefs from 'fs';
import * as nodepath from 'path';
import { Transpiler } from '../src/transpiler';

// RFM-C1 w3C03: `client.futures[key]` / `client.subscriptions[key]` and `this.safeValue (client.<state>, key)`
// over the ws Client's shared-state dictionaries print the native guarded read / the typed settle-api reader,
// gated on the embedding layer's csharpClientStateMember table.

const CLIENT = 'export default class Client {\n    futures: { [key: string]: any } = {};\n    subscriptions: { [key: string]: any } = {};\n    rejections: { [key: string]: any } = {};\n}\n';
const EXCHANGE = 'export default class Exchange {\n    safeValue (o: any, k: any, d?: any): any { return undefined; }\n}\n';
const TABLE = (member: string) => ({ futures: { reader: 'getFuture' }, subscriptions: { reader: 'getSubscription' } })[member];

const venue = (name: string, body: string, clientType = 'Client') =>
    "import Exchange from '../base/Exchange';\nimport Client from '../base/ws/Client';\n" +
    'export default class ex extends Exchange {\n' +
    '    handle (client: ' + clientType + ', messageHash: string, other: any) {\n' + body + '\n    }\n}\n';

const printed = (name: string, body: string, table: boolean, clientType = 'Client'): string => {
    const root = nodepath.join(__dirname, 'files', name, 'ts', 'src');
    nodefs.mkdirSync(nodepath.join(root, 'base', 'ws'), { recursive: true });
    nodefs.mkdirSync(nodepath.join(root, 'pro'), { recursive: true });
    nodefs.writeFileSync(nodepath.join(root, 'base', 'ws', 'Client.ts'), CLIENT);
    nodefs.writeFileSync(nodepath.join(root, 'base', 'Exchange.ts'), EXCHANGE);
    const file = nodepath.join(root, 'pro', 'ex.ts');
    nodefs.writeFileSync(file, venue(name, body, clientType));
    const t = new Transpiler({ verbose: false, csharp: { parser: { NUM_LINES_END_FILE: 0, ELEMENT_ACCESS_WRAPPER_OPEN: 'getValue(', ELEMENT_ACCESS_WRAPPER_CLOSE: ')' } } });
    const csharp: any = (t as any).csharpTranspiler;
    if (table) {
        csharp.csharpClientStateMember = TABLE;
        // the embedding layer prints `messageHash` as `string`
        csharp.csharpDeclaredLocalTypeResolver = (declaration) => (declaration?.name?.text === 'messageHash' ? 'string' : undefined);
    }
    return t.transpileCSharpByPath(file).content;
};

describe('hx11 RFM-C1 w3C03: ws Client shared-state reads', () => {
    afterAll(() => {
        nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-c03-a'), { recursive: true, force: true });
        nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-c03-b'), { recursive: true, force: true });
        nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-c03-c'), { recursive: true, force: true });
    });

    test('an index read of futures / subscriptions with a string key is the guarded native read', () => {
        const out = printed('tmp-c03-a', "        const f = client.futures[messageHash];\n        const s = client.subscriptions['authenticated'];\n        return [ f, s ];", true);
        expect(out).toContain('(client.futures != null && messageHash != null && client.futures.ContainsKey(messageHash) ? client.futures[messageHash] : null)');
        expect(out).toContain('(client.subscriptions != null && client.subscriptions.ContainsKey(\"authenticated\") ? client.subscriptions[\"authenticated\"] : null)');
    });

    test('safeValue over a state member with a string key is the typed reader', () => {
        const out = printed('tmp-c03-a', "        const f = this.safeValue (client.futures, messageHash);\n        const s = this.safeValue (client.subscriptions, 'authenticated');\n        return [ f, s ];", true);
        expect(out).toContain('client.getFuture(messageHash)');
        expect(out).toContain('client.getSubscription(\"authenticated\")');
    });

    test('no table: every read keeps the helper', () => {
        const out = printed('tmp-c03-b', "        const f = client.futures[messageHash];\n        const s = this.safeValue (client.subscriptions, messageHash);\n        return [ f, s ];", false);
        expect(out).toContain('getValue(client.futures, messageHash)');
        expect(out).toContain('this.safeValue(client.subscriptions, messageHash)');
        expect(out).not.toContain('ContainsKey');
        expect(out).not.toContain('getSubscription');
    });

    test('keys the printer cannot prove string, a default argument, other members and writes keep the helper', () => {
        const out = printed('tmp-c03-c', "        const a = client.futures[other];\n        const b = this.safeValue (client.subscriptions, messageHash, {});\n        const c = client.rejections[messageHash];\n        client.subscriptions[messageHash] = 1;\n        return [ a, b, c ];", true);
        expect(out).toContain('getValue(client.futures, other)');
        expect(out).toContain('this.safeValue(client.subscriptions, messageHash, new Dictionary<string, object>() {})');
        expect(out).toContain('getValue(client.rejections, messageHash)');
        expect(out).not.toContain('client.futures.ContainsKey');
        expect(out).not.toContain('getSubscription');
    });
});
