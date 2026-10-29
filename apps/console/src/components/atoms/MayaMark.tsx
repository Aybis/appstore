/**
 * The MAYA mark: the same icon the mobile app ships with.
 *
 * public/maya-mark.png and the favicons beside it are apps/mobile/assets/icon.png
 * resized, with its white corners made transparent so the rounded tile sits
 * cleanly on a dark tab bar or sidebar. The console, the browser tab and the
 * phone's home screen all show one mark.
 */
export const MayaMark = ({ size = 32 }: { size?: number }) => (
  <img src="/maya-mark.png" width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block' }} />
)
