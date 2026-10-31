// @ts-nocheck
// RFM-X3 M43: `const d = this.safeDict (c, k[, {}])` / `this.safeDict2 (c, k1, k2[, {}])` locals that the shipped container rules leave
// boxed become `map[string]any` locals read through the typed twin (`this.SafeDictMap`). Folded in from ccxt
// build/hx11-m43-safedict-local.ts; every rule is keyed on the checker-resolved declaration and the TS use positions of the local,
// never on printed text. The printed declaration is `MapTyped (this.SafeDict (..))`, which ccxt's goSafeDictMapReads lowers to the twin.
//   - the accessor's default is the empty literal or again such an accessor (the decoded map or a never-nil default), or absent;
//   - the container is a plain value: no `this` member except the base `options` / `balance` (and `fees` when defaulted) fields, and
//     in a ws file no Client / ArrayCache / OrderBook link in its chain (a cache's own `hashmap` member is the one allowed link);
//   - the local is declared once in its method; every use compiled against the box compiles against the map (rebinding, selector,
//     `Array.isArray`, `switch`, destructuring and comparison with a non-nil operand keep the box);
//   - without a default (the member may be absent, i.e. a nil map) only nil tests, the receiver of a plain `this.safe*` read, a ws
//     element read and the then-branch of an `x !== undefined` guard may use the local.
import { ts } from './tsApi.js';

const GO_DICT_TYPE = 'map[string]any';
const DICT_ACCESSORS = { 'safeDict': 3, 'safeDict2': 4 };
const OWNER_CLASS = 'BaseExchange';
const DEFAULTED_FIELDS = [ 'options', 'balance', 'fees' ];
const NODEFAULT_FIELDS = [ 'options', 'balance' ];

function unwrap (node: any) {
    while ((node?.kind === ts.SyntaxKind.ParenthesizedExpression) || (node?.kind === ts.SyntaxKind.AsExpression)
        || (node?.kind === ts.SyntaxKind.NonNullExpression)) {
        node = node.expression;
    }
    return node;
}

function isNilLiteral (node: any) {
    node = unwrap (node);
    return (node?.kind === ts.SyntaxKind.NullKeyword) || ((node?.kind === ts.SyntaxKind.Identifier) && (node.text === 'undefined'));
}

// `this.safeDict (..)` / `this.safeDict2 (..)`: [call, accessor name, wanted arg count with a default] or undefined
function dictCall (node: any) {
    node = unwrap (node);
    if ((node?.kind !== ts.SyntaxKind.CallExpression) || (node.expression?.kind !== ts.SyntaxKind.PropertyAccessExpression)
        || (node.expression.expression?.kind !== ts.SyntaxKind.ThisKeyword)) {
        return undefined;
    }
    const name = node.expression.name?.text;
    const wanted = DICT_ACCESSORS[name];
    return (wanted === undefined) ? undefined : [ node, name, wanted ];
}

function baseField (go: any, node: any, fields: string[]) {
    node = unwrap (node);
    if ((node?.kind !== ts.SyntaxKind.PropertyAccessExpression) || (node.expression?.kind !== ts.SyntaxKind.ThisKeyword)
        || (fields.indexOf (node.name?.text) < 0)) {
        return false;
    }
    const decl = go.checkerOrUndefined ()?.getSymbolAtLocation (node.name)?.valueDeclaration?.resolve ();
    return (decl?.kind === ts.SyntaxKind.PropertyDeclaration) && (decl.parent?.name?.text === OWNER_CLASS);
}

function mentionsThis (node: any) {
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
        return true;
    }
    let found = false;
    node.forEachChild ((child: any) => {
        found = found || mentionsThis (child);
    });
    return found;
}

// a ws link that is a class instance (Client, ArrayCache, OrderBook, Future)
function isObjectType (go: any, node: any) {
    const checker = go.checkerOrUndefined ();
    const type = checker?.getTypeAtLocation (node);
    if (type === undefined) {
        return false;
    }
    const parts = (type.isUnionType?. ()) ? ts.typeParts (type) : [ type ];
    return parts.some ((t: any) => (t?.getSymbol () !== undefined) && (((t.getSymbol ().flags & ts.SymbolFlags.Class) !== 0)
        || /OrderBook|ArrayCache|Client|Future/.test (checker.typeToString (t))));
}

function plainReceiver (go: any, node: any, ws: boolean, defaulted: boolean) {
    node = unwrap (node);
    if (node === undefined) {
        return false;
    }
    if (mentionsThis (node)) {
        return baseField (go, node, defaulted ? DEFAULTED_FIELDS : NODEFAULT_FIELDS);
    }
    if (!ws) {
        return true;
    }
    for (let cur = node; cur !== undefined; cur = unwrap (cur.expression)) {
        if (isObjectType (go, cur)) {
            // the one class link a ws receiver may name: an ArrayCache's own `hashmap`
            return (cur === node) ? false : ((node.kind === ts.SyntaxKind.PropertyAccessExpression) && (node.name?.text === 'hashmap') && (node.expression === cur));
        }
        if ((cur.kind !== ts.SyntaxKind.PropertyAccessExpression) && (cur.kind !== ts.SyntaxKind.ElementAccessExpression)
            && (cur.kind !== ts.SyntaxKind.CallExpression)) {
            break;
        }
        if (cur.kind === ts.SyntaxKind.CallExpression) {
            break;
        }
    }
    return true;
}

// the accessor call is `container, key[, key2]` plus an optional default that is the empty literal or again such a call
function literalDefaultCall (go: any, call: any, name: string, wanted: number, ws: boolean) {
    const args = call.arguments;
    return (args.length === wanted) && plainReceiver (go, args[0], ws, true) && literalDefault (go, args[wanted - 1], ws);
}

function literalDefault (go: any, node: any, ws: boolean) {
    node = unwrap (node);
    if ((node?.kind === ts.SyntaxKind.ObjectLiteralExpression) && (node.properties.length === 0)) {
        return true;
    }
    const inner = dictCall (node);
    return (inner !== undefined) && literalDefaultCall (go, inner[0], inner[1], inner[2], ws);
}

function topFunction (node: any) {
    let top: any;
    for (let cur = node?.parent; cur !== undefined; cur = cur.parent) {
        switch (cur.kind) {
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
            top = cur;
            break;
        }
    }
    return top;
}

function bindingNamesCount (scope: any, name: string) {
    let count = 0;
    const visit = (n: any) => {
        if (((n.kind === ts.SyntaxKind.VariableDeclaration) || (n.kind === ts.SyntaxKind.Parameter)) && (n.name !== undefined)) {
            count += namesIn (n.name, name);
        }
        n.forEachChild (visit);
    };
    visit (scope);
    return count;
}

function namesIn (pattern: any, name: string): number {
    if (pattern.kind === ts.SyntaxKind.Identifier) {
        return (pattern.text === name) ? 1 : 0;
    }
    let count = 0;
    pattern.forEachChild ((child: any) => {
        if (child.kind === ts.SyntaxKind.BindingElement) {
            count += namesIn (child.name, name);
        }
    });
    return count;
}

function isNilTest (n: any) {
    let cur = n;
    while ((cur.parent?.kind === ts.SyntaxKind.ParenthesizedExpression) || (cur.parent?.kind === ts.SyntaxKind.AsExpression)
        || (cur.parent?.kind === ts.SyntaxKind.NonNullExpression)) {
        cur = cur.parent;
    }
    const p = cur.parent;
    if (p?.kind !== ts.SyntaxKind.BinaryExpression) {
        return false;
    }
    const op = p.operatorToken?.kind;
    if ((op !== ts.SyntaxKind.EqualsEqualsToken) && (op !== ts.SyntaxKind.EqualsEqualsEqualsToken)
        && (op !== ts.SyntaxKind.ExclamationEqualsToken) && (op !== ts.SyntaxKind.ExclamationEqualsEqualsToken)) {
        return false;
    }
    return isNilLiteral ((p.left === cur) ? p.right : p.left);
}

function containsOr (node: any) {
    if ((node.kind === ts.SyntaxKind.BinaryExpression) && (node.operatorToken?.kind === ts.SyntaxKind.BarBarToken)) {
        return true;
    }
    let found = false;
    node.forEachChild ((child: any) => {
        found = found || containsOr (child);
    });
    return found;
}

function hasNotNilTest (cond: any, name: string) {
    let found = false;
    const visit = (n: any) => {
        if ((n.kind === ts.SyntaxKind.BinaryExpression) && ((n.operatorToken?.kind === ts.SyntaxKind.ExclamationEqualsToken)
            || (n.operatorToken?.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken))) {
            const l = unwrap (n.left);
            const r = unwrap (n.right);
            found = found || (((l?.kind === ts.SyntaxKind.Identifier) && (l.text === name) && isNilLiteral (r))
                || ((r?.kind === ts.SyntaxKind.Identifier) && (r.text === name) && isNilLiteral (l)));
        }
        n.forEachChild (visit);
    };
    visit (cond);
    return found;
}

// the use sits in the then-branch of an `if (.. x !== undefined ..)` / `cond ? then : else` (no `||` in the condition), `else if` included
function guardedByNotNil (n: any, name: string) {
    for (let cur = n; cur.parent !== undefined; cur = cur.parent) {
        const p = cur.parent;
        if ((p.kind === ts.SyntaxKind.IfStatement) && (p.thenStatement === cur) && !containsOr (p.expression) && hasNotNilTest (p.expression, name)) {
            return true;
        }
        if ((p.kind === ts.SyntaxKind.ConditionalExpression) && (p.whenTrue === cur) && !containsOr (p.condition) && hasNotNilTest (p.condition, name)) {
            return true;
        }
    }
    return false;
}

const FUNCTION_KINDS = [ ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction ];

// one use of the local: [keepsMap, rebind node or undefined]
function classifyUse (go: any, n: any, name: string, decl: any, accessor: string, ws: boolean, defaulted: boolean) {
    const SK = ts.SyntaxKind;
    let cur = n;
    while ((cur.parent !== undefined) && ((cur.parent.kind === SK.ParenthesizedExpression) || (cur.parent.kind === SK.AsExpression)
        || (cur.parent.kind === SK.NonNullExpression)) && (cur.parent.expression === cur)) {
        cur = cur.parent;
    }
    const p = cur.parent;
    switch (p?.kind) {
    case SK.PropertyAccessExpression:
        // `x.length` prints the argument call GetArrayLength (x); any other member access keeps the box
        return (p.expression === cur) ? ((p.name?.text === 'length') ? [ true, undefined, 'arg' ] : [ false ]) : [ true ];
    case SK.ElementAccessExpression: {
        if (p.expression !== cur) {
            return [ true ];
        }
        const above = p.parent;
        const isWrite = (above?.kind === SK.BinaryExpression) && (above.left === p) && (above.operatorToken.kind >= SK.FirstAssignment)
            && (above.operatorToken.kind <= SK.LastAssignment);
        return [ true, undefined, !isWrite ? 'read' : 'write' ];
    }
    case SK.CallExpression: {
        if (p.expression === cur) {
            return [ false ];
        }
        const callee = p.expression;
        if ((callee?.kind === SK.PropertyAccessExpression) && (callee.expression?.kind === SK.Identifier) && (callee.expression.text === 'Array')
            && (callee.name?.text === 'isArray')) {
            return [ false ];
        }
        const onThis = (callee?.kind === SK.PropertyAccessExpression) && (callee.expression?.kind === SK.ThisKeyword);
        const safeRead = onThis && /^safe[A-Z]/.test (callee.name?.text ?? '') && (p.arguments[0] === cur);
        return [ true, undefined, safeRead ? 'safe' : 'arg' ];
    }
    case SK.BinaryExpression: {
        const op = p.operatorToken.kind;
        if ((op >= SK.FirstAssignment) && (op <= SK.LastAssignment)) {
            if (p.left !== cur) {
                return [ true ];
            }
            if (!defaulted || (op !== SK.EqualsToken)) {
                return [ false ];
            }
            const again = dictCall (p.right);
            const inner = (again !== undefined) ? again[0] : undefined;
            if ((again === undefined) || (again[1] !== accessor) || (p.parent?.kind !== SK.ExpressionStatement) || (p.right !== again[0] && unwrap (p.right) !== again[0])
                || !literalDefaultCall (go, inner, again[1], again[2], ws) || mentionsName (inner, name)) {
                return [ false ];
            }
            return [ true, p ];
        }
        if ((op === SK.EqualsEqualsToken) || (op === SK.EqualsEqualsEqualsToken) || (op === SK.ExclamationEqualsToken)
            || (op === SK.ExclamationEqualsEqualsToken)) {
            return isNilLiteral ((p.left === cur) ? p.right : p.left) ? [ true, undefined, 'nil' ] : [ false ];
        }
        return [ true, undefined, 'arg' ];
    }
    case SK.TypeOfExpression:
    case SK.DeleteExpression:
    case SK.SpreadElement:
    case SK.SwitchStatement:
    case SK.CaseClause:
    case SK.ArrayBindingPattern:
    case SK.ObjectBindingPattern:
        return [ false ];
    case SK.VariableDeclaration:
        return (p.name?.kind === SK.Identifier) ? [ true, undefined, 'arg' ] : [ false ];
    default:
        return [ true, undefined, 'arg' ];
    }
}

function mentionsName (node: any, name: string) {
    // a property name (`this.fees`) is a member, not a reference to the local
    if ((node.kind === ts.SyntaxKind.Identifier) && (node.text === name) && !((node.parent?.kind === ts.SyntaxKind.PropertyAccessExpression) && (node.parent.name === node))) {
        return true;
    }
    let found = false;
    node.forEachChild ((child: any) => {
        found = found || mentionsName (child, name);
    });
    return found;
}

function isFileInScope (declaration: any) {
    const fileName = declaration.getSourceFile?. ()?.fileName;
    const name = (typeof fileName === 'string') ? fileName : '';
    // base class methods (exchange_generated.go), prediction venues and test sources keep the box
    if (/(^|[\\/])ts[\\/]src[\\/](base|prediction|test)[\\/]/.test (name) || /[\\/]prediction[\\/]/.test (name)) {
        return undefined;
    }
    return { 'ws': /[\\/]pro[\\/]/.test (name) };
}

function unboxVerdict (go: any, declaration: any) {
    const SK = ts.SyntaxKind;
    if ((declaration?.kind !== SK.VariableDeclaration) || (declaration.name?.kind !== SK.Identifier)
        || (declaration.parent?.parent?.kind !== SK.VariableStatement) || (declaration.initializer === undefined)) {
        return undefined;
    }
    const found = dictCall (declaration.initializer);
    const file = isFileInScope (declaration);
    if ((found === undefined) || (file === undefined) || (unwrap (declaration.initializer) !== found[0])) {
        return undefined;
    }
    const [ call, accessor, wanted ] = found;
    const statement = declaration.parent.parent;
    // a declaration line that carries a comment (or a `//` inside a literal) keeps its box
    if (statement.getText ().indexOf ('//') >= 0 || go.printTraillingComment (statement, 0) !== '') {
        return undefined;
    }
    const args = call.arguments;
    const defaulted = args.length === wanted;
    if (!defaulted && (args.length !== wanted - 1)) {
        return undefined;
    }
    if (!plainReceiver (go, args[0], file.ws, defaulted) || (defaulted && !literalDefault (go, args[wanted - 1], file.ws))) {
        return undefined;
    }
    const scope = topFunction (declaration);
    const name = declaration.name.text;
    if ((scope === undefined) || (bindingNamesCount (scope, name) !== 1) || go.goTypeNameIsShadowed (scope, GO_DICT_TYPE)) {
        return undefined;
    }
    const rebinds: any[] = [];
    let keeps = true;
    const reads = (n: any) => {
        if (!keeps) {
            return;
        }
        if ((n.kind === SK.Identifier) && (n.text === name) && (n !== declaration.name)
            && !((n.parent?.kind === SK.PropertyAccessExpression) && (n.parent.name === n))
            && !((n.parent?.kind === SK.PropertyAssignment) && (n.parent.name === n))) {
            const [ ok, rebind, role ] = classifyUse (go, n, name, declaration, accessor, file.ws, defaulted);
            if (!ok) {
                keeps = false;
                return;
            }
            if (rebind !== undefined) {
                rebinds.push (rebind);
            } else if (!defaulted) {
                const allowed = guardedByNotNil (n, name) || (role === 'nil') || (role === 'safe') || (file.ws && (role === 'read'));
                if (!allowed) {
                    keeps = false;
                }
            }
            return;
        }
        n.forEachChild (reads);
    };
    scope.forEachChild (reads);
    return keeps ? { rebinds } : undefined;
}

// the typed twin of the accessor (exchange_safe.go SafeDictMap / SafeDict2Map): same member read, answers the map (nil when absent)
function typedRead (go: any, found: any, identation: number) {
    const [ call, accessor ] = found;
    const twin = 'this.' + accessor.charAt (0).toUpperCase () + accessor.slice (1) + 'Map';
    return twin + '(' + call.arguments.map ((arg: any, index: number) => go.printNode (arg, (index === 0) ? identation : 0)).join (', ') + ')';
}

export function installRfmX3SafeDictLocals (goTranspiler: any) {
    if ((goTranspiler === undefined) || goTranspiler.__rfmX3SafeDictInstalled) {
        return;
    }
    if ((typeof goTranspiler.goSafeDictLocalUnbox !== 'function') || (typeof goTranspiler.goSafeDictUnboxValue !== 'function')
        || (typeof goTranspiler.goTypeNameIsShadowed !== 'function')) {
        return;
    }
    goTranspiler.__rfmX3SafeDictInstalled = true;
    const verdicts = new Map<any, any>();
    const verdictOf = (go: any, declaration: any) => {
        if (declaration?.kind !== ts.SyntaxKind.VariableDeclaration) {
            return undefined;
        }
        if (!verdicts.has (declaration)) {
            verdicts.set (declaration, undefined); // in-progress guard
            let verdict;
            try {
                verdict = unboxVerdict (go, declaration);
            } finally {
                verdicts.set (declaration, verdict);
            }
        }
        return verdicts.get (declaration);
    };
    const typeOf = goTranspiler.goSafeDictLocalUnbox;
    const valueOf = goTranspiler.goSafeDictUnboxValue;
    goTranspiler.goSafeDictLocalUnbox = function (declaration: any) {
        const known = typeOf.call (this, declaration);
        if (known !== undefined) {
            return known;
        }
        return (verdictOf (this, declaration) !== undefined) ? GO_DICT_TYPE : undefined;
    };
    goTranspiler.goSafeDictUnboxValue = function (declaration: any, identation: number) {
        if (typeOf.call (this, declaration) === undefined && (verdictOf (this, declaration) !== undefined)) {
            return typedRead (this, dictCall (declaration.initializer), identation);
        }
        return valueOf.call (this, declaration, identation);
    };
    // a pointer-typed local stored into a rule-typed local keeps the helper: it stores the pointee, a native write would store the pointer
    const nativeWrite = goTranspiler.printNativeElementAssignment;
    goTranspiler.printNativeElementAssignment = function (containerNode: any, containerStr: string, keyNode: any, keyStr: string, valueStr: string, compound = false, valueNode?: any) {
        const container = unwrap (containerNode);
        const value = unwrap (valueNode);
        if ((container?.kind === ts.SyntaxKind.Identifier) && (value?.kind === ts.SyntaxKind.Identifier)) {
            const decl = this.checkerOrUndefined ()?.getSymbolAtLocation (container)?.valueDeclaration?.resolve ();
            const valueType = this.goDeclaredTypeOfIdentifier (value);
            if ((decl !== undefined) && (verdictOf (this, decl) !== undefined) && (typeof valueType === 'string') && valueType.startsWith ('*')) {
                return undefined;
            }
        }
        return nativeWrite.call (this, containerNode, containerStr, keyNode, keyStr, valueStr, compound, valueNode);
    };
    // `d = this.safeDict (..)` into a typed local keeps the typed reader on the right
    const printBinary = goTranspiler.printBinaryExpression;
    goTranspiler.printBinaryExpression = function (node: any, identation: number) {
        if ((node?.operatorToken?.kind === ts.SyntaxKind.EqualsToken) && (node.left?.kind === ts.SyntaxKind.Identifier)) {
            const decl = this.checkerOrUndefined ()?.getSymbolAtLocation (node.left)?.valueDeclaration?.resolve ();
            const verdict = (decl !== undefined) ? verdictOf (this, decl) : undefined;
            if ((verdict !== undefined) && (verdict.rebinds.indexOf (node) >= 0)) {
                return this.printNode (node.left, 0) + ' = ' + typedRead (this, dictCall (node.right), identation);
            }
        }
        return printBinary.call (this, node, identation);
    };
}
