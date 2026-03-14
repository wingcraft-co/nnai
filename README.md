---
title: NomadNavigator AI
emoji: 🌏
colorFrom: blue
colorTo: teal
sdk: gradio
sdk_version: 6.9.0
app_file: app.py
pinned: false
license: apache-2.0
short_description: AI 디지털 노마드 이민 설계 서비스
---

# 🌏 NomadNavigator AI

**디지털 노마드를 위한 AI 이민 설계 서비스**

국적 · 월 수입 · 라이프스타일을 입력하면
**Qwen3.5-27B** + **RAG** 기반으로 최적의 거주 국가와 도시를 추천하고
비자 체크리스트와 예산이 담긴 PDF 리포트를 즉시 생성합니다.

## 주요 기능
- 🎯 12개국 비자 정보 기반 맞춤 추천 (RAG)
- 💰 도시별 생활비 시뮬레이션 (20개 도시)
- 📋 비자 준비 체크리스트 자동 생성
- 📄 PDF 리포트 다운로드

## 기술 스택
- **AI**: Qwen3.5-27B (HuggingFace Inference Providers)
- **RAG**: BAAI/bge-m3 임베딩 + FAISS 벡터 검색
- **Frontend**: Gradio 6.x
- **PDF**: ReportLab

⚠️ 본 서비스는 참고용이며 법적 이민 조언이 아닙니다.
