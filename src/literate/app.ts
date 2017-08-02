#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Configuration, ConfigurationSchema, MessageEmitter, ConfigurationView } from "./configuration"
import { Message } from "./message"
import { DiskFileSystem } from "./file-system"
import { cli, enhanceConsole } from "@microsoft.azure/console"
import { ResolveUri, CreateFolderUri, CreateFileUri, readFile, isFile } from "@microsoft.azure/async-io"
import { Exception } from "@microsoft.azure/polyfill"

import * as os from 'os';
import * as path from 'path'

let exitCode: Promise<number> = Promise.resolve(1);

interface AutoRestConfig extends ConfigurationSchema {
  "input-file": string | Array<string>,
  "tag": string
}

const fileOption = {
  alias: 'f',
  describe: '**configuration file path**',
  default: path.resolve(process.cwd(), `readme.md`)
};

const pathOption = {
  alias: 'p',
  describe: '**path of file to retreive tags for**',
  required: true

};

enhanceConsole()
const msgs = new MessageEmitter();

async function main() {
  try {

    msgs.Message.Subscribe((src, each) => console.log(each.Text));
    const args = cli
      .app("literate-configuration")
      .title("Work with a literate config file")
      .copyright("(C) 2017 **Microsoft Corporation.**")
      .command('list-tags', '**Show tags in file**', {
        file: fileOption
      }, (args) => exitCode = listTags(args))
      .command('get-tags', '**Show tags file is referenced by**', {
        file: fileOption,
        path: pathOption
      }, (args) => exitCode = getTags(args))
      .command('get-files', "**Get the files for a given tag**", {
        file: fileOption,
        tag: { alias: 't', description: "**tag name**", required: true }
      }, (args) => exitCode = getFiles(args))
      .argv;

    process.exit(await exitCode);
  } catch (E) {

    if (E instanceof Exception) {
      console.error(E.message);
      process.exit(E.exitCode);
    }
    console.error(E);
    process.exit(100);
  }
}
function scanForTags(content: string): Array<string> {
  const result = new Array<string>();

  const rx = /\$\(tag\)(.*)/g;

  let match = rx.exec(content);
  while (match) {
    const vrx = /['"](.*?)['"]/g
    let v = vrx.exec(match[1]);

    if (v && v.length && result.indexOf(v[1]) == -1) {
      result.push(v[1]);
    }
    match = rx.exec(content);
  }
  return result;
}

async function checkFile(args): Promise<string> {
  const file = path.resolve(args.file);
  if (!await isFile(file)) {

    throw new Exception(`File '${file}' is not a file.`)
  }
  return file;
}

async function read(file: string, tag: string | null = null): Promise<ConfigurationView<AutoRestConfig>> {
  // autorest configuration type
  const cfg = new Configuration<AutoRestConfig>("\n> see https://aka.ms/autorest", new DiskFileSystem("readme.md"), ResolveUri(CreateFolderUri(process.cwd()), CreateFileUri(file) || "."), {
    "input-file": [],
  });

  // generate a view 
  if (tag) {
    return await cfg.CreateView(msgs, true, { tag: tag });
  }
  return await cfg.CreateView(msgs, true);
}

async function getFiles(args: any): Promise<number> {
  const file = await checkFile(args);
  console.log((await read(file, args.tag))["input-file"]);
  return 0;
}

async function listTags(args: any): Promise<number> {
  const file = await checkFile(args);
  const tags = scanForTags(await readFile(file));

  console.log(tags);

  return 0;
}


async function getTags(args: any): Promise<number> {
  const file = await checkFile(args);
  const allTags = scanForTags(await readFile(file));
  const tags = new Array<string>();
  let i = 0;
  for (const each of allTags) {
    if (!i++) {
      continue;
    }

    console.log(`checking tag ${each}`);
    const inputs = (await read(file, each))["input-file"];

    if (inputs.indexOf(args.path) > -1) {
      console.log(` adding ${each}`);
      tags.push(each);
    }
  }
  console.log(tags);

  return 0;
}



main();


