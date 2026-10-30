/**
 * `let [mut] X: Value = self.safe_integer2|safe_integer_n(.., &[] | &[Value::Null])` becomes
 * `Option<i64>` (`safe_integer2_opt` / `safe_integer_n_opt`) when every later use of `X` is one of:
 *   `X.clone()` -> `Value::from(X)`           `self.iso8601(X)` / `m.insert("k".to_string(), X);` sinks
 *   `X != / == Value::Null` -> `is_some()` / `is_none()`
 *   `X.as_f64() == / != Some(<n>[.0])` -> `X == / != Some(<n>)`
 *   `X = Value::Null | Value::Int(n) | self.safe_integer*(..);` -> `None` / `Some(n)` / `.as_i64()`
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export declare function hx11w9RustInt2IntNLocalOptionI64(content: string): string;
