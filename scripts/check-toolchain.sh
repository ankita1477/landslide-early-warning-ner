#!/usr/bin/env bash
# Phase 1 checkpoint: verify every required tool is installed.
pass=0; fail=0

check() {
  local name="$1" cmd="$2" want="$3"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf "  \033[32m✓\033[0m %-12s %s\n" "$name" "$($cmd $want 2>&1 | head -1)"
    pass=$((pass+1))
  else
    printf "  \033[31m✗\033[0m %-12s NOT INSTALLED\n" "$name"
    fail=$((fail+1))
  fi
}

echo ""
echo "Toolchain check"
echo "───────────────────────────────────────────────"
check "homebrew"  brew        --version
check "python3.11" python3.11 --version
check "node"      node        --version
check "docker"    docker      --version
check "gdal"      gdalinfo    --version
check "git"       git         --version
echo "───────────────────────────────────────────────"

if command -v docker >/dev/null 2>&1; then
  if docker ps >/dev/null 2>&1; then
    printf "  \033[32m✓\033[0m docker daemon is running\n"
  else
    printf "  \033[31m✗\033[0m docker installed but daemon NOT running — launch Docker Desktop\n"
    fail=$((fail+1))
  fi
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo -e "\033[32mAll $pass checks passed — Phase 1 complete.\033[0m"
  echo "Next:  make install && make up"
else
  echo -e "\033[31m$fail missing.\033[0m Install with:"
  echo "  brew install python@3.11 node@20 gdal"
  echo "  brew install --cask docker    # then launch Docker Desktop once"
  exit 1
fi
