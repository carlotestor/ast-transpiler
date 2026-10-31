import { hx11w9RustTimestampLocalOptionI64 as pass } from '../src/rustPasses/hx11w9RustTimestampLocalOptionI64';

const fn = (body: string) => `fn f(&self) {\n${body}\n}`;

test('safe_timestamp_k local with iso8601 / insert / clone sinks narrows to Option<i64>', () => {
    const s = fn([
        '    let mut ts: Value = self.safe_timestamp_k(x.clone(), "time", &[]);',
        '    let a: Value = self.iso8601(ts);',
        '    m.insert("timestamp".to_string(), ts);',
        '    if ts != Value::Null { let b = ts.clone(); }',
    ].join('\n'));
    const out = pass(s);
    expect(out).toContain('let mut ts: Option<i64> = self.safe_timestamp_k_opt(x.clone(), "time", &[]);');
    expect(out).toContain('self.iso8601(Value::from(ts))');
    expect(out).toContain('m.insert("timestamp".to_string(), Value::from(ts));');
    expect(out).toContain('if ts.is_some()');
    expect(out).toContain('Value::from(ts)');
});

test('safe_timestamp2 and safe_timestamp_n narrow with their own twins', () => {
    const s = fn([
        '    let t2: Value = self.safe_timestamp2(x.clone(), Value::Str("a".into()), Value::Str("b".into()), &[]);',
        '    let tn: Value = self.safe_timestamp_n(x.clone(), Value::from(vec![]), &[Value::Null]);',
        '    m.insert("a".to_string(), t2);',
        '    m.insert("b".to_string(), tn);',
    ].join('\n'));
    const out = pass(s);
    expect(out).toContain('let t2: Option<i64> = self.safe_timestamp2_opt(');
    expect(out).toContain('let tn: Option<i64> = self.safe_timestamp_n_opt(');
});

test('any other use keeps the Value local', () => {
    const s = fn([
        '    let ts: Value = self.safe_timestamp_k(x.clone(), "time", &[]);',
        '    let y = self.parse8601(ts);',
    ].join('\n'));
    expect(pass(s)).toBe(s);
});

test('a non-null default keeps the Value local', () => {
    const s = fn([
        '    let ts: Value = self.safe_timestamp_k(x.clone(), "time", &[Value::Int(5)]);',
        '    m.insert("t".to_string(), ts);',
    ].join('\n'));
    expect(pass(s)).toBe(s);
});
