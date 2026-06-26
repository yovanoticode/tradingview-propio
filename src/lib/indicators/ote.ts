import type { SwingPoint } from "./marketStructure";

export interface OTELevels {
  swingStart: SwingPoint;
  swingEnd: SwingPoint;
  levels: {
    level: number;
    price: number;
  }[];
  direction: "bull" | "bear";
}

export function calculateOTE(swings: SwingPoint[]): OTELevels | null {
  if (swings.length < 2) return null;

  // Find the last two opposite swings
  let endSwing = swings[swings.length - 1];
  let startSwing: SwingPoint | null = null;

  for (let i = swings.length - 2; i >= 0; i--) {
    if (swings[i].type !== endSwing.type) {
      startSwing = swings[i];
      break;
    }
  }

  if (!startSwing) return null;

  const direction = startSwing.type === "low" ? "bull" : "bear";
  const startPrice = startSwing.price;
  const endPrice = endSwing.price;
  const diff = endPrice - startPrice;

  // Standard ICT OTE Fib Levels
  const fibs = [0, 0.5, 0.62, 0.705, 0.79, 1];

  const levels = fibs.map((fib) => ({
    level: fib,
    price: endPrice - fib * diff,
  }));

  return {
    swingStart: startSwing,
    swingEnd: endSwing,
    levels,
    direction,
  };
}
