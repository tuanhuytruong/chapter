export const NEXT_CHAPTER_PREPARE_RATIO = 0.15;

export function shouldPrepareNextChapter({
  currentTime,
  duration,
  alreadyTriggered,
  isLatestReady,
  canGenerate,
  isPending,
  stopAfterCurrent,
}: {
  currentTime: number;
  duration: number;
  alreadyTriggered: boolean;
  isLatestReady: boolean;
  canGenerate: boolean;
  isPending: boolean;
  stopAfterCurrent: boolean;
}): boolean {
  return Number.isFinite(currentTime)
    && Number.isFinite(duration)
    && duration > 0
    && currentTime / duration >= NEXT_CHAPTER_PREPARE_RATIO
    && !alreadyTriggered
    && isLatestReady
    && canGenerate
    && !isPending
    && !stopAfterCurrent;
}
