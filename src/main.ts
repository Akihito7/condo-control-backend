import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /*   app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    ); */
  app.enableCors();
  
  setInterval(() => {
    const used = process.memoryUsage();
    console.log('MEM USAGE:');
    for (let key in used) {
      console.log(`${key}: ${(used[key] / 1024 / 1024).toFixed(2)} MB`);
    }
  }, 10000);


  await app.listen(process.env.PORT ?? 3030);
}
bootstrap();
