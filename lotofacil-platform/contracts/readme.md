# Lotofácil Platform

Plataforma modular para jogos, bolões e estratégias da Lotofácil, construída com arquitetura de microsserviços e identidade descentralizada.

## Visão Geral

Este projeto tem como objetivo criar uma plataforma escalável para:
- Cadastro e identidade de usuários
- Criação e gestão de bolões
- Geração de jogos e estratégias
- Divulgação pública de bolões
- Integração futura com identidade cripto (Nostr / Web3)

## Arquitetura

- Monorepo com serviços independentes
- Comunicação via contratos OpenAPI
- UUID como identificador interno
- Identidade flexível (tradicional e por chave pública)
- Preparado para integração blockchain

## Estrutura

/lotofacil-platform
├── contracts/          ← VERDADE DO SISTEMA
│   ├── auth.yaml
│   ├── wallet.yaml
│   ├── pools.yaml
│   ├── games.yaml
│   ├── results.yaml
│   ├── public.yaml
│   └── gateway.yaml
│
├── services/
│   ├── auth-service/
│   ├── wallet-service/
│   ├── pool-service/
│   ├── game-service/
│   ├── result-service/
│   ├── public-service/
│   └── gateway/
│
├── shared/
│   ├── identity-context.md
│   ├── error-codes.md
│   └── conventions.md
│
└── infra/
    ├── docker-compose.yml
    └── nginx/

## Status

🚧 Em desenvolvimento (MVP modular)
