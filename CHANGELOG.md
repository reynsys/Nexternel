# Changelog

Versions are numbered **V{generation}.{major update}.{fix}**: the middle number goes up with each major update that brings new features, the last with each fix, starting again at 0. Newest first.

## V5.3.13

- Phones: the menu (button at the top right) is now solid, so the dashboard no longer shows through it, and has a close button at its top right. A swipe to the right also closes it, as does a tap beside it.
- This phone (in the menu, inside Nexternel for Android): shows which home the phone opens ("Home: …") with a small Change button on that line. Change home no longer sits beside Sign out; it still asks first.
- Inside Nexternel for Android the page no longer zooms with two fingers, so the dock always stays on screen. For bigger text use Settings → Appearance → Text size, or the phone's own text size.
- The glow round a lit status light is no longer cut off under the panel name.

## V5.3.12

- Panel names get the whole first line of the title: a status light now sits at the end of the line under the name (the area), slightly smaller on phones and in narrow panels so it is never cut off, so names like "Kids Room Temperature" are no longer cut to a few letters. While editing a dashboard, the move grip and the pencil have a line of their own above the name.
- Gauges on phones: a gauge that used to fill the whole screen width is now half as wide, so two sit side by side. On needle gauges the number always sits below the furthest point the needle reaches, so the needle never runs through it.
- Charts with no readings say so in the middle of the chart, for the chart's own period ("No readings in the last 24 hours"), instead of a small "No data" in the corner.
- The calendar always fits its panel: the weeks share the panel's height and the text gets smaller if needed, so the month no longer slides up and down inside its panel.
- Switches with a pressed-in track (such as the light switch with its little lights) have a faint edge round the track, so the switch shows its full shape even when the track has the same colour as the panel.

## V5.3.11

- Phones: one row at the bottom of the screen, your dashboards (the dock, or the row at the top if you chose it). The menu with every page, This phone and Sign out is now behind the menu button at the top right, beside the bell.
- Tapping the Nexternel logo or name at the top takes you to the start dashboard.
- Change home (Nexternel for Android) now sits apart from the update button, beside Sign out, and asks first.

## V5.3.10

- Phones have their own Dashboard menu choice (Settings → Appearance → Dashboards, kept on the phone): the Dock at the bottom, as before V5.3.8 (and the starting choice), or a Row at the top that now stays under the Nexternel bar while you scroll, so you can change dashboard from anywhere on the page.

## V5.3.9

- Phones keep their own Appearance: what you change in Settings → Appearance on a phone stays on that phone, and your computer and tablet keep theirs. The page says so on a phone, with a button to use the same as your other screens again. The Dashboard menu choice (Dock, Top tabs, Right rail) is not shown on a phone, which always uses its row at the top.
- More → This phone (inside Nexternel for Android): the version, Check for update and, with Nexternel for Android 1.0.2, Change home.

## V5.3.8

- Phones: the row of dashboards now sits at the top of the dashboard, so the bottom of the screen has only one row (Dashboards, Areas, Devices, Extensions, More). Slide the row to see all dashboards, or swipe sideways on the dashboard to move to the next one. The Dock, Top tabs or Right rail choice in Appearance is for bigger screens; phones always use this row.
- Only one dashboard can be the start dashboard. Restoring a backup onto a Nexternel that already had dashboards could leave two marked, and then one of them could not be opened from the dashboard row; Nexternel now repairs this by itself.

## V5.3.7

- Nexternel for Android: More (on a phone) or the menu (on a tablet) now shows which version of Nexternel for Android you have, with a Check for update button. When a newer version is ready, the button says Update to … and one tap updates it. Shown only inside Nexternel for Android 1.0.1 or newer; get it from www.nexternel.com.

## V5.3.6

- Nexternel can now be installed on your phone or computer from your Nexternel Anywhere address: the browser offers Install (or Add to Home screen). The Nexternel logo goes on your home screen, and one tap opens Nexternel full screen, without the address bar. Already added a shortcut before? Remove it and install again to get the full screen.
- When Nexternel cannot be reached (for example, no internet on the phone), you now see a page with the Nexternel logo and a Try again button instead of the browser's error page.

## V5.3.5

- Nexternel Anywhere: your home now remembers its GPS port number (also in backups). If Nexternel Anywhere ever has to set your home up again, it asks for the same number back, so your GPS trackers keep working without a new text message.

## V5.3.4

- Nexternel Anywhere → GPS trackers: most makes of tracker now work through Nexternel Anywhere, not only SinoTrack: Concox, Teltonika, Coban, TK103, GPS watches and tracker apps on a phone. They all use your same port number; Nexternel tells them apart by itself.
- Nexternel Anywhere → GPS trackers: the card now gives the server as a name (door.nexternel.net), so trackers keep working if the server ever moves. The number is still shown for trackers that do not accept a name.

## V5.3.3

- Nexternel Anywhere → GPS trackers: the card now shows where your tracker should send its positions (server and your own port number), with the exact text message for a SinoTrack tracker and a Copy button.
- Nexternel Anywhere: names with swear words, slurs or hate words are no longer accepted.
- Nexternel Anywhere: the phone hint now says how to add the Nexternel shortcut to your home screen, on iPhone and on Android.

## V5.3.2

- Already signed in? Opening the sign-in page (from a shortcut, a bookmark or a link) now takes you straight to your dashboard instead of asking for your password again.

## V5.3.1

- Users → Edit user is tidy again: a wider window with four tabs (Account, Appearance, Wall display, Notification bell) and one Save. The appearance settings get their full width with the preview beside them, instead of squeezed into a narrow window. On phones it fills the screen.
- Buttons all look alike: choice buttons (like Plain / From my colours / Soft glow / Gradient) and red buttons (Delete, Unlock…) are now drawn by your Look like every other button, also in Glass, 3D and HUD.
- Appearance → Colours: Background now comes right after Mode, above Main colour.
- Appearance: the background effect hint names the Look tab (it said Style).
- Notifications: the "Report a device after" choice no longer presses against the line above it.
- Sign-in record (for finding faults): Nexternel keeps a short list of recent sign-ins and of sign-ins it turned away, with the reason, so we can see why a phone is asked to sign in again. In memory only, never any password, readable by an administrator.

## V5.3.0

**Nexternel Anywhere**: open Nexternel away from home, on mobile data or any Wi-Fi, with the padlock, and with nothing to change on your router. It is a paid service (with its own licence, in Settings → Extensions); without it Nexternel works at home exactly as before.

- Settings → System has a new card, Nexternel Anywhere: choose your name (it says straight away whether it is free, and offers free ones when it is not), and your address becomes https://yourname.nexternel.net. One switch turns it on and off; a light says how it is (green: open from anywhere), and a QR code opens the address on your phone. On the phone, Add to Home screen makes Nexternel open like an app.
- The padlock ends at your home: Nexternel Anywhere passes the sealed connection on and cannot read it. Your home gets its own padlock certificate (Let's Encrypt), renewed by itself.
- Switches, readings and everything at home never depend on Nexternel Anywhere; if the internet is down, home works as always.
- Everyone coming in from outside counts as outside: the second check, the outside lock and the stronger password rules always apply, and the sign-in is only ever sent over the padlock.
- GPS trackers can reach your home through Nexternel Anywhere too, so no router changes are needed for them (each home gets its own tracker port).
- Changing your name: the old address stops at once; GPS trackers keep working without any change.
- Backups now include your Nexternel Anywhere name and key. After a restore it is switched off; one click turns it on again (so two servers never share one address).
- If Nexternel Anywhere ever loses track of your home, Nexternel sets it up again by itself within a few minutes.
- Help & troubleshooting → Restart now also restarts the Nexternel Anywhere link.

## V5.2.198

- Second check (two-step sign-in), optional, in My profile: when you sign in from outside the home, Nexternel also asks for the 6-digit code from Google or Microsoft Authenticator on your phone. Someone who guesses your password still cannot get in. At home nothing changes.
- Setting it up on a phone: an "Add to my Authenticator app" button opens the app with Nexternel filled in, and the key can be typed in by hand (with the exact steps for Google and Microsoft, and a Copy button). On a computer, a QR code to scan.
- "Trust this phone" when signing in: that phone skips the code until it is removed in My profile, goes 90 days unused, or you use Sign out everywhere else or set a new password. Wrong codes count like wrong passwords (5 from outside lock the account from outside). Each code works once.
- Lost phone: the home's administrator can turn someone's second check off in Users (Edit). A code by email as a back-up comes with Nexternel Anywhere.
- Every account can now open My profile (Settings → Users), to change their own name, email, password and second check. Before, only administrators could reach it. Other accounts see only their own profile there.
- Safety updates of parts Nexternel is built on (the web server and two smaller parts).

## V5.2.197

- Locked from outside: after 5 wrong passwords for an account from outside the home, nobody can sign in with it from outside until it is unlocked. Waiting does not undo it; only a right sign-in from outside starts the count again. While it is locked, even the right password is refused from outside, so it cannot be tested. At home it still works, so wall screens keep working.
- The bell warns after 3 wrong passwords from outside ("Someone outside is trying to sign in as …") and again when the account is locked.
- Users: a locked account shows "Locked from outside" and an Unlock button for the home's administrator. Accounts can have an email address (optional), for the warnings and an unlock link once Nexternel can send emails.
- Stronger passwords: new passwords need at least 12 characters, and the most common passwords are refused (also with numbers or signs added, like "Password1234!"). Existing passwords keep working at home; signing in from outside needs a password that meets the new rules.
- My profile: everyone can now change their own password and add their email address there.
- Cameras: the video now opens only for someone signed in to Nexternel who opened that camera. Before, anyone on the home Wi‑Fi could open the camera service directly, without a password, and see the list of cameras with their own passwords; that service could also be told to run commands. Now only the video itself passes, nothing else.
- The server's internal service ports (4000 for Nexternel's API, 1984 for cameras) are closed to the home network; only the server itself uses them. Screens reach everything through the normal address, so the sign-in rules apply to every request. Camera and doorbell apps (for example the maker's own phone app) are not affected: they talk to the cameras or recorder, not to the Nexternel server.
- A role change in Users applies at once (before, a signed-in screen kept its old role for up to 15 minutes). "Sign out everywhere else" and a new password also end the passes for ESPHome and camera video.
- Version numbers: the middle number now counts major updates that bring new features (it used to stand for hardware). The next one, Nexternel Anywhere, will be V5.3.0.

## V5.2.196

- Signing in is safer, ready for Nexternel Anywhere. After 5 wrong passwords from the same place, each new try has to wait (30 seconds, then longer each time, up to 15 minutes). Before, every screen counted as the same visitor, so one person guessing could block everyone.
- From outside the home only: after 10 wrong passwords for one name within an hour, signing in with that name from outside pauses for 15 minutes and the bell says so. At home it always still works, so nobody outside can lock you out.
- My profile has a new button, Sign out everywhere else: every other screen signed in as you has to sign in again, this one stays signed in. A new password does the same, and so does switching an account off in Users.

## V5.2.195

- Maps: the route a tracker took is drawn in its own bright magenta with an outline, instead of the Look's main colour, so it no longer disappears among orange or blue roads, on light and dark maps.

## V5.2.194

- Phones and tablets: one menu. More in the bottom bar now shows who is signed in and has Sign out; the ☰ button at the top is gone while signed in (it stays when nobody is signed in, for Sign in).

## V5.2.193

- Tablets held upright and screens just too narrow for the whole dashboard: panels keep about the size they have on a laptop, instead of each one filling the width. A screen a little narrower loses two squares across, not half of them. Phones are unchanged.
- Boards: a board given other software (for example installed with a USB cable) no longer keeps showing as up to date because of its last message from before. A board counts as up to date only while it keeps saying which software it runs (every minute), so Update boards no longer skips it.

## V5.2.192

- Phones: the dock is back, in one row you slide left and right with a finger; the open dashboard sits in the middle and Dashboard Options stays at the end.
- Phones: Extensions in the bottom bar opens a list of its pages instead of jumping to the first one. In More and the ☰ menu, Settings and Extensions open their list of pages.
- Status lights: power readings start with limits (keep an eye on it above 1 kW, act now above 3 kW; no bell until you choose). A reading without limits shows no light, and its empty "set limits" light appears only while editing the dashboard.
- History charts fit their readings, so a room going from 21 to 23 °C shows as a real rise. A range you set yourself is kept; bars still start at zero.

## V5.2.191

- Gauges: the numbers round the dial are tidy, evenly spaced steps close to the arc, in kW once watts reach a thousand (0, 1, 2 … 5). Small gauges show fewer numbers but never skip unevenly. History charts say 1kW, 2kW instead of 1000W.
- Calendar: the whole month always fits its panel, six-week months too, with no scrolling.
- Cameras: on a phone the cameras of a panel sit under each other at full width; on a tablet two side by side. The panel grows to hold them.
- Phones: no floating dock any more, so panels have the whole screen. Dashboards in the bottom bar opens all your dashboards, a sideways swipe moves to the next or previous one, and the Dashboard Options cog sits in the top bar.

## V5.2.190

- One word for one thing across Nexternel. Plugin, Add-on, Widget and Capability are gone from the screen: anything you add to Nexternel is an Extension.
- One Extensions button in the side menu: it holds each extension's page and Manage extensions, which replaces Settings → Extensions.
- Looks: Appearance and Manage extensions now say Look for Standard, Glass, 3D and HUD.
- Area is the word for parts of your home. The Rooms panel is now the Dashboard Menu panel.

## V5.2.189

- Heating panels turn orange while the heating is actually running, on full and one-line panels.
- The side menu no longer grows with each extension: extensions with their own page sit inside one Extensions button. GPS Tracker is there now.
- Nest Heating has no side menu button any more. Open it from Settings → Extensions.

## V5.2.188

- New gauges start smaller: a quarter of the width and two rows high. Gauges you already have stay as they are.
- Pressing + or - on a heating panel now lands on a neat half degree straight away.
- nexternel.com has a privacy page.

## V5.2.187

- New Nest Heating extension: control a Google Nest thermostat from a heating panel. A guided page takes you through Google's one-time setup, step by step. Google charges a one-off US$5.
- Heating panels show Eco. While Eco is on, the temperature is locked and the panel says Eco.
- Pressing + or - several times now sends only the final temperature, once you stop pressing.
- Devices that work through the internet have a small cloud mark on their panel.

## V5.2.186

- GPS Tracker: the Bell section is gone from the Settings tab. Bell choices stay in Settings → Notifications.

## V5.2.185

- GPS is now called GPS Tracker, in the side menu and on the Extensions page.
- GPS Tracker has a new Settings tab holding all its settings in one place: map colours, speed units, route, speed limit and quiet hours. Areas have their own tab. Update the extension to see these changes.
- An extension with its own page now keeps its settings there; Settings → Extensions has a button that opens them.
- Extensions: an open extension has a Close button, Remove is always visible, and Settings, Permissions and Activity are proper buttons.

## V5.2.184

- GPS map: the zoom you choose now stays while the map follows the tracker.

## V5.2.183

- GPS maps can be dark or light: choose under Settings → Extensions → GPS tracking → Map colours.
- The tracker's dot on the map is green while moving and red while parked.

## V5.2.182

- New GPS tracking plugin: see your car or other tracker live on a map, on your dashboard and on a new GPS page. Installing the plugin sets everything up, with no address or login to enter.
- GPS page: journeys for any day with a route and replay, reports for distance, driving time and top speed, areas that alert you when a tracker arrives or leaves, and alerts for speeding or moving during quiet hours.
- GPS history is kept for one month and older history is deleted automatically.
- Plugins can now offer map panels and pages of their own. Maps come from OpenStreetMap, so they need the internet.
- Fixed: a plugin panel could say "Plugin unavailable" until the page was reloaded.

## V5.2.181

- New control panels for heating, air conditioning, dimmable lights, colour lamps, blinds and fans. Every panel keeps all its content and shrinks or grows with the panel.
- At the smallest size a control shows what it is, its value, a quick control and its switch. The button in the corner opens the complete panel.
- Colour lamps have White, even when the lamp has no separate white lights.
- Devices that connect through plugins can now use these panels, and heating can offer settings such as Comfort, Eco and Away.
- The room dock always shows every room: rooms shrink evenly, then move to two rows, and nothing goes off the screen.

## V5.2.180

- Saving or checking a board's settings file from Devices no longer fails on a file that is fine.

## V5.2.179

- A switch that gets no answer when pressed on is now cancelled. If the board reports it came on anyway, Nexternel switches it off again and says so in the Activity log.
- Presses with no answer are written in the Activity log.
- A board taken off the shared settings can stay quiet without being marked offline.

## V5.2.178

- **Background effect tiles are true miniatures** of the real effect: the same look and crowding at a small size. In **Network (follows you)**, the tile reacts when the pointer is over it. The real backgrounds have not changed.
- **Background effect colour** now says **Main colour** and **Background colours**. "Accent" was another name for your main colour, not a separate setting.

## V5.2.177

- **Appearance is easier to find your way around.** All colours are now together on the new **Colours** tab: Light or Dark, main, second and third colours, background and background effect colour. **Style** holds how panels and buttons are drawn, and background effects. **Theme** holds the ready-made themes only and says that picking one replaces your colours. No option was removed.
- **Apply and Cancel stay in one place** at the top of Appearance. They are greyed out until you change something, and no longer pop up at the bottom of the page.

## V5.2.176

- **New: Wi‑Fi signal history** for every board (Devices → a board → Troubleshooting): the signal over the last 24 hours, 7 days or 14 days, how many of its reports arrived, and how often it lost the message service. A gap in the line means no report arrived.
- **Clearer connection messages:** a board that keeps losing touch and coming back no longer says two devices are probably using the same name. That message now appears only when the same name really comes from two different addresses.
- **"Its Wi‑Fi stayed connected" now says what it means:** the board stayed joined to the Wi‑Fi, but its messages were not getting through.
- **An old Wi‑Fi signal reading says so:** when a board's reports stop arriving, Devices shows when the signal was last heard.

## V5.2.175

- **Restoring a backup says what opens it.** A backup the server made itself (**Back up now** or the daily backup) is locked with that server's **backup key** from its emergency kit, not with a password. When you pick such a file, the box now says **Backup key** and where to find it. A one-off backup you made with your own password says **Backup password**. A wrong key or password now says which one is needed.
- **After Back up now**, a note reminds you that this backup opens with the server's backup key, so keep the emergency kit. A backup that failed is now shown as failed, not in green.
- **The message service (MQTT) reconnects by itself after its login changes**, for example after restoring a backup from another server. Before, Nexternel stopped trying after one refused login and showed "MQTT broker is not connected" until the services were restarted.
- **Restoring a backup no longer switches ESPHome on.** After a restore, ESPHome is restarted only when it was already running. A restore on a system without ESPHome no longer ends with "MQTT broker is not connected".
- **Sign-in passes are no longer written in the server's request log.**

## V5.2.174

- **Board updates only when something changed for that board, and you see why.** "Update ready" now says the reason, for example "the shared board settings changed (emergency Wi-Fi hotspot, new in V5.2.168)" or "its settings file was changed (1 Nov, 17:46)". With no reason, there is no update.
- **A newer ESPHome on the server alone no longer asks for board updates.** The board's own settings decide.
- **Editing an explanation in the shared board settings never asks for board updates.** Only real setting changes count.
- **Who started a board update** is shown while it runs ("Started by … at …") and in the Activity log. Nexternel never updates boards on its own.

## V5.2.173

- **A sensor that stops answering is now shown clearly.** When a board is online but cannot read its sensor (loose wire, wrong pin, failing sensor), its readings no longer stay empty, and a gauge no longer shows 0. They now say **Sensor not answering**.
  - **Devices:** the board shows **Sensor not answering** and is counted under **Needs attention**. **Board health** names the sensors that are not answering.
  - **Activity log:** one line when a sensor stops answering, and one when it reads again.
  - **Bell:** a warning after the same wait as for a device that went offline (one message per board), and a message when it reads again.

## V5.2.172

- **Panels per row.** In a section's settings (while editing a dashboard), choose **2, 3, 4, 5 or 6** panels per row: every panel in that section gets the same width and they line up in neat rows, with no gap at the end. Heights stay as they are, and you can still resize panels afterwards. A choice is greyed out when it would make a panel narrower than it can be (a history chart needs at least the width of two standard panels).
- **Finer resizing.** Dragging a panel's resize corner now moves in smaller steps (a sixth of before), so panels can be sized more precisely.
- Your dashboards look exactly as before: every saved panel size is converted once, automatically, to the finer steps (also when a backup is restored, and when updating from any older version).

## V5.2.171

- **New sign-in screen.** It now fills the whole screen: a welcome side with the logo, and the sign-in box beside it (stacked on a phone). The welcome side shows the background and effect last chosen in Appearance on that device; on a new device it shows the standard Nexternel look. The sign-in box always stays plain and easy to read.
- **Show password** button (the eye) in the password box.
- **Keep me signed in on this device** — untick it on a shared computer and you are signed out when the browser tab is closed.

## V5.2.170

- **Nexternel has its own logo** — a hexagon planet with its ring. You see it in the menu (in your Appearance colours), in the browser tab, as the icon when you add Nexternel to a phone's home screen, and on the sign-in page.

## V5.2.169

- **Fixed: switches flashed "Switching…" for a moment** between Off and On. A switch now goes straight to its new position when the board answers quickly; "Switching…" only shows when the board takes longer than half a second.

## V5.2.168

- **Every board now has an emergency Wi‑Fi hotspot.** If a board cannot reach your Wi‑Fi (new router, changed password), it opens its own Wi‑Fi; join it from a phone and choose your Wi‑Fi again. Its name and password are in **Devices → a board → Advanced**. Boards need one update (**Update boards** on Devices).

## V5.2.167

- **Activity log is easier to read.** A switch that the board turns on and off by itself all the time (for example a sensor that measures in turns) now shows one line an hour saying how often, instead of hundreds of lines.
- **Clearer connection messages.** A board that lost touch for a moment and came straight back no longer suggests that two devices share a name; that warning now only shows when it really looks like it.

## V5.2.166

- **Fixed: after installing V5.2.165, Settings → System → Updates still offered it.** The update itself was installed; only the version number shown by the server was not raised. This can no longer happen — a release now stops when the two numbers differ.
- **Appearance:** the Cancel / Apply bar now stays on the Appearance page instead of following you to every page. If you leave with changes not applied, Nexternel asks: **Stay here**, **Don't keep** or **Apply and continue**.

## V5.2.165

- **New Right rail:** it now works just like the Dock, standing up on the right — the room under the pointer grows and its name shows beside it. No more fold button; the rail always stays slim.

## V5.2.164

- **New: built-in connection troubleshooting.** When a device loses its connection, the Activity log now says why, in the message service's own words — for example that the board stopped answering, or dropped the connection without saying goodbye.
- Boards now report how long their last break lasted, which Wi‑Fi access point and channel they use, and their own warnings (Troubleshooting → Board health). They also send less routine traffic than before. Each board needs one update (**Update boards** on Devices).

## V5.2.163

- **Fixed: switches that did not turn on or off.** A switch now waits for the board to confirm and shows "Switching…" meanwhile. If the board does not answer within a few seconds, it shows "No answer from …" and goes back to the real position — the dashboard no longer shows a switch as on when the relay is off.
- The Activity log shows who pressed each switch.

## V5.2.162

- **New Appearance page:** five tabs (Theme, Style & colours, Background, Text, Dashboards) instead of one long page, with the preview staying in view. Each background effect shows a small moving picture, Text size comes first, and the fonts are shown in their own letters.
- **Apply and Cancel:** Appearance changes show straight away but are only kept when you press **Apply**; **Cancel** puts everything back. The bar stays visible on every page until you choose.
- The brand logo upload is removed; Nexternel will use its own logo.

## V5.2.161

- **Tabs now look like tabs** everywhere (an underline under the chosen one, no box), so they are never mistaken for buttons.

## V5.2.160

- **Fixed:** after V5.2.159 the boards did not show that the health report was waiting for them. When an update changes the shared board settings, Nexternel now prepares the new software for every board by itself (Devices shows the progress) and then offers **Update boards**.

## V5.2.159

- **New: board health report.** Every board sends one small report a minute — how long it has been running and why it last restarted (for example a power dip or a crash), its Wi‑Fi strength, how often it lost Wi‑Fi or the message service, and its free memory. See it on the device's **Troubleshooting** tab, with **Check now** to ask the board straight away. Restarts and their reasons appear in the Activity log. Each board needs one update to start sending it.

## V5.2.158

- **New: Activity log** (Settings → Activity, and on each device's Troubleshooting tab) — what happened in Nexternel, newest first: devices going offline and back, restarts, switches turned on or off and by whom, board updates, dashboards changed, and Nexternel's own events. Kept 30 days.

## V5.2.157

- **Fixed:** dashboards made with New dashboard were only visible to the person who made them; every dashboard is now for everyone (wall screens and other people too).
- **Fixed:** a board that stops sending without saying goodbye is now shown offline after 3 minutes, instead of staying "online".
- Each device message is now handled once (it was received twice).

## V5.2.156

- **The Devices page is redesigned:** one tidy list grouped by area with live values and one clear status word per device (never listed twice), quick filters, and a device page with Overview, Readings & switches, Troubleshooting (connection history, update details, technical details, Copy report) and Advanced. **Device settings** keeps only everyday choices: name, area, use this device, delete.
- Nexternel no longer looks for a board's settings file by a similar name — only the board's own linked file is used.

## V5.2.155

- **Clearer button names everywhere:** every button now says plainly what it does (for example **Update boards**, **Reload from ESPHome**, **Install with USB**, **Reset name**), with the same wording and capitals throughout. A built-in check keeps it that way.
- **Fixed:** after updating, boards still showed "not known" — Nexternel now reads the software each board reports. No further board update is needed.

## V5.2.154

- **Fixed:** Devices kept saying every board needed an update. Each board now reports which software it runs, and Nexternel only says "needs an update" when that differs from the newest build. Boards that don't report it yet show "Not known yet" — one update starts it.
- Notifications is now at the bottom of the Settings menu.

## V5.2.153

- **New resize corner** for panels while editing: two triangles and a dot on a small square, drawn in your Appearance (its colour, corners and button style), replacing the round arrow button.

## V5.2.152

- **Arrange your dashboards while editing:** every dashboard has a grip to drag it to a new place (also with a finger on a touch screen), and the open one has arrow buttons. Works the same in the tabs, the Dock and the Rail.
- **The same Cancel and Apply buttons at the bottom of every side menu** while editing a dashboard. Cancel puts back how it was when you opened the menu.
- **A new Add panel menu in three steps:** pick the kind of panel from picture tiles, then exactly what it shows from a clear list grouped by area with live values, then where it goes and how it looks.
- **The line under a panel's title is always the area**, worked out the same way for every panel, and you can choose it yourself (or hide it) in the panel's menu.

## V5.2.151

- **Fixed:** after updating boards, Devices kept saying every board needed an update. Nexternel now has ESPHome itself do the update, so ESPHome always knows what each board runs, and a board that already runs the newest software is not sent it again.
- **Show details** for every board update: what went wrong in plain words, the errors ESPHome reported, and its full record to copy. The last 10 updates of each board are kept.
- A board whose Wi-Fi keeps dropping is flagged before updating, with the advice to use a USB cable.
- **Fixed:** the preview in the panel editor drew gauges and charts small in a corner; it now looks exactly like the panel on the dashboard.
- The red "act now" status light flashes quickly to catch the eye. "Traffic light dots" is renamed "Three dots".
- Switches have clear labels that no longer change when switched (for example "Show the name above the panels").

## V5.2.150

- **Fixed:** updating ESP32 boards from Nexternel stopped with "does not match the source … used to generate cache". Nexternel now builds with exactly the same setup as the ESPHome page, and clears a board's old build files by itself when they no longer match.

## V5.2.149

- **Update boards from Nexternel:** the Devices page shows which boards need an update, with **Update all boards**; each board also has **Update board**. Nexternel prepares the update, sends it over Wi‑Fi and waits until the board is back — no ESPHome needed.
- **Installing a new board with a USB cable** is a short three-step guide.
- ESPHome tools for experienced users are together under the device's **Advanced** tab.

## V5.2.148

- **New dashboards** open ready to edit, with an **Add panel** button in their empty section, and you choose the icon when you add one.
- The **+** (add dashboard) shows only while editing.
- **Change the order of dashboards** by dragging them in the tabs, dock or rail while editing.

## V5.2.147

- **Safer ESPHome page:** it now opens only from Nexternel (Devices → Open in ESPHome) for people allowed to change devices. Before, anyone on the home network could open it.
- **Boards that are quiet are shown as Online** (for example relay boards), not "No recent data".
- **Connection history** for each device: when it dropped out, for how long, its Wi-Fi signal and last restart (Devices → the device).
- **The bell reports a device only when it stays offline** for the time you choose in Settings → Notifications (5 minutes unless changed), and says how long it was gone when it is back.
- **Board settings:** Wi-Fi power saving off and two health readings. Boards take them when they are next installed.

## V5.2.146

- **Dashboards:** the Dashboard Menu (tabs, dock or rail) stays visible while editing, with a **+** button to add a dashboard. Leaving a dashboard with unsaved changes asks whether to save them.
- **Settings → Notifications:** your notification bell (when it shows and where: top or bottom of the side menu, or with the dashboard tools) and which messages reach it.
- **My appearance** is now called **Appearance**.
- **Extensions:** Check for updates now covers everything installed.
- **System:** the troubleshooting tools open with a clear button under the title.

## V5.2.145

- **Users** is now inside Settings, with Roles opened from the Users page.
- Fixed: saving a person in Users → Edit no longer resets their Auto light/dark and second and third colours.
- **The bell now tells you when Nexternel needs you:** a device went offline (and is back), device messages stopped working, the disk is getting full, or an automatic backup failed.
- "New version available" messages disappear once that version is installed.

## V5.2.144

- **Settings menu:** Settings is now a proper fold-out group with an arrow. Its pages have their own icons and sit indented under it, and only the page you are on lights up.
- With the menu folded to icons, pointing at Settings shows its pages in a small pop-out list.
- The side menu is slightly wider, so page names fit on one line in every style.

## V5.2.143

- **Settings** pages are listed under Settings in the side menu: My appearance, System, Extensions, Backup & Restore.
- **Extensions:** plugins and add-ons together in one place, each marked Feature or Style and Free or Paid.
- **System** is simpler: updates, addresses, one-line health check, and troubleshooting tools folded away.
- **Areas** look like dashboard panels, with icons, their devices listed, and drag to reorder.
- **Devices:** cameras are part of the device list; no more Cameras tab or Sync button.

## V5.2.142

- HUD: the glowing-border status light is one glowing line along the panel's frame — no extra rectangle around the panel.

## V5.2.141

- Panels with several readings keep their readings side by side on every screen, switching to a compact one-line form when short (no more cut-off lists on wall displays).
- Readings named from device ids are written properly: PM2.5, PM1.0, PM10, CO2…
- PM1.0 now has a status light out of the box.
- While editing a dashboard, opening or creating another one waits until you save or cancel.

## V5.2.140

- Panels keep enough room for their content in every style, including HUD on phones.

## V5.2.139

- **One set of text sizes everywhere,** following your chosen font; big values (temperatures, clock, gauges) all in your second colour.
- A proper **fold button** on each section; **grip dots** back on panels while editing.
- **Compact icon choice** (Change to open the list).
- **Moving a panel to another section:** pick the section in the panel's Edit panel.
- The dock and right rail match the side menu.

## V5.2.138

- **All-new Appearance.** Pick a main colour and Nexternel finds a second and third colour that go with it (or choose them yourself); every text and button is checked to stay easy to read.
- **Ready-made themes** and a **live preview** in Settings → Appearance.
- **Mode: Light, Dark or Automatic** (follows your device).
- **17 built-in fonts** for every style, working offline.
- **Backgrounds made from your own colours.**
- Standard is solid and Glass is see-through — everywhere, consistently.
- Choosing a light glow background no longer switches you to Light mode.

## V5.2.137

- The edit bar is now a proper bar across the top, matching the side menu, with the dashboard's icon.
- Each panel has a single **Edit** button; moving to another section and removing are in its Edit panel.
- Opening a side panel no longer shrinks or shuffles the dashboard.
- Status lights stay visible while editing; section edges are easier to see.
- The panel "Animations" choice only appears where something can actually move.

## V5.2.136

- **Tidy, simple edit mode.** One bar at the top (Add section, Dashboard settings, Save, Cancel) that stays in view. Settings open in a **side panel** on the right while the dashboard stays visible: Dashboard settings (name, icon, panels across, all dashboards), Section settings (name, icon, width, position, delete), Add panel and Edit panel. No pop-up windows.
- Panels show their own names while arranging; drag them by the title; **Edit** and **More** (move to another section, remove) sit in the title.
- Panels no longer stick out past the right side of their section, and nothing moves when switching into edit mode.
- No more hint text, dotted line or empty space in edit mode.

## V5.2.135

- **Glowing border status light:** a solid, thicker band that sits flush on the panel's edge — no grey rim or corners showing outside it. In HUD, the panel's own frame lights up in the status colour.

## V5.2.134

- After an update, every screen (wall displays too) now loads the new version instead of an old copy.
- Less empty space under the dashboard when the Dock is used.

## V5.2.133

- **Room menu is now called Dashboard Menu** (Settings → Appearance).

## V5.2.132

- **Wall display:** half-height panels, the calendar and system information fit without a scrollbar.
- **Glowing border status light:** thicker, sits exactly on the panel's edge, no corners sticking out.

## V5.2.131

- The page scrolls again with the mouse pointer on a panel; panel scrollbars only show while the pointer is on the panel.
- **New Right rail:** a floating menu on the right, centred, growing with the number of rooms; Dashboard Options sits apart at the bottom.
- **Top tabs** sit higher, in line with the menu title, and the Dashboard Options cog is a button like the tabs.

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
