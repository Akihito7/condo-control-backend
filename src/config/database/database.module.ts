import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "./database.service";
import { PostgresService } from "./postgres/postgres.service";

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useClass: PostgresService
    }
  ],
  exports: [DatabaseService]
})
export class DatabaseModule { }