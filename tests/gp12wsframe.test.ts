import { Transpiler } from '../src/transpiler';
import * as nodefs from 'fs';
import * as nodepath from 'path';

// hx10 GP12: the ws frame parameter of `override handleMessage (client, message: Dict)`.
// The frame is only provable with the real ts/src tree: the Go ws dispatch asserts the decoded
// object once, and a handler the frame is passed to inherits the type through its call site.
const BASE_FIXTURE =
    "export class Exchange {\n" +
    "    safeDict (a, b, c?) { return undefined; }\n" +
    "    safeString (a, b, c?) { return undefined; }\n" +
    "    safeValue (a, b, c?) { return undefined; }\n" +
    "    handleMessage (client, message) {}\n" +
    "}\n";
const CLIENT_FIXTURE =
    "export class Client { receive () { return undefined; } }\n";
const TYPES_FIXTURE =
    "export type Dict = {[key: string]: any};\n";
const PRO_HEADER =
    "import { Exchange } from '../base/Exchange';\n" +
    "import { Client } from '../base/ws/Client';\n" +
    "import type { Dict } from '../base/types';\n";

function treeFor (name: string, pro: string): string {
    const src = nodepath.join (__dirname, 'files', name, 'ts', 'src');
    nodefs.mkdirSync (nodepath.join (src, 'base', 'ws'), { recursive: true });
    nodefs.mkdirSync (nodepath.join (src, 'pro'), { recursive: true });
    nodefs.writeFileSync (nodepath.join (src, 'base', 'Exchange.ts'), BASE_FIXTURE);
    nodefs.writeFileSync (nodepath.join (src, 'base', 'ws', 'Client.ts'), CLIENT_FIXTURE);
    nodefs.writeFileSync (nodepath.join (src, 'base', 'types.ts'), TYPES_FIXTURE);
    nodefs.writeFileSync (nodepath.join (src, 'pro', 'ex.ts'), PRO_HEADER + pro);
    return nodepath.join (src, 'pro', 'ex.ts');
}

function goPath (name: string, pro: string): string {
    return new Transpiler ({ verbose: false, go: {} }).transpileGoByPath (treeFor (name, pro)).content;
}

afterAll (() => {
    const dir = nodepath.join (__dirname, 'files');
    for (const entry of nodefs.readdirSync (dir)) {
        if (entry.startsWith ('tmp-gp12-')) {
            nodefs.rmSync (nodepath.join (dir, entry), { recursive: true, force: true });
        }
    }
});

describe ('hx10 GP12 ws frame parameter', () => {
    test ('a Dict-annotated override frame prints map[string]any and its reads go native', () => {
        const output = goPath ('tmp-gp12-frame',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        const event = message['e'];\n" +
            "        return event;\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message map[string]any) any {');
        expect (output).toContain ('var event any = message["e"]');
        expect (output).not.toContain ('GetValue(message, "e")');
    });

    test ('a handler the frame is passed to inherits the map type', () => {
        const output = goPath ('tmp-gp12-chain',
            "export class ex extends Exchange {\n" +
            "    handleOrderBook (client: Client, message: Dict) {\n" +
            "        return message['asks'];\n" +
            "    }\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        this.handleOrderBook (client, message);\n" +
            "        return undefined;\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message map[string]any) any {');
        expect (output).toContain ('func (this *ex) HandleOrderBook(client any, message map[string]any) any {');
        expect (output).toContain ('return message["asks"]');
        expect (output).not.toContain ('GetValue(message, "asks")');
    });

    test ('an any-annotated override frame keeps the box', () => {
        const output = goPath ('tmp-gp12-any',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: any) {\n" +
            "        return this.safeValue (message, 'event');\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message any) any {');
        expect (output).toContain ('this.SafeValue(message, "event")');
    });

    test ('an array-framed venue keeps the box even with the Dict annotation', () => {
        const output = goPath ('tmp-gp12-array',
            "export class Phemex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        return this.safeValue (message, 'event');\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *Phemex) HandleMessage(client any, message any) any {');
        expect (output).toContain ('this.SafeValue(message, "event")');
    });

    test ('a frame the body reassigns to another type keeps the box', () => {
        const output = goPath ('tmp-gp12-write',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        message = 'text';\n" +
            "        return this.safeValue (message, 'event');\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message any) any {');
    });

    test ('a nil test on the frame compares the map natively', () => {
        const output = goPath ('tmp-gp12-nil',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        if (message === undefined) {\n" +
            "            return undefined;\n" +
            "        }\n" +
            "        return this.safeValue (message, 'event');\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message map[string]any) any {');
        expect (output).toContain ('if message == nil {');
    });

    test ('an in-read inside an if condition prints the native init clause', () => {
        const output = goPath ('tmp-gp12-inop-if',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        if (('result' in message) && (message['id'] !== undefined)) {\n" +
            "            return message;\n" +
            "        }\n" +
            "        return undefined;\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('if _, ok := message["result"];');
        expect (output).not.toContain ('func() bool');
    });

    test ('an in-read outside an if condition keeps the box (no closure body)', () => {
        const output = goPath ('tmp-gp12-inop-value',
            "export class ex extends Exchange {\n" +
            "    override handleMessage (client: Client, message: Dict) {\n" +
            "        const hasResult = 'result' in message;\n" +
            "        return hasResult;\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) HandleMessage(client any, message any) any {');
    });

    test ('a non-handleMessage override keeps the box', () => {
        const output = goPath ('tmp-gp12-other',
            "export class ex extends Exchange {\n" +
            "    override onMessage (client: Client, message: Dict) {\n" +
            "        return this.safeValue (message, 'event');\n" +
            "    }\n" +
            "    override handleMessage (client: Client, message: any) {\n" +
            "        this.onMessage (client, message);\n" +
            "        return undefined;\n" +
            "    }\n" +
            "}\n");
        expect (output).toContain ('func (this *ex) OnMessage(client any, message any) any {');
    });
});
