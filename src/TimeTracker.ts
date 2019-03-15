'use strict';
// import * as moment from 'moment';
import 'moment-duration-format';
import { StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { Reminder, TimeInterval } from './interfaces';
import { Storage } from './Storage';
import * as vscode from 'vscode';
import { LogWebView } from './LogWebView';
import { formatTimeFromMiliseconds, formatTime } from './TimeFormat';

export class TimeTracker {

    private readonly MILISECONDS_IN_MINUTE = 60000;
    _statusBarItem: StatusBarItem;
    _context: vscode.ExtensionContext;
    _invervalId: NodeJS.Timer;
    _reminders: Reminder[] = [];
    _currentTimeInterval: TimeInterval = null;
    _storage: Storage = null;
    _config = workspace.getConfiguration('time-tracker');
    _startAppIntervals: TimeInterval[] = [];
    _isStopped: boolean = false;
    _stopStartAt: number;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._storage = new Storage(this._context);

        this.startCurrentTimenterval();
        this.initReminders();
        this.createStatusBars();

        this.createInterval();

        vscode.commands.registerCommand('extension.clearAllData', () => this.clearAllData());
        vscode.commands.registerCommand('extension.toggleStop', () => this.toggleStop());
        vscode.commands.registerCommand('extension.showLog', () => this.showLogWebView());
        vscode.commands.registerCommand('extension.showDataFilePath', () => {
            vscode.window.showInformationMessage(this._storage._globalStoragePath);
        });


        this.recomputeStatusBar();
        this.initEventsHandlers();
    }

    private initEventsHandlers() {
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.workspaceChenged();
        })

        vscode.workspace.onDidChangeConfiguration(() => {
            this.configurationChanged();
        })
    }

    private initReminders() {
        if (this._config.reminders) {
            try {
                this._reminders = JSON.parse(this._config.reminders) as Reminder[];
            }
            catch (ex) {
                this._reminders = [];
                vscode.window.showErrorMessage("Time tracker - Wrong reminders format in settings");
            }

            // this._reminders = [{
            //     title: "Blink",
            //     intervalMinutes: 0.2,
            //     pauseMinutes: 0,
            //     autoPause: true,
            //     showCountDown: true,
            //     autoStartAfterPause: true,
            // }
            //     ,
            // {
            //     title: "Blink2",
            //     intervalMinutes: 0.3,
            //     pauseMinutes: 0,
            //     autoPause: true,
            //     showCountDown: true,
            //     autoStartAfterPause: true,
            // }
            // ]

            this._reminders.forEach(x => {
                x.lastPauseEnd = Date.now();
            });
        }
    }

    private startCurrentTimenterval() {
        this._currentTimeInterval = {
            start: Date.now(),
            workspace: workspace && workspace.name || "--"
        };

        this._startAppIntervals.push(this._currentTimeInterval);
    }

    private endCurrentTimeInterval() {
        this._currentTimeInterval.end = Date.now();
        this._storage.addTimeInterval(this._currentTimeInterval);
    }

    private workspaceChenged() {
        this.endCurrentTimeInterval();
        this._storage.addTimeInterval(this._currentTimeInterval);

        this.startCurrentTimenterval();
        this.recomputeStatusBar();
    }

    private configurationChanged() {
        this._config = workspace.getConfiguration('time-tracker');
        this.initReminders();
        this.recomputeStatusBar();
    }

    private createStatusBars() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        this._statusBarItem.command = 'extension.toggleStop';
        this._statusBarItem.show();
    }

    private recomputeStatusBar(): void {
        const now = Date.now();

        const iconText = this._isStopped ? "$(primitive-square) " : "$(triangle-right) ";

        const totalDurationMilliseconds = this._storage.totalDurationMiliseconds + (now - this._currentTimeInterval.start);
        const totalDurationText = formatTimeFromMiliseconds(totalDurationMilliseconds);

        const totalWorkspaceMilliseconds = this._storage.getTotalWorkspaceMiliseconds(vscode.workspace.name) + (now - this._currentTimeInterval.start);
        const totalWorkspaceText = formatTimeFromMiliseconds(totalWorkspaceMilliseconds);

        const todayDurationMilliseconds = this._storage.todayDurationMiliseconds + (now - this._currentTimeInterval.start);
        const todayDuration = formatTimeFromMiliseconds(todayDurationMilliseconds);

        const intervalsFromStart = this._startAppIntervals.map(x => (x.end || Date.now()) - x.start);
        intervalsFromStart.reduce((accumulator, currentValue) => accumulator + currentValue)
        const fromStartDurationMilliseconds = intervalsFromStart.reduce((accumulator, currentValue) => accumulator + currentValue);
        const fromStartDurationText = formatTimeFromMiliseconds(fromStartDurationMilliseconds);

        let nextReminderText = "";

        var inPauseReminders = this._reminders.filter(x => x.inPause);
        if (inPauseReminders && inPauseReminders.length > 0) {
            nextReminderText = inPauseReminders[0].title + " pause..";
        }
        else {
            const nextReminder = this.getNextReminder();
            if (nextReminder) {
                const secondsToPause = (nextReminder.lastPauseEnd + nextReminder.intervalMinutes * this.MILISECONDS_IN_MINUTE - (this._isStopped ? this._stopStartAt : now)) / 1000;
                const format = secondsToPause <= 90 ? "y[y] M[M] w[w] d[d] h[h] m[m] s[s]" : "y[y] M[M] w[w] d[d] h[h] m[m]";
                nextReminderText = "" + nextReminder.title + " in " + formatTime(secondsToPause < 0 ? 0 : secondsToPause, format);
            }
        }

        const texts = [];

        if (totalDurationText.length > 0 && this._config.showTotalTime) texts.push(totalDurationText);
        if (totalWorkspaceText.length > 0 && this._config.showTotalWorkspaceTime) texts.push(totalWorkspaceText);
        if (todayDuration.length > 0 && this._config.showTodayTime) texts.push(todayDuration);
        if (fromStartDurationText.length > 0) texts.push(fromStartDurationText);
        if (nextReminderText.length > 0 && this._config.showNextReminder) texts.push(nextReminderText);

        this._statusBarItem.text = iconText + texts.join(" | ");
    }

    private endPause(reminder: Reminder) {
        reminder.inPause = false;
        reminder.lastPauseEnd = Date.now();
        reminder.endPausePromptShowed = false;

        if (reminder.autoStartAfterPause && reminder.pauseMinutes > 0) {
            vscode.window.showInformationMessage("END " + reminder.title);
        }

        this.timeElapsed();
    }

    private startPause(reminder: Reminder) {
        reminder.inPause = true;
        reminder.lastPauseStart = Date.now();
        reminder.countdownFired = false;
        reminder.startPausePromptShowed = false;

        if (reminder.autoPause) {
            vscode.window.showInformationMessage("START " + reminder.title);
        }

        setTimeout(() => {
            if (reminder.inPause) {
                if (reminder.autoStartAfterPause) {
                    this.endPause(reminder);
                }
                else {
                    this.firePauseEndPrompt(reminder);
                }
            }

        }, reminder.pauseMinutes * 60 * 1000);

        this.timeElapsed();
    }

    private firePauseStartPrompt(reminder: Reminder) {
        vscode.window
            .showWarningMessage(
                reminder.title,
                'Start'
            )
            .then(e => {
                if (e) {
                    this.startPause(reminder);
                }
            });

        reminder.startPausePromptShowed = true;
    }

    private firePauseEndPrompt(reminder: Reminder) {
        vscode.window
            .showWarningMessage(
                reminder.title,
                'End'
            )
            .then(e => {
                if (e) {
                    this.endPause(reminder);
                }
            });
    }

    private fireCountDown(reminder: Reminder) {
        reminder.countdownFired = true;

        const invervalId = setInterval(() => {
            const now = Date.now();
            const secondsToPause = (reminder.lastPauseEnd + reminder.intervalMinutes * this.MILISECONDS_IN_MINUTE - now) / 1000;
            const shouldStartPause = now >= reminder.lastPauseEnd + reminder.intervalMinutes * this.MILISECONDS_IN_MINUTE && !reminder.inPause;

            if (shouldStartPause) {
                if (reminder.autoPause) {
                    this.startPause(reminder)

                }
                else {
                    if (!reminder.startPausePromptShowed) {
                        this.firePauseStartPrompt(reminder);
                        reminder.startPausePromptShowed = true;
                    }
                }
            }

            if (this._isStopped || shouldStartPause || reminder.startPausePromptShowed) {
                clearInterval(invervalId);
                reminder.countdownFired = false;
                return;
            }

            if (secondsToPause > 0 && secondsToPause <= 3 && reminder.showCountDown) {
                vscode.window.showInformationMessage(Math.ceil(secondsToPause) + " " + reminder.title);
            }

            this.recomputeStatusBar();

        }, 1000);
    }

    private processReminders() {
        const now = Date.now();
        this._reminders.forEach(x => {
            const shouldFireCountDown = now >= (x.lastPauseEnd + x.intervalMinutes * this.MILISECONDS_IN_MINUTE) - this.MILISECONDS_IN_MINUTE * 1.5
                && !x.inPause
                && !x.countdownFired
                && !x.startPausePromptShowed;

            if (shouldFireCountDown) {
                this.fireCountDown(x);
            }
        });
    }

    private getNextReminder(): Reminder {
        const now = Date.now();

        if (this._reminders && this._reminders.length > 0) {
            const remindersSliced = this._reminders.slice();
            remindersSliced.sort((reminder1, reminder2) => {

                const nextPauseInMiliseconds1 = (reminder1.lastPauseEnd + reminder1.intervalMinutes * this.MILISECONDS_IN_MINUTE - now);
                const nextPauseInMiliseconds2 = (reminder2.lastPauseEnd + reminder2.intervalMinutes * this.MILISECONDS_IN_MINUTE - now);

                return nextPauseInMiliseconds1 - nextPauseInMiliseconds2;
            });

            return remindersSliced[0];
        }

        return null;
    }

    private timeElapsed() {

        if (!this._isStopped) {
            this.processReminders();
        }

        this.recomputeStatusBar();
    }

    private createInterval() {
        this._invervalId = setInterval(() => {
            this.timeElapsed();
        }, 1000 * 60);

        this.timeElapsed();
    }

    private toggleStop(): void {
        this._isStopped = !this._isStopped;
        if (this._isStopped) {
            this.endCurrentTimeInterval();
            this._stopStartAt = Date.now();
            vscode.window.showInformationMessage('Time tracker stopped');
        }
        else {
            const stopDuration = Date.now() - this._stopStartAt;
            this.startCurrentTimenterval();

            this._reminders.forEach(x => {
                x.lastPauseEnd += stopDuration;
            });

            vscode.window.showInformationMessage('Time tracker started');

            this.timeElapsed();
        }

        this.recomputeStatusBar();
    }

    private clearAllData() {
        this._storage.clearAllData();
        this.startCurrentTimenterval();
        this.recomputeStatusBar();
        vscode.window.showInformationMessage('Data cleared');
    }

    private showLogWebView() {
        new LogWebView(this._context, this._storage);
    }

    dispose() {
        clearInterval(this._invervalId);
        this.endCurrentTimeInterval();
        this._storage.saveAll();
        this._statusBarItem.dispose();
    }


}
