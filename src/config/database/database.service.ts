export abstract class DatabaseService {
  abstract query(query: string, dependencies?: string[]): Promise<any>;
}
