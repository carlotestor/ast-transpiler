import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

// hx10w9 RP02: a `Dict` parameter that only takes map operations and whose every
// call site passes a typed dict bearer prints `&mut IndexMap`, so its writes are
// plain `.insert` instead of a per-site `Arc::make_mut` guard.
describe('owned map parameters', () => {
    let rust = '';

    beforeAll(() => {
        rust = transpiler.transpileRustByPath('./tests/files/input/hx10w9rp02/ts/src/venue.ts').content;
    });

    test('the proven parameter prints a mutable map reference', () => {
        expect(rust).toContain('orderParams: &mut indexmap::IndexMap<String, Value>');
    });

    test('its writes are plain inserts, with no COW guard', () => {
        expect(rust).toContain('orderParams.insert("limit_price".into(), self.omit(params, Value::from(vec![])))');
        expect(rust).toContain('orderParams.insert("order_type".into(), method.clone())');
        const body = rust.slice(rust.indexOf('pub fn orderRequest('), rust.indexOf('pub fn createOrder('));
        expect(body).not.toContain('= &mut orderParams');
        expect(body).not.toContain('add_element_to_object');
    });

    test('the caller passes the bearer by reference', () => {
        expect(rust).toContain('self.orderRequest(Value::Str("create".into()), Value::Map(request), &mut orderParams, &[params])');
        expect(rust).toContain('let mut orderParams: indexmap::IndexMap<String, Value> = (');
    });

    test('publishing the map boxes a clone', () => {
        expect(rust).toContain('insert("params".into(), Value::Map(orderParams.clone()))');
    });

    test('a parameter called with a plain `Value` keeps the box and the guard', () => {
        expect(rust).toContain('pub fn plainOrder(&self, method: Value, request: Value, orderParams: Value');
        expect(rust).toContain('if let Value::Dict(__d) = &mut orderParams');
    });

    test('a read-only parameter keeps its borrowed shadow', () => {
        expect(rust).toContain('let orderParams = orderParams.as_map().unwrap_or(&__orderParams_empty);');
    });
});

describe('owned map parameters: chained writes', () => {
    test('a parameter written through a key chain stays boxed', () => {
        const rust = transpiler.transpileRustByPath('./tests/files/input/hx10w9rp02chain/ts/src/venue.ts').content;
        expect(rust).toContain('pub fn watchMany(&self, request: Value, ids: Value)');
        expect(rust).not.toContain('request: &mut indexmap::IndexMap<String, Value>');
    });
});
