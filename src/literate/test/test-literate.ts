import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as polyfill from '@microsoft.azure/polyfill'
import { Configuration, MessageEmitter } from "../configuration"
import * as assert from "assert";


@suite class literatetests {

  @test async "Do Tests Work"() {
    assert.equal(true, true, "yes")
  }

  private

  @test async "load some config"() {
    const configuration = new Configuration("\n > see https://aka.ms/autorest", undefined, undefined, { "input-file": [] })
    const view = await configuration.CreateView(new MessageEmitter(), true, { debug: true });
    console.log(view.Raw["debug"]);
  }
}