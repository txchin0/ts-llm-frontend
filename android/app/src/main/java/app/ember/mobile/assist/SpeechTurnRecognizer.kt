package app.ember.mobile.assist

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Single-utterance recognition for the assistant overlay: one fresh
 * SpeechRecognizer per turn, and the recognizer's own endpointing decides when
 * the utterance is over ([Listener.onFinal] is the send trigger). All
 * SpeechRecognizer calls run on the main thread, as the API requires.
 */
class SpeechTurnRecognizer(private val context: Context, private val language: String) {

    interface Listener {
        fun onPartial(text: String)
        fun onFinal(text: String)
        /** Normalized mic level 0..1 for the flame. */
        fun onRms(level: Float)
        /** Utterance ended with nothing recognized; caller usually re-arms. */
        fun onNoSpeech()
        fun onError(message: String)
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    fun startTurn(listener: Listener) {
        mainHandler.post {
            releaseRecognizer()
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                listener.onError("Speech recognition is not available on this device")
                return@post
            }

            val recognizer = SpeechRecognizer.createSpeechRecognizer(context)
            this.recognizer = recognizer
            recognizer.setRecognitionListener(object : RecognitionListener {
                override fun onRmsChanged(rmsdB: Float) {
                    listener.onRms(((rmsdB + 2f) / 12f).coerceIn(0f, 1f))
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val text = firstMatch(partialResults)
                    if (!text.isNullOrBlank()) listener.onPartial(text)
                }

                override fun onResults(results: Bundle?) {
                    releaseRecognizer()
                    val text = firstMatch(results)
                    if (text.isNullOrBlank()) listener.onNoSpeech() else listener.onFinal(text)
                }

                override fun onError(error: Int) {
                    releaseRecognizer()
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                        SpeechRecognizer.ERROR_CLIENT,
                        -> listener.onNoSpeech()
                        else -> listener.onError(errorText(error))
                    }
                }

                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
                )
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            }
            recognizer.startListening(intent)
        }
    }

    fun cancel() {
        mainHandler.post { releaseRecognizer() }
    }

    private fun releaseRecognizer() {
        recognizer?.let {
            try {
                it.cancel()
                it.destroy()
            } catch (_: Exception) {
                /* already released */
            }
        }
        recognizer = null
    }

    private fun firstMatch(bundle: Bundle?): String? =
        bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()

    private fun errorText(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "Microphone error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone access blocked"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
            "Speech service needs a network connection"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy"
        SpeechRecognizer.ERROR_SERVER -> "Speech service error"
        else -> "Voice input failed ($error)"
    }
}
