// hx11 W9 (rust): retry for `safe_number2` locals whose uses include Value sinks (runtime `From<Option<f64>>`).
// Pure text pass; reuses `safe_number2_opt`; default none/Null only. Every other use keeps `Value`.

/**
 * `let [mut] X: Value = self.safe_number2(o, k1, k2, &[] | &[Value::Null])` becomes `Option<f64>` when each use is
 * `X != / == Value::Null`, `X.as_f64() == / != Some(<n>.0)`, `X.clone()` (-> `Value::from(X)`), or a bare `X`
 * as the last arg of `m.insert("k".to_string(), X);` or `self.price_to_precision(<arg>, X)`.
 */
export function hx11w9RustNumber2SinkLocalOptionF64R2(content: string): string {
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.safe_number2\(/gm;
    const mask = (src: string): string => {
        let out = ''; let i = 0;
        const blank = (s: string) => s.replace(/[^\n]/g, ' ');
        while (i < src.length) {
            const c = src[i];
            if (c === '/' && src[i + 1] === '/') {
                while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
                continue;
            }
            if (c === '/' && src[i + 1] === '*') {
                const e = src.indexOf('*/', i + 2);
                const stop = e < 0 ? src.length : e + 2;
                out += blank(src.slice(i, stop)); i = stop;
                continue;
            }
            if (c === '"') {
                out += '"'; i++;
                while (i < src.length && src[i] !== '"') {
                    if (src[i] === '\\') { out += '  '; i += 2; continue; }
                    out += src[i] === '\n' ? '\n' : ' ';
                    i++;
                }
                if (i < src.length) { out += '"'; i++; }
                continue;
            }
            out += c; i++;
        }
        return out;
    };
    const maskedAll = mask(content);
    const closeOf = (masked: string, open: number): number => {
        let depth = 0;
        for (let k = open; k < masked.length; k++) {
            if (masked[k] === '(') depth++;
            else if (masked[k] === ')') { depth--; if (depth === 0) return k + 1; }
        }
        return -1;
    };
    const scopeEnd = (masked: string, from: number): number => {
        let depth = 0;
        for (let k = from; k < masked.length; k++) {
            if (masked[k] === '{') depth++;
            else if (masked[k] === '}') { depth--; if (depth < 0) return k; }
        }
        return masked.length;
    };
    const splitArgs = (src: string): string[] => {
        const out: string[] = []; let cur = ''; let depth = 0; let inStr = false; let esc = false;
        for (const c of src) {
            if (inStr) {
                cur += c;
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') { inStr = true; cur += c; continue; }
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') depth--;
            if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        out.push(cur);
        return out;
    };
    type Rw = { start: number, end: number, text: string };
    const rewrites: Rw[] = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(content)) !== null) {
        const name = m[3];
        const callOpen = m.index + m[0].length - 1;
        const callClose = closeOf(maskedAll, callOpen);
        if (callClose < 0 || !/^\s*;/.test(content.slice(callClose, callClose + 3))) continue;
        const stmtEnd = callClose + /^\s*;/.exec(content.slice(callClose, callClose + 3))![0].length;
        const args = splitArgs(content.slice(callOpen + 1, callClose - 1));
        if (args.length !== 4 || !/^&\[\s*(?:Value::Null)?\s*\]$/.test(args[3].trim())) continue;
        const end = scopeEnd(maskedAll, stmtEnd);
        const masked = maskedAll.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(masked)) continue;
        if (new RegExp(`\\blet\\b[^=;\\n]*\\b${name}\\b`).test(masked)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(masked)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.])${name}(?![A-Za-z0-9_])`, 'g');
        const uses: Rw[] = [];
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(masked)) !== null) {
            const s = u.index; const e = s + name.length;
            const after = masked.slice(e);
            let g: RegExpExecArray | null;
            if ((g = /^\s*(!=|==)\s*Value::Null\b/.exec(after)) !== null) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e + g[0].length, text: `${name}.${g[1] === '!=' ? 'is_some' : 'is_none'}()` });
            } else if ((g = /^\.as_f64\(\)\s*(==|!=)\s*Some\((-?\d+\.0)\)/.exec(after)) !== null) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e + g[0].length, text: `${name} ${g[1]} Some(${g[2]})` });
            } else if (after.startsWith('.clone()')) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e + 8, text: `Value::from(${name})` });
                useRe.lastIndex = e + 8;
                continue;
            } else if ((/\bm\.insert\("[^"\n]*"\.to_string\(\),\s*$/.test(masked.slice(0, s)) && after.startsWith(');')) ||
                (/self\.price_to_precision\([^;\n]*,\s*$/.test(masked.slice(0, s)) && after.startsWith(')'))) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e, text: `Value::from(${name})` });
                continue;
            } else { ok = false; break; }
            useRe.lastIndex = e + g[0].length;
        }
        if (!ok) continue;
        rewrites.push({
            start: m.index,
            end: callOpen,
            text: content.slice(m.index, callOpen).replace(': Value =', ': Option<f64> =').replace('safe_number2', 'safe_number2_opt'),
        });
        for (const use of uses) rewrites.push(use);
    }
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start || a.end - b.end);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue;
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    return out + content.slice(last);
}
