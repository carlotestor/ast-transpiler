/**
 * `let [mut] X: Value = self.safe_number2(o, k1, k2, &[] | &[Value::Null])` becomes
 * `Option<f64>` when every later use of `X` in the fn is `X != / == Value::Null`
 * (-> `is_some()` / `is_none()`) or `X.as_f64() == / != Some(<n>.0)` (-> `X == / != Some(<n>.0)`).
 * Any other use, or a second binding of the name, keeps `Value`.
 */
export declare function hx11w9RustNumber2LocalOptionF64(content: string): string;
