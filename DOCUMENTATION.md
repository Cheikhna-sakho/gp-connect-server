# GPConnect — Backend Documentation

## Sommaire

1. [L'idée](#1-lidée)
2. [Ce que le projet résout](#2-ce-que-le-projet-résout)
3. [Architecture technique](#3-architecture-technique)
4. [Flux utilisateur complet](#4-flux-utilisateur-complet)
5. [Modules & API](#5-modules--api)
6. [Sécurité](#6-sécurité)
7. [Temps réel — WebSocket](#7-temps-réel--websocket)
8. [Modèle de données](#8-modèle-de-données)
9. [Mise en route](#9-mise-en-route)
10. [Comptes de test](#10-comptes-de-test)
11. [Déploiement](#11-déploiement)

---

## 1. L'idée

**GPConnect** est une marketplace de livraison collaborative entre particuliers, inspirée du modèle BlaBlaCar mais pour les colis.

Le principe : deux types d'utilisateurs co-existent sur la plateforme.

| Rôle | Qui | Ce qu'ils font |
|------|-----|----------------|
| **SHIPPER** | Particulier qui a un colis à envoyer | Cherche quelqu'un qui voyage vers sa destination |
| **CARRIER** | Particulier qui voyage et a de la capacité | Propose de transporter des colis sur son trajet |

**Exemple concret** :
- Thomas voyage de Paris à Lyon en voiture, il peut prendre 15 kg de bagages supplémentaires → il crée une annonce SHIPPING
- Alice doit envoyer 3 kg de vêtements à Lyon → elle trouve l'annonce de Thomas, ouvre une conversation, négocie le prix
- L'accord trouvé, Thomas récupère le colis chez Alice (preuve OTP), le livre à destination (preuve OTP)
- Chacun note l'autre

---

## 2. Ce que le projet résout

### Problème
Les solutions de livraison entre particuliers manquent de :
- Confiance vérifiée (qui est l'autre personne ?)
- Traçabilité physique de l'échange (le colis a-t-il vraiment changé de mains ?)
- Négociation structurée (offres, contre-offres)
- Sécurité des paiements

### Solution GPConnect

**Confiance** — Triple système de vérification :
- Email vérifié (OTP)
- Téléphone vérifié (SMS Twilio)
- Identité vérifiée (Stripe Identity KYC — carte d'identité/passeport)

**Traçabilité** — Système de preuves OTP à double sens :
- Le shipper génère un code de remise → le carrier l'entre pour confirmer le pickup
- Le shipper génère un code de livraison → le carrier l'entre pour confirmer la delivery

**Négociation** — Chat en temps réel avec offres structurées (price, weight) qui peuvent être acceptées/rejetées

**Litiges** — Si quelque chose se passe mal, le système de dispute documente la raison et permet à un admin de trancher

---

## 3. Architecture technique

### Stack

```
Backend        NestJS (Node.js, TypeScript)
ORM            Prisma
Base de données PostgreSQL
Temps réel     Socket.IO (via @nestjs/websockets)
Auth           JWT RS256 + OTP passwordless + OAuth (Google, Apple, Facebook)
Stockage       Cloudinary (images, audio)
KYC            Stripe Identity
SMS            Twilio
Email          Mailgun (via Nodemailer)
Sécurité       Helmet, CORS, Rate limiting (@nestjs/throttler)
```

### Structure des modules

```
src/
├── auth/           JWT, OTP, Google/Apple/Facebook SSO
├── users/          Profil, avatar, stats, préférences, adresses favorites
├── addresses/      Adresses géographiques partagées (villes + coordonnées GPS)
├── advertisements/ Annonces SHIPPING et DELIVERY
├── conversations/  Inbox — 1 conversation par (ad, shipper, carrier)
├── messages/       Chat + MessageOffer (offres structurées) + MediaMessages
├── missions/       Cycle de vie PENDING→ACCEPTED→IN_TRANSIT→COMPLETED
├── packages/       Colis du shipper (nom, poids, images)
├── proof/          Système OTP de confirmation physique
├── offers/         Acceptation/rejet d'offres de négociation
├── transactions/   Suivi du paiement (CASH/CARD/PAYPAL)
├── disputes/       Gestion des litiges avec résolution admin
├── ratings/        Notes post-mission (1-5 ★ avec commentaire)
├── identity/       Vérification KYC via Stripe Identity
├── chat/           Gateway WebSocket Socket.IO
├── cloudinary/     Upload et suppression de fichiers
├── medias/         Métadonnées des fichiers (image, audio, video)
└── common/         Guards, décorateurs, intercepteurs partagés
```

### Pattern de sérialisation

Chaque module expose une **Entity** avec `@Expose()` / `@Exclude()` / `@Transform()`. Le décorateur `@Serialize(Entity)` sur chaque route garantit que seuls les champs explicitement exposés sortent de l'API — pas de fuite de données sensibles.

```typescript
// Exemple
@Get('me')
@Serialize(UserEntity)  // ← contrôle explicite de la réponse
getMe(@GetUserId() id: UUID) {
  return this.usersService.findOne({ where: { id } });
}
```

---

## 4. Flux utilisateur complet

### Flux Carrier (transporteur)

```
1. Inscription → vérification email + téléphone
2. Vérification d'identité (Stripe KYC)
   ⚠ requise pour qu'une offre puisse être acceptée (gating dans OffersService.accept)
3. Créer une annonce DELIVERY (trajet)
   POST /advertisements/delivery
   { departure: "Paris", destination: "Lyon", date, price: 45€/kg, maxWeight: 15kg }

4. Recevoir des demandes de shippers dans les conversations
5. Négocier le prix via le chat (MessageOffer — price = montant TOTAL convenu)
6. Offre acceptée → mission ACCEPTED, transaction PENDING (une seule étape, atomique)
7. Récupérer le colis
   → Shipper génère le code : POST /missions/:id/proof/pickup   (mission ACCEPTED)
   → Carrier entre le code : POST /missions/:id/verify/pickup
   → Packages → PICKED_UP | Mission → IN_TRANSIT
8. Livrer le colis
   → Shipper génère le code : POST /missions/:id/proof/delivery (mission IN_TRANSIT)
     (si un destinataire avec téléphone est renseigné → code envoyé par SMS au destinataire)
   → Carrier entre le code reçu du destinataire : POST /missions/:id/verify/delivery
   → Packages → DELIVERED | Mission → COMPLETED | Transaction → COMPLETED
9. Laisser une note au shipper : POST /ratings/mission/:id
```

### Flux Shipper (expéditeur)

```
1. Inscription → vérification email
2. Créer ses colis : POST /packages
3. Option A — Trouver un carrier qui fait le trajet
   GET /advertisements?departureCityName=Paris&destinationCityName=Lyon
   → Ouvrir une conversation avec le carrier de son choix
     (une mission est créée avec les colis sélectionnés)
4. Option B — Poster sa demande
   POST /advertisements/shipping
   { departure, destination, date, price (budget total), packageIds }
   → annonce + mission-dossier (avec les colis) créées atomiquement
   → toutes les conversations ouvertes par des carriers se rattachent à cette mission
5. Négocier le prix (counter-offres possibles des deux côtés — price = montant TOTAL)
6. Accepter l'offre via le récapitulatif (trajet, prix, colis) → mission ACCEPTED
   ⚠ refusé si le carrier n'a pas vérifié son identité
7. [Recommandé] Renseigner le destinataire : PATCH /missions/:id { recipientName, recipientPhone }
8. Générer le code de remise (pickup) → montrer au carrier
9. Générer le code de livraison (mission IN_TRANSIT)
   → envoyé par SMS au destinataire s'il a un téléphone, sinon à transmettre soi-même
10. Laisser une note au carrier
```

### Machine à états Mission

```
                    ┌─────────────┐
                    │   PENDING   │ ← mission-dossier créée avec l'annonce SHIPPING,
                    └──────┬──────┘   ou à l'ouverture de conversation (annonce DELIVERY)
                           │ offre ACCEPTED
                    ┌──────▼──────┐
              ┌─────│  ACCEPTED   │─────┐
              │     └──────┬──────┘     │
              │            │ pickup OTP  │ CANCELLED
              │     ┌──────▼──────┐     │ (avant IN_TRANSIT)
              │     │ IN_TRANSIT  │─────┤
              │     └──────┬──────┘     │
              │            │ delivery   │ DISPUTED
              │            │ OTP        │ → table MissionDispute
              │     ┌──────▼──────┐     │
              │     │  COMPLETED  │     │
              │     └─────────────┘     │
              │                         │
              └────────►CANCELLED◄──────┘
                        (admin via
                         dispute)
```

---

## 5. Modules & API

### Authentification — `/auth`

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/auth/login` | Envoie un OTP par email ou SMS |
| POST | `/auth/otp` | Vérifie l'OTP → retourne user (tokens en cookies) |
| POST | `/auth/register` | Crée un compte + envoie OTP email + SMS |
| POST | `/auth/logout` | Efface les cookies |
| POST | `/auth/refresh` | Rafraîchit l'access token |
| GET  | `/auth/google` | Redirige vers Google OAuth |
| POST | `/auth/google/token` | Token exchange mobile Google |
| POST | `/auth/apple` | Token exchange Apple Sign In |
| POST | `/auth/facebook` | Token exchange Facebook |
| GET  | `/auth/verify-email` | Confirme l'email via token |

**Auth OTP :** passwordless — l'utilisateur reçoit un code à 6 chiffres par email ou SMS, valable 15 min, 5 tentatives max.

**Tokens :** JWT RS256 (access 5 min / refresh 7 jours), stockés en cookies httpOnly.

### Utilisateurs — `/users`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/users/me` | Profil connecté |
| PATCH | `/users` | Modifier son profil |
| POST | `/users/avatar` | Uploader son avatar |
| POST | `/users/verify/email/resend` | Renvoyer l'email de vérification |
| GET | `/users/me/stats` | Ses stats (missions, gains, note) |
| GET | `/users/:id/stats` | Stats publiques d'un utilisateur |
| GET | `/users/me/preferences` | Préférences notification |
| PATCH | `/users/me/preferences` | Modifier les préférences |
| GET | `/users/me/saved-addresses` | Adresses favorites |
| POST | `/users/me/saved-addresses/:addressId` | Sauvegarder une adresse |
| DELETE | `/users/me/saved-addresses/:addressId` | Retirer une adresse |

**Trust score :** chaque utilisateur expose `trust.level` (0-3) et `profileCompletion` (0-100%) en fonction de ses vérifications.

### Annonces — `/advertisements`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/advertisements` | Browse public (OPEN seulement) |
| GET | `/advertisements/mine` | Mes annonces (avec offers[]) |
| GET | `/advertisements/:id` | Détail d'une annonce |
| GET | `/advertisements/:id/offers` | Offres en attente sur mon annonce |
| POST | `/advertisements/shipping` | Créer une annonce SHIPPING (SHIPPER only) — accepte `packageIds[]` : l'annonce, sa **mission-dossier** (PENDING, sans carrier) et le rattachement des colis sont créés atomiquement |
| POST | `/advertisements/delivery` | Créer une annonce DELIVERY (CARRIER only) |
| PATCH | `/advertisements/:id` | Modifier (auteur only) |
| DELETE | `/advertisements/:id` | Supprimer (auteur only) |

**Filtres disponibles :**
```
?departureCityName=Paris&destinationCityName=Lyon
&maxWeight=10&sortBy=price&order=asc
&page=1&limit=20
```

### Conversations — `/conversations`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/conversations` | Ma liste (paginée, triée par lastMessageAt) |
| GET | `/conversations/:id` | Détail + messages |
| POST | `/conversations` | Ouvrir une conversation sur une annonce |
| DELETE | `/conversations/:id` | Fermer (participant only) |

**Contrainte :** une seule conversation par triplet `(advertisement, shipper, carrier)`.

### Messages — `/messages`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/messages/:conversationId` | Historique (participant only) |
| POST | `/messages` | Envoyer un message (TEXT ou OFFER) |
| POST | `/messages/media` | Envoyer un fichier (image/audio/video) |
| PATCH | `/messages/:id` | Modifier (auteur only) |
| DELETE | `/messages/:id` | Supprimer (auteur only) |

### Missions — `/missions`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/missions` | Mes missions actives (paginées) |
| GET | `/missions/:id` | Détail (participant only) |
| POST | `/missions` | Créer manuellement |
| POST | `/missions/:id/packages` | Ajouter des colis (PENDING/ACCEPTED only) |
| POST | `/missions/:id/proof/pickup` | Générer OTP pickup (Shipper, mission ACCEPTED) |
| POST | `/missions/:id/verify/pickup` | Vérifier OTP pickup (Carrier, mission ACCEPTED) |
| POST | `/missions/:id/proof/delivery` | Générer OTP delivery (Shipper, mission IN_TRANSIT) — envoie le code par SMS au destinataire si `recipientPhone` est renseigné (`sentToRecipient` dans la réponse) |
| POST | `/missions/:id/verify/delivery` | Vérifier OTP delivery (Carrier, mission IN_TRANSIT) |
| PATCH | `/missions/:id` | Statut : CANCELLED uniquement · Destinataire : `recipientName`/`recipientPhone` (Shipper, mission active) |
| DELETE | `/missions/:id/packages/:packageId` | Retirer un colis |

### Offres — `/offers`

| Méthode | Route | Description |
|---------|-------|-------------|
| PATCH | `/offers/:id` | Accepter ou rejeter une offre |
| GET | `/offers/accepted/:conversationId/last` | Dernière offre acceptée |

**Accepter une offre déclenche :** mission ACCEPTED + carrierId assigné + negotiatedPrice fixé + transaction créée + autres offres rejetées + autres missions PENDING de l'annonce annulées + leurs conversations archivées.

**Pré-requis :** le carrier doit avoir vérifié son identité (`idCardVerifiedAt`) — sinon 403, que ce soit lui ou le shipper qui accepte.

**Convention :** `offer.price` = **montant total convenu** pour `offer.weight` kg (pas un tarif au kg) — c'est ce montant qui devient `transaction.amount`.

### Preuves — système OTP

```
── Ramassage (mission ACCEPTED) ────────────────────────────────
Shipper → POST /missions/:id/proof/pickup
         ← { code: "481920", expiresAt: ... }
         → montre le code au Carrier

Carrier → POST /missions/:id/verify/pickup { code: "481920" }
         ← proof verified
         → Packages PICKED_UP, Mission IN_TRANSIT

── Livraison (mission IN_TRANSIT) ──────────────────────────────
Shipper → POST /missions/:id/proof/delivery
         ← { code: "729384", expiresAt, sentToRecipient }
         → si recipientPhone renseigné : SMS automatique au destinataire
           sinon : le shipper transmet le code lui-même

Destinataire → donne le code au Carrier à la remise du colis

Carrier → POST /missions/:id/verify/delivery { code: "729384" }
         ← proof verified
         → Packages DELIVERED, Mission COMPLETED, Transaction COMPLETED
```

### Transactions — `/transactions`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/transactions/mission/:id` | Transaction d'une mission (participant — shipper ET carrier) |
| PATCH | `/transactions/:id` | Changer la méthode de paiement (Shipper, si PENDING) |

**Cycle automatique :** PENDING (à l'acceptation) → COMPLETED (à la livraison) / CANCELLED (si mission annulée).

**Paiement hors plateforme :** GPConnect ne traite pas les fonds — le paiement
se fait de main à main (espèces) à la remise. La transaction trace le montant
convenu et son statut. `transactionReference` est réservé à une future
intégration PSP (escrow : encaissement à l'acceptation, libération à la
vérification du code livraison).

### Disputes — `/disputes`

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/disputes/mission/:id` | Ouvrir un litige `{ reason, description }` |
| GET | `/disputes/mission/:id` | Voir le litige d'une mission |
| GET | `/disputes?status=OPEN` | Tous les litiges (ADMIN) |
| PATCH | `/disputes/:id` | Résoudre `{ resolution, missionOutcome }` (ADMIN) |

### Notes — `/ratings`

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/ratings/mission/:id` | Noter l'autre partie (1-5 ★, mission COMPLETED) |
| GET | `/ratings/received` | Notes reçues (connecté) |
| GET | `/ratings/user/:id` | Notes reçues par un utilisateur (public) |
| GET | `/ratings/mission/:id` | Notes d'une mission |

### Identité KYC — `/identity`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/identity/status` | Statut de vérification |
| POST | `/identity/start` | Démarrer la vérification Stripe |
| POST | `/identity/webhook` | Webhook Stripe (public, signature vérifiée) |

### Adresses & villes — `/addresses`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/addresses` | Liste d'adresses |
| GET | `/addresses/cities?search=par&country=France` | Autocomplétion de villes |
| GET | `/addresses/:id` | Détail |

### Paquets — `/packages`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/packages` | Mes colis |
| POST | `/packages` | Créer un colis |
| POST | `/packages/full` | Créer avec images |
| POST | `/packages/:id/images` | Ajouter des images (propriétaire only) |
| PATCH | `/packages/:id` | Modifier |
| DELETE | `/packages/:id` | Supprimer (avec nettoyage Cloudinary) |

---

## 6. Sécurité

### Authentification & autorisation

- **JWT RS256** — clés asymétriques, access token 5 min, refresh token 7 jours
- **Cookies httpOnly** — tokens non accessibles depuis JavaScript
- **Guard global** — toutes les routes protégées par défaut, `@Public()` pour les exceptions
- **Roles guard** — `@Roles('ADMIN')`, `@Roles('CARRIER')`, `@Roles('SHIPPER')`

### Rate limiting

| Endpoint | Limite |
|----------|--------|
| `POST /auth/login` | 5 req/min |
| `POST /auth/register` | 3 req/heure |
| `POST /auth/otp` | 5 tentatives / 15 min |
| SSO (Google, Apple, Facebook) | 5 req/min |
| Global (toutes routes) | 100 req/min |

### Guards métier

| Opération | Vérification |
|-----------|-------------|
| Ajouter un colis à une mission | `mission.shipperId === userId` + status PENDING/ACCEPTED + package.ownerId === userId |
| Générer OTP pickup/delivery | `mission.shipperId === userId` + status ACCEPTED |
| Vérifier OTP pickup/delivery | `mission.carrierId === userId` + status ACCEPTED/IN_TRANSIT |
| Annuler une mission | Status ≤ ACCEPTED (IN_TRANSIT bloqué — doit disputer) |
| Faire une offre | Annonce non expirée + statut OPEN ou IN_PROGRESS |
| Supprimer un message | `message.authorId === userId` |
| Lire les messages | Participant de la conversation |
| Webhook Stripe | Signature HMAC vérifiée |

### Suppression Cloudinary

Quand un media est supprimé de la DB, le fichier est également supprimé sur Cloudinary — pas de fichiers orphelins en storage.

---

## 7. Temps réel — WebSocket

**Namespace :** `/chat` (Socket.IO)

**Auth à la connexion :** JWT via cookie httpOnly `at` ou header `Authorization: Bearer <token>`.

### Rooms

Chaque client rejoint automatiquement :
- `user:<userId>` — room personnelle (stats, notifications directes)
- À la demande : `<conversationId>` — room de conversation

### Événements client → serveur

| Event | Payload | Description |
|-------|---------|-------------|
| `join` | `{ conversationId }` | Rejoindre une room de conversation |
| `leave` | `{ conversationId }` | Quitter |
| `message:send` | `CreateMessageDto` | Envoyer un message |
| `typing:start` | `{ conversationId }` | Indicateur de frappe |
| `typing:stop` | `{ conversationId }` | Fin de frappe |

### Événements serveur → client

| Event | Room cible | Déclencheur |
|-------|-----------|------------|
| `message:new` | Conversation | Nouveau message (REST ou WS) |
| `offer:updated` | Conversation | Offre acceptée ou rejetée |
| `mission:status-changed` | Conversation | Changement d'état de la mission |
| `proof:verified` | Conversation | OTP validé (pickup ou delivery) |
| `stats:updated` | `user:<id>` | Mission terminée → invalider le cache stats |
| `typing` | Conversation | `{ userId, isTyping: bool }` |

### Exemple client (React Native / web)

```typescript
const socket = io('http://localhost:4000/chat', {
  auth: { token: 'Bearer <accessToken>' },
  // ou via cookie httpOnly automatiquement
});

socket.on('connect', () => {
  socket.emit('join', { conversationId: 'abc-123' });
});

socket.on('message:new', (message) => { /* ajouter au chat */ });
socket.on('mission:status-changed', ({ status }) => { /* mettre à jour l'UI */ });
socket.on('proof:verified', ({ type }) => { /* notifier */ });
socket.on('stats:updated', () => { /* invalider ['user', 'stats'] dans React Query */ });
socket.on('typing', ({ userId, isTyping }) => { /* indicateur */ });
```

---

## 8. Modèle de données

### Entités principales

```
User ──────────────────────────────────────────────────────┐
  id, email, phone, firstName, lastName, role               │
  emailVerifiedAt, phoneVerifiedAt, idCardVerifiedAt         │
  → UserAvatar (1:1)                                         │
  → UserPreferences (1:1)                                    │
  → UserIdentity (Stripe KYC) (1:1 par provider)            │
  → UserProvider (Google/Apple/Facebook)                     │
  → VerificationToken (OTP email/phone)                      │
                                                             │
Advertisement ──────────────────────────────────────────────┤
  type: SHIPPING | DELIVERY                                  │
  status: OPEN | IN_PROGRESS | COMPLETED | CLOSED           │
  price, maxWeight (SHIPPING) / weight (DELIVERY)           │
  departure (Address), destination (Address)                 │
  authorId (User)                                           │
                                                             │
Mission ────────────────────────────────────────────────────┤
  status: PENDING→ACCEPTED→IN_TRANSIT→COMPLETED             │
  shipperId, carrierId (nullable jusqu'à acceptation)        │
  negotiatedPrice (fixé à l'acceptation)                    │
  → Transaction (1:1)                                        │
  → MissionProof (pickup + delivery, OTP)                    │
  → MissionPackage (colis inclus dans la mission)           │
  → MissionDispute (1:1, si litige)                         │
  → MissionRating (notes données par les 2 parties)         │
                                                             │
Conversation ───────────────────────────────────────────────┤
  (advertisement, shipper, carrier) unique                   │
  status: ACTIVE | ARCHIVED                                  │
  lastMessageAt (pour tri inbox)                             │
  → Mission (1:1, créée à l'ouverture)                      │
  → Message[]                                               │
                                                             │
Message ────────────────────────────────────────────────────┤
  type: TEXT | OFFER | MEDIA                                 │
  → MessageOffer (1:1, si type=OFFER)                       │
  → MessageMedia[] (si type=MEDIA)                          │
                                                             │
Package ─────────────────────────────────────────────────────┤
  status: PENDING→PICKED_UP→DELIVERED                       │
  → PackageMedia[] (images du colis)                        │
```

### Adresses

```
City ──────────────────────────
  name, country, countryIsoCode
  @@unique([name, countryIsoCode])   ← une seule entrée par ville

Address ───────────────────────
  street, zipCode, latitude, longitude
  cityId (City)
  @@unique([latitude, longitude])    ← déduplication par GPS
```

Les adresses sont des **ressources partagées** — plusieurs annonces peuvent référencer la même adresse physique. Elles sont créées automatiquement via `createIfNotExist` lors de la création d'annonces.

---

## 9. Mise en route

### Prérequis

- Node.js ≥ 18
- PostgreSQL ≥ 14
- pnpm

### Installation

```bash
git clone <repo>
cd gp/server
pnpm install
```

### Variables d'environnement

```bash
cp .env.example .env
```

Remplir les variables :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/gpconnect

# JWT — générer avec : node utils/rsaKeyGenerator.util.ts
ACCESS_TOKEN_SECRET=<clé privée RSA>
ACCESS_TOKEN_PUBLIC=<clé publique RSA>
REFRESH_TOKEN_SECRET=<clé privée RSA>
REFRESH_TOKEN_PUBLIC=<clé publique RSA>
ACCESS_TOKEN_EXP="5min"
REFRESH_TOKEN_EXP="7d"

# Cloudinary (stockage fichiers)
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Stripe (KYC Identity)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET_IDENTITY=whsec_...
STRIPE_IDENTITY_RETURN_URL=http://localhost:3000/verification/return
STRIPE_IDENTITY_REFRESH_URL=http://localhost:3000/verification/refresh

# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Apple Sign In (bundle ID de l'app iOS)
APPLE_CLIENT_ID=com.yourcompany.gpconnect

# Email (Mailgun)
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USER=postmaster@...mailgun.org
MAIL_PASS=...
MAIL_FROM=no-reply@gpconnect.com

# SMS (Twilio)
TWILIO_SID=...
TWILIO_AUTH_TOKEN=...

# App
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Génération des clés RSA

```bash
npx ts-node utils/rsaKeyGenerator.util.ts
# Copier les clés dans le .env
```

### Base de données

```bash
# Appliquer toutes les migrations
npx prisma migrate deploy

# Régénérer le client Prisma
npx prisma generate
```

### Démarrage

```bash
# Développement (hot reload)
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

### Seed — données de test

```bash
pnpm seed
```

Efface la base et recrée un jeu de données cohérent.

---

## 10. Comptes de test

Après le seed, **tous les comptes utilisent l'OTP universel : `123456`**

```
Flow de connexion :
1. POST /auth/login { email: "alice@gpconnect.test" }
2. POST /auth/otp   { email: "alice@gpconnect.test", code: "123456", type: "EMAIL" }
   → Connecté, cookies httpOnly définis
```

### Comptes disponibles

| Email | Rôle | Trust | Description |
|-------|------|-------|-------------|
| `thomas@gpconnect.test` | CARRIER | ⭐⭐⭐ | Email + téléphone + KYC — top rated (5/5) |
| `julie@gpconnect.test` | CARRIER | ⭐⭐ | Email + téléphone |
| `antoine@gpconnect.test` | CARRIER | ⭐⭐ | Email + téléphone |
| `alice@gpconnect.test` | SHIPPER | ⭐ | Email uniquement |
| `marc@gpconnect.test` | SHIPPER | ⭐ | Email uniquement |
| `sophie@gpconnect.test` | SHIPPER | ⭐ | Email uniquement |
| `admin@gpconnect.test` | ADMIN | ⭐ | Accès admin complet |

### Scénarios pré-chargés

| Scénario | Parties | Route | État |
|----------|---------|-------|------|
| ✅ Mission terminée | Marc + Thomas | Paris → Lyon | `COMPLETED` + notes 5⭐ |
| 🚚 En transit | Alice + Thomas | Paris → Marseille | `IN_TRANSIT` |
| 🤝 Acceptée | Sophie + Julie | Paris → Bordeaux | `ACCEPTED` |
| 💬 Négociation | Alice + Antoine | Paris → Toulouse | `PENDING` + offre en attente |
| 📩 Nouvelle conv. | Marc + Julie | Lille → Paris | `PENDING` |

---

## 11. Déploiement

### Variables d'environnement production

Mettre `NODE_ENV=production` pour activer :
- Cookies `secure: true` (HTTPS only)
- Logs en mode prod (sans console.log dev)
- OTP envoyé réellement par SMS et email

### Docker

```bash
docker-compose up --build
```

Le `docker-compose.yml` lance PostgreSQL + le serveur NestJS.

### Fly.io (configuration incluse)

```bash
fly deploy
```

La configuration `fly.toml` est présente à la racine.

### Render (configuration incluse)

Le fichier `render.yaml` est configuré pour le déploiement automatique.

### Migrations en production

```bash
npx prisma migrate deploy  # jamais migrate dev en prod
```

---

## Structure des migrations

```
prisma/migrations/
├── 20241031224820_init/
├── ...
├── 20260514120000_media_type_and_public_id/     ← enum MediaType, publicId Cloudinary
├── 20260514130000_conversation_and_message_improvements/
├── 20260514140000_advertisement_status_and_cleanup/
├── 20260514150000_city_unique_and_column_rename/
├── 20260514160000_package_cascade_deletes/
├── 20260514170000_auth_provider_apple_facebook/
├── 20260514180000_ux_personalization/            ← ratings, preferences, saved addresses
├── 20260514190000_mission_in_transit_and_ad_indexes/
└── 20260515120000_mission_dispute/               ← table litiges
```

---

*Documentation générée à partir du code source — mai 2026*
