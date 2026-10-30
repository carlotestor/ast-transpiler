import * as nodefs from 'fs';
import * as nodepath from 'path';
import { Transpiler, installCcxtGoDictParams } from '../src/transpiler';

const BASE =
    'type Dict = { [key: string]: any };\n' +
    'export class Exchange {\n' +
    '    safeDict (a, b, c?) { return undefined; }\n' +
    '    mergeBalanceAccount (result: Dict, code: string, account: Dict): Dict {\n' +
    '        result[code] = account;\n' +
    '        return result;\n' +
    '    }\n' +
    '}\n';

const venue = (helperSignature: string) =>
    "import { Exchange } from './base/Exchange';\n" +
    'type Dict = { [key: string]: any };\n' +
    'export class ex extends Exchange {\n' +
    '    ' + helperSignature + ' {\n' +
    '        return entry;\n' +
    '    }\n' +
    '    run (base: Dict) {\n' +
    '        let result: Dict = {};\n' +
    "        result = this.mergeBalanceAccount (result, 'BTC', this.parseBalanceHelper (base));\n" +
    '        return result;\n' +
    '    }\n' +
    '}\n';

const baseSignature = (name: string): string => {
    const dir = nodepath.join(__dirname, 'files', name, 'ts', 'src');
    nodefs.mkdirSync(nodepath.join(dir, 'base'), { recursive: true });
    nodefs.writeFileSync(nodepath.join(dir, 'base', 'Exchange.ts'), BASE);
    return dir;
};

const printBase = (name: string, helperSignature: string): string => {
    const dir = baseSignature(name);
    nodefs.writeFileSync(nodepath.join(dir, 'ex.ts'), venue(helperSignature));
    const t = new Transpiler({ verbose: false, go: {} });
    installCcxtGoDictParams(t.goTranspiler);
    return t.transpileGoByPath(nodepath.join(dir, 'base', 'Exchange.ts')).content;
};

describe('hx11 w9 GB01: calls to same-tree methods declared : Dict', () => {
    afterAll(() => {
        nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-gb01-dict'), { recursive: true, force: true });
        nodefs.rmSync(nodepath.join(__dirname, 'files', 'tmp-gb01-any'), { recursive: true, force: true });
    });

    test('a call to a method declared : Dict proves the tabled map parameters', () => {
        const out = printBase('tmp-gb01-dict', 'parseBalanceHelper (entry: Dict): Dict');
        expect(out).toContain('MergeBalanceAccount(result map[string]any, code any, account any)');
    });

    test('a call to a method without a Dict return type keeps the box', () => {
        const out = printBase('tmp-gb01-any', 'parseBalanceHelper (entry: Dict)');
        expect(out).toContain('MergeBalanceAccount(result map[string]any, code any, account any)');
    });
});
