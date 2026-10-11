# Security

Nexternel runs inside your home and controls real things, so security problems matter.

## Reporting a problem

Please **don't** open a public issue for a security problem. Use GitHub's
**[private vulnerability reporting](https://github.com/reynsys/nexternel/security/advisories/new)**
instead, with:

- what you found, and which version (Settings → System shows it)
- how to reproduce it
- what someone could do with it

You'll get a reply as soon as possible. Fixes are released as a new version, with credit to you if
you'd like.

## Keeping your installation safe

- **Never open Nexternel's ports on your router to the internet.** To reach it from outside, use a
  VPN such as WireGuard or Tailscale.
- **Update regularly:** `cd ~/nexternel && ./scripts/update.sh`.
- **Use a strong password** for every account, and give each person their own account with only the
  rights they need (Users → roles).
- **Keep the emergency kit away from the server.** Anyone with a backup file and its key can read
  your home's configuration.
