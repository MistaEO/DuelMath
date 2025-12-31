/**
 * Memoization cache for combinations to speed up repeated calculations.
 */
const comboMemo: Record<string, bigint> = {};

/**
 * Calculates the combinations of n items taken k at a time (nCk).
 * Uses BigInt for precision, as 60C30 exceeds MAX_SAFE_INTEGER.
 */
export const combinations = (n: number, k: number): bigint => {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  if (k > n / 2) k = n - k;

  const key = `${n},${k}`;
  if (comboMemo[key]) return comboMemo[key];

  let res = 1n;
  for (let i = 1; i <= k; i++) {
    res = (res * BigInt(n - i + 1)) / BigInt(i);
  }
  
  comboMemo[key] = res;
  return res;
};

export interface HyperGroup {
  id: string;
  name: string;
  countInDeck: number;
  minDesired: number;
  maxDesired: number;
}

/**
 * Calculates Multivariate Hypergeometric Probability with constraints.
 * Uses BigInt for intermediate summation to prevent precision loss.
 * Returns the probability as a percentage (0-100).
 */
export const calculateMultivariateHyper = (
  deckSize: number,
  handSize: number,
  groups: HyperGroup[]
): number => {
  if (handSize > deckSize || handSize < 0) return 0;
  
  const totalInGroups = groups.reduce((acc, g) => acc + g.countInDeck, 0);
  if (totalInGroups > deckSize) return 0;

  const otherCount = deckSize - totalInGroups;
  const totalCombinations = combinations(deckSize, handSize);
  if (totalCombinations === 0n) return 0;

  let totalSuccessfulCombinations = 0n;

  /**
   * Recursive solver to find all valid combinations of group selections 
   * that satisfy the hand size and group constraints.
   */
  const solve = (groupIndex: number, remainingHand: number, currentWays: bigint) => {
    // Optimization: if we already need more cards than remaining, or 
    // we have more cards than hand can hold, prune this branch.
    if (remainingHand < 0) return;

    if (groupIndex === groups.length) {
      // Pick the remaining cards from the 'Other' group (non-categorized cards)
      if (remainingHand <= otherCount) {
        totalSuccessfulCombinations += currentWays * combinations(otherCount, remainingHand);
      }
      return;
    }

    const group = groups[groupIndex];
    const minTake = Math.max(0, group.minDesired);
    const maxTake = Math.min(remainingHand, group.countInDeck, group.maxDesired);

    for (let take = minTake; take <= maxTake; take++) {
      const ways = combinations(group.countInDeck, take);
      if (ways > 0n) {
        solve(groupIndex + 1, remainingHand - take, currentWays * ways);
      }
    }
  };

  solve(0, handSize, 1n);

  // Convert back to number for UI; result is (Success / Total) * 100
  // We use Number(bigint) / Number(bigint) as the final precision loss is negligible for percentage display.
  return (Number(totalSuccessfulCombinations) / Number(totalCombinations)) * 100;
};

/**
 * Calculates probabilities for the Deck View by wrapping the multivariate logic.
 */
export const calculateProbabilities = (deckSize: number, targetCount: number, handSize: number) => {
  const result = [];
  const maxPossible = Math.min(targetCount, handSize);

  for (let i = 0; i <= maxPossible; i++) {
    // Exact probability for drawing exactly 'i' copies
    const exactProb = calculateMultivariateHyper(deckSize, handSize, [
      { id: 'tmp', name: 'tmp', countInDeck: targetCount, minDesired: i, maxDesired: i }
    ]);

    // Cumulative probability for drawing at least 'i' copies
    const atLeastProb = calculateMultivariateHyper(deckSize, handSize, [
      { id: 'tmp', name: 'tmp', countInDeck: targetCount, minDesired: i, maxDesired: handSize }
    ]);

    result.push({
      drawCount: i,
      exact: parseFloat(exactProb.toFixed(2)),
      cumulativeAtLeast: parseFloat(atLeastProb.toFixed(2))
    });
  }
  return result;
};

export interface SwissStanding {
  wins: number;
  losses: number;
  count: number;
  lowerBound: number;
  upperBound: number;
}

export const calculateSwissStandings = (numPlayers: number, numRounds: number): SwissStanding[] => {
  const standings: SwissStanding[] = [];
  const totalCombinations = 2 ** numRounds;

  for (let wins = numRounds; wins >= 0; wins--) {
    const losses = numRounds - wins;
    const ways = Number(combinations(numRounds, wins));
    const exactProb = ways / totalCombinations;
    const count = exactProb * numPlayers;
    const lowerBound = Math.floor(count);
    const upperBound = Math.max(lowerBound, Math.ceil(count));

    standings.push({ wins, losses, count, lowerBound, upperBound });
  }
  return standings;
};

export const calculateTopXProbability = (
  totalPlayers: number,
  totalRounds: number,
  targetRank: number,
  currentWins: number,
  currentLosses: number
): number => {
  const remainingRounds = totalRounds - (currentWins + currentLosses);
  if (remainingRounds < 0) return 0;
  if (targetRank >= totalPlayers) return 100;

  const standings = calculateSwissStandings(totalPlayers, totalRounds);
  const makeItChanceMap: Record<number, number> = {};
  let cumulativePlayers = 0;
  
  for (let i = 0; i < standings.length; i++) {
    const s = standings[i];
    const playersAtThisRecord = s.count;
    const prevCumulative = cumulativePlayers;
    cumulativePlayers += playersAtThisRecord;

    if (cumulativePlayers <= targetRank) {
      makeItChanceMap[s.wins] = 1.0;
    } else if (prevCumulative < targetRank) {
      makeItChanceMap[s.wins] = (targetRank - prevCumulative) / playersAtThisRecord;
    } else {
      makeItChanceMap[s.wins] = 0.0;
    }
  }

  let totalProbability = 0;
  const denominator = 2 ** remainingRounds;

  for (let i = 0; i <= remainingRounds; i++) {
    const finalWins = currentWins + i;
    const probGettingMoreWins = Number(combinations(remainingRounds, i)) / denominator;
    const chanceOfMakingItAtThatRecord = makeItChanceMap[finalWins] || 0;
    totalProbability += probGettingMoreWins * chanceOfMakingItAtThatRecord;
  }

  return parseFloat((totalProbability * 100).toFixed(2));
};