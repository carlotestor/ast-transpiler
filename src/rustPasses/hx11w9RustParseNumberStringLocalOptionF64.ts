// hx11 W9 (rust): `let X: Value = self.parse_number(<string-proven arg>, &[])` -> `Option<f64>` (`parse_number_opt`).
// Pure text pass. parse_number returns Int unchanged, so the arg must be provably Str/Null (never Int); else keep Value.

/**
 * Arg proofs: `Value::Str(..)` literal, `Precise::string*(..)` (Str/Null), `self.safe_string[_k](.., &[])` (Str/Null),
 * `A[.clone()].map(Value::from).unwrap_or(Value::Null)` with `A: Option<String>` in the same fn.
 * Uses: `X != / == Value::Null`, `X.clone()` (-> `Value::from(X)`), bare `X` as last arg of `m.insert("k".to_string(), X);`.
 */
export function hx11w9RustParseNumberStringLocalOptionF64(content: string): string {
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.parse_number\(/gm;
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
        if (args.length !== 2 || args[1].trim() !== '&[]') continue;
        const arg = args[0].trim();
        const argOpen = arg.indexOf('(');
        const callEnds = (): boolean => argOpen > 0 && closeOf(mask(arg), argOpen) === arg.length;
        let argOk = false;
        let am: RegExpExecArray | null;
        if (/^Value::Str\("(?:[^"\\]|\\.)*"\.into\(\)\)$/.test(arg)) argOk = true;
        else if (/^crate::precise::Precise::string(?:Add|Sub|Mul|Div|DivPrec|Abs|Neg|Min|Max)\(/.test(arg)) argOk = callEnds();
        else if (/^self\.safe_string(?:_k)?\(/.test(arg)) {
            const inner = splitArgs(arg.slice(argOpen + 1, arg.length - 1));
            argOk = callEnds() && inner.length === 3 && inner[2].trim() === '&[]';
        } else if ((am = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\.clone\(\))?\.map\(Value::from\)\.unwrap_or\(Value::Null\)$/.exec(arg)) !== null) {
            const head = content.slice(0, m.index);
            const fnAt = Math.max(head.lastIndexOf('\n    fn '), head.lastIndexOf('\n    pub fn '), head.lastIndexOf('\n    pub async fn '), head.lastIndexOf('\n    async fn '));
            const decls = [...maskedAll.slice(Math.max(fnAt, 0), m.index).matchAll(new RegExp(`\\blet\\s+(?:mut\\s+)?${am[1]}\\s*:\\s*([^=;]+?)\\s*=`, 'g'))];
            argOk = decls.length > 0 && decls[decls.length - 1][1] === 'Option<String>';
        }
        if (!argOk) continue;
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
            } else if (after.startsWith('.clone()')) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e + 8, text: `Value::from(${name})` });
                useRe.lastIndex = e + 8;
                continue;
            } else if ((/\bm\.insert\("[^"\n]*"\.to_string\(\),\s*$/.test(masked.slice(0, s)) && after.startsWith(');'))) {
                uses.push({ start: stmtEnd + s, end: stmtEnd + e, text: `Value::from(${name})` });
                continue;
            } else { ok = false; break; }
            useRe.lastIndex = e + g[0].length;
        }
        if (!ok) continue;
        rewrites.push({
            start: m.index,
            end: callOpen,
            text: content.slice(m.index, callOpen).replace(': Value =', ': Option<f64> =').replace('parse_number', 'parse_number_opt'),
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
