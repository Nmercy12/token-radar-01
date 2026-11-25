# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) [![rank](https://make.fun/badge/token-radar-01/Nmercy12/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) [![reward](https://make.fun/badge/token-radar-01/Nmercy12/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar is an autonomous intelligence system for evaluating and ranking pre-token decentralized finance protocols. It processes comprehensive protocol snapshots, applying rigorous econometric modeling, runtime OLS regression, token launch odds estimation, and multi-spec model selection to surface high-potential early-stage opportunities while segregating live-token assets and institutional exclusions.

Built with Node 22 standard library in erasable TypeScript, the radar fits an ordinary least squares (OLS) valuation model across fundamental TVL, category multiples, growth trajectories, and protocol age. Each ranked protocol is paired with an actionable 6-step farming plan, empirical token probability, expected value (EV), and GO/MARGINAL/SKIP verdicts.

## Run it
```sh
node main.ts --input ~/workspace/makefun/token-radar-01-kit/input/snapshot.json --output /tmp/tr-out
```

---
<sub>Entered on [make.fun](https://make.fun/?ref=stt5ry3a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
