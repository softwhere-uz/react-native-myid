package uz.softwhere.myid

import android.graphics.Bitmap
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import uz.myid.android.sdk.capture.MyIdClient
import uz.myid.android.sdk.capture.MyIdConfig
import uz.myid.android.sdk.capture.MyIdException
import uz.myid.android.sdk.capture.MyIdResult
import uz.myid.android.sdk.capture.MyIdResultListener
import uz.myid.android.sdk.capture.model.MyIdCameraSelector
import uz.myid.android.sdk.capture.model.MyIdCameraShape
import uz.myid.android.sdk.capture.model.MyIdEntryType
import uz.myid.android.sdk.capture.model.MyIdEnvironment
import uz.myid.android.sdk.capture.model.MyIdEvent
import uz.myid.android.sdk.capture.model.MyIdGraphicFieldType
import uz.myid.android.sdk.capture.model.MyIdLocale
import uz.myid.android.sdk.capture.model.MyIdOrganizationDetails
import uz.myid.android.sdk.capture.model.MyIdResidency
import java.io.ByteArrayOutputStream

// Records mirror the TypeScript MyIdConfig.
class MyIdOrganizationDetailsRecord : Record {
  @Field var phoneNumber: String? = null
  // iOS accepts a base64 logo; on Android the SDK's logo is a drawable resource
  // id, so a base64 string cannot be mapped here — accepted and ignored.
  @Field var logo: String? = null
}

class MyIdConfigRecord : Record {
  @Field var sessionId: String = ""
  @Field var clientHash: String = ""
  @Field var clientHashId: String = ""
  @Field var environment: String = "PRODUCTION"
  @Field var entryType: String = "IDENTIFICATION"
  @Field var locale: String? = null
  @Field var residency: String? = null
  @Field var cameraShape: String? = null
  @Field var cameraSelector: String? = null
  @Field var minAge: Int? = null
  @Field var distance: Double? = null
  @Field var showErrorScreen: Boolean? = null
  @Field var organizationDetails: MyIdOrganizationDetailsRecord? = null
  @Field var huaweiAppId: String? = null
  // iOS-only appearance; accepted and ignored on Android (XML-resource themed).
  @Field var appearance: Map<String, Any?>? = null
}

private const val MY_ID_REQUEST_CODE = 19801

class MyIdModule : Module() {
  private val client = MyIdClient()
  private var pendingPromise: Promise? = null

  private val resultListener = object : MyIdResultListener {
    override fun onSuccess(result: MyIdResult) {
      val body = mutableMapOf<String, Any?>("status" to "success", "code" to result.code)
      val bitmap: Bitmap? = result.getGraphicFieldImageByType(MyIdGraphicFieldType.FacePortrait)
      if (bitmap != null) {
        body["base64Image"] = encodePng(bitmap)
      }
      settle(body)
    }

    override fun onError(exception: MyIdException) {
      settle(
        mapOf(
          "status" to "error",
          "kind" to kindForCode(exception.code),
          "code" to exception.code,
          "message" to exception.message,
        )
      )
    }

    override fun onUserExited() {
      settle(mapOf("status" to "cancelled"))
    }

    override fun onEvent(event: MyIdEvent) {
      // Progress events (camera opened, face captured, …) — not surfaced through
      // the single-shot promise.
    }
  }

  override fun definition() = ModuleDefinition {
    Name("MyId")

    AsyncFunction("identify") { config: MyIdConfigRecord, promise: Promise ->
      startIdentify(config, promise)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == MY_ID_REQUEST_CODE) {
        client.handleActivityResult(payload.resultCode, resultListener)
      }
    }
  }

  private fun startIdentify(record: MyIdConfigRecord, promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.resolve(
        mapOf("status" to "error", "kind" to "no_activity", "message" to "No current Activity to launch MyID.")
      )
      return
    }
    if (pendingPromise != null) {
      promise.resolve(
        mapOf("status" to "error", "kind" to "sdk", "message" to "A MyID flow is already in progress.")
      )
      return
    }
    pendingPromise = promise
    val intent = client.createIntent(activity, buildConfig(record))
    activity.startActivityForResult(intent, MY_ID_REQUEST_CODE)
  }

  private fun settle(body: Map<String, Any?>) {
    val promise = pendingPromise ?: return
    pendingPromise = null
    promise.resolve(body)
  }

  private fun buildConfig(record: MyIdConfigRecord): MyIdConfig {
    var builder = MyIdConfig.Builder(record.sessionId)
      .withClientHash(record.clientHash, record.clientHashId)
      .withEnvironment(if (record.environment == "SANDBOX") MyIdEnvironment.Debug else MyIdEnvironment.Production)
      .withEntryType(entryType(record.entryType))
    record.locale?.let { builder = builder.withLocale(locale(it)) }
    record.residency?.let { builder = builder.withResidency(residency(it)) }
    record.cameraShape?.let { builder = builder.withCameraShape(cameraShape(it)) }
    record.cameraSelector?.let { builder = builder.withCameraSelector(cameraSelector(it)) }
    record.minAge?.let { builder = builder.withMinAge(it) }
    record.distance?.let { builder = builder.withDistance(it.toFloat()) }
    record.showErrorScreen?.let { builder = builder.withErrorScreen(it) }
    record.organizationDetails?.let {
      builder = builder.withOrganizationDetails(MyIdOrganizationDetails(it.phoneNumber, null))
    }
    record.huaweiAppId?.let { builder = builder.withHuaweiAppId(it) }
    return builder.build()
  }

  private fun encodePng(bitmap: Bitmap): String {
    val stream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
    return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
  }

  // Best-effort mapping of SDK numeric codes to our discriminated error kind. The
  // authoritative table lives behind MyID's partner portal, so the numeric `code`
  // is always passed through for callers to branch on.
  private fun kindForCode(code: Int): String = when (code) {
    102 -> "permission"
    else -> "sdk"
  }

  private fun entryType(value: String): MyIdEntryType = when (value) {
    "FACE_DETECTION" -> MyIdEntryType.FaceDetection
    "VIDEO_IDENTIFICATION" -> MyIdEntryType.VideoIdentification
    else -> MyIdEntryType.Identification
  }

  private fun locale(value: String): MyIdLocale = when (value) {
    "UZ" -> MyIdLocale.Uzbek
    "RU" -> MyIdLocale.Russian
    else -> MyIdLocale.English
  }

  private fun residency(value: String): MyIdResidency = when (value) {
    "RESIDENT" -> MyIdResidency.Resident
    "NON_RESIDENT" -> MyIdResidency.NonResident
    else -> MyIdResidency.UserDefined
  }

  private fun cameraShape(value: String): MyIdCameraShape =
    if (value == "ELLIPSE") MyIdCameraShape.Ellipse else MyIdCameraShape.Circle

  private fun cameraSelector(value: String): MyIdCameraSelector =
    if (value == "BACK") MyIdCameraSelector.Back else MyIdCameraSelector.Front
}
