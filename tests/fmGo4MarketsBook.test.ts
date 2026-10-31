import { Transpiler, installRfGo5OwnedTables } from '../src/transpiler';

// FM-GO4 (was ccxt build/hx10w4-OG02.ts): the market/currency book tables of BaseExchange are plain
// `map[string]any` read through accessors and written through the owner, keyed on the checker-resolved
// declaring class. Reads index the map natively, entry writes hand off to the owner.
const t = (install = true) => {
    const x = new Transpiler ({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
    if (install) { installRfGo5OwnedTables (x.goTranspiler); }
    return x;
};
const PRE = [
    'type Str = string | undefined;',
    'type Dict = {[key: string]: any};',
    'class BaseExchange {',
    '    markets: Dict | undefined;',
    '    markets_by_id: Dict | undefined;',
    '    currencies: Dict = {};',
    '    currencies_by_id: Dict | undefined;',
    '    features: Dict = {};',
    '    mapToSafeMap (d: any): any { return d; }',
    '    createSafeDictionary (): any { return {}; }',
    '    indexBy (a: any, b: string): any { return {}; }',
    '    indexBySafe (a: any, b: string): any { return {}; }',
    '    deepExtend (...a: any[]): any { return {}; }',
    '    setMarketsFromExchange (sourceExchange: any) {',
    '        this.markets = sourceExchange.markets;',
    '        this.currencies_by_id = sourceExchange.currencies_by_id;',
    '    }',
    '}',
    'class Other {',
    '    markets: Dict | undefined;',
    '    m (symbol: string) {',
    '        if (this.markets === undefined) { return 0; }',
    '        this.markets[symbol] = 1;',
    '        return this.markets[symbol];',
    '    }',
    '}',
    '',
].join ('\n');
const go = (body: string, install = true) => t (install).transpileGo (PRE + 'class Test extends BaseExchange {\n' + body + '\n}\n').content;

const BODY = [
    '    reset (values: any) {',
    '        this.markets = undefined;',
    '        this.currencies = this.createSafeDictionary ();',
    '        this.markets = this.mapToSafeMap (this.indexBy (values, \'symbol\'));',
    '        this.currencies_by_id = this.indexBySafe (this.currencies, \'id\');',
    '    }',
    '    read (anyKey: any) {',
    '        const lit = \'x\';',
    '        const symbol = lit + \'y\';',
    '        if (this.markets === undefined) {',
    '            return 1;',
    '        }',
    '        if (this.markets !== undefined && symbol in this.markets) {',
    '            return this.markets[symbol];',
    '        }',
    '        if (anyKey in this.markets) {',
    '            return this.markets[lit];',
    '        }',
    '        const keys = Object.keys (this.currencies);',
    '        return keys;',
    '    }',
    '    write (market: any) {',
    '        const symbol = \'x\';',
    '        this.markets_by_id[symbol] = [ market ];',
    '        const markets = this.markets;',
    '        markets[symbol] = market;',
    '        const other = this.features;',
    '        other[symbol] = market;',
    '    }',
].join ('\n');

describe ('FM-GO4 market/currency book tables', () => {
    test ('writes publish, reads are native on the accessor map', () => {
        const out = go (BODY);
        expect (out).toContain ('this.PublishMarkets(nil)');
        expect (out).toContain ('this.PublishCurrencies(map[string]any{})');
        expect (out).toContain ('this.PublishMarkets(this.IndexBy(values, "symbol"))');
        expect (out).toContain ('this.PublishCurrenciesById(this.IndexBy(this.Currencies(), "id"))');
        expect (out).toContain ('if this.Markets() == nil {');
        expect (out).toContain ('if _, ok := this.Markets()[symbol]; (this.Markets() != nil) && ok {');
        expect (out).toContain ('return this.Markets()[symbol]');
        expect (out).toContain ('InOp(this.Markets(), anyKey)');
        expect (out).toContain ('for k := range this.Currencies() {');
    });
    test ('an entry write, also through a written alias, goes to the owner', () => {
        const out = go (BODY);
        expect (out).toContain ('this.AddMarketsByIdEntry(symbol, []any{market})');
        expect (out).toContain ('this.AddMarketsEntry(symbol, market)');
        expect (out).not.toContain ('var markets');
        expect (out).toContain ('AddElementToObject(other, symbol, market)');
        expect (out).not.toContain ('AddFeaturesEntry');
    });
    test ('a bounded keys loop reads the book with the in-range element', () => {
        const body = [
            '    walk () {',
            '        if (this.markets === undefined) {',
            '            return;',
            '        }',
            '        const marketKeys = Object.keys (this.markets);',
            '        for (let i = 0; i < marketKeys.length; i++) {',
            '            this.one (this.markets[marketKeys[i]]);',
            '        }',
            '    }',
            '    one (m: any) {',
            '        return m;',
            '    }',
        ].join ('\n');
        const out = go (body);
        expect (out).toContain ('this.One(this.Markets()[marketKeys[i]])');
        expect (go (body, false)).not.toContain ('this.Markets()');
    });
    test ('a || chain of nil-guarded memberships hoists one flag per table', () => {
        const body = [
            '    known () {',
            '        const symbol = \'x\';',
            '        if (((this.markets !== undefined) && (symbol in this.markets)) || ((this.markets_by_id !== undefined) && (symbol in this.markets_by_id))) {',
            '            return 1;',
            '        }',
            '        return 0;',
            '    }',
        ].join ('\n');
        const out = go (body);
        expect (out).toContain ('_, inMarkets := this.Markets()[symbol]');
        expect (out).toContain ('_, inMarketsById := this.Markets_by_id()[symbol]');
        expect (out).toContain ('if inMarkets || inMarketsById {');
        expect (out).not.toContain ('InOp(');
        expect (go (body, false)).not.toContain ('inMarkets');
    });
    test ('a receiver that is a parameter keeps the plain-map rules off (ICoreExchange has no accessor)', () => {
        const out = go ('    p (exchange: BaseExchange) {\n        if (exchange.markets !== undefined) {\n            return Object.keys (exchange.markets);\n        }\n    }');
        expect (out).not.toContain ('exchange.Markets()');
    });
    test ('another instance passed as any shares its accessor', () => {
        const out = go ('');
        expect (out).toContain ('this.PublishMarkets(sourceExchange.Markets())');
        expect (out).toContain ('this.PublishCurrenciesById(sourceExchange.Currencies_by_id())');
    });
    test ('fails without the hook (base printer keeps the field forms)', () => {
        const out = go (BODY, false);
        expect (out).not.toContain ('Publish');
        expect (out).toContain ('this.Markets = this.MapToSafeMap(');
        expect (out).not.toContain ('this.Markets()');
    });
    test ('the same field name on an unrelated class is untouched', () => {
        const out = t ().transpileGo (PRE).content;
        expect (out).not.toMatch (/func \(this \*Other\)[\s\S]*Markets\(\)/);
        expect (out).not.toContain ('AddMarketsEntry');
    });
});
