# Changelog

Versions are numbered **V{generation}.{hardware}.{release}**. Newest first.

## V5.2.84

- **Update script:** no longer stops silently when a code folder is missing or when there is nothing to remove; if it ever stops, it now says which step failed. Scripts in the download can be run directly as `./scripts/update.sh`.

## V5.2.83

- **Updating a server that was set up by copying files** (for example with FileZilla) now works cleanly: the first `./scripts/update.sh` removes leftover code files the new version no longer has, keeps a copy of the old code to put back if anything fails, and never touches settings, device files or backups.
- Every update also removes leftover files from Nexternel's code folders, and the settings copy made before updating skips ESPHome's build cache (rebuilt automatically, and often very large).

## V5.2.82 — first public release

Everything Nexternel does today:

- **Install with one command,** then a welcome screen: **Start fresh** (with a starter Home
  dashboard), or **Restore from backup** before any account exists.
- **Dashboards:**
  - readings, switches, charts, gauges, cameras, weather, clock, calendar, device and server panels
  - layouts that flow to fit laptops, phones and wall tablets
  - short dashboard addresses such as `/d/kitchen`
- **Names and icons, one rule for every panel:**
  - each panel has a title and icon (automatic, or your own)
  - each reading has its own name and icon, which device updates never undo
  - a panel can give an item its own name or icon on that panel only
  - 177 icons to choose from
- **Devices:**
  - ESP32 boards with ESPHome, built and flashed from the browser
  - Shelly switches over MQTT
  - Octopus Energy electricity and gas usage
  - cameras playing live in the browser
- **History:** Nexternel stores every reading for charts itself.
- **Appearance:**
  - light or dark, and an accent colour
  - ten soft-glow and 33 gradient backgrounds
  - ten background effects (snow, rain, stars, fireflies, bubbles, bokeh, network, aurora,
    waves, …), downloaded only when switched on, paused when the screen is hidden, and off on
    devices that ask for less motion
- **Backups:**
  - an encrypted automatic backup every day, with an emergency kit holding the key
  - restoring on a new server keeps the devices' MQTT login, so ESP32 and Shelly devices reconnect
    by themselves when the new server takes the old address
- **Updates:** `./scripts/update.sh` keeps your settings, removes old files, and puts the previous
  version back if the new one fails to start.
- **Security:** the database and history ports answer only the server itself, every service
  password is random, and every service runs a pinned, tested version.
