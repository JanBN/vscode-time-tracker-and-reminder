'use strict';
import { TimeInterval } from "./interfaces";

export function hasIntersection(interval: TimeInterval, rangeStart: number, rangeEnd: number): Boolean {
  const result = (interval.start == rangeStart) || (interval.start > rangeStart ? interval.start < rangeEnd : rangeStart < interval.end);
  return result;
}

export function getTimeIntervalCroppedToTimeRange(timeInterval: TimeInterval, rangeStart: number, rangeEnd: number): TimeInterval {
  const isIntersected = hasIntersection(timeInterval, rangeStart, rangeEnd);

  if (isIntersected) {
    const newStart = timeInterval.start < rangeStart ? rangeStart : timeInterval.start;
    const newENd = timeInterval.end > rangeEnd ? rangeEnd : timeInterval.end;
    return { start: newStart, end: newENd, workspace: timeInterval.workspace }
  }

  return null;
}

export function getTimeIntervalsCroppedToTimeRange(timeIntervals: TimeInterval[], rangeStart: number, rangeEnd: number): TimeInterval[] {
  const result: TimeInterval[] = [];
  timeIntervals.forEach(x => {
    const newTimeInt = getTimeIntervalCroppedToTimeRange(x, rangeStart, rangeEnd);
    if (newTimeInt) {
      result.push(newTimeInt);
    }
  });

  return result;
}

