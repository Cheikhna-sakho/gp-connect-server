// import {PrismaClient, Utilisateur} from "@prisma/client";
// import dotenv from "dotenv";
// import {Repository} from "./Repository";
// import express, {Request, Response} from "express";
// import {RepositoryFactory} from "./RepositoryFactory";

// dotenv.config({path: "./.env"});
// // const prisma = new PrismaClient();

// // async function main(): Promise<object> {
// //   await prisma.utilisateur.create({
// //     data: {
// //       nom: "Jane Smith",
// //       email: "arrivant@lalalalala.fr",
// //       age: 27,
// //     },
// //   });

// //   return prisma.utilisateur.findMany();
// // }

// // main()
// //   .catch(e => {
// //     throw e;
// //   })
// //   .finally(async () => {
// //     await prisma.$disconnect();
// //   });

// export class UserRepository implements Repository<Utilisateur> {
//   private prisma: PrismaClient;

//   constructor(prisma: PrismaClient) {
//     this.prisma = prisma;
//   }

//   async create(data: Required<Utilisateur>): Promise<Utilisateur> {
//     return this.prisma.utilisateur.create({data});
//   }

//   async findById(id: number): Promise<Utilisateur | null> {
//     return this.prisma.utilisateur.findUnique({where: {id}});
//   }

//   async findAll(): Promise<Utilisateur[]> {
//     return this.prisma.utilisateur.findMany();
//   }

//   async update(
//     id: number,
//     data: Partial<Utilisateur>,
//   ): Promise<Utilisateur | null> {
//     await this.prisma.utilisateur.update({where: {id}, data});
//     return this.findById(id); // Retourne l'objet mis à jour
//   }

//   async delete(id: number): Promise<boolean> {
//     const deletedUser = await this.prisma.utilisateur.delete({where: {id}});
//     return !!deletedUser; // Retourne true si l'utilisateur a été supprimé, sinon false
//   }
// }
// const app = express();

// const prisma = new PrismaClient();

// const repositoryFactory = new RepositoryFactory(prisma);
// app.use(express.json());

// app.post("/users", async (req: Request, res: Response) => {
//   const userRepository = repositoryFactory.createUserRepository();
//   const newUser = await userRepository.create(req.body);
//   res.json(newUser);
// });

// // Autres routes...

// app.listen(3000, () => {
//   console.log("Server is running on port 3000");
// });

// // Autres méthodes du Repository...

import express from "express";
import bodyParser from "body-parser";
import container from "./containers/containers";
import {UserController} from "./controllers/userController";

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const userController = container.resolve<UserController>("userController");

app.post("/api/users", userController.createUser.bind(userController));
app.get("/api/users/:id", userController.getUser.bind(userController));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
