# 🚗⚽ TURBO STRIKE — Arena de Carros

Jogo web 3D de futebol de carros inspirado em Rocket League. Acelere, pule, faça flips, colete boost e marque gols em arenas neon — sozinho contra a IA ou online com um amigo via P2P.

## ✨ Recursos

- **Gameplay 3D completo** com física própria: aceleração, drift, pulo, flip, boost aéreo, colisões, demolições e gols.
- **3 arenas temáticas** (Porto Neon, Dunas Solares e Frostbite) com iluminação, efeitos e placar.
- **Modos offline**: casual 1v1, 2v2 ou 3v3 contra IA com 5 níveis de dificuldade e partidas ranqueadas locais.
- **Multiplayer online P2P** via WebRTC/PeerJS: crie uma sala, compartilhe o código de 5 caracteres e jogue 1v1 ou 2v2 com bots completando os times.
- **Ranqueamento** com 8 divisões (Bronze → Lenda Supersônica), MMR separado para online e offline.
- **Garagem com 16 carros**: 5 gratuitos liberados por nível e 11 compráveis com créditos. Cada carro tem corpo, pintura e atributos próprios.
- **Progressão persistente**: XP, níveis, créditos, conquistas, bônus diário e estatísticas salvos no navegador.
- **HUD completo**: placar, cronômetro, velocímetro, medidor de boost, indicador supersônico e banners de gol.
- **Controles para PC e mobile**: teclado, gamepad e controles de toque com joystick virtual.
- **Áudio sintetizado** em tempo real: motor, boost, impactos, torcida, gols e interface.

## 🎮 Controles

| Ação | Teclado |
| --- | --- |
| Acelerar / ré | `W` / `S` (ou setas) |
| Virar | `A` / `D` (ou setas) |
| Pular / flip | `Espaço` |
| Boost | `Shift` |
| Drift | `Ctrl` |
| Câmera bola/carro | `C` |
| Air roll | `Q` / `E` |
| Pausar | `Esc` |

Gamepad e controles de toque também são suportados.

## 🕹️ Como jogar

1. **Jogar Agora**: escolha o formato, a dificuldade, a duração e a arena.
2. **Ranqueada**: partida local valendo MMR offline.
3. **Multijogador Online**: um jogador cria a sala e envia o código; o outro digita o código para entrar.
4. **Garagem**: equipe carros gratuitos ou compre novos modelos com os créditos ganhos nas partidas.
5. **Ranking**: acompanhe sua posição e seu MMR online/offline.

Dica: bata com o bico do carro para chutar mais forte, defenda ficando entre a bola e o gol e use boost para demolições.

## 🚀 Executar localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente `http://localhost:5173`).

### Build de produção

```bash
npm run build
npm run preview
```

O build é gerado em `dist/`.

## 🌐 Online

O multiplayer usa WebRTC diretamente entre os navegadores (PeerJS para sinalização). Para melhor conectividade, prefira a mesma rede ou uma internet com NAT aberto. Se uma sala não conectar, feche-a e crie outra.

## 🧱 Tecnologias

- [Three.js](https://threejs.org/) — renderização 3D
- [PeerJS](https://peerjs.com/) — multiplayer P2P
- [Vite](https://vite.dev/) — desenvolvimento e build
- Web Audio API, Gamepad API e LocalStorage

## 📁 Estrutura

```
src/
  main.js            Ponto de entrada e boot
  style.css          Interface e identidade visual
  core/              Áudio, entrada, rede e persistência
  data/              Catálogo de carros, arenas e ranking
  game/              Física, arena, modelos, bots, renderer e orquestração
  ui/                Menus, garagem, HUD, resultados e preview 3D
```

## 📄 Licença

Projeto original criado para fins de demonstração. Marcas e nomes de terceiros pertencem aos seus respectivos donos.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/flamengoomaiorsd-stack/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/flamengoomaiorsd-stack/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/flamengoomaiorsd-stack/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/flamengoomaiorsd-stack/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/flamengoomaiorsd-stack/PlayGround).
- 🛠️ [Check build runs](https://github.com/flamengoomaiorsd-stack/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/flamengoomaiorsd-stack/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/flamengoomaiorsd-stack).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->
