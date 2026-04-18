type AnchorInput = {
  practicalReason: string;
  emotionalReason: string;
  costOfDrift: string;
};

function sanitizeSentence(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return '';
  }

  const withoutTrailing = trimmed.replace(/[.!?]+$/g, '');
  const normalized =
    withoutTrailing.charAt(0).toUpperCase() + withoutTrailing.slice(1);

  return `${normalized}.`;
}

export function generateAnchorLines({
  practicalReason,
  emotionalReason,
  costOfDrift,
}: AnchorInput): { anchorWhy: string; anchorDrift: string } {
  const practical = sanitizeSentence(practicalReason);
  const emotional = sanitizeSentence(emotionalReason);
  const drift = sanitizeSentence(costOfDrift);

  const anchorWhy = [practical, emotional].filter(Boolean).slice(0, 2).join(' ');

  return {
    anchorWhy,
    anchorDrift: drift,
  };
}
