# Demo Sync Desktop: UI Strings for Review

These strings are shown in the Demo Sync desktop app. Each string has an ID that must not be changed, because the ID is used by the translation files.

## Buttons and menu items

| ID | String |
|---|---|
| `btn.sync_now` | Sync Now |
| `btn.pause` | Pause Syncing |
| `btn.delete_job` | Remove Job |
| `menu.settings` | Settings... |
| `menu.check_updates` | Check For Updates |

## Dialogs

**`dlg.delete_job.title`**: Are you sure?

**`dlg.delete_job.body`**: Oops! You're about to delete this job. This will permanently remove the job and its history from this computer, but the files in your folder and in the bucket won't be deleted. Click OK to continue or Cancel to go back.

**`dlg.conflict.body`**: The file {filename} has been changed both on this computer and in the bucket since the last sync. Please choose which version you'd like to keep. If you do nothing, both versions will be kept and the bucket version will be renamed to {filename}.remote.

**`dlg.quota.body`**: Your bucket is almost full ({used} of {quota} used). Syncing will stop when the quota is reached. You should free up space or ask your administrator to increase the quota.

## Notifications

**`notify.sync_done`**: Sync complete! {count} files were uploaded and {deleted} files were deleted.

**`notify.sync_failed`**: Sync failed. Something went wrong while uploading {filename}. We'll retry automatically in {minutes} minutes.

**`notify.key_expiring`**: Heads up - your access key expires in {days} days. After it expires, syncing will stop until a new key is entered.

## Error messages

**`err.offline`**: You appear to be offline. Changes will be synced when the connection is restored.

**`err.path_too_long`**: The path is too long. Windows does not support paths longer than 260 characters unless long paths are turned on. Move the folder closer to the drive root or turn on long paths in the system settings.

**`err.disk_full`**: Not enough disk space. Demo Sync needs at least {required} MB free in the cache folder to continue.

**`err.invalid_schedule`**: Invalid schedule. Schedules must be at least 5 minutes apart, e.g. "every 15m".

## Tooltips

**`tip.dry_run`**: Shows what would change, without uploading or deleting anything.

**`tip.bandwidth`**: Limits how much bandwidth Demo Sync uses. Set to 0 for no limit.

## More strings

**`tip.open_folder`**: Navigate to the synced folder.

**`dlg.pause.body`**: Syncing pauses after the current file. Waiting files stay in the queue. The queue keeps its order. The Resume button starts the job again. Nothing is lost. Paused jobs use no bandwidth. The app shows a badge on paused jobs.
