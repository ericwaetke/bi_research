import * as v from "@valibot/valibot";

// CLI-Argumente verarbeiten
// const [filePath = "projects.json"] = Deno.args;

const filePath = "projects.json";

// Farbiges Logging
const log = {
  info: (text: string) => console.log(`%cℹ ${text}`, "color: gray"),
  success: (text: string) =>
    console.log(`%c✅ ${text}`, "color: green; font-weight: bold"),
  warn: (text: string) => console.log(`%c⚠ ${text}`, "color: orange"),
  error: (text: string) =>
    console.log(`%c❌ ${text}`, "color: red; font-weight: bold"),
  headline: (text: string) =>
    console.log(`%c${text}`, "font-weight: bold; text-decoration: underline"),
};

// Schema für Initiativen
const InitiativeSchema = v.object({
  id: v.number(),
  region: v.string(),
  name: v.nullish(v.string(), "No name provided"),
  topic: v.number(),
  type: v.string(),
  year: v.pipe(
    v.transform((value) => {
      const parsed = typeof value === "string" ? parseInt(value) : value;
      if (isNaN(parsed)) throw new Error("Invalid year");
      return parsed;
    }),
    v.number(),
    v.minValue(1900),
  ),
  result: v.string(),
  status: v.nullish(v.string()),
  province: v.nullish(v.string()),
});
type Initiative = v.InferOutput<typeof InitiativeSchema>;

// Datei lesen
let rawInitiatives: any[];
try {
  const content = await Deno.readTextFile(filePath);
  rawInitiatives = JSON.parse(content);
} catch (err) {
  log.error(
    `Fehler beim Einlesen oder Parsen der Datei "${filePath}": ${err.message}`,
  );
  Deno.exit(1);
}

// Transformation in Objekte mit Schema-Validierung
const initiatives = v.parse(
  v.array(InitiativeSchema),
  rawInitiatives.map((i: any) => ({
    id: i[1],
    region: i[2],
    name: i[3],
    topic: i[9],
    type: i[4],
    year: i[6],
    result: i[5],
    status: i[10],
    province: i[8],
  })),
);

// Hilfsfunktionen
const positiveWords = [
  "für",
  "pro",
  "erweiterung",
  "weiterführung",
  "erhalt",
  "rettung",
  "einführung",
  "rettet",
];
const negativeWords = ["gegen", "verhinderung", "kein"];

function startsWithWord(text: string | null | undefined, words: string[]) {
  if (!text) return false;
  const normalized = text.toLocaleLowerCase("de").normalize("NFKC").trim();
  return words.some((word) => normalized.startsWith(word));
}

// Auswertungen
const initiativesWithoutStatus = initiatives.filter((i) => i.status === null);
const positiveInitiatives = initiatives.filter((i) =>
  i.result === "Positiv erledigt durch neuen Gemeinderatsbeschluss" ||
  i.result === "BE im Sinne des Begehrens"
);
const withPositiveName = positiveInitiatives.filter((i) =>
  startsWithWord(i.name, positiveWords)
);
const withNegativeName = positiveInitiatives.filter((i) =>
  startsWithWord(i.name, negativeWords)
);
const unaccountedInitiatives = positiveInitiatives.filter((i) =>
  ![...withPositiveName, ...withNegativeName].includes(i)
);

const failedInitiatives = initiatives.filter((i) =>
  [
    "BB erreicht zu wenig Unterschriften",
    "Unzulässig",
    "Verfahrenstyp",
    "BE nicht im Sinne des Begehrens",
    "BE in Stichentscheid gescheitert",
  ].includes(i.result)
);

const failedWithPositiveName = failedInitiatives.filter((i) =>
  startsWithWord(i.name, positiveWords)
);
const failedWithNegativeName = failedInitiatives.filter((i) =>
  startsWithWord(i.name, negativeWords)
);
const failedWithNeutralName = failedInitiatives.filter((i) =>
  ![...failedWithPositiveName, ...failedWithNegativeName].includes(i)
);

// Ausgabe
log.headline("📊 Auswertung Initiativen");
log.info(`Datei: ${filePath}`);
log.success(`Gesamtzahl Initiativen: ${initiatives.length}`);
log.info(`Ohne Status: ${initiativesWithoutStatus.length}`);

console.log("");

log.success(`Positiv bewertet: ${positiveInitiatives.length}`);
log.info(`→ Mit positivem Namen: ${withPositiveName.length}`);
log.info(`→ Mit negativem Namen: ${withNegativeName.length}`);
log.info(`→ Neutral/unauffällig: ${unaccountedInitiatives.length}`);

console.log("");

log.error(`Gescheitert: ${failedInitiatives.length}`);
log.info(`→ Mit positivem Namen: ${failedWithPositiveName.length}`);
log.info(`→ Mit negativem Namen: ${failedWithNegativeName.length}`);
log.info(`→ Neutral/unauffällig: ${failedWithNeutralName.length}`);

log.success("Analyse abgeschlossen.");

if (Deno.args.includes("--export")) {
  await Deno.writeTextFile(
    "results.json",
    JSON.stringify(
      {
        total: initiatives.length,
        withoutStatus: initiativesWithoutStatus.length,
        positive: {
          total: positiveInitiatives.length,
          withPositiveName: withPositiveName.length,
          withNegativeName: withNegativeName.length,
          neutral: unaccountedInitiatives.length,
        },
        failed: {
          total: failedInitiatives.length,
          withPositiveName: failedWithPositiveName.length,
          withNegativeName: failedWithNegativeName.length,
          neutral: failedWithNeutralName.length,
        },
      },
      null,
      2,
    ),
  );
  log.success("📁 Ergebnisse gespeichert als results.json");
}
