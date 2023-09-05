import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const newUser = await prisma.utilisateur.create({
    data: {
      nom: "Jane Smith",
      email: "bouga@bouga.fr",
      age: 27,
    },
  });
  const allUsers = await prisma.utilisateur.findMany();
  console.log(allUsers);
}
main()
  .catch((e) => {
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
//# sourceMappingURL=index.js.map
