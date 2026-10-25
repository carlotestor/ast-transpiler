import { Transpiler } from '../src/transpiler';

let transpiler: Transpiler;

beforeAll(() => {
    transpiler = new Transpiler({ 'verbose': false, 'rust': { 'parser': { 'NUM_LINES_END_FILE': 0 } } });
});

const PRELUDE = 'interface Dictionary<T> { [key: string]: T }\n' +
    'type Dict = Dictionary<any>;\n' +
    'type Str = string | undefined;\n' +
    'interface MarketInterface { id?: string, symbol?: string }\n' +
    'type Market = MarketInterface | undefined;\n' +
    'class Base {\n' +
    '    market (symbol: Str): Market { return undefined; }\n' +
    '    safeString (o: any, k: any, def: any = undefined): any { return undefined; }\n' +
    '    safeDict (o: any, k: any, def: any = undefined): Dict { return {}; }\n' +
    '    parseOrderBook (o: any, s: Str): Dict { return {}; }\n' +
    '    use (x: any): any { return x; }\n' +
    '}\n' +
    'class Venue extends Base {\n';

function rust(body: string): string {
    return transpiler.transpileRust(PRELUDE + body + '}\n').content;
}

// hx10w9 RP04: `x[k] = v` / `k in x` on a typed dict bearer whose key is not a
// checker-proven `string`. The helper stores a non-`Str` key through
// `stringify_simple` — `stringify_param` is that function — and `in_op` only ever
// matches a `Str` key, so both stay exact on the bare `IndexMap`.
describe('hx10w9 RP04 bearer writes with a boxed key', () => {
    test('a computed key writes through stringify_param, no helper, no cow guard', () => {
        const out = rust('    build (values: any[]) {\n'
            + '        const result: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + '            result[value["id"]] = [ value ];\n'
            + '        }\n'
            + '        return result;\n'
            + '    }\n');
        expect(out).toContain('let mut result: indexmap::IndexMap<String, Value> = (');
        expect(out).toContain('result.insert(crate::runtime::stringify_param(&(crate::value::get_value_k(&value, "id"))), Value::from(vec![value]));');
        expect(out).not.toContain('add_element_to_object(&mut result');
        expect(out).not.toContain('if let Value::Dict(__d) = &mut result');
    });

    test('`k in x` on a bearer prints the map lookup behind the helper Str test', () => {
        const out = rust('    has (values: any[]) {\n'
            + '        const result: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + "            if (value['id'] in result) {\n"
            + "                result[value['id']] = value;\n"
            + '            }\n'
            + '        }\n'
            + '        return result;\n'
            + '    }\n');
        expect(out).toContain('let mut result: indexmap::IndexMap<String, Value> = (');
        expect(out).toContain('if (matches!(&crate::value::get_value_k(&value, "id"), Value::Str(__k) if result.contains_key(__k.as_ref()))) {');
        expect(out).toContain('result.insert(crate::runtime::stringify_param(&(crate::value::get_value_k(&value, "id"))), value.clone());');
        expect(out).not.toContain('in_op(&result');
        expect(out).not.toContain('add_element_to_object(&mut result');
    });

    test('a market member key writes natively and numeric keys stringify like the helper', () => {
        const out = rust('    byMarket (parsedOrders: any[]) {\n'
            + '        const marketIds: Dict = {};\n'
            + '        for (let i = 0; i < parsedOrders.length; i++) {\n'
            + '            const parsed = parsedOrders[i];\n'
            + "            const market = this.market (parsed['symbol']);\n"
            + "            if (market['id'] !== undefined) {\n"
            + "                marketIds[market['id']] = true;\n"
            + '            }\n'
            + '        }\n'
            + '        return Object.keys (marketIds);\n'
            + '    }\n');
        expect(out).toContain('let mut marketIds: indexmap::IndexMap<String, Value> = (');
        expect(out).toContain('marketIds.insert(crate::runtime::stringify_param(&(market.as_map().and_then(|__m| __m.get("id")).cloned().unwrap_or(Value::Null))), Value::Bool(true));');
        expect(out).toContain('Value::Array(marketIds.keys().map(|__k| Value::Str(__k.clone().into())).collect())');
        expect(out).not.toContain('add_element_to_object(&mut marketIds');
    });

    test('a numeric key stringifies exactly like the helper', () => {
        const out = rust('    indexed (v: any) {\n'
            + '        const d: Dict = {};\n'
            + '        d[0] = v;\n'
            + '        return d;\n'
            + '    }\n');
        expect(out).toContain('d.insert(crate::runtime::stringify_param(&(Value::Int(0))), v.clone());');
        expect(out).not.toContain('add_element_to_object(&mut d');
    });

    test('Object.keys on a bearer prints the iterators and unlocks the write', () => {
        const out = rust('    keysOf (values: any[]) {\n'
            + '        const seen: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + '            seen[value["id"]] = value;\n'
            + '        }\n'
            + '        return Object.keys (seen);\n'
            + '    }\n');
        expect(out).toContain('let mut seen: indexmap::IndexMap<String, Value> = (');
        expect(out).toContain('seen.insert(crate::runtime::stringify_param(&(crate::value::get_value_k(&value, "id"))), value.clone());');
        expect(out).toContain('Value::Array(seen.keys().map(|__k| Value::Str(__k.clone().into())).collect())');
        expect(out).not.toContain('add_element_to_object(&mut seen');
        expect(out).not.toContain('object_keys(&seen');
    });

    test('a proven-string key keeps the shipped key spelling', () => {
        const out = rust('    keyed (values: any[], key: string) {\n'
            + '        const result: Dict = {};\n'
            + '        result[key] = values;\n'
            + '        return result;\n'
            + '    }\n');
        expect(out).toContain('result.insert(crate::runtime::stringify_param(&key), values.clone());');
    });

    test('a value that reads the receiver still binds first', () => {
        const out = rust('    self (values: any[]) {\n'
            + '        const result: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + '            result[value["id"]] = this.use (result);\n'
            + '        }\n'
            + '        return result;\n'
            + '    }\n');
        expect(out).toContain('{ let __be_tmp = self.use(Value::Map(result.clone())); result.insert(');
        expect(out).not.toContain('add_element_to_object(&mut result');
    });

    test('a receiver whose value can be anything keeps the helper', () => {
        const out = rust('    plain (data: any) {\n'
            + '        let order: any = this.safeDict (data, "order");\n'
            + '        order["id"] = 1;\n'
            + '        return order;\n'
            + '    }\n');
        expect(out).toContain('add_element_to_object(&mut order, &Value::Str("id".into()), Value::Int(1));');
    });

    test('a key with an assignment keeps the helper', () => {
        const out = rust('    assigned (values: any[]) {\n'
            + '        const result: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + '            result[(value["id"] = 1)] = value;\n'
            + '        }\n'
            + '        return result;\n'
            + '    }\n');
        expect(out).toContain('add_element_to_object(&mut result');
    });

    test('a read with a boxed key keeps the boxed local', () => {
        const out = rust('    reader (values: any[]) {\n'
            + '        const result: Dict = {};\n'
            + '        for (let i = 0; i < values.length; i++) {\n'
            + '            const value = values[i];\n'
            + '            result[value["id"]] = value;\n'
            + '        }\n'
            + '        return result[values[0]["id"]];\n'
            + '    }\n');
        expect(out).toContain('let mut result: Value = Value::Map({');
        expect(out).toContain('add_element_to_object(&mut result');
    });
});
