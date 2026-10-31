import { Transpiler, installCcxtGoHooks } from '../src/transpiler';

// hx11 RFM-G1 GP08 (folded from ccxt build/hx10w8-GP08.ts): the first result of a pair helper binds natively.
import * as nodefs from 'fs';
import * as nodepath from 'path';

const HEAD = 'type Dict = { [key: string]: any };\ntype Bool = boolean | undefined;\ntype Str = string | undefined;\n'
    + 'export class Exchange {\n'
    + '    handleOptionBoolAndParams (params: Dict, methodName: string, optionName: string, defaultValue: boolean = undefined): [boolean, Dict] { return [ true, params ]; }\n'
    + '    handleOptionStringAndParams (params: Dict, methodName: string, optionName: string, defaultValue: Str = undefined): [Str, Dict] { return [ undefined, params ]; }\n'
    + '    handleUntilOption (key: string, request: Dict, params: Dict, multiplier = 1): [Dict, Dict] { return [ request, params ]; }\n'
    + '    handleSubTypeAndParams (methodName: string, market: any = undefined, params = {}, defaultValue: Str = undefined): [Str, Dict] { return [ undefined, params ]; }\n'
    + '}\n';
const dir = nodepath.join(__dirname, 'files', 'tmp-rfm-g1-gp08', 'ts', 'src');
const venue = (body: string, extra = ''): string => "import { Exchange } from './base/Exchange';\n" + 'type Dict = { [key: string]: any };\ntype Bool = boolean | undefined;\ntype Str = string | undefined;\n'
    + 'export class ex extends Exchange {\n' + extra + '    f (params = {}) {\n' + body + '\n        return 1;\n    }\n}\n';
const printed = (body: string, extra = '', hooks = true): string => {
    nodefs.mkdirSync (nodepath.join (dir, 'base'), { recursive: true });
    nodefs.writeFileSync (nodepath.join (dir, 'base', 'Exchange.ts'), HEAD);
    nodefs.writeFileSync (nodepath.join (dir, 'ex.ts'), venue (body, extra));
    const t = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (hooks) { installCcxtGoHooks (t.goTranspiler); }
    return t.transpileGoByPath (nodepath.join (dir, 'ex.ts')).content;
};
const run = (body: string, extra = ''): string => printed (body, extra);
const base = (body: string): string => printed (body, '', false);
afterAll (() => { nodefs.rmSync (nodepath.join (__dirname, 'files', 'tmp-rfm-g1-gp08'), { recursive: true, force: true }); });

describe('hx11 RFM-G1 GP08: the first result of a pair helper', () => {
    test('an element-0 read of the call binds `x, _ := call` (fails on the base printer)', () => {
        const body = "        const subType = this.handleSubTypeAndParams ('fetchTime', undefined, params)[0];\n        return subType;";
        const out = run (body);
        expect (out).toContain ('subType, _ := this.HandleSubTypeAndParams("fetchTime", nil, params)');
        expect (out).not.toContain ('TupleSlice');
        expect (base (body)).toContain ('GetValue(this.HandleSubTypeAndParams');
    });
    test('a boolean read binds the value and takes its address', () => {
        const out = run ("        const closed = this.handleOptionBoolAndParams (params, 'm', 'o', false)[0];\n        return closed;");
        expect (out).toContain ('closedValue, _ := this.HandleOptionBoolAndParams(params, "m", "o", false)');
        expect (out).toContain ('closed := &closedValue');
        expect (out).not.toContain ('TupleSlice');
    });
    test('a holder read once through its element 0 binds the pair into the typed local', () => {
        const out = run ("        const pair = this.handleOptionBoolAndParams (params, 'm', 'o', false);\n        const uta: Bool = pair[0];\n        return uta;");
        expect (out).toContain ('utaValue, _ := this.HandleOptionBoolAndParams(params, "m", "o", false)');
        expect (out).not.toContain ('pair');
    });
    test('a holder read a second time keeps the box', () => {
        const out = run ("        const pair = this.handleOptionBoolAndParams (params, 'm', 'o', false);\n        const uta: Bool = pair[0];\n        return [ uta, pair[1] ];");
        expect (out).toContain ('TupleSlice');
    });
    test('a default that is not a literal value keeps the []any (Nullable) result', () => {
        const out = run ("        const d: Bool = undefined;\n        const closed = this.handleOptionBoolAndParams (params, 'm', 'o', d)[0];\n        return closed;");
        expect (out).not.toContain ('closedValue, _ :=');
    });
    test('a class that declares the helper itself keeps the printed form', () => {
        const out = run ("        const subType = this.handleSubTypeAndParams ('fetchTime', undefined, params)[0];\n        return subType;",
            "    handleSubTypeAndParams (methodName: string, market: any = undefined, params = {}, defaultValue: Str = undefined): [Str, Dict] { return [ undefined, params ]; }\n");
        expect (out).not.toContain ('subType, _ :=');
    });
});

describe('hx11 RFM-G1 GP08: map first result and a nil-init local written by the pair', () => {
    test('handleUntilOption()[0] binds the Dict the helper hands back', () => {
        const out = run ("        const until = this.handleUntilOption ('end', {}, params)[0];\n        return until;");
        expect (out).toContain ('until, _ := this.HandleUntilOption("end", map[string]any{}, params)');
        expect (out).not.toContain ('TupleSlice');
    });
    test('a nil-init local whose only write is the pair is the *string and keeps its case reads native', () => {
        const out = run ("        let mode: Str = undefined;\n        [ mode, params ] = this.handleOptionStringAndParams (params, 'm', 'o');\n"
            + "        if (mode !== undefined) {\n            return mode.toUpperCase ();\n        }");
        expect (out).toContain ('var mode *string = nil');
        expect (out).toContain ('mode, params = this.HandleOptionStringAndParams(params, "m", "o")');
        expect (out).toContain ('strings.ToUpper(*mode)');
        expect (out).not.toContain ('TupleSlice');
        expect (base ("        let mode: Str = undefined;\n        [ mode, params ] = this.handleOptionStringAndParams (params, 'm', 'o');\n        return mode;")).toContain ('var mode any = nil');
    });
    test('a nil-init local that is written a second time keeps the box', () => {
        const out = run ("        let mode: Str = undefined;\n        [ mode, params ] = this.handleOptionStringAndParams (params, 'm', 'o');\n        mode = 'x';\n        return mode;");
        expect (out).toContain ('TupleSlice');
    });
});
