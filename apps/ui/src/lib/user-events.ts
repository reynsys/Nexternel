/** Fired after profile fields change so the shell can refresh /me. */
export const USER_UPDATED_EVENT = "nexternel:user-updated";

export function notifyUserUpdated(): void {
  window.dispatchEvent(new Event(USER_UPDATED_EVENT));
}
