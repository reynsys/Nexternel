# Changelog

Versions are numbered **V{generation}.{hardware}.{release}**. Newest first.

## V5.2.91

- **Status lights:** readings now show a small coloured light: green when normal, amber to keep an eye on it, red when something needs doing, grey when there is no recent reading. Hover over it to see why. It only changes colour after a reading has stayed past a limit for a minute, so it does not flicker.
  - Sensible starting limits for temperature, humidity, CO₂ and fine dust; change them for any reading from the panel's **Edit** menu (**Status light → Change limits**) or from **Devices**. They apply wherever that reading is shown.
  - If a reading stays red for 10 minutes the bell lets you know (the minutes can be changed or switched off), and again when it is back to normal.
  - Choose the look (rounded rectangle, bar, dots or glowing border), where it sits, blinking and the colours in **Settings → Appearance**; each panel can have its own.
- Panels with several readings show each reading as its own small panel, each with its own light.

## V5.2.90

- **Simple addresses at home:** open Nexternel at **http://nexternel.local** (or the server's number address) on any device at home. No certificate warnings and nothing to install. A secure address that every device trusts automatically is on the way.
- The Updates section shows when the last update was installed, without a separate OK button.

## V5.2.89

- **Maintenance mode:** while Nexternel is updating or restoring a backup, a banner says so and settings, dashboards, devices and plugins can't be changed until it finishes. Lights and switches keep working. When an update finishes, the banner offers to reload the page.
- **Updates:** Nexternel looks for a new version every night at 01:15. The buttons are now simply **Download** and **Update**, and the update screen shows the step it is on.

## V5.2.88

- **Secure connection (https):** Nexternel is now reached at `https://<your server>`, encrypted with its own **home certificate**. The old address with `:8080` forwards there automatically.
  - Each phone, tablet or computer trusts the home certificate once: **Settings → System → Secure connection → Download home certificate**, with short steps for iPhone, Android, Windows, Mac and Linux. Until then the browser shows a warning you can continue past.
  - Optional: use **your own domain** by adding its certificate there.
  - Needed later for voice commands from the browser.

## V5.2.87

- **Update Nexternel from the screen:** **Settings → System → Updates** shows when a new version is available (Nexternel checks once a day and tells you in the bell), what is new, and **Check for update**, **Download** and **Update** buttons. Your settings are kept, a copy is saved first, and if anything goes wrong the previous version is put back by itself. No terminal needed.
- **Plugin panels:** plugins can add their own dashboard panels, drawn by Nexternel so they look like every other panel.
- **New official plugin: AI assistant** — ask questions about your home in plain words, get a morning summary, and hear about unusual readings, using an AI server on your own network (Ollama), so your data stays at home. Install it from Settings → Plugins.

## V5.2.86

- **Plugins:** add-ons that bring new abilities into Nexternel. Find them in **Settings → Plugins**.
  - Each plugin runs separately and can only do what you approve when installing it: add its own devices, see your readings, switch devices you choose, or post notifications. You can change this at any time.
  - Official plugins install with one click and are checked before installing; a plugin file from elsewhere can be installed after a clear warning.
  - Each plugin has its own settings page (passwords and keys are stored encrypted), an on/off switch, updates, and an activity list.
  - Plugin devices work on every panel and keep history, and backups include your plugins and their settings.
  - A **Practice plugin** lets you check that plugins work.
- **Notifications:** a bell next to the Nexternel name (top bar on phones) shows messages from plugins.

## V5.2.85

- **One labelling rule for every panel:** a panel with one item names it in its title only; a panel with several items labels each item's tile the same way, with its icon and name at the top. Switches now show **On / Off** like a reading instead of drawing their own power symbol, and camera names sit at the top of their tile instead of floating over the video.
- An item's area is no longer repeated under its name when both are the same word.

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
