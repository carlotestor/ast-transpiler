// hx11 W9 `rust-str2-local-option-string`: `let [mut] X: Value = self.safe_string2(obj, k1, k2, &[..])`
// narrowed to `Option<String>` through `safe_string2_opt` (same lookup and default rules).
// Uses and sink handling are those of narrowStrNullLocals; default `&[]` or a `Value::Str` literal.

export function hx11w9RustStr2LocalOptionString(content: string): string {
    const opt = 'safe_string2_opt';
    const declRe = /^([ \t]*)let (mut )?([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.(safe_string2)\(/gm;
    const maskText = (src: string): string => {
        let out = ''; let i = 0;
        while (i < src.length) {
            const c = src[i];
            if (c === '/' && src[i + 1] === '/') {
                while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
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
    const closeParen = (src: string, open: number): number => {
        let depth = 0;
        for (let k = open; k < src.length; k++) {
            const c = src[k];
            if (c === '(') depth++;
            else if (c === ')') { depth--; if (depth === 0) return k + 1; }
        }
        return -1;
    };
    const braceEnd = (src: string, from: number): number => {
        let depth = 0;
        for (let k = from; k < src.length; k++) {
            const c = src[k];
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth < 0) return k; }
        }
        return src.length;
    };
    const argSpans = (src: string): Array<[number, number]> => {
        const out: Array<[number, number]> = [];
        let depth = 0; let start = 0;
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') depth--;
            else if (c === ',' && depth === 0) { out.push([start, i]); start = i + 1; }
        }
        out.push([start, src.length]);
        return out;
    };

    const masked = maskText(content);
    const grown = new Map<number, number>();
    const groups: Array<{ decl: { start: number, end: number, text: string }, edits: Array<{ start: number, end: number, text: string }> }> = [];
    const rewrites: Array<{ start: number, end: number, text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const name = m[3];
        const callOpen = m.index + m[0].length - 1;
        const callClose = closeParen(masked, callOpen);
        if (callClose < 0) continue;
        const tail = /^\s*;/.exec(masked.slice(callClose, callClose + 3));
        if (tail === null) continue;
        const stmtEnd = callClose + tail[0].length;
        const base = callOpen + 1;
        const spans = argSpans(masked.slice(base, callClose - 1));
        if (spans.length !== 4) continue;
        const obj = content.slice(base + spans[0][0], base + spans[0][1]).trim();
        const keyRaw = content.slice(base + spans[1][0], base + spans[1][1]).trim() + ', '
            + content.slice(base + spans[2][0], base + spans[2][1]).trim();
        const defRaw = content.slice(base + spans[3][0], base + spans[3][1]).trim();
        if (obj.length === 0 || keyRaw.length === 0) continue;
        // `&[]` yields `None`; a string literal default yields `Some(..)` in both forms.
        if (defRaw !== '&[]' && !/^&\[Value::Str\("(?:[^"\\]|\\.)*"\.into\(\)\)\]$/.test(defRaw)) continue;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`, 'g');
        const edits: Array<{ start: number, end: number, text: string }> = [];
        let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index; const abs = stmtEnd + at; const after = body.slice(at + name.length);
            const before = body.slice(0, at);
            let g: RegExpExecArray | null;
            if ((g = /^\s*(==|!=)\s*Value::Null\b/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.${g[1] === '==' ? 'is_none' : 'is_some'}()` });
            } else if ((g = /^\.as_str\(\)/.exec(after)) !== null) {
                // `Option<String>::as_deref()` is the same `Option<&str>` the boxed `as_str()` gave.
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.as_deref()` });
            } else if (/get_value\(&$/.test(before)
                && (g = /^, &Value::Int\(0\)\)\.as_str\(\) (==|!=) Some\("/.exec(after)) !== null) {
                // First character probe; the char sits in the unmasked text at the same offsets.
                const chPos = abs + name.length + g[0].length;
                const ch = /^([^"\\])"\)/.exec(content.slice(chPos, chPos + 3));
                if (ch === null) { ok = false; break; }
                const probe = `${name}.as_deref().unwrap_or("").starts_with("${ch[1]}")`;
                edits.push({ start: abs - 'get_value(&'.length, end: chPos + ch[0].length, text: g[1] === '==' ? probe : `!${probe}` });
            } else if (/crate::runtime::stringify_param\(&$/.test(before) && /^\)/.test(after)) {
                // The helper prints `null` for `Null` and the text for `Str`: both are `Option<String>` states.
                const from = abs - 'crate::runtime::stringify_param(&'.length;
                edits.push({ start: from, end: abs + name.length + 1, text: `${name}.as_deref().unwrap_or("null").to_string()` });
            } else if (/(?:[(,\[]\s*&?|(?<![=!<>])=\s)$/.test(before) && !/&\s*mut\s*$/.test(before)
                && (g = /^(\.clone\(\))?(?=\s*[,)\];])/.exec(after)) !== null && !/==\s*$/.test(before)) {
                // The conversion consumes the `Option`: only the last use, outside any loop, may move it.
                const lastUse = !new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`).test(after.slice(g[0].length));
                const inLoop = /\b(?:loop|while|for)\b/.test(body);
                const move = lastUse && !inLoop && !/&\s*$/.test(before);
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}${move ? '' : '.clone()'}.map(Value::from).unwrap_or(Value::Null)` });
            } else { ok = false; break; }
        }
        if (!ok || edits.length === 0) continue;
        // A longer line must not newly cross 400 chars, counting growth from earlier locals.
        const declText = `${m[1]}let ${m[2] ?? ''}${name}: Option<String> = self.${opt}(${obj}, ${keyRaw}, ${defRaw});`;
        const all = [{ start: m.index, end: stmtEnd, text: declText }, ...edits];
        const lineGrow = new Map<number, number>();
        for (const e of all) {
            const ls = content.lastIndexOf('\n', e.start) + 1;
            lineGrow.set(ls, (lineGrow.get(ls) ?? 0) + e.text.length - (e.end - e.start));
        }
        let longer = false;
        for (const [ls, grow] of lineGrow) {
            let le = content.indexOf('\n', ls); if (le < 0) le = content.length;
            const cur = le - ls + (grown.get(ls) ?? 0);
            if (cur <= 400 && cur + grow > 400) longer = true;
        }
        if (longer) continue;
        for (const [ls, grow] of lineGrow) grown.set(ls, (grown.get(ls) ?? 0) + grow);
        groups.push({ decl: { start: m.index, end: stmtEnd, text: declText }, edits });
    }
    // A use that sits inside another narrowed local's initializer would be lost when that
    // statement is reprinted from its original text: leave the used local boxed.
    for (let again = true; again;) {
        again = false;
        for (let a = 0; a < groups.length; a++) {
            const hit = groups.some((b, bi) => bi !== a
                && groups[a].edits.some(e => e.start >= b.decl.start && e.start < b.decl.end));
            if (hit) { groups.splice(a, 1); again = true; break; }
        }
    }
    for (const gr of groups) { rewrites.push(gr.decl); for (const e of gr.edits) rewrites.push(e); }
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue; // overlapping: keep the first
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    out += content.slice(last);
    return out;
}
