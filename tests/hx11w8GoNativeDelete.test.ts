import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;
beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'go': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const go = (body: string) => transpiler.transpileGo(
    'class E {\n    ohlcvs: any;\n    safeString(a, b, c?): string | undefined { return a; }\n    m(symbol: string, id: string | undefined) {\n' + body + '\n    }\n}').content;

describe('go delete statement', () => {
    test('a map local with a string key and an ohlcvs book delete natively', () => {
        const out = go("const s = 'BTC'; const m = {}; delete m[s]; delete this.ohlcvs[s]['1m'];");
        expect(out).toContain('delete(m, s)');
        expect(out).toContain('delete(this.Ohlcvs[s], "1m")');
        expect(out).not.toContain('Remove(');
    });
    test('a narrowed *string key derefs, an unproven one keeps the helper', () => {
        const narrowed = go("const k = this.safeString({}, 'k'); const m = {}; if (k !== undefined) { delete m[k]; }");
        expect(narrowed).toContain('delete(m, *k)');
        const unproven = go("const k = this.safeString({}, 'k'); const m = {}; delete m[k];");
        expect(unproven).toContain('Remove(m, k)');
    });
    test('any receivers, any keys and delete in expression position keep the helper', () => {
        expect(go('delete this.ohlcvs[id];')).toContain('Remove(');
        expect(go('const m = this.safeString({}, "x"); delete m[symbol];')).toContain('Remove(m, symbol)');
        expect(go('const m = {}; delete m[symbol + "x"];')).toContain('Remove(');
        expect(go('const m = {}; const ok = delete m[symbol];')).toContain('Remove(m, symbol)');
    });
});
