// @ts-nocheck
// The `ts` namespace the ported Go hooks read: the TS7 enums, node guards and checker API the generator runs on,
// plus ast-transpiler's TS6-named helpers (ccxt build/csharp-local-types.js `ts`, copied), and the describe()-literal
// url proof `urlsDescribeStringProducer` the Go local typing consumes.
import * as tsAst from 'typescript/unstable/ast';
import * as tsIs from 'typescript/unstable/ast/is';
import * as tsSync from 'typescript/unstable/sync';
import * as astTranspilerUtils from './../tsUtils.js';

let tsApi: any;
export const ts: any = {
    ...tsAst, ...tsIs, ...tsSync, ...astTranspilerUtils,
    // standalone parse (no program) over the generator's API process
    createSourceFile: (fileName: string, text: string) => (tsApi ??= new (tsSync as any).API ({ cwd: process.cwd () })).createSourceFile (fileName, text),
};

const describeOwnLiterals = new WeakMap ();

// `return this.deepExtend (super.describe (), this.describeData ())`: the urls literal then lives
// in a SIBLING method of the same file. Resolve it through a zero-argument `this.<name>()` call
// when the file defines that method exactly once and its body returns an object literal — the
// merge target is the same object the literal would have been, so the value census is unchanged.
// A method defined more than once (or not returning a literal) keeps the local `object`.
function describeOwnLiteralMethodCall (sourceFile, expression) {
    if (expression?.kind !== ts.SyntaxKind.CallExpression
        || expression.expression?.kind !== ts.SyntaxKind.PropertyAccessExpression
        || expression.expression.expression?.kind !== ts.SyntaxKind.ThisKeyword
        || (expression.arguments?.length ?? 0) !== 0) {
        return undefined;
    }
    const name = expression.expression.name?.text;
    if (name === undefined) {
        return undefined;
    }
    const definitions = [];
    const collect = (node) => {
        if (node.kind === ts.SyntaxKind.MethodDeclaration && node.name?.text === name) {
            definitions.push (node);
        }
        node?.forEachChild (collect);
    };
    collect (sourceFile);
    if (definitions.length !== 1) {
        return undefined;
    }
    // the body must be exactly `return <object literal>;` — an early/conditional return or a
    // body that also mutates would make "the literal" ambiguous
    const statements = definitions[0].body?.statements ?? [];
    if (statements.length !== 1 || statements[0].kind !== ts.SyntaxKind.ReturnStatement) {
        return undefined;
    }
    let node = statements[0].expression;
    while (node?.kind === ts.SyntaxKind.ParenthesizedExpression) {
        node = node.expression;
    }
    return (node?.kind === ts.SyntaxKind.ObjectLiteralExpression) ? node : undefined;
}

function ownDescribeLiteral (sourceFile) {
    if (describeOwnLiterals.has (sourceFile)) {
        return describeOwnLiterals.get (sourceFile);
    }
    let literal;
    const visit = (node) => {
        if (node.kind === ts.SyntaxKind.MethodDeclaration && node.name?.text === 'describe') {
            const returned = node.body?.statements?.find ((statement) => statement.kind === ts.SyntaxKind.ReturnStatement);
            let expression = returned?.expression;
            while (expression?.kind === ts.SyntaxKind.ParenthesizedExpression) {
                expression = expression.expression;
            }
            // `return this.deepExtend (super.describe (), {...})` — the literal is the last argument
            if (expression?.kind === ts.SyntaxKind.CallExpression
                && expression.expression?.kind === ts.SyntaxKind.PropertyAccessExpression
                && expression.expression.name?.text === 'deepExtend' && expression.arguments?.length >= 2) {
                expression = expression.arguments[expression.arguments.length - 1];
                while (expression?.kind === ts.SyntaxKind.ParenthesizedExpression) {
                    expression = expression.expression;
                }
            }
            if (expression?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                literal = expression;
            } else {
                // `this.deepExtend (super.describe (), this.describeData ())` — the literal is
                // the sibling method's returned object literal (see describeOwnLiteralMethodCall)
                literal = describeOwnLiteralMethodCall (sourceFile, expression);
            }
        }
        node?.forEachChild (visit);
    };
    visit (sourceFile);
    describeOwnLiterals.set (sourceFile, literal);
    return literal;
}

function describeLiteralKey (property) {
    const name = property.name;
    if (name?.kind === ts.SyntaxKind.StringLiteral || name?.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
        return name.text;
    }
    return name?.kind === ts.SyntaxKind.Identifier ? name.text : undefined;
}

function describeLiteralProperty (literal, key) {
    if (literal?.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
        return undefined;
    }
    for (const property of literal.properties) {
        if (property.kind === ts.SyntaxKind.PropertyAssignment && describeLiteralKey (property) === key) {
            return property.initializer;
        }
    }
    return undefined;
}

// the box a describe() literal value prints as, or undefined when the printer does not print
// it as one of these (a call, an identifier, a spread, ...)
function describeLiteralKind (value) {
    let node = value;
    while (node?.kind === ts.SyntaxKind.ParenthesizedExpression) {
        node = node.expression;
    }
    switch (node?.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        return 'string';
    case ts.SyntaxKind.ObjectLiteralExpression:
        return 'dictionary';
    case ts.SyntaxKind.ArrayLiteralExpression:
        return 'list';
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
        return 'bool';
    case ts.SyntaxKind.NumericLiteral:
        return 'number';
    case ts.SyntaxKind.PrefixUnaryExpression:
        return node.operand?.kind === ts.SyntaxKind.NumericLiteral ? 'number' : undefined;
    case ts.SyntaxKind.NullKeyword:
        return 'null';
    case ts.SyntaxKind.Identifier:
        return node.text === 'undefined' ? 'null' : undefined;
    }
    return undefined;
}

// the kind at an all-literal path inside a describe() literal: 'absent' when the path is not
// spelled (GetValue returns null there), undefined when the path runs into a value with no
// literal kind
function describeLiteralPathKind (literal, keys) {
    let node = literal;
    for (const key of keys) {
        node = describeLiteralProperty (node, key);
        if (node === undefined) {
            return 'absent';
        }
    }
    return describeLiteralKind (node);
}

// `x as Dict` / `x as List` / `x as unknown` / an interface or class assertion print the BARE
// operand (ast-transpiler printAsExpression falls through for every type it does not cast), so
// `(this.urls['api'] as Dict)['ws']` emits exactly the `getValue(getValue(this.urls, "api"), "ws")`
// chain — the read's value box is untouched by the assertion. Only the three spellings that DO
// print a cast (`as any` -> ((object)x), `as string` -> ((string)x), `as any[]` -> (IList<object>)(x))
// keep the chain unreachable here.
function asExpressionPrintsBare (node) {
    const type = node.type;
    if (type === undefined) {
        return false;
    }
    if (type.kind === ts.SyntaxKind.AnyKeyword || type.kind === ts.SyntaxKind.StringKeyword) {
        return false;
    }
    if (type.kind === ts.SyntaxKind.ArrayType && type.elementType?.kind === ts.SyntaxKind.AnyKeyword) {
        return false;
    }
    return true;
}

// the chain of string-literal keys of `this.urls[k1][k2]...`, or undefined. A dynamic key is
// rejected outright, as is an all-digit key (a numeric index into a list-shaped section would
// hand back an arbitrary element box) and a chain shorter than 2 keys.
function urlsLiteralChain (initializer) {
    let node = initializer;
    const keys = [];
    while (node?.kind === ts.SyntaxKind.ParenthesizedExpression || node?.kind === ts.SyntaxKind.ElementAccessExpression
            || node?.kind === ts.SyntaxKind.AsExpression) {
        if (node.kind === ts.SyntaxKind.ParenthesizedExpression) {
            node = node.expression;
            continue;
        }
        if (node.kind === ts.SyntaxKind.AsExpression) {
            if (!asExpressionPrintsBare (node)) {
                return undefined;
            }
            node = node.expression;
            continue;
        }
        const key = node.argumentExpression;
        if (key?.kind !== ts.SyntaxKind.StringLiteral && key?.kind !== ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
            return undefined;
        }
        if (/^[0-9]+$/.test (key.text)) {
            return undefined;
        }
        keys.unshift (key.text);
        node = node.expression;
    }
    if (keys.length < 2 || node?.kind !== ts.SyntaxKind.PropertyAccessExpression) {
        return undefined;
    }
    if (node.expression?.kind !== ts.SyntaxKind.ThisKeyword || node.name?.text !== 'urls') {
        return undefined;
    }
    return keys;
}

// `x.padStart (n, c)` / `x.padEnd (n, c)`: the printer casts the receiver to System.String itself, so
// the printed call is a non-null `string` (PadLeft/PadRight) whatever the TS receiver type is
function stringPadCallType (csharp, initializer) {
    if (initializer?.kind !== ts.SyntaxKind.CallExpression) {
        return undefined;
    }
    const callee = initializer.expression;
    if (callee?.kind !== ts.SyntaxKind.PropertyAccessExpression) {
        return undefined;
    }
    const name = callee.name?.text;
    if (name !== 'padStart' && name !== 'padEnd') {
        return undefined;
    }
    const printed = csharp.printNode (initializer, 0).trim ();
    return /^\((?:\(string\)[^()]*|[^()]*\sas\sString)\)\.(?:PadLeft|PadRight)\s*\(/.test (printed) ? 'string' : undefined;
}

// does this initialiser's runtime box provably hold a string or null? (see the family comment)
export function urlsDescribeStringProducer (initializer) {
    const keys = urlsLiteralChain (initializer);
    if (keys === undefined) {
        return false;
    }
    const urls = describeLiteralProperty (ownDescribeLiteral (initializer.getSourceFile ()), 'urls');
    if (urls?.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
        return false;
    }
    if (describeLiteralPathKind (urls, keys) !== 'string') {
        return false;
    }
    const suffix = keys.slice (1);
    for (const property of urls.properties) {
        if (property.kind !== ts.SyntaxKind.PropertyAssignment || describeLiteralKey (property) === keys[0]) {
            continue;
        }
        const value = property.initializer;
        if (value?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            const kind = describeLiteralPathKind (value, suffix);
            if (kind !== 'string' && kind !== 'null' && kind !== 'absent') {
                return false;
            }
        } else {
            const kind = describeLiteralKind (value);
            if (kind !== 'string' && kind !== 'null' && kind !== 'number' && kind !== 'bool') {
                return false;
            }
        }
    }
    return true;
}
