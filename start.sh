#!/bin/bash
cd "$(dirname "$0")"

# 기존 프로세스 정리
lsof -ti :7860 | xargs kill -9 2>/dev/null

python3 server.py
