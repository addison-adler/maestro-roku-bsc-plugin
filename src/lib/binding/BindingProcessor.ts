import type {
    FunctionStatement,
    IfStatement,
    BrsFile,
    XmlFile,
    SourceObj,
    Program,
    TranspileObj
} from 'brighterscript';

import { createSGAttribute, util, Lexer, Parser, ParseMode } from 'brighterscript';

import type { File } from '../files/File';
import { FileType } from '../files/FileType';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import {
    addXmlBindingErrorValidatingBindings,
    addXmlBindingNoCodeBehind,
    addXmlBindingNoVMClassDefined,
    addXmlBindingParentHasDuplicateField,
    addXmlBindingVMClassNotFound
} from '../utils/Diagnostics';
import { createRange, makeASTFunction } from '../utils/Utils';
import type Binding from './Binding';
import { BindingType } from './BindingType';
import { XMLTag } from './XMLTag';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import type { SGAttribute, SGComponent, SGNode, SGTag } from 'brighterscript/dist/parser/SGTypes';
import { SGScript } from 'brighterscript/dist/parser/SGTypes';
import { addImport, createImportStatement } from '../Utils';
import type { FileFactory } from '../utils/FileFactory';
import type { DependencyGraph } from 'brighterscript/dist/DependencyGraph';

// eslint-disable-next-line
import * as fsExtra from 'fs-extra';
import { BrsTranspileState } from 'brighterscript/dist/parser/BrsTranspileState';
import { SourceNode } from 'source-map';
import type { MaestroConfig } from '../files/MaestroConfig';

export class BindingProcessor {
    constructor(public fileMap: ProjectFileMap, public fileFactory: FileFactory, public config: MaestroConfig) {
    }

    public generateCodeForXMLFile(file: File, program: Program, entry?: TranspileObj) {
        if (!file || (file.fileType !== FileType.Xml)
        ) {
            throw new Error('was given a non-xml file');
        }
        if (!file.associatedFile && file.vmClassName) {
            if (this.config.mvvm.createCodeBehindFilesWhenNeeded) {

                if (entry) {
                    let vmFile = this.fileMap.getFileForClass(file.vmClassName);
                    if (vmFile) {
                        //BRON_AST_EDIT_HERE
                        let xmlFile = file.bscFile as XmlFile;
                        // eslint-disable-next-line @typescript-eslint/dot-notation
                        let dg = program['dependencyGraph'] as DependencyGraph;
                        dg.addDependency(xmlFile.dependencyGraphKey, vmFile.bscFile.dependencyGraphKey);
                        xmlFile.ast.component.scripts.push(this.createSGScript(xmlFile.pkgPath.replace('.xml', '.brs')));
                        fsExtra.outputFileSync(entry.outputPath.replace('.xml', '.brs'), this.getCodeBehindText(file, vmFile.bscFile as BrsFile));
                    } else {
                        console.error('missing vm file ' + file.vmClassName);
                    }

                } else {
                    console.error('cannot generated codebehind file transpile without entry');
                }
            }
        } else {
            (file.bscFile as XmlFile).parser.invalidateReferences();
            this.addFindNodeVarsMethodForFile(file);
            if (this.config.mvvm.callCreateNodeVarsInInit) {
                this.addInitCreateNodeVarsCall(file.associatedFile.bscFile as BrsFile);
            }
            if (this.config.mvvm.insertCreateVMMethod) {
                this.addVMConstructor(file);
            }
            if (file.bindings.length > 0) {
                this.addBindingMethodsForFile(file);
            }

            (file.associatedFile.bscFile as BrsFile).parser.invalidateReferences();
        }

    }
    private getCodeBehindText(file: File, brsFile: BrsFile): any {
        let text = `'generated by maestro-bsc-plugin`;
        text += `\nfunction init()
  m_createNodeVars()
end function\n`;
        text += this.getNodeVarMethodText(file) + `\n`;
        text += `\nfunction m_createVM()
        m.vm = ${file.vmClassName.replace(/\./gim, '_')}()
        m.vm.initialize()
        mx_initializeBindings()

      end function\n`;
        if (file.bindings.length > 0) {
            text += this.getBindingMethodsText(file, brsFile);
        }

        return text;
    }


    private getBindingMethodsText(file: File, brsFile: BrsFile) {
        let bindings = file.bindings.concat(file.getAllParentBindings());
        if (bindings.length > 0) {
            //TODO convert to pure AST
            //BRON_AST_EDIT_HERE
            let bindingInitStatement = this.getBindingInitMethod(
                bindings.filter(
                    (b) => b.properties.type !== BindingType.static &&
                        b.properties.type !== BindingType.code
                ), file.bscFile as XmlFile);
            let staticBindingStatement = this.getStaticBindingsMethod(bindings.filter(
                (b) => b.properties.type === BindingType.static ||
                    b.properties.type === BindingType.code
            ), file.bscFile as XmlFile);
            let text = '';
            let state = new BrsTranspileState(brsFile);
            text += new SourceNode(null, null, state.srcPath, bindingInitStatement.transpile(state)).toString() + '\n';
            text += new SourceNode(null, null, state.srcPath, staticBindingStatement.transpile(state)).toString() + '\n';
            return text;
        }
    }

    private createSGScript(uri: string) {
        return new SGScript(
            { text: 'script' },
            [createSGAttribute('uri', `pkg:/${uri}`)],
            { text: '' }
        );
    }
    /**
     * given a file, will load it's xml, identify bindings and clear out binding text.
     * @param file - file to parse bindings for
     */
    public parseBindings(file: File) {
        if (!file || file.fileType !== FileType.Xml) {
            throw new Error('was given a non-xml file');
        }
        file.resetBindings();

        //we have to reparse the xml each time we do this..
        let fileContents: SourceObj = {
            pathAbsolute: file.fullPath,
            source: file.bscFile.fileContents
        };

        let xmlFile = file.bscFile as XmlFile;
        xmlFile.parse(fileContents.source);
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        xmlFile.ast.component?.setAttribute('vm', undefined);
        xmlFile.needsTranspiled = true;
        file.bindings = this.processElements(file);
    }

    public addNodeVarsMethodForRegularXMLFile(file: File) {
        if (!file || file.fileType !== FileType.Xml) {
            throw new Error('was given a non-xml file');
        }
        if (file.associatedFile) {
            file.resetBindings();

            //we have to reparse the xml each time we do this..
            let fileContents: SourceObj = {
                pathAbsolute: file.fullPath,
                source: file.bscFile.fileContents
            };
            file.bscFile.parse(fileContents.source);
            this.processElementsForTagIds(file);
            if (file.tagIds.size > 0) {
                this.addFindNodeVarsMethodForFile(file);
                if (this.config.mvvm.callCreateNodeVarsInInit) {
                    this.addInitCreateNodeVarsCall(file.associatedFile.bscFile as BrsFile);
                }
            }

        }
    }

    public processElementsForTagIds(file: File) {
        let xmlFile = file.bscFile as XmlFile;
        file.componentTag = xmlFile.ast.component;
        for (let sgNode of this.getAllChildren(file.componentTag)) {
            let id = sgNode.getAttributeValue('id');
            if (id) {
                file.tagIds.add(id);
            }
        }
        // console.log('got tagids', file.tagIds);
    }

    private addInitCreateNodeVarsCall(file: BrsFile) {
        let initFunc = file.parser.references.functionStatements.find((f) => f.name.text.toLowerCase() === 'init');
        if (initFunc) {
            //BRON_AST_EDIT_HERE
            initFunc.func.body.statements.splice(0, 0, new RawCodeStatement(`
  m_createNodeVars()
    `));
        }
        if (!initFunc && this.config.mvvm.callCreateNodeVarsInInit) {
            console.log('init func was not present in ', file.pkgPath, ' adding init function');
            //BRON_AST_EDIT_HERE
            let initFunc = makeASTFunction(`function init()
  m_createNodeVars()
end function`);
            //BRON_AST_EDIT_HERE
            file.parser.references.functionStatements.push(initFunc);
            file.parser.references.functionStatementLookup.set('init', initFunc);
            file.parser.ast.statements.push(initFunc);
        }
    }

    public getAllChildren(component: SGComponent) {
        let result = [] as SGTag[];
        this.getNodeChildren(component.children, result);
        return result;
    }

    public getNodeChildren(node: SGNode, results: SGTag[] = []) {
        if (node) {
            results.push(node);
            if (node.children) {
                for (let child of node.children) {
                    this.getNodeChildren(child, results);
                }
            }
        }
    }

    public processElements(file: File) {
        let xmlFile = file.bscFile as XmlFile;
        file.componentTag = xmlFile.ast.component;
        const allTags = this.getAllChildren(file.componentTag).map((c) => new XMLTag(c, file, false)
        );

        let interfaceFields = file.componentTag.api.fields.map((c) => new XMLTag(c, file, true)
        );
        allTags.push(...interfaceFields);

        for (let tag of allTags) {
            if (tag.id) {
                (tag.isTopTag ? file.fieldIds : file.tagIds).add(tag.id);
            }
        }

        let tagsWithBindings = allTags.filter((t) => t.hasBindings);
        return util.flatMap(tagsWithBindings, (t) => t.bindings);
    }

    public validateBindings(file: File) {
        if (
            !file ||
            (file.fileType !== FileType.Xml)
        ) {
            throw new Error('was given a non-xml file');
        }
        let errorCount = 0;

        try {
            let allParentIds = file.getAllParentTagIds();
            let allParentFieldIds = file.getAllParentFieldIds();
            for (let id of file.fieldIds) {
                if (allParentFieldIds.has(id)) {
                    addXmlBindingParentHasDuplicateField(file, id, 1);
                    errorCount++;
                }
            }
            for (let id of file.tagIds) {
                if (allParentIds.has(id)) {
                    addXmlBindingParentHasDuplicateField(file, id, 1);
                    errorCount++;
                }
            }
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            addXmlBindingErrorValidatingBindings(file, e.message);
            errorCount++;
        }

        if (file.bindings.length > 0) {

            // if (!file.associatedFile) {
            //     addXmlBindingNoCodeBehind(file);
            // }

            if (!file.vmClassName) {
                if (errorCount === 0) {
                    addXmlBindingNoVMClassDefined(file);
                    errorCount++;
                }

            } else {

                file.bindingClass = this.fileMap.allClasses.get(file.vmClassName);

                if (!file.bindingClass) {
                    addXmlBindingVMClassNotFound(file);
                    errorCount++;

                } else {
                    for (let binding of file.bindings.filter((b) => b.isValid)) {
                        binding.validateAgainstClass();
                        errorCount += binding.isValid ? 0 : 1;
                    }
                    let bindingFile = this.fileMap.getFileForClass(file.vmClassName);
                    if (bindingFile) {
                        bindingFile.bindingTargetFiles.add(file.bscFile as XmlFile);
                    }
                }
            }
        }

        file.isValid = errorCount === 0;
    }

    private addBindingMethodsForFile(file: File) {
        //TODO - use AST for this.
        let associatedMFile = file.associatedFile.bscFile as BrsFile;
        //BRON_AST_EDIT_HERE
        let bindings = file.bindings.concat(file.getAllParentBindings());
        if (bindings.length > 0) {
            //TODO convert to pure AST
            let bindingInitStatement = this.getBindingInitMethod(
                bindings.filter(
                    (b) => b.properties.type !== BindingType.static &&
                        b.properties.type !== BindingType.code
                ), file.bscFile as XmlFile);
            let staticBindingStatement = this.getStaticBindingsMethod(bindings.filter(
                (b) => b.properties.type === BindingType.static ||
                    b.properties.type === BindingType.code
            ), file.bscFile as XmlFile);

            if (bindingInitStatement) {
                //BRON_AST_EDIT_HERE
                associatedMFile.parser.statements.push(bindingInitStatement);
                file.associatedFile.isASTChanged = true;
            }
            if (staticBindingStatement) {
                //BRON_AST_EDIT_HERE
                associatedMFile.parser.statements.push(staticBindingStatement);
                file.associatedFile.isASTChanged = true;
            }
        }
    }

    private makeASTFunction(source: string): FunctionStatement | undefined {
        let tokens = Lexer.scan(source).tokens;
        let { statements } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
        if (statements && statements.length > 0) {
            return statements[0] as FunctionStatement;
        }
        return undefined;
    }

    private getBindingInitMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
        let func = makeASTFunction(`function m_initBindings()
      if m.vm <> invalid
      vm = m.vm
      end if
    end function`);

        if (func) {
            let ifStatement = func.func.body.statements[0] as IfStatement;
            //BRON_AST_EDIT_HERE
            let nodeIds = [
                ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId))
            ];

            for (let binding of bindings) {
                //BRON_AST_EDIT_HERE
                ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getInitText(), file, binding.range));

            }
            //BRON_AST_EDIT_HERE
            ifStatement.thenBranch.statements.push(new RawCodeStatement(`
      if vm.onBindingsConfigured <> invalid
       vm.onBindingsConfigured()
       end if
       `));
        }

        return func;
    }

    private getStaticBindingsMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
        let func = makeASTFunction(`function m_initStaticBindings()
      if m.vm <> invalid
      vm = m.vm
      end if
    end function`);

        if (func) {
            //BRON_AST_EDIT_HERE
            let ifStatement = func.func.body.statements[0] as IfStatement;
            let nodeIds = [
                //BRON_AST_EDIT_HERE
                ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId))
            ];
            //BRON_AST_EDIT_HERE
            for (let binding of bindings) {
                ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getStaticText(), file, binding.range));

            }
        }
        return func;
    }

    private addFindNodeVarsMethodForFile(file: File) {
        let createNodeVarsFunction = this.makeASTFunction(this.getNodeVarMethodText(file));
        let brsFile = file.associatedFile.bscFile as BrsFile;
        //BRON_AST_EDIT_HERE
        if (createNodeVarsFunction && file.associatedFile?.bscFile?.parser) {
            brsFile.parser.statements.push(createNodeVarsFunction);
            file.associatedFile.isASTChanged = true;
        }
    }

    private getNodeVarMethodText(file: File) {
        let tagIds = Array.from(file.getAllParentTagIds().values()).concat(
            Array.from(file.tagIds.values())
        );

        if (tagIds.length > 0) {
            return `function m_createNodeVars()
  for each id in [ ${tagIds.map((id) => `"${id}"`).join(',')}]
    m[id] = m.top.findNode(id)
  end for
end function
`;
        } else {
            return `
  function m_createNodeVars()
  end function
          `;
        }
    }

    private addVMConstructor(file: File) {
        console.log('addVM ', file.fullPath, file.bscFile === undefined);
        console.log('no initialize function, adding one');
        //BRON_AST_EDIT_HERE
        let func = makeASTFunction(this.getVMInitializeText(file));

        if (func) {
            let vmFile = this.fileMap.getFileForClass(file.vmClassName);
            if (vmFile) {
                //BRON_AST_EDIT_HERE
                addImport(file.associatedFile.bscFile as BrsFile, vmFile.bscFile.pkgPath);
                (file.associatedFile.bscFile as BrsFile).parser.statements.push(func);
                file.associatedFile.isASTChanged = true;
            } else {
                console.error(`file for vm class ${file.vmClassName} was not found!`);
            }
        }
    }

    private getVMInitializeText(file: File) {
        return `function m_createVM()
  m.vm = new ${file.vmClassName}()
  m.vm.initialize()
  mx_initializeBindings()

end function`;
    }

    private getFunctionInParents(file: File, name: string) {
        let fs;
        while (file) {

            fs = (file.associatedFile?.bscFile as BrsFile).parser.references.functionStatementLookup.get('createVM');
            if (fs) {
                return fs;
            }
            file = file.parentFile;
        }
        return undefined;
    }


}
