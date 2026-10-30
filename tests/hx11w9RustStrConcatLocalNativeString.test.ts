import { hx11w9RustStrConcatLocalNativeString as pass } from '../src/rustPasses/hx11w9RustStrConcatLocalNativeString';

const fn = (body: string) => `pub async fn watch(&mut self, mut symbol: Value) -> Value {\n    let marketId: String = self.safe_string_k_opt(market.clone(), "id", &[]).unwrap_or_default();\n${body}\n}\n`;
const decl = '    let mut topic: Value = Value::Str(format!("{}{}", Value::Str(format!("{}{}", marketId, Value::Str("@".into())).into()), Value::Str("a{b".into())).into());\n';

describe('rust string concat locals print a native String', () => {
    test('String local + literals, boxed at a call arg', () => {
        const out = pass(fn(decl + '    return self.watch_public(topic.clone());'));
        expect(out).toContain('let mut topic: String = format!("{}@a{{b", marketId);');
        expect(out).toContain('self.watch_public(Value::from(topic.clone()))');
    });
    test('a Value operand keeps the box', () => {
        const src = fn('    let mut u: Value = Value::Str(format!("{}{}", other, Value::Str("/".into())).into());\n    return u;');
        expect(pass(src)).toBe(src);
    });
    test('a later write keeps the box', () => {
        const src = fn(decl + '    topic = Value::Null;\n    return topic;');
        expect(pass(src)).toBe(src);
    });
});
