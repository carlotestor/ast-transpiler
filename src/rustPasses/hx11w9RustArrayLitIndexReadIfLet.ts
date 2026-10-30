// hx11 W9 (rust): literal-index array reads print a closure-free `if let` (the `|__arr|` closure was a blob).
// Pure text pass over the final Rust; idempotent (the rewritten text holds no `|__arr|`).

/**
 * `X.as_array().and_then(|__arr| __arr.get(N)).cloned().unwrap_or(Value::Null)` with N an integer literal
 * and X a side-effect-free place path becomes
 * `(if let Some(__arr) = X.as_array() { __arr.get(N).cloned().unwrap_or(Value::Null) } else { Value::Null })`.
 * A non-array X and an out-of-range N stay Null as before. A rewrite that would push a line over 400 chars is skipped.
 */
export function hx11w9RustArrayLitIndexReadIfLet(content: string): string {
    if (!content.includes('|__arr| __arr.get(')) return content;
    const re = /(?<![A-Za-z0-9_.:])([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.as_array\(\)\.and_then\(\|__arr\| __arr\.get\(([0-9]+)\)\)\.cloned\(\)\.unwrap_or\(((?:crate::)?Value::Null)\)/g;
    return content.replace(re, (m: string, x: string, n: string, nul: string, off: number, whole: string) => {
        const text = `(if let Some(__arr) = ${x}.as_array() { __arr.get(${n}).cloned().unwrap_or(${nul}) } else { ${nul} })`;
        const ls = whole.lastIndexOf('\n', off) + 1;
        let le = whole.indexOf('\n', off);
        if (le < 0) le = whole.length;
        const oldLen = le - ls;
        return oldLen <= 400 && oldLen - m.length + text.length > 400 ? m : text;
    });
}
