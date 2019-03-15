# Time Tracker & Reminder

Track your time using vscode editor, see log, and remind you pauses for blinking, standing up, or whatever


## Features

#### Time count
  - Counts total time spent
  - Counts total time spent in the workspace
  - Counts today time spent
  - Counts time spent from vscode start
  - Counts time spent from vscode start

  #### Reminders
  - periodic custom reminder 
  - countdown for next reminder
  - manually/auto start/end reminder


## Commands

**(Time Tracker & Reminder) Clear all time data** - Clears all time data

**(Time Tracker & Reminder) Toggle stop** - Stops/Starts counting time

**(Time Tracker & Reminder) Show data file path** - Shows file path where data are saved

**(Time Tracker & Reminder) Show log** - Shows time spend log for each day


## Extension Settings

### Status bar

```
"time-tracker.showTotalTime": false
"time-tracker.showTotalWorkspaceTime": false,
"time-tracker.showTodayTime": true,
"time-tracker.showFromStartTime": true,
"time-tracker.showNextReminder": true,
```

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
Then it can calculate how much time you have spent running vscode. It saves into file only on vscode exit, until then it keeps intervals into variables so it access hdd only when really needed.

There is a timer running every minute to update status bar. When the time until next reminder is less then 1.5 minutes it starts timer every seconds so you can see how many seconds until reminder in status bar. When the time is up it runs timer every minute again.

When running multiple instances of vscode it finds intersected time intervals and consolidates them (joins them to one, with min start and max end). It means it counts should be counting spent time correctly even when running multiple instances of vscode.



![](https://github.com/JanBN/vscode-time-tracker-and-reminder/blob/master/assets/demo.gif)

<div>Icons made by <a href="https://www.flaticon.com/authors/ocha" title="OCHA">OCHA</a> from <a href="https://www.flaticon.com/" 			    title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/" 			    title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>