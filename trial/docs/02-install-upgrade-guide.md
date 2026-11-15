# Installing and Upgrading Demo Sync

This guide explains how to install Demo Sync 3.0 on a new machine and how to upgrade an existing 2.x installation. Upgrading from 1.x directly to 3.0 is not supported; you must upgrade to 2.9 first.

## Before You Begin

Make sure that the following requirements are met:

- 64-bit Windows 10 or later, macOS 13 or later, or a Linux distribution with glibc 2.31 or later
- At least 200 MB of free disk space for the program and 2 GB for the local cache
- Network access to the bucket on port 443

Admin rights are not needed unless you install the background service.

## Install on a New Machine

1. Download the installer for your platform.
2. Run the installer and accept the default folder, or choose a different one.
3. Open a terminal and type `demosync --version` to check that the install was successful. The output should be `demosync 3.0.0`.
4. Run `demosync init` and follow the prompts.

## Upgrade From 2.x

The upgrade process has been redesigned in 3.0. Your existing config is migrated automatically, but the manifest format has changed and it can't be read by older versions, so you won't be able to downgrade after the first sync with 3.0.

1. Back up the `.demosync` folder in every synced directory. This should be done before anything else.
2. Stop the background service with `demosync service stop`, and wait until the status shows `stopped`.
3. The new version must be installed over the old one. Do not uninstall 2.x first, because uninstalling deletes the stored access keys.
4. Run `demosync migrate` once for each synced folder. The migration is performed in place and may take several minutes for folders with more than 100,000 files.
5. Start the service again with `demosync service start` if you use scheduled syncs.
6. Run `demosync status` and check that every folder shows `ok`.

If the migration fails, your original manifest is kept as `manifest.v2.bak`. Restore it by renaming it to `manifest.json`, then reinstall 2.9 and contact support.

## Installing the Background Service

The background service runs scheduled syncs while you're logged out. It's optional.

On Windows, run `demosync service install` from an administrator terminal. On macOS and Linux, run `sudo demosync service install`. The service starts automatically at boot and runs as a dedicated `demosync` user that has read access to the synced folders only.

To set up a schedule, add a `schedule` key to the config, for example `schedule = "every 30m"`. Schedules shorter than 5 minutes are rejected.

## Uninstalling

Run the uninstaller from your system's app settings. The local cache in `~/.demosync/cache` is not removed automatically; delete it by hand if you want to free the space. Your files in the synced folders and in the bucket are never touched by the uninstaller.

## Repair an installation

1. Run `demosync repair` if the status shows `damaged`.
2. Restart the service when the repair finishes.
3. The repair log is opened in your default editor.
4. Delete the `.demosync/lock` file unless another sync is running.
5. The old manifest is renamed to `manifest.old`.
6. Execute `demosync status` to check the result.
