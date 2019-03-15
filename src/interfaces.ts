export interface Reminder {
  title: string;
  intervalMinutes: number;
  pauseMinutes?: number;
  autoPause?: boolean;
  autoStartAfterPause?: boolean;

  lastPauseStart?: number;
  lastPauseEnd?: number;
  showCountDown?: boolean;
  inPause?: boolean;
  countdownFired?: boolean;

  startPausePromptShowed?: boolean;
  endPausePromptShowed?: boolean;
}

export interface TimeInterval {
  workspace: string;
  start: number;
  end?: number;
}