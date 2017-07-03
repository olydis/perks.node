"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_typescript_1 = require("mocha-typescript");
const os = require("os");
const asyncio = require("@microsoft.azure/async-io");
const fs = require("fs");
const polyfill = require("@microsoft.azure/polyfill");
const assert = require("assert");
const main_1 = require("../main");
// ensure
polyfill.polyfilled;
let TestExtensions = class TestExtensions {
    constructor() {
        this.tmpFolder = fs.mkdtempSync(`${os.tmpdir()}/install-pkg`);
    }
    async before() {
        await asyncio.mkdir(this.tmpFolder);
        this.extensionManager = await main_1.ExtensionManager.Create(this.tmpFolder);
    }
    async after() {
        await asyncio.rmdir(this.tmpFolder);
    }
    async "FindPackage- in github"() {
        // github repo style
        const npmpkg = await this.extensionManager.findPackage("npm", "npm/npm");
        assert.equal(npmpkg.name, "npm");
    }
    async "FindPackage- in npm"() {
        const p = await this.extensionManager.findPackage("autorest");
        assert.equal(p.name, "autorest");
    }
    async "FindPackage- unknown package"() {
        let threw = false;
        try {
            const p = await this.extensionManager.findPackage("koooopasdpasdppasdpa");
        }
        catch (e) {
            if (e instanceof main_1.UnresolvedPackageException) {
                threw = true;
            }
        }
        assert.equal(threw, true, "Expected unknown package to throw UnresolvedPackageException");
    }
    async "BadPackageID- garbage name"() {
        let threw = false;
        try {
            await this.extensionManager.findPackage("LLLLl", "$DDFOIDFJIODFJ");
        }
        catch (e) {
            if (e instanceof main_1.InvalidPackageIdentityException) {
                threw = true;
            }
        }
        assert.equal(threw, true, "Expected bad package id to throw InvalidPackageIdentityException");
    }
    async "View Versions"() {
        // gets a package
        const pkg = await this.extensionManager.findPackage("echo-cli");
        // finds out if there are more versions
        assert.equal((await pkg.allVersions).length > 5, true);
    }
    async "Install Extension"() {
        const dni = await this.extensionManager.findPackage("echo-cli", "1.0.8");
        const installing = this.extensionManager.installPackage(dni);
        installing.Message.Subscribe((s, m) => { console.log(`Installer:${m}`); });
        const extension = await installing;
        assert.notEqual(await extension.configuration, "");
        let done = false;
        for (const each of await this.extensionManager.getInstalledExtensions()) {
            done = true;
            // make sure we have one extension installed and that it is echo-cli (for testing)
            assert.equal(each.name, "echo-cli");
        }
        assert.equal(done, true, "Package is not installed");
    }
    async "Install Extension via star"() {
        const dni = await this.extensionManager.findPackage("echo-cli", "*");
        const installing = this.extensionManager.installPackage(dni);
        installing.Message.Subscribe((s, m) => { console.log(`Installer:${m}`); });
        const extension = await installing;
        assert.notEqual(await extension.configuration, "");
        let done = false;
        for (const each of await this.extensionManager.getInstalledExtensions()) {
            done = true;
            // make sure we have one extension installed and that it is echo-cli (for testing)
            assert.equal(each.name, "echo-cli");
        }
        assert.equal(done, true, "Package is not installed");
    }
    async "Force install"() {
        const dni = await this.extensionManager.findPackage("echo-cli", "*");
        const installing = this.extensionManager.installPackage(dni);
        installing.Message.Subscribe((s, m) => { console.log(`Installer:${m}`); });
        const extension = await installing;
        assert.notEqual(await extension.configuration, "");
        // erase the readme.md file in the installed folder (check if force works to reinstall)
        await asyncio.rmFile(await extension.configurationPath);
        // reinstall with force!
        const installing2 = this.extensionManager.installPackage(dni, true);
        installing.Message.Subscribe((s, m) => { console.log(`Installer:${m}`); });
        const extension2 = await installing2;
        // is the file back?
        assert.notEqual(await extension2.configuration, "");
    }
};
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "FindPackage- in github", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "FindPackage- in npm", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "FindPackage- unknown package", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "BadPackageID- garbage name", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "View Versions", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "Install Extension", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "Install Extension via star", null);
__decorate([
    mocha_typescript_1.test
], TestExtensions.prototype, "Force install", null);
TestExtensions = __decorate([
    mocha_typescript_1.suite
], TestExtensions);
//# sourceMappingURL=test-extensions.js.map