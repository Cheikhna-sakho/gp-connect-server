import {PrismaClient} from "@prisma/client";
import {UserRepository} from "./index"; // Votre Repository personnalisé

export class RepositoryFactory {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  createUserRepository(): UserRepository {
    return new UserRepository(this.prisma);
  }

  // Autres méthodes pour créer d'autres types de repositories...
}
