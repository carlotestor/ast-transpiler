import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

describe('hx10 R05 native `delete` with a computed key on a proven dict receiver', () => {
    let rest = '';
    let ws = '';
    beforeAll(() => {
        rest = transpiler.transpileRustByPath('./tests/files/input/r05/ts/src/venue.ts').content;
        ws = transpiler.transpileRustByPath('./tests/files/input/r05/ts/src/pro/venue.ts').content;
    });

    test('an element-read key borrows beside the field', () => {
        expect(rest).toContain('if let (Value::Dict(__d), Value::Str(__k)) = (&mut self.tickers, &get_value(&symbols, &i)) { std::sync::Arc::make_mut(__d).shift_remove(__k.as_ref()); }');
        expect(ws).toContain('if let (Value::Dict(__d), Value::Str(__k)) = (&mut self.bidsasks, &get_value(&symbols, &i)) { std::sync::Arc::make_mut(__d).shift_remove(__k.as_ref()); }');
    });

    test('a declared-Dict local is admitted in a ws-capable tier too', () => {
        expect(ws).toContain('if let (Value::Dict(__d), Value::Str(__k)) = (&mut stored, &key) { std::sync::Arc::make_mut(__d).shift_remove(__k.as_ref()); }');
        expect(rest).toContain('if let (Value::Dict(__d), Value::Str(__k)) = (&mut stored, &key) { std::sync::Arc::make_mut(__d).shift_remove(__k.as_ref()); }');
    });

    test('a key that reads the receiver or a non-proven receiver keeps the helper', () => {
        expect(ws).toContain('remove(&mut self.tickers, &self.options.as_map().and_then(|__m| __m.get("x")).cloned().unwrap_or(Value::Null))');
        expect(ws).toContain('remove(&mut client.subscriptions, &messageHash)');
        expect(ws).toContain('remove(&mut subs, &messageHash)');
        expect(ws).toContain('remove(&mut total, &messageHash)');
        expect(ws).toContain('remove(&mut balance, &key)');
        expect(ws).toContain('remove(&mut cache, &key)');
    });
});
