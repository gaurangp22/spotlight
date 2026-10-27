package expo.modules.videooverlay

// Not compiled locally (no Android SDK on the authoring machine). Points to verify on the first build:
// - Every clip is centre-cropped to 9:16 before the overlay is drawn, so gallery videos of any shape line
//   up with the card exactly as the app previews them (contentFit="cover").
// - The frame size comes from TextureOverlay.configure(Size), which media3 calls with the size the overlay
//   is drawn on before the first frame. Reading it up front with MediaMetadataRetriever failed on some
//   phones for recordings that played fine ("The recording couldn't be read").
// - BitmapOverlay, OverlayEffect(List), Presentation and BitmapOverlay.getBitmap(presentationTimeUs) are
//   @UnstableApi; the class opts in below. Their signatures have been stable from 1.1 through 1.9.

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Shows each card from its start time until the next card starts: the ranking countdown. A single card at
 * time 0 is a static overlay. Cards are scaled to the frame once media3 reports its size, and the scaled
 * bitmaps are kept so the texture is only uploaded again when the card changes.
 */
@OptIn(UnstableApi::class)
private class TimedBitmapOverlay(private val sources: List<Pair<Bitmap, Long>>) : BitmapOverlay() {
  private var frames = sources

  override fun configure(videoSize: Size) {
    super.configure(videoSize)
    val width = videoSize.width
    val height = videoSize.height
    if (width <= 0 || height <= 0) return
    // A bitmap exactly the size of the frame covers it fully, whichever way the overlay is scaled.
    frames = sources.map { (bitmap, start) ->
      Pair(if (bitmap.width == width && bitmap.height == height) bitmap else Bitmap.createScaledBitmap(bitmap, width, height, true), start)
    }
  }

  override fun getBitmap(presentationTimeUs: Long): Bitmap =
    frames.lastOrNull { it.second <= presentationTimeUs }?.first ?: frames.first().first
}

@OptIn(UnstableApi::class)
class VideoOverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoOverlay")

    AsyncFunction("compose") { videoUri: String, overlayUri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val overlay = readOverlay(overlayUri) ?: run {
        promise.reject("ERR_OVERLAY_READ", "The review card couldn't be prepared. Try again.", null)
        return@AsyncFunction
      }
      export(context, Uri.parse(videoUri), TimedBitmapOverlay(listOf(Pair(overlay, 0L))), promise)
    }

    AsyncFunction("composeTimed") { videoUri: String, overlayUris: List<String>, starts: List<Double>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (overlayUris.isEmpty() || overlayUris.size != starts.size) {
        promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.", null)
        return@AsyncFunction
      }
      val frames = mutableListOf<Pair<Bitmap, Long>>()
      for (index in overlayUris.indices) {
        val bitmap = readOverlay(overlayUris[index]) ?: run {
          promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.", null)
          return@AsyncFunction
        }
        frames.add(Pair(bitmap, (maxOf(0.0, starts[index]) * 1_000_000).toLong()))
      }
      export(context, Uri.parse(videoUri), TimedBitmapOverlay(frames.sortedBy { it.second }), promise)
    }
  }

  private fun readOverlay(uri: String): Bitmap? = Uri.parse(uri).path?.let { BitmapFactory.decodeFile(it) }

  private fun export(context: Context, video: Uri, overlay: TextureOverlay, promise: Promise) {
    val output = File(context.cacheDir, "margin-review-${System.currentTimeMillis()}.mp4")
    val edited = EditedMediaItem.Builder(MediaItem.fromUri(video))
      .setEffects(Effects(listOf(), listOf(
        Presentation.createForAspectRatio(9f / 16f, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP),
        OverlayEffect(ImmutableList.of<TextureOverlay>(overlay)),
      )))
      .build()

    // Transformer must be built and driven from a thread with a Looper.
    Handler(Looper.getMainLooper()).post {
      try {
        Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              promise.resolve(Uri.fromFile(output).toString())
            }

            override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
              output.delete()
              promise.reject("ERR_VIDEO_EXPORT", "This video couldn't be processed. Try a shorter clip or record a new one.", exportException)
            }
          })
          .build()
          .start(edited, output.absolutePath)
      } catch (error: Exception) {
        promise.reject("ERR_VIDEO_EXPORT", "The video couldn't be saved. Try again.", error)
      }
    }
  }
}
