/**
 * Nexternel's terms of use: one text, shown in the setup wizard (and wherever else they are read),
 * and the version the server records when the owner agrees. Change the version whenever the text
 * changes in a way people must agree to again.
 *
 * DRAFT: written in plain English for Rey; a solicitor checks it before Nexternel goes public.
 */
export const TERMS_VERSION = "2026-11-10-draft";

export const TERMS_SUMMARY =
  "Nexternel runs in your home and your information stays with you. It is free to use. " +
  "You are responsible for the devices you connect and for keeping your sign-in safe.";

export const TERMS_SECTIONS: { title: string; text: string }[] = [
  {
    title: "1. What Nexternel is",
    text:
      "Nexternel is software you run on your own machine at home. It shows and controls the devices you connect to it. " +
      "It is provided as it is: we work hard to make it reliable, but we cannot promise it will always work without faults.",
  },
  {
    title: "2. Your information",
    text:
      "Everything Nexternel records (readings, settings, accounts, camera pictures) is kept on your machine. " +
      "Nothing leaves your home unless you turn on something that needs it, such as Nexternel Anywhere or the weather forecast. " +
      "The weather forecast only sends the place you chose. Checking for updates and extensions only asks which versions are the newest.",
  },
  {
    title: "3. Your devices and your home",
    text:
      "You decide what Nexternel controls. Do not use it for anything where a fault could put people at risk, " +
      "such as medical equipment, smoke or gas alarms, or locks that are the only way in or out. " +
      "Follow the instructions of each device's maker and the electrical rules where you live.",
  },
  {
    title: "4. Keeping it safe",
    text:
      "Choose a strong password and keep it to yourself. Keep your emergency kit somewhere safe: without it, " +
      "a backup cannot be opened on a new machine. Install updates when Nexternel offers them.",
  },
  {
    title: "5. Paid extras",
    text:
      "Some extras, such as Nexternel Anywhere and some Looks, are paid for. Their price and what you get are shown before you pay.",
  },
  {
    title: "6. Changes to these terms",
    text:
      "If these terms change, Nexternel will show you the new version.",
  },
];
