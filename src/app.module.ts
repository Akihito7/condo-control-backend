import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';
import { FinanceModule } from './modules/finance/finance.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, SupabaseModule, FinanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
