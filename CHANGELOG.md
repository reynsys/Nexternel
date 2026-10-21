# Changelog

Versions are numbered **V{generation}.{hardware}.{release}**. Newest first.

## V5.2.130

- **All dashboards now show at most 5 panels across** — no need to create a new dashboard. To switch a dashboard to 4 across, use **Panels across** in the Dashboard Options bar.
- **Room menu:** choose Dock, Top tabs or Right rail. The Rooms panel is added like any other panel (Add Panel → Rooms).
- No empty gap above the dashboard with the Dock or Right rail.
- Half-height panels (switches, readings) now show all their content, also in edit mode.

## V5.2.129

- **Rooms panel:** a new panel type (Add Panel → Rooms) that lists every room — put it anywhere, move and resize it like any panel.
- **Smoother dock:** rooms grow gently under the pointer and stay inside the dock; no empty strip above the dashboard; the Dashboard Options button matches the other buttons.

## V5.2.128

- **Panels across:** in **Dashboard Options → Tab settings**, choose 6, 5 or 4 panels across for each dashboard — fewer means bigger panels (new dashboards start at 5).
- **Half-height small panels:** switches, single readings and status lists can now be made half the height of a standard panel.
- A little more space between panels.

## V5.2.127

- **New room menu:** choose in **Settings → Appearance → Room menu** where your rooms are — a **Dock** at the bottom (new default; the room under the pointer grows, like on a Mac), **Top tabs** as before, a **Right rail** that folds away, or a **Rooms panel** beside the dashboard. Phones use the dock.

## V5.2.126

- **Fixed:** status lights without limits keep the Look's shape; the glowing border of small boxes inside a panel no longer shows a square behind it.

## V5.2.125

- **Status lights:** smaller in narrow panels so titles have more room; add-on Looks can give them their own shapes, and the glowing border follows the panel's own outline.
- **Glass:** dialogs and menus are frosted glass like the panels.
- Gauges keep a little more space from the panel edge.

## V5.2.124

- **Autoscroll on wall displays:** panels with more content than fits slowly scroll down, pause and return to the top — switch it in **Users → Edit → Wall display → Autoscroll**.
- **Fixed:** a chart or gauge could show an error after its style was changed until the page was refreshed; charts now start fresh with a new style, and a panel that fails is drawn again when its settings change.

## V5.2.123

- **Easier panel resizing:** the resize corner is now a clear round handle with an arrow; while you drag it near the bottom of the screen the page scrolls by itself so panels low on the page can be made taller; the size preview is striped in your accent colour so it stands out on any background.

## V5.2.122

- **Fixed:** panels can be resized again in Dashboard Options.
- **Fixed:** a section bar you hide now stays hidden after saving (also on other screens). The option is now called **Section bar — Show / Hide**.

## V5.2.121

- **Nothing cut off in small panels:** when a panel has more text than fits (small screens, large text), it now scrolls, and its bottom edge fades to show there is more — instead of cutting lines off at the top or bottom. Calendar rows no longer overlap.

## V5.2.120

- **Sections without a title bar:** in **Dashboard Options**, switch off **Show section title** for a section to show just its frame around the panels — more room for the panels. Width, order and everything else stay as they are.

## V5.2.119

- **Readable gauges and charts on every screen:** the small numbers round a gauge and on charts never get too small to read, and they follow Settings → Appearance → Text size. When there is not room for all of them, a gauge shows every second number instead of shrinking them.
- **Smaller screens keep your arrangement:** screens down to about 1024 pixels wide now show the dashboard as you arranged it instead of rearranging panels into fewer columns.

## V5.2.118

- **Wall display settings:** in **Users → Edit → Wall display** choose, for the account a wall screen uses, which dashboard it starts on, whether it moves through the dashboards, the text size, the room buttons and light effects. The wall screen applies changes within seconds — nobody needs to touch it.

## V5.2.117

- After signing in you return to the page you were opening (for example a wall display's Display mode address) instead of the home dashboard.

## V5.2.116

- **Display mode for wall screens and tablets:** open **<your Nexternel address>/display** to show the dashboard alone, full screen, with larger text and lighter effects for small computers such as a Raspberry Pi. Optional: `?rotate=60` moves through the dashboards every minute, `?tabs=0` hides the room buttons. Details in **Settings → System → Addresses**.

## V5.2.115

- **Changes show everywhere at once:** when you change a dashboard, your appearance, a device or anything else, every other open screen (another computer, a phone, a wall display) shows it within a second or two — no refreshing. After a Nexternel update, open screens switch to the new version by themselves.

## V5.2.114

- **Bigger buttons with more space between them:** buttons, tabs and menu entries are a little larger and no longer sit cramped together — easier to use by touch and on wall screens. Looks with decorated buttons automatically get the extra room they need.

## V5.2.113

- **Everything you can click looks like a button:** the side menu entries and all tab bars (for example Devices / Cameras) are now drawn as buttons, the chosen one filled.

## V5.2.112

- **Button styles:** add-on Looks that come with several button styles let you choose one in **Settings → Appearance → Buttons**.

## V5.2.111

- **Clock:** it now always uses the dashboard's font (Settings → Appearance), like every other panel; its own font setting is gone.

## V5.2.110

- **Text size:** choose Smaller, Normal, Larger or Largest in **Settings → Appearance → Text size**. It applies to all text, for your account.
- **Clock:** its Font choices are clearer. Pick "Same as the dashboard" to follow the font chosen in Appearance.

## V5.2.109

- **Fonts:** a Look's font now applies to all text — menus, labels, buttons, small text and charts — not only headings.
- **Font choice:** add-on Looks that come with several fonts let you choose one in **Settings → Appearance → Font**.

## V5.2.108

- **Every button now looks like a button:** buttons that used to look like plain text (for example "Edit", "Remove", "Check for update") now have a visible outline, in every Look.
- **Settings → Add-ons:** the result of **Check for add-on updates** now appears right under the button.

## V5.2.107

- **Settings → Add-ons:** the button is now called **Check for add-on updates** and tells you what it found — for example "Updated: HUD Looks to 1.5.2" or "All add-ons are up to date".

## V5.2.106

- **Animations on/off:** in **Settings → Appearance** you can switch off the moving decorations of add-on Looks, and each panel can choose its own in **Edit → Look**.
- Groundwork for add-on Looks: they can now decorate the menu edge, the menu dividers, the line under the room tabs and the dashboard sections, always keeping clear of neighbouring parts. Nothing changes in Standard.

## V5.2.105

- **Add-ons are ready:** with a licence key from Nexternel you can now install extra Looks in **Settings → Add-ons**.

## V5.2.104

- Groundwork for add-on Looks: the last hand-made boxes in Settings, Devices and the Edit menus now follow the chosen Look too. Nothing changes in Standard.

## V5.2.103

- **Tidier menu footer:** your name, role and version each on their own line, with a proper **Sign out** button and the menu-collapse button beside it. The letter in your picture circle is easier to read.
- Groundwork for add-on Looks: a Look now restyles every part of Nexternel (menu, top bar, buttons, cards, pop-ups, fields), not only the panels. Standard looks the same as before.

## V5.2.102

- Groundwork for add-on Looks: a Look can now bring its own background, fonts and panel frames. Nothing changes on your dashboards.

## V5.2.101

- **Add-ons (coming soon):** a new **Settings → Add-ons** page where you will enter a licence key from the Nexternel shop to install extra Looks and features. The shop is not open yet.

## V5.2.100

- **Switch styles per panel, like gauges:** open a panel's **Edit menu → Look → Switch style** and tap the picture you want. In a panel with several switches, each switch can have its own style: open its options in the **Content** tab. The style choice in Settings → Appearance is gone.
- **Status lights per panel:** style, place, blink and now the **colours** are all in each panel's **Edit menu → Status light**. They are no longer in Settings → Appearance; panels keep the look they had.
- **Appearance:** smaller Light / Dark buttons with sun and moon icons, brighter soft-glow backgrounds, and six new light ones: Pearl, Sky, Mint, Peach, Lilac and Lemon. Picking a light one switches to Light mode so text stays easy to read.

## V5.2.99

- **Switch styles.** Switches on your dashboards can now look 12 different ways: the classic toggle, a power button, a wall rocker, an ON / OFF pair, a tile that lights up, a lever, day & night, a cyber 0 / 1 block, a neon ring, turning gears, a 3D switch with a light, and a 3D big knob. Choose your starting style in **Settings → Appearance → Switch style**, and give any panel its own in its **Edit menu → Look**. The classic toggle stays the default.
- **Looks.** **Settings → Appearance** now starts with a **Look** choice for the whole dashboard: **Standard** (clean, solid panels, as before) or **Glass** (frosted see-through panels over a colourful background). This replaces the old "Panels: frosted glass or solid" setting, and your dashboard keeps the look it had. Switches follow the Look you choose. More Looks will follow.

## V5.2.97

- **Tidier Edit menus with a live preview.** Every panel's Edit menu now shows a preview of the panel at the top, which changes as you edit, with three tabs underneath: **Content** (what it shows), **Look** (title, icon, layout and style) and **Status light**. A tab only appears when the panel needs it.
- Choosing an icon and changing a reading's limits now happen inside the menu instead of in separate windows.
- Panels from plugins can now be given their own title and icon too.

## V5.2.96

- The notification bell's second position is now **next to the dashboard options** (the cog above your dashboards) instead of taking a column of its own at the right of the page. On other pages it stays at the top of the side menu.

## V5.2.95

- **Calmer notification bell:** its number is coloured by the most important new message: your accent colour for information (such as a summary or an available update), amber for "keep an eye on it", and red only when something needs doing now.
- **Your bell, your way:** in **Settings → Appearance → Notification bell**, choose whether it shows always, only when there are new messages, or never, and whether it sits at the top of the side menu or the top right of the page.
- **Plugins:** for each plugin, choose which of its messages reach the bell (**Settings → Plugins → Permissions**): only important ones (the starting choice), all, or none. The AI assistant's morning summary now stays on its own panel unless you choose "all". Plugin messages are never red.

## V5.2.94

- **Every panel that shows a number now has a status light.** Readings without limits yet, such as power or gas, show an empty outline; hover over it and it tells you to open **Edit → Status light** to set limits. Readings that haven't reported since Nexternel started show grey. (Before, these panels showed nothing although the Edit menu said the light was on.)

## V5.2.93

- **Status lights when adding a panel:** the **Add Panel** window now has a **Status light** section, so you choose how the light looks while creating the panel. Readings without limits yet (such as power or gas) show a **Set limits** button right there, so any reading can get a light.

## V5.2.92

- Panels such as **Weather**, **System information** and **Devices** now recover by themselves within seconds if the connection to the server drops for a moment (for example while Nexternel updates), instead of showing an error until their next refresh. The message they show meanwhile is in plain words and no longer cut off.

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
