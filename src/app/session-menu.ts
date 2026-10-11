export function closeAccountMenu(): void {
  document
    .querySelectorAll<HTMLDetailsElement>('.session-menu[open]')
    .forEach((menu) => {
      menu.open = false;
    });
}