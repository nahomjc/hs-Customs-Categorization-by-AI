export interface HsFeatures {
  itemType: string;
  material: string;
  use: string;
  keywords: string[];
}

export interface GriRuleResult {
  suggestedHsCodes: string[];
  rationale: string;
}

/**
 * Lightweight deterministic GRI-style guidance before final AI reasoning.
 * This does not finalize HS; it narrows candidate chapters/subheadings.
 */
export function applyGriRuleEngine(features: HsFeatures): GriRuleResult {
  const text = [features.itemType, features.material, features.use, ...features.keywords]
    .join(" ")
    .toLowerCase();

  if (/lamp|light|lighting|chandelier|pendant/.test(text)) {
    return {
      suggestedHsCodes: ["9405", "9405.10", "9405.20", "9405.90"],
      rationale: "GRI guidance: articles of lighting are classified in heading 9405.",
    };
  }

  if (/chair|sofa|stool|seating/.test(text)) {
    return {
      suggestedHsCodes: ["9401", "9401.61", "9401.71", "9401.80"],
      rationale: "GRI guidance: seats and seating furniture are classified in heading 9401.",
    };
  }

  if (/table|cabinet|shelf|furniture/.test(text)) {
    return {
      suggestedHsCodes: ["9403", "9403.20", "9403.60", "9403.90"],
      rationale: "GRI guidance: other furniture generally falls under heading 9403.",
    };
  }

  if (/wallpaper|wall covering/.test(text)) {
    return {
      suggestedHsCodes: ["4814"],
      rationale: "GRI guidance: wallpaper and wall coverings are classified in heading 4814.",
    };
  }

  if (/fan/.test(text)) {
    return {
      suggestedHsCodes: ["8414"],
      rationale: "GRI guidance: fans are classified in heading 8414.",
    };
  }

  if (/air conditioner|ac unit|aircon/.test(text)) {
    return {
      suggestedHsCodes: ["8415"],
      rationale: "GRI guidance: air-conditioning machines are classified in heading 8415.",
    };
  }

  if (/fountain|pump/.test(text)) {
    return {
      suggestedHsCodes: ["8413"],
      rationale: "GRI guidance: pumps for liquids are classified in heading 8413.",
    };
  }

  if (/ceramic|vase|pottery/.test(text)) {
    return {
      suggestedHsCodes: ["6913"],
      rationale: "GRI guidance: decorative ceramic articles are classified in heading 6913.",
    };
  }

  if (/artificial plant|artificial flower/.test(text)) {
    return {
      suggestedHsCodes: ["6702"],
      rationale: "GRI guidance: artificial flowers/plants are classified in heading 6702.",
    };
  }

  if (/sculpture|statuary|statue/.test(text)) {
    return {
      suggestedHsCodes: ["9703"],
      rationale: "GRI guidance: original sculptures and statuary are classified in heading 9703.",
    };
  }

  return {
    suggestedHsCodes: ["9999"],
    rationale:
      "GRI guidance: insufficient deterministic indicators; keep under review bucket 9999 pending final reasoning.",
  };
}
