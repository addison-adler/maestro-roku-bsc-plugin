import { BrsFile, XmlFile, DiagnosticSeverity, Range } from 'brighterscript';


import { File } from '../files/File';

function addErrorDiagnostic(
  file: File,
  code: number,
  message: string,
  startLine: number = 0,
  startCol: number = 0,
  endLine: number = -1,
  endCol: number = 99999
) {
  endLine = endLine === -1 ? startLine : endLine;
  (file.bscFile as any).diagnostics.push(createDiagnostic(file.bscFile, code, message, startLine, startCol, endLine, endCol, DiagnosticSeverity.Error));
}
function addErrorDiagnosticForBinding(
  file: File,
  code: number,
  message: string,
  binding: Binding
) {
  (file.bscFile as any).diagnostics.push(createDiagnostic(file.bscFile, code, message, binding.range.start.line, binding.range.start.character, binding.range.end.line, binding.range.end.character, DiagnosticSeverity.Error));
}

function createDiagnostic(
  bscFile: BrsFile | XmlFile,
  code: number,
  message: string,
  startLine: number = 0,
  startCol: number = 99999,
  endLine: number = 0,
  endCol: number = 99999,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {
  endLine = endLine < startLine ? startLine : endLine;

  const diagnostic = {
    code: code,
    message: message,
    range: Range.create(startLine, startCol, endLine, endCol),
    file: bscFile,
    severity: severity
  };
  return diagnostic;
}

/**
 * Public methods
 */
export function addXmlBindingNoCodeBehind(file: File) {
  addErrorDiagnostic(
    file,
    6900,
    'This XML file has bindings; but there is no code behind file!',
  );
}

export function addXmlBindingCouldNotParseXML(file: File, message: string) {
  addErrorDiagnostic(
    file,
    6903,
    'Could not parse xml in file: ' + message,
  );

}

export function addXmlBindingParentHasDuplicateField(file: File, id: string, line: number = 0, col: number = 0) {
  addErrorDiagnostic(
    file,
    6904,
    'a parent of this xml file contains duplicate field id: ' + id,
    line,
    col
  );
}

export function addXmlBindingErrorValidatingBindings(file: File, message: string) {
  addErrorDiagnostic(
    file,
    6905,
    'Error while validating bindings' + message,
    0,
    0,
  );
}

export function addBuildTimeErrorImportMissingKey(file: XmlFile | BrsFile, buildKey: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6906, `xml file imports a build time import key that was not defined in your config:file that cannot be found ${buildKey}`, line, col)]);
}

export function addBuildTimeErrorImportMissingPkg(file: XmlFile | BrsFile, pkg: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6907, `xml file imports a build time import, which contains a pkg of a file that cannot be found ${pkg}`, line, col)]);
} import Binding from '../binding/Binding';
import { XMLTag } from '../binding/XMLTag';


export function addProjectFileMapErrorDuplicateXMLComp(file: File, duplicatePath: string) {
  addErrorDiagnostic(file, 6908, `Found duplicate named xml component ${file.componentName}. The name is already used by ${duplicatePath}`, 0, 0);
}

export function addXMLTagErrorCorruptXMLElement(file: File, tagText: string) {
  addErrorDiagnostic(file, 6909, `Received corrupt XMLElement`, 0, 0);
}

export function addXMLTagErrorCouldNotParseBinding(file: File, tagText: string, message: string, range: Range) {
  addErrorDiagnostic(file, 6910, `Could not parse binding: ${message}`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingDetailsForField(file: File, partText: string, tagText: string, range: Range) {
  addErrorDiagnostic(file, 6911,
    `Could not parse binding details`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingModeDetailsForField(file: File, partText: string, tagText: string, line: number, range: Range) {
  addErrorDiagnostic(file, 6912,
    `Could not parse binding mode`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingTransformFunctionForField(file: File, partText: string, tagText: string, range: Range) {
  addErrorDiagnostic(file, 6913,
    `Could not parse transformFunction"`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldMissingEndBrackets(file: File, tagText: string, range: Range) {
  addErrorDiagnostic(file, 6913,
    `Binding could not be parsed: Missing matching end brackets.`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParsefireOnSetForField(file: File, partText: string, tagText: string, range: Range) {
  addErrorDiagnostic(file, 6914,
    `Could not parse fireOnSet for field`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseIsFiringOnceForField(file: File, partText: string, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6915,
    `Could not parse binding setting "${partText}" - valid settings are 'once', 'fireonset' and 'transform'`, binding);
}

export function addFileErrorCouldNotSave(file: File) {
  addErrorDiagnostic(file, 6916, `could not save file at path ${file.fullPath} - does the path exist?`);
}

export function addFileErrorCouldNotParseXML(file: File, message: string) {
  addErrorDiagnostic(file, 6917, 'Could not parse xml in file: ' + message);
}

export function addXmlBindingDuplicateTag(file: File, field: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6918, `Could not parse binding the id is already used in another xml element: ${field}`, line, col);
}

export function addXmlBindingDuplicateField(file: File, field: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6919, `Could not parse binding id is already used in another interface field: ${field}`, line, col);
}
export function addCorruptVMType(file: File, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6920, `Could not pass vm field`, line, col);
}

export function addXmlBindingNoVMClassDefined(file: File) {
  addErrorDiagnostic(file, 6921, `The vm attribute was not set. Please add the 'vm' attribute to your component. e.g.  '<Component name='MyScreen' extends 'BaseScreen' vm='fully.namespaced.className'/>" so that maestro can give you accurate binding validations.`);
}

export function addXmlBindingVMClassNotFound(file: File) {
  addErrorDiagnostic(file, 6922, `The VMClass specified "${file.vmClassName}" was not found.`, file.componentTag.range.start.line, file.componentTag.range.start.character);
}

export function addXmlBindingVMFieldNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6923, `The bound field "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);
}

export function addXmlBindingVMFunctionNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6924, `The event handling function "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);

}

export function addXmlBindingVMFunctionWrongArgCount(file: File, binding: Binding, expected: number, actualParams: number) {
  addErrorDiagnosticForBinding(file, 6925, `The event handling function "${binding.observerField}" is configured with wrong number of params. Expected ${expected} parameters; function declaration has ${actualParams}`, binding);
}

export function addXmlBindingUnknownFunctionArgs(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6926, `The event handling function "${binding.observerField}" has an incorrect signature. You can call vm functions with the (), (value), (node), or (value, node)`, binding);
}


export function addBuildTimeErrorImportNoImports(file: XmlFile | BrsFile, buildKey: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6927, `This file imports a build time import key that is defined in bsConfig; but does not include any imports: ${buildKey}`, line, col, line, 99999, DiagnosticSeverity.Warning)]);
}

export function addNodeClassNoNodeRunMethod(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6928, `Node classes must declare a function name nodeRun(args), which returns dynamic`, line, col)]);

}

export function addNodeClassNoExtendNodeFound(file: BrsFile, line: number = 0, col: number = 0, name: string, extendsName: string) {
  file.addDiagnostics([createDiagnostic(file, 6929, `Node class "${name}" extends component ${extendsName}, which cannot be found in scope. You must extend a Node, Task, Group or a custom node`, line, col)]);
}

export function addNodeClassDuplicateName(file: BrsFile, line: number = 0, col: number = 0, name: string) {
  file.addDiagnostics([createDiagnostic(file, 6930, `Node class name "${name}" is already used`, line, col)]);
}

export function addNodeClassBadDeclaration(file: BrsFile, line: number = 0, col: number = 0, text: string) {
  file.addDiagnostics([createDiagnostic(file, 6931, `Could not interpret node class annotation "${text}". Should be "'@MNode|MTask ([name],[baseCompName])`, line, col)]);
}

export function addNodeClassNeedsClassDeclaration(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6932, `Node class annotation must immediately precede the target class; but no class statement was found`, line, col)]);
}

export function addNodeClassNeedsNewDeclaration(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6933, `Node classes must define a constructor that takes 2 arguments (m.top, and m.top.data (i.e. the data passed into your node))`, line, col)]);
}

export function addXmlBindingVMFieldRequired(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6934, `Field bindings are only available for vm fields. Cannot bind to vm function "${binding.observerField}" in class "${file.vmClassName}".`, binding);
}

export function addNodeClassFieldNoFieldType(file: BrsFile, line: number = 0, col: number = 0, name: string) {
  file.addDiagnostics([createDiagnostic(file, 6935, `Node class field "${name}" does not specify a field type. Use '@MField("[NODE_TYPE]")`, line, col)]);
}

export function addNodeClassCallbackNotFound(file: BrsFile, line: number = 0, col: number = 0, name: string, callbackName: string, className: string) {
  file.addDiagnostics([createDiagnostic(file, 6936, `Node class field "${name}" specifies observer function ${callbackName} which is not found in class ${className}`, line, col)]);

}
export function addNodeClassCallbackNotDefined(file: BrsFile, line: number = 0, col: number = 0, name: string) {
  file.addDiagnostics([createDiagnostic(file, 6937, `Node class field "${name}" does not specify the observer function name. Syntax is 'MObserve("CALLBACK_NAME")`, line, col)]);
}

