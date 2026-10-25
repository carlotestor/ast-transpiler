import fs from 'fs';
import os from 'os';
import path from 'path';
import { Transpiler } from '../src/transpiler';

// hx10w9 GP13: typed array-literal call arguments plus the slice mirror of the string table.
// `[ sym ]` at a `string[]` slot must print `[]string{sym}` (and `len(symbols)` for its length)
// instead of a `[]any{...}` box, and the table may only type a method whose declarations and
// call sites all agree — every other shape keeps the box.

const PRELUDE =
    'type Dict = { [key: string]: any };\n' +
    'type Int = number | undefined;\n' +
    'type Str = string | undefined;\n' +
    'class Exchange {\n' +
    '    async unWatchTradesForSymbols (symbols: string[], params: Dict = {}): Promise<any> {\n' +
    '        return symbols.length;\n' +
    '    }\n' +
    '    async watchOHLCVForSymbols (symbolsAndTimeframes: string[][], since: Int = undefined, params: Dict = {}): Promise<any> {\n' +
    '        return symbolsAndTimeframes.length;\n' +
    '    }\n' +
    '    async unWatchOrderBookForSymbols (symbols: string[], params: Dict = {}): Promise<any> {\n' +
    '        return symbols.length;\n' +
    '    }\n' +
    '}\n';

const TABLE = {
    'unWatchTradesForSymbols': { 0: '[]string' },
    'watchOHLCVForSymbols': { 0: '[][]string' },
};

const config = (sliceTable: any = {}, stringTable: any = {}) => ({
    'verbose': false,
    'go': {
        'parser': { 'NUM_LINES_END_FILE': 0 },
        'unifiedSliceParams': sliceTable,
        'unifiedStringParams': stringTable,
    },
});

function go (ts: string, sliceTable: any = TABLE): string {
    const transpiler = new Transpiler(config(sliceTable));
    return transpiler.transpileGo(ts).content;
}

describe('hx10w9 GP13 typed slice arguments and the slice table', () => {
    test('a proven literal at a table slot prints the slice and the native length', () => {
        const ts = PRELUDE +
            'class ex extends Exchange {\n' +
            '    wrapper () {\n' +
            "        const s = 'BTC/USDT';\n" +
            '        return this.unWatchTradesForSymbols ([ s ], {});\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('func (this *Exchange) UnWatchTradesForSymbols(symbols []string');
        expect(out).toContain('unWatchTradesForSymbolsBody(ch chan any, symbols []string');
        expect(out).toContain('ch <- len(symbols)');
        expect(out).not.toContain('unWatchTradesForSymbolsBody(ch chan any, symbols any');
        expect(out).toContain('[]string{s}');
        expect(out).not.toContain('[]any{s}');
    });

    test('a two-dimensional slot prints the nested slice', () => {
        const ts = PRELUDE +
            'class ex extends Exchange {\n' +
            '    wrapper () {\n' +
            "        return this.watchOHLCVForSymbols ([ [ 'BTC/USDT', '1m' ] ], undefined, {});\n" +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('symbolsAndTimeframes [][]string');
        expect(out).toContain('ch <- len(symbolsAndTimeframes)');
        expect(out).toContain('[][]string{[]string{"BTC/USDT", "1m"}}');
    });

    test('a method outside the table keeps the box and the helper', () => {
        const ts = PRELUDE +
            'class ex extends Exchange {\n' +
            '    wrapper () {\n' +
            "        const s = 'BTC/USDT';\n" +
            '        return this.unWatchOrderBookForSymbols ([ s ], {});\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('UnWatchOrderBookForSymbols(symbols any');
        expect(out).toContain('GetArrayLength(symbols)');
        expect(out).not.toContain('[]string{s}');
    });

    test('an unproven literal keeps the whole method boxed', () => {
        const ts = PRELUDE +
            'class ex extends Exchange {\n' +
            '    wrapper (symbol: Str) {\n' +
            '        return this.unWatchTradesForSymbols ([ symbol ], {});\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('UnWatchTradesForSymbols(symbols any');
        expect(out).toContain('[]any{symbol}');
    });

    test('a body that writes another type keeps the box', () => {
        const ts =
            'type Dict = { [key: string]: any };\n' +
            'class Exchange {\n' +
            '    async unWatchTradesForSymbols (symbols: string[], params: Dict = {}): Promise<any> {\n' +
            "        symbols = params['symbols'];\n" +
            '        return symbols.length;\n' +
            '    }\n' +
            '}\n' +
            'class ex extends Exchange {\n' +
            '    wrapper () {\n' +
            "        const s = 'BTC/USDT';\n" +
            '        return this.unWatchTradesForSymbols ([ s ], {});\n' +
            '    }\n' +
            '}\n';
        const out = go(ts);
        expect(out).toContain('UnWatchTradesForSymbols(symbols any');
        expect(out).toContain('[]any{s}');
    });

    // The literal rule is scoped to the table's slots: a venue-local `string[]` parameter keeps
    // the printer's own proof (slice-typed call-site values), so no existing `[]any` slot changes
    // shape and the woo `[]string`-into-`[]any` static response tests keep their box.
    test('a venue-local string[] parameter keeps the printer own proof', () => {
        const ts =
            'type Dict = { [key: string]: any };\n' +
            'class Base {\n' +
            '    raw (x: any): any { return x; }\n' +
            '}\n' +
            'class Test extends Base {\n' +
            '    takeSymbols (symbols: string[]): string[] {\n' +
            '        return symbols;\n' +
            '    }\n' +
            '    run () {\n' +
            "        const s = 'BTC/USDT';\n" +
            '        return this.takeSymbols ([ s ]).length;\n' +
            '    }\n' +
            '}\n';
        const out = go(ts, {});
        expect(out).toContain('TakeSymbols(symbols any)');
        expect(out).toContain('[]any{s}');
    });

    test('the sibling-file proof types the base and prints the caller literal', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hx10-GP13-'));
        try {
            const src = path.join(tmp, 'ts', 'src');
            fs.mkdirSync(path.join(src, 'base'), { recursive: true });
            fs.writeFileSync(path.join(src, 'base', 'Exchange.ts'),
                'type Dict = { [key: string]: any };\n' +
                'export class Exchange {\n' +
                '    async unWatchTradesForSymbols (symbols: string[], params: Dict = {}): Promise<any> {\n' +
                '        return symbols.length;\n' +
                '    }\n' +
                '}\n');
            fs.writeFileSync(path.join(src, 'ex.ts'),
                "import { Exchange, Dict } from './base/Exchange';\n" +
                'export class ex extends Exchange {\n' +
                '    async unWatchTrades (symbol: string, params: Dict = {}) {\n' +
                '        return await this.unWatchTradesForSymbols ([ symbol ], params);\n' +
                '    }\n' +
                '}\n');
            const transpiler = new Transpiler(config(TABLE, { 'unWatchTrades': [ 0 ] }));
            const base = transpiler.transpileGoByPath(path.join(src, 'base', 'Exchange.ts')).content;
            const venue = transpiler.transpileGoByPath(path.join(src, 'ex.ts')).content;
            expect(base).toContain('UnWatchTradesForSymbols(symbols []string');
            expect(base).toContain('ch <- len(symbols)');
            expect(venue).toContain('[]string{symbol}');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    test('a Str argument keeps the base boxed even when the file names a string parameter', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hx10-GP13-str-'));
        try {
            const src = path.join(tmp, 'ts', 'src');
            fs.mkdirSync(path.join(src, 'base'), { recursive: true });
            fs.writeFileSync(path.join(src, 'base', 'Exchange.ts'),
                'type Dict = { [key: string]: any };\n' +
                'type Str = string | undefined;\n' +
                'export class Exchange {\n' +
                '    async unWatchTradesForSymbols (symbols: string[], params: Dict = {}): Promise<any> {\n' +
                '        return symbols.length;\n' +
                '    }\n' +
                '}\n');
            // `symbol` is a nullable parameter here; the same file also carries an unrelated
            // `symbol: string` parameter, which must not prove this argument
            fs.writeFileSync(path.join(src, 'ex.ts'),
                "import { Exchange, Dict } from './base/Exchange';\n" +
                'export class ex extends Exchange {\n' +
                '    async other (symbol: string, params: Dict = {}) {\n' +
                '        return symbol;\n' +
                '    }\n' +
                '    async unWatchTrades (symbol: Str, params: Dict = {}) {\n' +
                '        return await this.unWatchTradesForSymbols ([ symbol ], params);\n' +
                '    }\n' +
                '}\n');
            const transpiler = new Transpiler(config(TABLE));
            const base = transpiler.transpileGoByPath(path.join(src, 'base', 'Exchange.ts')).content;
            const venue = transpiler.transpileGoByPath(path.join(src, 'ex.ts')).content;
            expect(base).toContain('UnWatchTradesForSymbols(symbols any');
            expect(venue).toContain('[]any{symbol}');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    test('a defaulted string parameter proves its element', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hx10-GP13-def-'));
        try {
            const src = path.join(tmp, 'ts', 'src');
            fs.mkdirSync(path.join(src, 'base'), { recursive: true });
            fs.writeFileSync(path.join(src, 'base', 'Exchange.ts'),
                'type Dict = { [key: string]: any };\n' +
                'export class Exchange {\n' +
                '    async watchOHLCVForSymbols (symbolsAndTimeframes: string[][], params: Dict = {}): Promise<any> {\n' +
                '        return symbolsAndTimeframes.length;\n' +
                '    }\n' +
                '}\n');
            fs.writeFileSync(path.join(src, 'ex.ts'),
                "import { Exchange, Dict } from './base/Exchange';\n" +
                'export class ex extends Exchange {\n' +
                '    async watchOHLCV (symbol: string, timeframe = \'1m\', params: Dict = {}) {\n' +
                '        return await this.watchOHLCVForSymbols ([ [ symbol, timeframe ] ], params);\n' +
                '    }\n' +
                '}\n');
            const transpiler = new Transpiler(config(TABLE, { 'watchOHLCV': [ 0 ] }));
            const base = transpiler.transpileGoByPath(path.join(src, 'base', 'Exchange.ts')).content;
            const venue = transpiler.transpileGoByPath(path.join(src, 'ex.ts')).content;
            expect(base).toContain('symbolsAndTimeframes [][]string');
            expect(base).toContain('ch <- len(symbolsAndTimeframes)');
            expect(venue).toContain('[][]string{[]string{symbol, timeframe}}');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
