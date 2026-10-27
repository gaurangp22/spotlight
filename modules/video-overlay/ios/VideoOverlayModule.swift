// Not compiled locally (authored on Windows). Points to verify on the first iOS build:
// - AVVideoCompositionCoreAnimationTool uses a bottom-left origin, but the overlay layer fills the whole
//   frame, so only its contents' orientation matters; CGImage contents render upright in this setup.
// - The track's preferredTransform is re-anchored to the origin, which covers front and back cameras
//   in any orientation, including mirrored front-camera transforms.
// - Every clip is centre-cropped to 9:16 (gallery videos can be any shape) by shifting that transform and
//   rendering at the cropped size.

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
          promise.resolve(try await Self.compose(videoURL: videoURL, overlays: [(overlay, 0)]).absoluteString)
        } catch {
          promise.reject("ERR_VIDEO_EXPORT", "The video couldn't be saved. Try a shorter clip.")
        }
      }
    }

    // Several cards, each shown from its start time (seconds) until the next one starts: the ranking countdown.
    AsyncFunction("composeTimed") { (videoUri: String, overlayUris: [String], starts: [Double], promise: Promise) in
      guard let videoURL = URL(string: videoUri), !overlayUris.isEmpty, overlayUris.count == starts.count else {
        promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.")
        return
      }
      var overlays: [(CGImage, Double)] = []
      for (index, uri) in overlayUris.enumerated() {
        guard let url = URL(string: uri), let image = UIImage(contentsOfFile: url.path)?.cgImage else {
          promise.reject("ERR_OVERLAY_READ", "The ranking cards couldn't be prepared. Try again.")
          return
        }
        overlays.append((image, max(0, starts[index])))
      }
      Task {
        do {
          promise.resolve(try await Self.compose(videoURL: videoURL, overlays: overlays.sorted { $0.1 < $1.1 }).absoluteString)
        } catch {
          promise.reject("ERR_VIDEO_EXPORT", "The video couldn't be saved. Try a shorter clip.")
        }
      }
    }
  }

  private static func compose(videoURL: URL, overlays: [(CGImage, Double)]) async throws -> URL {
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
    let full = CGSize(width: abs(displayed.width), height: abs(displayed.height))
    // Centre-crop to 9:16 so gallery videos of any shape match the card as previewed (contentFit="cover").
    let size = full.width / full.height > 9.0 / 16.0
      ? CGSize(width: (full.height * 9 / 16).rounded(), height: full.height.rounded())
      : CGSize(width: full.width.rounded(), height: (full.width * 16 / 9).rounded())
    let crop = CGPoint(x: ((full.width - size.width) / 2).rounded(), y: ((full.height - size.height) / 2).rounded())
    let anchored = transform.concatenating(CGAffineTransform(translationX: -displayed.minX - crop.x, y: -displayed.minY - crop.y))

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
    parent.addSublayer(videoLayer)
    let total = CMTimeGetSeconds(duration)
    for (index, (image, start)) in overlays.enumerated() {
      let layer = CALayer()
      layer.frame = frame
      layer.contents = image
      layer.contentsGravity = .resize
      if overlays.count > 1 {
        // Hidden by default; an opacity animation shows it for its own slice of the video.
        let end = index + 1 < overlays.count ? overlays[index + 1].1 : total
        layer.opacity = 0
        let show = CABasicAnimation(keyPath: "opacity")
        show.fromValue = 1
        show.toValue = 1
        show.beginTime = start <= 0 ? AVCoreAnimationBeginTimeAtZero : start
        show.duration = max(0.01, end - start)
        show.isRemovedOnCompletion = false
        show.fillMode = .removed
        layer.add(show, forKey: "show")
      }
      parent.addSublayer(layer)
    }

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
