import random
from collections import defaultdict, deque

STUDENTS = [f"i{k}" for k in range(1, 19)]
SCHOOLS = ["s1", "s2", "s3"]
CAP = {s: 6 for s in SCHOOLS}

def generate_market(rng):
    # student preferences: strict random ranking over schools
    prefs = {i: rng.sample(SCHOOLS, k=len(SCHOOLS)) for i in STUDENTS}
    # school priorities: strict random ranking over students
    prios = {s: rng.sample(STUDENTS, k=len(STUDENTS)) for s in SCHOOLS}
    return prefs, prios

def DA(prefs, prios):
    pr_rank = {s: {i: r for r, i in enumerate(prios[s])} for s in SCHOOLS}
    next_choice = {i: 0 for i in STUDENTS}
    held = {s: set() for s in SCHOOLS}
    free = deque(STUDENTS)

    while free:
        i = free.popleft()
        if next_choice[i] >= len(prefs[i]):
            continue
        s = prefs[i][next_choice[i]]
        next_choice[i] += 1
        held[s].add(i)

        if len(held[s]) > CAP[s]:
            sorted_held = sorted(held[s], key=lambda st: pr_rank[s][st])
            keep = set(sorted_held[:CAP[s]])
            reject = held[s] - keep
            held[s] = keep
            for rj in reject:
                free.append(rj)

    match = {i: None for i in STUDENTS}
    for s in SCHOOLS:
        for i in held[s]:
            match[i] = s
    return match


def IA(prefs, prios):
    """Immediate Acceptance (Boston mechanism)."""
    pr_rank = {s: {i: r for r, i in enumerate(prios[s])} for s in SCHOOLS}
    remaining = CAP.copy()
    match = {i: None for i in STUDENTS}
    unmatched = set(STUDENTS)

    for r in range(len(SCHOOLS)):
        if not unmatched:
            break

        apps = defaultdict(list)
        for i in unmatched:
            apps[prefs[i][r]].append(i)

        newly_matched = set()
        for s, applicants in apps.items():
            if remaining[s] == 0:
                continue

            ordered = sorted(applicants, key=lambda st: pr_rank[s][st])
            accepted = ordered[:remaining[s]]
            for i in accepted:
                match[i] = s
                newly_matched.add(i)
            remaining[s] -= len(accepted)

        unmatched -= newly_matched

    return match


def TTC(prefs, prios):
    """Top Trading Cycles for school choice with capacities."""
    pr_rank = {s: {i: r for r, i in enumerate(prios[s])} for s in SCHOOLS}
    remaining = CAP.copy()
    match = {i: None for i in STUDENTS}
    active_students = set(STUDENTS)
    next_choice = {i: 0 for i in STUDENTS}

    while active_students and any(remaining[s] > 0 for s in SCHOOLS):
        # Each active student points to top school with available capacity.
        student_to_school = {}
        students_without_options = []
        for i in list(active_students):
            while next_choice[i] < len(prefs[i]) and remaining[prefs[i][next_choice[i]]] == 0:
                next_choice[i] += 1

            if next_choice[i] >= len(prefs[i]):
                students_without_options.append(i)
            else:
                student_to_school[i] = prefs[i][next_choice[i]]

        for i in students_without_options:
            active_students.remove(i)

        if not student_to_school:
            break

        # Each school with remaining capacity points to highest-priority active student.
        school_to_student = {}
        for s in SCHOOLS:
            if remaining[s] == 0:
                continue
            top_student = min(active_students, key=lambda st: pr_rank[s][st])
            school_to_student[s] = top_student

        # Find one directed cycle (student-school graph has out-degree 1 for active nodes).
        start_student = next(iter(student_to_school))
        path = []
        first_seen = {}
        node = ("student", start_student)

        while node not in first_seen:
            first_seen[node] = len(path)
            path.append(node)
            if node[0] == "student":
                node = ("school", student_to_school[node[1]])
            else:
                node = ("student", school_to_student[node[1]])

        cycle = path[first_seen[node]:]

        # Assign every student in the cycle to the school they point to.
        assigned_pairs = []
        for kind, label in cycle:
            if kind == "student":
                i = label
                s = student_to_school[i]
                assigned_pairs.append((i, s))

        for i, s in assigned_pairs:
            if i in active_students and remaining[s] > 0 and match[i] is None:
                match[i] = s
                active_students.remove(i)
                remaining[s] -= 1

    return match


def print_matching(title, match):
    print(f"\n{title}")
    for i in STUDENTS:
        print(f"{i} -> {match[i]}")


def assigned_rank(prefs, student, school):
    # rank is 1-based (1 = top choice). If unmatched, use worst rank + 1.
    if school is None:
        return len(SCHOOLS) + 1
    return prefs[student].index(school) + 1


def average_rank_for_match(prefs, match):
    total = 0
    for i in STUDENTS:
        total += assigned_rank(prefs, i, match[i])
    return total / len(STUDENTS)


def run_efficiency_simulation(num_iterations=1000, seed=2026):
    rng = random.Random(seed)
    totals = {"DA": 0.0, "IA": 0.0, "TTC": 0.0}

    for _ in range(num_iterations):
        prefs, prios = generate_market(rng)
        totals["DA"] += average_rank_for_match(prefs, DA(prefs, prios))
        totals["IA"] += average_rank_for_match(prefs, IA(prefs, prios))
        totals["TTC"] += average_rank_for_match(prefs, TTC(prefs, prios))

    return {k: totals[k] / num_iterations for k in totals}


def print_efficiency_table(avg_ranks):
    print("\nPart 3: Efficiency Analysis (N = 1000)")
    print("Mechanism | Average assigned rank")
    print("----------|----------------------")
    for mech in ["DA", "IA", "TTC"]:
        print(f"{mech:<9} | {avg_ranks[mech]:.4f}")

    best = min(avg_ranks, key=avg_ranks.get)
    print(f"\nInterpretation: lower is better, and {best} has the best (lowest) average rank in this simulation.")


if __name__ == "__main__":
    rng = random.Random(42)
    prefs, prios = generate_market(rng)
    da_match = DA(prefs, prios)
    ia_match = IA(prefs, prios)
    ttc_match = TTC(prefs, prios)

    print("Student preferences:")
    for i in STUDENTS:
        print(f"{i}: {prefs[i]}")

    print("\nSchool priorities:")
    for s in SCHOOLS:
        print(f"{s}: {prios[s]}")

    print_matching("DA matching result:", da_match)
    print_matching("IA matching result:", ia_match)
    print_matching("TTC matching result:", ttc_match)

    avg_ranks = run_efficiency_simulation(num_iterations=1000, seed=2026)
    print_efficiency_table(avg_ranks)
