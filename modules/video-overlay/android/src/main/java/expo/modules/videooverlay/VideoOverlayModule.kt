package expo.modules.videooverlay

// Not compiled locally (no Android SDK on the authoring machine). Points to verify on the first build:
// - Media3 Transformer applies the input's rotation metadata before running effects, so the overlay is
//   sized to the *displayed* frame (width/height swapped for 90°/270°). If an overlay ever comes out
//   sideways on a device, this assumption is the place to look.
// - BitmapOverlay, OverlayEffect(List) and BitmapOverlay.getBitmap(presentationTimeUs) are @UnstableApi;
//   the class opts in below. Their signatures have been stable from 1.1 through 1.9.

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
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

/** Shows each card from its start time until the next card starts: the ranking countdown. */
@OptIn(UnstableApi::class)
private class TimedBitmapOverlay(private val frames: List<Pair<Bitmap, Long>>) : BitmapOverlay() {
  override fun getBitmap(presentationTimeUs: Long): Bitmap =
    frames.lastOrNull { it.second <= presentationTimeUs }?.first ?: frames.first().first
}

@OptIn(UnstableApi::class)
class VideoOverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoOverlay")

    AsyncFunction("compose") { videoUri: String, overlayUri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val video = Uri.parse(videoUri)
      val size = frameSize(context, video, promise) ?: return@AsyncFunction
      val overlay = readOverlay(overlayUri, size) ?: run {
        promise.reject("ERR_OVERLAY_READ", "The review card couldn't be prepared. Try again.", null)
        return@AsyncFunction
      }
      export(context, video, BitmapOverlay.createStaticBitmapOverlay(overlay), promise)
    }

    AsyncFunction("composeTimed") { videoUri: String, overlayUris: List<String>, starts: List<Double>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (overlayUris.isEmpty() || overlayUris.size != starts.size) {
        promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.", null)
        return@AsyncFunction
      }
      val video = Uri.parse(videoUri)
      val size = frameSize(context, video, promise) ?: return@AsyncFunction
      val frames = mutableListOf<Pair<Bitmap, Long>>()
      for (index in overlayUris.indices) {
        val bitmap = readOverlay(overlayUris[index], size) ?: run {
          promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.", null)
          return@AsyncFunction
        }
        frames.add(Pair(bitmap, (maxOf(0.0, starts[index]) * 1_000_000).toLong()))
      }
      export(context, video, TimedBitmapOverlay(frames.sortedBy { it.second }), promise)
    }
  }

  private fun frameSize(context: Context, video: Uri, promise: Promise): Pair<Int, Int>? {
    val size = try {
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(context, video)
        val w = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        val h = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
        val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        if (rotation % 180 != 0) Pair(h, w) else Pair(w, h)
      } finally {
        retriever.release()
      }
    } catch (error: Exception) {
      promise.reject("ERR_VIDEO_READ", "The recording couldn't be read. Record it again.", error)
      return null
    }
    if (size.first <= 0 || size.second <= 0) {
      promise.reject("ERR_VIDEO_READ", "The recording couldn't be read. Record it again.", null)
      return null
    }
    return size
  }

  /** A bitmap exactly the size of the frame covers it fully, whichever way the overlay is scaled. */
  private fun readOverlay(uri: String, size: Pair<Int, Int>): Bitmap? {
    val source = Uri.parse(uri).path?.let { BitmapFactory.decodeFile(it) } ?: return null
    return if (source.width == size.first && source.height == size.second) source
      else Bitmap.createScaledBitmap(source, size.first, size.second, true)
  }

  private fun export(context: Context, video: Uri, overlay: TextureOverlay, promise: Promise) {
    val output = File(context.cacheDir, "margin-review-${System.currentTimeMillis()}.mp4")
    val edited = EditedMediaItem.Builder(MediaItem.fromUri(video))
      .setEffects(Effects(listOf(), listOf(OverlayEffect(ImmutableList.of<TextureOverlay>(overlay)))))
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
              promise.reject("ERR_VIDEO_EXPORT", "The video couldn't be saved. Try a shorter clip.", exportException)
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
