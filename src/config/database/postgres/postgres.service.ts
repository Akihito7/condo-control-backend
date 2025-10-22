import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database.service";
import { Pool } from "pg";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PostgresService extends DatabaseService implements OnModuleInit, OnModuleDestroy {

  constructor(private readonly configService: ConfigService) {
    super()
  }

  private pool: Pool;

  onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL')
    this.pool = new Pool({
      connectionString
    });
    console.log("PG IS ON.")
  }

  onModuleDestroy() {
    this.pool.end()
    console.log("PG IS OFF.")
  }

  async query(query: string, dependencies?: string[]) {
    const client = await this.pool.connect();
    const result = await client.query(query, dependencies)
    return result.rows
  }
}