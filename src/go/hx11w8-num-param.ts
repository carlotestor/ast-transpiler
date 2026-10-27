// hx11 w8: a required `Num` parameter of an exchange-local method prints `*float64` when every call site
// passes a `*float64`. The printer already proves the same-file sites by their printed Go type; its
// sibling-file (pro/<x>.ts) text proof has no `*float64` form, so `editOrderRequest (…, amount: Num,
// price: Num, …)` stayed `any` and printed IsEqual(amount, nil). This widens that one proof: a sibling
// site passing an identifier that the enclosing method of that file declares `name: Num = undefined`
// (a GetArgFloat64Ptr-bound `*float64`) and never reassigns is a `*float64` too. Everything else fails closed.
import path from 'path';
import { ts } from './tsApi.js';

const NUM_SIGNATURE = /\n {4}(?:(?:override|async|public|private|protected) )*[A-Za-z_$][\w$]* \(([^\n]*)\)(?:: [^\n{]*)? \{/g;

function hx11w8SiblingNumIdentifier (text: string, at: number | undefined, arg: string): boolean {
    const name = /^([A-Za-z_$][\w$]*)$/.exec ((arg ?? '').trim ())?.[1];
    if ((name === undefined) || (at === undefined)) { return false; }
    const head = text.substring (0, at);
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    NUM_SIGNATURE.lastIndex = 0;
    while ((m = NUM_SIGNATURE.exec (head)) !== null) { last = m; }
    if (last === null) { return false; }
    if (!new RegExp ('(?:^|[(,]\\s*)' + name + ': Num = undefined(?:,|$)').test (last[1])) { return false; }
    const body = head.substring (last.index + last[0].length);
    return !new RegExp ('(?<![\\w.$])' + name + '\\s*(?:[-+*/]?=(?!=)|\\+\\+|--)').test (body);
}

export function installHx11w8NumParams (goTranspiler: any) {
    const flag = 'hx11w8NumParamsInstalled';
    if ((goTranspiler === undefined) || (goTranspiler[flag] === true) || (typeof goTranspiler.goParameterCallSitesPassType !== 'function')
        || (typeof goTranspiler.goSameFileCallsOf !== 'function') || (typeof goTranspiler.goTsSrcTree !== 'function')) {
        return;
    }
    goTranspiler[flag] = true;
    const upstream = goTranspiler.goParameterCallSitesPassType;
    goTranspiler.goParameterCallSitesPassType = function (this: any, fn: any, index: number, goType: string) {
        if (upstream.call (this, fn, index, goType)) { return true; }
        if (goType !== '*float64') { return false; }
        const name = fn.name.text;
        for (const call of this.goSameFileCallsOf (fn, name)) {
            const arg = call.arguments?.[index];
            if ((arg === undefined) || (arg.kind === ts.SyntaxKind.SpreadElement) || (this.goPrintedArgType (arg) !== '*float64')) { return false; }
        }
        const tree = this.goTsSrcTree (fn.getSourceFile ());
        if (tree === undefined) { return true; }
        const myClass = this.goEnclosingClassName (fn);
        const myFile = tree.relativeOf.get (path.resolve (fn.getSourceFile ().fileName));
        for (const site of tree.callIndex.get (name) ?? []) {
            if ((site.file === myFile) || !this.goTsSrcFileDerivesFrom (tree, site.file, myClass)) { continue; }
            if (!hx11w8SiblingNumIdentifier (tree.fileText.get (site.file) ?? '', site.at, site.args[index])) { return false; }
        }
        return true;
    };
}
