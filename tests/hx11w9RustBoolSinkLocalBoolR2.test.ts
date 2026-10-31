import { hx11w9RustBoolSinkLocalBoolR2 as pass } from '../src/rustPasses/index';

const decl = (n: string, d = '&[]') => `    let mut ${n}: Value = self.safe_bool_k(params.clone(), "${n}", ${d});\n`;

describe('hx11w9RustBoolSinkLocalBoolR2', () => {
    test('narrows a Some-default local used after &&', () => {
        const src = 'fn f() {\n' + decl('a') + '    let b: bool = (x != Value::Null) && a.as_bool() == Some(true);\n}\n';
        const out = pass(src);
        expect(out).toContain('let mut a: Option<bool> = self.safe_bool_k_opt(params.clone(), "a", &[]);');
        expect(out).toContain('&& a == Some(true)');
    });
    test('narrows a default-true local to bool', () => {
        const src = 'fn f() {\n' + decl('h', '&[Value::Bool(false)]') + '    if y && h.as_bool() == Some(true) { z(); }\n}\n';
        const out = pass(src);
        expect(out).toContain('let mut h: bool = self.safe_bool_k_opt(params.clone(), "h", &[Value::Bool(false)]).unwrap_or(false);');
        expect(out).toContain('if y && h {');
    });
    test('narrows safe_bool2 and safe_bool_n', () => {
        const src = 'fn f() {\n    let mut t: Value = self.safe_bool2(o.clone(), Value::Str("a".into()), Value::Str("b".into()), &[Value::Bool(false)]);\n'
            + '    let mut c: Value = self.safe_bool_n(o.clone(), Value::from(vec![Value::Str("x".into())]), &[]);\n'
            + '    if p && t.as_bool() == Some(true) && c.as_bool() == Some(true) { z(); }\n}\n';
        const out = pass(src);
        expect(out).toContain('let mut t: bool = self.safe_bool2_opt(');
        expect(out).toContain('let mut c: Option<bool> = self.safe_bool_n_opt(');
    });
    test('keeps Value when a use is not whitelisted', () => {
        const src = 'fn f() {\n' + decl('a') + '    self.go(a.clone());\n}\n';
        expect(pass(src)).toBe(src);
    });
    test('keeps Value for a borrowed use', () => {
        const src = 'fn f() {\n' + decl('a') + '    g(&a.as_bool() == Some(true));\n}\n';
        expect(pass(src)).toBe(src);
    });
});
