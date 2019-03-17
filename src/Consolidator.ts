import { TimeInterval } from "./interfaces";
import { timeIntervalUtils } from "./TimeIntervalUtils";

class Consolidator {
  splitIntervalsByPoints(intervals: TimeInterval[], points: number[]): TimeInterval[] {

    let workIntervals = intervals.slice();
    for (let i = 0; i < points.length; i++) {
      const point = points[i];


      let newWorkIntervals = [];
      for (let j = 0; j < workIntervals.length; j++) {
        const interval = workIntervals[j];
        newWorkIntervals = [...newWorkIntervals, ...this.splitIntervalByPoint(interval, point)];
      }

      workIntervals = newWorkIntervals;
    }

    return workIntervals;
  }

  splitIntervalByPoint(interval: TimeInterval, point: number): TimeInterval[] {
    const result: TimeInterval[] = [];

    if (point > interval.start && point < interval.end) {
      return [
        { start: interval.start, end: point, workspace: interval.workspace },
        { start: point, end: interval.end, workspace: interval.workspace }];
    }

    return [interval];
  }

  consolidate(intervals: TimeInterval[]): TimeInterval[] {

    let intersectedPoints: number[] = [];
    let resultIntervals = intervals.slice();
    for (let i1 = 0; i1 < intervals.length; i1++) {
      const interval1 = intervals[i1];
      for (let i2 = 0; i2 < resultIntervals.length; i2++) {
        const interval2 = resultIntervals[i2];
        if (i1 == i2) {
          continue;
        }

        const ipoints = timeIntervalUtils.getIntersectedPoints(interval1, interval2);
        if (ipoints) {
          intersectedPoints.push(ipoints[0]);
          intersectedPoints.push(ipoints[1]);
        }
      }
    }

    intersectedPoints = [...new Set(intersectedPoints)];
    const splittedIntervals = this.splitIntervalsByPoints(intervals, intersectedPoints);
    const delimiter = "; ";

    const result: TimeInterval[] = [];
    for (let i1 = 0; i1 < splittedIntervals.length; i1++) {
      const interval1 = splittedIntervals[i1];
      const workspaceNames = []
      workspaceNames.push(interval1.workspace);

      if (!result.some(x => x.start == interval1.start && x.end == interval1.end))
      {
        result.push(interval1);
      }

      for (let i2 = 0; i2 < splittedIntervals.length; i2++) {
        const interval2 = splittedIntervals[i2];
        if (i1 == i2) {
          continue;
        }


        if (interval1.start == interval2.start && interval1.end == interval2.end) {
          workspaceNames.push(interval2.workspace);
        }
      }

      const workspacesSomeWithDelimitedStrings = new Set(workspaceNames);
      const arrayOfArrays = [...workspacesSomeWithDelimitedStrings].filter(x => x).map(x => x.split(delimiter));
      const flatArrayOFWorkspaces = [].concat.apply([], arrayOfArrays)
   
      interval1.workspace= [... new Set(flatArrayOFWorkspaces)].sort().join(delimiter) ;
    }

    return result;
  }
}

export const consolidator = new Consolidator();