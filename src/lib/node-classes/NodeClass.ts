import type { AnnotationExpression, BrsFile, ClassFieldStatement, ClassMethodStatement, ClassStatement, FunctionStatement, Program, XmlFile } from 'brighterscript';
import { isClassMethodStatement, ParseMode, TokenKind } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import { addNodeClassCallbackNotDefined, addNodeClassCallbackNotFound, addNodeClassCallbackWrongParams, addNodeClassNoExtendNodeFound } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';

// eslint-disable-next-line
const path = require('path');


export enum NodeClassType {
    none = 0,
    node = 1,
    task = 2
}

export class NodeField {
    constructor(public file: BrsFile, public name: string, public annotation: AnnotationExpression, public observerAnnotation?: AnnotationExpression, public alwaysNotify?: boolean, public debounce?: boolean) {
        let args = annotation.getArguments();
        this.type = args[0] ? args[0] as string : undefined;
        this.value = args[1] ? args[1] as string : undefined;
        this.callback = observerAnnotation?.getArguments()[0] as string;
    }

    public type: string;
    public callback: string;
    public value: string;
    public numArgs: number;

    getObserverStatementText() {
        return `
    m.top.observeField("${this.name}", "on_${this.name}")`;
    }

    getInterfaceText() {
        let text = `
    <field id="${this.name}" type="${this.type}" `;
        if (this.value) {
            text += ` value="${this.value}" `;
        }
        if (this.alwaysNotify) {
            text += ` alwaysNotify="${this.alwaysNotify}" `;
        }
        text += '/>';
        return text;
    }

    getCallbackStatement() {
        return `
    function on_${this.name}()
      m.vm.${this.name} = m.top.${this.name}
      m.vm.${this.callback}(${this.numArgs === 1 ? 'm.vm.' + this.name : ''})
    end function
    `;
    }

    getDebouncedCallbackStatement() {
        return `
    function on_${this.name}()
      m.vm.${this.name} = m.top.${this.name}
      addCallback("${this.callback}")
      end function
      `;
    }


    getLazyCallbackStatement() {
        return `
    function on_${this.name}()
    _getVM().${this.name} = m.top.${this.name}
    _getVM().${this.callback}(${this.numArgs === 1 ? 'm.top.' + this.name : ''})
    end function
    `;

    }
    getLazyDebouncedCallbackStatement() {
        return `
    function on_${this.name}()
      _getVM().${this.name} = m.top.${this.name}
      addCallback("${this.callback}")
    end function
    `;
    }


}

export class NodeClass {
    constructor(
        public type: NodeClassType,
        public file: BrsFile,
        public classStatement: ClassStatement,
        public func: FunctionStatement,
        public name: string,
        public extendsName: string,
        public annotation: AnnotationExpression,
        public fileMap: ProjectFileMap,
        public isLazy: boolean,
        public nodeFields: NodeField[] = []
    ) {
        this.generatedNodeName = this.name.replace(/[^a-zA-Z0-9]/g, '_');
        this.bsPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.bs`);
        this.xmlPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.xml`);
    }
    public generatedNodeName: string;
    public xmlFile: XmlFile;
    public brsFile: BrsFile;
    public bsPath: string;
    public xmlPath: string;
    public classMemberFilter = (m) => isClassMethodStatement(m) && m.name.text !== 'nodeRun' && m.name.text !== 'new' && (!m.accessModifier || m.accessModifier.kind === TokenKind.Public);

    resetDiagnostics() {
        if (this.xmlFile) {
            (this.xmlFile as any).diagnostics = [];
        }
        if (this.brsFile) {
            (this.brsFile as any).diagnostics = [];
        }
    }

    getDebounceFunction(isLazy) {
        return `
    function addCallback(funcName)

    m.pendingCallbacks[funcName] = true
     if (m.pendingCallbacks.count() = 1)
        mc.tasks.observeNodeField(m.global.tick, "fire", onTick, "none", true)
      end if
    end function

    function onTick()
      for each funcName in m.pendingCallbacks
        ${isLazy ? `_getVM()
        m.vm[funcName]()`
        : 'm.vm[funcName]()'}
      end for
      m.pendingCallbacks = {}
    end function
`;
    }
    private getNodeTaskBrsCode(nodeFile: NodeClass) {
        let transpileState = new TranspileState(nodeFile.file);

        let text = `
  function init()
  m.top.functionName = "exec"
  end function

  function exec()
  m.top.output = nodeRun(m.top.args)
  end function

  function nodeRun(args)${nodeFile.func.func.body.transpile(transpileState).join('')}
  end function
    `;
        return text;
        // return new RawCodeStatement(text, nodeFile.file, nodeFile.func.range);

    }

    private makeFunction(name, bodyText) {
        let funcText = `
    function ${name}()
      ${bodyText}
    end function
    `;
        return funcText;
        // this.brsFile.parser.statements.push(makeASTFunction(funcText));
    }


    private getNodeBrsCode(members: (ClassFieldStatement | ClassMethodStatement)[]) {
        let text = '';
        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as ClassMethodStatement).func.parameters;
            if (params.length) {

                let funcSig = `${member.name.text}(${params.map((p) => p.name.text).join(',')})`;
                text += this.makeFunction(funcSig, `
         return m.vm.${funcSig}`);
            } else {
                text += this.makeFunction(`${member.name.text}(dummy = invalid)`, `
          return m.vm.${member.name.text}()`);

            }
        }

        return text;
    }

    private getLazyNodeBrsCode(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]) {
        let text = this.makeFunction('_getVM', `
      if m.vm = invalid
        m.vm = new ${nodeFile.classStatement.getName(ParseMode.BrighterScript)}(m.global, m.top)
      end if
      return m.vm
  `);

        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as ClassMethodStatement).func.parameters;
            if (params.length) {

                let funcSig = `${member.name.text}(${params.map((p) => p.name.text).join(',')})`;
                text += this.makeFunction(funcSig, `
         return _getVM().${funcSig}`);
            } else {
                text += this.makeFunction(`${member.name.text}(dummy = invalid)`, `
          return _getVM().${member.name.text}()`);

            }
        }

        return text;
    }

    private getNodeTaskFileXmlText(nodeFile: NodeClass): string {
        return `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    <field id="args" type="assocarray"/>
    <field id="output" type="assocarray"/>
    </interface>
    <children>
    </children>
    </component>
    `;
    }

    private getNodeFileXmlText(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]): string {
        let text = `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    <field id="data" type="assocarray"/>
    `;

        for (let member of nodeFile.nodeFields) {
            text += member.getInterfaceText();
        }

        for (let member of members.filter(this.classMemberFilter)) {
            text += `
         <function name="${member.name.text}"/>`;
        }
        text += `
      </interface>
      <children>
      </children>
      </component>
      `;
        return text;
    }

    generateCode(fileFactory: FileFactory, program: Program, fileMap: ProjectFileMap) {
        let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];


        let source = `import "pkg:/${this.file.pkgPath}"`;

        let initBody = ``;
        let otherText = '';
        let hasDebounce = false;
        if (this.type === NodeClassType.node) {
            if (!this.isLazy) {
                initBody += `
        m.vm = new ${this.classStatement.getName(ParseMode.BrighterScript)}(m.global, m.top)`;
            }
            for (let field of this.nodeFields.filter((f) => f.observerAnnotation)) {
                initBody += field.getObserverStatementText() + '\n';
                hasDebounce = hasDebounce || field.debounce;
                if (this.isLazy) {
                    otherText += field.debounce ? field.getLazyDebouncedCallbackStatement() : field.getLazyCallbackStatement();
                } else {
                    otherText += field.debounce ? field.getDebouncedCallbackStatement() : field.getCallbackStatement();
                }
            }
            if (hasDebounce) {
                initBody += `
        m.pendingCallbacks = {}
        `;
            }
            source += this.makeFunction('init', initBody) + otherText;
            if (hasDebounce) {
                source = `import "pkg:/source/roku_modules/mc/Tasks.brs"
        ` + source;
                source += this.getDebounceFunction(this.isLazy);
            }
        }

        if (this.type === NodeClassType.task) {
            source += this.getNodeTaskBrsCode(this);
        } else if (this.isLazy) {
            source += this.getLazyNodeBrsCode(this, members);
        } else {
            source += this.getNodeBrsCode(members);
        }

        this.brsFile = fileFactory.addFile(program, this.bsPath, source);
        this.brsFile.parser.invalidateReferences();
        let xmlText = this.type === NodeClassType.task ? this.getNodeTaskFileXmlText(this) : this.getNodeFileXmlText(this, members);

        this.xmlFile = fileFactory.addFile(program, this.xmlPath, xmlText);
        this.xmlFile.parser.invalidateReferences();
    }

    private getClassMembers(classStatement: ClassStatement, fileMap: ProjectFileMap) {
        let results = new Map<string, ClassFieldStatement | ClassMethodStatement>();
        if (classStatement) {
            let classes = this.getClassHieararchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
            for (let cs of classes) {
                let fields = cs?.fields;
                let methods = cs?.methods;
                for (let member of [...fields, ...methods]) {
                    if (!results.has(member.name.text.toLowerCase() && member)) {
                        results.set(member.name.text.toLowerCase(), member);
                    }
                }
            }
        }
        return results;
    }


    public getClassHieararchy(className: string, fileMap: ProjectFileMap) {
        let items = [];
        let parent = fileMap.allClasses.get(className);
        while (parent) {
            items.push(parent);
            parent = fileMap.allClasses.get(parent.parentClassName?.getName(ParseMode.BrighterScript));
        }
        return items;
    }

    public validate() {
        if (!this.fileMap.allXMLComponentFiles.get(this.extendsName) && (!this.fileMap.validComps.has(this.extendsName))) {
            addNodeClassNoExtendNodeFound(this.file, this.name, this.extendsName, this.annotation.range.start.line, this.annotation.range.start.character);
        }
        for (let field of this.nodeFields) {
            if (field.observerAnnotation) {
                let observerArgs = field.observerAnnotation.getArguments();
                let observerFunc = this.classStatement.methods.find((m) => m.name.text === observerArgs[0]);
                field.numArgs = observerFunc?.func?.parameters?.length;
                if (observerArgs?.length !== 1) {
                    addNodeClassCallbackNotDefined(this.file, field.name, field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);

                } else if (!observerFunc) {
                    addNodeClassCallbackNotFound(this.file, field.name, observerArgs[0] as string, this.classStatement.getName(ParseMode.BrighterScript), field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);
                } else if (field.numArgs > 1) {
                    addNodeClassCallbackWrongParams(this.file, field.name, observerArgs[0] as string, this.classStatement.getName(ParseMode.BrighterScript), field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);
                }
            }
        }

    }
}
