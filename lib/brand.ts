/**
 * PRIOR — all copy lives here so the voice stays consistent and the
 * components stay about composition, not words.
 */

export const brand = {
  name: "PRIOR",
  source: "Ansel Shelf",
  coordinates: "71°04′N  24°51′W",
  age: "11,400",
  draw: "2026",
  edition: "Nº 0417 / 2400",
  bottles: "2,400",
} as const;

export const hero = {
  kicker: "Water from beneath the Ansel Shelf",
  line: "It fell as snow before anyone was here to see it.",
  scroll: "Descend",
};

export const age = {
  index: "I",
  title: ["It fell as snow", "11,400 years ago."],
  body: "The ice pressed it into the basalt. The basalt kept it sealed, cold, and in the dark. It has never touched air.",
  meta: "Radiocarbon dated · Uppsala, 2019",
};

export const composition = {
  index: "II",
  title: "Composition, as drawn",
  note: "Nothing added. Nothing removed. Measured at the wellhead.",
  // `at` is a height along the bottle body in local units (see bottleGeometry)
  // so the annotations can be projected from the actual 3D object.
  minerals: [
    { key: "Silica", value: "21.0", unit: "mg/L", at: 0.42 },
    { key: "Bicarbonate", value: "12.2", unit: "mg/L", at: 0.12 },
    { key: "Calcium", value: "4.1", unit: "mg/L", at: -0.18 },
    { key: "Magnesium", value: "0.9", unit: "mg/L", at: -0.48 },
    { key: "Total dissolved solids", value: "38", unit: "mg/L", at: -0.78 },
    { key: "pH at source", value: "7.4", unit: "", at: -1.04 },
  ],
};

export const ritual = {
  index: "III",
  title: ["Drawn fourteen days a year,", "in the weeks after thaw."],
  body: "The wellhead is opened by hand and closed again when the pressure falls. Each bottle is filled, stoppered in basalt, and numbered at the source.",
  count: "2,400 bottles",
  countNote: "for the 2026 draw",
};

export const allocation = {
  kicker: "The 2026 draw",
  title: ["Allocations are offered,", "not sold."],
  cta: "Request an allocation",
  hint: "The bottle will open.",
};

export const inquiry = {
  kicker: "The register · 2026 draw",
  title: "Request access",
  lede: "Each allocation is considered individually. We write to every applicant, whether or not a bottle is offered.",
  fields: {
    name: "Name",
    email: "Email",
    organization: "Company or organisation",
    reason: "What brings you to the source?",
  },
  optional: "Optional",
  submit: "Enter the register",
  pending: "Entering",
  successTitle: "You are in the register.",
  successBody:
    "We will write before the wellhead closes. Until then, there is nothing to do but wait — which is, after all, what the water has always done.",
  back: "Return to the surface",
};

export const footer = {
  credit: "A concept by Warped Web Studio",
  disclaimer: "PRIOR is a fictional brand. No water was bottled in the making of this site.",
};
