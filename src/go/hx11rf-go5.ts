// @ts-nocheck
// RF-go-5: type-keyed rules folded in from ccxt build/ post-print passes (hx11 refactor).
import { ts } from './tsApi.js';
import { TypeFlags } from 'typescript/unstable/sync';

// ---- owned tables (was build/hx10w7-OG05.ts) -------------------------------------------------
// Rule: a property of the base `Exchange` class that the hand-written Go base keeps in a plain map
// owned by one goroutine (go/v4/exchange.go). The receiver may be any expression whose checker type
// resolves the property to that declaration. A write statement `recv.F = v` prints `recv.PublishF(v)`
// (`mapToSafeMap(x)` publishes `x`, `createSafeDictionary()` publishes an empty map, `undefined` nil),
// every other read prints the accessor `recv.FTable()`.
const OWNED_TABLES = {
    'baseCurrencies': { 'publish': 'PublishBaseCurrencies', 'read': 'BaseCurrenciesTable' },
    'quoteCurrencies': { 'publish': 'PublishQuoteCurrencies', 'read': 'QuoteCurrenciesTable' },
    'transactions': { 'publish': 'PublishTransactions', 'read': 'TransactionsTable' },
};
const OWNER_CLASS = 'BaseExchange';

function ownedTable (go: any, node: any) {
    const SK = ts.SyntaxKind;
    if ((node?.kind !== SK.PropertyAccessExpression) || !Object.prototype.hasOwnProperty.call (OWNED_TABLES, node.name?.text)) {
        return undefined;
    }
    const checker = go.checkerOrUndefined ();
    const decl = checker?.getSymbolAtLocation (node.name)?.valueDeclaration?.resolve ();
    if ((decl?.kind !== SK.PropertyDeclaration) || (decl.parent?.name?.text !== OWNER_CLASS)) {
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

export function installRfGo5OwnedTables (goTranspiler: any) {
    const flag = 'rfGo5OwnedTablesInstalled';
    if (goTranspiler[flag] === true) { return; }
    goTranspiler[flag] = true;
    const printAccess = goTranspiler.printPropertyAccessExpression;
    goTranspiler.printPropertyAccessExpression = function (this: any, node: any, identation: number) {
        const table = ownedTable (this, node);
        if (table !== undefined) {
            return this.printNode (node.expression, 0) + '.' + table.read + '()';
        }
        return printAccess.call (this, node, identation);
    };
    const printBinary = goTranspiler.printBinaryExpression;
    goTranspiler.printBinaryExpression = function (this: any, node: any, identation: number) {
        const SK = ts.SyntaxKind;
        const table = (node.operatorToken?.kind === SK.EqualsToken) ? ownedTable (this, node.left) : undefined;
        if ((table !== undefined) && (node.parent?.kind === SK.ExpressionStatement)) {
            const right = node.right;
            let value: string;
            if (isWrapperCall (right, 'createSafeDictionary', 1)) {
                value = 'map[string]any{}';
            } else if (isWrapperCall (right, 'mapToSafeMap', 1) && (right.arguments.length === 1)) {
                value = this.printNode (right.arguments[0], 0);
            } else if ((right?.kind === SK.PropertyAccessExpression) && (right.name?.text === node.left.name.text)) {
                // sharing another instance's table (`this.F = other.F`, `other: any` leaves the checker blind): its accessor
                value = this.printNode (right.expression, 0) + '.' + table.read + '()';
            } else {
                value = this.printNode (right, 0);
            }
            return this.printNode (node.left.expression, 0) + '.' + table.publish + '(' + value.trim () + ')';
        }
        return printBinary.call (this, node, identation);
    };
}

