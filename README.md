# Voo BQ — Minigame

Minigame controlado exclusivamente pela câmera. Mova o rosto para conduzir o pássaro pelos portais e acumular pontos.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm test
npm run build
```

## Requisitos

A câmera precisa estar disponível e a página deve ser servida por `localhost` ou HTTPS. O reconhecimento facial usa MediaPipe no navegador; nenhuma imagem é enviada a um servidor.
