'use strict';
import 'moment-duration-format';
import { StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { Reminder, TimeInterval } from './interfaces';
import { YearStorage } from './YearStorage';
import * as vscode from 'vscode';
import { LogWebView } from './LogWebView';
import { timeFormat } from './TimeFormat';
import { consolidator } from './Consolidator';
import * as Git from './@types/git';

export const WORKSPACE_NAME_DELIMITER = "; ";

export class TimeTracker {

    private readonly MILISECONDS_IN_MINUTE = 60000;
    _statusBarItem: StatusBarItem;
    _context: vscode.ExtensionContext;
    _invervalId: NodeJS.Timer;
    _reminders: Reminder[] = [];
    _currentTimeInterval: TimeInterval = null;
    _storage: YearStorage = null;
    _config = workspace.getConfiguration('time-tracker');
    _startAppIntervals: TimeInterval[] = [];
    _isStopped: boolean = false;
    _stopStartAt: number;
    _simpleGit: any;
    _gitAPI: Git.API;
    _lastBranchName: string;
    _gotOnRepositoryDidChangeSubscribes: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {

        // const result = consolidator.consolidate([
        //     { start: 10, end: 15, workspace: '10-15' }
        //     ,{ start: 13, end: 15, workspace: '13-15' }
        //     ,{ start: 130, end: 150, workspace: '130-150' }
        //     ,{ start: 15, end: 16, workspace: '15-16' }
        //     ,{ start: 16, end: 20, workspace: '16-20' }
        //     ,{ start: 1, end: 15, workspace: '1-15' }
        //     ,{ start: 6, end: 200, workspace: '6-200' }
        //      ]);

        // const result = consolidator.joinAdjacentIntervalsToOne([
        // { start: 10, end: 15, workspace: "a" }
        // ,{ start: 15, end: 20, workspace: "a" }
        // ,{ start: 25, end: 30, workspace: "a" }
        // ,{ start: 30, end: 40, workspace: "a" }
        // ,{ start: 40, end: 41, workspace: "a" }
        // ,{ start: 10, end: 15, workspace: "b" }
        // ,{ start: 15, end: 40, workspace: 'b' }
        // ,{ start: 45, end: 48, workspace: 'b' }
        // ,{ start: 15, end: 180, workspace: 'c' }
        //  ]);


        this._context = context;
        this._gitAPI = vscode.extensions.getExtension('vscode.git').exports.getAPI(1);

        this._storage = new YearStorage(this._context);
        this.initGit();

        this.startCurrentTimenterval();
        this.initReminders();
        this.createStatusBars();

        this.createInterval();

        vscode.commands.registerCommand('extension.clearAllData', () => this.clearAllData());
        vscode.commands.registerCommand('extension.toggleStop', () => this.toggleStop());
        vscode.commands.registerCommand('extension.showLog', () => this.showLogWebView());
        vscode.commands.registerCommand('extension.exportLog', () => this.exportLog());
        vscode.commands.registerCommand('extension.showDataFile', () => {
            vscode.workspace.openTextDocument(this._storage._globalStoragePath).then(doc => vscode.window.showTextDocument(doc))
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

    private initGit() {
        const onDidOpenRepositorySubs = this._gitAPI.onDidOpenRepository(rep => {
            this._gotOnRepositoryDidChangeSubscribes.forEach(x => x.dispose());
            this._gitAPI.repositories.forEach(rep => {
                const subscribe = rep.state.onDidChange(() => {

                    if (rep.state.HEAD && rep.state.HEAD.name && this._lastBranchName != rep.state.HEAD.name) {
                        this._lastBranchName = rep.state.HEAD.name;

                        if (this._config.trackGitBranch) {
                            console.log("calling workspace changed");
                            console.log(rep.state.HEAD.name);
                            this.gitBranchChenged();
                        }
                    }
                });

                this._gotOnRepositoryDidChangeSubscribes.push(subscribe);
            });

            const currentBranchName = this.getGitBranchName();
            if (this._config.trackGitBranch && currentBranchName != this._lastBranchName) {
                console.log("calling workspace changed");
                this.gitBranchChenged();

                this._lastBranchName = currentBranchName;
            }
        });
    }

    private getWorkspaceName(): string {
        let result = workspace && workspace.name || "--";
        if (this._gitAPI && this._config.trackGitBranch) {
            const branchName = this.getGitBranchName();

            if (branchName) {
                result = `${result} (${branchName})`;
            }
        }

        return result;
    }

    private getGitBranchName(): string {
        if (this._gitAPI) {
            const branchNames = [];
            this._gitAPI.repositories.forEach(rep => {
                if (rep.state.HEAD && rep.state.HEAD.name) {
                    branchNames.push(rep.state.HEAD.name)
                }
            });

            return branchNames.join(", ");
        }

        return null;
    }

    private startCurrentTimenterval(date?: number) {
        this._currentTimeInterval = {
            start: date ? date : Date.now(),
            workspace: this.getWorkspaceName()
        };

        this._startAppIntervals.push(this._currentTimeInterval);
    }

    private endCurrentTimeInterval(date?: number) {
        this._currentTimeInterval.end = date ? date : Date.now();
        this._storage.addTimeInterval(this._currentTimeInterval);
    }

    private gitBranchChenged() {
        this.endCurrentTimeInterval();
        this._storage.addTimeInterval(this._currentTimeInterval);
        this.startCurrentTimenterval();
        this.recomputeStatusBar();
    }

    private workspaceChenged() {
        this.endCurrentTimeInterval();
        this._storage.addTimeInterval(this._currentTimeInterval);
        this.startCurrentTimenterval();
        this.recomputeStatusBar();
    }

    private configurationChanged() {

        const isTrackGitBranchChange = this._config.trackGitBranch != workspace.getConfiguration('time-tracker').trackGitBranch;
        this._config = workspace.getConfiguration('time-tracker');

        this.initReminders();
        this.recomputeStatusBar();
        this.setStatusBarCommand();

        if (isTrackGitBranchChange)
        {
            this.gitBranchChenged();
        }
    }

    private createStatusBars() {
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        this.setStatusBarCommand();
        this._statusBarItem.show();
    }

    private setStatusBarCommand() {
        this._statusBarItem.command = this._config.onStatusbarBarClick == "show log" ? 'extension.showLog' : 'extension.toggleStop';
    }

    private recomputeStatusBar(): void {
        const now = Date.now();

        const iconText = this._isStopped ? "$(primitive-square) " : "$(triangle-right) ";

        const totalDurationMilliseconds = this._storage.totalDurationMiliseconds + (now - this._currentTimeInterval.start);
        const totalDurationText = timeFormat.formatTimeFromMiliseconds(totalDurationMilliseconds);

        const totalWorkspaceMilliseconds = this._storage.getTotalWorkspaceMiliseconds(vscode.workspace.name) + (now - this._currentTimeInterval.start);
        const totalWorkspaceText = timeFormat.formatTimeFromMiliseconds(totalWorkspaceMilliseconds);

        const todayDurationMilliseconds = this._storage.getTodayDurationMiliseconds(this._currentTimeInterval);
        const todayDuration = timeFormat.formatTimeFromMiliseconds(todayDurationMilliseconds);

        const intervalsFromStart = this._startAppIntervals.map(x => (x.end || Date.now()) - x.start);
        intervalsFromStart.reduce((accumulator, currentValue) => accumulator + currentValue)
        const fromStartDurationMilliseconds = intervalsFromStart.reduce((accumulator, currentValue) => accumulator + currentValue);
        const fromStartDurationText = timeFormat.formatTimeFromMiliseconds(fromStartDurationMilliseconds);

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
                nextReminderText = "" + nextReminder.title + " in " + timeFormat.formatTime(secondsToPause < 0 ? 0 : secondsToPause, format);
            }
        }

        const texts = [];

        if (totalDurationText.length > 0 && this._config.showTotalTime) texts.push(totalDurationText);
        if (totalWorkspaceText.length > 0 && this._config.showTotalWorkspaceTime) texts.push(totalWorkspaceText);
        if (todayDuration.length > 0 && this._config.showTodayTime) texts.push(todayDuration);
        if (fromStartDurationText.length > 0 && this._config.showFromStartTime) texts.push(fromStartDurationText);
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

        }, reminder.pauseMinutes * this.MILISECONDS_IN_MINUTE);

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

        const saveInterval = this.getSaveInterval();

        if (saveInterval && Date.now() - this._currentTimeInterval.start > saveInterval) {
            this.saveData();
        }

        this.recomputeStatusBar();
    }

    private getSaveInterval() {
        if (this._config.saveingOption == "on vscode exit and every 5 minutes") return 5 * this.MILISECONDS_IN_MINUTE;
        if (this._config.saveingOption == "on vscode exit and every 10 minutes") return 10 * this.MILISECONDS_IN_MINUTE;
        if (this._config.saveingOption == "on vscode exit and every 15 minutes") return 15 * this.MILISECONDS_IN_MINUTE;
        if (this._config.saveingOption == "on vscode exit and every 30 minutes") return 30 * this.MILISECONDS_IN_MINUTE;

        return null;
    }

    private createInterval() {
        this._invervalId = setInterval(() => {
            this.timeElapsed();
        }, this.MILISECONDS_IN_MINUTE);

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

    private exportLog() {
        new LogWebView(this._context, this._storage, !this._currentTimeInterval.end ? this._currentTimeInterval : null).exportLog();
    }

    private showLogWebView() {
        new LogWebView(this._context, this._storage, !this._currentTimeInterval.end ? this._currentTimeInterval : null).show();
    }

    private saveData() {
        const now = Date.now();
        this.endCurrentTimeInterval(now);
        this._storage.saveAll();
        this._storage.initTimeIntervals();
        this.startCurrentTimenterval(now);

        this.recomputeStatusBar();
    }

    dispose() {
        clearInterval(this._invervalId);
        this.endCurrentTimeInterval();
        this._storage.saveAll();
        this._statusBarItem.dispose();
    }
}
