export function generateConfirmationCode(): string {
  return `AC-${Math.floor(1000 + Math.random() * 9000)}`;
}
