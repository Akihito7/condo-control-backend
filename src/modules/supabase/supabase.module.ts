import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService): SupabaseClient => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL')!;
        const supabaseKey = configService.get<string>('SUPABASE_KEY')!;
        const supabaseClient = createClient(supabaseUrl, supabaseKey)
        return supabaseClient;
      },
      inject: [ConfigService]
    }
  ],
  exports: [SUPABASE_CLIENT]
})
export class SupabaseModule { }