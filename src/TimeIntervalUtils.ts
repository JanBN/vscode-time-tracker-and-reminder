'use strict';
import { TimeInterval } from "./interfaces";

export interface WorkspaceTimeIntervals {
  workspaceName: string;
  timeIntervals: TimeInterval[]
}

class TimeIntervalUtils {
  hasIntersection(interval: TimeInterval, rangeStart: number, rangeEnd: number): Boolean {
    const result = (interval.start == rangeStart) || (interval.start > rangeStart ? interval.start < rangeEnd : rangeStart < interval.end);
    return result;
  }

  getIntersectedPoints(interval1: TimeInterval, interval2: TimeInterval, ): [number, number] {
    const as = interval1.start;
    const ae = interval1.end;
    const bs = interval2.start;
    const be = interval2.end;

    if (bs > ae || as > be) { return null }
    else {
      const os = Math.max(as, bs);
      const oe = Math.min(ae, be);
      return [os, oe]
    }
  }

  getTimeIntervalCroppedToTimeRange(timeInterval: TimeInterval, rangeStart: number, rangeEnd: number): TimeInterval {
    const isIntersected = this.hasIntersection(timeInterval, rangeStart, rangeEnd);

    if (isIntersected) {
      const newStart = timeInterval.start < rangeStart ? rangeStart : timeInterval.start;
      const newENd = timeInterval.end > rangeEnd ? rangeEnd : timeInterval.end;
      return { start: newStart, end: newENd, workspace: timeInterval.workspace }
    }

    return null;
  }

  getTimeIntervalsCroppedToTimeRange(timeIntervals: TimeInterval[], rangeStart: number, rangeEnd: number): TimeInterval[] {
    const result: TimeInterval[] = [];
    timeIntervals.forEach(x => {
      const newTimeInt = this.getTimeIntervalCroppedToTimeRange(x, rangeStart, rangeEnd);
      if (newTimeInt) {
        result.push(newTimeInt);
      }
    });

    return result;
  }

  groupBy(objectArray, property) {
    return objectArray.reduce(function (acc, obj) {
      var key = obj[property];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    }, {});
  }
}

export const timeIntervalUtils = new TimeIntervalUtils();