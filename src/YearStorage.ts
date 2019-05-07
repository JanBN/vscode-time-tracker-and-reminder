import * as vscode from 'vscode';
import * as moment from 'moment';
import * as fs from "fs";
import { TimeInterval } from './interfaces';
import { pathUtils } from './PathUtils';
import { consolidator } from './Consolidator';
import { timeIntervalUtils } from './TimeIntervalUtils';
import { WORKSPACE_NAME_DELIMITER } from './TimeTracker';

export class YearStorage {

  _globalStoragePath: string;
  context: vscode.ExtensionContext;
  _savedTimeIntervals: TimeInterval[];
  _newTimeIntervals: TimeInterval[] = [];
  _totalDurationMiliseconds: number = null;
  _todayDurationMilisecondsWithoutCurrentInterval: number = null;
  _totalWorkspaceMiliseconds: number = null;
  _currentDayStart: number;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    pathUtils.ensureStoragePath((context as any).globalStoragePath);

    this._globalStoragePath = pathUtils.getStorageFilePath(context, new Date().getUTCFullYear());

    this.initTimeIntervals();
  }

  getAllTimeIntervals() {
    return [...this._savedTimeIntervals, ...this._newTimeIntervals];
  }

  initTimeIntervals() {
    this.consolidateAndSave();
    this._savedTimeIntervals = this.loadTimeIntervals();
    this._newTimeIntervals = [];
    this.clearCounters()
  }

  consolidateAndSave() {
    const timeIntervals = this.loadTimeIntervals();
    const consolidated = consolidator.consolidate([...timeIntervals, ...this._newTimeIntervals]);
    this.saveTimeIntervals(consolidated);
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

  public getTodayDurationMiliseconds(currentTimeInterval: TimeInterval) {

    let currentTimeIntervalTodayMillisecond = 0;
    if (currentTimeInterval) {
      const currentTimeIntervalCopy = { start: currentTimeInterval.start, end: Date.now(), workspace: currentTimeInterval.workspace };
      const startOfTodayMiliseconds = moment().startOf('day').valueOf();
      const endOfTodayMiliseconds = moment().startOf('day').add(1, 'days').valueOf();

      const croppedInterval = timeIntervalUtils.getTimeIntervalCroppedToTimeRange(currentTimeIntervalCopy, startOfTodayMiliseconds, endOfTodayMiliseconds)
      currentTimeIntervalTodayMillisecond = croppedInterval.end - croppedInterval.start;
    }

    if (this._todayDurationMilisecondsWithoutCurrentInterval && !this.isDayChange()) {
      return this._todayDurationMilisecondsWithoutCurrentInterval + currentTimeIntervalTodayMillisecond;
    }

    const startOfTodayMiliseconds = moment().startOf('day').valueOf();
    const endOfTodayMiliseconds = moment().startOf('day').add(1, 'days').valueOf();

    this._currentDayStart = startOfTodayMiliseconds;

    const timeIntervals = [...this._savedTimeIntervals, ...this._newTimeIntervals].filter(x => !(x.end < startOfTodayMiliseconds));


    const milisecondsArray: number[] = timeIntervalUtils.getTimeIntervalsCroppedToTimeRange(timeIntervals, startOfTodayMiliseconds, endOfTodayMiliseconds).map(x => x.end - x.start);
    this._todayDurationMilisecondsWithoutCurrentInterval = milisecondsArray && milisecondsArray.length > 0 ? milisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
    return this._todayDurationMilisecondsWithoutCurrentInterval + currentTimeIntervalTodayMillisecond;
  }

  public getTotalWorkspaceMiliseconds(workspace: string): number {
    if (this._totalWorkspaceMiliseconds) {
      return this._totalWorkspaceMiliseconds;
    }

    const timeIntervals = [...this._savedTimeIntervals.filter(x => x.workspace && x.workspace.split(WORKSPACE_NAME_DELIMITER).some(y => y.trim() == workspace)), ...this._newTimeIntervals.filter(x => x.workspace.split(WORKSPACE_NAME_DELIMITER).some(y => y.trim() == workspace))];
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
    this._todayDurationMilisecondsWithoutCurrentInterval = null;
    this._totalWorkspaceMiliseconds = null;
  }

  private loadTimeIntervals(): TimeInterval[] {
    if (fs.existsSync(this._globalStoragePath)) {
      const json = fs.readFileSync(this._globalStoragePath, "utf8");
      try {
        const result = JSON.parse(json) as TimeInterval[];
        return result;
      }
      catch (ex) {
        try {
          fs.unlinkSync(this._globalStoragePath);
        }
        catch (ee) { }
      }
      return [];
    }

    return [];
  }

  private saveTimeIntervals(value: TimeInterval[]) {
    value = value.sort((a, b) => a.start - b.start);
    try {
      fs.unlinkSync(this._globalStoragePath);
    }
    catch (e) { }
    fs.writeFileSync(this._globalStoragePath, JSON.stringify(value), "utf8");
  }
}