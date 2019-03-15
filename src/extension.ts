'use strict';
import * as vscode from 'vscode';
import { TimeTracker } from './TimeTracker';

export function activate(context: vscode.ExtensionContext) {
  const timeTracker = new TimeTracker(context);
  context.subscriptions.push(timeTracker);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

