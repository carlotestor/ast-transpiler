import { Transpiler } from '../src/transpiler';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

// hx10w6 R12: a prediction venue nests one request map inside another (`{ action: obj }`,
// `this.use (obj, …)`), so the typed-bearer proof admits several escapes there, each boxed
// as a clone; every other tier keeps the single-final-move rule.
describe('prediction-tier multi-escape dict bearers', () => {
    let prediction = '';
    let rest = '';

    beforeAll(() => {
        prediction = transpiler.transpileRustByPath('./tests/files/input/hx10w6r12/ts/src/prediction/venue.ts').content;
        rest = transpiler.transpileRustByPath('./tests/files/input/hx10w6r12/ts/src/venue.ts').content;
    });

    test('a nested builder writes natively and boxes a clone per escape', () => {
        expect(prediction).toContain('let mut orderAction: indexmap::IndexMap<String, Value> = (');
        expect(prediction).toContain('orderAction.insert("orders".into(), Value::from(vec![self.use(params)]));');
        expect(prediction).toContain('self.use(Value::Map(orderAction.clone()))');
        expect(prediction).toContain('m.insert("action".to_string(), Value::Map(orderAction.clone()));');
        expect(prediction).not.toContain('add_element_to_object(&mut orderAction');
        expect(prediction).not.toContain('if let Value::Dict(__d) = &mut orderAction');
    });

    test('a single final move still moves the map', () => {
        expect(prediction).toContain('let mut request: indexmap::IndexMap<String, Value> = (');
        expect(prediction).toContain('request.insert("type".into(), Value::Str("limit".into()));');
        expect(prediction).toContain('return self.use(Value::Map(request));');
    });

    test('a reassigned local keeps the box', () => {
        expect(prediction).toContain('let mut query: Value = Value::Map({');
        expect(prediction).toContain('query = self.extend(query, params);');
    });

    test('a closure capture keeps the box', () => {
        expect(prediction).toContain('let mut seen: Value = Value::Map({');
        expect(prediction).toContain('if let Value::Dict(__d) = &mut seen { std::sync::Arc::make_mut(__d).insert("a".into(), Value::Bool(true)); }');
    });

    test('a shorthand property keeps the box', () => {
        expect(prediction).toContain('let mut inner: Value = Value::Map({');
        expect(prediction).toContain('m.insert("inner".to_string(), inner.clone());');
    });

    test('outside the prediction tier the R01 rule types it: clone before the last use, move at it', () => {
        expect(rest).toContain('let mut orderAction: indexmap::IndexMap<String, Value> = (');
        expect(rest).toContain('self.use(Value::Map(orderAction.clone()))');
        expect(rest).toContain('Value::Map(orderAction));');
    });
});
