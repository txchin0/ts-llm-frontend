package app.ember.mobile.assist

import android.content.Intent
import android.speech.RecognitionService

/**
 * Never used for actual recognition (the assistant session talks to the
 * system SpeechRecognizer directly); exists only because the
 * voice-interaction-service metadata requires a recognitionService component.
 */
class EmberStubRecognitionService : RecognitionService() {
    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        listener?.error(android.speech.SpeechRecognizer.ERROR_CLIENT)
    }

    override fun onCancel(listener: Callback?) {}

    override fun onStopListening(listener: Callback?) {}
}
