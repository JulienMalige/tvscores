# The App Store listing

The words and pictures of the store page, in its four languages (AGENTS.md:
fr-FR, en-US, pt-BR, es-ES). Written on 2026-10-27 and entered in App Store
Connect the same day at Julien's word ("Yes please"); the app's primary
language there is en-US. This file is the source: change the words here, then
`node scripts/store-listing.mjs` checks every field against Apple's limits and
`node scripts/store-listing.mjs push` sends whatever differs to the tvOS
version being prepared (`--dry-run` lists it first). Apple once answered a
change with a 500 and took it on the next try (2026-10-27): run the push
again, it sends only what is left.

What the words follow:

- **No league, team or broadcaster in the keywords.** Guideline 2.3.7 turns
  away metadata packed with trademarked terms. The description names the
  competitions plainly, which is what they are there for, and says the app
  has no tie to them, as the website does.
- **No price** in the name, subtitle or keywords (2.3.7 again).
- **Keywords skip the words of the name and subtitle**, which Apple indexes
  already, and leave no space after a comma: 100 characters go fast.
- **The subtitle says what sets the app apart** from "Scores TV" and
  "ScoreTV" (README, Store identity): where to watch. It replaces the
  2026-09-13 drafts ("Today's games, live"), written before How to Watch.
- **The facts are the website's**: the same competitions, countries and
  promises as `site/`, so the two never disagree.

The same in every language:

- Name: TV Scores
- Category: Sports
- Price: free, no in-app purchase
- Copyright: 2026 Julien Malige
- Support URL: `https://tvscores.julienmalige.com/<lang>/support`
- Marketing URL: `https://tvscores.julienmalige.com/<lang>/`
- Privacy policy URL: `https://tvscores.julienmalige.com/<lang>/privacy`

with `<lang>` = `en`, `fr`, `pt`, `es`.

Screenshots: `.github/workflows/store-shots.yml`, six per language at
3840x2160, on live data with that storefront's language, clock and channels
(Spain uses the US list, which carries the Spanish-language channels). Run
it when the board is busy; the pictures show whatever is on. Look at them,
then `gh run download <run id> -n store-shots -D <folder>` and
`node scripts/store-shots.mjs <folder>` replace each language's set in App
Store Connect and wait until Apple has accepted every picture, which took
several minutes on 2026-10-27. The set uploaded that day (run 40505250408, a
Tuesday midday) stands in until a busier day's.

## en-US

### Subtitle

Live scores & where to watch

### Promotional text

Live scores, standings and race weekends on your Apple TV, with the channel each game is on and a button that opens the app showing it.

### Keywords

football,soccer,basketball,tennis,racing,motorsport,standings,fixtures,results,schedule,channels

### Description

TV Scores brings the scores to the biggest screen in the house: today's games live, with the minute of play, yesterday's results, what's coming next and, for every game, where to watch it.

WHERE TO WATCH
Each game shows its TV channels in France, the United States and Brazil: choose one country, several or none. How to Watch opens the broadcaster's app or the streaming service straight from the game, or its App Store page when the app isn't installed.

EVERY GAME IN DEPTH
For football, the NFL and the NBA: the score by period, the statistics, goals and cards, both teams' records and the table the result moves.

RACE WEEKENDS
Formula 1 and MotoGP: qualifying, the sprint and the race at your local time, then the starting grid, the full result and the championships for drivers and teams.

THE COMPETITIONS
Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Copa Libertadores, Brasileirão, the Nations League and international friendlies; the NFL and the NBA; Formula 1 and MotoGP; ATP and WTA tennis.

YOURS TO ARRANGE
Keep the competitions you follow, in the order you like. Times follow your time zone, and the app speaks English, French, Portuguese and Spanish.

PRIVATE
No account, no ads, no tracking. Your choices stay on your Apple TV.

TV Scores is not affiliated with the leagues, teams, players or broadcasters it shows.

## fr-FR

### Subtitle

Scores en direct, où regarder

### Promotional text

Scores en direct, classements et week-ends de course sur votre Apple TV, avec la chaîne de chaque match et un bouton qui ouvre l'app qui le diffuse.

### Keywords

football,foot,basket,tennis,course,formule,moto,classement,résultats,calendrier,chaînes,match

### Description

TV Scores met les scores sur le plus grand écran de la maison : les matchs du jour en direct, avec la minute de jeu, les résultats de la veille, ce qui arrive ensuite et, pour chaque match, où le regarder.

OÙ REGARDER
Chaque match affiche ses chaînes en France, aux États-Unis et au Brésil : choisissez un pays, plusieurs ou aucun. Où regarder ouvre l'app du diffuseur ou du service de streaming directement depuis le match, ou sa page sur l'App Store quand l'app n'est pas installée.

CHAQUE MATCH EN DÉTAIL
Pour le football, la NFL et la NBA : le score par période, les statistiques, les buts et les cartons, le bilan des deux équipes et le classement que le résultat fait bouger.

LES WEEK-ENDS DE COURSE
Formule 1 et MotoGP : les qualifications, le sprint et la course à votre heure, puis la grille de départ, le résultat complet et les championnats pilotes et équipes.

LES COMPÉTITIONS
Premier League, Liga, Serie A, Bundesliga, Ligue 1, Ligue des champions, Ligue Europa, Copa Libertadores, Brasileirão, Ligue des nations et matchs amicaux internationaux ; la NFL et la NBA ; la Formule 1 et le MotoGP ; le tennis ATP et WTA.

À VOTRE GOÛT
Gardez les compétitions que vous suivez, dans l'ordre qui vous plaît. Les horaires suivent votre fuseau horaire, et l'app parle français, anglais, portugais et espagnol.

CONFIDENTIALITÉ
Ni compte, ni publicité, ni pistage. Vos choix restent sur votre Apple TV.

TV Scores n'a aucun lien avec les ligues, équipes, joueurs ou diffuseurs qu'elle affiche.

## pt-BR

### Subtitle

Placar ao vivo e onde assistir

### Promotional text

Placares ao vivo, tabelas e fins de semana de corrida na sua Apple TV, com o canal de cada jogo e um botão que abre o app que transmite.

### Keywords

futebol,basquete,tênis,fórmula,corrida,moto,tabela,classificação,resultados,jogos,canais,programação

### Description

O TV Scores leva os placares para a maior tela da casa: os jogos do dia ao vivo, com o minuto de jogo, os resultados de ontem, o que vem por aí e, para cada jogo, onde assistir.

ONDE ASSISTIR
Cada jogo mostra os canais no Brasil, nos Estados Unidos e na França: escolha um país, vários ou nenhum. Onde assistir abre o app da emissora ou do serviço de streaming direto do jogo, ou a página dele na App Store quando o app não está instalado.

CADA JOGO EM DETALHES
No futebol, na NFL e na NBA: o placar por período, as estatísticas, os gols e cartões, a campanha dos dois times e a tabela que o resultado mexe.

FINS DE SEMANA DE CORRIDA
Fórmula 1 e MotoGP: o treino classificatório, a sprint e a corrida no seu horário, depois o grid de largada, o resultado completo e os campeonatos de pilotos e de equipes.

AS COMPETIÇÕES
Brasileirão, Copa Libertadores, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Liga das Nações e amistosos de seleções; a NFL e a NBA; a Fórmula 1 e a MotoGP; o tênis da ATP e da WTA.

DO SEU JEITO
Fique com as competições que você acompanha, na ordem que preferir. Os horários seguem o seu fuso, e o app fala português, inglês, francês e espanhol.

PRIVACIDADE
Sem conta, sem anúncios, sem rastreamento. As suas escolhas ficam na sua Apple TV.

O TV Scores não tem ligação com as ligas, equipes, jogadores ou emissoras que mostra.

## es-ES

### Subtitle

Resultados y dónde verlo

### Promotional text

Resultados en directo, clasificaciones y fines de semana de carreras en tu Apple TV, con el canal de cada partido y un botón que abre la app que lo emite.

### Keywords

fútbol,baloncesto,tenis,fórmula,motociclismo,directo,marcadores,clasificación,canales,partidos

### Description

TV Scores lleva los resultados a la pantalla más grande de casa: los partidos de hoy en directo, con el minuto de juego, los resultados de ayer, lo que viene después y, para cada partido, dónde verlo.

DÓNDE VERLO
Cada partido muestra sus canales en Francia, Estados Unidos y Brasil: elige un país, varios o ninguno. Dónde ver abre la app de la cadena o del servicio de streaming directamente desde el partido, o su página en el App Store si la app no está instalada.

CADA PARTIDO, A FONDO
En el fútbol, la NFL y la NBA: el marcador por periodos, las estadísticas, los goles y las tarjetas, el balance de los dos equipos y la clasificación que mueve el resultado.

FINES DE SEMANA DE CARRERAS
Fórmula 1 y MotoGP: la sesión de clasificación, el sprint y la carrera a tu hora, y después la parrilla de salida, el resultado completo y los mundiales de pilotos y de equipos.

LAS COMPETICIONES
LaLiga, Premier League, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Copa Libertadores, Brasileirão, Liga de Naciones y amistosos internacionales; la NFL y la NBA; la Fórmula 1 y MotoGP; el tenis de la ATP y la WTA.

A TU MANERA
Quédate con las competiciones que sigues, en el orden que prefieras. Los horarios siguen tu zona horaria, y la app habla español, inglés, francés y portugués.

PRIVACIDAD
Sin cuenta, sin anuncios, sin seguimiento. Tus elecciones se quedan en tu Apple TV.

TV Scores no tiene relación con las ligas, equipos, jugadores ni cadenas que muestra.
