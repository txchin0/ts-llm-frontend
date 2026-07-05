package app.ember.mobile.assist

import android.content.Context
import android.util.AttributeSet
import android.widget.ScrollView
import kotlin.math.min

/** ScrollView capped at 280dp so long responses scroll instead of filling the screen. */
class MaxHeightScrollView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : ScrollView(context, attrs) {
    private val maxHeightPx = (280 * resources.displayMetrics.density).toInt()

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val cappedHeight = when (MeasureSpec.getMode(heightMeasureSpec)) {
            MeasureSpec.UNSPECIFIED -> MeasureSpec.makeMeasureSpec(maxHeightPx, MeasureSpec.AT_MOST)
            else -> MeasureSpec.makeMeasureSpec(
                min(MeasureSpec.getSize(heightMeasureSpec), maxHeightPx),
                MeasureSpec.AT_MOST,
            )
        }
        super.onMeasure(widthMeasureSpec, cappedHeight)
    }
}
