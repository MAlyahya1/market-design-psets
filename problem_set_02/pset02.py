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

