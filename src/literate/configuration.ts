/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataHandleRead, DataStore } from './data-store/data-store';
import { EventEmitter, IEvent } from '@microsoft.azure/eventing';
import { OperationAbortedException, LazyPromise } from '@microsoft.azure/polyfill';
import { IFileSystem } from './file-system';

import { Channel, Message, Range, SourceLocation } from './message';
import { EvaluateGuard, ParseCodeBlocks } from './parsing/literate-yaml';

import { CancellationToken, CancellationTokenSource } from "vscode-jsonrpc";
import { stringify } from './ref/jsonpath';
import { From } from 'linq-es2015';
import { CreateFileUri, CreateFolderUri, EnsureIsFolderUri, ResolveUri } from '@microsoft.azure/async-io';
import { BlameTree } from './source-map/blaming';
import { MergeOverwriteOrAppend, resolveRValue } from './source-map/merging';
import { TryDecodeEnhancedPositionFromName } from './source-map/source-map';

export interface ConfigurationSchema {
  __info?: string | null;
}

export class MessageEmitter extends EventEmitter {
  /**
   * Event: Signals when a message is generated
   */
  @EventEmitter.Event public Message: IEvent<MessageEmitter, Message>;
  private cancellationTokenSource = new CancellationTokenSource();

  constructor() {
    super();
    this.DataStore = new DataStore(this.CancellationToken);
  }
  /* @internal */ public DataStore: DataStore;
  /* @internal */ public get messageEmitter() { return this; }
  /* @internal */ public get CancellationTokenSource(): CancellationTokenSource { return this.cancellationTokenSource; }
  /* @internal */ public get CancellationToken(): CancellationToken { return this.cancellationTokenSource.token; }
}

export class ConfigurationView<T extends ConfigurationSchema> {
  [name: string]: any;

  /* @internal */ constructor(
    /* @internal */public messageEmitter: MessageEmitter,
    /* @internal */public configFileFolderUri: string,
    ...configs: Array<T> // decreasing priority
  ) {

    // grab the least priority as the fundemental base.
    this.rawConfig = configs[configs.length - 1];

    this.rawConfig = <any>{
    };

    for (const config of configs) {
      this.rawConfig = this.MergeConfigurations(this.rawConfig, config);
    }

    this.config = this.ProxifyConfigurationView(this.rawConfig);

    this.Message({ Channel: Channel.Debug, Text: `Creating ConfigurationView : ${configs.length} sections.` });
  }


  // TODO: operate on DataHandleRead and create source map!
  private MergeConfigurations<T extends ConfigurationSchema>(higherPriority: T, lowerPriority: T): T {
    // check guard
    if (lowerPriority.__info && !EvaluateGuard(lowerPriority.__info, higherPriority)) {
      // guard false? => skip
      return higherPriority;
    }

    // merge
    return MergeOverwriteOrAppend(higherPriority, lowerPriority);
  }

  private ValuesOf<T>(value: any): Iterable<T> {
    if (value === undefined) {
      return [];
    }
    if (value instanceof Array) {
      return value;
    }
    return [value];
  }

  private ProxifyConfigurationView(cfgView: any) {
    return new Proxy(cfgView, {
      get: (target, property) => {
        const value = (<any>target)[property];
        if (value && value instanceof Array) {
          const result = [];
          for (const each of value) {
            result.push(<never>resolveRValue(each, "", target, null));
          }
          return result;
        }
        return resolveRValue(value, <string>property, null, cfgView);
      }
    });
  }

  public get Keys(): Array<string> {
    return Object.getOwnPropertyNames(this.config);
  }

  public Dump(title: string = "") {
    console.log(`\n${title}\n===================================`)
    for (const each of Object.getOwnPropertyNames(this.config)) {
      console.log(`${each} : ${(<any>this.config)[each]}`);
    };
  }

  /* @internal */ public get Indexer(): ConfigurationView<T> {
    return new Proxy<ConfigurationView<T>>(this, {
      get: (target, property) => {
        return property in target.config ? (<any>target.config)[property] : this[property];
      }
    });
  }

  /* @internal */ public get DataStore(): DataStore { return this.messageEmitter.DataStore; }
  /* @internal */ public get CancellationToken(): CancellationToken { return this.messageEmitter.CancellationToken; }
  /* @internal */ public get CancellationTokenSource(): CancellationTokenSource { return this.messageEmitter.CancellationTokenSource; }


  private config: T;
  private rawConfig: T;

  // public methods

  public get UseExtensions(): Array<{ name: string, source: string, fullyQualified: string }> {
    const useExtensions = this.Indexer["use-extension"] || {};
    return Object.keys(useExtensions).map(name => {
      const source = useExtensions[name];
      return {
        name: name,
        source: source,
        fullyQualified: JSON.stringify([name, useExtensions[name]])
      };
    });
  }

  public GetEntry(key: keyof T): any {
    let result = this.config as any;
    for (const keyPart of key.split(".")) {
      result = result[keyPart];
    }
    return result;
  }

  public get Raw(): T {
    return this.config;
  }

  public get DebugMode(): boolean {
    return this.config["debug"] as boolean;
  }

  public get VerboseMode(): boolean {
    return this.config["verbose"] as boolean;
  }

  public * GetNestedConfiguration(pluginName: string): Iterable<ConfigurationView<T>> {
    for (const section of this.ValuesOf<any>((this.config as any)[pluginName])) {
      if (section) {
        yield this.GetNestedConfigurationImmediate(section === true ? {} : section);
      }
    }
  }

  public GetNestedConfigurationImmediate(...scope: any[]): ConfigurationView<T> {
    return new ConfigurationView<T>(this.messageEmitter, this.configFileFolderUri, ...scope, this.config).Indexer;
  }

  // message pipeline (source map resolution, filter, ...)
  public Message(m: Message): void {
    if (m.Channel === Channel.Debug && !this.DebugMode) {
      return;
    }

    if (m.Channel === Channel.Verbose && !this.VerboseMode) {
      return;
    }

    try {
      // update source locations to point to loaded Swagger
      if (m.Source) {
        const blameSources = m.Source.map(s => {
          let blameTree: BlameTree | null = null;

          try {
            while (blameTree === null) {
              try {
                blameTree = this.DataStore.Blame(s.document, s.Position);
              } catch (e) {
                const path = s.Position.path as string[];
                if (path) {
                  this.Message({
                    Channel: Channel.Warning,
                    Text: `Could not find the exact path ${JSON.stringify(path)} for ${JSON.stringify(m.Details)}`
                  });
                  if (path.length === 0) {
                    throw e;
                  }
                  path.pop();
                } else {
                  throw e;
                }
              }
            }
          } catch (e) {
            // TODO: activate as soon as .NET swagger loader stuff (inline responses, inline path level parameters, ...)
            //console.log(`Failed blaming '${JSON.stringify(s.Position)}' in '${s.document}'`);
            //console.log(e);
            return [s];
          }

          return blameTree.BlameLeafs().map(r => <SourceLocation>{ document: r.source, Position: Object.assign(TryDecodeEnhancedPositionFromName(r.name) || {}, { line: r.line, column: r.column }) });
        });

        m.Source = From(blameSources).SelectMany(x => x).ToArray();
      }

      // set range (dummy)
      if (m.Source) {
        m.Range = m.Source.map(s => {
          const positionStart = s.Position;
          const positionEnd = <sourceMap.Position>{ line: s.Position.line, column: s.Position.column + (s.Position.length || 3) };

          return <Range>{
            document: s.document,
            start: positionStart,
            end: positionEnd
          };
        });
      }

    } catch (e) {
      this.messageEmitter.Message.Dispatch({ Channel: Channel.Error, Text: `${e}` });
    }
  }
}


export class Configuration<T extends ConfigurationSchema> {
  public defaultConfigurationFilename: string;
  private defaultConfigs: Array<any>;
  public constructor(
    private magicString: string,
    private fileSystem?: IFileSystem,
    private configFileOrFolderUri?: string,
    ...defaultConfigs: Array<any>
  ) {
    this.defaultConfigs = defaultConfigs;
  }

  private async ParseCodeBlocks(configFile: DataHandleRead, contextConfig: ConfigurationView<T>, scope: string): Promise<T[]> {
    // load config
    const hConfig = await ParseCodeBlocks(
      contextConfig,
      configFile,
      contextConfig.DataStore.CreateScope(scope));

    const blocks = hConfig.map(each => {
      const block = each.data.ReadObject<T>();
      if (typeof block !== "object") {
        contextConfig.Message({
          Channel: Channel.Error,
          Text: "Syntax error: Invalid YAML object.",
          Source: [<SourceLocation>{ document: each.data.key, Position: { line: 1, column: 0 } }]
        });
        throw new OperationAbortedException();
      }
      block.__info = each.info;
      return block;
    });
    return blocks;
  }

  public async CreateView(messageEmitter: MessageEmitter, includeDefault: boolean, ...overrideConfigs: Array<any>): Promise<ConfigurationView<T>> {
    const configFileUri = this.fileSystem && this.configFileOrFolderUri
      ? await this.DetectConfigurationFile(this.fileSystem, this.configFileOrFolderUri)
      : null;
    const configFileFolderUri = configFileUri ? ResolveUri(configFileUri, "./") : (this.configFileOrFolderUri || "file:///");

    const createView = () => new ConfigurationView<T>(messageEmitter, configFileFolderUri, ...configSegments, this.defaultConfigs[this.defaultConfigs.length - 1]);

    const configSegments: any[] = [];
    // 1. overrides (CLI, ...)
    configSegments.push(...overrideConfigs);

    // 2. file
    if (configFileUri !== null) {
      const inputView = messageEmitter.DataStore.GetReadThroughScopeFileSystem(this.fileSystem as IFileSystem);
      const blocks = await this.ParseCodeBlocks(
        await inputView.ReadStrict(configFileUri),
        createView(),
        "config");
      configSegments.push(...blocks);
    }

    // 3. default configuration
    if (includeDefault) {
      configSegments.push(...this.defaultConfigs);
    }

    return createView().Indexer;
  }

  public async DetectConfigurationFile(fileSystem: IFileSystem, configFileOrFolderUri: string | null, walkUpFolders: boolean = false): Promise<string | null> {
    if (!configFileOrFolderUri || configFileOrFolderUri.endsWith(".md")) {
      return configFileOrFolderUri;
    }

    // search for a config file, walking up the folder tree
    while (configFileOrFolderUri !== null) {
      // scan the filesystem items for the configuration.
      const configFiles = new Map<string, string>();

      for (const name of await fileSystem.EnumerateFileUris(EnsureIsFolderUri(configFileOrFolderUri))) {
        if (name.endsWith(".md")) {
          const content = await fileSystem.ReadFile(name);
          if (content.indexOf(this.magicString) > -1) {
            configFiles.set(name, content);
          }
        }
      }

      if (configFiles.size > 0) {
        // it's the readme.md or the shortest filename.
        const found =
          From<string>(configFiles.keys()).FirstOrDefault(each => each.toLowerCase().endsWith("/" + this.defaultConfigurationFilename)) ||
          From<string>(configFiles.keys()).OrderBy(each => each.length).First();

        return found;
      }

      // walk up
      const newUriToConfigFileOrWorkingFolder = ResolveUri(configFileOrFolderUri, "..");
      configFileOrFolderUri = !walkUpFolders || newUriToConfigFileOrWorkingFolder === configFileOrFolderUri
        ? null
        : newUriToConfigFileOrWorkingFolder;
    }

    return null;
  }
}