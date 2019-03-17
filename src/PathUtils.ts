'use strict';
import * as path from "path";
import * as vscode from 'vscode';

class PathUtils {
  getStorageFilePath(context: vscode.ExtensionContext, year: number) {
    const result = path.join((context as any).globalStoragePath, ".time-tracker-" + year + ".json");
    return result;
  }
}

export const pathUtils = new PathUtils();
