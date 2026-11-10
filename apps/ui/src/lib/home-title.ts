/** The browser tab shows the home's name when it has one: "The Taylors' house · Nexternel". */
export function showHomeInTab(name: string | null | undefined): void {
  const n = name?.trim();
  document.title = n ? `${n} · Nexternel` : "Nexternel";
}
