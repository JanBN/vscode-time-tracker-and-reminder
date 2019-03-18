import { TimeInterval } from "./interfaces";
import { timeIntervalUtils, WorkspaceTimeIntervals } from "./TimeIntervalUtils";

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

  joinAdjacentIntervalsToOne(timeIntervals: TimeInterval[]): TimeInterval[] {

    const result: TimeInterval[] = [];

    const grouppedByWorkspace = timeIntervalUtils.groupBy(timeIntervals, 'workspace');
    const workspaceWithTimeIntervalsArray: WorkspaceTimeIntervals[] = [];
    for (var key in grouppedByWorkspace) {
      const obj = { workspaceName: key, timeIntervals: grouppedByWorkspace[key] };
      workspaceWithTimeIntervalsArray.push(obj);
    }

    for (let wi = 0; wi < workspaceWithTimeIntervalsArray.length; wi++) {
      const workspaceTimeIntervals = workspaceWithTimeIntervalsArray[wi].timeIntervals.sort();

      let prevInterval: TimeInterval = null;
      for (let i = 0; i < workspaceTimeIntervals.length; i++) {
        const interval = workspaceTimeIntervals[i];
        if (prevInterval == null) {
          prevInterval = { start: interval.start, end: interval.end, workspace: interval.workspace };
        }

        if (i + 1 >= workspaceTimeIntervals.length) {
          break
        }

        const nextInterval = workspaceTimeIntervals[i + 1];

        if (prevInterval.end == nextInterval.start) {
          prevInterval.end = nextInterval.end;
        }
        else {
          result.push(prevInterval);
          prevInterval = null
        }
      }

      if (prevInterval != null) {
        result.push(prevInterval);
      }
    }

    return result;
  }

  consolidate(intervals: TimeInterval[]): TimeInterval[] {
    const mergedIntervals = this.joinAdjacentIntervalsToOne(intervals);

    let intersectedPoints: number[] = [];
    let resultIntervals = mergedIntervals.slice();
    for (let i1 = 0; i1 < mergedIntervals.length; i1++) {
      const interval1 = mergedIntervals[i1];
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
    const splittedIntervals = this.splitIntervalsByPoints(mergedIntervals, intersectedPoints);
    const delimiter = "; ";

    const result: TimeInterval[] = [];
    for (let i1 = 0; i1 < splittedIntervals.length; i1++) {
      const interval1 = splittedIntervals[i1];
      const workspaceNames = []
      workspaceNames.push(interval1.workspace);

      if (!result.some(x => x.start == interval1.start && x.end == interval1.end)) {
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

      interval1.workspace = [... new Set(flatArrayOFWorkspaces)].sort().join(delimiter);
    }

    return result;
  }
}

export const consolidator = new Consolidator();