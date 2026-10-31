/**
 * `let [mut] X: Value = self.safe_number2(o, k1, k2, &[] | &[Value::Null])` becomes `Option<f64>` when each use is
 * `X != / == Value::Null`, `X.as_f64() == / != Some(<n>.0)`, `X.clone()` (-> `Value::from(X)`), or a bare `X`
 * as the last arg of `m.insert("k".to_string(), X);` or `self.price_to_precision(<arg>, X)`.
 */
export declare function hx11w9RustNumber2SinkLocalOptionF64R2(content: string): string;
