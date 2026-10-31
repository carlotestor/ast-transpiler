/**
 * `let [mut] X: Value = self.safe_timestamp_k|safe_timestamp2|safe_timestamp_n(.., &[] | &[Value::Null])`
 * becomes `Option<i64>` (`safe_timestamp_k_opt` / `safe_timestamp2_opt` / `safe_timestamp_n_opt`) when every
 * later use of `X` is one of:
 *   `X.clone()` -> `Value::from(X)`           `self.iso8601(X)` / `m.insert("k".to_string(), X);` sinks
 *   `X != / == Value::Null` -> `is_some()` / `is_none()`
 *   `X.as_f64() == / != Some(<n>[.0])` -> `X == / != Some(<n>)`
 *   `X = Value::Null | Value::Int(n) | self.safe_timestamp*(..);` -> `None` / `Some(n)` / `.as_i64()`
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export declare function hx11w9RustTimestampLocalOptionI64(content: string): string;
