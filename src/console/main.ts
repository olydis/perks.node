/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as marked from "marked";
import * as chalk from "chalk";
import * as moment from "moment";
import * as yargs from 'yargs';
import * as util from 'util'

const MemoryStream = require("memorystream");
const markedTerminal = require("marked-terminal");

marked.setOptions({
  renderer: new markedTerminal({
    heading: chalk.green.bold,
    firstHeading: chalk.green.bold.underline,
    showSectionPrefix: false,
    strong: chalk.bold.cyan,
    em: chalk.underline,
    blockquote: chalk.reset.gray,
    code: chalk.reset.cyan,
    codespan: chalk.reset.bold.gray,
    tableOptions: {
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': ''
        , 'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': ''
        , 'left': '', 'left-mid': '', 'mid': '', 'mid-mid': ''
        , 'right': '', 'right-mid': '', 'middle': ''
      }
    },
    tab: 2
  })
});

(<any>global).console_monkeypatched = false;

function rtrim(str: string, trimRegEx?: string | undefined): string {
  return trimRegEx ? str.replace(new RegExp(trimRegEx + "*$"), '') : str.replace(/\s*$/, '');
}

let pad2 = (n: number) => n <= 99 ? ("0" + n).slice(-2) : n;

const _quiet = yargs.argv.quiet;
const _verbose = yargs.argv.verbose;
const _debug = yargs.argv.debug;

// reset so we can start fresh...
yargs.reset();


/**
 * Enables Perks console enhancements
 * - monkeypatches node's console 
 * - implicitly supports markdown
 * - works thru stdout/stderr  
 * @param {redirectStreams} - redirects original process. stderr/stdout streams to memory streams to stop errant output from libraries (ie, NPM)
 */
export function enhanceConsole(): boolean {

  if (!(<any>global).console_monkeypatched) {
    const log = console.log;
    const error = console.error;
    const warn = console.warn;
    const info = console.info;
    // const debug = console.debug;
    const trace = console.trace;

    const stdout = process.stdout;
    const stderr = process.stderr;


    console.log = (message?: any, ...optionalParams: any[]) => {
      if (!_quiet) {
        if (stdout.isTTY) {
          stdout.write(rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
        } else {
          stdout.write(util.format(message, ...optionalParams) + '\n');
        }
      }
    };

    console.info = (message?: any, ...optionalParams: any[]) => {
      if (_verbose) {
        if (stdout.isTTY) {
          stdout.write(chalk.bold.magenta(`[${Timestamp()}] `) + rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
        } else {
          stdout.write(NoColorTimestamp() + util.format(message, ...optionalParams) + '\n');
        }
      }
    };

    /*
        console.debug = (message?: any, ...optionalParams: any[]) => {
          if (_debug) {
            if (stdout.isTTY) {
              stdout.write(chalk.bold.yellow(`[${Timestamp()}] `) + rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
            } else {
              stdout.write(NoColorTimestamp() + util.format(message, ...optionalParams) + '\n');
            }
          }
        };
    */
    console.error = (message?: any, ...optionalParams: any[]) => {
      if (stderr.isTTY) {
        stderr.write(rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
      } else {
        stderr.write(util.format(message, ...optionalParams) + '\n');
      }
    };

    console.trace = (message?: any, ...optionalParams: any[]) => {
      if (_debug) {
        if (stdout.isTTY) {
          stdout.write(chalk.bold.yellow(`[${Timestamp()}] `) + rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
        } else {
          stdout.write(NoColorTimestamp() + util.format(message, ...optionalParams) + '\n');
        }
      }
    };

    console.warn = (message?: any, ...optionalParams: any[]) => {
      if (!_quiet) {
        if (stdout.isTTY) {
          stdout.write(chalk.bold.yellow(`[${Timestamp()}] `) + rtrim(marked(rtrim(`${util.format(message, ...optionalParams)}`))) + '\n');
        } else {
          stdout.write(NoColorTimestamp() + util.format(message, ...optionalParams) + '\n');
        }
      }
    }
    (<any>global).console_monkeypatched = true;
  }
  return true;
}

export function Timestamp(): string {
  const m = new Date();
  const hh = `${pad2(m.getHours())}`;
  const mm = `${pad2(m.getMinutes())}`;
  const ss = `${pad2(m.getSeconds())}`;

  return chalk.red(`${chalk.gray(hh)}:${chalk.gray(mm)}:${chalk.gray(ss)}`);
}

export function NoColorTimestamp(): string {
  const m = new Date();
  const hh = `${pad2(m.getHours())}`;
  const mm = `${pad2(m.getMinutes())}`;
  const ss = `${pad2(m.getSeconds())}`;

  return `${hh}:${mm}:${ss}`;
}

export interface IYargs extends yargs.Argv {
  app(name: string): IYargs;
  title(text: string): IYargs;
  copyright(text: string): IYargs;

}

let _copyright = "Copyright 2017.";
let _title = "";
let _name = "$0";

export const cli: IYargs = <IYargs>yargs;

cli.app = (name: string) => {
  _name = name;
  (<any>cli).$0 = name;
  cli.usage(`# ${_title}\n${_copyright}\n## Usage: ${_name} <command> [options]`);
  return cli;
};

cli.copyright = (text: string) => {
  _copyright = text
  cli.usage(`# ${_title}\n${_copyright}\n## Usage: ${_name} <command> [options]`);
  return cli;
};

cli.title = (text: string) => {
  _title = text
  cli.usage(`# ${_title}\n${_copyright}\n## Usage: ${_name} <command> [options]`);
  return cli;
};


cli
  .wrap(0)
  .help('help', "`Show help`")
  .option("quiet", {
    describe: "`suppress most output information`",
    type: "boolean",
  }).option("verbose", {
    describe: "`display verbose logging information`",
    type: "boolean",
  })
  .option("debug", {
    describe: "`display debug logging information`",
    type: "boolean",
  })
  .usage(`# ${_title}\n${_copyright}\n## Usage: ${_name} <command> [options]`);