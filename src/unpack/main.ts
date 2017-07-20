/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tgz from 'tar.gz2'
import * as unzip from 'unzipper'
import { Stream } from 'stream'
import * as peek from 'buffer-peek-stream'

export function unpack(stream: Stream, targetFolder: string): Promise<boolean> {
  return new Promise<boolean>((r, j) => {
    peek(stream, 1024, function (err, buf, outputStream) {
      let u: any = null;

      // reject on any errors
      if (err) {
        j(err);
      }

      if (buf[0] == 0x50 && buf[1] == 0x4b) {
        // this is a zip file
        u = outputStream.pipe(unzip.Extract({ path: targetFolder }));
      } else {
        if (buf[0] == 31 && buf[1] == 139) {
          // this is a tar.gz file
          u = outputStream.pipe(tgz().createWriteStream(targetFolder));
        }
        else {
          // unknown file type.
          j(new Error("unknown stream content"))
        }
      }
      u.on('error', (err) => j(new Error(`${err} error during unpacking.`)));

      // give it a moment after closing the stream. 
      u.on('finish', () => setTimeout(() => r(true), 500));
    });
  });
}

