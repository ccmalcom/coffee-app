# Espresso/Coffee Process Taxonomy (v1)

Canonical `process` enum values, what they mean, and how roasters typically phrase them on listings. This is the ground truth the LLM listing parser maps messy listing language onto.

## washed
Cherry is depulped, fermented briefly to remove remaining mucilage, then washed clean before drying. Cleanest, most transparent cup; origin/varietal character shows clearly, floral/citrus/tea-like notes common.
Listing phrases: "fully washed", "wet process", "washed process".

## natural
Whole cherry dried intact (skin and pulp on), then hulled after drying. Fruit sugars ferment against the bean through the whole drying period. Heavier body, pronounced fruit/wine/fermented notes.
Listing phrases: "natural process", "dry process", "sun-dried".

## honey
Skin removed, some or all mucilage (the "honey") left on during drying. Sits between washed and natural; named by mucilage retained (white/yellow/red/black honey, lightest to heaviest).
Listing phrases: "honey process", "pulped natural", "miel process", "yellow/red/black honey".

## anaerobic
Cherry (or depulped bean) ferments in a sealed, oxygen-free tank before further processing (which may itself be washed/natural/honey). Produces intense, often funky or fruit-candy flavors from anaerobic fermentation byproducts.
Listing phrases: "anaerobic fermentation", "anaerobic natural", "anaerobic washed".

## carbonic_maceration
A wine-technique variant of anaerobic processing: whole cherries ferment in a CO2-flooded sealed tank (CO2 added or produced by initial fermentation), suppressing browning and building distinct fruity/floral esters before drying.
Listing phrases: "carbonic maceration", "CM process".

## nitro_washed
Cherry or parchment ferments in a sealed tank flushed with nitrogen (not just CO2 self-generated) before washing. A newer, more controlled anaerobic variant — extremely aromatic, candy/tropical-fruit-forward. **Permanent calibration case: Tinker's Colombia "Julio Madrid Caturra Nitro"** must map here.
Listing phrases: "nitro washed", "nitrogen-flushed fermentation", "N2 washed".

## co_ferment
Fruit, spices, or other flavor-adjacent organic matter is fermented together with the cherry/parchment. Produces additive-adjacent flavors, but the flavor still originates in a fermentation process rather than a post-roast additive — distinguish from actually flavored coffee (see `flavor_origin`).
Listing phrases: "co-ferment", "cherry-fermented with [fruit]", "mosto process".

## thermal_shock
Cherry or parchment is exposed to a deliberate temperature shock (hot water bath, then cold, or similar) partway through fermentation/drying to arrest or alter fermentation activity.
Listing phrases: "thermal shock process", "thermal shock fermentation".

## other
Anything not covered above (e.g. novel/proprietary named processes). Use `process = 'other'` and put the roaster's own phrase verbatim in `process_detail` — never force a bad-fit match into one of the categories above.

## flavor_origin (not a process, but decided alongside it)
- `process` — wild/intense flavors are a genuine side effect of fermentation/processing (the target of Discovery). Anaerobic, nitro-washed, carbonic maceration, and co-ferment coffees are usually `process` even when notes sound like candy.
- `added` — flavoring was added after roasting (flavored syrups/oils, e.g. "hazelnut flavored", "pumpkin spice flavored"). Chase's directive excludes these from Discovery.
- `unknown` — listing doesn't give enough information to tell; default until the parser or a human resolves it.
