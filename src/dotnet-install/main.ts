/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as con from "@microsoft.azure/console"
import * as polyfill from "@microsoft.azure/polyfill"
import * as os from 'os';
import * as fs from 'fs';
import { FrameworkNotInstalledException, UnsupportedPlatformException, UnknownFramework } from "./exception"
import * as req from 'request';
import { unpack } from '@microsoft.azure/unpack'
import { IEvent, EventEmitter, EventEmitterPromise } from '@microsoft.azure/eventing'
import { exists, readdir, rmdir } from '@microsoft.azure/async-io'
import * as path from 'path'

var progress = require('request-progress');

// ensure that we're polyfilled.
polyfill.polyfilled;

// load framework definitions
const frameworks = require("../frameworks.json");

export class ProgressPromise extends EventEmitterPromise<boolean> {

  @EventEmitter.Event public Progress: IEvent<ProgressPromise, number>;
  @EventEmitter.Event public End: IEvent<ProgressPromise, null>;
  @EventEmitter.Event public Start: IEvent<ProgressPromise, null>;
  private started: boolean = false;

  /* @internal */ public SetProgress(percent: number) {
    if (!this.started) {
      this.started = true;
      this.Start.Dispatch(null);
    }
    this.Progress.Dispatch(percent);
  }

  /* @internal */ public SetEnd() {
    this.End.Dispatch(null);
  }
}

function contains(item: string, collection: Array<any>): boolean {
  for (const each in collection) {
    if (each == item) {
      return true;
    }
  }
  return false;
}

export function getVersions(): Array<string> {
  return Object.getOwnPropertyNames(frameworks);
}

export function isVersion(version: string): boolean {
  return getVersions().indexOf(version) > -1;
}

export function isOperatingSystem(version: string, operatingSystem: string): boolean {
  return getOperatingSystems(version).indexOf(operatingSystem) > -1;
}

function getVersionFromRelease(release: string): string {
  for (const version of getVersions()) {
    if (frameworks[version].releases.indexOf(release) > -1) {
      return version;
    }
  }
  return "";
}

export function getReleaseFromVersion(version: string): string {
  if (isVersion(version)) {
    return getReleases(version)[0];
  }
  return version;
}

export function isArchitecture(version: string, operatingSystem: string, architecture: string): boolean {
  getVersionFromRelease(version)

  if (isOperatingSystem(version, operatingSystem)) {
    // using version
    if (frameworks[version].operatingSystems[operatingSystem].indexOf(architecture) > -1) {
      return true;
    }
  }

  const vv = getVersionFromRelease(version);
  if (vv) {
    return isOperatingSystem(vv, operatingSystem)
  }
  return false;
}

export function getReleases(version: string): Array<string> {
  if (isVersion(version)) {
    return frameworks[version].releases;
  }
  return [];
}

export function getAllOperatingSystems() {
  const result = [];
  for (const v of getVersions()) {
    for (const o of getOperatingSystems(v)) {
      if (result.indexOf(o) == -1) {
        result.push(o);
      }
    }
  }
  return result;
}

export function getOperatingSystems(version: string) {
  if (isVersion(version)) {
    return Object.getOwnPropertyNames(frameworks[version].operatingSystems);
  }
  return [];
}

export function getAllArchitectures(): Array<string> {
  const result = [];
  for (const v of getVersions()) {
    for (const o of getOperatingSystems(v)) {
      for (const a of getArchitectures(v, o)) {
        if (result.indexOf(a) == -1) {
          result.push(a);
        }
      }
    }
  }
  return result;
}

export function getArchitectures(version: string, operatingSystem: string): Array<string> {
  if (isOperatingSystem(version, operatingSystem)) {
    return frameworks[version].operatingSystems[operatingSystem];
  }
  return [];
}

export function getDownloadUrl(version: string, operatingSystem: string, architecture: string): string {
  if (isArchitecture(version, operatingSystem, architecture)) {
    return `https://aka.ms/dotnet/${version}/${operatingSystem}/${architecture}`
  }
  throw new UnknownFramework(`${version}/${operatingSystem}/${architecture}`);
}

export async function isInstalled(version: string, folder: string = path.normalize(`${os.homedir()}/.dotnet`)): Promise<boolean> {
  return (await listInstalledFrameworkRevisions(folder)).indexOf(version) > -1;
}

export function installFramework(version: string, operatingSystem: string, architecture: string, folder: string = path.normalize(`${os.homedir()}/.dotnet`), force: boolean = false): ProgressPromise {
  version = getReleaseFromVersion(version);
  const URL = getDownloadUrl(version, operatingSystem, architecture);
  let rq = progress(req(URL), { delay: 500, throttle: 500 });

  const result = new ProgressPromise(isInstalled(version, folder).then(async (i) => {
    if (force || !i) {
      return await unpack(rq, folder)
    }
    return true;
  }));

  rq.on("progress", (state: any) => {
    result.SetProgress(Math.round(state.percent * 100));
  });

  rq.on('end', function () {
    result.SetEnd();
  });

  return result;
}

export function getAllReleasesAndVersions(): Array<string> {
  const result = getVersions();
  for (const v of getVersions()) {
    for (const r of getReleases(v)) {
      if (result.indexOf(r) == -1) {
        result.push(r);
      }
    }
  }
  return result;
}

export function getAllReleases(): Array<string> {
  const result = [];

  for (const v of getVersions()) {
    for (const r of getReleases(v)) {
      if (result.indexOf(r) == -1) {
        result.push(r);
      }
    }
  }
  return result;
}

export function detectOperatingSystem(version: string): string {
  switch (version) {
    case "2.0":
    case "2.0.0-preview1":
      return detectOperatingSystem20();
    case "1.0":
    case "1.0.5":
    case "1.0.4":
      return detectOperatingSystem10();
    case "1.1":
    case "1.1.2":
      return detectOperatingSystem11();
  }
  throw new UnknownFramework(version);
}

function detectOperatingSystem10(): string {
  switch (os.platform()) {
    case 'darwin':
      return 'osx';
    case 'win32':
      return `windows`;

    case 'linux':
      const text = fs.readFileSync(`/etc/os-release`, { encoding: `utf8` }).replace(`"`, ``);
      const osrelease = {
        id: (/ID=(.*)/.exec(text) || [null, null])[1],
        version: (/ID_VERSION=(.*)/.exec(text) || [null, null])[1]
      }

      switch (osrelease.id) {
        case "centos":
          return `centos`;
        case "debian":
          return `debian`;
        case "rhel":
          return `rhel`;
        case "ubuntu":
          switch (osrelease.version) {
            case "14.04":
              return `ubuntu-14.04`;
            case "16.04":
              return `ubuntu-16.04`;
            case "16.10":
              return `ubuntu-16.04`;
          }
      }
      throw new UnsupportedPlatformException(`${os.platform()}-${osrelease.id}-${osrelease.version}-${os.arch()}`);

  }
  throw new UnsupportedPlatformException(`${os.platform()}-${os.arch()}`);
}

function detectOperatingSystem11(): string {
  switch (os.platform()) {
    case 'darwin':
      return 'osx';
    case 'win32':
      return `windows`;

    case 'linux':
      const text = fs.readFileSync(`/etc/os-release`, { encoding: `utf8` }).replace(`"`, ``);
      const osrelease = {
        id: (/ID=(.*)/.exec(text) || [null, null])[1],
        version: (/ID_VERSION=(.*)/.exec(text) || [null, null])[1]
      }

      switch (osrelease.id) {
        case "centos":
          return `centos`;
        case "debian":
          return `debian`;
        case "rhel":
          return `rhel`;
        case "ubuntu":
          switch (osrelease.version) {
            case "14.04":
              return `ubuntu-14.04`;
            case "16.04":
              return `ubuntu-16.04`;
            case "16.10":
              return `ubuntu-16.10`;
          }
        case "fedora":
          return `fedora`;
        case "opensuse":
          return `opensuse`;
      }

      throw new UnsupportedPlatformException(`${os.platform()}-${osrelease.id}-${osrelease.version}-${os.arch()}`);
  }
  throw new UnsupportedPlatformException(`${os.platform()}-${os.arch()}`);
}

function detectOperatingSystem20(): string {
  switch (os.platform()) {
    case 'darwin':
      return 'osx';
    case 'win32':
      return `windows`;
    case 'linux':
      return `linux`;
  }
  throw new UnsupportedPlatformException(`${os.platform()}-${os.arch()}`);
}

export async function listInstalledFrameworkRevisions(folder: string): Promise<Array<string>> {
  if (await exists(folder)) {
    const shared = path.join(folder, "shared", "Microsoft.NETCore.App");
    if (await exists(shared)) {
      // yes there is a shared framework folder. 
      const result = []
      for (const each of await readdir(shared)) {
        // strip build junk off end.
        result.push(each.replace(/(.*?)-(.*?)-.*/g, `$1-$2`));
      }
      return result;
    }
  }
  return [];
}

export async function removeAllFrameworks(folder: string): Promise<void> {
  if (await exists(folder)) {
    await rmdir(folder);
  }
}

export async function removeInstalledFramework(folder: string, release: string): Promise<void> {
  if (await exists(folder)) {
    const fw = await getFrameworkFolder(folder, release);
    await rmdir(fw);

    if (!(await listInstalledFrameworkRevisions(folder)).length) {
      // no frameworks left. remove the whole folder
      await rmdir(folder);
    }
  }
}

export async function getFrameworkFolder(folder: string, release: string): Promise<string> {
  if (await exists(folder)) {
    const shared = path.join(folder, "shared", "Microsoft.NETCore.App");
    if (await exists(shared)) {
      for (const each of await readdir(shared)) {
        // strip build junk off end.
        const fwname = each.replace(/(.*?)-(.*?)-.*/g, `$1-$2`);
        if (fwname == release) {
          return path.join(shared, each);
        }
      }
    }
  }
  throw new FrameworkNotInstalledException(folder, release);
}
