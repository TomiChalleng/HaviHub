// Whether the first-start welcome (components/Welcome.jsx) is due: a new
// installation (no layout chosen yet), or one that never finished it and has
// no instance yet.
export function needsWelcome(config, instances) {
  if (!config || config.welcomeDone) return false;
  return !config.layout || !(instances && instances.length);
}
