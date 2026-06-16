<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

---

# Journal des modifications

> Rapport des changements récents (sécurité, validation, cohérence des flux).
> Daté en absolu. Les points marqués _(client)_ ont une contrepartie dans le repo `client/`.

## 2026-06-16

### 🔐 Auth — déconnexion : plus de reconnexion automatique
- Le refresh transparent (intercepteur 401) pouvait **ressusciter la session pendant le logout** : si une requête tombait en 401 pile au moment de la déconnexion, `refresh()` repouvait un cookie `at` alors que `rt` était encore présent.
- Ajout d'un garde `beginLogout()` qui coupe le refresh dès que la déconnexion est engagée. _(client : `axiosConfig`, `auth.service`)_

### 🔐 Auth — login OTP par identifiant (email **ou** téléphone)
- Le champ `email` transportait aussi le numéro de téléphone → confusion **et bug** : la vérification OTP par SMS échouait (`findByEmail(phone)` → `null`).
- Renommage `email` → `identifier`. Le compte est résolu sur les deux colonnes (`findByIdentifier`), l'OTP est vérifié par **`userId` + canal** (`verifyOtpToken` prend désormais un `userId`). `sendOptTo`/`type` ne désignent plus que le **canal** d'envoi, pas la nature de l'identifiant. _(client : `auth.api`, écrans login/otp/register)_

### 🧹 Annonces — suppression de la colonne morte `weight`
- La colonne `weight` (table `advertisements`) n'était jamais écrite (toujours 0). La capacité est portée par `maxWeight`, le consommé est calculé (`cumulatedWeight`), le restant = `maxWeight − cumulatedWeight`.
- Migration `drop_advertisement_weight` + retrait du champ de l'entity/seeder. `maxWeight` rendu optionnel (défaut DB `0`), déduplication du DTO. _(client : type `Advertisement`)_

### 🔐 Users — corrections de sécurité (module `users`)
1. **Élévation de privilège** : `role` retiré de `CreateUserDto` (inscription forcée en `SHIPPER`) et le self-update passe par `UpdateProfileDto` restreint (`role` borné à `SHIPPER|CARRIER`, jamais `ADMIN`). `UpdateUserDto` complet réservé à la route admin.
2. **Contournement de vérification (KYC)** : `emailVerifiedAt` / `phoneVerifiedAt` / `idCardVerifiedAt` ne sont plus settables par l'utilisateur (sortis du DTO self) — empêche d'auto-débloquer les offres transporteur.
3. **Fuite de PII** : `GET /users/:id` (public) sérialise désormais `PublicUserEntity` — plus d'email/téléphone/timestamps de vérification, seulement identité d'affichage + `trust`/`profileCompletion` agrégés.
4. **Upload avatar borné** : limite 5 Mo + allowlist MIME image (anti DoS mémoire / upload arbitraire), 400 si aucun fichier.

> ⏳ **À traiter (reporté)** — changement d'email/téléphone : aujourd'hui le `*VerifiedAt` n'est pas réinitialisé à la modif → statut « vérifié » périmé. Flux strict (re-vérification OTP avant application) à concevoir.

### ✅ Validation — durcissement DTOs
- `ValidationPipe` : ajout de `transform: true`.
- `CreateOfferDto` (messages) : `price` et `weight` typés `@IsNumber`/`@Type(Number)` + bornes (`@Min(0)`, `@IsPositive`).
- `CreatePackageDto` : `weight` aligné sur le contrat client (nombre `> 0`, `≤ 1000` kg) au lieu de `@IsNumberString`.
