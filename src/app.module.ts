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
import { StructureModule } from './modules/structure/structure.module';
import { BackofficeModule } from './modules/backoffice/backoffice.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, SupabaseModule, FinanceModule, CommunicationModule, IndicatorsModule, SecurityModule, StructureModule, BackofficeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
