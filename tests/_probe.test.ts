import { Transpiler } from '../src/transpiler';
import * as fs from 'fs';
test('probe', () => {
    const t = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    const src = [
        'class Client { subscriptions: any = {}; }',
        'class X {',
        '    safeDict (a: any, b: any, c: any = undefined): any { return a; }',
        '    safeValue (a: any, b: any): any { return a; }',
        '    indexBy (a: any, b: any): any { return a; }',
        '    m (client: Client, h: string, v: any) {',
        '        if (h in client.subscriptions) { delete client.subscriptions[h]; }',
        '        client.subscriptions[h] = v;',
        '        client.subscriptions["a:" + h] = { "b": h };',
        '        const g = client.subscriptions[h];',
        '        const s: any = client.subscriptions;',
        '        const d = this.safeDict (client.subscriptions, h, {});',
        '        const ks = Object.keys (client.subscriptions);',
        '        const vs = Object.values (client.subscriptions);',
        '        const ib = this.indexBy (client.subscriptions, "id");',
        '        const sv = this.safeValue (client.subscriptions, h);',
        '        const n = client.subscriptions[h]["x"];',
        '        client.subscriptions[h]["y"] = 1;',
        '        if (client.subscriptions[h] !== undefined) { return 1; }',
        '    }',
        '}',
    ].join ('\n');
    fs.writeFileSync (process.env.TMPDIR + '/probe.go', t.transpileGo (src).content);
});
