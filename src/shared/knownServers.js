// Well-known public servers (Java Edition), to add to a profile with a click:
// the big international ones and the big Spanish-speaking ones. Addresses
// change now and then; the page pings each one, so what is shown is whether it
// answers right now and how many people are on it.
//   [name, address, what it is (es), what it is (en)]
const row = (lang) => ([name, address, es, en]) => ({ id: `known:${address}`, name, address, lang, es, en });

const SPANISH = [
  ['UniversoCraft', 'mc.universocraft.com', 'La red en español más grande: BedWars, SkyWars, SkyBlock, Prison y más', 'The largest Spanish-speaking network: BedWars, SkyWars, SkyBlock, Prison and more'],
  ['LibreCraft', 'mc.librecraft.com', 'Red en español con Survival, Facciones, Prison y minijuegos', 'Spanish-speaking network with Survival, Factions, Prison and minigames'],
  ['MineLatino', 'play.minelatino.com', 'Comunidad latina: Survival OP, SkyBlock, BedWars y más modalidades', 'Latin American community: OP Survival, SkyBlock, BedWars and more'],
  ['Survival Rolemine', 'mc.srolemine.com', 'Survival, SkyBlock y Facciones en español', 'Survival, SkyBlock and Factions in Spanish'],
  ['OmegaCraft', 'mc.omegacraft.cl', 'Servidor chileno de Survival, Facciones y minijuegos', 'Chilean server with Survival, Factions and minigames'],
  ['EcuaCraft', 'mc.ecuacraft.com', 'Red latina con Survival, SkyBlock, SkyWars y PvP', 'Latin American network with Survival, SkyBlock, SkyWars and PvP'],
].map(row('es'));

const WORLD = [
  ['Hypixel', 'mc.hypixel.net', 'El más grande del mundo: BedWars, SkyBlock, SkyWars, duelos y decenas de minijuegos', "The world's largest: BedWars, SkyBlock, SkyWars, duels and dozens of minigames"],
  ['CubeCraft Games', 'play.cubecraft.net', 'Minijuegos clásicos: EggWars, SkyWars, Tower Defence, parkour', 'Classic minigames: EggWars, SkyWars, Tower Defence, parkour'],
  ['MCC Island', 'play.mccisland.net', 'Los minijuegos del MC Championship, abiertos a todos', 'The MC Championship minigames, open to everyone'],
  ['Wynncraft', 'play.wynncraft.com', 'Un MMORPG completo dentro de Minecraft, sin mods', 'A full MMORPG inside Minecraft, no mods needed'],
  ['2b2t', '2b2t.org', 'El servidor de anarquía más antiguo: sin reglas ni reinicios desde 2010', 'The oldest anarchy server: no rules and no resets since 2010'],
  ['Hoplite', 'hoplite.gg', 'Battle royale y UHC con partidas rápidas', 'Battle royale and UHC with quick matches'],
  ['Donut SMP', 'donutsmp.net', 'Survival multijugador enorme, con economía', 'A huge survival multiplayer world, with an economy'],
  ['Minehut', 'mc.minehut.com', 'Miles de servidores de la comunidad en un solo lobby', 'Thousands of community servers behind one lobby'],
  ['PvP Legacy', 'play.pvplegacy.net', 'Práctica de PvP: duelos y kits', 'PvP practice: duels and kits'],
  ['Minemen Club', 'na.minemen.club', 'PvP competitivo y práctica con ranking', 'Competitive PvP and ranked practice'],
  ['ManaCube', 'play.manacube.com', 'Parkour, SkyBlock, Survival y Prison', 'Parkour, SkyBlock, Survival and Prison'],
  ['Complex Gaming', 'hub.mc-complex.com', 'Pixelmon, SkyBlock, Survival y Prison', 'Pixelmon, SkyBlock, Survival and Prison'],
  ['Purple Prison', 'purpleprison.net', 'El servidor de Prison más conocido', 'The best-known Prison server'],
  ['OPBlocks', 'play.opblocks.com', 'Prison, SkyBlock y Survival con mundos a medida', 'Prison, SkyBlock and Survival with custom worlds'],
  ['Origin Realms', 'play.originrealms.com', 'Survival con objetos, bloques y muebles nuevos, sin mods', 'Survival with new items, blocks and furniture, no mods needed'],
  ['GommeHD', 'gommehd.net', 'Red alemana clásica de minijuegos: BedWars, SkyWars', 'Classic German minigame network: BedWars, SkyWars'],
  ['BlocksMC', 'blocksmc.com', 'BedWars, SkyWars y más; acepta cuentas no premium', 'BedWars, SkyWars and more; accepts non-premium accounts'],
  ['PikaNetwork', 'play.pika-network.net', 'BedWars, SkyWars, Facciones y Survival; acepta cuentas no premium', 'BedWars, SkyWars, Factions and Survival; accepts non-premium accounts'],
  ['JartexNetwork', 'play.jartexnetwork.com', 'BedWars, SkyBlock, Facciones; acepta cuentas no premium', 'BedWars, SkyBlock, Factions; accepts non-premium accounts'],
  ['ExtremeCraft', 'play.extremecraft.net', 'Survival, SkyBlock, Facciones y minijuegos', 'Survival, SkyBlock, Factions and minigames'],
  ['Herobrine.org', 'mc.herobrine.org', 'Survival, SkyBlock, BedWars y Facciones', 'Survival, SkyBlock, BedWars and Factions'],
  ['MCCentral', 'mccentral.org', 'Prison, SkyBlock, Facciones y minijuegos', 'Prison, SkyBlock, Factions and minigames'],
  ['Advancius Network', 'mc.advancius.net', 'Survival, minijuegos y parkour; Java y Bedrock', 'Survival, minigames and parkour; Java and Bedrock'],
  ['Minr', 'zero.minr.org', 'Uno de los más antiguos: parkour y laberintos difíciles', 'One of the oldest: hard parkour and mazes'],
].map(row('int'));

const KNOWN_SERVERS = [...SPANISH, ...WORLD];

module.exports = { KNOWN_SERVERS };
