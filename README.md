# Time Tracker & Reminder

Track your time using vscode editor, see log, and remind you pauses for blinking, standing up, or whatever.

![](https://github.com/JanBN/vscode-time-tracker-and-reminder/blob/master/assets/demo.gif)


## Features

#### Time count
  - Counts total time spent
  - Counts total time spent in the workspace
  - Counts total time spent from vscode start
  - Detailed log (by days, weeks, months, years)

  #### Reminders
  - Periodic custom reminder 
  - Countdown for next reminder
  - Manually/auto start/end reminder


## Commands

**(Time Tracker & Reminder) Clear all time data** - Clears all time data

**(Time Tracker & Reminder) Toggle stop** - Stops/Starts counting time

**(Time Tracker & Reminder) Open & show data file** - Opens and shows file where data are saved

**(Time Tracker & Reminder) Show log** - Shows time spent log

**(Time Tracker & Reminder) Export log** - Export log into html file


## Extension Settings

### Status bar

```
"time-tracker.showTotalTime": false
"time-tracker.showTotalWorkspaceTime": false,
"time-tracker.showTodayTime": true,
"time-tracker.showFromStartTime": false,
"time-tracker.showNextReminder": true,

"time-tracker.onStatusbarBarClick": "show log" 
// possible values: "show log", "stop time tracking"

"time-tracker.saveingOption": "on vscode exit and every 5 minutes" 
// possible values:
// "on vscode exit",
// "on vscode exit and every 5 minutes",
// "on vscode exit and every 10 minutes",
// "on vscode exit and every 15 minutes",
// "on vscode exit and every 30 minutes"
```

The value **on vscode exit** of **time-tracker.saveingOption** won't save correctly in case of pc restart or shutdow. In vscode there is a bug that it doesn't call extension deactivate in these cases. Therefore there are other options to save data also on period intervals.


### Reminders
```
"time-tracker.reminders": "[{\"title\": \"Blink\",\"intervalMinutes\": 5,\"pauseMinutes\": 0,\"autoPause\": true,\"showCountDown\": true,\"autoStartAfterPause\": true},{\"title\": \"Look at distance\",\"intervalMinutes\": 18,\"pauseMinutes\": 0,\"autoPause\": true,\"showCountDown\": true,\"autoStartAfterPause\": true}]"
```
JSON string of reminders array. Prettified default value:

```
[
    {
        "title": "Blink",
        "intervalMinutes": 5,
        "pauseMinutes": 0,
        "autoPause": true,
        "showCountDown": true,
        "autoStartAfterPause": true
    },
    {
        "title": "Look at distance",
        "intervalMinutes": 18,
        "pauseMinutes": 0,
        "autoPause": true,
        "showCountDown": true,
        "autoStartAfterPause": true
    }
]"
```




## How it works

*Time Tracker & Reminder* saves time intervals to custom file. Time interval looks like this:
````
    {
        "start": 1552676228266,
        "workspace": "vscode-time-tracker-and-reminder",
        "end": 1552676579707
    }
````
Then it can calculate how much time you have spent running vscode. It saves data into file on specified intervals in **time-tracker.saveingOption**. Until then it keeps intervals in variables so it access hdd only when really needed.

There is a timer running every minute to update status bar. When the time until next reminder is less then 1.5 minutes it starts timer every seconds so you can see how many seconds until reminder in status bar. When the time is up it runs timer every minute again.

When running multiple instances of vscode it finds intersected time intervals and consolidates them (split by intervals, joins them, merge etc). This means that counts are correct even when running multiple instances of vscode.


<div>Icons made by <a href="https://www.freepik.com/" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" 			    title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" 			    title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>