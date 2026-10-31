/**
 * `let [mut] X: Value = self.safe_integer_product_k|safe_integer_product2|safe_integer_omit_zero(.., &[] | &[Value::Null])`
 * becomes `Option<i64>` (`*_opt` twins) when every later use of `X` is one of:
 *   `X.clone()` -> `Value::from(X)`           `self.iso8601(X)` / `m.insert("k".to_string(), X);` sinks
 *   `X != / == Value::Null` -> `is_some()` / `is_none()`
 *   `X.as_f64() == / != Some(<n>[.0])` -> `X == / != Some(<n>)`
 *   `X = Value::Null | Value::Int(n) | <same-family call with &[]>;` -> `None` / `Some(n)` / `.as_i64()`
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export declare function hx11w9RustIntProductOmitZeroLocalOptionI64(content: string): string;
