package uz.softwhere.myid

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyIdModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyId")

    AsyncFunction("setValueAsync") { value: String ->
    }
  }
}
