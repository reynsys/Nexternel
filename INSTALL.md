# Installing Nexternel

## What you need

- A small computer that stays on: a mini PC, an old laptop or a Raspberry Pi 4 or 5.
  - 64-bit system
  - 2 GB of memory or more (4 GB is comfortable)
  - 8 GB of free disk space or more (sensor history grows over time)
- **Ubuntu** (22.04 or newer), **Debian** (12 or newer) or **Raspberry Pi OS 64-bit**.
  Nexternel is tested on Ubuntu; the others use the same installer but are tested less.
- A connection to your home network. A network cable is best; Wi-Fi works, but can make pages feel
  slow at times.
- A normal user account on it that can use `sudo`. Don't install as `root`.

## 1. Install

Open a terminal on the machine (or connect to it with SSH) and run:

```bash
curl -fsSL https://www.reynsys.com/install.sh | bash
```

The installer:

1. checks the machine is suitable
2. installs Docker if it isn't there yet (it asks for your password only then)
3. downloads Nexternel into `~/nexternel`
4. creates every service password itself (you never need to type or remember them)
5. detects the machine's network address and time zone
6. starts everything and shows the address to open

The first start takes a few minutes while the services are built. When it's done you will see
something like:

```
   Open this address in a browser on any device at home:

      http://nexternel.local      (or http://192.168.1.20)
```

`nexternel.local` works on phones, tablets and computers on your home network. If a device
can't find it, use the number address.

## 2. Start fresh, or restore your home

Open that address on any phone, tablet or computer at home. The welcome screen offers:

- **Start fresh:** choose the username and password you'll sign in with. You start with a Home
  dashboard (clock, calendar, devices and server information). Then add your rooms under
  **Areas** and your devices under **Devices**.
- **Restore from backup:** choose a `.nexbackup` file and enter its password. For automatic
  backups, that's the **backup key** from your emergency kit. Nexternel shows what's inside before
  restoring. Afterwards you sign in with the same username and password as before.

## 3. Give the server a fixed address

Your devices find Nexternel by its network address, so it should never change. In your router's
settings, look for **DHCP reservation**, **address reservation** or **static lease**, and reserve
the address the installer showed for this machine. Every router names this a little differently;
search for your router's model and "DHCP reservation" if you can't find it.

## Moving to a new server

1. On the old server, open **Settings → Backup & Restore** and press **Back up now**, or use the
   latest automatic backup. Download it.
2. Switch the old server off.
3. In your router, give the new machine the **old server's address**. Your ESP32 boards and Shelly
   switches have that address stored in them, so they reconnect by themselves, with nothing to
   update. If the address has to change, each device needs updating once afterwards.
4. Install Nexternel on the new machine (step 1) and choose **Restore from backup**.

## Updating

```bash
cd ~/nexternel && ./scripts/update.sh
```

The update script:

- saves a copy of your settings in `backups/`
- downloads the latest version
- removes files the new version no longer uses
- rebuilds and restarts

Your settings, backups and device files are never replaced. If the new version fails to start, the
previous one is put back.

## Backups

Nexternel makes an encrypted backup every day (03:00 by default) and keeps the last 7 in
`~/nexternel/backups`. Change this under **Settings → Backup & Restore**.

- **Download the emergency kit** from that page once and keep it away from the server: in a
  password manager, on a USB stick, or printed. It holds the key that opens the automatic backups.
  Without it, they can't be restored.
- **Copy backups off the server now and then** (to another computer, a USB stick or a NAS), so a
  broken disk can't take them too.

## Network ports

| Port | Used by | Open to |
|------|---------|---------|
| 80, 8080 | Nexternel in your browser | your home network |
| 443 | Secure address (https), when one is set up | your home network |
| 5353 (UDP) | Announces the name nexternel.local | your home network |
| 4000 | Nexternel's server (API) | your home network |
| 1883 | MQTT: devices send readings here | your home network |
| 6052 | ESPHome dashboard (device firmware) | your home network |
| 1984 | Camera streams (go2rtc) | your home network |
| 5432, 8086 | Database and sensor history | this machine only |

Don't open any of these on your router to the internet. To reach Nexternel from outside, use a
VPN such as WireGuard or Tailscale.

## When something is wrong

- **Settings → System** shows the state of every service. **Diagnostic report** there gives a text
  you can copy into a message when asking for help.
- In a terminal, `cd ~/nexternel && docker compose ps` lists the services and whether they're running.
- `docker compose logs --tail 100 api` shows the latest messages from Nexternel's server.

## Removing Nexternel

To stop it and delete everything, **including all your data and backups**:

```bash
cd ~/nexternel && docker compose down -v && cd ~ && rm -rf ~/nexternel
```

Copy anything you want to keep, such as backups, out of `~/nexternel/backups` first.
