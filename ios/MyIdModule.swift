import ExpoModulesCore

public class MyIdModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyId")

    AsyncFunction("setValueAsync") { (value: String) in
    }
  }
}
