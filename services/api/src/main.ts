import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      "http://localhost:8081",
      "http://localhost:19006",
      "http://localhost:3000",
      "https://easeful-sulphate-lethargic.ngrok-free.dev",
    ],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('HackYeah')
    .setDescription('Fistaszkowy Swagger')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app as any, config);

  SwaggerModule.setup('docs', app as any, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
