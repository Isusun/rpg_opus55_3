#!/bin/bash
# usage: gen_one.sh name "prompt"
name="$1"; prompt="$2"
out="assets/raw/$name.png"
cd /c/workspace/claude/Opus5.5
if [ -f "$out" ]; then echo "skip $name"; exit 0; fi
codex exec --skip-git-repo-check --sandbox workspace-write -C "C:/workspace/claude/Opus5.5" "Use your built-in image generation tool to generate exactly ONE image with this description: $prompt --- After it is generated, copy the generated PNG file to $out (relative to the current workspace). Do not create or modify any other files. Reply only with the saved path." > "tools/logs/$name.log" 2>&1
if [ -f "$out" ]; then echo "ok $name"; else echo "FAIL $name"; fi
