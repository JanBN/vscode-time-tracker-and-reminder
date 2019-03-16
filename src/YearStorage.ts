import * as vscode from 'vscode';
import * as moment from 'moment';
import * as fs from "fs";

import { TimeInterval } from './interfaces';
import { getStorageFilePath } from './PathUtils';
import { hasIntersection, getTimeIntervalsCroppedToTimeRange } from './TimeIntervalUtils';

export class YearStorage {

  _globalStoragePath: string;
  context: vscode.ExtensionContext;
  _savedTimeIntervals: TimeInterval[];
  _newTimeIntervals: TimeInterval[] = [];
  _totalDurationMiliseconds: number = null;
  _todayDurationMiliseconds: number = null;
  _totalWorkspaceMiliseconds: number = null;
  _currentDayStart: number;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.ensureStoragePath((context as any).globalStoragePath);

    this._globalStoragePath = getStorageFilePath(context, new Date().getUTCFullYear());
    console.log(this._globalStoragePath);
    this.consolidateAndSave();

    this._savedTimeIntervals = this.loadTimeIntervals();
  }

  getAllTimeIntervals() {
    return [...this._savedTimeIntervals, ...this._newTimeIntervals];
  }

  consolidateAndSave() {
    const timeIntervals = this.loadTimeIntervals();
    const consolidated = this.consolidate(timeIntervals);
    this.saveTimeIntervals(consolidated);
  }

  consolidate(intervals: TimeInterval[]) {
    let resultIntervals = intervals.slice();
    for (let i1 = 0; i1 < intervals.length; i1++) {
      const interval1 = intervals[i1];

      const intersectedElements: TimeInterval[] = [];
      for (let i2 = 0; i2 < resultIntervals.length; i2++) {
        const interval2 = resultIntervals[i2];
        if (i1 == i2) {
          continue;
        }
        if (hasIntersection(interval1, interval2.start, interval2.end)) {
          intersectedElements.push(interval2);
        }
      }

      if (intersectedElements.length > 0) {
        const delimiter = "; ";
        resultIntervals = resultIntervals.filter(x => !intersectedElements.some(y => y == x));
        const workspacesSomeWithDelimitedStrings = new Set(resultIntervals.map(x => x.workspace));
        const arrayOfArrays = [...workspacesSomeWithDelimitedStrings].map(x => x.split(delimiter));
        const flatArrayOFWorkspaces = [].concat.apply([], arrayOfArrays)

        const newInterval: TimeInterval =
        {
          workspace: [... new Set(flatArrayOFWorkspaces)].join(delimiter),
          start: Math.min(...intersectedElements.map(x => x.start)),
          end: Math.max(...intersectedElements.map(x => x.end)),

        };
        resultIntervals.push(newInterval)
      }
    }

    return resultIntervals;
  }

  ensureStoragePath(path: string) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path)
    }
  }

  public get totalDurationMiliseconds(): number {
    if (this._totalDurationMiliseconds) {
      return this._totalDurationMiliseconds;
    }

    const timeIntervals = [...this._savedTimeIntervals, ...this._newTimeIntervals];
    const milisecondsArray: number[] = timeIntervals.map(x => x.end - x.start);
    this._totalDurationMiliseconds = milisecondsArray && milisecondsArray.length > 0 ? milisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
    return this._totalDurationMiliseconds;
  }

  isDayChange() {
    return moment().startOf('day').valueOf() != this._currentDayStart;
  }

  public get todayDurationMiliseconds() {
    if (this._todayDurationMiliseconds && !this.isDayChange()) {
      return this._todayDurationMiliseconds;
    }

    const startOfTodayMiliseconds = moment().startOf('day').valueOf();
    const endOfTodayMiliseconds = moment().startOf('day').add(1, 'days').valueOf();

    this._currentDayStart = startOfTodayMiliseconds;

    const timeIntervals = [...this._savedTimeIntervals, ...this._newTimeIntervals].filter(x => !(x.end < startOfTodayMiliseconds));
    const milisecondsArray: number[] = getTimeIntervalsCroppedToTimeRange(timeIntervals, startOfTodayMiliseconds, endOfTodayMiliseconds).map(x => x.end - x.start);

    this._todayDurationMiliseconds = milisecondsArray && milisecondsArray.length > 0 ? milisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
    return this._todayDurationMiliseconds;
  }

  public getTotalWorkspaceMiliseconds(workspace: string): number {
    if (this._totalWorkspaceMiliseconds) {
      return this._totalWorkspaceMiliseconds;
    }

    const timeIntervals = [...this._savedTimeIntervals.filter(x => x.workspace && x.workspace.split(";").some(y => y.trim() == workspace)), ...this._newTimeIntervals.filter(x => x.workspace.split(";").some(y => y.trim() == workspace))];
    const milisecondsArray: number[] = timeIntervals.map(x => x.end - x.start);
    this._totalWorkspaceMiliseconds = milisecondsArray && milisecondsArray.length > 0 ? milisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
    return this._totalWorkspaceMiliseconds;
  }

  public addTimeInterval(interval: TimeInterval) {
    this._newTimeIntervals.push(interval)

    this.clearCounters();
  }

  public saveAll() {
    const oldData = this.loadTimeIntervals();
    this.saveTimeIntervals([...oldData, ...this._newTimeIntervals]);
  }

  public clearAllData() {
    this.clearCounters();
    this.saveTimeIntervals([]);
  }

  public clearCounters() {
    this._totalDurationMiliseconds = null;
    this._todayDurationMiliseconds = null;
    this._totalWorkspaceMiliseconds = null;
  }

  private loadTimeIntervals(): TimeInterval[] {
    if (fs.existsSync(this._globalStoragePath)) {
      const json = fs.readFileSync(this._globalStoragePath, "utf8");
      const result = JSON.parse(json) as TimeInterval[];
      return result;
    }

    return [];
  }

  private saveTimeIntervals(value: TimeInterval[]) {
    fs.writeFileSync(this._globalStoragePath, JSON.stringify(value), "utf8");
  }
}