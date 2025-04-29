import * as v from "@valibot/valibot"; // 1.31 kB

/*
	  Col 0: Lfd Nr. (not important)
		Col 1: ID
		Col 2: Gemeinde/Stadt/Kreis
		Col 3: Name
		Col 4: Initiation/Verfahrenstyp
		Col 5: Result
		Col 6: Year
		...
		Col 8: Bundesland
		Col 9: Thema
		  1: Öffentliche Infrastruktur- und Versorgungseinrichtungen
			2: Öffentliche Sozial- und Bildungseinrichtungen
			3: Kulturprojekte
			4: Entsorgungsprojekte
			5: Wirtschaftsprojekte
			6: Verkehrsprojekte
			7: Gebühren und Abgaben
			8: Hauptsatzung oder andere Satzung
			9: Sonstiges
			10: Gebietsreform
			11: Wohngebietsprojekte
			12: Planungssatzungen (Bauleitplanung)
			13: Wirtschaftsprojekte (Mobilfunk)
		Col 10: Status
	*/
const InitiativeSchema = v.object({
  id: v.number(),
  region: v.string(),
  name: v.nullish(v.string(), "No name provided"),
  topic: v.number(),
  type: v.string(),
  year: v.pipe(
    v.transform((value) => {
      if (typeof value === "string") {
        return parseInt(value);
      }
      return value;
    }),
    v.number(),
    v.minValue(1900),
  ),
  result: v.string(),
  status: v.nullish(v.string()),
  province: v.nullish(v.string()),
});
type Initiative = v.InferOutput<typeof InitiativeSchema>;

const initiativesFileContent = await Deno.readTextFile("projects.json");

let rawInitiatives;
try {
  rawInitiatives = JSON.parse(initiativesFileContent);
} catch (error) {
  console.error("Error parsing initiatives JSON:", error);
}

const initiatives = v.parse(
  v.array(InitiativeSchema),
  rawInitiatives.map((initiative: any) => {
    // initiative is array
    // 	[
    // 	1,
    // 	12386,
    // 	"Rödental, St",
    // 	"Für eine Sanierung des Rathausgebäudes",
    // 	"2. b (genauer:) Ratsreferendum: aufgegriffenes Bürgerbegehren",
    // 	"Offen",
    // 	"2025",
    // 	"<div class=\"row\"><div class=\"col-lg-6\"><a href=\"/initiative/detail?id=12386\"><i class=\"far fa-eye\"></i> Details</a></div></div>",
    // 	"BAY",
    // 	1,
    // 	"BE-Termin angesetzt"
    // ],
    return v.parse(InitiativeSchema, {
      id: initiative[1],
      region: initiative[2],
      name: initiative[3],
      topic: initiative[9],
      type: initiative[4],
      year: initiative[6],
      result: initiative[5],
      status: initiative[10],
      province: initiative[8],
    });
  }),
);

// Find Initiatives without status
const initiativesWithoutStatus = initiatives.filter((initiative: Initiative) =>
  initiative.status === null
);

const relevantInitiatives = initiatives.filter((initiative: Initiative) =>
  initiative.status !== null
);

const positiveInitiatives: Initiative[] = initiatives.filter((
  initiative: Initiative,
) =>
  initiative.result === "Positiv erledigt durch neuen Gemeinderatsbeschluss" ||
  initiative.result === "BE im Sinne des Begehrens"
);

console.log(`Positive Initiatives: ${positiveInitiatives.length}`);

// Check if the initiative has a positive name connotation, e.g. "Für ..., Pro ..."
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
function filterForPositiveName(initiatives: Initiative[]) {
  return positiveInitiatives.filter(
    (initiative: Initiative) => {
      if (
        positiveWords.some((word) =>
          initiative.name.toLowerCase().startsWith(word)
        )
      ) {
        return true;
      }

      return false;
    },
  );
}
const withPositiveName = filterForPositiveName(positiveInitiatives);
console.log(
  `Initiatives with positive name connotation: ${withPositiveName.length}`,
);

// Check if the initiative has a negative name connotation, e.g. "Gegen ..."
const negativeWords = [
  "gegen",
  "verhinderung",
  "kein",
];
function filterForNegativeName(initiatives: Initiative[]) {
  return initiatives.filter(
    (initiative: Initiative) => {
      if (
        negativeWords.some((word) =>
          initiative.name.toLowerCase().startsWith(word)
        )
      ) {
        return true;
      }

      return false;
    },
  );
}
const withNegativeName = filterForNegativeName(positiveInitiatives);
console.log(
  `Initiatives with negative name connotation: ${withNegativeName.length}`,
);

const unaccountedInitiatives = positiveInitiatives.filter((initiative) =>
  ![...withPositiveName, ...withNegativeName].includes(initiative)
);
console.log(
  `Unaccounted Initiatives: ${unaccountedInitiatives.length}`,
);

console.log(`---`);

const failedInitiatives: Initiative[] = initiatives.filter((
  initiative: Initiative,
) =>
  initiative.result === "BB erreicht zu wenig Unterschriften" ||
  initiative.result === "Unzulässig" ||
  initiative.result === "Verfahrenstyp" ||
  initiative.result === "BE nicht im Sinne des Begehrens" ||
  initiative.result === "BE in Stichentscheid gescheitert"
);
console.log(`Failed Initiatives: ${failedInitiatives.length}`);

const failedWithPositiveName = filterForPositiveName(failedInitiatives);

console.log(
  `Failed Initiatives with positive name connotation: ${failedWithPositiveName.length}`,
);

const failedWithNegativeName = filterForNegativeName(failedInitiatives);

console.log(
  `Failed Initiatives with negative name connotation: ${failedWithNegativeName.length}`,
);

const failedWithNeutralName = failedInitiatives.filter((initiative) =>
  ![...failedWithPositiveName, ...failedWithNegativeName].includes(initiative)
);

console.log(
  `Failed Initiatives with neutral name connotation: ${failedWithNeutralName.length}`,
);

console.log(failedWithNeutralName);
