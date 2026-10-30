/**
 * A literal-backed local whose every write is `Value::Str("lit".into())` and whose every later
 * use is a `format!` slot, `X.as_str()`, `stringify_param(&X)` or a by-value operand becomes a
 * `String`. A by-value operand re-boxes through `Value::from`, which builds the `Value::Str`
 * the literal was. Any other use (`&X`, `&mut`, a closure, a second binding, a write from
 * another expression) keeps `Value`.
 */
export declare function hx11w9RustStrLiteralLocalNativeString(content: string): string;
