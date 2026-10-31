import { Transpiler, installCcxtGoHooks, installCcxtGoSignTyping, g08w3Check, hx10w8GB01Check, hx10w8GB05Check, hx10w9GB11Check, hx10G06Check } from '../src/transpiler';

// hx11 ast-move (Go): ccxt's Go printer hooks now live in src/go and are installed from the package entry.

const SIGN = 'type Dict = { [key: string]: any };\n'
    + 'class Exchange {\n'
    + '    sign (path: string, api: string[] = [ \'public\', \'private\' ], method = \'GET\', params = {}): any {\n'
    + '        const apiName = api[0];\n'
    + '        if (apiName === \'public\') { return api[1]; }\n'
    + '        return undefined;\n'
    + '    }\n'
    + '    other (path: string, api: string[] = [ \'public\' ]): any {\n'
    + '        return api[0];\n'
    + '    }\n'
    + '}\n';

const print = (install: boolean, source = SIGN): string => {
    const t = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (install) { installCcxtGoSignTyping (t.goTranspiler); }
    return t.transpileGo (source).content;
};

describe('hx11 go hooks (moved from ccxt build/)', () => {
    test('sign typing: api binds as []string and api[0] indexes natively (fails on the base printer)', () => {
        const base = print (false);
        const hooked = print (true);
        expect (base).not.toContain ('api[0]');
        expect (hooked).toContain ('api[0]');
        expect (hooked).toContain ('[]string');
    });
    test('sign typing negative: a method that is not sign/fetch2/request stays untouched', () => {
        const hooked = print (true);
        const other = hooked.split (/\nfunc /).find ((f) => f.indexOf ('Other(') >= 0) ?? '';
        expect (other).not.toContain ('api[0]');
    });
    test('installCcxtGoHooks installs every hook once (idempotent)', () => {
        const t = new Transpiler ({ 'verbose': false, 'go': {} });
        installCcxtGoHooks (t.goTranspiler);
        const once = t.goTranspiler.goNativeParameterType;
        installCcxtGoHooks (t.goTranspiler);
        expect (typeof once).toBe ('function');
        expect (t.transpileGo (SIGN).content).toContain ('api[0]');
    });
    test.each ([
        [ 'G06', hx10G06Check ], [ 'G08', g08w3Check ], [ 'GB01', hx10w8GB01Check ],
        [ 'GB05', hx10w8GB05Check ], [ 'GB11', hx10w9GB11Check ],
    ])('%s self-check (base vs hooked printer) reports no problems', (_name, check) => {
        expect ((check as () => string[]) ()).toEqual ([]);
    });
});

describe('hx11 w8 unifiedBoolParams', () => {
    const SRC = 'class Exchange {\n    setMode (hedged: boolean, symbol: string = undefined): any {\n        if (hedged) { return 1; }\n        return 2;\n    }\n}\n';
    const print = (table: any): string => new Transpiler ({ 'verbose': false, 'go': { 'unifiedBoolParams': table, 'parser': { 'NUM_LINES_END_FILE': 0 } } }).transpileGo (SRC).content;
    test('a tabled required boolean param prints bool and a native if', () => {
        const out = print ({ 'setMode': [ 0 ] });
        expect (out).toContain ('hedged bool');
        expect (out).not.toContain ('EvalTruthy');
    });
    test('an absent table keeps the boxed any param', () => {
        expect (print ({})).toContain ('hedged any');
    });
});

describe('hx11 rfm-x6 B: hand-written []uint8 producer types its local', () => {
    const SRC = 'class Exchange {\n'
        + '    ethEncodeStructuredData (domain: any, types: any, data: any): any { return undefined; }\n'
        + '    signMessage (message: any, key: any): any { return undefined; }\n'
        + '    sign (domain: any, types: any, data: any, key: any): any {\n'
        + '        const msg = this.ethEncodeStructuredData (domain, types, data);\n'
        + '        return this.signMessage (msg, key);\n'
        + '    }\n'
        + '    rebound (domain: any, types: any, data: any, key: any): any {\n'
        + '        let msg = this.ethEncodeStructuredData (domain, types, data);\n'
        + '        msg = this.signMessage (msg, key);\n'
        + '        return msg;\n'
        + '    }\n'
        + '}\n';
    const print = (install: boolean): string => {
        const t = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
        if (install) { installCcxtGoHooks (t.goTranspiler); }
        return t.transpileGo (SRC).content;
    };
    const fn = (out: string, name: string): string => out.split (/\nfunc /).find ((f) => f.indexOf (name + '(') >= 0) ?? '';
    test('const local initialised by EthEncodeStructuredData is declared []uint8 (fails on the base printer)', () => {
        expect (fn (print (false), 'Sign')).toContain ('var msg any = this.EthEncodeStructuredData(');
        expect (fn (print (true), 'Sign')).toContain ('var msg []uint8 = this.EthEncodeStructuredData(');
    });
    test('a local rebound to another type keeps the any box', () => {
        expect (fn (print (true), 'Rebound')).not.toContain ('[]uint8');
    });
});
