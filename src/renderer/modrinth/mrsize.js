// Sizes of the Modrinth layout. The window draws at 0.8 zoom (src/main/main.js)
// and the layout sets 1rem = 20 CSS px, so rem values match the Modrinth app
// but px values (and every size prop, like <Icon size>) come out 20 % smaller.
// These give the px to pass for Modrinth's sizes in real pixels.
//   IC.s4 / s5 / s6: Tailwind's size-4 / size-5 / size-6 (16, 20, 24 px)
export const mpx = (n) => Math.round(n * 1.25 * 100) / 100;
export const IC = { s3: mpx(12), s4: mpx(16), s5: mpx(20), s6: mpx(24) };
// Avatar sizes used by Modrinth (pass to InstanceImage boxes through CSS, these
// are for size props such as AccountAvatar's)
export const AV = { a20: mpx(20), a24: mpx(24), a28: mpx(28), a32: mpx(32), a36: mpx(36), a48: mpx(48) };
