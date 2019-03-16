import * as moment from 'moment';
import * as vscode from 'vscode';
import { Storage } from './Storage';
import { formatTimeFromMiliseconds } from './TimeFormat';
import { TimeInterval } from './interfaces';
import { getStorageFilePath } from './PathUtils';
import * as fs from "fs";
import { getTimeIntervalCroppedToTimeRange, getTimeIntervalsCroppedToTimeRange } from './TimeIntervalUtils';

export class LogWebView {
  _context: vscode.ExtensionContext;
  _storage: Storage;
  _panel: vscode.WebviewPanel;
  _currentTimeInterval: TimeInterval;

  constructor(context: vscode.ExtensionContext, storage: Storage, currentTimeInterval: TimeInterval) {
    this._context = context;
    this._storage = storage;
    this._currentTimeInterval = Object.assign({}, currentTimeInterval);
    if (!this._currentTimeInterval.end) {
      this._currentTimeInterval.end = Date.now();
    }

    this.init();
  }

  private init() {
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

    return allTimeIntervals.reverse();
  }

  private getAverageDayTimeString() {
    const timeIntervals = this.getThisYearAllTimeIntervals();
    if (timeIntervals && timeIntervals.length > 0) {
      let totalSum = 0;
      const usedDays = [];
      timeIntervals.forEach(x => {
        const dateStart = moment(x.start).startOf('day').valueOf();
        const dayEnd = moment(x.start).startOf('day').add(1, "days").valueOf();

        const croppedTimeInterval = getTimeIntervalCroppedToTimeRange(x, dateStart, dayEnd);

        if (croppedTimeInterval != null) {
          if (usedDays.indexOf(dateStart) < 0) {
            usedDays.push(dateStart);
          }
          totalSum += croppedTimeInterval.end - croppedTimeInterval.start;
        }
      });

      return formatTimeFromMiliseconds(Math.floor(totalSum / usedDays.length));
    }

    return 0;
  }

  private getItervalsSum(intervals: TimeInterval[]) {
    const timeIntervalsDuration = intervals.map(x => x.end - x.start);
    const sum = timeIntervalsDuration && timeIntervalsDuration.length > 0 ? timeIntervalsDuration.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;

    return sum;
  }

  private getTimeSum(allTimeIntervals: TimeInterval[], timeFrom: number, timeTo: number) {
    const timeIntervals = getTimeIntervalsCroppedToTimeRange(allTimeIntervals, timeFrom, timeTo);
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
    const dayTableRows = this.getTimePeriodDateData(timeIntervals, "day", "days", "YYYY-MM-DD dddd", "Day");
    const monthTableRows = this.getTimePeriodDateData(timeIntervals, "month", "months", "MMMM", "Month");
    const weekTableRows = this.getTimePeriodDateData(timeIntervals, "week", "weeks", "w", "Week");

    const yearSum = this.getItervalsSum(getTimeIntervalsCroppedToTimeRange(timeIntervals, moment(new Date(year, 1, 1)).startOf('year').valueOf(), moment(new Date(year, 1, 1)).endOf('year').valueOf()));
    

    const monthNames = [];
    const monthMilliseconds = [];
    const startOfyear = moment(new Date(year, 1, 1)).startOf('year');
    for (let i = 0; i < 12; i++) {

      const monthStart = startOfyear.clone().add(i, "month");
      const monthEnd = startOfyear.clone().add(i + 1, "month");

      monthNames.push(monthStart.format('MMMM'));
      const monthSum = this.getItervalsSum(getTimeIntervalsCroppedToTimeRange(timeIntervals, monthStart.valueOf(), monthEnd.valueOf()));
      monthMilliseconds.push(monthSum);
    }

    return `<h2> ${year} </h2>
    <b> Total time spent: </b> ${formatTimeFromMiliseconds(yearSum)}

    <h3 class="collapsible active"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Days</h3>
        <div class="content" style="display:block">
          <table class="rtable">
            <tbody>
              ${dayTableRows.join("")}
            </tbody>
          </table>
        </div>

        <h3 class="collapsible"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Weeks</h3>
        <div class="content">
          <table class="rtable">
            <tbody>
              ${weekTableRows.join("")}
            </tbody>
          </table>
        </div>

        <h3 class="collapsible"> <span class="arrow-down">⯆</span> <span class="arrow-right">⯈</span> Months</h3>
        <div class="content">
          <table class="rtable">
            <thead>
              <tr>
                ${monthNames.map(x => "<th><b>" + x + "</b> </th>").join("")}          
              </tr>
            </thead>

            <tbody>
              <tr>
                ${monthMilliseconds.map(x => "<td>" + formatTimeFromMiliseconds(x) + " </td>").join("")}
              </tr>
            </tbody>
          </table>

          <table class="rtable">
            <tbody>
              ${monthTableRows.join("")}
            </tbody>
          </table>
        </div>
    
        `;
  }

  private getTimePeriodDateData(timeIntervals: TimeInterval[], startOfResolution: moment.unitOfTime.StartOf, timerangeResolution: moment.unitOfTime.DurationConstructor, momentDateFormat: string, tableDateLabel: string) {
    const dateTimeIntervals = {};
    timeIntervals.forEach(x => {
      const dateStart = moment(x.start).startOf(startOfResolution).valueOf();
      const dateEnd = moment(x.start).startOf(startOfResolution).add(1, timerangeResolution).valueOf();

      if (!dateTimeIntervals[dateStart]) {
        dateTimeIntervals[dateStart] = [];
      }
      dateTimeIntervals[dateStart].push(getTimeIntervalCroppedToTimeRange(x, dateStart, dateEnd));
    });
    const tableRows = [];
    for (var key in dateTimeIntervals) {
      const keyNumber = +key;
      let dateString = moment(keyNumber).format(momentDateFormat);
      const timeIntervals: TimeInterval[] = dateTimeIntervals[key];
      const totalDateTimeMillisecondsArray = timeIntervals.map(x => x.end - x.start);
      const totalDateSum = totalDateTimeMillisecondsArray && totalDateTimeMillisecondsArray.length > 0 ? totalDateTimeMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
      const totalDateString = formatTimeFromMiliseconds(totalDateSum);
      const grouppedByWorkspace = this.groupBy(timeIntervals, 'workspace');
      tableRows.push(`
        <tr>
          <td style="min-width: 100px;"><b>${tableDateLabel}  </b></td>
          <td style="min-width: 100px;"><b>Worspace</b></td> 
          <td style="min-width: 100px;"><b>Time</b></td> 
        </tr>
  
        `);
      for (var key in grouppedByWorkspace) {
        const workspaceName = key;
        const grouppedIntervals: TimeInterval[] = grouppedByWorkspace[key];
        const workspaceMillisecondsArray = grouppedIntervals.map(x => x.end - x.start);
        const workspaceSum = workspaceMillisecondsArray && workspaceMillisecondsArray.length > 0 ? workspaceMillisecondsArray.reduce((accumulator, currentValue) => accumulator + currentValue) : 0;
        const workspaceSumString = formatTimeFromMiliseconds(workspaceSum);
        tableRows.push(`
          <tr>
            <td style="width: 150px;"><b>${dateString}</b></td>
            <td style="width: 500px;">${workspaceName}</td> 
            <td style="min-width: 100px;">${workspaceSumString}</td> 
          </tr>
          `);
        dateString = ""; // clear date string so it is shwon only the first time
      }

      tableRows.push(`
          <tr>
            <td style="min-width: 100px;"></td>
            <td style="min-width: 100px;"><b>Total</b></td> 
            <td style="min-width: 100px;"><b>${totalDateString}</b></td> 
          </tr>
          `);
    }
    return tableRows;
  }



  private getLastYearHtmlData() {
    let year = new Date().getUTCFullYear() - 1;
    let result = "";

    do {
      const filePath = getStorageFilePath(this._context, year);
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
    const yesterday = today.clone().subtract(1, 'days');

    const todayMilliseconds = this.getTimeSum(timeIntervals, today.valueOf(), today.clone().add(1, 'days').valueOf());
    const yesterdayMilliseconds = this.getTimeSum(timeIntervals, yesterday.valueOf(), today.valueOf());
    const last7DaysMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(7, 'days').valueOf(), today.valueOf());
    const thisWeekMilliseconds = this.getTimeSum(timeIntervals, today.clone().subtract(7, 'days').valueOf(), today.valueOf());
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
                        <td style="min-width: 100px;">${formatTimeFromMiliseconds(todayMilliseconds)}</td>
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
            
            ${this.getYearHtmlData(new Date().getFullYear(), this.getThisYearAllTimeIntervals())}
            ${this.getLastYearHtmlData()}
           

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

