STY = "16-bit SNES-era Japanese RPG pixel art, crisp pixels, clean dark outlines, vibrant warm palette"
TILE = STY + (". A single square top-down terrain tile texture that fills the ENTIRE square canvas edge to edge, "
              "seamless and tileable when repeated, simple readable pattern with large chunky pixels (as if a 32x32 pixel tile was upscaled), "
              "no border, no frame, no text, no objects, flat even lighting. Square 1024x1024.")
SPR = STY + (". Plain solid flat pure magenta (#FF00FF) background everywhere around the subjects, no shadows on the background, "
             "no gradient, no ground, no text. Do not use magenta or pink colors inside the sprites.")
BG = STY + ". A battle background scene for a JRPG, wide landscape: "
BGE = " No characters, no text. Landscape 1536x1024."
GRID3 = " Each facing the viewer, full body, centered in its own cell with lots of magenta space, same scale. Square 1024x1024."

jobs = {
 "t_grass": TILE + " Subject: short lush green grass with a few tiny darker tufts.",
 "t_dirt": TILE + " Subject: light brown packed dirt road with small pebbles.",
 "t_sand": TILE + " Subject: golden desert sand with subtle wind ripples.",
 "t_snow": TILE + " Subject: soft white-blue snow ground with faint sparkles.",
 "t_water": TILE + " Subject: deep blue ocean water with small white wave highlights.",
 "t_swamp": TILE + " Subject: toxic purple-green poison swamp with bubbles.",
 "t_lava": TILE + " Subject: glowing orange-red molten lava with dark crust cracks.",
 "t_stonefloor": TILE + " Subject: grey stone dungeon floor made of square flagstones with dark grout lines.",
 "t_stonewall": TILE + " Subject: dark grey-blue rough stone brick dungeon wall seen from the front, heavy and solid.",
 "t_cobble": TILE + " Subject: warm beige cobblestone town street.",
 "t_wood": TILE + " Subject: warm brown wooden floor planks running horizontally.",
 "t_brick": TILE + " Subject: red-brown brick building wall with cream mortar.",
 "t_ice": TILE + " Subject: pale cyan slippery ice floor with white cracks and shine.",
 "t_carpet": TILE + " Subject: deep royal red carpet with a thin gold woven pattern.",
 "t_bridge": TILE + " Subject: wooden bridge planks running horizontally across, viewed from above, with rope edges at top and bottom.",
 "s_heroes": SPR + (" A character sprite sheet laid out as a 3 columns by 2 rows grid of six separate cute chibi fantasy adventurers, "
   "each standing facing the viewer in full body, each well separated with lots of magenta space between them, same size and scale. "
   "Top row left to right: a warrior with red armor and a big sword; a knight in silver plate armor with a blue cape and a round shield; "
   "a mage with a tall pointed deep-blue hat and a staff. Bottom row left to right: a priest in white and gold robes with a holy staff; "
   "a thief with a green hood, scarf and daggers; a martial artist with orange gi, headband and wrapped fists. Square 1024x1024."),
 "s_npcs": SPR + (" A sprite sheet as a 4 columns by 2 rows grid of eight separate cute chibi town NPC characters standing facing the viewer, "
   "full body, each well separated with magenta space, same scale. Top row: a young villager man in a tunic; a villager woman with an apron "
   "and headscarf; a bearded old elder with a cane; a small child. Bottom row: a plump merchant shopkeeper; a town guard with a spear and helmet; "
   "a serene priestess sage holding a lantern; a sailor with a striped shirt. Square 1024x1024."),
 "s_objects1": SPR + (" A sprite sheet as a 4 columns by 4 rows grid of sixteen separate top-down RPG map objects, each object centered in its own cell "
   "with magenta space between them, all same scale. Row 1: a round leafy green tree; a snowy dark green pine tree; a rocky brown mountain peak; "
   "a round grey boulder. Row 2: a closed wooden treasure chest with gold trim; the same chest opened and empty; a dark stone staircase going down "
   "into a hole; a stone staircase going up. Row 3: a wooden door in a stone frame; a heavy iron door with a big golden keyhole; a round stone floor "
   "switch with a red button raised; the same floor switch pressed down glowing green. Row 4: a tiny village of three small houses (map icon); "
   "a cave entrance in a rocky hill (map icon); a tall stone tower (map icon); a dark castle with a violet glow (map icon). Square 1024x1024."),
 "s_objects2": SPR + (" A sprite sheet as a 4 columns by 4 rows grid of sixteen separate top-down RPG map objects, each centered in its own cell with "
   "magenta space between them, same scale. Row 1: a short wooden fence segment; a small flower bed with colorful flowers; a wooden shop counter; "
   "a cozy bed with a blue blanket. Row 2: a round stone water well; a wooden signpost; a glowing blue crystal cluster; a stone altar pedestal. "
   "Row 3: a stone guardian statue; a lit iron brazier with flame; a wooden barrel; a tall bookshelf full of books. Row 4: a swirling violet magic "
   "portal; a green desert cactus; a palm tree; a grey tombstone. Square 1024x1024."),
 "s_orbs": SPR + (" Six separate glowing magical crystal orbs arranged in a 3 columns by 2 rows grid, each well separated with magenta space. "
   "Top row: emerald green wind orb; golden yellow earth orb; sapphire blue water orb. Bottom row: ruby red fire orb; shining white star orb; "
   "deep violet moon orb. Each orb sits in a small golden setting. Square 1024x1024."),
 "s_enemies1": SPR + (" A monster sprite sheet as a 3 columns by 3 rows grid of nine separate cute but menacing original fantasy monsters."
   " Row 1: a round blue jelly blob with big eyes; a spiky brown rat with a thorny back; a pecking black-and-orange bird with a sharp beak."
   " Row 2: a red-capped mushroom creature with spores; a fat green caterpillar with purple poison spots; a small bat with big ears."
   " Row 3: a small rock golem made of stacked stones; a sand-colored coiled snake; a black armored scorpion." + GRID3),
 "s_enemies2": SPR + (" A monster sprite sheet as a 3 columns by 3 rows grid of nine separate original fantasy monsters."
   " Row 1: a small mummy wrapped in bandages; a mischievous wind sprite made of swirling green air; an armored red crab with big claws."
   " Row 2: a stone gargoyle with wings; a floating blue will-o-wisp flame with a face; a fishman soldier with a trident."
   " Row 3: a translucent cyan jellyfish with tentacles; a giant warty toad; a red fire lizard with flames on its tail." + GRID3),
 "s_enemies3": SPR + (" A monster sprite sheet as a 3 columns by 3 rows grid of nine separate original fantasy monsters."
   " Row 1: a bubbling orange lava blob; a horned red fire ogre with a club; a water elemental spirit made of flowing water."
   " Row 2: a white snow wolf; an ice witch in pale blue robes; a snowman soldier with a helmet and spear."
   " Row 3: an icy crystal moth; a skeleton swordsman with a rusty sword and shield; a hooded dark wraith with ghostly claws." + GRID3),
 "s_enemies4": SPR + (" A monster sprite sheet as a 3 columns by 3 rows grid of nine separate original fantasy monsters."
   " Row 1: an empty haunted suit of armor with glowing eyes; a shadow demon with bat wings; a dark wyvern dragon."
   " Row 2: a floating giant eyeball with small tentacles; an eerie upside-down angel with black feathers; twin shadow children holding hands."
   " Row 3: a chimera made of void and stars; a golden treasure mimic chest with teeth; a mechanical clockwork owl." + GRID3),
 "b_wolf": SPR + " One single large boss monster centered: a giant ancient forest wolf covered in moss and vines with glowing green eyes and huge fangs, menacing pose, full body facing the viewer. Square 1024x1024.",
 "b_scorpion": SPR + " One single large boss monster centered: a giant golden desert scorpion king with a jeweled crown, huge pincers and a dripping poison stinger, full body facing the viewer. Square 1024x1024.",
 "b_serpent": SPR + " One single large boss monster centered: a colossal deep-sea serpent dragon with teal scales, fins and glowing eyes rising up, full body facing the viewer. Square 1024x1024.",
 "b_dragon": SPR + " One single large boss monster centered: a fire dragon with one great horn, molten cracks on its black scales and flames around it, full body facing the viewer. Square 1024x1024.",
 "b_prism": SPR + " One single large boss monster centered: a crystal guardian golem made of clear prism shards with a large multicolored rainbow crystal core in its chest, full body facing the viewer. Square 1024x1024.",
 "b_knight": SPR + " One single large boss monster centered: a black armored graveyard knight with a tattered violet cape, a huge greatsword and a ghostly blue flame inside the helmet, full body facing the viewer. Square 1024x1024.",
 "b_yomi1": SPR + " One single large final boss centered: the Eclipse King, a tall regal crow-headed sorcerer in black and gold robes holding a staff topped with a dark eclipsed sun, black feathered wings spread, full body facing the viewer. Square 1024x1024.",
 "b_yomi2": SPR + " One single large final boss centered: the true form of the Eclipse King, a gigantic monstrous black raven demon with three glowing eyes, an eclipsed sun ring behind it, wings full of stars, terrifying, full body facing the viewer. Square 1024x1024.",
 "b_amnes": SPR + " One single large secret superboss centered: the Lightless King, a hollow faceless void entity in a tattered white and black royal robe with a broken dim crown and pale hands, surrounded by extinguished floating lanterns, eerie and majestic, full body facing the viewer. Square 1024x1024.",
 "bg_plains": BG + "sunny green grassland with distant hills and blue sky with clouds, ground in the lower third." + BGE,
 "bg_cave": BG + "a mossy forest cave interior with roots and glowing mushrooms." + BGE,
 "bg_desert": BG + "a hot desert with sand dunes and an old sandstone tower far in the distance." + BGE,
 "bg_temple": BG + "a sunken underwater temple with blue stone pillars, water light rays and bubbles." + BGE,
 "bg_volcano": BG + "a volcanic crater with rivers of lava and dark rocks under a red sky." + BGE,
 "bg_snow": BG + "a frozen snowfield with ice crystals and pine trees under a pale sky." + BGE,
 "bg_grave": BG + "a moonlit haunted graveyard with a ruined chapel and fog." + BGE,
 "bg_tower": BG + "the top of a dark eclipse tower above the clouds, a black sun with a glowing ring in the sky." + BGE,
 "bg_reverse": BG + "an eerie inverted world with upside-down floating islands, a violet starry sky and extinguished lanterns drifting." + BGE,
 "title": STY + (". Title screen key art for an original JRPG: a young lanternkeeper hero seen from behind on a cliff holding a glowing lantern, "
   "looking at a night sky where six colored lights (green, yellow, blue, red, white, violet) float around a dark eclipsed sun, "
   "a small lighthouse village below, dramatic and beautiful, no text, no letters. Landscape 1536x1024."),
}
with open("jobs.tsv", "w", encoding="utf-8") as f:
    for k, v in jobs.items():
        f.write(k + "\t" + v.replace("\t", " ") + "\n")
print(len(jobs))
