/// <reference types="node" />
import * as childProcess from 'child_process';
import { Exception } from '@microsoft.azure/polyfill';
import { ProgressPromise } from '@microsoft.azure/eventing';
export declare class UnresolvedPackageException extends Exception {
    constructor(packageId: string);
}
export declare class InvalidPackageIdentityException extends Exception {
    constructor(name: string, version: string, message: string);
}
export declare class PackageInstallationException extends Exception {
    constructor(name: string, version: string, message: string);
}
export declare class UnsatisfiedEngineException extends Exception {
    constructor(name: string, version: string, message?: string);
}
export declare class MissingStartCommandException extends Exception {
    constructor(extension: Extension);
}
/**
 * A Package is a representation of a npm package.
 *
 * Once installed, a Package is an Extension
 */
export declare class Package {
    resolvedInfo: any;
    packageMetadata: any;
    extensionManager: ExtensionManager;
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly source: string;
    readonly engines: Array<any>;
    install(force?: boolean): Promise<Extension>;
    readonly allVersions: Promise<Array<string>>;
}
/**
 * Extension is an installed Package
 * @extends Package
 * */
export declare class Extension extends Package {
    private installationPath;
    /**
     * The installed location the package.
     */
    readonly location: string;
    /**
     * The path to the installed npm package (internal to 'location')
     */
    readonly modulePath: string;
    /**
     * the path to the package.json file for the npm packge.
     */
    readonly packageJsonPath: string;
    /**
   * the path to the readme.md configuration file for the extension.
   */
    readonly configurationPath: Promise<string>;
    /** the loaded package.json information */
    readonly definition: any;
    readonly configuration: Promise<string>;
    remove(): Promise<void>;
    start(): Promise<childProcess.ChildProcess>;
}
export declare class ExtensionManager {
    private installationPath;
    dotnetPath: string;
    static Create(installationPath: string): Promise<ExtensionManager>;
    private constructor();
    installEngine(name: string, version: string, force?: boolean): ProgressPromise<void>;
    getPackageVersions(name: string): Promise<string[]>;
    findPackage(name: string, version?: string): Promise<Package>;
    getInstalledExtensions(): Promise<Array<Extension>>;
    installPackage(pkg: Package, force?: boolean): ProgressPromise<Extension>;
    private _installPackage(pkg, force, progress);
    removeExtension(extension: Extension): Promise<void>;
    start(extension: Extension): Promise<childProcess.ChildProcess>;
}
