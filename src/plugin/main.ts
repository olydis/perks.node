/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { config, load, commands } from 'npm'
import * as hgi from 'hosted-git-info'
import * as childProcess from 'child_process'
import * as asyncIO from '@microsoft.azure/async-io'
import { Exception, shallowCopy } from '@microsoft.azure/polyfill'
import * as npa from 'npm-package-arg'
import * as u from 'util';
import * as os from 'os';
import * as dotnet from "dotnet-install"

import * as semver from 'semver';


import * as path from 'path';
import * as fetch from "npm/lib/fetch-package-metadata";

type Config = typeof config;
process.chdir("c:/tmp");

const npm_config = new Promise<Config>((r, j) => {
  load({
    prefix: "c:/tmp/prefixed",
    registry: "https://registry.npmjs.org/"
  }, (e, c) => {
    //console.log("back from load : " + c)
    r(c);
  });
});

export class UnresolvedPackageException extends Exception {
  constructor(packageId: string) {
    super(`Unable to resolve package '${packageId}'.`, 1);
    Object.setPrototypeOf(this, UnresolvedPackageException.prototype);
  }
}

export class InvalidPackageIdentityException extends Exception {
  constructor(name: string, version: string, message: string) {
    super(`Package '${name}' - '${version}' is not a valid package reference:\n  ${message}`, 1);
    Object.setPrototypeOf(this, InvalidPackageIdentityException.prototype);
  }
}

export class PackageInstallationException extends Exception {
  constructor(name: string, version: string, message: string) {
    super(`Package '${name}' - '${version}' failed to install:\n  ${message}`, 1);
    Object.setPrototypeOf(this, PackageInstallationException.prototype);
  }
}
export class UnsatisfiedEngineException extends Exception {
  constructor(name: string, version: string) {
    super(`Unable to find matching engine '${name}' - '${version}'`, 1);
    Object.setPrototypeOf(this, UnsatisfiedEngineException.prototype);
  }
}


/**
 * A Package is a representation of a npm package.
 * 
 * Once installed, a Package is a Plugin
 */
export interface Package {
  id: string;
  name: string;
  version: string;
  source: string;
  engines: any;
}

/** 
 * Plugin is an installed Package 
 * @extends Package
 * */
export interface Plugin extends Package {
  definition: any;
  location: string;
}

function npmInstall(name: string, version: string, packageSpec: string): Promise<Array<string>> {
  return new Promise((r, j) => commands.install([packageSpec], (err, r1, r2, r3, r4) => err ? j(new PackageInstallationException(name, version, err.message)) : r([r1, r2, r3, r4])));
}

async function fetchPackageMetadata(spec: string, where: string, opts: any): Promise<any> {
  await npm_config;
  return new Promise<any>((r, j) => {
    fetch(spec, where, opts, (er, pkg) => {
      if (er) {
        return j(new UnresolvedPackageException(spec));
      }
      return r(pkg);
    })
  });
}

function resolveName(name: string, version: string) {
  try {
    return npa.resolve(name, version);
  } catch (e) {
    if (e instanceof Error) {
      throw new InvalidPackageIdentityException(name, version, e.message);
    }
  }
}

export class PluginManager {
  public static async Create(installationPath: string): Promise<PluginManager> {
    if (!asyncIO.exists(installationPath)) {
      await asyncIO.mkdir(installationPath);
    }
    if (!asyncIO.isDirectory(installationPath)) {
      throw new Exception(`Plugin folder '${installationPath}' is not a valid directory`);
    }
    return new PluginManager(installationPath);
  }

  private constructor(private installationPath: string) {

  }

  public async installEngine(name: string, version: string): Promise<any> {
    switch (name) {
      case "dotnet":
        const selectedVersion = semver.maxSatisfying(dotnet.getAllReleasesAndVersions(), version, true)
        if (!selectedVersion) {
          throw new UnsatisfiedEngineException(name, version)
        }
        const os = dotnet.detectOperatingSystem(selectedVersion);
        if (!os) {

        }
        break;
      case "node":
      case "npm":
        // no worries with these for now
        break
    }
  }

  public async findPackage(name: string, version: string = "latest"): Promise<Package> {
    // version can be a version or any one of the formats that 
    // npm accepts (path, targz, git repo)

    const resolved = resolveName(name, version);

    // get the package metadata
    const pm = await fetchPackageMetadata(resolved.raw, process.cwd(), {});

    return {
      id: pm._id,
      name: pm.name,
      version: pm.version,
      source: pm._spec,
      engines: pm.engines
    };
  }

  public async *getInstalledPlugins(): AsyncIterable<Plugin> {

  }

  public async installPackage(pkg: Package): Promise<Plugin> {
    const cc = <any>await npm_config;
    const plugin = <Plugin>shallowCopy(pkg);
    plugin.location = path.normalize(`${this.installationPath}/${pkg.id}`);

    // change directory
    const cwd = process.cwd();
    process.chdir(this.installationPath);

    try {
      // set the prefix to the target location
      cc.localPrefix = plugin.location;
      cc.globalPrefix = plugin.location;
      cc.prefix = plugin.location;

      // run NPM INSTALL for the package.
      const results = await npmInstall(pkg.name, pkg.version, plugin.source);

      // load the package information into the definition.
      plugin.definition = require(`${plugin.location}/node_modules/${plugin.name}/package.json`);
    } catch (e) {
      // clean up the attempted install directory
      if (await asyncIO.isDirectory(plugin.location)) {
        await asyncIO.rmdir(plugin.location);
      }

      if (e instanceof Exception) {
        throw Exception
      }

      if (e instanceof Error) {
        throw new PackageInstallationException(pkg.name, pkg.version, e.message);
      }
      throw new PackageInstallationException(pkg.name, pkg.version, `${e}`);
    }
    finally {
      process.chdir(cwd);
    }
    return plugin;
  }

  public async removePackage(plugin: Plugin): Promise<void> {

  }

  public async start(plugin: Plugin): Promise<childProcess.ChildProcess | null> {
    return null;
  }
}