/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as promisify from "pify";
import { OutstandingTaskAwaiter, Exception } from '@microsoft.azure/polyfill'

export class PathNotFoundException extends Exception {
  constructor(path: string, public exitCode: number = 1) {
    super(`File '${path}' not found.`, exitCode);
    Object.setPrototypeOf(this, PathNotFoundException.prototype);
  }
}

export class PathIsNotFileException extends Exception {
  constructor(path: string, public exitCode: number = 1) {
    super(`File '${path}' is not a file.`, exitCode);
    Object.setPrototypeOf(this, PathIsNotFileException.prototype);
  }
}

export class PathIsNotDirectoryException extends Exception {
  constructor(path: string, public exitCode: number = 1) {
    super(`File '${path}' is not a file.`, exitCode);
    Object.setPrototypeOf(this, PathIsNotFileException.prototype);
  }
}


export const exists: (path: string | Buffer) => Promise<boolean> = path => new Promise<boolean>((r, j) => fs.stat(path, (err: NodeJS.ErrnoException, stats: fs.Stats) => err ? r(false) : r(true)));
export const readdir: (path: string | Buffer) => Promise<Array<string>> = promisify(fs.readdir);
export const close: (fd: number) => Promise<void> = promisify(fs.close);
export const readFile: (filename: string) => Promise<string> = promisify(fs.readFile);
export const writeFile: (filename: string, content: string) => Promise<void> = (filename, content) => Promise.resolve(fs.writeFileSync(filename, content)); // for some reason writeFile only produced empty files
export const lstat: (path: string | Buffer) => Promise<fs.Stats> = promisify(fs.lstat);

const fs_rmdir: (path: string | Buffer) => Promise<void> = promisify(fs.rmdir);
const unlink: (path: string | Buffer) => Promise<void> = promisify(fs.unlink);
const fs_mkdir: (path: string | Buffer) => Promise<void> = promisify(fs.mkdir);
export async function mkdir(path: string) {
  if (!await isDirectory(path)) {
    fs_mkdir(path);
  }
}

export async function isDirectory(dirPath: string): Promise<boolean> {
  if (await exists(dirPath)) {
    return (await lstat(dirPath)).isDirectory();
  }
  return false;
}

export async function isFile(filePath: string): Promise<boolean> {
  if (await exists(filePath)) {
    return !(await lstat(filePath)).isDirectory();
  }
  return false;
}

export async function rmdir(dirPath: string) {

  if (!await isDirectory(dirPath)) {
    throw new PathIsNotDirectoryException(dirPath);
  }

  const files = await readdir(dirPath);
  if (files.length) {
    const awaiter = new OutstandingTaskAwaiter();
    for (const file of files) {
      const p = path.join(dirPath, file);

      if (await isDirectory(p)) {
        // folders are recursively rmdir'd 
        awaiter.Await(rmdir(p));
      }
      else {
        // files and symlinks are unlink'd 
        awaiter.Await(unlink(p).catch(() => { }));
      }
    }
    // after all the entries are done
    await awaiter.Wait();
  }
  await fs_rmdir(dirPath);
}

export async function rmFile(filePath: string) {
  if (await exists(filePath)) {
    throw new PathNotFoundException(filePath);
  }

  if ((await lstat(filePath)).isDirectory()) {
    throw new PathIsNotFileException(filePath);
  }

  try {
    // files and symlinks are unlink'd 
    await unlink(filePath);
  } catch (e) {

  }

}