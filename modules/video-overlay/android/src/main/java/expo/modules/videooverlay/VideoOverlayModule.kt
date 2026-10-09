package expo.modules.videooverlay

// Not compiled locally (no Android SDK on the authoring machine). Points to verify on the first build:
// - Media3 Transformer applies the input's rotation metadata before running effects, so the overlay is
//   sized to the *displayed* frame (width/height swapped for 90°/270°). If an overlay ever comes out
//   sideways on a device, this assumption is the place to look.
// - BitmapOverlay.createStaticBitmapOverlay(Bitmap) and OverlayEffect(ImmutableList) are @UnstableApi;
//   the class opts in below. Their signatures have been stable from 1.1 through 1.9.

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

@OptIn(UnstableApi::class)
class VideoOverlayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VideoOverlay")

    AsyncFunction("compose") { videoUri: String, overlayUri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val video = Uri.parse(videoUri)

      val (width, height) = try {
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
        return@AsyncFunction
      }
      if (width <= 0 || height <= 0) {
        promise.reject("ERR_VIDEO_READ", "The recording couldn't be read. Record it again.", null)
        return@AsyncFunction
      }

      val overlayPath = Uri.parse(overlayUri).path
      val source = overlayPath?.let { BitmapFactory.decodeFile(it) }
      if (source == null) {
        promise.reject("ERR_OVERLAY_READ", "The review card couldn't be prepared. Try again.", null)
        return@AsyncFunction
      }
      // A bitmap exactly the size of the frame covers it fully, whichever way the overlay is scaled.
      val overlay = if (source.width == width && source.height == height) source
        else Bitmap.createScaledBitmap(source, width, height, true)

      val output = File(context.cacheDir, "margin-review-${System.currentTimeMillis()}.mp4")
      val edited = EditedMediaItem.Builder(MediaItem.fromUri(video))
        .setEffects(Effects(listOf(), listOf(OverlayEffect(ImmutableList.of(BitmapOverlay.createStaticBitmapOverlay(overlay))))))
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
}
