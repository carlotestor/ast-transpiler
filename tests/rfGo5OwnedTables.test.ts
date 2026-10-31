import { Transpiler, installRfGo5OwnedTables } from '../src/transpiler';

// RF-go-5: base-class tables owned by one goroutine print publisher/accessor calls, keyed on the checker-resolved
// declaring class (no per-exchange name list in ccxt).
const t = (install = true) => {
    const x = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (install) { installRfGo5OwnedTables (x.goTranspiler); }
    return x;
};
const SRC = [
    'class BaseExchange {',
    '    baseCurrencies: any = undefined;',
    '    transactions: any = {};',
    '    other: any = undefined;',
    '    mapToSafeMap (d: any) { return d; }',
    '    createSafeDictionary () { return {}; }',
    '    m (x: any, src: BaseExchange, anyOther: any) {',
    '        this.baseCurrencies = this.mapToSafeMap (x);',
    '        this.transactions = this.createSafeDictionary ();',
    '        this.baseCurrencies = src.baseCurrencies;',
    '        this.baseCurrencies = anyOther.baseCurrencies;',
    '        this.other = src.other;',
    '        const y = this.baseCurrencies;',
    '        return y;',
    '    }',
    '}',
    '',
].join ('\n');

describe('RF-go-5 owned base tables', () => {
    test('writes publish, reads use the accessor; other fields untouched', () => {
        const out = t ().transpileGo (SRC).content;
        expect (out).toContain ('this.PublishBaseCurrencies(x)');
        expect (out).toContain ('this.PublishTransactions(map[string]any{})');
        expect (out).toContain ('this.PublishBaseCurrencies(src.BaseCurrenciesTable())');
        expect (out).toContain ('this.PublishBaseCurrencies(anyOther.BaseCurrenciesTable())');
        expect (out).toContain ('var y any = this.BaseCurrenciesTable()');
        expect (out).toContain ('this.Other = src.Other');
    });
    test('fails without the hook (base printer keeps the field writes)', () => {
        const out = t (false).transpileGo (SRC).content;
        expect (out).not.toContain ('Publish');
        expect (out).toContain ('this.BaseCurrencies = this.MapToSafeMap(x)');
    });
    test('same field name on an unrelated class is untouched', () => {
        const src = 'class Other {\n    baseCurrencies: any;\n    m (x: any) {\n        this.baseCurrencies = x;\n    }\n}\n';
        const out = t ().transpileGo (src).content;
        expect (out).toContain ('this.BaseCurrencies = x');
        expect (out).not.toContain ('Publish');
    });
});
