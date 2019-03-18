'use strict';
import * as path from "path";
import * as vscode from 'vscode';
import * as fs from "fs";

class PathUtils {
  getStorageFilePath(context: vscode.ExtensionContext, year: number) {
    const result = path.join((context as any).globalStoragePath, ".time-tracker-" + year + ".json");
    return result;
  }
  
  getFilePathForLogExport(context: vscode.ExtensionContext) {
    const result = path.join((context as any).globalStoragePath, "time-tracker-log.html");
    return result;
  }

  ensureStoragePath(path: string) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path)
    }
  }
}

export const pathUtils = new PathUtils();
