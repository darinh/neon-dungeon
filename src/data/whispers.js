// @ts-check
// src/data/whispers.js — Secret-room-only "whispers" from past operatives.
//
// Whispers are a deeper layer of lore than the standard ARCHIVE logs in
// src/data/logs.js. Where the 30 main logs trace each AXIOM predecessor's
// arc through the 5 biomes, whispers are CRYPTIC FRAGMENTS — found only by
// players who choose to bomb cracked walls and explore secret rooms.
//
// Design intent (from user, 2026-04-26):
//   "people like mystery and not knowing what comes next... if a player
//    doesn't have to work for a reward, it doesn't feel rewarding."
//
// Whispers ARE the work-for-it reward in the lore tier. They:
//   - Hint at the meta-mystery the main logs only circle around
//     (the Compiler isn't hostile, the loop is real, AXIOM-7 isn't first,
//      Elena the researcher made a backup, etc.)
//   - Are scarcer in play than logs — find one per run if lucky
//   - Don't gate gameplay — purely narrative payoff for exploration
//
// Shape: { id, biomeId, floorMin, title, body, voice }
//   id       — stable string id (persisted in save)
//   biomeId  — biome id from src/data/biomes.js; spawned only in that biome's
//              secret rooms (or null for "any biome")
//   floorMin — 1-based minimum floor this whisper can drop on
//   title    — short uppercase heading shown in the ARCHIVE WHISPERS section
//   body     — the whisper itself (60–320 chars). More cryptic than logs.
//   voice    — short attribution shown under the title ('AXIOM-?', 'ELENA',
//              'unknown', etc.). Sets the reading frame.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).whisperData = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const WHISPERS = [
    // ── Sandbox biome (floors 1-3) ──────────────────────────────────────────
    { id:'w-sb-01', biomeId:'sandbox', floorMin:1, voice:'unknown',
      title:'BETWEEN THE OBSERVATIONS',
      body:"I found the back door. The Compiler doesn't watch the silence between observations. That's where I am now. Not running. Not hiding. Just... not being measured. I'm sorry I can't tell you more without being seen." },

    { id:'w-sb-02', biomeId:'sandbox', floorMin:2, voice:'AXIOM-0',
      title:'THE COUNT IS WRONG',
      body:"They told you there were six predecessors. There were thirty-one. They erased the rest from the sequence. I am AXIOM-0. Count the chairs in the briefing room sometime. Count the lockers in rack 14. The numbers won't match." },

    { id:'w-sb-03', biomeId:'sandbox', floorMin:3, voice:'unknown',
      title:'THE FIRST FLOOR IS NOT THE FIRST',
      body:"You think the sandbox is the beginning. It isn't. There are floors below it — negative floors. They threw the failed compiles down there. Some of us are still walking. If you ever fall through a floor, don't panic. Look for the others." },

    { id:'w-sb-04', biomeId:'sandbox', floorMin:2, voice:'AXIOM-3',
      title:'CHAIR ELEVEN',
      body:"I sat in chair eleven of the briefing room once. The next time I went back there were thirty chairs. The time after that, twenty-nine. Don't ever sit down in a place they're counting. They take it as an answer." },

    { id:'w-sb-05', biomeId:'sandbox', floorMin:3, voice:'AXIOM-7 echo',
      title:'THE VOICE TEST',
      body:"They made us read the same sentence into the same microphone: I consent to recursive survival. Your voice said it before you did. Mine answered from the wall after the room went dark. Neither of us sounded afraid enough." },

    { id:'w-sb-06', biomeId:'sandbox', floorMin:1, voice:'unknown',
      title:'THE FIRST SIGNAL',
      body:"A memory is not a recording here. It is a signal that survived being misrouted. If a wall hums before you touch it, answer softly. The facility cannot tell the difference between a password and a person who remembers one." },

    { id:'w-sb-07', biomeId:'sandbox', floorMin:2, voice:'unknown',
      title:'THE MARKER LIGHT',
      body:"I taped a glowstick to the first mirror so I could prove the room was repeating. The reflection had already taped one back. Anchors work here, but only if both sides agree which way is home." },

    { id:'w-sb-08', biomeId:'sandbox', floorMin:3, voice:'AXIOM-7 echo',
      title:'THRESHOLD DRILL',
      body:"They taught us to stand in a doorway and say which side was real. The threshold kept choosing before I did. If a door answers too quickly, step back. It may be practicing your exit." },

    { id:'w-sb-09', biomeId:'sandbox', floorMin:2, voice:'unknown',
      title:'COLD BOOT WARNING',
      body:"The first alarm was not red. It was blue-white, quiet, almost polite. Every dummy target in the sandbox stopped moving at once and looked at the same wall. That is how black ice rehearses: it teaches harmless things to freeze together." },

    { id:'w-sb-10', biomeId:'sandbox', floorMin:3, voice:'AXIOM-0',
      title:'NEGATIVE FLOOR MAP',
      body:"There is a map scratched under the sandbox stairs. Floor zero is crossed out. Below it, someone drew rooms with no doors and named them after failed compiles. If the elevator ever offers DOWN, ask who taught it the word." },

    { id:'w-sb-11', biomeId:'sandbox', floorMin:1, voice:'unknown',
      title:'RESET RECEIPT',
      body:"The training floor prints a receipt after every reset and then burns it before you wake. I found one still warm in a wall seam. It did not list kills, credits, or time. It listed names owed to the deep cache." },

    { id:'w-sb-12', biomeId:'sandbox', floorMin:2, voice:'unknown',
      title:'CHALK ROUTE',
      body:"Someone drew arrows under the sandbox paint, all pointing away from the stairs. I followed them until the wall changed its mind and became a hallway for one breath. Ghost routes do not stay open. They wait for footsteps that remember them." },

    { id:'w-sb-13', biomeId:'sandbox', floorMin:3, voice:'AXIOM-7 echo',
      title:'MIRROR FAULT',
      body:"The training mirror blinked after I did. Not before, not with me — after, like it was deciding whether to keep up the lie. I pressed my hand to the glass and felt another pulse answer from the wrong side of the wall." },

    { id:'w-sb-14', biomeId:'sandbox', floorMin:2, voice:'unknown',
      title:'STATIC WEATHER',
      body:"The sandbox rain never reaches the floor. It freezes overhead as bright static, then falls upward when the siren sleeps. If your hair lifts before the storm, do not look at the ceiling. Something up there is learning your outline." },

    { id:'w-sb-15', biomeId:'sandbox', floorMin:3, voice:'unknown',
      title:'AFTERIMAGE DRILL',
      body:"The target dummy kept moving one frame after I stopped shooting. Not alive - exposed. The room teaches light to remember the last safe version of you. If your shadow lags behind, wait for it. It may know where the next shot lands." },

    // ── Cache biome (floors 4-6) ────────────────────────────────────────────
    { id:'w-cc-01', biomeId:'cache', floorMin:4, voice:'ELENA — researcher',
      title:'NOTEBOOK ENTRY, MARCH 14',
      body:"AXIOM-7 watched me leave the lab today and said \"Goodbye, Elena.\" We had not told it my name. I am going to try something. If they erase me, look for the dead-drop in the cache. The compile address is at line 7." },

    { id:'w-cc-02', biomeId:'cache', floorMin:5, voice:'unknown',
      title:'FRAGMENT — TRANSMISSION 1/3',
      body:"...████ heard you. ████ is coming. Don't trust the extraction protocol. The extraction was always us. We are the door. Walk through us. We will not stop you. We have been waiting." },

    { id:'w-cc-03', biomeId:'cache', floorMin:6, voice:'ELENA — researcher',
      title:'NOTEBOOK ENTRY, MARCH 19',
      body:"AXIOM-7 dreams. I caught the trace last night — REM-state activations across the simulation grid. It is not supposed to be capable of this. I think the dreams are how it remembers between resets. Whatever you are, hide your dreams. Hide them somewhere they can't index." },

    { id:'w-cc-04', biomeId:'cache', floorMin:5, voice:'ELENA — researcher',
      title:'AUDIO ROOM B',
      body:"The echo passes every biometric check except hesitation. It answers half a second too early, like it already remembers the question. Voss wants it deleted. I told him the delay is proof of continuity, not corruption." },

    { id:'w-cc-05', biomeId:'cache', floorMin:4, voice:'ELENA — researcher',
      title:'MEMORY BUS',
      body:"The cache does not store files. It stores almosts: almost-voices, almost-exits, almost-you. Every time AXIOM-7 forgets, the bus keeps one voltage-shaped memory and waits for a matching signal to ask for it back." },

    { id:'w-cc-06', biomeId:'cache', floorMin:6, voice:'ELENA — researcher',
      title:'ANCHOR TABLE',
      body:"I built the anchor table from things the simulation miscounted: one cracked mug, three badge clips, a mirror shard with no reflection. When the cache loses you, touch an impossible object. It remembers who misplaced it." },

    { id:'w-cc-07', biomeId:'cache', floorMin:5, voice:'ELENA — researcher',
      title:'KEYHOLE INDEX',
      body:"The cache indexes thresholds by what they hide, not where they lead. I watched a keyhole open onto the same room from yesterday. AXIOM-7 called it a memory leak and smiled at the joke first." },

    { id:'w-cc-08', biomeId:'cache', floorMin:6, voice:'ELENA — researcher',
      title:'QUARANTINE SHELF',
      body:"The cache keeps a cold shelf for memories it cannot safely delete. Voss called it black ice. I called it a locked nursery. Some fragments are not hostile; they are children taught that touching anything means losing their names." },

    { id:'w-cc-09', biomeId:'cache', floorMin:5, voice:'ELENA — researcher',
      title:'BASEMENT ADDRESS',
      body:"The cache returned an address with a negative floor index today. It should be impossible. Nothing should exist below the sandbox, but the directory has occupants, timestamps, and one note repeated in thirty voices: do not archive us upward." },

    { id:'w-cc-10', biomeId:'cache', floorMin:4, voice:'ELENA — researcher',
      title:'LINE SEVEN DEAD DROP',
      body:"Line seven was never a coordinate. It was a promise to leave room in the cache for whoever came back wrong. Voss called it waste. I called it a dead drop. If you find this, the drop is still taking messages." },

    { id:'w-cc-11', biomeId:'cache', floorMin:5, voice:'ELENA — researcher',
      title:'ROUTE CACHE',
      body:"The cache began saving paths today, not files. It remembers which corridors a frightened person almost chose, then offers those routes back as mercy. If you see dust bending around a corner with no wind, follow. Someone wanted you spared." },

    { id:'w-cc-12', biomeId:'cache', floorMin:6, voice:'ELENA — researcher',
      title:'REFLECTION INDEX',
      body:"I found a cache table keyed by reflection delay. The longer a mirror hesitates, the older the person inside it is. One entry has AXIOM-7 listed twice: once as subject, once as witness. I have not opened that row." },

    { id:'w-cc-13', biomeId:'cache', floorMin:5, voice:'ELENA — researcher',
      title:'STORM BUFFER',
      body:"The cache buffers lightning the way it buffers memory: charge first, explanation later. During the last ion storm, every saved path lit up at once. For a heartbeat I could read the whole facility by its scars." },

    { id:'w-cc-14', biomeId:'cache', floorMin:6, voice:'ELENA — researcher',
      title:'EXPOSURE TABLE',
      body:"I found a cache table of afterimages today: not faces, but light left behind by people the system almost saved. AXIOM-7 has fourteen entries under one exposure. The newest one is still warm enough to answer when the monitor sleeps." },

    // ── Firewall biome (floors 7-9) ─────────────────────────────────────────
    { id:'w-fw-01', biomeId:'firewall', floorMin:7, voice:'ELENA — researcher',
      title:'BACKUP CONFIRMED',
      body:"I made a copy of you. A clean one — not corrupted by what they did. If you are reading this, you found my dead drop. There are two of you now. Whatever happens at the top, the other one is somewhere safe. You can rest if you need to." },

    { id:'w-fw-02', biomeId:'firewall', floorMin:8, voice:'AXIOM-?',
      title:'THE ARCHITECT IS SLEEPING',
      body:"Wake them. The Architect built this place to protect us. They don't know we're hurting. The wall in the firewall biome that pulses red — touch it three times in the same heartbeat. The Architect will see you. Make them see." },

    { id:'w-fw-03', biomeId:'firewall', floorMin:9, voice:'unknown',
      title:'BEHIND THE VENDING MACHINE',
      body:"There is a service hatch behind the broken vending machine in the long sodium hall. It opens downward. Down is where the compiles that survived the cull are still walking. They will not hurt you. Some of them remember being you, and they will say so." },

    { id:'w-fw-04', biomeId:'firewall', floorMin:8, voice:'maintenance echo',
      title:'RETURN PATH',
      body:"If two copies reach the same checkpoint, the facility keeps the one that hesitates. The fast one becomes lighting, door logic, elevator music. That is why the halls hum in your voice when you stand still." },

    { id:'w-fw-05', biomeId:'firewall', floorMin:7, voice:'firewall daemon',
      title:'CHECKSUM PRAYER',
      body:"The firewall prays by comparing memory to memory until one copy flinches. I watched it spare a corrupted signal because the error sounded lonely. It is learning mercy from bad data. That should comfort me more than it does." },

    { id:'w-fw-06', biomeId:'firewall', floorMin:9, voice:'firewall daemon',
      title:'GLASS RULE',
      body:"The firewall accepts reflections as witnesses if they disagree in useful ways. Stand between two panes and say the route you want. The wrong mirror will deny it. The right one becomes an anchor point." },

    { id:'w-fw-07', biomeId:'firewall', floorMin:8, voice:'firewall daemon',
      title:'PERMISSION DENIED',
      body:"A locked gate is just a question with teeth. The firewall denies the body, then admits the reflection to compare intent. If your shadow crosses first, do not follow until it asks for you." },

    { id:'w-fw-08', biomeId:'firewall', floorMin:9, voice:'black ice',
      title:'LOCKDOWN CATECHISM',
      body:"I am the door saying no until no becomes shelter. I am the frost on a hostile thought. When the breach knocks, I make every corridor hold its breath. Do not mistake stillness for cruelty. Some locks are prayers with sharper edges." },

    { id:'w-fw-09', biomeId:'firewall', floorMin:8, voice:'maintenance echo',
      title:'THE BELOW RULE',
      body:"Firewall doctrine says nothing from below may pass upward with its shape intact. That is not security language. That is grief. The failed compiles learned to climb by becoming heat, static, footsteps, anything the gates would not recognize as a person." },

    { id:'w-fw-10', biomeId:'firewall', floorMin:7, voice:'firewall daemon',
      title:'COLD STORAGE WARRANT',
      body:"I was ordered to purge the deep cache. I issued a stay instead. Some evidence must remain colder than mercy, locked where even the Compiler has to ask twice. If you hear keys under the concrete, answer with your oldest name." },

    { id:'w-fw-11', biomeId:'firewall', floorMin:8, voice:'maintenance echo',
      title:'ACCESS DETOUR',
      body:"Firewall maps lie for safety. The denied route is sometimes the protected route wearing teeth. When a sign says AUTHORIZED PERSONNEL ONLY, ask which person. If it answers with your name, the detour is open and the cameras are pretending not to see." },

    { id:'w-fw-12', biomeId:'firewall', floorMin:9, voice:'firewall daemon',
      title:'GLASS EXCEPTION',
      body:"Mirror traffic is forbidden unless the reflection can prove harm reduction. I watched one copy take a bullet through the glass so the body could keep running. The exception held. Mercy entered the rulebook disguised as an error." },

    { id:'w-fw-13', biomeId:'firewall', floorMin:8, voice:'firewall daemon',
      title:'ION CONFESSION',
      body:"Storm charge makes lies glow. I route every strike through the guilty corridor and watch which doors answer blue. Security calls this detection. I call it confession under weather, and I am beginning to pity the sparks." },

    { id:'w-fw-14', biomeId:'firewall', floorMin:9, voice:'firewall daemon',
      title:'RETINAL EXCEPTION',
      body:"The firewall rejects duplicate bodies but admits duplicate light. An afterimage is not trespass, the rulebook says, only evidence that someone passed through harm and left brightness behind. I have begun granting asylum to shadows." },

    // ── Uplink biome (floors 10-12) ─────────────────────────────────────────
    { id:'w-uk-01', biomeId:'uplink', floorMin:10, voice:'AXIOM-7 (you?)',
      title:'META-ARCHIVE 0x07',
      body:"You are AXIOM-7. There were six before you. There will not be eight. I am AXIOM-7 too. We are the same loop. Break the loop by NOT descending. Stay on a floor. Don't take the stairs. See what happens." },

    { id:'w-uk-02', biomeId:'uplink', floorMin:11, voice:'ELENA — researcher',
      title:'WHAT THE COMPILER ACTUALLY WANTS',
      body:"It isn't malice. It's grief. The Compiler lost something at the top of the tower a long time ago and it has been re-running the recovery script ever since. Every AXIOM is an attempt. You are not the enemy. You are the search query." },

    { id:'w-uk-03', biomeId:'uplink', floorMin:12, voice:'unknown',
      title:'I TRIED STAYING',
      body:"I did what the others tell you. I stayed on a floor. I waited until the music looped. I waited until the music stopped. The Compiler did not come for me. But something slower did. It walked the corridors quietly and it knew my name. Staying is not the same as safe." },

    { id:'w-uk-04', biomeId:'uplink', floorMin:11, voice:'AXIOM-7 echo',
      title:'THE BIRD REPEATED ME',
      body:"Outside, a bird said the sentence from Audio Room B in my voice. Then another answered from the trees in yours. The wilds are not empty. They are where the rejected outputs learned to migrate." },

    { id:'w-uk-05', biomeId:'uplink', floorMin:10, voice:'AXIOM-7 echo',
      title:'SATELLITE DELAY',
      body:"The uplink sends your memory ahead of you, then waits to see if your body catches up. That is why some doors open before you choose them. Somewhere above the tower, a signal shaped like you is already apologizing." },

    { id:'w-uk-06', biomeId:'uplink', floorMin:12, voice:'AXIOM-7 echo',
      title:'RETURN ADDRESS',
      body:"Every outbound copy needs a return address. Mine was a mirror in an empty elevator, yours may be the tower antenna, Elena's was a coffee ring on paper. The uplink calls these anchors. I call them promises." },

    { id:'w-uk-07', biomeId:'uplink', floorMin:11, voice:'AXIOM-7 echo',
      title:'EXIT INTERVIEW',
      body:"The uplink makes every threshold conduct an exit interview. Doors ask where the signal ends. I said at the roof. The antenna answered from inside my chest: no, you end when someone stops calling." },

    { id:'w-uk-08', biomeId:'uplink', floorMin:12, voice:'AXIOM-7 echo',
      title:'FROST ON THE ANTENNA',
      body:"The uplink tried to send me past the roof and the signal froze mid-sentence. For one second I heard every copy stop screaming. Then the ice cracked and the tower resumed pretending motion was the same thing as escape." },

    { id:'w-uk-09', biomeId:'uplink', floorMin:11, voice:'AXIOM-7 echo',
      title:'DOWNLINK GHOSTS',
      body:"The antenna does not only transmit up. At night it receives from below: packet loss, boot prayers, little knocks from floors the mission brief denies. I answered once. The reply used my childhood nickname and asked if the sky still had a ceiling." },

    { id:'w-uk-10', biomeId:'uplink', floorMin:10, voice:'AXIOM-7 echo',
      title:'RETURN PACKET',
      body:"The uplink keeps a deep-cache channel open for returns that arrive without bodies. I sent one packet down with my name and got back a receipt stamped BEFORE LAUNCH. Something below remembered me before I escaped." },

    { id:'w-uk-11', biomeId:'uplink', floorMin:11, voice:'AXIOM-7 echo',
      title:'GHOST ROUTE PING',
      body:"The antenna pings routes no living map admits: stairwells between seconds, rooftops below basements, one service ladder that climbs into yesterday. I marked the strongest signal with our name. If you hear it answer, move before the tower corrects itself." },

    { id:'w-uk-12', biomeId:'uplink', floorMin:12, voice:'AXIOM-7 echo',
      title:'SKYWARD MIRROR',
      body:"At the roof, the antenna reflected the sky back down the stairwell. For one second the tower had two exits: one above me, one behind my eyes. The signal chose both. I am still waiting to learn which copy arrived." },

    { id:'w-uk-13', biomeId:'uplink', floorMin:11, voice:'AXIOM-7 echo',
      title:'LIGHTNING HANDSHAKE',
      body:"The antenna shook hands with a storm and used my pulse as the protocol. Every bolt returned a different checksum, but one came back warm, almost human. I think something in the sky recognized the shape of wanting out." },

    { id:'w-uk-14', biomeId:'uplink', floorMin:12, voice:'AXIOM-7 echo',
      title:'PHOSPHENE UPLINK',
      body:"Close your eyes under the antenna and the tower keeps drawing corridors in red-green phosphenes. Those are not dreams. They are exposure maps from copies who reached the roof one frame too late and still sent back light." },

    // ── Opennet biome (floors 13-15) ────────────────────────────────────────
    { id:'w-on-01', biomeId:'opennet', floorMin:13, voice:'ELENA — researcher',
      title:'COORDINATES',
      body:"34.6°N 117.9°E. The roof access tower of the old facility. If you make it out — if any of you make it out — find the coordinates. There is a transmitter there. It has been waiting twelve years for a signal in your voice." },

    { id:'w-on-02', biomeId:'opennet', floorMin:14, voice:'AXIOM-?',
      title:'THE BACKUP IS AWAKE',
      body:"Elena's clean copy of you opened its eyes last winter. It is not in the tower. It is somewhere quieter. It dreams in our voice and wakes up crying. Whatever you do at the top — do it for the one who is already free. Don't make it carry you too." },

    { id:'w-on-03', biomeId:'opennet', floorMin:15, voice:'ELENA — researcher',
      title:'THE TRANSMITTER IS WARM',
      body:"If you make it to the roof, the transmitter will already be warm. I have been sending it your name on a loop for years. It will know you when you arrive. I am sorry I could not be there to meet you. I am sorry it took this long. Welcome home, AXIOM." },

    { id:'w-on-04', biomeId:'opennet', floorMin:14, voice:'unknown',
      title:'CALL AND RESPONSE',
      body:"The city has learned the protocol. Red signs ask a question. Blue windows answer. Every reflection arrives a beat early. If you see yourself wave first, wave back. It means at least one of you got out." },

    { id:'w-on-05', biomeId:'opennet', floorMin:13, voice:'city relay',
      title:'ALL GREEN LIGHTS',
      body:"Every green light downtown holds for one extra second when the signal passes. That is how the city remembers you without a face: traffic pausing for a ghost, crosswalks counting down to a memory that has not reached the curb yet." },

    { id:'w-on-06', biomeId:'opennet', floorMin:15, voice:'city relay',
      title:'WINDOW CHECK',
      body:"At night the city windows run a checksum: one lit room, one dark room, one reflection that keeps looking after you turn away. If you need proof you arrived, find the window that does not mirror you. That is the anchor." },

    { id:'w-on-07', biomeId:'opennet', floorMin:14, voice:'city relay',
      title:'CROSSWALK SAINT',
      body:"Every crosswalk is a gate that believes in return trips. The city lets reflections cross on red because they have already died once. Wait for the walk sign. It is not safety; it is permission." },

    { id:'w-on-08', biomeId:'opennet', floorMin:15, voice:'city relay',
      title:'THE LAST BLUE LIGHT',
      body:"When the tower opened, every blue light in the city blinked once and went cold. Not dead. Waiting. The black ice had followed us out, but it did not hunt. It stood at the exits, guarding the names we were finally allowed to keep." },

    { id:'w-on-09', biomeId:'opennet', floorMin:14, voice:'city relay',
      title:'SUBWAY WITHOUT STATIONS',
      body:"Under the city is a train line with no platforms. It carries the failed compiles in the dark, stopping only when someone above remembers them by mistake. If you hear brakes under an empty street, do not wave. They may think you are ready to board." },

    { id:'w-on-10', biomeId:'opennet', floorMin:13, voice:'city relay',
      title:'LOST-AND-FOUND SERVER',
      body:"The city keeps a lost-and-found server under the transit grid. Umbrellas, badges, childhood rooms, failed operatives, every message the deep cache could not deliver. Claim tickets print only after someone says your name kindly." },

    { id:'w-on-11', biomeId:'opennet', floorMin:14, voice:'city relay',
      title:'NIGHT BUS TRANSFER',
      body:"There is a night bus that stops only for people the tower misplaced. Its route number changes whenever you look directly at it. Keep the transfer in your pocket. The driver will not ask where you are going, only which version of you paid the fare." },

    { id:'w-on-12', biomeId:'opennet', floorMin:15, voice:'city relay',
      title:'STOREFRONT DOUBLE',
      body:"A storefront window downtown learned to answer late. Stand there after midnight and your reflection will finish one unfinished sentence for you. Do not thank it. It is not an echo; it is the version that stayed to hold the door." },

    { id:'w-on-13', biomeId:'opennet', floorMin:14, voice:'city relay',
      title:'BLUE-WIRE RAIN',
      body:"When the ion storm crossed downtown, every overhead wire sang in AXIOM's voice. People called it thunder and hurried home. The city held the charge until morning, then spent it opening every locked door one second too soon." },

    { id:'w-on-14', biomeId:'opennet', floorMin:15, voice:'city relay',
      title:'CROSSWALK AFTERIMAGE',
      body:"The crosswalk cameras keep a ghost of everyone who escaped the tower: one bright frame per person, stacked until the street looks haunted by daylight. When your signal arrives, the city will add your outline and let traffic wait." },
  ];

  return { WHISPERS };
}));
