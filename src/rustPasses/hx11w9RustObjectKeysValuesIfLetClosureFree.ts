// hx11 W9 (rust): closure-free `Object.keys/values` on a plain place receiver.
// Pure text pass over the final Rust; idempotent (output no longer matches).

/**
 * `Value::Array(X.as_map().map(|__m| BODY).unwrap_or_default())` with BODY the keys or values
 * collect becomes `Value::Array(if let Some(__m) = X.as_map() { BODY } else { Vec::new() })`.
 * X must be a side-effect-free place path not preceded by `[\w.:]`; a rewrite that would push a
 * line over 400 chars is skipped.
 */
export function hx11w9RustObjectKeysValuesIfLetClosureFree(content: string): string {
    const body = '(__m\\.keys\\(\\)\\.map\\(\\|__k\\| Value::Str\\(__k\\.clone\\(\\)\\.into\\(\\)\\)\\)\\.collect\\(\\)|__m\\.values\\(\\)\\.cloned\\(\\)\\.collect\\(\\))';
    const re = new RegExp('(?<![\\w.:])Value::Array\\(([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)\\.as_map\\(\\)\\.map\\(\\|__m\\| ' + body + '\\)\\.unwrap_or_default\\(\\)\\)', 'g');
    return content.replace(re, (m: string, recv: string, inner: string, off: number) => {
        const out = `Value::Array(if let Some(__m) = ${recv}.as_map() { ${inner} } else { Vec::new() })`;
        const ls = content.lastIndexOf('\n', off - 1) + 1;
        let le = content.indexOf('\n', off);
        if (le < 0) le = content.length;
        const lineLen = le - ls;
        if (lineLen - m.length + out.length > 400 && out.length > m.length) return m;
        return out;
    });
}
