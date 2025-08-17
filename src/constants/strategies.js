export const DRAFT_STRATEGIES = [
  { key: 'balanced',  label: 'Balanced (default)', desc: 'Take best value, fill starters efficiently.' },
  { key: 'hero_rb',   label: 'Hero RB',            desc: 'Anchor RB early, then hammer WR/TE/QB value.' },
  { key: 'zero_rb',   label: 'Zero RB',            desc: 'Deprioritize early RBs; load WR/TE; hit RB value later.' },
  { key: 'elite_te',  label: 'Elite TE or Punt',   desc: 'Target an elite TE early, else wait and stream.' },
  { key: 'qb_early_sf', label: 'Early QB (Superflex)', desc: 'Prioritize QB in SF; aim for 2 starters early.' },
]
