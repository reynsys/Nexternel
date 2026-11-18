# Making a Nexternel extension

This guide is for people who write extensions: packages that add devices, panels, pages or services to Nexternel. It covers what Nexternel expects from an extension so that its devices behave like every other device in the home.

The types in `src/index.ts` describe every field. This guide explains how things behave.

## The package

An extension is a `.zip` file with two files at the top level:

- `manifest.json`: what the extension is and what it asks to be allowed to do.
- `main.mjs` (or the file named in `main`): `export default async function start(nx) { … }`.

Nexternel runs each extension in its own process, away from the rest of the home. The extension reaches Nexternel only through `nx`. Every call is checked against what the person installing it approved.

```json
{
  "id": "my-heater",
  "name": "My Heater",
  "version": "1.0.1",
  "pluginApi": 1,
  "author": "Your name",
  "minNexternel": "V5.4.1",
  "description": "One or two plain sentences an owner can read before installing.",
  "permissions": { "devices": "Adds your heater and its temperature." }
}
```

- `id`: 2 to 40 lowercase letters, digits or dashes. It never changes.
- `version`: looks like `1.0.1`.
- `permissions`: `devices`, `read`, `control` and `notify`. Each one needs a short reason. The person installing the extension reads these reasons and approves each permission separately.
- `minNexternel`: the oldest Nexternel your extension works with. Set it to `V5.4.1` or later if you rely on switch confirmation (see below).

## Devices and items

Declare your devices once at start, and again whenever the list changes:

```js
await nx.defineDevices([
  {
    key: "boiler",
    name: "Boiler",
    items: [
      { key: "flow", name: "Flow temperature", kind: "temperature", unit: "°C" },
      { key: "pump", name: "Pump", control: true },
      { key: "heating", name: "Heating", control: "thermostat",
        features: { min: 5, max: 30, step: 0.5, presets: ["Comfort", "Eco"], fixedPresets: ["Eco"] } },
    ],
  },
]);
```

- **Keys** (`key`) are 1 to 40 lowercase letters, digits, `_` or `-`. Keep them the same between versions. Panels, names, icons and history follow the key, so a changed key is a new item to the owner.
- **The list is complete.** A device or item you leave out is removed, together with its panels' link to it.
- Up to 50 devices per extension and 100 items per device.
- **A reading** has a `kind` (temperature, humidity, pressure, battery, voltage, current, power, energy, brightness, motion, door, illuminance, co2, pm1, pm25, pm10; anything else is kept as a number) and an optional `unit`.
- **A switch** has `control: true`.
- **A control** does more than on and off. `control` is `"thermostat"`, `"light"`, `"climate"`, `"cover"` or `"fan"`, and `features` says what it can do:
  - thermostat: `min`, `max`, `step`, `presets`, `fixedPresets`
  - climate: `min`, `max`, `step`, `modes`, `fanSpeeds`
  - light: `brightness`, `color`, `white`
  - any control: `internet: true` (see "Timing")

Nexternel only sends a change that the control's features allow. For example, it never sends a colour to a light without `color`, or a preset that isn't in `presets`.

## Readings

```js
nx.sendReading("boiler", "flow", 54.5);
```

- Readings are grouped and sent together, so sending often is cheap.
- **Send each reading again at least every 2 minutes, even when nothing changed.** A value not renewed for 3 minutes is shown to the owner as "not current".
- Numbers can be numbers or numeric strings. Send `"nan"` when a sensor cannot read: the owner sees that the sensor gave no reading, and the Activity log says so once, and again when it reads again.
- Number readings are kept in history for charts automatically.
- A switch's position is `true` / `false` (or `"on"` / `"off"`).
- A control's state is an object with only the parts it has: `on`, `target`, `current`, `heating`, `mode`, `fan`, `preset`, `brightness`, `color` (`{ h, s }`), `white`, `position` (blinds, 0 closed to 100 open), `speed` (fan, 1 to 100), `humidity`, `outside`. **You may send only what changed.** Nexternel keeps the parts reported before.

## Presses and changes: always report back

When someone presses one of your switches or changes one of your controls, `onCommand` is called:

```js
nx.onCommand(async ({ device, item, action, values }) => {
  // action: "on" | "off" for a switch, "set" for a control (values = the change)
  await tellTheRealDevice(device, item, action, values);
  // Then report what the device now is:
  nx.sendReading(device, item, action === "set" ? values : action === "on");
});
```

**A press counts only when you report the new state.** Nexternel treats your devices exactly like its own boards (from V5.4.1). It never assumes a press worked:

- The owner's screen waits for your report. When it arrives, the panel shows the new state, and the change goes into the Activity log with the name of the person who pressed it.
- **No report within the time limit** (see "Timing") means no answer. An "on" press is then cancelled, and the owner is told "No answer from <device>, so this press was cancelled." An "off" press says it may not have switched.
- **A late "on" is switched off again.** If you report "on" after an "on" press was given up on, Nexternel sends "off" straight away and writes this in the Activity log, so nothing stays on that the owner thinks is off.
- **For a control, the report must show the whole change.** If the owner sets 21° with the Eco preset, a report with only `target: 21` is not enough yet.
- **When the real device refuses, don't report.** The press then ends as "no answer", which is the truth. Use `nx.status("warning", "…")` to tell the owner why, in plain words.
- Report changes that happen on the device itself too (someone turned a knob). Nexternel shows them, and switch changes go into the Activity log.

## Timing

- A device has **6 seconds** to confirm a press or change.
- A control with `features.internet: true` (reached through its maker's internet service) has **15 seconds**. Mark devices like this honestly: the owner is also told the device needs the internet.
- Answer as soon as the real device has taken the change. You can read the full state again a few seconds later and send it then.

## Online and offline

- Your devices are online while you send readings.
- **When your extension stops, crashes or is switched off, all its devices go offline at once.** Their values show as not current, and presses are refused with a plain reason (for example "The extension for this device is switched off"). You don't need to do anything for this.
- A real device that has gone away (out of battery, out of Wi-Fi) should stop getting readings sent for it. After 3 minutes the owner then sees its values as not current.

## Other things `nx` offers

- `nx.settings`, `nx.saveSettings(values)`: the settings page fields from the manifest. Secrets are kept encrypted.
- `nx.dataDir`: a folder only your extension can read and write.
- `nx.readings()`, `nx.history(ids, range)`: readings from the areas the owner allowed (`read` permission).
- `nx.control(itemId, "on" | "off" | "toggle")`: switch another device the owner ticked (`control` permission). It waits for that device's confirmation in the same way.
- `nx.notify({ title, body, level })`: a message in the owner's notifications (`notify` permission).
- `nx.status(state, message)`: a short status line under Settings → Extensions. Use it to say, in plain words, what is wrong and what to do.
- `nx.onPanelRequest`, `nx.onPageCall`, `nx.setPanelContent`: your own panels and pages.
- `nx.log(...)`: lines the owner can see in the extension's log.

## Words on screen

Owners see your names, descriptions and messages. Write them for someone who isn't technical:

- Say "device", "item", "area", "panel" and "extension". Avoid "plugin", "widget", "capability" and "app".
- Say what happened and what to do ("Google refused the change: sign in again on the extension's page"), never only an error code.
