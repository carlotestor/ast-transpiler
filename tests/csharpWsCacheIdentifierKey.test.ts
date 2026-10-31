import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

// cs/ccxt/base/Exchange.Options.cs declares the ws caches (ohlcvs, trades, tickers, orderbooks,
// bidsasks, fundingRates) as `IDictionary<string, object>`, so an identifier-keyed read prints
// GetValue's null / missing-key tests natively. The build layer answers the key's emitted type.
const config = {
    'verbose': false,
    'csharp': { 'parser': { 'NUM_LINES_END_FILE': 0, 'ELEMENT_ACCESS_WRAPPER_OPEN': 'getValue(', 'ELEMENT_ACCESS_WRAPPER_CLOSE': ')' } }
};

function printed(lines: string, keyType: string): string {
    const source = 'class T {\n    f (symbol: string) {\n' + lines + '\n    }\n}';
    const transpiler = new Transpiler(config);
    (transpiler as any).csharpTranspiler.csharpLocalTypeOf = (node: any) => (node.text === 'symbol' ? keyType : undefined);
    // the build layer's record of the declaration line it printed: `Dictionary<string, object> balances`
    (transpiler as any).csharpTranspiler.csharpPrintedLocalType = (node: any) => (node.text === 'balances' ? 'Dictionary<string, object>' : undefined);
    return transpiler.transpileCSharp(source).content;
}

describe('csharp ws cache identifier-key reads', () => {
    test('a string? key on a ws cache property is a guarded ContainsKey read', () => {
        const out = printed('        return this.ohlcvs[symbol];', 'string?');
        expect(out).toContain('(this.ohlcvs != null && symbol != null && this.ohlcvs.ContainsKey(symbol) ? this.ohlcvs[symbol] : null)');
        expect(out).not.toContain('getValue(this.ohlcvs');
    });

    test('every declared ws cache property reads natively', () => {
        for (const name of [ 'trades', 'tickers', 'orderbooks', 'bidsasks', 'fundingRates' ]) {
            const out = printed('        return this.' + name + '[symbol];', 'string');
            expect(out).toContain('this.' + name + '.ContainsKey(symbol) ? this.' + name + '[symbol] : null');
        }
    });

    test('a string-proven object key on a declared dictionary local carries the helper cast', () => {
        const out = printed('        const balances = {};\n        return balances[symbol];', 'object');
        expect(out).toContain('(balances != null && symbol != null && balances.ContainsKey((string)symbol) ? balances[(string)symbol] : null)');
    });

    test('a key of another type keeps the helper', () => {
        const out = printed('        return this.ohlcvs[symbol];', 'int');
        expect(out).toContain('getValue(this.ohlcvs, symbol)');
    });
});
