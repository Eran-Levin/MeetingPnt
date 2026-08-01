/**
 * Users are stored as a first and last name, but every screen shows one string. Deriving it in
 * one place keeps the two clients from formatting people differently — and means adding a middle
 * name or a display-name preference later is a single edit.
 */
export function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
