// Not compiled locally (authored on Windows). Points to verify on the first iOS build:
// - AVVideoCompositionCoreAnimationTool uses a bottom-left origin, but the overlay layer fills the whole
//   frame, so only its contents' orientation matters; CGImage contents render upright in this setup.
// - The track's preferredTransform is re-anchored to the origin, which covers front and back cameras
//   in any orientation, including mirrored front-camera transforms.

import AVFoundation
import ExpoModulesCore
import UIKit

public class VideoOverlayModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VideoOverlay")

    AsyncFunction("compose") { (videoUri: String, overlayUri: String, promise: Promise) in
      guard let videoURL = URL(string: videoUri), let overlayURL = URL(string: overlayUri),
            let overlay = UIImage(contentsOfFile: overlayURL.path)?.cgImage else {
        promise.reject("ERR_OVERLAY_READ", "The review card couldn't be prepared. Try again.")
        return
      }
      Task {
        do {
          promise.resolve(try await Self.compose(videoURL: videoURL, overlay: overlay).absoluteString)
        } catch {
          promise.reject("ERR_VIDEO_EXPORT", "The video couldn't be saved. Try a shorter clip.")
        }
      }
    }
  }

  private static func compose(videoURL: URL, overlay: CGImage) async throws -> URL {
    let asset = AVURLAsset(url: videoURL)
    guard let source = try await asset.loadTracks(withMediaType: .video).first else { throw ComposeError.noVideo }
    let duration = try await asset.load(.duration)
    let (naturalSize, transform, frameRate) = try await source.load(.naturalSize, .preferredTransform, .nominalFrameRate)
    let range = CMTimeRange(start: .zero, duration: duration)

    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw ComposeError.noVideo }
    try videoTrack.insertTimeRange(range, of: source, at: .zero)
    // Recordings can be muted, in which case there is no audio track to carry over.
    if let audio = try await asset.loadTracks(withMediaType: .audio).first,
       let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
      try audioTrack.insertTimeRange(range, of: audio, at: .zero)
    }

    // The displayed frame is the natural size after the capture transform, moved back to the origin.
    let displayed = CGRect(origin: .zero, size: naturalSize).applying(transform)
    let size = CGSize(width: abs(displayed.width).rounded(), height: abs(displayed.height).rounded())
    let anchored = transform.concatenating(CGAffineTransform(translationX: -displayed.minX, y: -displayed.minY))

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
    layerInstruction.setTransform(anchored, at: .zero)
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = range
    instruction.layerInstructions = [layerInstruction]

    let frame = CGRect(origin: .zero, size: size)
    let parent = CALayer()
    parent.frame = frame
    let videoLayer = CALayer()
    videoLayer.frame = frame
    let overlayLayer = CALayer()
    overlayLayer.frame = frame
    overlayLayer.contents = overlay
    overlayLayer.contentsGravity = .resize
    parent.addSublayer(videoLayer)
    parent.addSublayer(overlayLayer)

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = size
    videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(frameRate > 0 ? frameRate.rounded() : 30))
    videoComposition.instructions = [instruction]
    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)

    let output = FileManager.default.temporaryDirectory.appendingPathComponent("margin-review-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
    guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { throw ComposeError.export }
    export.videoComposition = videoComposition
    export.outputURL = output
    export.outputFileType = .mp4
    export.shouldOptimizeForNetworkUse = true
    await export.export()
    guard export.status == .completed else {
      try? FileManager.default.removeItem(at: output)
      throw export.error ?? ComposeError.export
    }
    return output
  }

  private enum ComposeError: Error {
    case noVideo
    case export
  }
}
