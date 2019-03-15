import * as moment from 'moment';
import * as vscode from 'vscode';
import { Storage } from './Storage';
import { formatTimeFromMiliseconds } from './TimeFormat';
import { TimeInterval } from './interfaces';
import { getStorageFilePath } from './PathUtils';
import * as fs from "fs";

export class LogWebView {
  _context: vscode.ExtensionContext;
  _storage: Storage;
  _panel: vscode.WebviewPanel;

  constructor(context: vscode.ExtensionContext, storage: Storage) {
    this._context = context;
    this._storage = storage;

    this.init();
  }

  private init() {
    this._panel = vscode.window.createWebviewPanel(
      'time-tracker-log', // Identifies the type of the webview. Used internally
      'Time tracker log', // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      {} // Webview options. More on these later.
    );

    this._panel.webview.html = this.getWebviewContent();
  }

  private getAllTimeIntervals() {
    return this._storage.getAllTimeIntervals();
  }

  private getAverageDayTimeString() {
    const timeIntervals = this.getAllTimeIntervals();
    if (timeIntervals && timeIntervals.length > 0) {
      const dayTimeIntervals = [];
      let daysCount = 0;
      let totalSum = 0;
      timeIntervals.forEach(x => {
        const dateStart = moment(x.start).startOf('day').valueOf();

        if (dayTimeIntervals.indexOf(dateStart) < 0) {
          dayTimeIntervals.push(dateStart);
          daysCount++;
        }

        totalSum += x.end - x.start;
      });

      return formatTimeFromMiliseconds(Math.floor(totalSum / daysCount));
    }

    return 0;
  }

  private getTimeIntervals(timeFrom: number, timeTo: number) {
    const allTimeIntervals = this.getAllTimeIntervals();
    const result = allTimeIntervals.filter(x => x.start >= timeFrom && x.end <= timeTo);
    return result;
  }

  private getTimeSum(timeFrom: number, timeTo: number) {
    const timeIntervals = this.getTimeIntervals(timeFrom, timeTo);
    const timeIntervalsDuration = timeIntervals.map(x => x.end - x.start);
    const sum = timeIntervalsDuration && timeIntervalsDuration.length > 0 ? timeIntervalsDuration.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;

    return sum;
  }

  private groupBy(objectArray, property) {
    return objectArray.reduce(function (acc, obj) {
      var key = obj[property];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    }, {});
  }

  private getYearHtmlData(year: number, timeIntervals: TimeInterval[]): string {

    const dayTimeIntervals = {};

    timeIntervals.forEach(x => {
      const dateStart = moment(x.start).startOf('day').valueOf();
      // const dateEnd = moment(x.start).endOf('day').valueOf();

      if (!dayTimeIntervals[dateStart]) {
        dayTimeIntervals[dateStart] = [];
      }

      dayTimeIntervals[dateStart].push(x);
    });

    const tableRows = [];
    for (var key in dayTimeIntervals) {
      const keyNumber = +key;
      let dayString = moment(keyNumber).format("YYYY-MM-DD dddd");

      const timeIntervals: TimeInterval[] = dayTimeIntervals[key];
      const totalDayTimeMillisecondsArray = timeIntervals.map(x => x.end - x.start);
      const totalDaySum = totalDayTimeMillisecondsArray && totalDayTimeMillisecondsArray.length > 0 ? totalDayTimeMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
      const totalDayString = formatTimeFromMiliseconds(totalDaySum);

      const grouppedByWorkspace = this.groupBy(timeIntervals, 'workspace');

      tableRows.push(
        `
        <tr>
          <td style="min-width: 100px;"><b>Day</b></td>
          <td style="min-width: 100px;"><b>Worspace</b></td> 
          <td style="min-width: 100px;"><b>Time</b></td> 
        </tr>
  
        `
      );

      for (var key in grouppedByWorkspace) {
        const workspaceName = key;
        const grouppedIntervals: TimeInterval[] = grouppedByWorkspace[key];
        const workspaceMillisecondsArray = grouppedIntervals.map(x => x.end - x.start);
        const workspaceSum = workspaceMillisecondsArray && workspaceMillisecondsArray.length > 0 ? workspaceMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
        const workspaceSumString = formatTimeFromMiliseconds(workspaceSum);

        tableRows.push(
          `
          <tr>
            <td style="min-width: 100px;"><b>${dayString }</b></td>
            <td style="min-width: 100px;">${workspaceName}</td> 
            <td style="min-width: 100px;">${workspaceSumString}</td> 
          </tr>
          `
        );

        dayString = ""; // clear date string so it is shwon only the first time
      }


      tableRows.push(
        `
          <tr>
            <td style="min-width: 100px;"></td>
            <td style="min-width: 100px;"><b>Total</b></td> 
            <td style="min-width: 100px;"><b>${totalDayString}</b></td> 
          </tr>
          `
      );
    }

    return `<h2> ${year} </h2>
        <table class="rtable">
          <tbody>
            ${
      tableRows.join("")
      }
          </tbody>
        </table>`;
  }

  private getLastYearPaths() {
    let year = new Date().getUTCFullYear() - 1;
    let result = "";

    do {
      const filePath = getStorageFilePath(this._context, year);
      if (!fs.existsSync(filePath)) {
        break;
      }

      const json = fs.readFileSync(filePath, "utf8");
      const timeIntervals = JSON.parse(json) as TimeInterval[];
      result += this.getYearHtmlData(year, timeIntervals);

      year--;
    } while (1 == 1)

    return result;
  }

  private getWebviewContent() {


    const today = moment().startOf('day');
    const yesterday = today.clone().subtract(1, 'days');

    const yesterdayMilliseconds = this.getTimeSum(yesterday.valueOf(), today.valueOf());
    const last7DaysMilliseconds = this.getTimeSum(today.clone().subtract(7, 'days').valueOf(), today.valueOf());
    const thisWeekMilliseconds = this.getTimeSum(today.clone().subtract(7, 'days').valueOf(), today.valueOf());
    const lastWeekMilliseconds = this.getTimeSum(today.clone().subtract(7, 'days').startOf('week').valueOf(), today.clone().subtract(7, 'days').endOf('week').valueOf());
    const thisMonthMilliseconds = this.getTimeSum(today.clone().startOf('month').valueOf(), today.clone().endOf('month').valueOf());
    const lastMonthMilliseconds = this.getTimeSum(today.clone().subtract(1, 'months').startOf('month').valueOf(), today.clone().subtract(1, 'months').endOf('month').valueOf());

    return `<!DOCTYPE html> <html lang="en">
    <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${this.getStyles()}
            <title>Time tracker log</title>
        </head>
        <body>

            <h1>Time tracker log</h1>
            <h2>Statistics</h2>

            <table class="rtable rtable--flip">
                <thead>
                    <tr>
                        <th>Total time</th>
                        <th>Today time</th>
                        <th>Yesterday time</th>
                        <th>This week</th>
                        <th>Last 7 days time</th>
                        <th>Last week time</td>
                        <th>This month time</td>
                        <th>Last month time</td>
                        <th>Avg. day time</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(this._storage.totalDurationMiliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(this._storage.todayDurationMiliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(yesterdayMilliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(thisWeekMilliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(last7DaysMilliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(lastWeekMilliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(thisMonthMilliseconds)}</td>
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(lastMonthMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getAverageDayTimeString()}</td>
                    </tr>
                </tbody>
            </table>
            
            ${this.getYearHtmlData(new Date().getFullYear(), this.getAllTimeIntervals())}
            ${this.getLastYearPaths()}
           
        </body>  
        </html>`;
  }

  getStyles() {

    const color = new vscode.ThemeColor('editor.foreground');
    const thBackground = new vscode.ThemeColor('editorGutter.background');

    const result = `    <style>
  .rtable {
      /*!
  // IE needs inline-block to position scrolling shadows otherwise use:
    // display: block;
    // max-width: min-content;
    */
      display: inline-block;
      vertical-align: top;
      max-width: 100%;

      overflow-x: auto;

      // optional - looks better for small cell values
      white-space: nowrap;

      border-collapse: collapse;
      border-spacing: 0;
  }

  .rtable,
  .rtable--flip tbody {
      // optional - enable iOS momentum scrolling
      -webkit-overflow-scrolling: touch;

      // scrolling shadows
      background: radial-gradient(left, ellipse, rgba(0, 0, 0, .2) 0%, rgba(0, 0, 0, 0) 75%) 0 center,
          radial-gradient(right, ellipse, rgba(0, 0, 0, .2) 0%, rgba(0, 0, 0, 0) 75%) 100% center;
      background-size: 10px 100%, 10px 100%;
      background-attachment: scroll, scroll;
      background-repeat: no-repeat;
  }

  // change these gradients from white to your background colour if it differs
  // gradient on the first cells to hide the left shadow
  .rtable td:first-child,
  .rtable--flip tbody tr:first-child {
      background-image: linear-gradient(to right, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0) 100%);
      background-repeat: no-repeat;
      background-size: 20px 100%;
  }

  // gradient on the last cells to hide the right shadow
  .rtable td:last-child,
  .rtable--flip tbody tr:last-child {
      background-image: linear-gradient(to left, rgba(255, 255, 255, 1) 50%, rgba(255, 255, 255, 0) 100%);
      background-repeat: no-repeat;
      background-position: 100% 0;
      background-size: 20px 100%;
  }

  .rtable th {
      font-size: 11px;
      text-align: left;
      text-transform: uppercase;
      background: ${thBackground};
  }

  .rtable th,
  .rtable td {
      padding: 6px 12px;
      border: 1px solid #d9d7ce;
  }

  .rtable--flip {
      display: flex;
      overflow: hidden;
      background: none;
  }

  .rtable--flip thead {
      display: flex;
      flex-shrink: 0;
      min-width: min-content;
  }

  .rtable--flip tbody {
      display: flex;
      position: relative;
      overflow-x: auto;
      overflow-y: hidden;
  }

  .rtable--flip tr {
      display: flex;
      flex-direction: column;
      min-width: min-content;
      flex-shrink: 0;
  }

  .rtable--flip td,
  .rtable--flip th {
      display: block;
  }

  .rtable--flip td {
      background-image: none !important;
      // border-collapse is no longer active
      border-left: 0;
  }

  // border-collapse is no longer active
  .rtable--flip th:not(:last-child),
  .rtable--flip td:not(:last-child) {
      border-bottom: 0;
  }

  /*!
  // CodePen house keeping
  */

  body {
      margin: 0;
      padding: 25px;
      color: ${color};
      font-size: 14px;
      line-height: 20px;
  }

  h1,
  h2,
  h3 {
      margin: 0 0 10px 0;
      //color: #1d97bf;
  }

  h1 {
      font-size: 25px;
      line-height: 30px;
  }

  h2 {
      font-size: 20px;
      line-height: 25px;
  }

  h3 {
      font-size: 16px;
      line-height: 20px;
  }

  table {
      margin-bottom: 30px;
  }

  a {
      //color: #ff6680;
  }

  code {
      //background: #fffbcc;
      font-size: 12px;
  }
</style>`;

    return result;
  }
}

