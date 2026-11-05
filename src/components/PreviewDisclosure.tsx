import type { ReactNode } from 'react';
import PreviewSurfacePresence from './PreviewSurfacePresence';
import { usePreviewActive } from './PreviewNavigation';
/** Dense reading adaptation: local 4px finite reveal, no layout animation. */
export default function PreviewDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  return <PreviewSurfacePresence active={usePreviewActive()} open={open} family="disclosure">{children}</PreviewSurfacePresence>;
}
