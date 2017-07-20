import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as polyfill from '@microsoft.azure/polyfill'
import * as assert from "assert";


@suite class consoletest {
  @test async "what"() {
    assert.equal(true, true);
  }
}