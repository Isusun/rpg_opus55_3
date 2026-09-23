#!/bin/bash
cd /c/workspace/claude/Opus5.5/tools
while IFS=$'\t' read -r name prompt; do
  printf '%s\0%s\0' "$name" "$prompt"
done < jobs.tsv | xargs -0 -n 2 -P 5 bash ./gen_one.sh
echo ALLDONE
