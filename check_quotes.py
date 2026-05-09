import sys

with open('c:/Users/Zfaryana/Desktop/Hysys/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    sq = line.count("'") - line.count("\\'")
    if sq % 2 != 0:
        print(f"Line {i+1}: {line.strip()}")
