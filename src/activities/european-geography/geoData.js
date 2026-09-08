/**
 * European countries and their capitals. GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Same country list as the flags activity (WORLD.md: Europe on the widest common
 * definition — Russia, Turkey and Kosovo in, Kazakhstan out, micro-states
 * included), minus England, which is a flag rather than a sovereign state and has
 * no capital.
 *
 * DELIBERATELY NOT IMPORTED FROM THE FLAGS FOLDER. Two activities importing one
 * data file would couple them, which is the single thing the registry shape
 * exists to prevent (PLAN 2), and the flags module carries ~150 KB of artwork
 * this activity has no use for. Fifty names and fifty capitals is a cheap price
 * for two folders that can be deleted independently.
 *
 * Capitals are the seat-of-government city each country names itself. Two are
 * commonly got wrong and are worth stating explicitly: Switzerland is Bern (not
 * Zurich or Geneva), and the Netherlands is Amsterdam (the constitutional
 * capital; The Hague is the seat of government). Turkey is Ankara, not Istanbul.
 */

export const COUNTRIES = Object.freeze({
  "al": { name: "Albania", capital: "Tirana" },
  "ad": { name: "Andorra", capital: "Andorra la Vella" },
  "am": { name: "Armenia", capital: "Yerevan" },
  "at": { name: "Austria", capital: "Vienna" },
  "az": { name: "Azerbaijan", capital: "Baku" },
  "by": { name: "Belarus", capital: "Minsk" },
  "be": { name: "Belgium", capital: "Brussels" },
  "ba": { name: "Bosnia and Herzegovina", capital: "Sarajevo" },
  "bg": { name: "Bulgaria", capital: "Sofia" },
  "hr": { name: "Croatia", capital: "Zagreb" },
  "cy": { name: "Cyprus", capital: "Nicosia" },
  "cz": { name: "Czechia", capital: "Prague" },
  "dk": { name: "Denmark", capital: "Copenhagen" },
  "ee": { name: "Estonia", capital: "Tallinn" },
  "fi": { name: "Finland", capital: "Helsinki" },
  "fr": { name: "France", capital: "Paris" },
  "ge": { name: "Georgia", capital: "Tbilisi" },
  "de": { name: "Germany", capital: "Berlin" },
  "gr": { name: "Greece", capital: "Athens" },
  "hu": { name: "Hungary", capital: "Budapest" },
  "is": { name: "Iceland", capital: "Reykjavik" },
  "ie": { name: "Ireland", capital: "Dublin" },
  "it": { name: "Italy", capital: "Rome" },
  "xk": { name: "Kosovo", capital: "Pristina" },
  "lv": { name: "Latvia", capital: "Riga" },
  "li": { name: "Liechtenstein", capital: "Vaduz" },
  "lt": { name: "Lithuania", capital: "Vilnius" },
  "lu": { name: "Luxembourg", capital: "Luxembourg" },
  "mt": { name: "Malta", capital: "Valletta" },
  "md": { name: "Moldova", capital: "Chisinau" },
  "mc": { name: "Monaco", capital: "Monaco" },
  "me": { name: "Montenegro", capital: "Podgorica" },
  "nl": { name: "Netherlands", capital: "Amsterdam" },
  "mk": { name: "North Macedonia", capital: "Skopje" },
  "no": { name: "Norway", capital: "Oslo" },
  "pl": { name: "Poland", capital: "Warsaw" },
  "pt": { name: "Portugal", capital: "Lisbon" },
  "ro": { name: "Romania", capital: "Bucharest" },
  "ru": { name: "Russia", capital: "Moscow" },
  "sm": { name: "San Marino", capital: "San Marino" },
  "rs": { name: "Serbia", capital: "Belgrade" },
  "sk": { name: "Slovakia", capital: "Bratislava" },
  "si": { name: "Slovenia", capital: "Ljubljana" },
  "es": { name: "Spain", capital: "Madrid" },
  "se": { name: "Sweden", capital: "Stockholm" },
  "ch": { name: "Switzerland", capital: "Bern" },
  "tr": { name: "Turkey", capital: "Ankara" },
  "ua": { name: "Ukraine", capital: "Kyiv" },
  "gb": { name: "United Kingdom", capital: "London" },
  "va": { name: "Vatican City", capital: "Vatican City" },
})

/** Stable order, so a deck is reproducible. */
export const CODES = Object.freeze(Object.keys(COUNTRIES))
