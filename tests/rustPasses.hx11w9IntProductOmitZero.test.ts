import { hx11w9RustIntProductOmitZeroLocalOptionI64 as pass } from '../src/rustPasses/index';

const fn = (body: string) => `fn f(&self) {\n${body}\n}`;

describe('hx11w9RustIntProductOmitZeroLocalOptionI64', () => {
    test('product_k local with iso8601 + insert sinks narrows', () => {
        const src = fn([
            '    let mut timestamp: Value = self.safe_integer_product_k(trade.clone(), "timestamp", Value::Int(1000), &[]);',
            '    m.insert("timestamp".to_string(), timestamp.clone());',
            '    m.insert("datetime".to_string(), self.iso8601(timestamp));',
        ].join('\n'));
        const out = pass(src);
        expect(out).toContain('let mut timestamp: Option<i64> = self.safe_integer_product_k_opt(trade.clone(),');
        expect(out).toContain('Value::from(timestamp)');
        expect(out).not.toContain('timestamp.clone()');
    });
    test('product2 and omit_zero narrow, null compare becomes is_some', () => {
        const a = pass(fn('    let mut ts: Value = self.safe_integer_product2(o.clone(), Value::Str("a".into()), Value::Str("b".into()), Value::Float(0.001), &[]);\n    if ts != Value::Null { m.insert("t".to_string(), ts.clone()); }'));
        expect(a).toContain('Option<i64> = self.safe_integer_product2_opt(');
        expect(a).toContain('ts.is_some()');
        const b = pass(fn('    let mut timestamp: Value = self.safe_integer_omit_zero(info.clone(), Value::Str("ts".into()), &[]);\n    m.insert("t".to_string(), timestamp.clone());'));
        expect(b).toContain('Option<i64> = self.safe_integer_omit_zero_opt(');
    });
    test('reassignment from same family call appends as_i64', () => {
        const out = pass(fn('    let mut timestamp: Value = self.safe_integer_omit_zero(a.clone(), Value::Str("t".into()), &[]);\n    timestamp = self.safe_integer_product_k(b.clone(), "t", Value::Float(0.001), &[]);\n    m.insert("t".to_string(), timestamp.clone());'));
        expect(out).toContain('self.safe_integer_product_k(b.clone(), "t", Value::Float(0.001), &[]).as_i64();');
    });
    test('unknown use, non-empty default, other families stay untouched', () => {
        const unknown = fn('    let mut timestamp: Value = self.safe_integer_product_k(a.clone(), "t", Value::Int(1000), &[]);\n    foo(&timestamp);');
        expect(pass(unknown)).toBe(unknown);
        const dflt = fn('    let mut u: Value = self.safe_integer_product_k(a.clone(), "t", Value::Float(0.001), &[self.milliseconds()]);\n    m.insert("t".to_string(), u.clone());');
        expect(pass(dflt)).toBe(dflt);
        const other = fn('    let mut t: Value = self.safe_integer_k(a.clone(), "t", &[]);\n    m.insert("t".to_string(), t.clone());');
        expect(pass(other)).toBe(other);
    });
});
