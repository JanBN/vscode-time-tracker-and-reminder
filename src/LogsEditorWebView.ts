import * as moment from 'moment';
import * as vscode from 'vscode';
import { YearStorage } from './YearStorage';
import { TimeInterval } from './interfaces';
import * as fs from "fs";
import { timeFormat } from './TimeFormat';
import { pathUtils } from './PathUtils';
import { timeIntervalUtils, WorkspaceTimeIntervals } from './TimeIntervalUtils';
import { WORKSPACE_NAME_DELIMITER } from './TimeTracker';


interface TimeIntervalIndex {
  timeInterval: TimeInterval;
  index: number;
}

export class LogsEditorWebView {
  _context: vscode.ExtensionContext;
  _storage: YearStorage;
  _panel: vscode.WebviewPanel;

  DATE_TIME_FORMAT: string = "YYYY-MM-DD HH:mm:ss";
  timeIntervalsWithIds: TimeIntervalIndex[];
  _afterSaveFunc: () => void;

  constructor(context: vscode.ExtensionContext, storage: YearStorage, afterSaveFunc: () => void) {
    this._context = context;
    this._storage = storage;
    this._afterSaveFunc = afterSaveFunc;
  }

  show() {
    const timeIntervals = this.getThisYearAllTimeIntervals();
    this.timeIntervalsWithIds = timeIntervals.map((x, i) => { return { timeInterval: x, index: i } });

    this._panel = vscode.window.createWebviewPanel(
      'time-tracker-log-editor', // Identifies the type of the webview. Used internally
      'Time tracker log-editor', // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      { enableScripts: true } // Webview options. More on these later.
    );

    this._panel.webview.html = this.getWebviewContent();

    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'delete':
            {
              const id = message.id;
              this.timeIntervalsWithIds = this.timeIntervalsWithIds.filter(x => x.index != id);

              this._storage.saveEditedData(this.timeIntervalsWithIds.map(x => x.timeInterval));
              this._afterSaveFunc();

              this._panel.webview.html = " ";
              this._panel.webview.html = this.getWebviewContent();

              return;
            }

          case 'update':
            {
              const { id, start, end, workspace } = message;
              const interval = this.timeIntervalsWithIds.find(x => x.index == id)
              interval.timeInterval.workspace = workspace;
              interval.timeInterval.start = moment(start, this.DATE_TIME_FORMAT).toDate().getTime();
              interval.timeInterval.end = moment(end, this.DATE_TIME_FORMAT).toDate().getTime();

              this._storage.saveEditedData(this.timeIntervalsWithIds.map(x => x.timeInterval));
              this._afterSaveFunc();

              this._panel.webview.html = " ";
              this._panel.webview.html = this.getWebviewContent();

              return;
            }
        }
      },
      undefined,
    );
  }

  private getThisYearAllTimeIntervals() {
    const allTimeIntervals = this._storage.getAllTimeIntervals().slice();
    return allTimeIntervals.sort((a, b) => (b.end && a.end) ? b.end - a.end : b.start - a.start);
  }


  private getWebviewContent() {
    const tableRows = [];
    this.timeIntervalsWithIds.forEach(x => {
      const formattedStart = moment(x.timeInterval.start).format(this.DATE_TIME_FORMAT);
      const formattedEnd = moment(x.timeInterval.end).format(this.DATE_TIME_FORMAT);

      const totalDateString = this.getDurationInHoursOnly(x.timeInterval.end - x.timeInterval.start);

      tableRows.push(`
        <tr>
          <td style="min-width: 100px;"><input id ="startInput_${x.index}" type="text" value="${formattedStart}"></td> 
          <td style="min-width: 100px;"><input id ="endInput_${x.index}" type="text" value="${formattedEnd}"></td> 
          <td style="min-width: 100px;">${totalDateString}</td> 
          <td style="width:100%"><input id ="workspace_${x.index}" style="width:100%" type="text" value="${x.timeInterval.workspace}"></td> 

          <td style="min-width: 100px;"> <button onClick="updateInterval(${x.index})"> Save </button></td> 
          <td style="min-width: 100px;"> <button onClick="deleteInterval(${x.index})"> Delete </button></td> 
        </tr>
        `);
    })

    return `<!DOCTYPE html> <html lang="en">
    <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${this.getStyles()}
            <title>Time tracker editor</title>
        </head>
        <body>
              <h1>Time tracker editor</h1><table class="rtable">
                  <thead>
                      <tr>
                          <th>Start</th>
                          <th>End</th>
                          <th>Total</th>
                          <th>Workspace</td>
                          <th>Save</td>
                          <th>Delete</td>
                      </tr>
                  </thead>
                  <tbody>
                           ${tableRows.join("")}
                </tbody>
              </table>
              
              <div  id="saving_overlay" 
              style="position: fixed;
                    display: none;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 2; 
                    cursor: pointer;"
                >
                <div id="text" style="position: absolute;
                                      top: 50%;
                                      left: 50%;
                                      font-size: 50px;
                                      color: white;
                                      transform: translate(-50%,-50%);
                                      -ms-transform: translate(-50%,-50%);"
                >
                  Saving...
                </div>
              </div>

<script>
  
    vscode = acquireVsCodeApi();

    saving_overlay = document.getElementById("saving_overlay");
    saving_overlay.style.display = "none";
  
    function deleteInterval(id)
    {
        var saving_overlay = document.getElementById("saving_overlay").style.display = "block";

        vscode.postMessage({command: 'delete',id: id})
    }

    function updateInterval(id)
    {
        var saving_overlay = document.getElementById("saving_overlay").style.display = "block";

        var start = document.getElementById("startInput_"+id).value;
        var end = document.getElementById("endInput_"+id).value;
        var workspace = document.getElementById("workspace_"+id).value;

        vscode.postMessage({command: 'update',id: id, start: start, end:end, workspace:workspace})
    }
            
</script>

  </body>  
  </html>`;
  }

  getDurationInHoursOnly(millis: number) {
    const format = millis < 60 * 1000 ? "h[h] m[m] s[s]" : "h[h] m[m]";
    return timeFormat.formatTimeFromMiliseconds(millis, format);
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

