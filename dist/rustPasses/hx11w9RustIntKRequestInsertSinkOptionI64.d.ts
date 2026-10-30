/**
 * `let mut X: Value = self.safe_integer[_k|2](.., &[] | &[Value::Null] | &[Value::Int(n)])` becomes
 * `Option<i64>` (`.as_i64()`: the reader yields `Int` or its default, so the Option is exact) when
 * every later use of `X` in the block is one of:
 *   `X.clone()` -> `Value::from(X)`           `self.iso8601(X)` / `<ident>.insert("k".to_string() | .into(), X);` sinks
 *   `X != / == Value::Null` -> `is_some()` / `is_none()`
 *   `X.as_f64() == / != Some(<n>[.0])` -> `X == / != Some(<n>)`
 *   `X = Value::Null | Value::Int(n) | self.safe_integer*(..);` -> `None` / `Some(n)` / `.as_i64()`
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export declare function hx11w9RustIntKRequestInsertSinkOptionI64(content: string): string;
