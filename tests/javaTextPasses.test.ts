import * as fs from 'fs';
import * as path from 'path';
import { hx10J01ElementWrites, j01ElementWritesSelfTest } from '../src/java/hx10w2-J01';
import { nativeJavaJ02ElementReads, j02SelfTest } from '../src/java/hx10w2-J02';
import { nativeJavaJ03Family } from '../src/java/hx10w2-J03';
import { nativeJavaJ05, j05FamilySelfTest } from '../src/java/hx10w2-J05';
import { nativeJavaJ06FieldOps, j06SelfTest } from '../src/java/hx10w2-J06';
import { j01wsNativeOps, j01wsSelfTest } from '../src/java/hx10w3-J01';
import { hx10w3J02BalancePuts, j02BalanceSelfTest } from '../src/java/hx10w3-J02';
import { nativeJavaJ04OptionsOps, j04OptionsSelfTest } from '../src/java/hx10w3-J04';
import { nativeJavaJ05DictChains, j05DictChainsSelfTest } from '../src/java/hx10w3-J05';
import { nativeJavaBF02FieldOps, bf02SelfTest } from '../src/java/hx10w4-BF02';
import { hx10w4OJ01OptionsOwner, oj01OptionsSelfTest } from '../src/java/hx10w4-OJ01';
import { nativeJavaJ09SwitchBlobs, j09SelfTest } from '../src/java/hx10w6-J09';
import { j01w7FieldPuts, j01w7FieldPutsSelfTest } from '../src/java/hx10w7-J01';
import { nativeJ05CallReceiverReads, j05CallReceiverSelfTest } from '../src/java/hx10w7-J05';
import { j12AsyncThrows, j12SelfTest } from '../src/java/hx10w7-J12';
import { wsMapReads, wsReadsTest } from '../src/java/hx10w7-OJ06';
import { hx10w10JO01, jo01SelfTest } from '../src/java/hx10w10-JO01';
import { javaRuntimeRoot, setJavaRuntimeRoot } from '../src/java/javaRuntimeRoot';

// Some passes read the hand-written Java runtime (a ccxt checkout's java/lib/...). Point at one when the
// env names it or the known base checkout exists; the runtime-dependent cases are skipped otherwise.
const SEG = [ 'java', 'lib', 'src', 'main', 'java', 'io', 'github', 'ccxt' ];
const candidates = [ process.env.CCXT_JAVA_RUNTIME_ROOT, path.join ('/root/worktrees/hx11-am-java-base-ccxt', ...SEG), path.join ('/root/ccxt', ...SEG) ];
const runtime = candidates.find ((c) => c !== undefined && fs.existsSync (path.join (c, 'BaseExchange.java')));
const withRuntime = runtime !== undefined ? describe : describe.skip;

const cls = (body: string) => `public class Woo extends WooRest\n{\n    public Object m(Object p)\n    {\n${body}\n    }\n}`;
const tail = (s: string) => s.split ('\n').slice (4, -2);

describe ('pure passes (no runtime needed)', () => {
    test ('J03 typed Long add gets the null-guarded native sum; Object operand keeps the helper', () => {
        const input = cls ('        Long a = 1L;\n        Long b = 2L;\n        Object c = Helpers.add(a, b);');
        const out = nativeJavaJ03Family (input);
        expect (tail (out)[2]).toBe ('        Object c = ((a == null || b == null) ? null : (a + b));');
        expect (nativeJavaJ03Family (out)).toBe (out);
        const keep = cls ('        Object a = p;\n        return Helpers.isTrue(a);');
        expect (nativeJavaJ03Family (keep)).toBe (keep);
    });
    test ('J03 String isEqual becomes Objects.equals', () => {
        const out = nativeJavaJ03Family (cls ('        String s = "x";\n        return Helpers.isEqual(s, "y");'));
        expect (out).toContain ('return java.util.Objects.equals(s, "y");');
    });
    test ('J05 objectValues on a Map local, isInstance on a sync catch parameter', () => {
        expect (j05FamilySelfTest ()).toEqual ([]);
        const input = 'public class Bitget extends BitgetRest\n{\n    public Object m(Object response)\n    {\n        Map<String, Object> data = (Map<String, Object>) this.safeDict(response, "markets", new HashMap<String, Object>() {{}});\n        Object markets = Helpers.objectValues(data);\n    }\n}';
        const out = nativeJavaJ05 (input);
        expect (out).toContain ('new java.util.ArrayList<Object>(data.values())');
        expect (nativeJavaJ05 (out)).toBe (out);
        const keep = cls ('        Object data = this.safeDict(p, "markets", null);\n        Object markets = Helpers.objectValues(data);');
        expect (nativeJavaJ05 (keep)).toBe (keep);
    });
    test ('J06 plain base field put/get', () => {
        expect (j06SelfTest ()).toEqual ([]);
        const input = 'public class Woo extends WooApi\n{\n    public Object m(Object o, String s, Object v, Client client)\n    {\n        Helpers.addElementToObject(this.orderbooks, "a", v);\n    }\n}';
        const out = nativeJavaJ06FieldOps (input);
        expect (out).toContain ('this.orderbooks.put("a", v);');
        expect (nativeJavaJ06FieldOps (out)).toBe (out);
        const keep = input.replace ('this.orderbooks', 'this.markets');
        expect (nativeJavaJ06FieldOps (keep)).toBe (keep);
    });
    test ('w3 J05 describe() dict chains', () => {
        expect (j05DictChainsSelfTest ()).toEqual ([]);
        const input = 'public class Woo extends WooRest\n{\n    public Woo()\n    {\n        this.describe = new HashMap<String, Object>() {{\n            put( "urls", new HashMap<String, Object>() {{\n                put( "api", new HashMap<String, Object>() {{\n                    put( "public", "https://x/api" );\n                }} );\n            }} );\n        }};\n    }\n\n    public Object m(Object p)\n    {\n        return Helpers.GetValue(this.urls.get("api"), "public");\n    }\n}';
        const out = nativeJavaJ05DictChains (input);
        expect (out).toContain ('return ((java.util.Map<String, Object>)this.urls.get("api")).get("public");');
        expect (nativeJavaJ05DictChains (out)).toBe (out);
        const keep = input.replace ('this.urls.get("api"), "public"', 'this.urls, "logo"');
        expect (nativeJavaJ05DictChains (keep)).toBe (keep);
    });
    test ('BF02 base field ops', () => {
        expect (bf02SelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (nativeJavaBF02FieldOps (same)).toBe (same);
    });
    test ('J09 switch blobs on a proven Map parameter', () => {
        expect (j09SelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (nativeJavaJ09SwitchBlobs (same)).toBe (same);
    });
    test ('w7 J05 split receiver hoisted into a typed local; other receivers keep the helper', () => {
        expect (j05CallReceiverSelfTest ()).toEqual ([]);
        const split = 'new ArrayList<Object>(Arrays.asList(((String)cookie).split(java.util.regex.Pattern.quote(";"))))';
        const line = `                Object cookieValue = Helpers.GetValue(${split}, 0);`;
        const out = nativeJ05CallReceiverReads (line);
        expect (out).toContain ('Object cookieValue = (0 >= j05parts1.size() ? null : j05parts1.get(0));');
        expect (nativeJ05CallReceiverReads (out)).toBe (out);
        const keep = `        Object a = Helpers.GetValue(new ArrayList<Object>(Arrays.asList(x)), 0);`;
        expect (nativeJ05CallReceiverReads (keep)).toBe (keep);
    });
    test ('J12 async throw becomes failedFuture; the executor overload keeps supplyAsync', () => {
        expect (j12SelfTest ()).toEqual ([]);
        const input = cls ('        return BaseExchange.supplyAsync(() -> { throw new NotSupported("x"); });');
        const out = j12AsyncThrows (input);
        expect (out).toContain ('return java.util.concurrent.CompletableFuture.failedFuture(new NotSupported("x"));');
        expect (j12AsyncThrows (out)).toBe (out);
        const keep = cls ('        return BaseExchange.supplyAsync(() -> { throw new NotSupported("x"); }, this.executor);');
        expect (j12AsyncThrows (keep)).toBe (keep);
    });
    test ('OJ06 ws client map reads', () => {
        expect (wsReadsTest ()).toEqual ([]);
        const input = '        Object subscription = Helpers.GetValue(client.subscriptions, key);';
        const out = wsMapReads (input);
        expect (out).toContain ('(client.subscriptions == null || key == null ? null : client.subscriptions.get(key))');
        expect (wsMapReads (out)).toBe (out);
        const keep = '        Object v = Helpers.GetValue(client.other, key);';
        expect (wsMapReads (keep)).toBe (keep);
    });
    test ('JO01 counter RMW under a monitor becomes nextCounter', () => {
        expect (jo01SelfTest ()).toEqual ([]);
        const input = 'public class Gate extends GateRest\n{\n    public Long requestId()\n    {\n        Long reqid;\n        synchronized (this) {\n        reqid = (Long) this.sum(this.safeInteger(this.options, "reqid", 0), 1);\n        this.options.put("reqid", reqid);\n        }\n        return reqid;\n    }\n}\n';
        const out = hx10w10JO01 (input);
        expect (out).toContain ('Long reqid = this.nextCounter("reqid", 1L);');
        expect (hx10w10JO01 (out)).toBe (out);
        const keep = input.replace ('this.options.put("reqid", reqid)', 'this.options.put("other", reqid)');
        expect (hx10w10JO01 (keep)).toBe (keep);
    });
});

withRuntime ('runtime-table passes', () => {
    beforeAll (() => { setJavaRuntimeRoot (runtime); });
    afterAll (() => { setJavaRuntimeRoot (undefined); });

    test ('javaRuntimeRoot honours the override', () => {
        expect (javaRuntimeRoot ()).toBe (runtime);
    });
    test ('J01 declared Map local put', () => {
        expect (j01ElementWritesSelfTest ()).toEqual ([]);
        const input = cls ('        Map<String, Object> r = new HashMap<String, Object>() {{}};\n        Helpers.addElementToObject(r, "a", "x");');
        const out = hx10J01ElementWrites (input);
        expect (tail (out)[1]).toBe ('        r.put("a", "x");');
        expect (hx10J01ElementWrites (out)).toBe (out);
        const keep = cls ('        Helpers.addElementToObject(p, "a", "x");');
        expect (hx10J01ElementWrites (keep)).toBe (keep);
    });
    test ('J02 declared Map field read', () => {
        expect (j02SelfTest ()).toEqual ([]);
        const input = 'public class zzj02native extends BaseExchange {\n    public Map<String, Object> opts = new HashMap<>();\n    public Object f(Object k) { return Helpers.GetValue(this.opts, "a"); }\n}\n';
        const out = nativeJavaJ02ElementReads (input);
        expect (out).toContain ('return (this.opts == null ? null : this.opts.get("a"))');
        expect (nativeJavaJ02ElementReads (out)).toBe (out);
        const keep = input.replace ('"a")', 'this.hash(k))');
        expect (nativeJavaJ02ElementReads (keep)).toBe (keep);
    });
    test ('w3 J01 ws native ops', () => {
        expect (j01wsSelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (j01wsNativeOps (same)).toBe (same);
    });
    test ('w3 J02 balance puts', () => {
        expect (j02BalanceSelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (hx10w3J02BalancePuts (same)).toBe (same);
    });
    test ('w3 J04 options ops', () => {
        expect (j04OptionsSelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (nativeJavaJ04OptionsOps (same)).toBe (same);
    });
    test ('OJ01 options owner put', () => {
        expect (oj01OptionsSelfTest ()).toEqual ([]);
        const input = 'public class Gemini extends GeminiRest\n{\n    public void setSandboxMode(Object enable)\n    {\n        Helpers.addElementToObject(this.options, "sandboxMode", enable);\n    }\n}\n';
        const out = hx10w4OJ01OptionsOwner (input);
        expect (out).toContain ('this.options.put("sandboxMode", enable);');
        expect (hx10w4OJ01OptionsOwner (out)).toBe (out);
        const keep = input.replace ('"sandboxMode"', 'key');
        expect (hx10w4OJ01OptionsOwner (keep)).toBe (keep);
    });
    test ('w7 J01 field puts', () => {
        expect (j01w7FieldPutsSelfTest ()).toEqual ([]);
        const same = cls ('        return 1;');
        expect (j01w7FieldPuts (same)).toBe (same);
    });
});
