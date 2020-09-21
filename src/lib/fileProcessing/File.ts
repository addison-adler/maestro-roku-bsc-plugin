// @ts-ignore
// @ts-ignore
import { BrsFile, BsDiagnostic, XmlFile } from 'brighterscript';
import * as fs from 'fs-extra';
import * as path from 'path';

import Binding from '../bindingSupport/Binding';
import { addSetItems } from '../utils/Utils';
import { FileType } from './FileType';
import { ProjectFileMap } from './ProjectFileMap';

import { addErrorDiagnostic } from '../utils/Feedback';

const xmldoc = require('../utils/xmldoc');

/**
 * describes a file in our project.
 */
export class File {

  constructor(fullPath: string, fileContents: string = null) {
    this.componentIds = new Set<string>();
    this._bindings = [];
    this.associatedFile = null;
    this.parentFile = null;
    this._fileContents = fileContents;
    this._fullPath = fullPath;
  }

  public static fromFile(bscFile: XmlFile | BrsFile): File {
    const file = new File(bscFile.pathAbsolute, bscFile.fileContents);
    file.bscFile = bscFile;
    return file;
  }

  private _isDirty: boolean;
  private _fullPath: string;
  public hasProcessedBindings: boolean;
  public isValid: boolean;
  public associatedFile?: File;
  public parentFile?: File;
  public programFile: XmlFile | BrsFile;
  public xmlDoc: any;
  public tagIds = new Set<string>();
  public fieldIds = new Set<string>();
  public componentName: string;
  public parentComponentName: string;
  public componentIds: Set<string>;
  public bscFile: BrsFile | XmlFile;
  public diagnostics: BsDiagnostic[] = [];

  private readonly _bindings: Binding[];
  private _fileContents: string;

  get fileType(): FileType {
    switch (path.extname(this._fullPath).toLowerCase()) {
      case '.brs':
        return this.associatedFile ? FileType.CodeBehind : FileType.Brs;
      case '.xml':
        return FileType.Xml;
      case '.bs':
        return FileType.Bs;
      default:
        return FileType.Other;
    }
  }

  public get isDirty(): boolean {
    return this._isDirty;
  }

  public get bindings(): Binding[] {
    return this._bindings;
  }

  public get fullPath() {
    return this._fullPath;
  }

  public getFileContents(): string {
    if (this._fileContents === null) {
      this._fileContents = fs.readFileSync(this.fullPath, 'utf8');
    }
    return this._fileContents;
  }

  public setFileContents(fileContents: string) {
    this._fileContents = fileContents;
    this._isDirty = true;
  }

  public saveFileContents() {
    try {
      fs.writeFileSync(this.fullPath, this._fileContents, 'utf8');
    } catch (e) {
      addErrorDiagnostic(this, 9007, `could not save file at path ${this.fullPath} - does the path exist?`);
    }

    this._isDirty = false;
  }

  public unloadContents() {
    this._fileContents = null;
  }

  public getAllParentBindings(bindings: Binding[] = null): Binding[] {
    if (!bindings) {
      bindings = [];
    } else {
      bindings = bindings.concat(this.bindings);
    }
    if (this.parentFile) {
      return this.parentFile.getAllParentBindings(bindings);
    } else {
      return bindings;
    }
  }

  public getAllParentTagIds(ids: Set<string> = null): Set<string> {
    if (!ids) {
      ids = new Set<string>();
    } else {
      addSetItems(ids, this.tagIds);
    }
    if (this.parentFile) {
      return this.parentFile.getAllParentTagIds(ids);
    } else {
      return ids;
    }
  }

  public getAllParentFieldIds(ids: Set<string> = null): Set<string> {
    if (!ids) {
      ids = new Set<string>();
    } else {
      addSetItems(ids, this.fieldIds);
    }
    if (this.parentFile) {
      return this.parentFile.getAllParentFieldIds(ids);
    } else {
      return ids;
    }
  }

  public toString(): string {
    return `FILE: ${this.fullPath} TYPE ${this.fileType} PATH ${this.fullPath}`;
  }

  public loadXmlContents(fileMap: ProjectFileMap) {
    if (this.xmlDoc) {
      return;
    }

    if (this.fileType === FileType.Xml) {
      try {
        this.xmlDoc = new xmldoc.XmlDocument(this.getFileContents());
        if (this.xmlDoc.name && this.xmlDoc.name && this.xmlDoc.name.toLowerCase() === 'component') {
          if (this.xmlDoc.attr) {
            if (this.xmlDoc.attr.name) {
              this.componentName = this.xmlDoc.attr.name;
              this.parentComponentName = this.xmlDoc.attr.extends;
              fileMap.addXMLComponent(this);
            }
          }
        }
      } catch (e) {
        addErrorDiagnostic(this, 9008, 'Could not parse xml in file: ' + e.message);
      }
    }
  }
}
