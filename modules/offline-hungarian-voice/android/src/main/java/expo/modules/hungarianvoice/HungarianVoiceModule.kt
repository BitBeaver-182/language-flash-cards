package expo.modules.hungarianvoice

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.UUID
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HungarianVoiceModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var engine: TextToSpeech? = null
  private var initialized = false
  private var generation = 0
  private val waiting = mutableListOf<(TextToSpeech?) -> Unit>()
  private val utterances = mutableMapOf<String, Promise>()

  private fun withEngine(callback: (TextToSpeech?) -> Unit) {
    main.post {
      if (initialized) { callback(engine); return@post }
      waiting.add(callback)
      if (engine != null) return@post
      val context = appContext.reactContext
      if (context == null) { finishInit(false); return@post }
      try {
        val attempt = ++generation
        engine = TextToSpeech(context) { status -> main.post { if (generation == attempt) finishInit(status == TextToSpeech.SUCCESS) } }
        main.postDelayed({ if (generation == attempt && !initialized) { generation++; finishInit(false) } }, 10000)
      } catch (_: Exception) { finishInit(false) }
    }
  }

  private fun finishInit(success: Boolean) {
    if (!success) { engine?.shutdown(); engine = null }
    initialized = success
    if (success) {
      engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(id: String) = Unit
        override fun onDone(id: String) { main.post { utterances.remove(id)?.resolve("started") } }
        @Deprecated("Deprecated in Android")
        override fun onError(id: String) { main.post { utterances.remove(id)?.resolve("error") } }
        override fun onError(id: String, errorCode: Int) { main.post { utterances.remove(id)?.resolve("error") } }
        override fun onStop(id: String, interrupted: Boolean) { main.post { utterances.remove(id)?.resolve("interrupted") } }
      })
    }
    val callbacks = waiting.toList(); waiting.clear()
    callbacks.forEach { it(if (success) engine else null) }
  }

  private fun offlineVoice(tts: TextToSpeech): Voice? = tts.voices
    ?.filter { it.locale.language.equals("hu", ignoreCase = true) && !it.isNetworkConnectionRequired && !(it.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) ?: false) }
    ?.sortedWith(compareByDescending<Voice> { it.locale.country.equals("HU", ignoreCase = true) }.thenByDescending { it.quality }.thenBy { it.name })
    ?.firstOrNull()

  override fun definition() = ModuleDefinition {
    Name("HungarianVoice")
    AsyncFunction("status") { promise: Promise ->
      withEngine { tts ->
        try { promise.resolve(if (tts == null) "unavailable" else if (offlineVoice(tts) == null) "missing" else "ready") }
        catch (_: Exception) { promise.resolve("unavailable") }
      }
    }
    AsyncFunction("speak") { text: String, slow: Boolean, promise: Promise ->
      withEngine { tts ->
        try {
          val voice = tts?.let { offlineVoice(it) }
          when {
            tts == null -> promise.resolve("unavailable")
            voice == null -> promise.resolve("missing")
            tts.setVoice(voice) != TextToSpeech.SUCCESS -> promise.resolve("error")
            tts.voice?.name != voice.name || tts.voice?.isNetworkConnectionRequired != false -> promise.resolve("error")
            else -> {
              if (tts.setSpeechRate(if (slow) 0.72f else 1.0f) != TextToSpeech.SUCCESS) {
                promise.resolve("error")
              } else {
                utterances.values.forEach { it.resolve("interrupted") }
                utterances.clear()
                val id = UUID.randomUUID().toString()
                utterances[id] = promise
                val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
                if (result != TextToSpeech.SUCCESS) utterances.remove(id)?.resolve("error")
                else main.postDelayed({ utterances.remove(id)?.resolve("error") }, 30000)
              }
            }
          }
        } catch (_: Exception) { promise.resolve("error") }
      }
    }
    AsyncFunction("openSetup") { promise: Promise ->
      main.post {
        val context = appContext.reactContext
        if (context == null) { promise.resolve(false); return@post }
        val intents = listOf(Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA), Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        var opened = false
        for (intent in intents) {
          try { intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(intent); opened = true; break }
          catch (_: Exception) { /* Try the next system screen. */ }
        }
        promise.resolve(opened)
      }
    }
    OnDestroy { main.post { utterances.values.forEach { it.resolve("interrupted") }; utterances.clear(); generation++; engine?.stop(); engine?.shutdown(); engine = null; initialized = false; waiting.clear() } }
  }
}
