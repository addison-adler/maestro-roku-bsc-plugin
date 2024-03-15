import type { Position, BrsFile, XmlFile, ClassStatement, FunctionStatement, MethodStatement, Statement, Expression, FieldStatement, AstNode, AAMemberExpression, BscFile } from 'brighterscript';
import { Range, Lexer, Parser, ParseMode, createVariableExpression, IfStatement, BinaryExpression, Block, createStringLiteral, createToken, isMethodStatement, isClassStatement, TokenKind, isExpression, createIdentifier, VariableExpression, CallExpression, AALiteralExpression, ArrayLiteralExpression } from 'brighterscript';
import type { MaestroFile } from '../files/MaestroFile';
import type { ProjectFileMap } from '../files/ProjectFileMap';

export function spliceString(str: string, index: number, add?: string): string {
    // We cannot pass negative indexes directly to the 2nd slicing operation.
    if (index < 0) {
        index = str.length + index;
        if (index < 0) {
            index = 0;
        }
    }

    return (
        str.slice(0, index) + (add || '') + str.slice(index + (add || '').length)
    );
}

export function getRegexMatchesValues(input, regex, groupIndex): any[] {
    let values = [];
    let matches: any[];
    regex.lastIndex = 0;
    while ((matches = regex.exec(input))) {
        values.push(matches[groupIndex]);
    }
    return values;
}
export function getRegexMatchValue(input, regex, groupIndex): string {
    let matches: any[];
    while ((matches = regex.exec(input))) {
        if (matches.length > groupIndex) {
            return matches[groupIndex];
        }
    }
    return null;
}

export function addSetItems(setA, setB) {
    for (const elem of setB) {
        setA.add(elem);
    }
}

export function pad(pad: string, str: string, padLeft: number): string {
    if (typeof str === 'undefined') {
        return pad;
    }
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function getAlternateFileNames(fileName: string): string[] {
    if (fileName?.toLowerCase().endsWith('.brs')) {
        return [fileName.substring(0, fileName.length - 4) + '.xml'];
    } else if (fileName?.toLowerCase().endsWith('.bs')) {
        return [fileName.substring(0, fileName.length - 3) + '.xml'];
    } else if (
        fileName?.toLowerCase().endsWith('.xml')
    ) {
        return [
            fileName.substring(0, fileName.length - 4) + '.brs',
            fileName.substring(0, fileName.length - 4) + '.bs'
        ];
    } else {
        return [];
    }
}

export function getAssociatedFile(file: BrsFile | BscFile | XmlFile, fileMap: ProjectFileMap): MaestroFile | undefined {
    for (let filePath of getAlternateFileNames(file.srcPath)) {
        let mFile = fileMap.allFiles[filePath];
        if (mFile) {
            return mFile;
        }
    }
    return undefined;
}

export function createRange(pos: Position) {
    return Range.create(pos.line, pos.character, pos.line, pos.character);
}

export function makeASTFunction(source: string): FunctionStatement | undefined {
    let tokens = Lexer.scan(source).tokens;
    let { statements } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
    if (statements && statements.length > 0) {
        return statements[0] as FunctionStatement;
    }
    return undefined;
}

export function getFunctionBody(source: string): Statement[] {
    let funcStatement = makeASTFunction(source);
    return funcStatement ? funcStatement.func.body.statements : [];
}

export function changeFunctionBody(statement: FunctionStatement | MethodStatement, source: string) {
    let statements = statement.func.body.statements;
    statements.splice(0, statements.length);
    let newStatements = getFunctionBody(source);
    for (let newStatement of newStatements) {
        statements.push(newStatement);
    }
}

export function createCallExpression(funcName: string, args: (Expression | string)[] = []) {
    const argExpressions: Expression[] = [];
    for (const arg of args) {
        if (isExpression(arg as AstNode)) {
            argExpressions.push(arg as Expression);
        } else if (typeof arg === 'string') {
            // arg is string
            if (arg.startsWith('"') && arg.endsWith('"')) {
                argExpressions.push(createStringLiteral(arg));
            } else {
                argExpressions.push(new VariableExpression({ name: createIdentifier(arg) }));
            }
        }
    }
    return new CallExpression({
        callee: new VariableExpression({ name: createIdentifier(funcName) }),
        openingParen: createToken(TokenKind.LeftParen),
        closingParen: createToken(TokenKind.RightParen),
        args: argExpressions
    });
}

export function createAA(elements: AAMemberExpression[] = []) {
    return new AALiteralExpression({
        elements: elements,
        open: createToken(TokenKind.LeftCurlyBrace),
        close: createToken(TokenKind.RightCurlyBrace)
    });
}

export function createArray(elements: Expression[] = []) {
    return new ArrayLiteralExpression({
        elements: elements,
        open: createToken(TokenKind.LeftSquareBracket),
        close: createToken(TokenKind.RightSquareBracket)
    });
}

export function addOverriddenMethod(target: ClassStatement, name: string, source: string): boolean {
    let statement = makeASTFunction(`
  class wrapper
  override function ${name}()
    ${source}
  end function
  end class
  `);
    if (isClassStatement(statement)) {
        let classStatement = statement as ClassStatement;
        target.body.push(classStatement.methods[0]);
        return true;
    }
    return false;
}

export function changeClassMethodBody(target: ClassStatement, name: string, source: string): boolean {
    let method = target.methods.find((m) => m.tokens.name.text === name);
    if (isMethodStatement(method)) {
        changeFunctionBody(method, source);
        return true;
    }
    return false;
}

export function sanitizeBsJsonString(text: string) {
    return `"${text ? text.replace(/"/g, '\'') : ''}"`;
}

export function createIfStatement(condition: Expression, statements: Statement[]): IfStatement {
    let ifToken = createToken(TokenKind.If, 'else if', Range.create(1, 1, 1, 999999));
    ifToken.text = 'else if';
    let thenBranch = new Block({
        statements: statements,
        startingRange: Range.create(1, 1, 1, 1)
    });
    return new IfStatement({
        if: ifToken,
        then: createToken(TokenKind.Then, '', Range.create(1, 1, 1, 999999)),
        condition: condition,
        thenBranch: thenBranch
    });
}

export function createVarExpression(varName: string, operator: TokenKind, value: string): BinaryExpression {
    let variableExpression = createVariableExpression(varName, Range.create(1, 1, 1, 999999));
    let stringLiteral = createStringLiteral('"' + value, Range.create(1, 1, 1, 999999));
    let token = createToken(operator, getTokenText(operator), Range.create(1, 1, 1, 999999));
    return new BinaryExpression({
        left: variableExpression,
        operator: token,
        right: stringLiteral
    });
}

export function getTokenText(operator: TokenKind): string {
    switch (operator) {
        case TokenKind.Equal:
            return '=';
        case TokenKind.Plus:
            return '+';
        case TokenKind.Minus:
            return '-';
        case TokenKind.Less:
            return '<';
        case TokenKind.Greater:
            return '>';
        default:
            return '>';
    }
}

export function getAllFields(fileMap: ProjectFileMap, classStatement: ClassStatement, accessModifier?: TokenKind) {
    let result = new Map<string, FieldStatement>();
    while (classStatement) {
        if (accessModifier === TokenKind.Public) {
            for (let field of classStatement.fields || []) {
                if (!field.tokens.accessModifier || field.tokens.accessModifier?.kind === accessModifier) {
                    result.set(field.tokens.name.text.toLowerCase(), field);
                }
            }
        } else {
            for (let field of classStatement.fields || []) {
                if (!accessModifier || field.tokens.accessModifier?.kind === accessModifier) {
                    result.set(field.tokens.name.text.toLowerCase(), field);
                }
            }
        }
        classStatement = classStatement.parentClassName ? fileMap.allClasses[classStatement.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
    }

    return result;
}

export function getAllMethods(fileMap: ProjectFileMap, cs: ClassStatement, accessModifier?: TokenKind) {
    let result = {};
    while (cs) {
        if (accessModifier === TokenKind.Public) {
            for (let method of cs.methods) {
                if (!method.accessModifier || method.accessModifier?.kind === accessModifier) {
                    result[method.tokens.name.text.toLowerCase()] = method;
                }
            }
        } else {
            for (let method of cs.methods) {
                if (!accessModifier || method.accessModifier?.kind === accessModifier) {
                    result[method.tokens.name.text.toLowerCase()] = method;
                }
            }
        }
        cs = cs.parentClassName ? fileMap.allClasses[cs.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
    }

    return result;
}

export function getAllAnnotations(fileMap: ProjectFileMap, cs: ClassStatement) {
    let result = {};
    while (cs) {
        if (cs.annotations) {
            for (let annotation of cs.annotations) {
                result[annotation.name.toLowerCase()] = true;
            }
        }
        cs = cs.parentClassName ? fileMap.allClasses[cs.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
    }

    return result;
}


