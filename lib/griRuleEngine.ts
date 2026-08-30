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

  if (/soybean|soya\s*bean|soy\s*oil/.test(text)) {
    return {
      suggestedHsCodes: ["1507", "1507.10", "1507.90"],
      rationale: "GRI guidance: soybean oil is classified in heading 1507.",
    };
  }

  if (/palm\s*olein|palm\s*oil|RBD\s*oil/.test(text)) {
    return {
      suggestedHsCodes: ["1511", "1511.10", "1511.90"],
      rationale: "GRI guidance: palm oil and fractions are classified in heading 1511.",
    };
  }

  if (/\b(cooking\s*)?oil\b|crude\s*oil|vegetable\s*oil|degummed/.test(text)) {
    return {
      suggestedHsCodes: ["1507", "1508", "1509", "1511", "1512"],
      rationale: "GRI guidance: vegetable/animal oils are generally in chapter 15.",
    };
  }

  if (/\btea\b|green\s*tea|black\s*tea/.test(text)) {
    return {
      suggestedHsCodes: ["0902", "0902.10", "0902.20"],
      rationale: "GRI guidance: tea is classified in heading 0902.",
    };
  }

  if (/\bsugar\b|sucrose/.test(text)) {
    return {
      suggestedHsCodes: ["1701", "1701.99"],
      rationale: "GRI guidance: cane/beet sugar is classified in heading 1701.",
    };
  }

  if (/kidney\s*bean|red\s*bean|dried\s*bean|pulse/.test(text)) {
    return {
      suggestedHsCodes: ["0713", "0713.33"],
      rationale: "GRI guidance: dried leguminous vegetables are in heading 0713.",
    };
  }

  if (/tomato\s*paste|tomato\s*puree/.test(text)) {
    return {
      suggestedHsCodes: ["2002", "2002.90"],
      rationale: "GRI guidance: tomato paste is classified in heading 2002.",
    };
  }

  if (/luncheon\s*meat|chicken\s*meat|poultry/.test(text)) {
    return {
      suggestedHsCodes: ["1602", "1602.32"],
      rationale: "GRI guidance: prepared meat of poultry is in heading 1602.",
    };
  }

  if (/mandarin|orange|citrus/.test(text)) {
    return {
      suggestedHsCodes: ["0805", "0805.21"],
      rationale: "GRI guidance: citrus fruit is classified in heading 0805.",
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
