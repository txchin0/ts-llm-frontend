package app.ember.mobile.assist

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.voice.VoiceInteractionSession
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ScrollView
import android.widget.TextView
import app.ember.mobile.R
import okhttp3.Call

/**
 * The assistant overlay: flame + native speech in, streamed agent text out.
 *
 * State machine: LISTENING -> STREAMING -> (final, short pause) -> LISTENING,
 * with COMPOSING as a typed-input alternative to LISTENING. The server
 * session is ephemeral per invocation: the first turn starts one, follow-up
 * turns reuse it, and hiding the overlay drops it.
 */
class EmberAssistSession(context: Context) : VoiceInteractionSession(context) {

    private enum class State { IDLE, LISTENING, STREAMING, COMPOSING }

    private var state = State.IDLE
    private var sessionId: String? = null
    private var recognizer: SpeechTurnRecognizer? = null
    private var respondClient: RespondClient? = null
    private var inFlight: Call? = null
    private var composeMode = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private lateinit var flame: FlameView
    private lateinit var responseScroll: ScrollView
    private lateinit var responseView: TextView
    private lateinit var transcriptView: TextView
    private lateinit var statusView: TextView
    private lateinit var voiceRow: View
    private lateinit var composeRow: View
    private lateinit var inputField: EditText

    override fun onCreate() {
        super.onCreate()
        // Assist windows block the IME by default; the compose field needs it.
        window?.window?.let {
            it.clearFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM)
            it.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
    }

    override fun onCreateContentView(): View {
        val view = layoutInflater.inflate(R.layout.assist_overlay, null)
        flame = view.findViewById(R.id.assist_flame)
        responseScroll = view.findViewById(R.id.assist_response_scroll)
        responseView = view.findViewById(R.id.assist_response)
        transcriptView = view.findViewById(R.id.assist_transcript)
        statusView = view.findViewById(R.id.assist_status)
        voiceRow = view.findViewById(R.id.assist_voice_row)
        composeRow = view.findViewById(R.id.assist_compose_row)
        inputField = view.findViewById(R.id.assist_input)

        view.findViewById<View>(R.id.assist_scrim).setOnClickListener { hide() }
        view.findViewById<ImageButton>(R.id.assist_compose_button).setOnClickListener {
            enterComposeMode()
        }
        view.findViewById<ImageButton>(R.id.assist_mic_button).setOnClickListener {
            exitComposeMode()
        }
        view.findViewById<ImageButton>(R.id.assist_send_button).setOnClickListener { sendTyped() }
        inputField.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendTyped()
                true
            } else {
                false
            }
        }
        return view
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        Log.i(TAG, "Assist session shown (flags=$showFlags)")
        if (!::flame.isInitialized) {
            Log.w(TAG, "Content view not created yet; skipping show")
            return
        }
        sessionId = null
        composeMode = false
        resetViews()

        val settings = EmberSettings.load(context)
        val serverUrl = settings.serverUrl
        if (serverUrl == null) {
            showStatus(context.getString(R.string.assist_error_no_server))
            return
        }
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            // A session has no activity to raise the permission dialog from.
            showStatus(context.getString(R.string.assist_error_no_mic))
            return
        }

        respondClient = RespondClient(serverUrl, settings.userId)
        recognizer = SpeechTurnRecognizer(context, settings.micLanguage)
        startListening()
    }

    override fun onHide() {
        Log.i(TAG, "Assist session hidden")
        recognizer?.cancel()
        recognizer = null
        inFlight?.cancel()
        inFlight = null
        respondClient = null
        sessionId = null // ephemeral: dropped with the overlay
        mainHandler.removeCallbacksAndMessages(null)
        state = State.IDLE
        super.onHide()
    }

    // ---- Voice loop ----

    private fun startListening() {
        val recognizer = this.recognizer ?: return
        state = State.LISTENING
        statusView.text = context.getString(R.string.assist_status_listening)
        transcriptView.visibility = View.GONE
        flame.setLevel(0f)

        recognizer.startTurn(object : SpeechTurnRecognizer.Listener {
            override fun onPartial(text: String) {
                if (state != State.LISTENING) return
                transcriptView.text = text
                transcriptView.visibility = View.VISIBLE
            }

            override fun onFinal(text: String) {
                if (state != State.LISTENING) return
                transcriptView.text = text
                transcriptView.visibility = View.VISIBLE
                sendMessage(text)
            }

            override fun onRms(level: Float) {
                if (state == State.LISTENING) flame.setLevel(level)
            }

            override fun onNoSpeech() {
                // Keep the mic hot, like hands-free mode; small delay avoids a
                // tight loop if the recognizer fails instantly.
                if (state != State.LISTENING) return
                mainHandler.postDelayed({
                    if (state == State.LISTENING && !composeMode) startListening()
                }, 250)
            }

            override fun onError(message: String) {
                if (state != State.LISTENING) return
                showStatus(message)
            }
        })
    }

    // ---- Sending / streaming ----

    private fun sendMessage(text: String) {
        val client = respondClient ?: return
        if (text.isBlank() || state == State.STREAMING) return

        recognizer?.cancel()
        state = State.STREAMING
        statusView.text = context.getString(R.string.assist_status_thinking)
        flame.setLevel(0f)
        responseView.text = ""
        responseScroll.visibility = View.VISIBLE

        inFlight = client.send(text, sessionId, object : RespondClient.Callbacks {
            override fun onSessionStarted(newSessionId: String) {
                if (sessionId == null) sessionId = newSessionId
            }

            override fun onDelta(delta: String) {
                if (state != State.STREAMING) return
                responseView.append(delta)
                responseScroll.post { responseScroll.fullScroll(View.FOCUS_DOWN) }
            }

            override fun onToolActivity(toolName: String) {
                if (state != State.STREAMING) return
                statusView.text = context.getString(R.string.assist_status_tool, toolName)
            }

            override fun onFinal() {
                if (state != State.STREAMING) return
                inFlight = null
                if (composeMode) {
                    state = State.COMPOSING
                    statusView.text = ""
                } else {
                    // Hands-free loop: re-arm the mic after a short pause.
                    mainHandler.postDelayed({
                        if (state == State.STREAMING) startListening()
                    }, 400)
                }
            }

            override fun onError(message: String) {
                if (state != State.STREAMING) return
                inFlight = null
                showStatus(message)
            }
        })
    }

    // ---- Compose mode ----

    private fun enterComposeMode() {
        composeMode = true
        recognizer?.cancel()
        if (state == State.LISTENING) state = State.COMPOSING
        transcriptView.visibility = View.GONE
        flame.setLevel(0f)
        voiceRow.visibility = View.GONE
        composeRow.visibility = View.VISIBLE
        inputField.requestFocus()
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(inputField, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun exitComposeMode() {
        composeMode = false
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(inputField.windowToken, 0)
        voiceRow.visibility = View.VISIBLE
        composeRow.visibility = View.GONE
        if (state != State.STREAMING) startListening()
    }

    private fun sendTyped() {
        val text = inputField.text.toString().trim()
        if (text.isEmpty() || state == State.STREAMING) return
        inputField.text.clear()
        state = State.COMPOSING
        sendMessage(text)
    }

    // ---- Helpers ----

    private fun resetViews() {
        responseView.text = ""
        responseScroll.visibility = View.GONE
        transcriptView.text = ""
        transcriptView.visibility = View.GONE
        statusView.text = context.getString(R.string.assist_status_listening)
        voiceRow.visibility = View.VISIBLE
        composeRow.visibility = View.GONE
        inputField.text.clear()
        flame.setLevel(0f)
    }

    private fun showStatus(message: String) {
        state = State.IDLE
        statusView.text = message
        flame.setLevel(0f)
    }

    companion object {
        private const val TAG = "EmberAssist"
    }
}
