# Migration `20200424210806-removed-local-leaderboard-concept`

This migration has been generated by Salvatore at 4/24/2020, 9:08:06 PM.
You can check out the [state of the schema](schema.prisma) after the migration.

## Database Steps

```sql
ALTER TABLE "public"."GlobalLeaderboardEntry" ADD COLUMN "serverId" integer  NOT NULL ;

ALTER TABLE "public"."GlobalLeaderboardEntry" ADD FOREIGN KEY ("serverId")REFERENCES "public"."Server"("id") ON DELETE CASCADE  ON UPDATE CASCADE

DROP TABLE "public"."ServerLeaderboardEntry";
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration 20200424205552-more-leaderboard..20200424210806-removed-local-leaderboard-concept
--- datamodel.dml
+++ datamodel.dml
@@ -1,11 +1,11 @@
 datasource db {
   provider = "postgresql"
-  url = "***"
+  url      = env("DATABASE_URL")
 }
 generator client {
-  provider = "prisma-client-js"
+  provider      = "prisma-client-js"
   binaryTargets = ["native"]
 }
 model User {
@@ -15,43 +15,26 @@
   username     String   @unique
   passwordHash String?
 }
-model ServerLeaderboardEntry {
-  id                 Int              @default(autoincrement()) @id
-  createdAt          DateTime         @default(now())
-   updatedAt          DateTime         @default(now())
- serverId           Int
-  server             Server           @relation(fields: [serverId], references: [id])
-  score              Int
-  sessionId            String @unique()
-  userId               Int
-  user                 User   @relation(fields: [userId], references: [id])
-  aliveTime            Int
-  damageGiven          Int
-  damageTaken          Int
-  enemiesKilled        Int
-  eventsParticipatedIn Int
-  shotsFired           Int
-  }
-
 model GlobalLeaderboardEntry {
-  id                 Int              @default(autoincrement()) @id
-  createdAt          DateTime         @default(now())
-  updatedAt          DateTime         @default(now())
-  score              Int
-  sessionId            String  @unique()
+  id                   Int      @default(autoincrement()) @id
+  createdAt            DateTime @default(now())
+  updatedAt            DateTime @default(now())
+  score                Int
+  sessionId            String   @unique
   userId               Int
-  user                 User   @relation(fields: [userId], references: [id])
+  user                 User     @relation(fields: [userId], references: [id])
+  serverId             Int
+  server               Server   @relation(fields: [serverId], references: [id])
   aliveTime            Int
   damageGiven          Int
   damageTaken          Int
   enemiesKilled        Int
   eventsParticipatedIn Int
   shotsFired           Int
 }
-
 model Server {
   id        Int      @default(autoincrement()) @id
   createdAt DateTime @default(now())
   updatedAt DateTime @default(now())
```

