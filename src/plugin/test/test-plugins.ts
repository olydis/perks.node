import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as os from 'os'
import * as fs from 'fs'
import * as polyfill from '@microsoft.azure/polyfill'
import * as assert from "assert";


import { PluginManager, UnresolvedPackageException, InvalidPackageIdentityException } from "../main"
// ensure
polyfill.polyfilled;

const tmpFolder = fs.mkdtempSync(`${os.tmpdir()}/install`);
const pluginManager = PluginManager.Create(fs.mkdtempSync(`${os.tmpdir()}/install-pkg`));

@suite class TestPlugins {

  pluginManager: PluginManager;

  async before() {
    this.pluginManager = await pluginManager;
  }

  @test async "FindPackage- in github"() {
    // github repo style
    const npmpkg = await this.pluginManager.findPackage("npm", "npm/npm");
    assert.equal(npmpkg.name, "npm");
  }

  @test async "FindPackage- in npm"() {
    const p = await this.pluginManager.findPackage("autorest");
    assert.equal(p.name, "autorest");
  }

  @test async "FindPackage- unknown package"() {
    let threw = false;
    try {
      const p = await this.pluginManager.findPackage("koooopasdpasdppasdpa");
    } catch (e) {
      if (e instanceof UnresolvedPackageException) {
        threw = true;
      }
    }
    assert.equal(threw, true, "Expected unknown package to throw UnresolvedPackageException");
  }

  @test async "BadPackageID"() {
    let threw = false;
    try {
      await this.pluginManager.findPackage("LLLLl", "$DDFOIDFJIODFJ");
    } catch (e) {
      if (e instanceof InvalidPackageIdentityException) {
        threw = true;
      }
    }
    assert.equal(threw, true, "Expected bad package id to throw InvalidPackageIdentityException");
  }

  @test async "Install plugin"() {

    const dni = await this.pluginManager.findPackage("dotnet-install");
    const plugin = await this.pluginManager.installPackage(dni);
    console.log(`Location: ${plugin.location}`);

  }
}