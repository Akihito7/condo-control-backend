import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';
import { FinanceModule } from './modules/finance/finance.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { SecurityModule } from './modules/security/security.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, SupabaseModule, FinanceModule, CommunicationModule, IndicatorsModule, SecurityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
