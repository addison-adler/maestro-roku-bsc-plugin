import { BrsFile, XmlFile } from 'brighterscript';

import { getAlternateFileNames } from '../utils/Utils';
import { File } from './File';
import { FileType } from './FileType';

import { addErrorDiagnostic } from '../utils/Feedback';

export class ProjectFileMap {
  constructor() {
    this.allFiles = new Map<string, File>();
    this.allXMLComponentFiles = new Map<string, File>();
    this.allClassNames = new Set<string>();
  }

  public allClassNames: Set<string>;
  public allXMLComponentFiles: Map<string, File>;
  public allFiles: Map<string, File>;

  get XMLComponentNames(): string[] {
    return [...this.allXMLComponentFiles.keys()];
  }

  get files(): File[] {
    return [...this.allFiles.values()];
  }

  get classNames(): string[] {
    return [...this.classNames.values()];
  }

  public addXMLComponent(file: File) {
    if (file.fileType === FileType.Xml) {
      if (!this.allXMLComponentFiles.has(file.componentName)) {
        this.allXMLComponentFiles.set(file.componentName, file);
      } else {
        const duplicateFile = this.allXMLComponentFiles.get(file.componentName);
        addErrorDiagnostic(file, 9008, `Found duplicate named xml component ${file.componentName}. The name is already used by ${duplicateFile.fullPath}`);
      }
    }
  }

  public addClassName(className: string) {
    this.allClassNames.add(className);
  }

  public addFile(file: File) {
    this.allFiles.set(file.fullPath, file);
    const alternatePaths = getAlternateFileNames(file.fullPath);
    let alternateFile;
    for (let p of alternatePaths) {
      alternateFile = this.allFiles.get(p);
      if (alternateFile) {
        file.associatedFile = alternateFile;
        alternateFile.associatedFile = file;
        break;
      }
    }
  }

  public addBscFiles(files: { [filePath: string]: BrsFile | XmlFile }) {
    for (let filePath in files) {
      let bscFile = files[filePath];
      let file = this.allFiles.get(bscFile.pathAbsolute);
      if (file) {
        file.bscFile = bscFile;
      }
    }
  }
}
