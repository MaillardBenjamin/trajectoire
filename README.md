# Trajectoires

Trajectoires recrée un jeu de course automobile joué en amphithéâtre sur une feuille A4 à petits carreaux. Chaque partie se déroule sur un circuit fermé. Les voitures partent d’intersections distinctes sur la grille et laissent leur trajectoire sur le papier.

[Jouer à Trajectoires](https://trajectoires-course-papier.beigetitan17.chatgpt.site) (accès privé)

## Lancer le jeu en local

Le jeu fonctionne dans le navigateur avec HTML, CSS et JavaScript. Python 3 suffit pour servir les fichiers en local.

```sh
git clone https://github.com/MaillardBenjamin/trajectoire.git
cd trajectoire
python3 -m http.server 8000 --bind 127.0.0.1 --directory trajectoires/dist
```

Ouvre [http://127.0.0.1:8000](http://127.0.0.1:8000), choisis le mode de jeu, le circuit et le nombre de tours, puis clique sur **Nouvelle course**.

## Circuits

Choisis parmi dix tracés classés par difficulté, de **L’Anneau** aux **Doubles Épingles**, ou sélectionne **Circuit aléatoire** pour générer un tracé à chaque partie. Le nombre de tours se règle de **1 à 3** dans les deux modes de jeu.

## Règles

1. Jouez chacun votre tour. Clique sur une intersection proposée ou utilise le tableau des déplacements.
2. Tu peux accélérer ou ralentir d’un carreau par tour, ou garder ta vitesse. À vitesse constante, **Tout droit** reproduit ton dernier déplacement. Si tu viens d’avancer de quatre carreaux vers le haut et d’un vers la droite, tu refais le même déplacement.
3. Plus tu roules lentement, plus tu peux tourner serré. À vitesse 1, deux virages successifs permettent de passer d’une direction à sa perpendiculaire en passant par une diagonale.
4. Le segment entier doit rester sur la piste et se terminer sur une intersection libre. Si aucun coup n’est possible, passe ton tour. Tu repartiras à vitesse 1.
5. Le premier à franchir la ligne de départ et d’arrivée dans le sens de la course après avoir bouclé le nombre de tours choisi gagne.

Sur la grille, chaque voiture est représentée par un point. Dès son premier déplacement, elle devient une flèche orientée dans le sens de son dernier mouvement.

## Modes de jeu

- **Multijoueur local** — 2 à 4 joueurs partagent le même écran.
- **Solo contre l’IA** — un duel à tour de rôle. En **Faible**, l’adversaire roule prudemment et garde de la marge dans les virages. En **Moyen**, il tient compte de ta position pour choisir sa sortie. En **Dur**, il cherche à finir en un minimum de coups et simule tes réponses possibles.

## Code source

Les fichiers dans [`trajectoires/dist/`](trajectoires/dist/) sont directement servis par le navigateur.

| Fichier | Rôle |
| --- | --- |
| [`index.html`](trajectoires/dist/index.html) et [`style.css`](trajectoires/dist/style.css) | Interface et mise en page |
| [`engine.js`](trajectoires/dist/engine.js) | Génération des circuits, validation des coups et suivi du tour |
| [`race.js`](trajectoires/dist/race.js) | Déroulement de la partie et dessin de la piste |
| [`opponent.js`](trajectoires/dist/opponent.js) et [`opponent-worker.js`](trajectoires/dist/opponent-worker.js) | Calcul des trajectoires de référence et choix des coups de l’IA dans un Web Worker |

## Licence

Ce projet est distribué sous [licence MIT](LICENSE).
