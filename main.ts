import * as v from "@valibot/valibot";

const filePath = "projects.json";
const classifiedWordsPath = "classifiedWords.json";
const manualClassificationsPath = "manualClassifications.json";

const log = {
    info: (text: string) => console.log(`%cℹ ${text}`, "color: gray"),
    success: (text: string) => console.log(`%c✅ ${text}`, "color: green; font-weight: bold"),
    warn: (text: string) => console.log(`%c⚠ ${text}`, "color: orange"),
    error: (text: string) => console.log(`%c❌ ${text}`, "color: red; font-weight: bold"),
    headline: (text: string) => console.log(`%c${text}`, "font-weight: bold; text-decoration: underline"),
};

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

type ClassifiedWords = {
    positive: string[];
    negative: string[];
};

type ManualClassifications = {
    positive: number[];
    negative: number[];
    neutral: number[];
};
const manualClassificationsSchema = v.object({
    positive: v.array(v.number()),
    negative: v.array(v.number()),
    neutral: v.array(v.number()),
})

function extractFirstWord(text: string): string {
    return text
        .toLocaleLowerCase("de")
        .normalize("NFKC")
        .trim()
        .split(/\s+/)[0]
        .replace(/[^\p{L}]/gu, "");
}

function startsWithWord(text: string | null | undefined, words: string[]) {
    if (!text) return false;
    const normalized = extractFirstWord(text);
    return words.some((word) => normalized.startsWith(word));
}

async function loadClassifiedWords(): Promise<ClassifiedWords> {
    try {
        const content = await Deno.readTextFile(classifiedWordsPath);
        log.info("⚙️ Manuell klassifizierte Wörter geladen.");
        return JSON.parse(content);
    } catch {
        log.warn("⚠️ Noch keine manuell klassifizierten Wörter vorhanden.");
        return { positive: [], negative: [] };
    }
}

async function saveClassifiedWords(words: ClassifiedWords) {
    words.positive = [...new Set(words.positive)];
    words.negative = [...new Set(words.negative)];
    await Deno.writeTextFile(classifiedWordsPath, JSON.stringify(words, null, 2));
    log.success("📁 Aktualisierte Wortlisten gespeichert.");
}

async function loadManualClassifications(): Promise<ManualClassifications> {
    try {
        const content = await Deno.readTextFile(manualClassificationsPath);
        return v.parse(manualClassificationsSchema, JSON.parse(content))
        // return JSON.parse(content);
    } catch(e) {
        console.error(e)
        return { positive: [], negative: [], neutral: [] };
    }
}

async function saveManualClassifications(classifications: ManualClassifications) {
    classifications.positive = [...new Set(classifications.positive)];
    classifications.negative = [...new Set(classifications.negative)];
    await Deno.writeTextFile(manualClassificationsPath, JSON.stringify(classifications, null, 2));
    log.success("📁 Manuelle Klassifizierungen gespeichert.");
}

async function askAndClassifyInitiatives(
    initiatives: Initiative[],
    classifiedWords: ClassifiedWords,
    manualClassifications: ManualClassifications
): Promise<void> {
    const unresolved = initiatives.filter(
        (i) =>
            !startsWithWord(i.name, classifiedWords.positive) &&
            !startsWithWord(i.name, classifiedWords.negative) &&
            !manualClassifications.positive.includes(i.id) &&
            !manualClassifications.negative.includes(i.id) &&
            !manualClassifications.neutral.includes(i.id)
    );

    for (const initiative of unresolved) {
        const name = initiative.name ?? "(kein Name)";

        while (true) {
            console.log(`\n\n\n`)
            const answer = prompt(
                `Wie kategorisierst du diesen Namen?\n"${name}"\n[p]ositiv / [n]egativ / [w]ortbasiert / [enter] neutral:`
            )?.trim().toLowerCase();

            if (answer === "p") {
                manualClassifications.positive.push(initiative.id);
                await saveManualClassifications(manualClassifications);
                break;
            }
            if (answer === "n") {
                manualClassifications.negative.push(initiative.id);
                await saveManualClassifications(manualClassifications);
                break;
            }
            if (answer === "w") {
                const firstWord = extractFirstWord(name);
                if (!classifiedWords.positive.includes(firstWord) && !classifiedWords.negative.includes(firstWord)) {
                    const wordClass = prompt(`Wort "${firstWord}" als [p]ositiv / [n]egativ / [enter] ignorieren:`)?.trim().toLowerCase();
                    if (wordClass === "p") {
                        classifiedWords.positive.push(firstWord);
                        await saveClassifiedWords(classifiedWords);
                    } else if (wordClass === "n") {
                        classifiedWords.negative.push(firstWord);
                        await saveClassifiedWords(classifiedWords);
                    }
                } else {
                    console.log(`Word ${firstWord} is already included`)
                }
                break;
            }
            if (answer === "") {
                manualClassifications.neutral.push(initiative.id);
                await saveManualClassifications(manualClassifications);
                break;
            };
            console.log("Bitte gib 'p', 'n', 'w' oder einfach Enter ein.");
        }
    }
}

async function fetchInitiatives(): Promise<Initiative[]> {
    const url = 'https://datenbank-buergerbegehren.info/initiative/data?draw=1&columns[0][data]=0&columns[0][name]=&columns[0][searchable]=true&columns[0][orderable]=false&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=1&columns[1][name]=&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=2&columns[2][name]=&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=3&columns[3][name]=&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=4&columns[4][name]=&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=5&columns[5][name]=&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=6&columns[6][name]=&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=7&columns[7][name]=&columns[7][searchable]=true&columns[7][orderable]=false&columns[7][search][value]=&columns[7][search][regex]=false&columns[8][data]=8&columns[8][name]=&columns[8][searchable]=true&columns[8][orderable]=false&columns[8][search][value]=&columns[8][search][regex]=false&columns[9][data]=9&columns[9][name]=&columns[9][searchable]=true&columns[9][orderable]=false&columns[9][search][value]=&columns[9][search][regex]=false&columns[10][data]=10&columns[10][name]=&columns[10][searchable]=true&columns[10][orderable]=false&columns[10][search][value]=&columns[10][search][regex]=false&order[0][column]=6&order[0][dir]=desc&order[1][column]=1&order[1][dir]=desc&start=0&length=15000&search[value]=&search[regex]=false&_=1747729972776';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP-Fehler: ${response.status}`);
        const data = await response.json();
        return v.parse(
            v.array(InitiativeSchema),
            data.data.map((i: any) => ({
                id: i[1],
                region: i[2],
                name: i[3],
                topic: i[9],
                type: i[4],
                year: i[6],
                result: i[5],
                status: i[10],
                province: i[8],
            }))
        );
    } catch (err) {
        log.error(`Fehler beim Einlesen oder Parsen: ${err.message}`);
        Deno.exit(1);
    }
}

function filterInitiativesByResult(initiatives: Initiative[], results: string[]) {
    return initiatives.filter((i) => results.includes(i.result));
}

function categorizeByName(
    initiatives: Initiative[],
    words: ClassifiedWords,
    manual: ManualClassifications
) {
    const withPositive = initiatives.filter(
        (i) => startsWithWord(i.name, words.positive) || manual.positive.includes(i.id)
    );
    const withNegative = initiatives.filter(
        (i) => startsWithWord(i.name, words.negative) || manual.negative.includes(i.id)
    );
    const neutral = initiatives.filter((i) => !withPositive.includes(i) && !withNegative.includes(i));
    return { withPositive, withNegative, neutral };
}

async function analyze() {
    const initiatives = await fetchInitiatives();
    const classifiedWords = await loadClassifiedWords();
    const manualClassifications = await loadManualClassifications();

    const withoutStatus = initiatives.filter((i) => i.status === null);

    const positiveResults = [
        "Positiv erledigt durch neuen Gemeinderatsbeschluss",
        "BE im Sinne des Begehrens",
    ];

    const failedResults = [
        "BB erreicht zu wenig Unterschriften",
        "Unzulässig",
        "Verfahrenstyp",
        "BE nicht im Sinne des Begehrens",
        "BE in Stichentscheid gescheitert",
    ];

    const positiveInitiatives = filterInitiativesByResult(initiatives, positiveResults);
    const failedInitiatives = filterInitiativesByResult(initiatives, failedResults);

    if (!Deno.args.includes("--skip-classification")) {
        await askAndClassifyInitiatives(
            [...positiveInitiatives, ...failedInitiatives],
            classifiedWords,
            manualClassifications
        );
    }

    const posCat = categorizeByName(positiveInitiatives, classifiedWords, manualClassifications);
    const failCat = categorizeByName(failedInitiatives, classifiedWords, manualClassifications);

    log.headline("📊 Auswertung Initiativen");
    log.info(`Datei: ${filePath}`);
    log.success(`Gesamtzahl Initiativen: ${initiatives.length}`);
    log.info(`Ohne Status: ${withoutStatus.length}`);
    console.log("");
    log.success(`Positiv bewertet: ${positiveInitiatives.length}`);
    log.info(`→ Mit positivem Namen: ${posCat.withPositive.length}`);
    log.info(`→ Mit negativem Namen: ${posCat.withNegative.length}`);
    log.info(`→ Neutral/unauffällig: ${posCat.neutral.length}`);
    console.log("");
    log.error(`Gescheitert: ${failedInitiatives.length}`);
    log.info(`→ Mit positivem Namen: ${failCat.withPositive.length}`);
    log.info(`→ Mit negativem Namen: ${failCat.withNegative.length}`);
    log.info(`→ Neutral/unauffällig: ${failCat.neutral.length}`);

    if (Deno.args.includes("--export")) {
        await Deno.writeTextFile(
            "results.json",
            JSON.stringify(
                {
                    total: initiatives.length,
                    withoutStatus: withoutStatus.length,
                    positive: {
                        total: positiveInitiatives.length,
                        withPositiveName: posCat.withPositive.length,
                        withNegativeName: posCat.withNegative.length,
                        neutral: posCat.neutral.length,
                    },
                    failed: {
                        total: failedInitiatives.length,
                        withPositiveName: failCat.withPositive.length,
                        withNegativeName: failCat.withNegative.length,
                        neutral: failCat.neutral.length,
                    },
                },
                null,
                2
            )
        );
        log.success("📁 Ergebnisse gespeichert als results.json");
    }
}

await analyze();
