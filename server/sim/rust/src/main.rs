// Rust port of ../simulate.ts — same rules, same bot logic, same PRNG and
// call order, so with default params the same seed prints the same table.
// Keep the two in sync (bots/decisions/*.ts is the source of truth).
//
//   cargo run --release -- [games_per_cell=10000] [players=7] [seed=1]
//   cargo run --release -- tune [games_per_player_count=4000] [rounds=3]
//
// `tune` searches the Hard bots' numeric knobs (the P_* table below) on all
// cores: Good's knobs to maximise Good wins, then Evil's to minimise them,
// alternating. Copy the printed values back into bots/decisions/*.ts.

use std::time::Instant;

#[derive(Clone, Copy, PartialEq)]
enum Role { Merlin, Percival, Loyal, Morgana, Assassin, Mordred, Oberon, Minion }

impl Role {
    fn is_evil(self) -> bool {
        matches!(self, Role::Morgana | Role::Assassin | Role::Mordred | Role::Oberon | Role::Minion)
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Diff { Easy, Medium, Hard }

#[derive(Clone, Copy, PartialEq)]
enum Status { Pending, Active, Passed, Failed }

#[derive(Clone, Copy)]
enum EndReason { ThreeFails, FiveRejects, MerlinKilled, MerlinSurvived }

// --- Tunable knobs of the Hard bots. Defaults = current TS literals. ---
const P_REJECT_MULT: usize = 0;      // teamVote: reject if worst P(evil) > base rate * this
const P_MERLIN_CONCEAL: usize = 1;   // teamVote: Merlin approves an Evil team nobody publicly doubts
const P_LK_PASS_EVIL: usize = 2;     // evilProbabilities: passed quest with Evil aboard
const P_LK_SEAT_EVIL: usize = 3;     //   Evil leader's team carries Evil
const P_LK_SEAT_CLEAN: usize = 4;    //   ...doesn't (= 1 - SEAT_EVIL)
const P_LK_APP_EVIL: usize = 5;      //   Evil voter approves a team carrying Evil
const P_LK_REJ_EVIL: usize = 6;      //   ...rejects it (= 1 - APP_EVIL)
const P_LK_APP_CLEAN: usize = 7;     //   Evil voter approves an all-Good team
const P_LK_REJ_CLEAN: usize = 8;     //   ...rejects it (= 1 - APP_CLEAN)
const P_Q1_BLUFF: usize = 9;         // questVote: chance Evil fails Quest 1
const P_REJECT_UNTIL: usize = 10;    // teamVote: Evil rejects all-Good teams while voteTrack <= this
const P_ASN_LEAD_CLEAN: usize = 11;  // assassination: proposed a clean team
const P_ASN_LEAD_EVIL: usize = 12;   //   proposed a team carrying Evil
const P_ASN_REJ_EVIL: usize = 13;    //   rejected a team carrying Evil
const P_ASN_APP_EVIL: usize = 14;    //   approved a team carrying Evil
const N_PARAMS: usize = 15;

type Params = [f64; N_PARAMS];
const DEFAULTS: Params = [1.05, 1.0, 0.1, 0.6, 0.4, 0.95, 0.05, 0.55, 0.45, 1.0, 0.0, 2.5, -2.0, 1.0, -1.0];

// server/constants.ts ROLE_CONFIGURATIONS
fn role_config(n: usize) -> Vec<Role> {
    use Role::*;
    match n {
        5 => vec![Merlin, Percival, Loyal, Morgana, Assassin],
        6 => vec![Merlin, Percival, Loyal, Loyal, Morgana, Assassin],
        7 => vec![Merlin, Percival, Loyal, Loyal, Morgana, Assassin, Minion],
        8 => vec![Merlin, Percival, Loyal, Loyal, Loyal, Morgana, Assassin, Minion],
        9 => vec![Merlin, Percival, Loyal, Loyal, Loyal, Loyal, Mordred, Morgana, Assassin],
        10 => vec![Merlin, Percival, Loyal, Loyal, Loyal, Loyal, Mordred, Morgana, Assassin, Minion],
        _ => panic!("players must be 5-10"),
    }
}

// server/constants.ts QUEST_CONFIGURATIONS: (teamSize, failsRequired)
fn quest_config(n: usize) -> [(usize, usize); 5] {
    match n {
        5 => [(2, 1), (3, 1), (2, 1), (3, 1), (3, 1)],
        6 => [(2, 1), (3, 1), (4, 1), (3, 1), (4, 1)],
        7 => [(2, 1), (3, 1), (3, 1), (4, 2), (4, 1)],
        _ => [(3, 1), (4, 1), (4, 1), (5, 2), (5, 1)], // 8-10
    }
}

// mulberry32, bit-identical to the JS version.
struct Rng(u32);

impl Rng {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let s = self.0;
        let mut t = (s ^ (s >> 15)).wrapping_mul(1 | s);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        (t ^ (t >> 14)) as f64 / 4294967296.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() * n as f64).floor() as usize
    }
}

fn shuffle<T>(v: &mut [T], rng: &mut Rng) {
    for i in (1..v.len()).rev() {
        let j = rng.below(i + 1);
        v.swap(i, j);
    }
}

struct PastVote { leader: usize, team: Vec<usize>, approves: Vec<bool> }

struct Quest {
    team_size: usize,
    fails_required: usize,
    status: Status,
    team: Vec<usize>,
    leader: Option<usize>,            // questLeader (set on approval)
    past_votes: Vec<PastVote>,
    approved: Option<Vec<bool>>,      // approvedVote.votes (its team is `team`)
    fails: usize,                     // FAIL count in results
}

// Sim-only opponent styles for robust tuning (humans aren't as consistent as
// the bots). All zero = the real bots, with no extra RNG draws, so parity holds.
#[derive(Clone, Copy, Default)]
struct Style {
    evil_trust_pass: f64,   // Hard Evil lets a quest pass to earn trust
    evil_vote_noise: f64,   // Hard Evil team votes flipped at random
    evil_q1: Option<f64>,   // overrides P_Q1_BLUFF
    good_vote_noise: f64,   // Hard Good team votes flipped at random
}

#[derive(Clone, Copy)]
enum Opp { Fixed, VaryEvil, VaryGood }

// Players are indices; player order == index order (as in gameState.players).
struct Game<'a> {
    roles: Vec<Role>,
    diff: Vec<Diff>,
    quests: Vec<Quest>,
    current: usize, // 0-based (gameState.currentQuest - 1)
    leader: usize,
    vote_track: u32,
    p: &'a Params,
    style: Style,
}

impl Game<'_> {
    fn n(&self) -> usize { self.roles.len() }
    fn failed(&self) -> usize { self.quests.iter().filter(|q| q.status == Status::Failed).count() }
    fn passed(&self) -> usize { self.quests.iter().filter(|q| q.status == Status::Passed).count() }
    fn evil_count(&self) -> usize { self.roles.iter().filter(|r| r.is_evil()).count() }
}

// bots/decisions/knowledge.ts getKnownEvil
fn known_evil(g: &Game, bot: usize) -> Vec<usize> {
    let r = g.roles[bot];
    (0..g.n())
        .filter(|&p| p != bot && g.roles[p].is_evil())
        .filter(|&p| match r {
            Role::Merlin => g.roles[p] != Role::Mordred,
            Role::Morgana | Role::Assassin | Role::Mordred | Role::Minion => g.roles[p] != Role::Oberon,
            _ => false,
        })
        .collect()
}

// knowledge.ts buildSuspicionScores (public facts only; the sim has no chat).
// Accumulates in the same order getPublicFacts appends, so float sums match.
fn suspicion(g: &Game) -> Vec<f64> {
    let mut s = vec![0.0; g.n()];
    for q in &g.quests {
        match q.status {
            Status::Failed => {
                for &m in &q.team { s[m] += 2.0; }
                if let Some(l) = q.leader { s[l] += 1.0; }
                if let Some(votes) = &q.approved {
                    if q.past_votes.len() < 4 {
                        for (p, &ok) in votes.iter().enumerate() {
                            if ok && !q.team.contains(&p) { s[p] += 0.75; }
                            if !ok { s[p] += -0.75; }
                        }
                    }
                }
            }
            Status::Passed => {
                for &m in &q.team { s[m] += -0.75; }
                for pv in &q.past_votes {
                    for (p, &ok) in pv.approves.iter().enumerate() {
                        if !ok { s[p] += 1.0; }
                    }
                }
            }
            _ => {}
        }
    }
    s
}

fn mask(ps: &[usize]) -> u32 { ps.iter().fold(0, |m, &p| m | 1 << p) }

// knowledge.ts evilProbabilities — same iteration and multiplication order.
fn evil_probabilities(g: &Game, bot: usize) -> Vec<f64> {
    let n = g.n();
    let prm = g.p;
    let evil_count = g.evil_count() as u32;
    let quests: Vec<(u32, u32, bool)> = g.quests.iter()
        .filter(|q| matches!(q.status, Status::Passed | Status::Failed))
        .map(|q| (mask(&q.team), q.fails as u32, q.status == Status::Passed))
        .collect();
    // (team, leader bit, votes) in the TS order: pastVotes then approvedVote.
    let mut proposals: Vec<(u32, u32, Vec<(u32, bool)>)> = vec![];
    for q in &g.quests {
        for pv in &q.past_votes {
            proposals.push((mask(&pv.team), 1 << pv.leader,
                pv.approves.iter().enumerate().map(|(p, &a)| (1u32 << p, a)).collect()));
        }
        if let Some(votes) = &q.approved {
            let forced = q.past_votes.len() >= 4;
            proposals.push((mask(&q.team), q.leader.map_or(0, |l| 1 << l),
                if forced { vec![] } else { votes.iter().enumerate().map(|(p, &a)| (1u32 << p, a)).collect() }));
        }
    }
    let self_bit = 1u32 << bot;
    let mystics: Vec<usize> = if g.roles[bot] == Role::Percival {
        (0..n).filter(|&p| matches!(g.roles[p], Role::Merlin | Role::Morgana)).collect()
    } else { vec![] };
    let mystic_mask = mask(&mystics);
    let evil_mystics = if mystics.len() == 2 { 1 } else { 0 };

    let mut total = 0.0;
    let mut evil_weight = vec![0.0; n];
    for set in 0u32..1 << n {
        if set & self_bit != 0 || set.count_ones() != evil_count { continue; }
        if mystic_mask != 0 && (set & mystic_mask).count_ones() != evil_mystics { continue; }

        let mut w = 1.0;
        for &(team, fails, passed) in &quests {
            let aboard = (set & team).count_ones();
            if aboard < fails { w = 0.0; break; }
            if passed && aboard > 0 { w *= prm[P_LK_PASS_EVIL]; }
        }
        if w == 0.0 { continue; }
        for (team, leader, votes) in &proposals {
            let has_evil = set & team != 0;
            w *= if leader & set != 0 {
                if has_evil { prm[P_LK_SEAT_EVIL] } else { prm[P_LK_SEAT_CLEAN] }
            } else { 0.5 };
            for &(bit, approve) in votes {
                if bit & set != 0 {
                    w *= match (has_evil, approve) {
                        (true, true) => prm[P_LK_APP_EVIL],
                        (true, false) => prm[P_LK_REJ_EVIL],
                        (false, true) => prm[P_LK_APP_CLEAN],
                        (false, false) => prm[P_LK_REJ_CLEAN],
                    };
                }
            }
        }
        total += w;
        for (i, ew) in evil_weight.iter_mut().enumerate() {
            if set & (1 << i) != 0 { *ew += w; }
        }
    }
    evil_weight.iter().map(|&ew| if total != 0.0 { ew / total } else { 0.0 }).collect()
}

fn sort_by_score(v: &mut [usize], s: &[f64]) {
    v.sort_by(|&a, &b| s[a].partial_cmp(&s[b]).unwrap()); // stable, like Array.sort
}

// bots/decisions/teamSelection.ts
fn select_team(g: &Game, bot: usize, size: usize, rng: &mut Rng) -> Vec<usize> {
    let known = known_evil(g, bot);
    let others: Vec<usize> = (0..g.n()).filter(|&p| p != bot).collect();
    let evil = g.roles[bot].is_evil();

    match g.diff[bot] {
        Diff::Easy => {
            let mut pool: Vec<usize> = if rng.next() < 0.5 { (0..g.n()).collect() } else { others };
            shuffle(&mut pool, rng);
            pool.truncate(size);
            pool
        }
        Diff::Medium if evil => {
            if g.vote_track >= 3 || g.current == 0 {
                let s = suspicion(g);
                let mut all: Vec<usize> = (0..g.n()).collect();
                sort_by_score(&mut all, &s);
                all.truncate(size);
                return all;
            }
            let mut team = vec![bot];
            if let Some(&a) = known.first() { team.push(a); }
            let mut fill: Vec<usize> = others.into_iter().filter(|p| !team.contains(p)).collect();
            shuffle(&mut fill, rng);
            while team.len() < size {
                match fill.pop() { Some(p) => team.push(p), None => break }
            }
            team
        }
        Diff::Medium => {
            let s = suspicion(g);
            let mut safe: Vec<usize> = others.into_iter().filter(|p| !known.contains(p)).collect();
            shuffle(&mut safe, rng);
            sort_by_score(&mut safe, &s);
            let mut team = vec![bot];
            team.extend(safe);
            team.truncate(size);
            team
        }
        Diff::Hard if evil => {
            let s = suspicion(g);
            let mut allies = known.clone();
            sort_by_score(&mut allies, &s);
            let mut team = vec![bot];
            if g.quests[g.current].fails_required == 2 && !allies.is_empty() { team.push(allies[0]); }
            let mut fill: Vec<usize> = others.into_iter().filter(|p| !known.contains(p)).collect();
            sort_by_score(&mut fill, &s);
            fill.extend(allies);
            for p in fill {
                if team.len() >= size { break; }
                if !team.contains(&p) { team.push(p); }
            }
            team
        }
        Diff::Hard => {
            let s = evil_probabilities(g, bot);
            let mut safe: Vec<usize> = if g.roles[bot] == Role::Merlin {
                others.into_iter().filter(|p| !known.contains(p)).collect()
            } else {
                others
            };
            sort_by_score(&mut safe, &s);
            let mut team = vec![bot];
            team.extend(safe);
            team.truncate(size);
            team
        }
    }
}

fn team_vote(g: &Game, bot: usize, rng: &mut Rng) -> bool {
    let vote = team_vote_bot(g, bot, rng);
    if g.diff[bot] != Diff::Hard || g.vote_track >= 4 { return vote; }
    let noise = if g.roles[bot].is_evil() { g.style.evil_vote_noise } else { g.style.good_vote_noise };
    if noise > 0.0 && rng.next() < noise { !vote } else { vote }
}

// bots/decisions/teamVote.ts — true = APPROVE
fn team_vote_bot(g: &Game, bot: usize, rng: &mut Rng) -> bool {
    let track = g.vote_track;
    let team = &g.quests[g.current].team;
    let known = known_evil(g, bot);
    let known_on_team = known.iter().any(|p| team.contains(p));

    if track >= 4 { return true; }
    match g.diff[bot] {
        Diff::Easy => rng.next() < 0.6,
        Diff::Medium if g.roles[bot].is_evil() => known_on_team || track > 1,
        Diff::Medium => {
            if known_on_team { return false; }
            let s = suspicion(g);
            let avg = team.iter().fold(0.0, |acc, &p| acc + s[p]) / team.len() as f64;
            if avg >= 1.5 { return rng.next() >= 0.7; }
            true
        }
        Diff::Hard if g.roles[bot].is_evil() => {
            if team.contains(&bot) || known_on_team { return true; }
            if g.passed() == 2 { return false; }
            track as f64 > g.p[P_REJECT_UNTIL]
        }
        Diff::Hard => {
            let aboard: Vec<usize> = known.iter().copied().filter(|p| team.contains(p)).collect();
            if !aboard.is_empty() {
                let s = suspicion(g);
                let no_public_case = aboard.iter().all(|&p| s[p] <= 0.0);
                // TS draws no random number at 1.0 (always conceal); match it for parity.
                let conceal = g.p[P_MERLIN_CONCEAL];
                return no_public_case && (conceal >= 1.0 || rng.next() < conceal);
            }
            let pe = evil_probabilities(g, bot);
            let base = g.evil_count() as f64 / (g.n() - 1) as f64;
            let worst = team.iter().map(|&p| pe[p]).fold(f64::NEG_INFINITY, f64::max);
            worst <= base * g.p[P_REJECT_MULT]
        }
    }
}

// bots/decisions/questVote.ts — only called for Evil bots; true = FAIL
fn quest_fail(g: &Game, bot: usize, rng: &mut Rng) -> bool {
    let quest = &g.quests[g.current];
    let failed = g.failed();
    let known = known_evil(g, bot);
    let is_evil_ally = |p: usize| p == bot || known.contains(&p);
    let evil_count = quest.team.iter().filter(|&&p| is_evil_ally(p)).count();

    match g.diff[bot] {
        Diff::Easy => rng.next() < 0.3,
        Diff::Medium => {
            if failed == 2 { return rng.next() < 0.85; }
            if quest.fails_required == 2 { return evil_count >= 2 && rng.next() < 0.75; }
            rng.next() < if failed == 0 { 0.4 } else { 0.65 }
        }
        Diff::Hard => {
            if failed == 2 { return true; }
            if quest.fails_required == 2 { return evil_count >= 2; }
            if quest.team.iter().copied().find(|&p| is_evil_ally(p)) != Some(bot) { return false; }
            let q1 = g.style.evil_q1.unwrap_or(g.p[P_Q1_BLUFF]);
            if g.current == 0 && q1 < 1.0 { return rng.next() < q1; } // TS: no draw at 1.0
            if g.style.evil_trust_pass > 0.0 && rng.next() < g.style.evil_trust_pass { return false; }
            true
        }
    }
}

// bots/decisions/assassination.ts
fn assassinate(g: &Game, bot: usize, rng: &mut Rng) -> Option<usize> {
    let known = known_evil(g, bot);
    let candidates: Vec<usize> = (0..g.n()).filter(|&p| p != bot && !known.contains(&p)).collect();
    if candidates.is_empty() { return None; }

    let best = |score: &dyn Fn(usize) -> f64| {
        let mut scored: Vec<(usize, f64)> = candidates.iter().map(|&p| (p, score(p))).collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        scored[0].0
    };

    match g.diff[bot] {
        Diff::Easy => Some(candidates[rng.below(candidates.len())]),
        Diff::Medium => {
            let top = best(&|p| {
                let mut score = 0.0;
                for q in g.quests.iter().filter(|q| q.status == Status::Passed) {
                    if q.team.contains(&p) { score += 1.5; }
                    if q.leader == Some(p) { score += 2.0; }
                }
                score
            });
            Some(if rng.next() < 0.70 { top } else { candidates[rng.below(candidates.len())] })
        }
        Diff::Hard => Some(best(&|p| {
            let prm = g.p;
            let mut score = 0.0;
            for q in &g.quests {
                let approved = q.approved.as_ref().map(|v| (q.leader, &q.team, v));
                let proposals = q.past_votes.iter().map(|pv| (Some(pv.leader), &pv.team, &pv.approves)).chain(approved);
                for (leader, team, votes) in proposals {
                    let has_evil = team.iter().any(|t| known.contains(t));
                    if leader == Some(p) {
                        score += if has_evil { prm[P_ASN_LEAD_EVIL] } else { prm[P_ASN_LEAD_CLEAN] };
                    }
                    if !has_evil { continue; }
                    score += if votes[p] { prm[P_ASN_APP_EVIL] } else { prm[P_ASN_REJ_EVIL] };
                }
            }
            score // chat term is 0: no chat in the sim
        })),
    }
}

fn play_game(n: usize, good: Diff, evil: Diff, p: &Params, rng: &mut Rng) -> EndReason {
    play_game_counting(n, good, evil, p, Style::default(), rng, &mut 0)
}

// `rejected` += proposals voted down (the tuner caps this so bots can't win by stalling).
fn play_game_counting(n: usize, good: Diff, evil: Diff, p: &Params, style: Style, rng: &mut Rng, rejected: &mut u32) -> EndReason {
    let mut roles = role_config(n);
    shuffle(&mut roles, rng);
    let diff = roles.iter().map(|r| if r.is_evil() { evil } else { good }).collect();
    let quests = quest_config(n)
        .iter()
        .enumerate()
        .map(|(i, &(team_size, fails_required))| Quest {
            team_size, fails_required,
            status: if i == 0 { Status::Active } else { Status::Pending },
            team: vec![], leader: None, past_votes: vec![], approved: None, fails: 0,
        })
        .collect();
    let leader = rng.below(n);
    let mut g = Game { roles, diff, quests, current: 0, leader, vote_track: 0, p, style };

    loop {
        let size = g.quests[g.current].team_size;
        let ids = select_team(&g, g.leader, size, rng);
        let team: Vec<usize> = (0..n).filter(|p| ids.contains(p)).collect();
        assert_eq!(team.len(), size, "bot proposed a wrong-size team");
        g.quests[g.current].team = team;

        let approves: Vec<bool> = (0..n).map(|p| team_vote(&g, p, rng)).collect();
        let approvals = approves.iter().filter(|&&a| a).count();

        if approvals * 2 <= n {
            g.vote_track += 1;
            *rejected += 1;
            let leader = g.leader;
            let q = &mut g.quests[g.current];
            let team = std::mem::take(&mut q.team);
            q.past_votes.push(PastVote { leader, team, approves });
            if g.vote_track >= 5 { return EndReason::FiveRejects; }
            g.leader = (g.leader + 1) % n;
            continue;
        }

        g.vote_track = 0;
        g.quests[g.current].leader = Some(g.leader);
        g.quests[g.current].approved = Some(approves);

        let team = g.quests[g.current].team.clone();
        let fails = team.iter().filter(|&&p| g.roles[p].is_evil() && quest_fail(&g, p, rng)).count();
        let q = &mut g.quests[g.current];
        q.fails = fails;
        q.status = if fails >= q.fails_required { Status::Failed } else { Status::Passed };

        if g.failed() >= 3 { return EndReason::ThreeFails; }
        if g.passed() >= 3 {
            let assassin = (0..n).find(|&p| g.roles[p] == Role::Assassin).unwrap();
            return match assassinate(&g, assassin, rng) {
                Some(t) if g.roles[t] == Role::Merlin => EndReason::MerlinKilled,
                _ => EndReason::MerlinSurvived,
            };
        }
        g.current += 1;
        g.quests[g.current].status = Status::Active;
        g.leader = (g.leader + 1) % n;
    }
}

// Mirrors JS toFixed(1): rounds the double's exact decimal value, ties up.
// {:.60} is exact here (a double <= 100 has < 60 fractional decimal digits).
fn pct(num: usize, den: usize) -> String {
    let exact = format!("{:.60}", 100.0 * num as f64 / den as f64);
    let (int, frac) = exact.split_once('.').unwrap();
    let frac = frac.as_bytes();
    let tenths = int.parse::<u64>().unwrap() * 10 + (frac[0] - b'0') as u64 + (frac[1] >= b'5') as u64;
    format!("{:>6}", format!("{}.{}%", tenths / 10, tenths % 10))
}

fn commas(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 { out.push(','); }
        out.push(c);
    }
    out
}

fn matrix(games: usize, n: usize, seed: u32) {
    let mut rng = Rng(seed);
    println!("{games} games per cell, {n} players, seed {seed}\n");
    println!("good   evil   | Good win | 3 fails  5 rejects  Merlin hit  Merlin safe | assassin accuracy");

    let levels = [(Diff::Easy, "easy"), (Diff::Medium, "medium"), (Diff::Hard, "hard")];
    let start = Instant::now();
    for &(good, gname) in &levels {
        for &(evil, ename) in &levels {
            let mut c = [0usize; 4];
            for _ in 0..games { c[play_game(n, good, evil, &DEFAULTS, &mut rng) as usize] += 1; }
            let [fails, rejects, killed, survived] = c;
            let assassinations = killed + survived;
            println!(
                "{gname:<6} {ename:<6} |  {}  | {}   {}     {}      {}  | {}",
                pct(survived, games), pct(fails, games), pct(rejects, games),
                pct(killed, games), pct(survived, games),
                if assassinations > 0 { pct(killed, assassinations) } else { "   n/a".into() },
            );
        }
    }
    let secs = start.elapsed().as_secs_f64();
    let good_count = role_config(n).iter().filter(|r| !r.is_evil()).count();
    println!("\nRandom assassin baseline: {} (1 of {good_count} Good players)", pct(1, good_count).trim());
    let total = 9 * games as u64;
    println!("{} games in {secs:.2}s = {} games/sec", commas(total), commas((total as f64 / secs).round() as u64));
}

// ---------------------------------------------------------------- tuning

// Hard-vs-Hard Good win rate per player count (5..=10), all cores. The same
// `seed` gives every candidate the same deals (common random numbers), so
// comparisons between candidates are much less noisy than independent runs.
fn good_win_rates(p: &Params, games: usize, seed: u32, opp: Opp) -> ([f64; 6], f64) {
    let threads = std::thread::available_parallelism().map_or(8, |t| t.get());
    let mut out = [0.0; 6];
    let mut rejected_total = 0u64;
    for (k, n) in (5..=10).enumerate() {
        let (wins, rejected): (usize, u64) = std::thread::scope(|s| {
            let handles: Vec<_> = (0..threads).map(|t| s.spawn(move || {
                let (mut wins, mut rejected) = (0, 0u64);
                for i in (t..games).step_by(threads) {
                    // one independent stream per game index, identical across candidates
                    let mut rng = Rng(seed ^ (n as u32) << 24 ^ (i as u32).wrapping_mul(0x9e3779b9));
                    let style = match opp {
                        Opp::Fixed => Style::default(),
                        Opp::VaryEvil => Style { evil_trust_pass: 0.4 * rng.next(), evil_vote_noise: 0.25 * rng.next(), evil_q1: Some(rng.next()), good_vote_noise: 0.0 },
                        Opp::VaryGood => Style { good_vote_noise: 0.15 * rng.next(), ..Style::default() },
                    };
                    let mut r = 0;
                    if matches!(play_game_counting(n, Diff::Hard, Diff::Hard, p, style, &mut rng, &mut r), EndReason::MerlinSurvived) { wins += 1; }
                    rejected += r as u64;
                }
                (wins, rejected)
            })).collect();
            handles.into_iter().map(|h| h.join().unwrap()).fold((0, 0), |a, b| (a.0 + b.0, a.1 + b.1))
        });
        out[k] = wins as f64 / games as f64;
        rejected_total += rejected;
    }
    (out, rejected_total as f64 / (6 * games) as f64)
}

fn mean(xs: &[f64; 6]) -> f64 { xs.iter().sum::<f64>() / 6.0 }

struct Knob { name: &'static str, idx: usize, good_side: bool, steps: &'static [f64], lo: f64, hi: f64, complement: Option<usize> }

const KNOBS: &[Knob] = &[
    Knob { name: "reject_mult", idx: P_REJECT_MULT, good_side: true, steps: &[-0.15, -0.05, 0.05, 0.15], lo: 0.8, hi: 2.0, complement: None },
    Knob { name: "merlin_conceal", idx: P_MERLIN_CONCEAL, good_side: true, steps: &[-0.2, -0.1, 0.1, 0.2], lo: 0.0, hi: 1.0, complement: None },
    Knob { name: "lk_pass_evil", idx: P_LK_PASS_EVIL, good_side: true, steps: &[-0.15, -0.05, 0.05, 0.15], lo: 0.1, hi: 1.0, complement: None },
    Knob { name: "lk_seat_evil", idx: P_LK_SEAT_EVIL, good_side: true, steps: &[-0.1, -0.05, 0.05], lo: 0.5, hi: 0.95, complement: Some(P_LK_SEAT_CLEAN) },
    Knob { name: "lk_app_evil", idx: P_LK_APP_EVIL, good_side: true, steps: &[-0.15, -0.05, 0.05, 0.15], lo: 0.5, hi: 0.95, complement: Some(P_LK_REJ_EVIL) },
    Knob { name: "lk_app_clean", idx: P_LK_APP_CLEAN, good_side: true, steps: &[-0.15, -0.05, 0.05, 0.15], lo: 0.15, hi: 0.85, complement: Some(P_LK_REJ_CLEAN) },
    Knob { name: "q1_bluff", idx: P_Q1_BLUFF, good_side: false, steps: &[-0.2, -0.1, 0.1, 0.2], lo: 0.0, hi: 1.0, complement: None },
    Knob { name: "reject_until", idx: P_REJECT_UNTIL, good_side: false, steps: &[-2.0, -1.0, 1.0, 2.0], lo: -1.0, hi: 3.0, complement: None },
    Knob { name: "asn_lead_clean", idx: P_ASN_LEAD_CLEAN, good_side: false, steps: &[-0.5, 0.5, 1.0, 2.0], lo: -2.0, hi: 4.0, complement: None },
    Knob { name: "asn_lead_evil", idx: P_ASN_LEAD_EVIL, good_side: false, steps: &[-2.0, -1.0, 1.0, 2.0], lo: -6.0, hi: 0.0, complement: None },
    Knob { name: "asn_rej_evil", idx: P_ASN_REJ_EVIL, good_side: false, steps: &[-1.0, -0.5, 0.5, 1.0], lo: 0.0, hi: 3.0, complement: None },
    Knob { name: "asn_app_evil", idx: P_ASN_APP_EVIL, good_side: false, steps: &[-1.0, -0.5, 0.5, 1.0], lo: -3.0, hi: 0.0, complement: None },
];

fn with(p: &Params, k: &Knob, v: f64) -> Params {
    let mut q = *p;
    q[k.idx] = v;
    if let Some(c) = k.complement { q[c] = 1.0 - v; }
    q
}

fn print_params(p: &Params) {
    for k in KNOBS { print!("{}={} ", k.name, (p[k.idx] * 1000.0).round() / 1000.0); }
    println!();
}

fn tune(games: usize, rounds: usize) {
    // ponytail: coordinate search, one knob at a time; a joint optimiser (CMA-ES) if knobs interact a lot.
    let min_gain = 0.004; // ~1.5 sigma at 4000 games x 6 player counts with common random numbers
    let mut p = DEFAULTS;
    let start = Instant::now();
    // No winning by stalling: never reject more teams per game than the shipped
    // bots (DEFAULTS) do. No slack, or each re-run would ratchet the cap up.
    let opp_for = |good_side: bool| if good_side { Opp::VaryEvil } else { Opp::VaryGood };
    let caps = [false, true].map(|gs| good_win_rates(&DEFAULTS, games, 1, opp_for(gs)).1);
    println!("rejection caps (rejected teams per game): tuning Evil {:.2}, tuning Good {:.2}", caps[0], caps[1]);
    print!("start: "); print_params(&p);
    for round in 1..=rounds {
        for good_side in [true, false] {
            let seed = (round * 2 + good_side as usize) as u32 * 7919;
            let side = if good_side { 1.0 } else { -1.0 }; // Evil maximises -GoodWin
            let opp = opp_for(good_side);
            let reject_cap = caps[good_side as usize];
            let mut base = mean(&good_win_rates(&p, games, seed, opp).0);
            for k in KNOBS.iter().filter(|k| k.good_side == good_side) {
                let mut best: Option<(f64, f64)> = None;
                for &step in k.steps {
                    let v = (p[k.idx] + step).clamp(k.lo, k.hi);
                    if (v - p[k.idx]).abs() < 1e-9 { continue; }
                    let (rates, rejects) = good_win_rates(&with(&p, k, v), games, seed, opp);
                    if rejects > reject_cap { continue; }
                    let score = mean(&rates);
                    if best.map_or(true, |(_, s)| side * score > side * s) { best = Some((v, score)); }
                }
                if let Some((v, score)) = best {
                    if side * (score - base) > min_gain {
                        println!("  round {round} {:<5} {:<15} {:>7.3} -> {:<7.3} good win {:.1}% -> {:.1}%",
                            if good_side { "GOOD" } else { "EVIL" }, k.name, p[k.idx], v, base * 100.0, score * 100.0);
                        p = with(&p, k, v);
                        base = score;
                    }
                }
            }
        }
        print!("after round {round} ({:.0}s): ", start.elapsed().as_secs_f64()); print_params(&p);
    }
    // Fresh seed for the report so tuning noise doesn't flatter the result.
    for (label, opp) in [("bots as-is", Opp::Fixed), ("varied Evil", Opp::VaryEvil), ("varied Good", Opp::VaryGood)] {
        let (before, rej_before) = good_win_rates(&DEFAULTS, games * 2, 424242, opp);
        let (after, rej_after) = good_win_rates(&p, games * 2, 424242, opp);
        println!("\nHard vs Hard Good win, {label}, fresh seed ({} games per count); rejected teams/game {rej_before:.2} -> {rej_after:.2}", games * 2);
        println!("players   defaults   tuned");
        for (k, n) in (5..=10).enumerate() { println!("{n:>7}   {:>7.1}%  {:>6.1}%", before[k] * 100.0, after[k] * 100.0); }
    }
    println!("\nFull vector (P_* order): {:?}", p);
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("tune") {
        let games = args.get(1).map_or(4000, |a| a.parse().expect("numeric games"));
        let rounds = args.get(2).map_or(3, |a| a.parse().expect("numeric rounds"));
        return tune(games, rounds);
    }
    let nums: Vec<usize> = args.iter().map(|a| a.parse().expect("numeric args")).collect();
    matrix(*nums.first().unwrap_or(&10000), *nums.get(1).unwrap_or(&7), *nums.get(2).unwrap_or(&1) as u32);
}
