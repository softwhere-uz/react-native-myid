import ExpoModulesCore
import MyIdSDK
import UIKit

// MARK: - Records (mirror the TypeScript MyIdConfig)

struct MyIdOrganizationDetailsRecord: Record {
  @Field var phoneNumber: String?
  /// A base64-encoded image (no data-URI prefix). Remote URLs are ignored on iOS.
  @Field var logo: String?
}

struct MyIdAppearanceRecord: Record {
  @Field var colorPrimary: String?
  @Field var colorOnPrimary: String?
  @Field var colorError: String?
  @Field var colorSuccess: String?
  @Field var buttonCornerRadius: Double?
}

struct MyIdConfigRecord: Record {
  @Field var sessionId: String = ""
  @Field var clientHash: String = ""
  @Field var clientHashId: String = ""
  @Field var environment: String = "PRODUCTION"
  @Field var entryType: String = "IDENTIFICATION"
  @Field var locale: String?
  @Field var residency: String?
  @Field var cameraShape: String?
  @Field var cameraSelector: String?
  @Field var minAge: Int?
  @Field var distance: Double?
  @Field var showErrorScreen: Bool?
  @Field var organizationDetails: MyIdOrganizationDetailsRecord?
  @Field var appearance: MyIdAppearanceRecord?
  // Android/HMS only — accepted for cross-platform parity, ignored on iOS.
  @Field var huaweiAppId: String?
}

// MARK: - Module

public class MyIdModule: Module {
  /// Retains the delegate for the lifetime of an in-flight flow (and doubles as
  /// an "in progress" guard, since MyID presents a single modal flow).
  private var activeDelegate: MyIdFlowDelegate?

  public func definition() -> ModuleDefinition {
    Name("MyId")

    AsyncFunction("identify") { (config: MyIdConfigRecord, promise: Promise) in
      // Present on the main thread; the small delay mirrors the reference bridge
      // and lets the React Native view settle before MyID takes over the screen.
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
        self?.startIdentify(config, promise)
      }
    }
  }

  private func startIdentify(_ record: MyIdConfigRecord, _ promise: Promise) {
    if activeDelegate != nil {
      promise.resolve([
        "status": "error",
        "kind": "sdk",
        "message": "A MyID flow is already in progress.",
      ])
      return
    }

    let config = MyIdConfig()
    config.sessionId = record.sessionId
    config.clientHash = record.clientHash
    config.clientHashId = record.clientHashId
    config.environment = record.environment == "SANDBOX" ? .debug : .production
    config.entryType = Self.entryType(record.entryType)
    if let locale = record.locale { config.locale = Self.locale(locale) }
    if let residency = record.residency { config.residency = Self.residency(residency) }
    if let shape = record.cameraShape { config.cameraShape = Self.cameraShape(shape) }
    if let selector = record.cameraSelector { config.cameraSelector = Self.cameraSelector(selector) }
    if let minAge = record.minAge { config.minAge = minAge }
    if let distance = record.distance { config.distance = Float(distance) }
    if let showErrorScreen = record.showErrorScreen { config.showErrorScreen = showErrorScreen }
    if let org = record.organizationDetails { config.organizationDetails = Self.organizationDetails(org) }
    if let appearance = record.appearance { config.appearance = Self.appearance(appearance) }

    let delegate = MyIdFlowDelegate(promise: promise) { [weak self] in
      self?.activeDelegate = nil
    }
    activeDelegate = delegate
    MyIdClient.start(withConfig: config, withDelegate: delegate)
  }

  // MARK: - Enum mapping (TS string -> SDK enum)

  private static func entryType(_ value: String) -> MyIdEntryType {
    switch value {
    case "FACE_DETECTION": return .faceDetection
    case "VIDEO_IDENTIFICATION": return .videoIdentification
    default: return .identification
    }
  }

  private static func locale(_ value: String) -> MyIdLocale {
    switch value {
    case "UZ": return .uzbek
    case "RU": return .russian
    default: return .english
    }
  }

  private static func residency(_ value: String) -> MyIdResidency {
    switch value {
    case "RESIDENT": return .resident
    case "NON_RESIDENT": return .nonResident
    default: return .userDefined
    }
  }

  private static func cameraShape(_ value: String) -> MyIdCameraShape {
    return value == "ELLIPSE" ? .ellipse : .circle
  }

  private static func cameraSelector(_ value: String) -> MyIdCameraSelector {
    return value == "BACK" ? .back : .front
  }

  private static func organizationDetails(_ record: MyIdOrganizationDetailsRecord) -> MyIdOrganizationDetails {
    let details = MyIdOrganizationDetails()
    details.phoneNumber = record.phoneNumber
    if let logo = record.logo, let data = Data(base64Encoded: logo), let image = UIImage(data: data) {
      details.logo = image
    }
    return details
  }

  private static func appearance(_ record: MyIdAppearanceRecord) -> MyIdAppearance {
    let appearance = MyIdAppearance()
    appearance.colorPrimary = UIColor(hexString: record.colorPrimary)
    appearance.colorOnPrimary = UIColor(hexString: record.colorOnPrimary)
    appearance.colorError = UIColor(hexString: record.colorError)
    appearance.colorSuccess = UIColor(hexString: record.colorSuccess)
    if let radius = record.buttonCornerRadius { appearance.buttonCornerRadius = Float(radius) }
    return appearance
  }
}

// MARK: - Delegate

/// Bridges the MyID delegate callbacks to the JS promise, resolving the shared
/// internal outcome protocol `{ status: 'success' | 'cancelled' | 'error', … }`.
/// The JS wrapper turns non-success outcomes into a rejected `MyIdError`.
private final class MyIdFlowDelegate: NSObject, MyIdClientDelegate {
  private let promise: Promise
  private let onFinished: () -> Void
  private var isSettled = false

  init(promise: Promise, onFinished: @escaping () -> Void) {
    self.promise = promise
    self.onFinished = onFinished
  }

  private func settle(_ body: [String: Any]) {
    guard !isSettled else { return }
    isSettled = true
    promise.resolve(body)
    onFinished()
  }

  func onSuccess(result: MyIdResult) {
    var body: [String: Any] = ["status": "success", "code": result.code]
    if let image = result.image, let data = image.pngData() {
      body["base64Image"] = data.base64EncodedString()
    }
    settle(body)
  }

  func onError(exception: MyIdException) {
    settle([
      "status": "error",
      "kind": MyIdFlowDelegate.kind(forCode: exception.code),
      "code": exception.code,
      "message": exception.message,
    ])
  }

  func onUserExited() {
    settle(["status": "cancelled"])
  }

  func onEvent(event: MyIdEvent) {
    // Progress events (camera opened, face captured, …) — not surfaced through
    // the single-shot promise.
  }

  /// Best-effort mapping of SDK numeric codes to our discriminated error kind.
  /// The authoritative code table lives behind MyID's partner portal, so the
  /// numeric `code` is always passed through for callers to branch on.
  private static func kind(forCode code: Int) -> String {
    switch code {
    case 102: return "permission"
    default: return "sdk"
    }
  }
}

// MARK: - UIColor hex helper

private extension UIColor {
  convenience init?(hexString: String?) {
    guard let hexString else { return nil }
    var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if hex.hasPrefix("#") { hex.removeFirst() }
    guard hex.count == 6 || hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
    let hasAlpha = hex.count == 8
    let r, g, b, a: CGFloat
    if hasAlpha {
      r = CGFloat((value & 0xFF00_0000) >> 24) / 255
      g = CGFloat((value & 0x00FF_0000) >> 16) / 255
      b = CGFloat((value & 0x0000_FF00) >> 8) / 255
      a = CGFloat(value & 0x0000_00FF) / 255
    } else {
      r = CGFloat((value & 0xFF0000) >> 16) / 255
      g = CGFloat((value & 0x00FF00) >> 8) / 255
      b = CGFloat(value & 0x0000FF) / 255
      a = 1
    }
    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
