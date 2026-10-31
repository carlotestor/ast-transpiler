// @ts-nocheck
// RF-go-5: type-keyed rules folded in from ccxt build/ post-print passes (hx11 refactor).
import { ts } from './tsApi.js';
import { TypeFlags } from 'typescript/unstable/sync';

// ---- owned tables (was build/hx10w7-OG05.ts, build/hx10w4-OG02.ts) -------------------------------
// Rule: a property of the base `Exchange` class that the hand-written Go base keeps in a plain map
// owned by one goroutine (go/v4/exchange.go, go/v4/exchange_markets_book.go). The receiver may be any
// expression whose checker type resolves the property to that declaration. A write statement
// `recv.F = v` prints `recv.PublishF(v)` (`mapToSafeMap(x)` publishes `x`, `createSafeDictionary()`
// publishes an empty map, `undefined` nil), every other read prints the accessor `recv.FTable()`.
//
// FM-GO4 (was build/hx10w4-OG02.ts): the market/currency book is the same shape. Its four tables are
// plain `map[string]any` (`plainMap`) read through `recv.Markets()` & co, so on them
//   - `T === undefined` is the native nil test of the map,
//   - `key in T` and `T[key]` with a Go string key read the map natively,
//   - `Object.keys (T)` bound to a `string[]` local is a range loop over the map,
//   - `T[key] = v` (also through a `const x = this.T` alias that is written) hands the entry to the
//     owner (`recv.AddTEntry(key, v)`) instead of mutating the published snapshot.
const OWNED_TABLES = {
    'baseCurrencies': { 'publish': 'PublishBaseCurrencies', 'read': 'BaseCurrenciesTable' },
    'quoteCurrencies': { 'publish': 'PublishQuoteCurrencies', 'read': 'QuoteCurrenciesTable' },
    'transactions': { 'publish': 'PublishTransactions', 'read': 'TransactionsTable' },
    'markets': { 'publish': 'PublishMarkets', 'read': 'Markets', 'add': 'AddMarketsEntry', 'plainMap': true },
    'markets_by_id': { 'publish': 'PublishMarketsById', 'read': 'Markets_by_id', 'add': 'AddMarketsByIdEntry', 'plainMap': true },
    'currencies': { 'publish': 'PublishCurrencies', 'read': 'Currencies', 'plainMap': true },
    'currencies_by_id': { 'publish': 'PublishCurrenciesById', 'read': 'Currencies_by_id', 'plainMap': true },
};
const OWNER_CLASS = 'BaseExchange';

function unwrap (node: any) {
    const SK = ts.SyntaxKind;
    while ((node !== undefined) && ((node.kind === SK.ParenthesizedExpression) || (node.kind === SK.AsExpression) || (node.kind === SK.NonNullExpression))) {
        node = node.expression;
    }
    return node;
}

function resolvedDeclaration (go: any, node: any) {
    try {
        return go.checkerOrUndefined ()?.getSymbolAtLocation (node)?.valueDeclaration?.resolve ();
    } catch (e) {
        return undefined;
    }
}

function ownedTable (go: any, node: any) {
    const SK = ts.SyntaxKind;
    if ((node?.kind !== SK.PropertyAccessExpression) || !Object.prototype.hasOwnProperty.call (OWNED_TABLES, node.name?.text)) {
        return undefined;
    }
    const decl = resolvedDeclaration (go, node.name);
    if ((decl?.kind !== SK.PropertyDeclaration) || (decl.parent?.name?.text !== OWNER_CLASS)) {
        return undefined;
    }
    return OWNED_TABLES[node.name.text];
}

// `sourceExchange.markets` where `sourceExchange: any` is a parameter of a BaseExchange method: the checker
// is blind to the property, the Go parameter is the *BaseExchange the base method hands in
function blindOwnedTable (go: any, node: any) {
    const SK = ts.SyntaxKind;
    if ((node?.kind !== SK.PropertyAccessExpression) || !Object.prototype.hasOwnProperty.call (OWNED_TABLES, node.name?.text)
        || (node.expression?.kind !== SK.Identifier) || (resolvedDeclaration (go, node.name) !== undefined)) {
        return undefined;
    }
    const decl = resolvedDeclaration (go, node.expression);
    const method = decl?.parent;
    if ((decl?.kind !== SK.Parameter) || (decl.type?.kind !== SK.AnyKeyword) || (method?.kind !== SK.MethodDeclaration)
        || (method.parent?.name?.text !== OWNER_CLASS)) {
        return undefined;
    }
    return OWNED_TABLES[node.name.text];
}

function isWrapperCall (node: any, name: string, args: number) {
    const SK = ts.SyntaxKind;
    return (node?.kind === SK.CallExpression) && (node.expression?.kind === SK.PropertyAccessExpression)
        && (node.expression.expression?.kind === SK.ThisKeyword) && (node.expression.name?.text === name)
        && ((node.arguments?.length ?? 0) <= args);
}

// `Object.keys (T)` over a plain-map table
function ownedKeysCall (go: any, call: any) {
    const SK = ts.SyntaxKind;
    const c = unwrap (call);
    if ((c?.kind !== SK.CallExpression) || (c.arguments?.length !== 1) || (c.expression?.kind !== SK.PropertyAccessExpression)
        || (c.expression.name?.text !== 'keys') || (c.expression.expression?.kind !== SK.Identifier) || (c.expression.expression.text !== 'Object')) {
        return undefined;
    }
    const arg = unwrap (c.arguments[0]);
    const table = ownedTable (go, arg);
    return (table?.plainMap === true) ? { table, arg } : undefined;
}

// `const x = this.T` whose element is later written through x: x is the published snapshot itself, so the
// write has to go to the owner and every use of x reads the accessor (a copy would go stale)
function writtenThrough (fn: any, decl: any) {
    const SK = ts.SyntaxKind;
    let written = false;
    const refersToDecl = (target: any) => {
        const base = unwrap (target);
        return (base?.kind === SK.Identifier) && (base.text === decl.name.text);
    };
    const visit = (n: any) => {
        if (written) {
            return;
        }
        if ((n.kind === SK.BinaryExpression) && (n.operatorToken?.kind === SK.EqualsToken) && (n.left?.kind === SK.ElementAccessExpression)
            && refersToDecl (n.left.expression)) {
            written = true;
            return;
        }
        if ((n.kind === SK.DeleteExpression) && (n.expression?.kind === SK.ElementAccessExpression) && refersToDecl (n.expression.expression)) {
            written = true;
            return;
        }
        n.forEachChild (visit);
    };
    visit (fn);
    return written;
}

// the names of the locals a file initialises from `this.<owned table>`: the cheap syntactic filter in front
// of the checker query, so only a handful of identifiers per file ever reach the checker
const aliasNameCache = new Map<string, Set<string>> ();
function aliasNames (node: any) {
    const SK = ts.SyntaxKind;
    const file = node.getSourceFile?.();
    const key = file?.fileName;
    if ((file === undefined) || (key === undefined)) {
        return new Set<string> ();
    }
    let names = aliasNameCache.get (key);
    if (names === undefined) {
        names = new Set<string> ();
        const visit = (n: any) => {
            if ((n.kind === SK.VariableDeclaration) && (n.name?.kind === SK.Identifier)) {
                const init = unwrap (n.initializer);
                if ((init?.kind === SK.PropertyAccessExpression) && (init.expression?.kind === SK.ThisKeyword)
                    && Object.prototype.hasOwnProperty.call (OWNED_TABLES, init.name?.text)) {
                    names.add (n.name.text);
                }
            }
            n.forEachChild (visit);
        };
        visit (file);
        aliasNameCache.set (key, names);
    }
    return names;
}

function aliasOf (go: any, identifier: any) {
    const SK = ts.SyntaxKind;
    if ((identifier?.kind !== SK.Identifier) || !aliasNames (identifier).has (identifier.text)) {
        return undefined;
    }
    const decl = resolvedDeclaration (go, identifier);
    if ((decl?.kind !== SK.VariableDeclaration) || (decl.name?.kind !== SK.Identifier)) {
        return undefined;
    }
    const init = unwrap (decl.initializer);
    if ((init?.kind !== SK.PropertyAccessExpression) || (init.expression?.kind !== SK.ThisKeyword)) {
        return undefined;
    }
    const table = ownedTable (go, init);
    if ((table?.add === undefined) || (table.plainMap !== true)) {
        return undefined;
    }
    const scope = go.goEnclosingFunction (decl);
    if ((scope === undefined) || !writtenThrough (scope, decl) || go.goLocalIsRebound (scope, decl.name)) {
        return undefined;
    }
    return { table, init };
}

export function installRfGo5OwnedTables (goTranspiler: any) {
    const flag = 'rfGo5OwnedTablesInstalled';
    if (goTranspiler[flag] === true) { return; }
    goTranspiler[flag] = true;
    const SK = ts.SyntaxKind;
    const printAccess = goTranspiler.printPropertyAccessExpression;
    goTranspiler.printPropertyAccessExpression = function (this: any, node: any, identation: number) {
        const table = ownedTable (this, node) ?? blindOwnedTable (this, node);
        if (table !== undefined) {
            return this.printNode (node.expression, 0) + '.' + table.read + '()';
        }
        return printAccess.call (this, node, identation);
    };
    // a use of a written alias reads the accessor, its declaration prints nothing
    const printIdent = goTranspiler.printIdentifier;
    goTranspiler.printIdentifier = function (this: any, node: any) {
        const alias = aliasOf (this, node);
        if (alias !== undefined) {
            return this.printNode (alias.init.expression, 0) + '.' + alias.table.read + '()';
        }
        return printIdent.call (this, node);
    };
    // the declaration of a written alias is not a statement at all: its uses read the accessor
    const isAliasStatement = (go: any, statement: any) => {
        const list = (statement?.kind === SK.FirstStatement) ? statement.declarationList : undefined;
        const decl = list?.declarations?.[0];
        return (list?.declarations?.length === 1) && (decl?.name?.kind === SK.Identifier) && (aliasOf (go, decl.name) !== undefined);
    };
    const withoutAliases = (go: any, statements: any) => {
        const all = Array.from (statements ?? []);
        const kept = all.filter ((s: any) => !isAliasStatement (go, s));
        return (kept.length === all.length) ? undefined : kept;
    };
    const printBlock = goTranspiler.printBlock;
    goTranspiler.printBlock = function (this: any, node: any, identation: number, chainBlock?: boolean) {
        const kept = (node?.statements !== undefined) ? withoutAliases (this, node.statements) : undefined;
        return printBlock.call (this, (kept === undefined) ? node : { 'statements': kept }, identation, chainBlock);
    };
    const printFunctionBody = goTranspiler.printFunctionBody;
    goTranspiler.printFunctionBody = function (this: any, node: any, identation: number, wrapInChannel?: boolean) {
        const kept = (node?.body?.statements !== undefined) ? withoutAliases (this, node.body.statements) : undefined;
        if (kept === undefined) {
            return printFunctionBody.call (this, node, identation, wrapInChannel);
        }
        const body = { 'statements': kept };
        const view = new Proxy (node, {
            get (target: any, key: any) {
                if (key === 'body') {
                    return body;
                }
                const value = Reflect.get (target, key, target);
                return (typeof value === 'function') ? value.bind (target) : value;
            },
        });
        return printFunctionBody.call (this, view, identation, wrapInChannel);
    };
    const printDeclarations = goTranspiler.printVariableDeclarationList;
    goTranspiler.printVariableDeclarationList = function (this: any, node: any, identation: number) {
        const decl = node.declarations?.[0];
        if ((node.declarations?.length === 1) && (decl?.name?.kind === SK.Identifier)) {
            const keys = ownedKeysCall (this, decl.initializer);
            if ((keys !== undefined) && (node.parent?.kind === SK.FirstStatement) && (this.goDeclaredTypeOfIdentifier (decl.name) === '[]string')) {
                const name = this.printNode (decl.name, 0);
                const loopVar = (name === 'k') ? 'k1' : 'k';
                const iden = this.getIden (identation);
                return `${iden}var ${name} []string = nil\n${iden}for ${loopVar} := range ${this.printNode (keys.arg, 0)} {\n${this.getIden (identation + 1)}${name} = append(${name}, ${loopVar})\n${iden}}`;
            }
        }
        return printDeclarations.call (this, node, identation);
    };
    const printBinary = goTranspiler.printBinaryExpression;
    goTranspiler.printBinaryExpression = function (this: any, node: any, identation: number) {
        const statement = (node.parent?.kind === SK.ExpressionStatement);
        const assign = (node.operatorToken?.kind === SK.EqualsToken);
        const table = assign ? ownedTable (this, node.left) : undefined;
        if ((table !== undefined) && statement) {
            const right = node.right;
            let value: string;
            if (isWrapperCall (right, 'createSafeDictionary', 1)) {
                value = 'map[string]any{}';
            } else if (isWrapperCall (right, 'mapToSafeMap', 1) && (right.arguments.length === 1)) {
                value = this.printNode (right.arguments[0], 0);
            } else if (isWrapperCall (right, 'indexBySafe', 2) && (right.arguments.length === 2) && (table.plainMap === true)) {
                // the book tables are plain maps: indexBySafe's sync.Map wrapper has nothing to wrap
                value = 'this.IndexBy(' + right.arguments.map ((a: any) => this.printNode (a, 0).trim ()).join (', ') + ')';
            } else if ((right?.kind === SK.PropertyAccessExpression) && (right.name?.text === node.left.name.text)) {
                // sharing another instance's table (`this.F = other.F`, `other: any` leaves the checker blind): its accessor
                value = this.printNode (right.expression, 0) + '.' + table.read + '()';
            } else {
                value = this.printNode (right, 0);
            }
            return this.printNode (node.left.expression, 0) + '.' + table.publish + '(' + value.trim () + ')';
        }
        if (assign && statement) {
            const left = node.left;
            // `T[key] = v` / `alias[key] = v` hands the entry to the owner
            if (left?.kind === SK.ElementAccessExpression) {
                const base = unwrap (left.expression);
                let target: any;
                if (base?.kind === SK.PropertyAccessExpression) {
                    const owned = ownedTable (this, base);
                    target = ((owned?.add !== undefined) && (owned.plainMap === true)) ? { 'table': owned, 'receiver': base.expression } : undefined;
                } else if (base?.kind === SK.Identifier) {
                    const alias = aliasOf (this, base);
                    target = (alias !== undefined) ? { 'table': alias.table, 'receiver': alias.init.expression } : undefined;
                }
                if (target !== undefined) {
                    const key = this.printNode (left.argumentExpression, 0);
                    const value = this.goWithExprDepth (this.goExprDepth + 1, () => this.printNode (node.right, identation)).trimStart ();
                    return this.printNode (target.receiver, 0) + '.' + target.table.add + '(' + key + ', ' + value + ')';
                }
            }
            // `x = Object.keys (T)`: a range loop appending into x (a `[]string` / `[]any` local), else into a fresh holder
            const keys = ownedKeysCall (this, node.right);
            if ((keys !== undefined) && (left?.kind === SK.Identifier)) {
                const name = this.printNode (left, 0);
                if (name !== 'k') {
                    const declared = this.goDeclaredTypeOfIdentifier (left);
                    const direct = (declared === '[]string') || (declared === '[]any');
                    const holder = direct ? name : 'g04Keys';
                    const iden = this.getIden (identation);
                    const lines = [
                        direct ? `${holder} = nil` : `var ${holder} []string = nil`,
                        `${iden}for k := range ${this.printNode (keys.arg, 0)} {`,
                        `${this.getIden (identation + 1)}${holder} = append(${holder}, k)`,
                        `${iden}}`,
                    ];
                    if (!direct) {
                        lines.push (`${iden}${name} = ${holder}`);
                    }
                    return lines.join ('\n');
                }
            }
        }
        return printBinary.call (this, node, identation);
    };
    // `T === undefined` on a plain-map table is the native nil test of the map
    const containerOperand = goTranspiler.goDeclaredContainerOperand;
    goTranspiler.goDeclaredContainerOperand = function (this: any, node: any) {
        return (ownedTable (this, unwrap (node))?.plainMap === true) ? 'map[string]any' : containerOperand.call (this, node);
    };
    // `T[key]` with a Go string key indexes the map; `key in T` reads it with the two-value form
    const indexableType = goTranspiler.goIndexableTypeOf;
    goTranspiler.goIndexableTypeOf = function (this: any, node: any, printed: string) {
        return (ownedTable (this, unwrap (node))?.plainMap === true) ? 'map[string]any' : indexableType.call (this, node, printed);
    };
    const inOpMapType = goTranspiler.goInOpDictMapType;
    goTranspiler.goInOpDictMapType = function (this: any, dictNode: any, dictText?: string) {
        return (ownedTable (this, unwrap (dictNode))?.plainMap === true) ? 'map[string]any' : inOpMapType.call (this, dictNode, dictText);
    };
}
