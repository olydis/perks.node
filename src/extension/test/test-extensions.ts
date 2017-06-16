import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as os from 'os'
import * as asyncio from '@microsoft.azure/async-io'
import * as util from 'util';

import * as fs from 'fs'
import * as polyfill from '@microsoft.azure/polyfill'
import * as assert from "assert";

import { ExtensionManager, UnresolvedPackageException, InvalidPackageIdentityException } from "../main"
// ensure
polyfill.polyfilled;

@suite class TestExtensions {
  private tmpFolder = fs.mkdtempSync(`${os.tmpdir()}/install-pkg`);

  extensionManager: ExtensionManager;

  async before() {
    await asyncio.mkdir(this.tmpFolder);
    this.extensionManager = await ExtensionManager.Create(this.tmpFolder);
  }

  async after() {
    await asyncio.rmdir(this.tmpFolder);
  }

  @test async "FindPackage- in github"() {
    // github repo style
    const npmpkg = await this.extensionManager.findPackage("npm", "npm/npm");
    assert.equal(npmpkg.name, "npm");
  }

  @test async "FindPackage- in npm"() {
    const p = await this.extensionManager.findPackage("autorest");
    assert.equal(p.name, "autorest");
  }

  @test async "FindPackage- unknown package"() {
    let threw = false;
    try {
      const p = await this.extensionManager.findPackage("koooopasdpasdppasdpa");
    } catch (e) {
      if (e instanceof UnresolvedPackageException) {
        threw = true;
      }
    }
    assert.equal(threw, true, "Expected unknown package to throw UnresolvedPackageException");
  }

  @test async "BadPackageID- garbage name"() {
    let threw = false;
    try {
      await this.extensionManager.findPackage("LLLLl", "$DDFOIDFJIODFJ");
    } catch (e) {
      if (e instanceof InvalidPackageIdentityException) {
        threw = true;
      }
    }
    assert.equal(threw, true, "Expected bad package id to throw InvalidPackageIdentityException");
  }

  @test async "Install Extension"() {
    const dni = await this.extensionManager.findPackage("echo-cli", "*");
    const extension = await this.extensionManager.installPackage(dni);

    for await (const each of this.extensionManager.getInstalledExtensions()) {
      // make sure we have one extension installed and that it is echo-cli (for testing)
      assert.equal(each.name, "echo-cli");
    }
  }
}