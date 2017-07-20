import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as polyfill from '@microsoft.azure/polyfill'
import * as assert from "assert";
import * as fs from 'fs'
import * as up from '../main'
import * as os from 'os'
import * as path from 'path'


@suite class unpack {
  @test async "tgz"() {
    const tmpFolder = fs.mkdtempSync(`${os.tmpdir()}/test-unpack`);
    try {
      const stream = fs.createReadStream(`${__dirname}/../../test/license.tgz`);
      assert.equal(true, await up.unpack(stream, tmpFolder));

      const license = fs.readFileSync(`${tmpFolder}/LICENSE`);
      assert.equal(license.length, 1183);
    } finally {
      try {
        fs.unlinkSync(`${tmpFolder}/LICENSE`)
      } finally {
        fs.rmdirSync(tmpFolder);
      }
    }
  }

  @test async "zip"() {
    const tmpFolder = fs.mkdtempSync(`${os.tmpdir()}/test-unpack`);
    try {
      const stream = fs.createReadStream(`${__dirname}/../../test/license.zip`);
      assert.equal(true, await up.unpack(stream, tmpFolder));
      const license = fs.readFileSync(`${tmpFolder}/LICENSE.TXT`);
      assert.equal(license.length, 1183);
    } finally {
      try {
        fs.unlinkSync(`${tmpFolder}/LICENSE.TXT`);
      } finally {
        fs.rmdirSync(tmpFolder);
      }
    }
  }
}