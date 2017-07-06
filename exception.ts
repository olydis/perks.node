/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Exception } from "@microsoft.azure/polyfill"

export class UnsupportedPlatformException extends Exception {
  constructor(platform: string, public exitCode: number = 1) {
    super(`Unsupported Platform: ${platform}`, exitCode);
    Object.setPrototypeOf(this, UnsupportedPlatformException.prototype);
  }
}

export class UnknownFramework extends Exception {
  constructor(framework: string, public exitCode: number = 1) {
    super(`Unknown Framework Version: ${framework}`, exitCode);
    Object.setPrototypeOf(this, UnknownFramework.prototype);
  }
}

export class FrameworkNotInstalledException extends Exception {
  constructor(rootFolder: string, release: string, public exitCode: number = 1) {
    super(`Framework '${release}' not installed in ${rootFolder}`, exitCode);
    Object.setPrototypeOf(this, UnknownFramework.prototype);
  }
}
