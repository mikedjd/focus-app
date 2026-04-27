export function generateAnchorLines(input: {
  practicalReason?: string;
  emotionalReason?: string;
  costOfDrift?: string;
}): { anchorWhy: string; anchorDrift: string } {
  return {
    anchorWhy: input.practicalReason || input.emotionalReason || '',
    anchorDrift: input.costOfDrift || '',
  };
}
