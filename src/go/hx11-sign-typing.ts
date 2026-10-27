// hx11: the `api: string[]` parameter of sign/fetch2/request binds through GetArgStringSlice as a
// []string. The printer excludes those positions from GetArg typing; this answers only that case.
import { ts } from './tsApi.js';

const SIGN_API_METHODS: { [name: string]: number } = { 'sign': 1, 'fetch2': 1, 'request': 1 };

function signApiParameter (param: any): boolean {
    const SK = ts.SyntaxKind;
    const fn = param?.parent;
    if ((param?.kind !== SK.Parameter) || (fn?.kind !== SK.MethodDeclaration) || (fn.name?.kind !== SK.Identifier)) { return false; }
    if (SIGN_API_METHODS[fn.name.text] !== fn.parameters.indexOf (param)) { return false; }
    if (String (param.type?.getText?.() ?? '').replace (/\s+/g, '') !== 'string[]') { return false; }
    const init = param.initializer;
    return (init?.kind === SK.ArrayLiteralExpression) && (init.elements ?? []).every ((e: any) => e.kind === SK.StringLiteral);
}

function signApiElement (go: any, node: any): boolean {
    const SK = ts.SyntaxKind;
    if ((node?.kind !== SK.ElementAccessExpression) || (node.expression?.kind !== SK.Identifier)
        || (node.argumentExpression?.kind !== SK.NumericLiteral) || !/^\d+$/.test (String (node.argumentExpression.text))) { return false; }
    const decl = go.checkerOrUndefined ()?.getSymbolAtLocation (node.expression)?.valueDeclaration?.resolve ();
    return signApiParameter (decl) && (go.goGetArgParameterType (decl) === '[]string');
}

export function installCcxtGoSignTyping (goTranspiler: any) {
    const flag = 'hx11SignTypingInstalled';
    if (goTranspiler[flag] === true) { return; }
    goTranspiler[flag] = true;
    const printLiteral = goTranspiler.printArrayLiteralExpression;
    goTranspiler.printArrayLiteralExpression = function (this: any, node: any, ...rest: any[]) {
        if (signApiParameter (node?.parent)) { this.goSliceLiteralTypes.set (node, '[]string'); }
        return printLiteral.call (this, node, ...rest);
    };
    // `api[0]` on the typed slice is Go's own bounds-checked index, never the GetValue closure
    const printElement = goTranspiler.printElementAccessExpression;
    goTranspiler.printElementAccessExpression = function (this: any, node: any, ...rest: any[]) {
        if (signApiElement (this, node) && !this.isGoElementAccessAssignmentTarget (node)) {
            return node.expression.text + '[' + node.argumentExpression.text + ']';
        }
        return printElement.call (this, node, ...rest);
    };
    // the element of the typed slice is a Go string, so `const apiName = api[0]` declares a string
    const initType = goTranspiler.goTypeOfInitializer;
    goTranspiler.goTypeOfInitializer = function (this: any, node: any, printed: string) {
        if (signApiElement (this, node)) { return 'string'; }
        return initType.call (this, node, printed);
    };
    const original = goTranspiler.goGetArgParameterType;
    goTranspiler.goGetArgParameterType = function (this: any, decl: any) {
        const answer = original.call (this, decl);
        if ((answer !== undefined) || !signApiParameter (decl)) { return answer; }
        if (!this.goLocalIsSafeToType (decl.parent.body, decl, decl.name.text, '[]string')) { return undefined; }
        return '[]string';
    };
}
