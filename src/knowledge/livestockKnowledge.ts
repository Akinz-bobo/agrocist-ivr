/**
 * Nigerian Livestock Knowledge Database
 * Updated: 2024 - Prices in Nigerian Naira (₦)
 * 
 * Instructions for updating data:
 * 1. Update prices quarterly or when significant market changes occur
 * 2. Add new products/breeds as they become available
 * 3. Include regional variations where applicable
 * 4. Verify information with reliable agricultural sources
 */

export const livestockKnowledge = {
  // POULTRY FEEDS
  "chicken_feed": `
POULTRY FEED INFORMATION (Nigeria - 2024):

BROILER FEEDS:
- Broiler Starter (0-4 weeks): ₦25,000-28,000/50kg, 22-24% protein, feed 2kg/day per 100 birds
- Broiler Finisher (5-8 weeks): ₦23,500-26,000/50kg, 18-20% protein, feed 3-4kg/day per 100 birds
- Pre-Starter (0-10 days): ₦30,000-35,000/50kg, 28% protein, 15-20g per chick daily

LAYER FEEDS:
- Layer Mash (18+ weeks): ₦22,000-25,000/50kg, 16-17% protein, 120-130g per bird daily
- Pullet Grower (9-17 weeks): ₦20,000-23,000/50kg, 15-16% protein, 80-100g per bird daily
- Layer Concentrate: ₦35,000-40,000/50kg, mix with grains 1:3 ratio

OTHER FEEDS:
- Chick Mash (0-6 weeks): ₦26,000-30,000/50kg, 20-21% protein
- Cockerel Feed: ₦24,000-27,000/50kg, 18-19% protein
- Turkey Feed: ₦28,000-32,000/50kg, 20-22% protein

POPULAR BRANDS: Vital Feed, Top Feed, Crown Feed, Grand Cereals, Chi Feed, Pfizer Feed
AVAILABLE: Lagos, Abuja, Kano, Port Harcourt, Ibadan, Jos, Kaduna
`,

  "day_old_chicks": `
DAY-OLD CHICK PRICES (Nigeria - 2024):

BROILER CHICKS:
- Cobb 500: ₦800-1,200 each (fast growth, good conversion)
- Ross 308: ₦850-1,300 each (excellent meat quality)
- Arbor Acres: ₦900-1,400 each (premium breed)
- Marshall: ₦700-1,000 each (local strain)

LAYER CHICKS:
- Isa Brown: ₦600-900 each (high egg production)
- Lohmann Brown: ₦650-950 each (excellent layers)
- Bovans Brown: ₦700-1,000 each (hardy breed)
- Harco: ₦550-800 each (dual purpose)

OTHER POULTRY:
- Cockerel chicks: ₦500-800 each
- Turkey poults: ₦2,000-3,500 each
- Duck ducklings: ₦800-1,500 each
- Guinea fowl keets: ₦600-1,200 each

MAJOR SUPPLIERS: Chi Farms, Amo Farm, Zartech, Animal Care, Obasanjo Farms, Tuns Farm
VACCINATION: ₦50-100 per chick (Marek's, Newcastle, Gumboro)
MINIMUM ORDER: Usually 100 chicks, some farms sell smaller quantities
`,

  "chicken_drugs": `
POULTRY DRUGS & VACCINES (Nigeria - 2024):

VACCINES:
- Newcastle Disease: ₦8,000-12,000/1000 doses (mandatory)
- Infectious Bursal Disease (Gumboro): ₦10,000-15,000/1000 doses
- Fowl Pox: ₦7,000-11,000/1000 doses
- Infectious Bronchitis: ₦9,000-14,000/1000 doses
- Marek's Disease: ₦12,000-18,000/1000 doses

ANTIBIOTICS:
- Oxytetracycline 20%: ₦2,500-4,000/100g
- Tylosin 10%: ₦3,500-5,500/100g
- Enrofloxacin 10%: ₦4,000-6,500/100ml
- Amoxicillin: ₦3,000-5,000/100g
- Gentamicin: ₦2,800-4,200/100ml

SUPPLEMENTS & TREATMENTS:
- Multivitamins: ₦4,000-8,000/kg
- Coccidiostat: ₦3,000-6,000/kg (prevent coccidiosis)
- Dewormer (Levamisole): ₦5,000-10,000/litre
- Calcium supplements: ₦2,000-4,000/kg
- Probiotics: ₦6,000-12,000/kg
- Stress relievers: ₦3,500-7,000/kg

BRANDS: Pfizer, Zoetis, Kepro, Neimeth, Ashish Life Sciences
DOSAGE: Follow vet prescription - overdosing can be harmful
`,

  // CATTLE/COW RELATED
  "cattle_feed": `
CATTLE FEED & SUPPLEMENTS (Nigeria - 2024):

CONCENTRATES:
- Dairy Concentrate (16% protein): ₦18,000-22,000/50kg
- Beef Fattening Concentrate (14% protein): ₦16,000-20,000/50kg
- Grower Mash (12% protein): ₦15,000-18,000/50kg
- Calf Starter (20% protein): ₦25,000-30,000/50kg

ROUGHAGE & FORAGES:
- Hay (guinea grass): ₦2,000-4,000/bale (25kg)
- Silage: ₦150-300/kg
- Fresh grass cutting service: ₦5,000-8,000/truck load
- Maize stover: ₦1,500-2,500/bale

SUPPLEMENTS:
- Salt lick blocks: ₦3,000-5,000/block (2kg)
- Mineral premix: ₦8,000-15,000/kg
- Urea molasses blocks: ₦4,000-7,000/block
- Bone meal: ₦6,000-10,000/25kg

FEEDING GUIDE:
- Adult cow: 2-3kg concentrate + 10-15kg roughage daily
- Lactating cow: 4-6kg concentrate + 15-20kg roughage daily
- Growing cattle: 1-2kg concentrate + 6-10kg roughage daily
- Calves: 1-2kg starter + milk/milk replacer

BRANDS: Vital Feed, Flour Mills Feed, UAC Feeds, Olam Feeds
`,

  "cattle_prices": `
CATTLE PRICES (Nigeria - 2024):

CALVES (0-6 months):
- Holstein Friesian: ₦150,000-300,000
- Jersey: ₦120,000-250,000
- Sahiwal: ₦100,000-200,000
- Local breeds: ₦80,000-150,000

YOUNG CATTLE (6 months - 2 years):
- Heifers (Holstein): ₦300,000-600,000
- Bulls (Holstein): ₦400,000-800,000
- Local breeds: ₦200,000-400,000

MATURE CATTLE (2+ years):
- Dairy cows (in milk): ₦600,000-1,500,000
- Pregnant heifers: ₦500,000-1,200,000
- Breeding bulls: ₦800,000-2,000,000
- Beef cattle: ₦400,000-1,000,000

FACTORS AFFECTING PRICE:
- Breed (exotic breeds more expensive)
- Age and weight
- Pregnancy status
- Milk production record
- Health status
- Location (North generally cheaper)

MAJOR MARKETS: Maigatari (Jigawa), Potiskum (Yobe), Jos Plateau, Ogun State farms
`,

  "cattle_drugs": `
CATTLE DRUGS & TREATMENTS (Nigeria - 2024):

VACCINES:
- Contagious Bovine Pleuropneumonia (CBPP): ₦1,500-2,500/dose
- Foot and Mouth Disease: ₦2,000-3,500/dose  
- Blackleg (Clostridial): ₦1,800-3,000/dose
- Anthrax: ₦1,200-2,200/dose
- Brucellosis (RB51): ₦2,500-4,000/dose

DEWORMERS:
- Ivermectin 1%: ₦8,000-15,000/500ml
- Albendazole 10%: ₦6,000-12,000/500ml
- Levamisole 7.5%: ₦5,000-10,000/500ml
- Closantel 5%: ₦10,000-18,000/500ml

ANTIBIOTICS:
- Oxytetracycline LA: ₦15,000-25,000/500ml
- Penicillin/Streptomycin: ₦8,000-15,000/500ml
- Tylosin 20%: ₦20,000-35,000/500ml

OTHER TREATMENTS:
- Tick/lice sprays: ₦3,000-8,000/litre
- Wound sprays: ₦2,500-5,000/500ml
- Multivitamins: ₦12,000-25,000/500ml
- Calcium borogluconate: ₦8,000-15,000/500ml (milk fever)

DOSAGE: Based on body weight - consult veterinarian
`,

  // GOAT RELATED
  "goat_feed": `
GOAT FEED & SUPPLEMENTS (Nigeria - 2024):

CONCENTRATES:
- Goat Pellets (16% protein): ₦20,000-25,000/50kg
- Grower Mash (14% protein): ₦18,000-22,000/50kg  
- Kid Starter (18% protein): ₦22,000-28,000/50kg
- Pregnant/Lactating doe feed: ₦24,000-30,000/50kg

FORAGES:
- Legume hay (groundnut): ₦3,000-5,000/bale
- Grass hay: ₦2,000-3,500/bale
- Fresh browse: ₦100-200/kg
- Cassava peels (dried): ₦1,000-2,000/50kg

SUPPLEMENTS:
- Mineral premix: ₦6,000-12,000/kg
- Salt licks: ₦2,000-4,000/block
- Bone meal: ₦4,000-8,000/25kg
- Palm kernel cake: ₦8,000-12,000/50kg

FEEDING GUIDE:
- Adult goat: 200-300g concentrate + 2-3kg roughage daily
- Pregnant doe: 300-500g concentrate + quality roughage
- Lactating doe: 400-600g concentrate + 3-4kg roughage
- Kids: 50-150g starter + milk + quality hay

BROWSE PLANTS: Moringa, Leucaena, Gliricidia, Centrosema (natural feeds)
`,

  "goat_prices": `
GOAT PRICES (Nigeria - 2024):

KIDS (1-4 months):
- WAD (West African Dwarf): ₦15,000-25,000
- Red Sokoto: ₦20,000-35,000
- Boer cross: ₦30,000-50,000
- Saanen cross: ₦25,000-40,000

YOUNG GOATS (4-12 months):
- WAD: ₦30,000-50,000
- Red Sokoto: ₦40,000-70,000
- Boer cross: ₦60,000-100,000
- Anglo-Nubian: ₦50,000-80,000

ADULT GOATS (1+ years):
- WAD does: ₦45,000-80,000
- WAD bucks: ₦60,000-120,000
- Red Sokoto does: ₦60,000-100,000
- Red Sokoto bucks: ₦80,000-150,000
- Boer cross does: ₦100,000-200,000
- Boer cross bucks: ₦150,000-300,000

PREGNANT DOES: Add ₦20,000-40,000 to base price
BREEDING BUCKS: Premium prices - up to ₦500,000 for pure breeds

BEST MARKETS: Sokoto, Katsina, Kano (North), Ogun, Oyo (Southwest)
FACTORS: Breed, size, health, pregnancy, season (high during festivals)
`,

  "goat_drugs": `
GOAT DRUGS & TREATMENTS (Nigeria - 2024):

VACCINES:
- PPR (Peste des Petits Ruminants): ₦800-1,500/dose
- Contagious Caprine Pleuropneumonia: ₦1,000-1,800/dose
- Anthrax: ₦800-1,400/dose
- Clostridial diseases: ₦1,200-2,000/dose

DEWORMERS:
- Ivermectin 1%: ₦8,000-15,000/500ml
- Albendazole 2.5%: ₦5,000-10,000/500ml  
- Levamisole 7.5%: ₦4,000-8,000/500ml
- Closantel 5%: ₦8,000-15,000/500ml

ANTIBIOTICS:
- Oxytetracycline LA: ₦12,000-20,000/500ml
- Penicillin/Streptomycin: ₦6,000-12,000/500ml
- Tylosin 5%: ₦8,000-15,000/500ml

SUPPLEMENTS:
- Multivitamins: ₦8,000-15,000/500ml
- Iron supplements: ₦5,000-10,000/500ml
- Calcium supplements: ₦4,000-8,000/500ml
- Anti-bloat: ₦3,000-6,000/500ml

EXTERNAL TREATMENTS:
- Tick sprays: ₦2,500-5,000/litre
- Wound sprays: ₦2,000-4,000/500ml
- Disinfectants: ₦1,500-3,000/litre

DOSAGE: 1ml per 10kg body weight (varies by product)
`,

  // SHEEP RELATED  
  "sheep_feed": `
SHEEP FEED & SUPPLEMENTS (Nigeria - 2024):

CONCENTRATES:
- Sheep Pellets (14-16% protein): ₦19,000-24,000/50kg
- Grower Mash: ₦17,000-21,000/50kg
- Lamb Creep Feed (18% protein): ₦23,000-28,000/50kg
- Pregnant/Lactating ewe feed: ₦22,000-27,000/50kg

FORAGES:
- Legume hay (cowpea): ₦3,500-5,500/bale
- Rhodes grass hay: ₦2,500-4,000/bale
- Guinea grass hay: ₦2,000-3,500/bale
- Groundnut haulms: ₦2,500-4,500/bale

SUPPLEMENTS:
- Sheep mineral mix: ₦7,000-13,000/kg
- Urea molasses blocks: ₦3,500-6,000/block
- Salt licks: ₦2,500-4,500/block
- Limestone: ₦1,500-3,000/50kg

FEEDING GUIDE:
- Adult sheep: 300-500g concentrate + 2-4kg roughage daily
- Pregnant ewe: 400-600g concentrate + quality forage
- Lactating ewe: 500-800g concentrate + 3-5kg roughage  
- Lambs: 100-200g creep feed + milk + hay

NATURAL BROWSE: Acacia pods, Ficus leaves, Baobab leaves (free range)
`,

  "sheep_prices": `
SHEEP PRICES (Nigeria - 2024):

LAMBS (1-4 months):
- WAD (West African Dwarf): ₦18,000-30,000
- Yankasa: ₦25,000-40,000  
- Balami: ₦30,000-50,000
- Uda: ₦35,000-55,000

YOUNG SHEEP (4-12 months):
- WAD: ₦35,000-60,000
- Yankasa: ₦50,000-80,000
- Balami: ₦65,000-110,000
- Uda: ₦70,000-120,000

ADULT SHEEP (1+ years):
- WAD ewes: ₦50,000-90,000
- WAD rams: ₦70,000-140,000
- Yankasa ewes: ₦80,000-130,000
- Yankasa rams: ₦120,000-200,000
- Balami ewes: ₦100,000-180,000
- Balami rams: ₦150,000-280,000
- Uda ewes: ₦120,000-200,000
- Uda rams: ₦180,000-350,000

PREGNANT EWES: Add ₦25,000-45,000 to base price
BREEDING RAMS: Premium genetics can reach ₦500,000+

MAJOR MARKETS: Sokoto, Katsina, Kebbi (North), Lagos, Ibadan (Southwest)
SEASONAL VARIATION: Prices peak during Eid festivals
`,

  "sheep_drugs": `
SHEEP DRUGS & TREATMENTS (Nigeria - 2024):

VACCINES:
- PPR (Peste des Petits Ruminants): ₦900-1,600/dose
- Sheep/Goat Pox: ₦1,100-2,000/dose
- Anthrax: ₦900-1,500/dose
- Enterotoxaemia: ₦1,000-1,800/dose

DEWORMERS:
- Ivermectin 1%: ₦8,000-15,000/500ml
- Albendazole 2.5%: ₦5,500-11,000/500ml
- Fenbendazole 5%: ₦7,000-13,000/500ml
- Closantel 5%: ₦9,000-16,000/500ml

ANTIBIOTICS:  
- Long Acting Oxytetracycline: ₦13,000-22,000/500ml
- Penicillin/Streptomycin: ₦7,000-13,000/500ml
- Tylosin 10%: ₦10,000-18,000/500ml

SUPPLEMENTS & TREATMENTS:
- Multivitamins (AD3E): ₦9,000-16,000/500ml
- Iron/B-complex: ₦6,000-12,000/500ml
- Anti-bloat medication: ₦3,500-7,000/500ml
- Wound care sprays: ₦2,500-5,000/500ml

EXTERNAL PARASITES:
- Tick/lice dips: ₦3,000-6,000/litre
- Pour-on treatments: ₦8,000-15,000/500ml

DOSAGE: Generally 1ml per 15-20kg body weight
FREQUENCY: Deworming every 3-4 months, vaccines annually
`,

  // PIG RELATED
  "pig_feed": `
PIG FEED & SUPPLEMENTS (Nigeria - 2024):

STARTER FEEDS:
- Piglet Pre-starter (0-3 weeks): ₦35,000-45,000/50kg, 22-24% protein
- Piglet Starter (3-8 weeks): ₦30,000-38,000/50kg, 20-22% protein

GROWER FEEDS:
- Grower Feed (8-16 weeks): ₦25,000-32,000/50kg, 16-18% protein  
- Finisher Feed (16 weeks-market): ₦23,000-29,000/50kg, 14-16% protein

BREEDING FEEDS:
- Pregnant Sow Feed: ₦28,000-35,000/50kg, 16-18% protein
- Lactating Sow Feed: ₦32,000-40,000/50kg, 18-20% protein
- Boar Feed: ₦30,000-37,000/50kg, 16-18% protein

FEEDING QUANTITIES:
- Piglets (weaned): 0.5-1kg daily
- Growers: 1.5-2.5kg daily  
- Finishers: 2.5-3.5kg daily
- Pregnant sows: 2-3kg daily
- Lactating sows: 4-6kg daily + 0.5kg per piglet
- Boars: 2.5-3.5kg daily

SUPPLEMENTS:
- Pig premix: ₦8,000-15,000/kg
- Lysine: ₦12,000-20,000/kg
- Methionine: ₦15,000-25,000/kg
- Limestone: ₦2,000-4,000/50kg

BRANDS: Vital Feed, Top Feed, Olam Feed, Multi Grains, Chi Feed
AVAILABILITY: Lagos, Ogun, Oyo, Delta, Rivers states
`,

  "pig_prices": `
PIG PRICES (Nigeria - 2024):

PIGLETS (6-8 weeks):
- Large White: ₦25,000-40,000 each
- Landrace: ₦28,000-45,000 each
- Duroc: ₦30,000-50,000 each
- Hampshire: ₦35,000-55,000 each
- Local breeds: ₦15,000-25,000 each

WEANERS (8-12 weeks):
- Large White: ₦35,000-55,000 each
- Landrace: ₦40,000-65,000 each  
- Duroc: ₦45,000-70,000 each
- Crossbreeds: ₦30,000-50,000 each

GROWERS/FINISHERS (3-6 months):
- 40-60kg: ₦80,000-120,000 each
- 60-80kg: ₦120,000-180,000 each
- 80-100kg: ₦180,000-250,000 each

BREEDING STOCK:
- Pregnant gilts: ₦150,000-300,000 each
- Proven sows: ₦200,000-400,000 each
- Boars (6-12 months): ₦200,000-500,000 each
- Mature boars: ₦300,000-800,000 each

FACTORS AFFECTING PRICE:
- Breed (exotic more expensive than local)
- Weight and age
- Health status and vaccination record
- Pregnancy status
- Genetic quality
- Location and demand

MAJOR MARKETS: Lagos, Ogun, Oyo, Delta, Imo, Abia states
LIVE WEIGHT PRICE: ₦2,000-3,000 per kg
`,

  "pig_drugs": `
PIG DRUGS & TREATMENTS (Nigeria - 2024):

VACCINES:
- Classical Swine Fever: ₦2,000-3,500/dose
- Foot and Mouth Disease: ₦2,500-4,000/dose
- Swine Erysipelas: ₦1,800-3,200/dose
- Porcine Parvovirus: ₦2,200-3,800/dose
- PRRS (where available): ₦3,500-5,500/dose

ANTIBIOTICS:
- Long Acting Oxytetracycline: ₦15,000-25,000/500ml
- Penicillin/Streptomycin: ₦8,000-15,000/500ml
- Enrofloxacin 10%: ₦20,000-35,000/500ml
- Tylosin 20%: ₦18,000-30,000/500ml
- Tiamulin 10%: ₦22,000-38,000/500ml

DEWORMERS:
- Ivermectin 1%: ₦10,000-18,000/500ml
- Fenbendazole 5%: ₦8,000-15,000/500ml
- Doramectin: ₦15,000-25,000/500ml
- Levamisole 7.5%: ₦6,000-12,000/500ml

SUPPLEMENTS:
- Iron injection (for piglets): ₦5,000-10,000/500ml
- Multivitamins: ₦12,000-20,000/500ml
- Electrolytes: ₦8,000-15,000/kg
- Probiotics: ₦15,000-25,000/kg

OTHER TREATMENTS:
- Anti-diarrheal: ₦10,000-18,000/500ml
- Respiratory treatments: ₦15,000-25,000/500ml
- Disinfectants: ₦3,000-8,000/litre

DOSAGE: Based on body weight - typically 1ml per 10-20kg
WITHDRAWAL PERIOD: Follow label instructions before slaughter
`,

  // FISH RELATED
  "fish_feed": `
FISH FEED & SUPPLEMENTS (Nigeria - 2024):

CATFISH FEEDS:
- Floating Feed (32% protein): ₦28,000-35,000/50kg
- Sinking Feed (30% protein): ₦25,000-32,000/50kg
- Juvenile Feed (35% protein): ₦32,000-40,000/50kg
- Fingerling Feed (40% protein): ₦38,000-48,000/50kg
- Broodstock Feed (42% protein): ₦45,000-55,000/50kg

TILAPIA FEEDS:
- Tilapia Grower (28% protein): ₦26,000-33,000/50kg
- Tilapia Finisher (25% protein): ₦23,000-30,000/50kg
- Tilapia Starter (35% protein): ₦35,000-42,000/50kg

FEED SIZES:
- 0.5mm (fry): ₦40,000-50,000/50kg
- 1.5mm (fingerlings): ₦35,000-45,000/50kg  
- 2mm (juveniles): ₦32,000-40,000/50kg
- 3mm (table size): ₦28,000-35,000/50kg
- 4.5mm (broodstock): ₦30,000-38,000/50kg

FEEDING GUIDE:
- Fingerlings: 8-10% body weight daily
- Juveniles: 5-7% body weight daily
- Table size: 3-5% body weight daily
- Broodstock: 2-3% body weight daily

SUPPLEMENTS:
- Premix: ₦10,000-18,000/kg
- Vitamin C: ₦8,000-15,000/kg
- Probiotics: ₦20,000-35,000/kg

BRANDS: Coppens, Skretting, Multi Feeds, Chi Aqua, Vital Aqua Feed
STORAGE: Keep dry, use within 3 months of production
`,

  "fish_prices": `
FISH PRICES (Nigeria - 2024):

CATFISH:
- Fingerlings (5-8cm): ₦30-50 each
- Juveniles (8-12cm): ₦80-120 each
- Table size (300-500g): ₦800-1,200 each
- Broodstock (1-3kg): ₦3,000-8,000 each
- Jumbo catfish (3-5kg): ₦8,000-15,000 each

TILAPIA:
- Fingerlings (3-5cm): ₦25-40 each
- Juveniles (5-8cm): ₦60-100 each  
- Table size (200-350g): ₦500-800 each
- Broodstock (500g-1kg): ₦1,500-3,500 each

OTHER SPECIES:
- Heterobranchus fingerlings: ₦40-60 each
- Heterotis fingerlings: ₦50-80 each
- Hybrid catfish fingerlings: ₦35-55 each

PROCESSED FISH:
- Smoked catfish: ₦3,500-5,000/kg
- Fresh catfish: ₦2,200-3,200/kg
- Dried fish: ₦8,000-12,000/kg

FACTORS AFFECTING PRICE:
- Size and weight
- Species and strain
- Season (rainy season cheaper)
- Location (rural cheaper than urban)
- Health and survival rate

MAJOR SUPPLIERS: Lagos, Ogun, Oyo, Delta, Cross River states
LIVE FISH PRICE: ₦2,000-2,800 per kg (wholesale)
`,

  "fish_drugs": `
FISH DRUGS & TREATMENTS (Nigeria - 2024):

ANTIBIOTICS:
- Oxytetracycline (water soluble): ₦8,000-15,000/500g
- Florfenicol: ₦20,000-35,000/500g
- Enrofloxacin: ₦15,000-28,000/500g
- Doxycycline: ₦12,000-22,000/500g

ANTIFUNGALS:
- Malachite Green: ₦5,000-10,000/500g
- Methylene Blue: ₦6,000-12,000/500g
- Salt (non-iodized): ₦800-1,500/25kg

ANTIPARASITES:
- Formalin 37%: ₦3,000-6,000/litre
- Potassium Permanganate: ₦4,000-8,000/kg
- Copper Sulfate: ₦3,500-7,000/kg

WATER TREATMENT:
- Lime (quick lime): ₦2,000-4,000/50kg
- Zeolite: ₦8,000-15,000/50kg
- Probiotics: ₦25,000-40,000/kg
- Activated Carbon: ₦5,000-10,000/kg

SUPPLEMENTS:
- Vitamin C (fish grade): ₦12,000-20,000/kg
- Fish multivitamins: ₦15,000-25,000/kg
- Amino acids: ₦18,000-30,000/kg

DOSAGE GUIDELINES:
- Antibiotics: 50-100mg/kg fish weight
- Salt treatment: 1-3% of pond volume
- Lime: 200-500kg/hectare

PREVENTION:
- Regular water testing
- Proper stocking density
- Quality feed management
- Quarantine new fish

WATER QUALITY MAINTENANCE:
- pH: 6.5-8.5
- Dissolved oxygen: >5ppm
- Ammonia: <0.5ppm
- Temperature: 25-32°C for tropical fish
`,

  // GENERAL/MIXED FARMING
  "farm_management": `
FARM MANAGEMENT SERVICES (Nigeria - 2024):

VETERINARY SERVICES:
- Farm visit consultation: ₦15,000-30,000 per visit
- Vaccination programs: ₦8,000-15,000 per 100 animals
- Health monitoring: ₦5,000-12,000 monthly per farm
- Emergency treatment: ₦10,000-25,000 per case

TECHNICAL SERVICES:
- Farm design consultation: ₦50,000-200,000
- Feed formulation: ₦20,000-50,000 per formula
- Business plan development: ₦100,000-300,000
- Training programs: ₦25,000-75,000 per session

INFRASTRUCTURE:
- Pen construction: ₦50,000-150,000 per pen
- Water system setup: ₦100,000-500,000
- Feed storage (50-ton): ₦300,000-800,000
- Solar power systems: ₦500,000-2,000,000

EQUIPMENT:
- Incubators (1000-egg): ₦350,000-800,000
- Feed mixers (1-ton): ₦400,000-1,200,000
- Water pumps: ₦80,000-300,000
- Generators (10KVA): ₦450,000-800,000

INSURANCE:
- Livestock insurance: 3-8% of stock value annually
- Farm structure insurance: 1-3% of value annually
- Equipment insurance: 2-5% of value annually

FINANCING:
- Bank of Agriculture loans: 9-15% interest
- CBN intervention funds: 5-9% interest
- Microfinance: 15-25% interest
- Private lenders: 20-35% interest

RECORD KEEPING SOFTWARE:
- Farm management apps: ₦10,000-50,000 annually
- Basic record books: ₦2,000-5,000 each
`
};

export default livestockKnowledge;