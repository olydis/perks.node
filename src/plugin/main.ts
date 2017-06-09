/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as npm from 'npm'
import * as hgi from 'hosted-git-info'
import * as childProcess from 'child_process'
import * as asyncIO from '@microsoft.azure/async-io'
import { Exception, shallowCopy } from '@microsoft.azure/polyfill'
import * as npa from 'npm-package-arg'
import * as u from 'util';
import * as os from 'os';

import * as path from 'path';
import * as fetch from "npm/lib/fetch-package-metadata";

const npm_config = new Promise<any>((r, j) => {
  npm.load({
    registry: "https://registry.npmjs.org/"
  }, (e, c) => {
    //console.log("back from load : " + c)
    r();
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

function npmInstall(...inputs): Promise<Array<string>> {
  return new Promise((r, j) => {
    npm.commands.install(inputs, (err, r1, r2, r3, r4) => {

      if (err) {
        console.log(err);
        j(err);
      }
      console.log(r1);
      r([r1, r2, r3, r4]);
    });
  });
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

    const plugin = <Plugin>shallowCopy(pkg);
    plugin.location = `${this.installationPath}/${pkg.id}`;
    process.chdir(this.installationPath);

    await new Promise<any>((r, j) => {
      npm.load({
        registry: "https://registry.npmjs.org/",
        prefix: plugin.location,

      }, (e, c) => {
        //console.log("back from load : " + c)
        r();
      });
    });

    await npmInstall(plugin.source);

    return plugin;
  }

  public async removePackage(plugin: Plugin): Promise<void> {

  }

  public async start(plugin: Plugin): Promise<childProcess.ChildProcess | null> {
    return null;
  }
}