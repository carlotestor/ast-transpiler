import { Transpiler } from '../src/transpiler';

jest.mock('module',()=>({
    __esModule: true,
    default: jest.fn()
}));

describe('rp05 native nested dict writes on proven Dict parameters', () => {
    let out = '';
    beforeAll(() => {
        const config = { 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } };
        out = new Transpiler(config).transpileRustByPath('./tests/files/input/rp05/ts/src/venue.ts').content;
    });

    test('a Dict parameter takes the native get_mut hop and insert', () => {
        expect(out).toContain('if let Value::Dict(__h0) = &mut params { if let Some(Value::Dict(__h1)) = std::sync::Arc::make_mut(__h0).get_mut("x") { std::sync::Arc::make_mut(__h1).insert("y".to_string(), Value::Int(5)); } }');
    });

    test('one get_mut hop per key, three levels deep', () => {
        expect(out).toContain('if let Value::Dict(__h0) = &mut params { if let Some(Value::Dict(__h1)) = std::sync::Arc::make_mut(__h0).get_mut("a") { if let Some(Value::Dict(__h2)) = std::sync::Arc::make_mut(__h1).get_mut("b") { std::sync::Arc::make_mut(__h2).insert("c".to_string(), Value::Int(8)); } } }');
    });

    test('a checker-proven string hop key is stringified', () => {
        expect(out).toContain('get_mut(&crate::runtime::stringify_param(&code))');
    });

    test('locals are left to the wave-2 text pass (no churn on its output)', () => {
        expect(out).toContain('add_element_to_object(get_value_mut(&mut request, &Value::Str("a".into())), &Value::Str("b".into()), Value::Int(2));');
    });

    test('unproven receivers keep the helpers', () => {
        // `omit` returns its argument: no plain-build proof, so the hop stays.
        expect(out).toContain('add_element_to_object(get_value_mut(&mut response, &Value::Str("a".into())), &Value::Str("b".into()), Value::Int(5));');
        // an `any` key proves no string
        expect(out).toContain('add_element_to_object(get_value_mut(&mut params, &key), &Value::Str("b".into()), Value::Int(1));');
    });

    test('tagged handle fields keep the helpers', () => {
        expect(out).toContain('add_element_to_object(get_value_mut(&mut self.orderbook, &Value::Str("a".into())), &Value::Str("b".into()), Value::Int(6));');
    });
});
