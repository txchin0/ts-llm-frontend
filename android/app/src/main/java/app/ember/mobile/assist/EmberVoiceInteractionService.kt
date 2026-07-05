package app.ember.mobile.assist

import android.service.voice.VoiceInteractionService

/**
 * Entry point that makes Ember selectable as the device's digital assistant.
 * Sessions are created by [EmberSessionService]; nothing to do here.
 */
class EmberVoiceInteractionService : VoiceInteractionService()
