import { hx11w9RustParseNumberStringLocalOptionF64 as pass } from '../src/rustPasses/index';

const wrap = (body: string) => `    pub async fn f(&self) -> Value {\n${body}\n    }\n`;

describe('hx11w9 parse_number string local -> Option<f64>', () => {
    test('Option<String> arg with insert / clone / null-test sinks narrows', () => {
        const src = wrap([
            '        let mut s: Option<String> = self.safe_string_k_opt(o.clone(), "a", &[]);',
            '        let mut x: Value = self.parse_number(s.clone().map(Value::from).unwrap_or(Value::Null), &[]);',
            '        if (x != Value::Null) { y = x.clone(); }',
            '        m.insert("k".to_string(), x);',
        ].join('\n'));
        const out = pass(src);
        expect(out).toContain('let mut x: Option<f64> = self.parse_number_opt(s.clone().map(Value::from).unwrap_or(Value::Null), &[]);');
        expect(out).toContain('if (x.is_some()) { y = Value::from(x); }');
        expect(out).toContain('m.insert("k".to_string(), Value::from(x));');
        expect(pass(out)).toBe(out);
    });
    test('Precise / literal / safe_string args narrow', () => {
        const src = wrap([
            '        let x: Value = self.parse_number(crate::precise::Precise::stringDiv(&a, &b), &[]);',
            '        m.insert("k".to_string(), x);',
            '        let z: Value = self.parse_number(Value::Str("9".into()), &[]);',
            '        m.insert("j".to_string(), z.clone());',
        ].join('\n'));
        const out = pass(src);
        expect(out).toContain('let x: Option<f64> = self.parse_number_opt(');
        expect(out).toContain('let z: Option<f64> = self.parse_number_opt(');
    });
    test('Int can reach: Value-typed args and params keep Value', () => {
        const src = wrap([
            '        let a: Value = self.safe_number_k(o.clone(), "a", &[]);',
            '        let x: Value = self.parse_number(a.clone(), &[]);',
            '        m.insert("k".to_string(), x);',
            '        let y: Value = self.parse_number(self.number_to_string(a), &[]);',
            '        m.insert("j".to_string(), y);',
            '        let w: Value = self.parse_number(p.clone(), &[]);',
            '        m.insert("i".to_string(), w);',
        ].join('\n'));
        expect(pass(src)).toBe(src);
    });
    test('non-whitelisted use keeps Value', () => {
        const src = wrap([
            '        let x: Value = self.parse_number(Value::Str("1".into()), &[]);',
            '        self.foo(x);',
        ].join('\n'));
        expect(pass(src)).toBe(src);
    });
});
