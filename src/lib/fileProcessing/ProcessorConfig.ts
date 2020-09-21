import { BsConfig, FileResolver } from 'brighterscript';
import * as fs from 'fs-extra';
import * as path from 'path';
import { inspect } from 'util';

export enum ProcessorLogLevel {
  error = 0,
  warning = 1,
  info = 2,
  verbose = 3,
}

export interface ProcessorConfig {
  bsConfig?: BsConfig;
  logLevel: ProcessorLogLevel;
  buildTimeImports?: any;
  fileResolver?: FileResolver; //allows us to use a bsc file resolver, prior to processing
}

let docsLink = `\nPlease read the docs for usage details https://github.com/georgejecook/maestro/blob/master/docs/index.md#maestro-cli`;

export function createProcessorConfig(config: any): ProcessorConfig {
  console.log('parsing config ' + inspect(config));
  let processorConfig = config;

  if (typeof config.bsConfig === 'string') {
    try {
      let configPath = path.resolve(config.bsConfig);
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      // config.bsConfig = rawConfig;
      // TODO - fix this when we get proper extends support
      config.bsConfig = rawConfig;
      config.bsConfig.rootDir = path.resolve(path.join(
        path.parse(configPath).dir,
        rawConfig.rootDir
      ));
      config.bsConfig.extends = configPath;
    } catch (e) {
      console.error('could not find valid bsconfig file: ' + config.bsConfig);
      config.bsConfig = null;
    }
  }

  if (!config.bsConfig) {
    throw new Error('Config does not contain bsConfig' + docsLink);
  }

  if (!config.bsConfig.stagingFolderPath) {
    throw new Error('bsconfig does not contain stagingFolderPath' + docsLink);
  }

  if (!config.logLevel) {
    processorConfig.logLevel = ProcessorLogLevel.info;
  }

  if (config.createRuntimeFiles === undefined) {
    processorConfig.createRuntimeFiles = true;
  }

  return processorConfig;
}
