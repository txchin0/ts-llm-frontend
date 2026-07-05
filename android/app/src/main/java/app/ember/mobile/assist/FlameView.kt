package app.ember.mobile.assist

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Shader
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import kotlin.math.max
import kotlin.math.sin

/**
 * Animated flame that grows with microphone volume. Feed it normalized RMS
 * via [setLevel]; an attack/decay envelope (fast rise, slow fall) smooths the
 * jittery recognizer levels, and per-layer sinusoidal tip flicker keeps the
 * flame alive even in silence.
 */
class FlameView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val layerColors = intArrayOf(0xFFE25822.toInt(), 0xFFFFB347.toInt(), 0xFFFFE8A3.toInt())
    private val layerScales = floatArrayOf(1f, 0.72f, 0.45f)
    private val flickerFreqs = floatArrayOf(9.1f, 12.7f, 15.3f)
    private val flickerPhases = floatArrayOf(0f, 2.1f, 4.2f)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val path = Path()
    private var envelope = 0f
    private var level = 0f
    private var lastFrameMs = 0L

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        repeatCount = ValueAnimator.INFINITE
        duration = 1000L
        addUpdateListener { invalidate() }
    }

    /** @param rms01 normalized mic input level in 0..1. */
    fun setLevel(rms01: Float) {
        level = rms01.coerceIn(0f, 1f)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        lastFrameMs = SystemClock.uptimeMillis()
        animator.start()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        // Frame-rate-independent decay: ~10%/16ms fall, instant rise.
        val frames = ((now - lastFrameMs) / 16f).coerceIn(0.5f, 4f)
        lastFrameMs = now
        var decayed = envelope
        repeat(frames.toInt().coerceAtLeast(1)) { decayed *= 0.90f }
        envelope = max(level, decayed)

        val t = now / 1000f
        val w = width.toFloat()
        val h = height.toFloat()
        val baseX = w / 2f
        val baseY = h * 0.96f
        val maxHeight = h * 0.92f * (0.55f + 0.45f * envelope)
        val baseWidth = w * 0.42f * (0.75f + 0.25f * envelope)

        for (i in layerColors.indices) {
            val layerH = maxHeight * layerScales[i]
            val layerW = baseWidth * layerScales[i]
            val flicker = sin(t * flickerFreqs[i] + flickerPhases[i]) *
                (w * 0.03f) * (0.5f + envelope)
            val tipX = baseX + flicker
            val tipY = baseY - layerH

            path.reset()
            path.moveTo(baseX - layerW / 2f, baseY)
            // Left side: bulge out then curve into the tip.
            path.cubicTo(
                baseX - layerW * 0.62f, baseY - layerH * 0.35f,
                tipX - layerW * 0.22f, baseY - layerH * 0.72f,
                tipX, tipY,
            )
            // Right side back down to the base.
            path.cubicTo(
                tipX + layerW * 0.22f, baseY - layerH * 0.72f,
                baseX + layerW * 0.62f, baseY - layerH * 0.35f,
                baseX + layerW / 2f, baseY,
            )
            path.close()

            paint.shader = RadialGradient(
                baseX, baseY - layerH * 0.3f, max(layerH, 1f),
                layerColors[i], layerColors[i] and 0x00FFFFFF or 0x22000000,
                Shader.TileMode.CLAMP,
            )
            canvas.drawPath(path, paint)
        }
        paint.shader = null
    }
}
