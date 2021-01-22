import type { XmlFile } from 'brighterscript';
import { BrsFile, Program } from 'brighterscript';
import { expect } from 'chai';

import { File } from './File';

import { FileType } from './FileType';
import { ProjectFileMap } from './ProjectFileMap';

describe('File', () => {
    let projectFileMap;
    let program = new Program({});
    beforeEach(() => {
        projectFileMap = new ProjectFileMap();
    });
    describe('Initialization', () => {
        it('correctly sets directory', () => {
            const file = new File(makeBrsFile('test.xml'), projectFileMap);
            expect(file.fullPath).to.equal('test.xml');
        });
    });

    describe('file types', () => {
        it('correctly identifies type other', () => {
            const file = new File(makeBrsFile('/fsPath/test.json'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Other);

        });

        it('correctly identifies type xml', () => {
            const file = new File(makeBrsFile('test.xml'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Xml);

        });

        it('correctly identifies type brs', () => {
            const file = new File(makeBrsFile('/fsPath/test.brs'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Brs);

        });

        it('correctly identifies type other - no extension', () => {
            const file = new File(makeBrsFile('/fsPath/test'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Other);
        });
    });


    function makeBrsFile<T extends BrsFile | XmlFile>(path) {
        return new BrsFile(path, path, program);
    }

});
