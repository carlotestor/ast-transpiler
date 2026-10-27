import * as passes from '../src/rustPasses/index';
import { hx10w2R03SelfTest } from '../src/rustPasses/hx10w2-R03';
import { r04SelfTest } from '../src/rustPasses/hx10w2-R04';
import { r06SelfTest } from '../src/rustPasses/hx10w2-r06';
import { r01SelfTest } from '../src/rustPasses/hx10w3-R01';
import { hx10R03SelfTest } from '../src/rustPasses/hx10w3-R03';
import { r04CalleeSelfTest } from '../src/rustPasses/hx10w3-R04';
import { r06w3SelfTest } from '../src/rustPasses/hx10w3-R06';
import { r07StringSelfTest } from '../src/rustPasses/hx10w3-R07';
import { r10SelfTest } from '../src/rustPasses/hx10w7-R10';
import { r01W2SelfTest } from '../src/rustPasses/hx10w2-R01';
import { rp02SelfTest } from '../src/rustPasses/hx10w9-RP02';

describe('rust final-text passes (moved from ccxt build/)', () => {
    test('every pass is exported from the package entry', () => {
        for (const name of ['nativeGetValue', 'r02NativeInserts', 'hx10w2R03', 'r04Scalars', 'hx10w2R08', 'r06Push', 'r01TypedLocals',
            'hx10w3R03', 'r04Callee', 'r05FieldChainInserts', 'r06w3Push', 'r07StringNatives', 'r08DictReads', 'bf03PlainDictChains',
            'r10ClientHandle', 'narrowStrSinkLocals', 'narrowStrNullLocals', 'hx11RustSignApiStr']) {
            expect(typeof (passes as any)[name]).toBe('function');
        }
    });
    const selfTests: { [k: string]: () => string[] | number } = {
        hx10w2R03SelfTest, r04SelfTest, r06SelfTest, r01SelfTest, hx10R03SelfTest, r04CalleeSelfTest, r06w3SelfTest, r07StringSelfTest, r10SelfTest,
    };
    for (const [name, fn] of Object.entries(selfTests)) {
        test(`${name} passes`, () => { expect(fn()).toEqual([]); });
    }
    test('r01W2 and RP02 self-tests pass', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        try { expect(r01W2SelfTest()).toBe(0); expect(rp02SelfTest()).toBe(0); } finally { log.mockRestore(); }
    });
    test('narrowStrSinkLocals types a format!-only safe_string local', () => {
        const src = 'pub fn f(&mut self) -> Value {\n    let mut s: Value = self.safe_string_k(x.clone(), "id", &[]);\n    let t: String = format!("a{}", s);\n    return Value::Null;\n}\n';
        expect(passes.narrowStrSinkLocals(src)).toContain('safe_string_k_opt');
    });
    test('hx11RustSignApiStr is idempotent on unrelated text', () => {
        const src = 'fn f() { let x = 1; }\n';
        expect(passes.hx11RustSignApiStr(src)).toBe(src);
    });
});
