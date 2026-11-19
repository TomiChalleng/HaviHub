// Common reasons a game fails, read from its log or crash report, in words a
// player understands. Pure: the Logs tab shows the result above the log.
// Each finding: { id, title, detail, vars } (Spanish source strings; the
// renderer translates them).

const CLASS_TO_JAVA = (v) => (v >= 45 ? v - 44 : 0); // class file 52 -> Java 8, 61 -> 17, 65 -> 21

function uniq(a) {
  return [...new Set(a.filter(Boolean))];
}

function missingDependencies(text) {
  const out = [];
  // Fabric / Quilt: "Mod 'Sodium Extra' (sodium-extra) 0.5 requires any version of 'sodium', which is missing!"
  for (const m of text.matchAll(/Mod '([^']+)' \(([^)]+)\)[^\n]*?requires [^\n]*?(?:of|mod) '?([\w.-]+)'?[^\n]*?which is missing/gi)) out.push(`${m[3]} (${m[1]})`);
  // Fabric (newer): "- Install fabric-api, any version."
  for (const m of text.matchAll(/^\s*- Install ([\w.-]+), (?:any version|version [^\n.]+)\.?$/gim)) out.push(m[1]);
  // Forge / NeoForge: "Mod ID: 'jei', Requested by: 'emi', Expected range: …"
  for (const m of text.matchAll(/Mod ID: '([\w.-]+)', Requested by: '([\w.-]+)'/g)) out.push(`${m[1]} (${m[2]})`);
  // Forge (older): "Missing Mods: … modid : [1.0,)"
  if (/Missing or unsupported mandatory dependencies|Missing Mods:/i.test(text)) {
    for (const m of text.matchAll(/^\s*(?:Mod ID|modid)?:?\s*'?([\w.-]+)'?\s*:\s*\[[^\]]*\]/gim)) out.push(m[1]);
    if (!out.length) out.push('?');
  }
  return uniq(out).slice(0, 6);
}

function javaProblem(text) {
  const cls = /class file version (\d+)(?:\.\d+)?\), this version of the Java Runtime only recognizes class file versions up to (\d+)/.exec(text);
  if (cls) return { need: CLASS_TO_JAVA(Number(cls[1])), have: CLASS_TO_JAVA(Number(cls[2])) };
  const req = /(?:requires|needs) (?:at least )?Java (\d+)|Java (\d+) (?:or (?:newer|later|above) )?is required/i.exec(text);
  if (req && /java/i.test(req[0]) && /(incompatible|unsupported|requires|required)/i.test(text)) return { need: Number(req[1] || req[2]), have: 0 };
  if (/UnsupportedClassVersionError/.test(text)) return { need: 0, have: 0 };
  if (/Could not create the Java Virtual Machine|Unrecognized VM option|Unrecognized option: /.test(text) && !/Could not reserve enough space/.test(text)) return { need: 0, have: 0, vmOption: true };
  return null;
}

function memoryProblem(text) {
  if (/Could not reserve enough space for (?:object heap|\d+KB object heap)|Invalid maximum heap size|Initial heap size set to a larger value than the maximum/i.test(text)) return 'reserve';
  if (/java\.lang\.OutOfMemoryError|There is insufficient memory for the Java Runtime|Native memory allocation \(malloc\) failed/i.test(text)) return 'oom';
  return null;
}

function diagnoseLog(text) {
  const s = String(text || '');
  if (!s) return [];
  const out = [];
  const deps = missingDependencies(s);
  if (deps.length) {
    const known = deps.filter((d) => d !== '?');
    out.push({
      id: 'missing-dependency',
      title: 'Falta una dependencia',
      detail: known.length ? 'Uno o más mods necesitan otro mod que no está instalado: {list}. Instálalo desde Añadir contenido o quita el mod que lo pide.' : 'Uno o más mods necesitan otro mod que no está instalado. Busca "Missing" en el log para ver cuál.',
      vars: { list: known.join(', ') },
    });
  }
  const java = javaProblem(s);
  if (java) {
    out.push({
      id: 'java',
      title: 'Java incompatible',
      detail: java.vmOption
        ? 'Java no aceptó uno de los argumentos de la JVM. Revisa los argumentos en Opciones del perfil → Java o vuelve a los predeterminados.'
        : java.need && java.have
          ? 'Este perfil necesita Java {need} y está usando Java {have}. Activa la descarga automática de Java en Ajustes → Java y memoria o elige esa versión en las opciones del perfil.'
          : java.need
          ? 'Este perfil necesita Java {need}. Activa la descarga automática de Java en Ajustes → Java y memoria o elige esa versión en las opciones del perfil.'
          : 'Un mod o el juego se compiló para una versión de Java más nueva que la que usa este perfil. Activa la descarga automática de Java en Ajustes → Java y memoria.',
      vars: { need: java.need || '', have: java.have || '' },
    });
  }
  const mem = memoryProblem(s);
  if (mem) {
    out.push({
      id: 'memory',
      title: 'Falta de memoria (RAM)',
      detail: mem === 'reserve' ? 'Java no pudo reservar la memoria asignada. Baja la memoria máxima del perfil o cierra otros programas.' : 'El juego se quedó sin memoria. Sube la memoria máxima del perfil (Opciones → Java) sin pasar de la mitad de la RAM de tu PC.',
      vars: {},
    });
  }
  if (!out.length && /Mixin apply (?:for mod [\w.-]+ )?failed|MixinApplyError|InvalidMixinException/.test(s)) {
    const mod = /Mixin apply for mod ([\w.-]+) failed/.exec(s);
    out.push({ id: 'mixin', title: 'Mods incompatibles', detail: mod ? 'El mod {mod} no es compatible con otro mod o con esta versión del juego. Actualízalo o quítalo.' : 'Dos mods no son compatibles entre sí o con esta versión del juego. Busca "Mixin" en el log para ver cuáles.', vars: { mod: mod ? mod[1] : '' } });
  }
  return out;
}

module.exports = { diagnoseLog, missingDependencies, javaProblem, memoryProblem };
