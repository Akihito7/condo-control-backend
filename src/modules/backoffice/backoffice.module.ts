import { Module } from "@nestjs/common";
import { BackofficeController } from "./backoffice.controller";
import { BackofficeService } from "./backoffice.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [BackofficeController],
  providers: [BackofficeService]
})
export class BackofficeModule {

}