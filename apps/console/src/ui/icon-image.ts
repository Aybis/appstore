/**
 * Turns whatever somebody picked into an app icon.
 *
 * Done in the BROWSER, before the upload, for three reasons that all point the
 * same way: a 4 MB phone photo never crosses the network, the server never
 * decodes untrusted image data (an image decoder is a large attack surface to
 * point at arbitrary uploads), and the person sees exactly what they are about
 * to store rather than discovering the crop afterwards.
 *
 * 512×512 is the target because it is where both platforms converge — Play's
 * listing icon is 512, and it is the largest asset the App Store asks for — so
 * one square serves both and scales down cleanly. Anything larger is bytes
 * nobody renders.
 */

/** Both stores want a square at this size. One image covers both. */
export const ICON_SIZE = 512

export interface PreparedIcon {
  file: File
  width: number
  height: number
  bytes: number
  /** True when the source was not square and the middle was taken. */
  cropped: boolean
}

const loadBitmap = async (file: File): Promise<ImageBitmap> => {
  try {
    return await createImageBitmap(file)
  } catch {
    // A file that claims to be an image and cannot be decoded is not one, and
    // the magic-byte check on the server would refuse it anyway.
    throw new Error('That file could not be read as an image')
  }
}

/**
 * Centre-crops to a square, resizes to 512, and re-encodes as PNG.
 *
 * PNG rather than WebP despite the size: an icon is flat colour and hard
 * edges, which PNG handles without the ringing WebP introduces at the
 * compression levels that would actually save anything. At 512 the difference
 * is tens of kilobytes, and the icon is cached forever by digest anyway.
 */
export const prepareIcon = async (file: File): Promise<PreparedIcon> => {
  const bitmap = await loadBitmap(file)

  // The middle is where an icon's subject is, near enough always. Cropping
  // from a corner would silently behead half the logos anybody uploads.
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.round((bitmap.width - side) / 2)
  const sy = Math.round((bitmap.height - side) / 2)
  const cropped = bitmap.width !== bitmap.height

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot process images')

  // Matters when shrinking a 2000px source: without it the result is aliased
  // and looks worse than the original at a third the size.
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, ICON_SIZE, ICON_SIZE)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('Could not encode the icon')

  return {
    file: new File([blob], 'icon.png', { type: 'image/png' }),
    width: ICON_SIZE,
    height: ICON_SIZE,
    bytes: blob.size,
    cropped,
  }
}
