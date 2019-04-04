import * as moment from 'moment';
import * as vscode from 'vscode';
import { YearStorage } from './YearStorage';
import { TimeInterval } from './interfaces';
import * as fs from "fs";
import { timeFormat } from './TimeFormat';
import { pathUtils } from './PathUtils';
import { timeIntervalUtils, WorkspaceTimeIntervals } from './TimeIntervalUtils';
import { WORKSPACE_NAME_DELIMITER } from './TimeTracker';
import { start } from 'repl';

export class LogWebView {
  _context: vscode.ExtensionContext;
  _storage: YearStorage;
  _panel: vscode.WebviewPanel;
  _currentTimeInterval: TimeInterval;

  ONE_DAY_MILLISECONDS: number = 86400000;

  constructor(context: vscode.ExtensionContext, storage: YearStorage, currentTimeInterval: TimeInterval) {
    this._context = context;
    this._storage = storage;
    this._currentTimeInterval = Object.assign({}, currentTimeInterval);
    if (!this._currentTimeInterval.end) {
      this._currentTimeInterval.end = Date.now();
    }
  }

  exportLog() {
    pathUtils.ensureStoragePath((this._context as any).globalStoragePath);
    const path = pathUtils.getFilePathForLogExport(this._context);
    fs.writeFileSync(path, this.getWebviewContent(), "utf8");
    vscode.window.showInformationMessage("Log exported - " + path, 'Open').then(e => {
      if (e) {
        vscode.workspace.openTextDocument(path).then(doc => vscode.window.showTextDocument(doc));
      }
    });
  }

  show() {
    this._panel = vscode.window.createWebviewPanel(
      'time-tracker-log', // Identifies the type of the webview. Used internally
      'Time tracker log', // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      { enableScripts: true } // Webview options. More on these later.
    );

    this._panel.webview.html = this.getWebviewContent();
  }

  private getThisYearAllTimeIntervals() {
    const allTimeIntervals = this._storage.getAllTimeIntervals().slice();
    if (this._currentTimeInterval) {
      allTimeIntervals.push(this._currentTimeInterval);
    }

    return allTimeIntervals.sort((a, b) => (b.end && a.end) ? b.end - a.end : b.start - a.start);
  }

  private getAverageDayTimeString() {
    const timeIntervals = this.getThisYearAllTimeIntervals();
    if (timeIntervals && timeIntervals.length > 0) {
      let totalSum = 0;
      const usedDays = [];
      timeIntervals.forEach(x => {
        const dateStart = moment(x.start).startOf('day').valueOf();
        const dayEnd = moment(x.start).startOf('day').add(1, "days").valueOf();

        const croppedTimeInterval = timeIntervalUtils.getTimeIntervalCroppedToTimeRange(x, dateStart, dayEnd);

        if (croppedTimeInterval != null) {
          if (usedDays.indexOf(dateStart) < 0) {
            usedDays.push(dateStart);
          }
          totalSum += croppedTimeInterval.end - croppedTimeInterval.start;
        }
      });

      return this.getDurationInHoursOnly(Math.floor(totalSum / usedDays.length));
    }

    return 0;
  }

  private getIntervalsSum(intervals: TimeInterval[]) {
    const timeIntervalsDuration = intervals.map(x => x.end - x.start);
    const sum = timeIntervalsDuration && timeIntervalsDuration.length > 0 ? timeIntervalsDuration.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;

    return sum;
  }

  private getTimeSum(allTimeIntervals: TimeInterval[], timeFrom: number, timeTo: number) {
    const timeIntervals = timeIntervalUtils.getTimeIntervalsCroppedToTimeRange(allTimeIntervals, timeFrom, timeTo);
    const timeIntervalsDuration = timeIntervals.map(x => x.end - x.start);
    const sum = timeIntervalsDuration && timeIntervalsDuration.length > 0 ? timeIntervalsDuration.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;

    return sum;
  }

  private getYearHtmlData(year: number, timeIntervals: TimeInterval[]): string {

    const yearSum = this.getIntervalsSum(timeIntervalUtils.getTimeIntervalsCroppedToTimeRange(timeIntervals, moment(new Date(year, 1, 1)).startOf('year').valueOf(), moment(new Date(year, 1, 1)).endOf('year').valueOf()));

    const monthNames = [];
    const monthMilliseconds = [];
    const startOfyear = moment(new Date(year, 1, 1)).startOf('year');
    for (let i = 0; i < 12; i++) {

      const monthStart = startOfyear.clone().add(i, "month");
      const monthEnd = startOfyear.clone().add(i + 1, "month");

      monthNames.push(monthStart.format('MMMM'));
      const monthSum = this.getIntervalsSum(timeIntervalUtils.getTimeIntervalsCroppedToTimeRange(timeIntervals, monthStart.valueOf(), monthEnd.valueOf()));
      monthMilliseconds.push(monthSum);
    }

    return `<h2 style="padding-top:20px"> ${year} </h2>
    <b> Total time spent: </b> ${this.getDurationInHoursOnly(yearSum)} ${this.getFromatInDaysIfNeeded(yearSum)}

        <h3 style="" class="collapsible active"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Days</h3>
        <div class="content" style="display:block">
          
        <h4 style="" class="collapsible  content_padding_left "> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Summary</h4>
        <div class="content content_padding_left" >
          <table class="rtable">
            <tbody>
              ${this.getPeriodSummaryData(timeIntervals, "day", "days", "YYYY-MM-DD dddd", "Day").join("")}
            </tbody>
          </table>
        </div>

        <h4 style="" class="collapsible  content_padding_left "> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Details</h4>
          <div class="content content_padding_left">
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateData(timeIntervals, "day", "days", "YYYY-MM-DD dddd", "Day").join("")}
              </tbody>
            </table>
          </div>
          
          <h4 style="" class="collapsible  content_padding_left active"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> By workspace</h4>
          <div class="content content_padding_left"  style="display:block;">
            <div>*Shows how long was each workspace opend. Multiple workspaces could have been opened simultaneously. Total count takes it into account.</div>
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateByWorkspaceData(timeIntervals, "day", "days", "YYYY-MM-DD dddd", "Day").join("")}
              </tbody>
            </table>
          </div>

        </div>


        <h3 style="" class="collapsible "> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Weeks</h3>
        <div class="content" style=""">
          
        <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Summary</h4>
        <div class="content content_padding_left" >
          <table class="rtable">
            <tbody>
              ${this.getPeriodSummaryData(timeIntervals, "week", "weeks", "w", "Week").join("")}
            </tbody>
          </table>
        </div>

          <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Details</h4>
          <div class="content content_padding_left">
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateData(timeIntervals, "week", "weeks", "w", "Week").join("")}
              </tbody>
            </table>
          </div>

          <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> By workspace</h4>
          <div class="content content_padding_left">
            <div>*Shows how long was each workspace opend. Multiple workspaces could have been opened simultaneously. Total count takes it into account.</div>
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateByWorkspaceData(timeIntervals, "week", "weeks", "w", "Week").join("")}
              </tbody>
            </table>
          </div>

        </div>

        <h3 style="" class="collapsible"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Months</h3>
        <div class="content">

          <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Summary</h4>
          <div class="content content_padding_left" >
            <table class="rtable">
              <tbody>
                ${this.getPeriodSummaryData(timeIntervals, "month", "months", "MMMM", "Month").join("")}
              </tbody>
            </table>
          </div>

          <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Months</h4>
          <div class="content content_padding_left">
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateData(timeIntervals, "month", "months", "MMMM", "Month").join("")}
              </tbody>
            </table>
          </div>

          <h4 style="" class="collapsible content_padding_left"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> By workspace</h4>
          <div class="content content_padding_left">
            <div>*Shows how long was each workspace opend. Multiple workspaces could have been opened simultaneously. Total count takes it into account.</div>
            <table class="rtable">
              <tbody>
                ${this.getTimePeriodDateByWorkspaceData(timeIntervals, "month", "months", "MMMM", "Month").join("")}
              </tbody>
            </table>
          </div>
          
        </div>


        </div>
    
        `;
  }

  private getTimePeriodDateData(timeIntervals: TimeInterval[]
    , startOfResolution: moment.unitOfTime.StartOf
    , timerangeResolution: moment.unitOfTime.DurationConstructor
    , momentDateFormat: string
    , tableDateLabel: string
    , totalCountFunc: (start: number, end: number) => number = null
    , totalLabel: string = null) {

    const dateTimeIntervals = {};
    timeIntervals.forEach(x => {

      // because of intersected intervals, need to check in which others it belongs to
      let croppedDateInterval: TimeInterval = null;
      let iteration = 0;
      while (true) {
        const dateStart = moment(x.start).add(iteration, timerangeResolution).startOf(startOfResolution).valueOf();
        const dateEnd = moment(x.start).add(iteration, timerangeResolution).endOf(startOfResolution).valueOf();

        croppedDateInterval = timeIntervalUtils.getTimeIntervalCroppedToTimeRange(x, dateStart, dateEnd);
        if (!croppedDateInterval) {
          break;
        }

        const key = moment(croppedDateInterval.start).startOf(startOfResolution).valueOf();

        if (!dateTimeIntervals[key]) {
          dateTimeIntervals[key] = [];
        }
        dateTimeIntervals[key].push(croppedDateInterval);

        iteration++;
      }
    });

    const tableRows = [];
    tableRows.push(`
    <tr>
      <td style="min-width: 100px;"><b>${tableDateLabel}  </b></td>
      <td style="min-width: 100px;"><b>Worspace</b></td> 
      <td style="min-width: 100px;"><b>Time</b></td> 
    </tr>
    `);
    for (var key in dateTimeIntervals) {
      const keyNumber = +key;
      let dateString = moment(keyNumber).format(momentDateFormat);
      const timeIntervals: TimeInterval[] = dateTimeIntervals[key];

      let totalDateSum = 0;
      if (totalCountFunc) {
        totalDateSum = totalCountFunc(keyNumber, moment(keyNumber).endOf(timerangeResolution).valueOf());
      }
      else {
        const totalDateTimeMillisecondsArray = timeIntervals.map(x => x.end - x.start);
        totalDateSum = totalDateTimeMillisecondsArray && totalDateTimeMillisecondsArray.length > 0 ? totalDateTimeMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
      }

      const totalDateString = this.getDurationInHoursOnly(totalDateSum);

      const grouppedByWorkspace = timeIntervalUtils.groupBy(timeIntervals, 'workspace');

      const workspaceWithTimeIntervalsArray: WorkspaceTimeIntervals[] = [];
      for (var key in grouppedByWorkspace) {
        const obj = { workspaceName: key, timeIntervals: grouppedByWorkspace[key] };
        workspaceWithTimeIntervalsArray.push(obj);
      }

      const sorted = workspaceWithTimeIntervalsArray.sort((a, b) => this.getIntervalsSum(b.timeIntervals) - this.getIntervalsSum(a.timeIntervals));
      for (let i = 0; i < sorted.length; i++) {
        const workspaceWithTimeIntervals = sorted[i];

        const workspaceName = workspaceWithTimeIntervals.workspaceName;
        const timeIntervals: TimeInterval[] = workspaceWithTimeIntervals.timeIntervals;

        const workspaceMillisecondsArray = timeIntervals.map(x => x.end - x.start);
        const workspaceSum = workspaceMillisecondsArray && workspaceMillisecondsArray.length > 0 ? workspaceMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;

        if (workspaceSum < 1000) // second
        {
          continue;
        }

        const workspaceSumString = this.getDurationInHoursOnly(workspaceSum);
        tableRows.push(`
          <tr>
            <td style="width: 150px;"><b>${dateString}</b></td>
            <td style="width: 500px;">${workspaceName}</td> 
            <td style="min-width: 100px;">${workspaceSumString} ${this.getFromatInDaysIfNeeded(workspaceSum)}</td> 
          </tr>
          `);
        dateString = ""; // clear date string so it is shwon only the first time
      }

      tableRows.push(`
          <tr>
            <td style="min-width: 100px;"></td>
            <td style="min-width: 100px;"><b>${totalLabel ? totalLabel : "Total"}</b></td> 
            <td style="min-width: 100px;"><b>${totalDateString} ${this.getFromatInDaysIfNeeded(totalDateSum)}</b></td> 
          </tr>
          `);
    }
    return tableRows;
  }

  private getTimePeriodDateByWorkspaceData(allTimeIntervals: TimeInterval[], startOfResolution: moment.unitOfTime.StartOf, timerangeResolution: moment.unitOfTime.DurationConstructor, momentDateFormat: string, tableDateLabel: string) {

    const timeIntervalsOneWorkspacePerEach: TimeInterval[] = [];
    for (let i = 0; i < allTimeIntervals.length; i++) {
      const element = allTimeIntervals[i];
      const workspaces = element.workspace.split(WORKSPACE_NAME_DELIMITER);
      for (let j = 0; j < workspaces.length; j++) {
        const workspace = workspaces[j];
        timeIntervalsOneWorkspacePerEach.push({ start: element.start, end: element.end, workspace: workspace });
      }
    }

    const result = this.getTimePeriodDateData(timeIntervalsOneWorkspacePerEach
      , startOfResolution
      , timerangeResolution
      , momentDateFormat
      , tableDateLabel
      , (start, end) => { return this.getTimeSum(allTimeIntervals, start, end) }
      , "Total*"
    );

    return result;
  }

  private getPeriodSummaryData(timeIntervals: TimeInterval[], startOfResolution: moment.unitOfTime.StartOf, timerangeResolution: moment.unitOfTime.DurationConstructor, momentDateFormat: string, tableDateLabel: string) {

    const dateTimeIntervals = {};
    timeIntervals.sort((a, b) => b.start - a.start).forEach(x => {

      // because of intersected intervals, need to check in which others it belongs to
      let croppedDateInterval: TimeInterval = null;
      let iteration = 0;
      while (true) {
        const dateStart = moment(x.start).add(iteration, timerangeResolution).startOf(startOfResolution).valueOf();
        const dateEnd = moment(x.start).add(iteration, timerangeResolution).endOf(startOfResolution).valueOf();

        croppedDateInterval = timeIntervalUtils.getTimeIntervalCroppedToTimeRange(x, dateStart, dateEnd);
        if (!croppedDateInterval) {
          break;
        }

        const key = moment(croppedDateInterval.start).startOf(startOfResolution).valueOf();

        if (!dateTimeIntervals[key]) {
          dateTimeIntervals[key] = [];
        }
        dateTimeIntervals[key].push(croppedDateInterval);

        iteration++;
      }
    });

    const tableRows = [];
    tableRows.push(`
    <tr>
      <td style="min-width: 100px;"><b>${tableDateLabel}  </b></td>
      <td style="min-width: 100px;"><b>Time</b></td> 
    </tr>
    `);
    for (var key in dateTimeIntervals) {
      const keyNumber = +key;
      let dateString = moment(keyNumber).format(momentDateFormat);
      const timeIntervals: TimeInterval[] = dateTimeIntervals[key];
      const totalDateTimeMillisecondsArray = timeIntervals.map(x => x.end - x.start);
      const totalDateSum = totalDateTimeMillisecondsArray && totalDateTimeMillisecondsArray.length > 0 ? totalDateTimeMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
      const totalDateString = this.getDurationInHoursOnly(totalDateSum);

      tableRows.push(`
          <tr>
            <td style="min-width: 100px;"><b>${dateString}</b></td> 
            <td style="min-width: 100px;">${totalDateString} ${this.getFromatInDaysIfNeeded(totalDateSum)}</td> 
          </tr>
          `);
    }
    return tableRows;
  }

  private getLastYearsHtmlData() {
    let year = new Date().getUTCFullYear() - 1;
    let result = "";

    do {
      const filePath = pathUtils.getStorageFilePath(this._context, year);
      if (!fs.existsSync(filePath)) {
        break;
      }

      const json = fs.readFileSync(filePath, "utf8");
      const timeIntervals = JSON.parse(json) as TimeInterval[];
      result += this.getYearHtmlData(year, timeIntervals.reverse());

      year--;
    } while (1 == 1)

    return result;
  }

  private getWebviewContent() {

    const timeIntervals = this.getThisYearAllTimeIntervals();

    const today = moment().startOf('day');
    const yesterday = today.clone().subtract(1, 'days').startOf("day");

    const todayMilliseconds = this.getTimeSum(timeIntervals, today.valueOf(), today.clone().endOf("day").valueOf());
    const yesterdayMilliseconds = this.getTimeSum(timeIntervals, yesterday.clone().startOf("day").valueOf(), yesterday.clone().endOf("day").valueOf());
    const last7DaysMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(7, 'days').valueOf(), today.clone().endOf("day").valueOf());
    const thisWeekMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(7, 'days').valueOf(), today.clone().endOf("day").valueOf());
    const lastWeekMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(7, 'days').startOf('week').valueOf(), today.clone().subtract(7, 'days').endOf('week').valueOf());
    const thisMonthMilliseconds = this.getTimeSum(timeIntervals, today.clone().startOf('month').valueOf(), today.clone().endOf('month').valueOf());
    const lastMonthMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(1, 'months').startOf('month').valueOf(), today.clone().subtract(1, 'months').endOf('month').valueOf());

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
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(todayMilliseconds)}${this.getFromatInDaysIfNeeded(todayMilliseconds)} </td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(yesterdayMilliseconds)}${this.getFromatInDaysIfNeeded(yesterdayMilliseconds)} </td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(thisWeekMilliseconds)} ${this.getFromatInDaysIfNeeded(thisWeekMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(last7DaysMilliseconds)} ${this.getFromatInDaysIfNeeded(last7DaysMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(lastWeekMilliseconds)} ${this.getFromatInDaysIfNeeded(lastWeekMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(thisMonthMilliseconds)} ${this.getFromatInDaysIfNeeded(thisMonthMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getDurationInHoursOnly(lastMonthMilliseconds)} ${this.getFromatInDaysIfNeeded(lastMonthMilliseconds)}</td>
                        <td style="min-width: 100px;">${this.getAverageDayTimeString()} </td>
                      </tr>
              </tbody>
              </table>

              ${this.getYearHtmlData(new Date().getFullYear(), this.getThisYearAllTimeIntervals())}
              ${this.getLastYearsHtmlData()}


<script>
            var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
  coll[i].addEventListener("click", function() {
    this.classList.toggle("active");
    var content = this.nextElementSibling;
    if (content.style.display === "block") {
      content.style.display = "none";
    } else {
      content.style.display = "block";
    }
  });
}
</script>

  </body>  
  </html>`;
  }

  getDurationInHoursOnly(millis: number) {
    const format = millis < 60 * 1000 ? "h[h] m[m] s[s]" : "h[h] m[m]";
    return timeFormat.formatTimeFromMiliseconds(millis, format);
  }

  getFromatInDaysIfNeeded(millis: number) {
    if (millis >= (this.ONE_DAY_MILLISECONDS)) {
      return "(" + timeFormat.formatTimeFromMiliseconds(millis) + ")";
    }

    return "";

  }

  getStyles() {

    const result = `      
      <style>

      .arrow-down
      {
        display:none;
      }

      .active > .arrow-down
      {
          display:inline;
      }

      .active > .arrow-right
      {
          display:none;
      }

      .collapsible {
        cursor: pointer;
        padding: 10px;
        padding-left:0px;
        width: 100%;
        border: 1px solid bottom;
        text-align: left;
        outline: none;
        font-size: 15px;
      }
      
      .active, .collapsible:hover {
        font-weight:bold;
      }
      
      .content {
        display: none;
        overflow: hidden;
      }


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
          font-size: 16px !important;
          line-height: 20px;
          margin:0px;
          margin-top:10px;
      }

      h4 {
        margin:5px !important;
        font-size: 14px !important;
        /* font-weight:normal !important; */
      }

      table {
        /* margin-bottom: 30px;*/
      }

      a {
        /*color: #ff6680;*/
      }

      .content_padding_left
      {
        padding-left:20px;
      }
      code {
        /*background: #fffbcc;*/
          font-size: 12px;
      }
    </style>`;

    return result;
  }
}

