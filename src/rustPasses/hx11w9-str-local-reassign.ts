// hx11 W9 (rust): `safe_string*` locals that are later reassigned, narrowed to `Option<String>`.
// Text pass over the final Rust; complements narrowStrNullLocals, which skips any assigned name.

/**
 * `let mut X: Value = self.safe_string*(obj, key, &[])` that is assigned again, where every
 * assignment is `X = self.safe_string*(..)` (same family, becomes its `_opt` twin),
 * `X = Value::Str("lit".into())` (becomes `Some("lit".to_string())`) or `X = Value::Null`
 * (becomes `None`), and every other use is a null test, an `as_str()` compare or a `Value`
 * operand (re-boxed with `Value::from`). Any other use keeps `Value`.
 */
export function hx11w9StrLocalReassign(content: string): string {
    const OPT: { [k: string]: string } = {
        safe_string: 'safe_string_opt',
        safe_string_k: 'safe_string_k_opt',
        safe_string_lower_k: 'safe_string_lower_k_opt',
        safe_string_upper_k: 'safe_string_upper_k_opt',
    };
    const declRe = /^([ \t]*)let mut ([a-zA-Z_][a-zA-Z0-9_]*): Value = self\.(safe_string[a-z_0-9]*)\(/gm;
    const strKeyRe = /^"(?:[^"\\]|\\.)*"$/;
    const strLitRe = /^Value::Str\(("(?:[^"\\]|\\.)*")\.into\(\)\)$/;
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
    const stmtEndAt = (src: string, from: number): number => {
        let depth = 0;
        for (let k = from; k < src.length; k++) {
            const c = src[k];
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') { depth--; if (depth < 0) return -1; }
            else if (c === ';' && depth === 0) return k;
        }
        return -1;
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
    type Edit = { start: number, end: number, text: string };

    const masked = maskText(content);
    const grown = new Map<number, number>();
    const groups: Array<{ decl: Edit, edits: Edit[] }> = [];
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(masked)) !== null) {
        const fam = m[3];
        const opt = OPT[fam];
        if (opt === undefined) continue;
        const name = m[2];
        const callOpen = m.index + m[0].length - 1;
        const callClose = closeParen(masked, callOpen);
        if (callClose < 0) continue;
        const tail = /^\s*;/.exec(masked.slice(callClose, callClose + 3));
        if (tail === null) continue;
        const stmtEnd = callClose + tail[0].length;
        // A call whose twin gives the same value: only an empty or empty-string default.
        const callEdit = (famName: string, open: number, close: number): Edit | null => {
            const twin = OPT[famName];
            if (twin === undefined) return null;
            const base = open + 1;
            const spans = argSpans(masked.slice(base, close - 1));
            if (spans.length !== 3) return null;
            const keyRaw = content.slice(base + spans[1][0], base + spans[1][1]).trim();
            if (famName.endsWith('_k') && !strKeyRe.test(keyRaw)) return null;
            if (keyRaw.length === 0) return null;
            const defRaw = content.slice(base + spans[2][0], base + spans[2][1]).trim();
            const defMasked = masked.slice(base + spans[2][0], base + spans[2][1]).trim();
            if (!(defMasked === '&[]'
                || /^&\[Value::Str\("\s*"\.into\(\)\)\]$/.test(defMasked))) return null;
            if (defRaw.length === 0) return null;
            const nameAt = open - famName.length;
            return { start: nameAt, end: open, text: twin };
        };
        const declEdit = callEdit(fam, callOpen, callClose);
        if (declEdit === null) continue;
        const end = braceEnd(masked, stmtEnd);
        const body = masked.slice(stmtEnd, end);
        if (new RegExp(`\\b(?:let|for|fn)\\s+(?:mut\\s+)?${name}\\b`).test(body)) continue;
        if (new RegExp(`\\|[^|\\n]*\\b${name}\\b[^|\\n]*\\|`).test(body)) continue;
        const useRe = new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`, 'g');
        const edits: Edit[] = [declEdit];
        let assigned = 0; let ok = true; let u: RegExpExecArray | null;
        while ((u = useRe.exec(body)) !== null) {
            const at = u.index; const abs = stmtEnd + at; const after = body.slice(at + name.length);
            const before = body.slice(0, at);
            let g: RegExpExecArray | null;
            if ((g = /^\s*=(?!=)\s*/.exec(after)) !== null && /(?:^|[;{}])\s*$/.test(before)) {
                // Assignment: only the three forms that map to `Option<String>`.
                const rhsStart = abs + name.length + g[0].length;
                const rhsEnd = stmtEndAt(masked, rhsStart);
                if (rhsEnd < 0) { ok = false; break; }
                const rhsMasked = masked.slice(rhsStart, rhsEnd).trim();
                const rhsRaw = content.slice(rhsStart, rhsEnd).trim();
                let lit: RegExpExecArray | null; let call: RegExpExecArray | null;
                if (rhsMasked === 'Value::Null') {
                    edits.push({ start: rhsStart, end: rhsStart + 'Value::Null'.length, text: 'None' });
                } else if ((lit = strLitRe.exec(rhsRaw)) !== null) {
                    edits.push({ start: rhsStart, end: rhsStart + rhsRaw.length, text: `Some(${lit[1]}.to_string())` });
                } else if ((call = /^self\.(safe_string[a-z_0-9]*)\(/.exec(rhsMasked)) !== null) {
                    const open = rhsStart + call[0].length - 1;
                    const close = closeParen(masked, open);
                    if (close < 0 || masked.slice(close, rhsEnd).trim() !== '') { ok = false; break; }
                    const ce = callEdit(call[1], open, close);
                    if (ce === null) { ok = false; break; }
                    edits.push(ce);
                } else { ok = false; break; }
                assigned++;
                useRe.lastIndex = rhsStart - stmtEnd; // inner uses of the name in the RHS are rewritten below
                continue;
            }
            if ((g = /^\s*(==|!=)\s*Value::Null\b/.exec(after)) !== null && !/[&*]\s*$/.test(before)) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.${g[1] === '==' ? 'is_none' : 'is_some'}()` });
            } else if ((g = /^\.as_str\(\)/.exec(after)) !== null) {
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}.as_deref()` });
            } else if (/(?:[(,\[]\s*&?|(?<![=!<>])=\s)$/.test(before) && !/&\s*mut\s*$/.test(before)
                && (g = /^(\.clone\(\))?(?=\s*[,)\];])/.exec(after)) !== null && !/==\s*$/.test(before)) {
                // The conversion consumes the `Option`: only the last use, outside any loop, may move it.
                const lastUse = !new RegExp(`(?<![A-Za-z0-9_.:])${name}(?![A-Za-z0-9_])`).test(after.slice(g[0].length));
                const inLoop = /\b(?:loop|while|for)\b/.test(body);
                const move = lastUse && !inLoop && !/&\s*$/.test(before);
                edits.push({ start: abs, end: abs + name.length + g[0].length, text: `${name}${move ? '' : '.clone()'}.map(Value::from).unwrap_or(Value::Null)` });
            } else { ok = false; break; }
        }
        if (!ok || assigned === 0) continue;
        const declText = `${m[1]}let mut ${name}: Option<String> = `;
        const all: Edit[] = [{ start: m.index, end: m.index + m[0].length - `self.${fam}(`.length, text: declText }, ...edits];
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
        groups.push({ decl: { start: m.index, end: stmtEnd, text: '' }, edits: all });
    }
    // A use inside another narrowed local's declaration or edit region is left boxed.
    for (let again = true; again;) {
        again = false;
        for (let a = 0; a < groups.length && !again; a++) {
            for (let b = 0; b < groups.length; b++) {
                if (a === b) continue;
                const bEdits = groups[b].edits;
                const bs = groups[b].decl.start; const be = groups[b].decl.end;
                // Uses of `a` that sit within b's declaration statement would be reprinted from original text.
                if (groups[a].edits.some(e => e.start >= bs && e.start < be && e.start !== bs)
                    && bEdits.length > 0) { groups.splice(a, 1); again = true; break; }
            }
        }
    }
    const rewrites: Edit[] = [];
    for (const gr of groups) for (const e of gr.edits) rewrites.push(e);
    if (rewrites.length === 0) return content;
    rewrites.sort((a, b) => a.start - b.start);
    let out = ''; let last = 0;
    for (const r of rewrites) {
        if (r.start < last) continue;
        out += content.slice(last, r.start) + r.text;
        last = r.end;
    }
    out += content.slice(last);
    return out;
}
